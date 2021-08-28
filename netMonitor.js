const Log = require('debug')('netmonitor');
const OLSR = require('./olsrlib');
const DB = require('./db');

const TRIM_OFTEN = 5 * 60;
const TRIM_AGE = 60 * 60 * 24 + 2 * TRIM_OFTEN;

(async () => {
  await DB.open();
  DB.setMessageTrim(TRIM_AGE, TRIM_OFTEN);
  const dev = new OLSR();
  dev.on('message', m => {
    Log(JSON.stringify(m, null, 2));
    DB.addMessage(m);
  });
  dev.open();
})();
