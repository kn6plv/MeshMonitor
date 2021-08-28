const SQLite3 = require('sqlite3');
const SQLite = require('sqlite');
const Log = require('debug')('db');

const Database = {

  _messageTrim: {
    age: 0,
    often: 0,
    last: Number.MAX_SAFE_INTEGER
  },

  async open() {
    this.db = await SQLite.open({
      filename: 'state/olsr.db',
      driver: SQLite3.cached.Database
    });
    if (Log.enabled) {
      SQLite3.verbose();
      this.db.on('trace', data => Log(data));
    }
    await this.db.exec('PRAGMA auto_vacuum = FULL');
    await this.db.exec('PRAGMA cache_size = 20000');
    await this.db.exec('PRAGMA synchronous = OFF');
    await this.db.exec('PRAGMA journal_mode = MEMORY');

    await this.db.exec('CREATE TABLE IF NOT EXISTS message (timestamp INTEGER, json TEXT)');
    await this.db.exec('CREATE TABLE IF NOT EXISTS messageSummary (timestamp INTEGER, valid INTEGER, duplicate INTEGER, outOfOrder INTEGER, maxHop INTEGER, originator TEXT)');
    await this.db.exec('CREATE TABLE IF NOT EXISTS messageSummaryMessage(timestamp INTEGER, sid INTEGER UNIQUE, mid INTEGER UNIQUE)');
    await this.db.exec('CREATE TABLE IF NOT EXISTS messageHourlySummary (timestamp INTEGER, valid INTEGER, duplicate INTEGER, outOfOrder INTEGER, maxHop INTEGER)');

    await this.db.exec('CREATE INDEX IF NOT EXISTS messageTimestamp ON message (timestamp)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS messageSummaryTimestamp ON messageSummary (timestamp)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS messageHourlySummaryTimestamp ON messageHourlySummary (timestamp)');
  },

  async addMessage(message) {
    const [ m, s ] = await Promise.all([
      this.db.run('INSERT INTO message (timestamp, json) VALUES(:timestamp, :json)', { ':timestamp': message.timestamp, ':json': JSON.stringify(message) }),
      this.db.run('INSERT INTO messageSummary (timestamp, valid, duplicate, outOfOrder, maxHop, originator) VALUES (:timestamp, :valid, :duplicate, :outOfOrder, :maxHop, :originator)', { ':timestamp': message.timestamp, ':valid': message.valid, ':duplicate': message.duplicate, ':outOfOrder': message.outOfOrder, ':maxHop': message.maxHop, ':originator': message.originator })
    ]);
    await this.db.exec('INSERT INTO messageSummaryMessage (timestamp, sid, mid) VALUES (:timestamp, :sid, :mid)', { ':timestamp': message.timestamp, ':sid': s.lastID, ':mid': m.lastID });

    // Trim messages periodically
    const now = Date.now();
    if (now > this._messageTrim.last) {
      this._messageTrim.last = now + this._messageTrim.often;
      const when = { ':when': now - this._messageTrim.age }
      await Promise.all([
        this.db.exec('DELETE FROM messageSummary WHERE timestamp < :timestamp', when),
        this.db.exec('DELETE FROM messageSummary WHERE timestamp < :timestamp', when),
        this.db.exec('DELETE FROM messageSummaryMessage WHERE timestamp < :timestamp', when),
        this.db.exec('DELETE FROM messageHourlySummary WHERE timestamp < :timestamp', when)
      ]);
    }
  },

  async addMessageHourlySummary(summary) {
    this.db.run('INSERT INTO messageHourlySummary (timestamp, valid, duplicate, outOfOrder, maxHop) VALUES (?, ?, ?, ?, ?)',
      summary.timestamp,
      summary.valid,
      summary.duplicate,
      summary.outOfOrder,
      summary.maxHop
    );
  },

  setMessageTrim(age, often) {
    this._messageTrim.age = age * 1000;
    this._messageTrim.often = often * 1000;
    this._messageTrim.last = 0;
  },

  async totalCount(from, to) {
    return (await this.db.get('SELECT COUNT(*) FROM messageSummary WHERE timestamp >= ? AND timestamp <= ?', from, to))['COUNT(*)'];
  },

  async validCount(from, to) {
    return (await this.db.get('SELECT COUNT(*) FROM messageSummary WHERE valid = 1 AND timestamp >= ? AND timestamp <= ?', from, to))['COUNT(*)'];
  },

  async invalidCount(from, to) {
    return (await this.db.get('SELECT COUNT(*) FROM messageSummary WHERE valid = 0 AND duplicate = 0 AND timestamp >= ? AND timestamp <= ?', from, to))['COUNT(*)'];
  },

  async duplicateCount(from, to) {
    return (await this.db.get('SELECT COUNT(*) FROM messageSummary WHERE duplicate = 1 AND timestamp >= ? AND timestamp <= ?', from, to))['COUNT(*)'];
  },

  async outOfOrderCount(from, to) {
    return (await this.db.get('SELECT COUNT(*) FROM messageSummary WHERE outOfOrder = 1 AND timestamp >= ? AND timestamp <= ?', from, to))['COUNT(*)'];
  },

  async maxHopCount(from, to) {
    return (await this.db.get('SELECT MAX(maxHop) FROM messageSummary WHERE valid = 1 AND timestamp >= ? AND timestamp <= ?', from, to))['MAX(maxHop)'];
  },

  async messageSummary(from) {
    return (await this.db.get('SELECT * FROM messageHourlySummary WHERE timestamp = ?', from)) || {};
  }
};


module.exports = Database;
