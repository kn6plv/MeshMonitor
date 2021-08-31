const Log = require('debug')('netmonitor');
const OLSR = require('./olsrlib');
const DB = require('./db');

const HOUR1 = 60 * 60 * 1000;

const TRIM_OFTEN = 5 * 60;
const TRIM_AGE = 60 * 60 * 24 + 2 * TRIM_OFTEN;

(async () => {

  await DB.open();
  DB.setMessageTrim(TRIM_AGE, TRIM_OFTEN);

  const dev = OLSR.getInstance();
  dev.on('message', async m => {
    Log(JSON.stringify(m, null, 2));
    await DB.addMessage(m);
  });
  dev.open();

  // Create a summary every hour
  const start = HOUR1 - Date.now() % HOUR1;
  const summary = async () => {
    const to = HOUR1 * Math.floor(Date.now() / HOUR1);
    const from = to - HOUR1;
    const entry = {
      timestamp: to,
      valid: await DB.validCount(from, to),
      duplicate: await DB.duplicateCount(from, to),
      outOfOrder: await DB.outOfOrderCount(from, to),
      maxHop: await DB.maxHopCount(from, to)
    };
    DB.addMessageHourlySummary(entry);
  }
  setTimeout(() => {
    setInterval(summary, HOUR1);
    summary();
  }, start);

})();
