const EventEmitter = require('events');
const MovingAverage = require('moving-average');
const OLSR = require('./olsrlib');
const Alerts = require('./alerts');
const NameService = require('./nameService');
const Log = require('debug')('health');

const MAXHOP_OVER_TIME = 2 * 60 * 1000; // 2 minutes
const MAXHOP_ALERT_HIGH = Config.Health.Storm.HopCount.Begin;
const MAXHOP_ALERT_LOW = Config.Health.Storm.HopCount.End;
const VALID_ALERT_LOW = Config.Health.ValidLow.Valid.Begin;
const VALID_ALERT_HIGH = Config.Health.ValidLow.Valid.End;

class Health extends EventEmitter {

  constructor() {
    super();

    function btoa(v) {
      return Buffer.from(v).toString('base64');
    }

    this.unhealthy = null;
    const maxHopTrack = MovingAverage(MAXHOP_OVER_TIME);
    let validAverage = 0;

    let last = Date.now();

    OLSR.getInstance().on('message', async m => {

      maxHopTrack.push(m.timestamp, m.maxHop);
      validAverage = validAverage * 0.9999 + 0.0001 * (m.timestamp - last);
      last = m.timestamp;

      if (!this.unhealthy) {
        if (maxHopTrack.movingAverage() >= MAXHOP_ALERT_HIGH && m.maxHop >= MAXHOP_ALERT_HIGH) {
          const name = NameService.lookupNameByIP(m.originator);
          if (name) {
            this.unhealthy = {
              reason: 'Storm',
              text: `${name} (${m.originator})`,
              link: `#node#${btoa(JSON.stringify({ name: name, timestamp: Date.now() }))}`
            };
          }
          else {
            this.unhealthy = {
              reason: 'Storm',
              text: m.originator,
              link: `#node#${btoa(JSON.stringify({ name: m.originator, timestamp: Date.now() }))}`
            };
          }
          this.emit('update');
          await Alerts.notify(`Storm detected on ${Config.General.Name} Mesh by ${this.unhealthy.text}`);
        }
        else if (1000 / validAverage <= VALID_ALERT_LOW) {
          this.unhealthy = {
            reason: 'Low Messages',
            text: 'Valid message rate low'
          };
          this.emit('update');
          await Alerts.notify(`Valid message rate on ${Config.General.Name} Mesh is low`);
        }
      }
      else {
        switch (this.unhealthy.reason) {
          case 'Storm':
            if (maxHopTrack.movingAverage() <= MAXHOP_ALERT_LOW) {
              this.unhealthy = null;
              this.emit('update');
              await Alerts.notify(`Storm subsided on ${Config.General.Name} Mesh`);
            }
            break;
          case 'Low Messages':
            if (1000 / validAverage >= VALID_ALERT_HIGH) {
              this.unhealthy = null;
              this.emit('update');
              await Alerts.notify(`Valid message rate on ${Config.General.Name} Mesh returned to normal`);
            }
            break;
          default:
            break;
        }
      }
    });

    if (Log.enabled) {
      Alerts.notify(`Starting ${Config.General.Name} Mesh Monitor`);
    }
  }

  getHealth() {
    if (!this.unhealthy) {
      return {
        healthy: true,
        text: 'Good'
      }
    }
    return Object.assign({ healthy: false }, this.unhealthy);
  }

}

module.exports = new Health();
