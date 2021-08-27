const DB = require('better-sqlite3');
const Log = require('debug')('db');

const db = new DB('state/olsr.db', {
  verbose: Log.enabled ? Log : null
});

db.prepare('CREATE TABLE IF NOT EXISTS messages (timestamp INTEGER, valid INTEGER, duplicate INTEGER, outOfOrder INTEGER, originator TEXT, json TEXT)').run();

const Database = {

  _addMessage:    db.prepare('INSERT INTO messages (timestamp, valid, duplicate, outOfOrder, originator, json) VALUES (?, ?, ?, ?, ?, ?)'),
  _trimMessages:  db.prepare('DELETE FROM messages WHERE timestamp < ?'),
  _total:         db.prepare('SELECT COUNT(*) FROM messages'),
  _valid:         db.prepare('SELECT COUNT(*) FROM messages WHERE valid = 1'),
  _invalid:       db.prepare('SELECT COUNT(*) FROM messages WHERE valid = 0 AND duplicate = 0'),
  _duplicate:     db.prepare('SELECT COUNT(*) FROM messages WHERE duplicate = 1'),
  _outOfOrder:    db.prepare('SELECT COUNT(*) FROM messages WHERE outOfOrder = 1'),

  addMessage(message) {
    this._addMessage.run(
      message.timestamp,
      message.valid ? 1 : 0,
      message.duplicate ? 1 : 0,
      message.outOfOrder ? 1 : 0,
      message.originator,
      JSON.stringify(message)
    );
  },

  setMessageTrim(ageSeconds) {
    if (this._messageTrimTimer) {
      clearInterval(this._messageTrimTimer);
    }
    const age = ageSeconds * 1000;
    this._messageTrimTimer = setInterval(() => this._trimMessages.run(Date.now() - age), age);
    this._trimMessages.run(Date.now() - age);
  },

  totalCount() {
    return this._total.pluck().get();
  },

  validCount() {
    return this._valid.pluck().get();
  },

  invalidCount() {
    return this._invalid.pluck().get();
  },

  duplicateCount() {

    return this._duplicate.pluck().get();
  },

  outOfOrderCount() {
    return this._outOfOrder.pluck().get();
  }

};


module.exports = Database;
