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
    await this.db.exec('CREATE TABLE IF NOT EXISTS messages (timestamp INTEGER, valid INTEGER, duplicate INTEGER, outOfOrder INTEGER, hops INTEGER, originator TEXT, json TEXT)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS messages_timestamp ON messages (timestamp)');
  },

  async addMessage(message) {
    this.db.run('INSERT INTO messages (timestamp, valid, duplicate, outOfOrder, hops, originator, json) VALUES (?, ?, ?, ?, ?, ?, ?)',
      message.timestamp,
      message.valid ? 1 : 0,
      message.duplicate ? 1 : 0,
      message.outOfOrder ? 1 : 0,
      message.hops,
      message.originator,
      JSON.stringify(message)
    );
    // Trim messages periodically
    const now = Date.now();
    if (now > this._messageTrim.last) {
      this._messageTrim.last = now + this._messageTrim.often;
      this.db.run('DELETE FROM messages WHERE timestamp < ?', now - this._messageTrim.age);
    }
  },

  setMessageTrim(age, often) {
    this._messageTrim.age = age * 1000;
    this._messageTrim.often = often * 1000;
    this._messageTrim.last = 0;
  },

  async totalCount(from, to) {
    return (await this.db.get('SELECT COUNT(*) FROM messages WHERE timestamp >= ? AND timestamp <= ?', from, to))['COUNT(*)'];
  },

  async validCount(from, to) {
    return (await this.db.get('SELECT COUNT(*) FROM messages WHERE valid = 1 AND timestamp >= ? AND timestamp <= ?', from, to))['COUNT(*)'];
  },

  async invalidCount(from, to) {
    return (await this.db.get('SELECT COUNT(*) FROM messages WHERE valid = 0 AND duplicate = 0 AND timestamp >= ? AND timestamp <= ?', from, to))['COUNT(*)'];
  },

  async duplicateCount(from, to) {
    return (await this.db.get('SELECT COUNT(*) FROM messages WHERE duplicate = 1 AND timestamp >= ? AND timestamp <= ?', from, to))['COUNT(*)'];
  },

  async outOfOrderCount(from, to) {
    return (await this.db.get('SELECT COUNT(*) FROM messages WHERE outOfOrder = 1 AND timestamp >= ? AND timestamp <= ?', from, to))['COUNT(*)'];
  },

  async maxHopCount(from, to) {
    return (await this.db.get('SELECT MAX(hops) FROM messages WHERE valid = 1 AND timestamp >= ? AND timestamp <= ?', from, to))['MAX(hops)'];
  }
};


module.exports = Database;
