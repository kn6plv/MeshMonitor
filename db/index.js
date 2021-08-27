const DB = require('better-sqlite3');
const Log = require('debug')('db');

const db = new DB('state/olsr.db', {
  verbose: Log.enabled ? Log : null
});

db.prepare('CREATE TABLE IF NOT EXISTS messages (timestamp INTEGER, valid INTEGER, duplicate INTEGER, outOfOrder INTEGER, hops INTEGER, originator TEXT, json TEXT)').run();
db.pragma('auto_vacuum = 1');
db.pragma('cache_size = 20000');

const Database = {

  _addMessage:    db.prepare('INSERT INTO messages (timestamp, valid, duplicate, outOfOrder, hops, originator, json) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  _trimMessages:  db.prepare('DELETE FROM messages WHERE timestamp < ?'),
  _total:         db.prepare('SELECT COUNT(*) FROM messages WHERE timestamp >= ? AND timestamp <= ?').pluck(),
  _valid:         db.prepare('SELECT COUNT(*) FROM messages WHERE valid = 1 AND timestamp >= ? AND timestamp <= ?').pluck(),
  _invalid:       db.prepare('SELECT COUNT(*) FROM messages WHERE valid = 0 AND duplicate = 0 AND timestamp >= ? AND timestamp <= ?').pluck(),
  _duplicate:     db.prepare('SELECT COUNT(*) FROM messages WHERE duplicate = 1 AND timestamp >= ? AND timestamp <= ?').pluck(),
  _outOfOrder:    db.prepare('SELECT COUNT(*) FROM messages WHERE outOfOrder = 1 AND timestamp >= ? AND timestamp <= ?').pluck(),
  _maxHops:       db.prepare('SELECT MAX(hops) FROM messages WHERE valid = 1 AND timestamp >= ? AND timestamp <= ?').pluck(),

  addMessage(message) {
    this._addMessage.run(
      message.timestamp,
      message.valid ? 1 : 0,
      message.duplicate ? 1 : 0,
      message.outOfOrder ? 1 : 0,
      message.hops,
      message.originator,
      JSON.stringify(message)
    );
  },

  setMessageTrim(ageSecs, oftenSecs) {
    if (this._messageTrimTimer) {
      clearInterval(this._messageTrimTimer);
    }
    this._messageTrimTimer = setInterval(() => this._trimMessages.run(Date.now() - ageSecs * 1000), oftenSecs * 1000);
    this._trimMessages.run(Date.now() - ageSecs * 1000);
  },

  totalCount(from, to) {
    return this._total.get(from, to);
  },

  validCount(from, to) {
    return this._valid.get(from, to);
  },

  invalidCount(from, to) {
    return this._invalid.get(from, to);
  },

  duplicateCount(from, to) {
    return this._duplicate.get(from, to);
  },

  outOfOrderCount(from, to) {
    return this._outOfOrder.get(from, to);
  },

  maxHops(from, to) {
    return this._maxHops.get(from, to);
  }

};


module.exports = Database;
