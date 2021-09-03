const Log = require('debug')('twilio');
const Twilio = require('twilio');

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

module.exports = {
  notify: notify
};
