const Log = require('debug')('netmonitor');
const OLSR = require('./olsrlib');
const DB = require('./db');

const HOUR1 = 60 * 60 * 1000;

const TRIM_OFTEN = 60 * 60;
const TRIM_AGE = 60 * 60 * 24 * 7 + 2 * TRIM_OFTEN;

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
      valid: (await DB.validCount(from, to)).count,
      duplicate: (await DB.duplicateCount(from, to)).count,
      outOfOrder: (await DB.outOfOrderCount(from, to)).count,
      maxHop: (await DB.maxHopCount(from, to)).count,
      jitter: (await DB.maxJitterCount(from, to)).count
    };
    DB.addMessageHourlySummary(entry);
  }
  setTimeout(() => {
    setInterval(summary, HOUR1);
    summary();
  }, start);

})();
