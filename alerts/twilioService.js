const Log = require('debug')('twilio');
const Twilio = require('twilio');

if (!Config.Twilio) {
  module.exports = {
    notify: () => {}
  };
  return;
}

const Client = Twilio(Config.Twilio.accountSid, Config.Twilio.authToken);
if (Log.enabled) {
  Client.logLevel = 'debug';
}

const notify = async (text) => {
  try {
    const to = Array.isArray(Config.Twilio.toPhoneNumber) ? Config.Twilio.toPhoneNumber : [ Config.Twilio.toPhoneNumber ];
    await Promise.all(to.map(toNumber => {
      return Client.messages.create({
        body: `${text} ${Config.General.Url}`,
        to: toNumber,
        from: Config.Twilio.fromPhoneNumber
      });
    }));
  }
  catch (e) {
    Log(e);
  }
}

module.exports = {
  notify: notify
};
