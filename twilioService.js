const Log = require('debug')('twilio');
const Twilio = require('twilio');
const MovingAverage = require('moving-average');
const OLSR = require('./olsrlib');

const MAXHOP_OVER_TIME = 2 * 60 * 1000; // 2 minutes
const MAXHOP_ALERT = 40;

if (!Config.Twilio) {
  return;
}

const Client = Twilio(Config.Twilio.accountSid, Config.Twilio.authToken);
if (Log.enabled) {
  Client.logLevel = 'debug';
}

const notify = async (text) => {
  try {
    await Client.messages.create({
      body: text,
      to: Config.Twilio.toPhoneNumber,
      from: Config.Twilio.fromPhoneNumber
    });
  }
  catch (e) {
    Log(e);
  }
}

const maxHopTrack = MovingAverage(MAXHOP_OVER_TIME);

OLSR.getInstance().on('message', async m => {
  maxHopTrack.push(m.timestamp, m.maxHop);
  if (maxHopTrack.movingAverage() >= MAXHOP_ALERT) {
    await notify(`Storm detected on ${Config.General.Name} Mesh`);
  }
});

if (Log.enabled) {
  notify(`Starting ${Config.General.Name} Mesh Monitor`);
}
