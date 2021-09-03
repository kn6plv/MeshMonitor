const EventEmitter = require('events');
const MovingAverage = require('moving-average');
const OLSR = require('./olsrlib');
const Alerts = require('./alerts');
const nameService = require('./nameService');
const Log = require('debug')('health');

const MAXHOP_OVER_TIME = 2 * 60 * 1000; // 2 minutes
const MAXHOP_ALERT_HIGH = 50;
const MAXHOP_ALERT_LOW = 40;

class Health extends EventEmitter {

  constructor() {
    super();

    this.stormer = null;
    this.maxHopTrack = MovingAverage(MAXHOP_OVER_TIME);

    OLSR.getInstance().on('message', async m => {
      this.maxHopTrack.push(m.timestamp, m.maxHop);
      if (!this.stormer && this.maxHopTrack.movingAverage() >= MAXHOP_ALERT_HIGH && m.maxHop >= MAXHOP_ALERT_HIGH) {
        const name = nameService.lookupNameByIP(m.originator);
        if (name) {
          this.stormer = `${name} (${m.originator})`;
        }
        else {
          this.stormer = m.originator;
        }
        this.emit('update');
        await Alerts.notify(`Storm detected on ${Config.General.Name} Mesh by ${this.stormer}`);
      }
      else if (this.stormer && this.maxHopTrack.movingAverage() <= MAXHOP_ALERT_LOW) {
        this.stormer = null;
        this.emit('update');
        await Alerts.notify(`Storm subsided on ${Config.General.Name} Mesh`);
      }
    });

    if (Log.enabled) {
      Alerts.notify(`Starting ${Config.General.Name} Mesh Monitor`);
    }
  }

  getHealth() {
    if (!this.stormer) {
      return {
        healthy: true,
        text: 'Good'
      }
    }
    return {
      healthy: false,
      reason: 'storm',
      text: this.stormer
    };
  }

}

module.exports = new Health();
