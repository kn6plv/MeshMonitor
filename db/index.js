const SQLite3 = require('sqlite3');
const SQLite = require('sqlite');
const FS = require('fs');
const Log = require('debug')('db');

const DB_FILENAME = Config.DB.Filename || 'state/olsr.db';

const Database = {

  _messageTrim: {
    age: 0,
    often: 0,
    last: Number.MAX_SAFE_INTEGER
  },

  async open() {
    FS.mkdirSync('state', { recursive: true });
    this.db = await SQLite.open({
      filename: DB_FILENAME,
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

    await this.db.exec('CREATE TABLE IF NOT EXISTS message (timestamp INTEGER, pktseqnr INTEGER, originator TEXT, valid INTEGER, duplicate INTEGER, outOfOrder INTEGER, maxHop INTEGER, jitter INTEGER, ttl INTEGER, seqnr INTEGER, type TEXT, json TEXT)');
    await this.db.exec('CREATE TABLE IF NOT EXISTS messageSummary (timestamp INTEGER, valid INTEGER, duplicate INTEGER, outOfOrder INTEGER, maxHop INTEGER, jitter INTEGER, originator TEXT)');
    await this.db.exec('CREATE TABLE IF NOT EXISTS messageHourlySummary (timestamp INTEGER, valid INTEGER, duplicate INTEGER, outOfOrder INTEGER, maxHop INTEGER, jitter INTEGER)');

    await this.db.exec('CREATE INDEX IF NOT EXISTS messageTimestamp ON message (timestamp)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS messageSummaryTimestamp ON messageSummary (timestamp)');
    await this.db.exec('CREATE INDEX IF NOT EXISTS messageHourlySummaryTimestamp ON messageHourlySummary (timestamp)');
  },

  async addMessage(message) {
    const [ m, s ] = await Promise.all([
      this.db.run('INSERT INTO message (timestamp, pktseqnr, originator, valid, duplicate, outOfOrder, maxHop, jitter, ttl, seqnr, type, json) VALUES(:timestamp, :pktseqnr, :originator, :valid, :duplicate, :outOfOrder, :maxHop, :jitter, :ttl, :seqnr, :type, :json)',
        {
          ':timestamp': message.timestamp,
          ':pktseqnr': message.pktseqnr,
          ':originator': message.originator,
          ':valid': message.valid,
          ':duplicate': message.duplicate,
          ':outOfOrder': message.outOfOrder,
          ':maxHop': message.maxHop,
          ':jitter': message.jitter,
          ':ttl': message.ttl,
          ':seqnr': message.seqnr,
          ':type': message.type,
          ':json': JSON.stringify(message)
        }
      ),
      this.db.run('INSERT INTO messageSummary (timestamp, valid, duplicate, outOfOrder, maxHop, jitter, originator) VALUES (:timestamp, :valid, :duplicate, :outOfOrder, :maxHop, :jitter, :originator)',
        {
          ':timestamp': message.timestamp,
          ':valid': message.valid,
          ':duplicate': message.duplicate,
          ':outOfOrder': message.outOfOrder,
          ':maxHop': message.maxHop,
          ':jitter': message.jitter,
          ':originator': message.originator
        }
      )
    ]);

    // Trim messages periodically
    const now = Date.now();
    if (now > this._messageTrim.last) {
      this._messageTrim.last = now + this._messageTrim.often;
      const when = { ':when': now - this._messageTrim.age }
      await Promise.all([
        this.db.exec('DELETE FROM message WHERE timestamp < :timestamp', when),
        this.db.exec('DELETE FROM messageSummary WHERE timestamp < :timestamp', when),
        this.db.exec('DELETE FROM messageHourlySummary WHERE timestamp < :timestamp', when)
      ]);
    }
  },

  async addMessageHourlySummary(summary) {
    this.db.run('INSERT INTO messageHourlySummary (timestamp, valid, duplicate, outOfOrder, maxHop, jitter) VALUES (?, ?, ?, ?, ?, ?)',
      summary.timestamp,
      summary.valid,
      summary.duplicate,
      summary.outOfOrder,
      summary.maxHop,
      summary.jitter
    );
  },

  setMessageTrim(age, often) {
    this._messageTrim.age = age * 1000;
    this._messageTrim.often = often * 1000;
    this._messageTrim.last = 0;
  },

  async totalCount(from, to) {
    return {
      count: (await this.db.get('SELECT COUNT(*) FROM messageSummary WHERE timestamp BETWEEN ? AND ?', from, to))['COUNT(*)']
    };
  },

  async validCount(from, to) {
    return {
      count: (await this.db.get('SELECT COUNT(*) FROM messageSummary WHERE valid = 1 AND timestamp BETWEEN ? AND ?', from, to))['COUNT(*)']
    };
  },

  async duplicateCount(from, to) {
    return {
      count: (await this.db.get('SELECT COUNT(*) FROM messageSummary WHERE duplicate = 1 AND timestamp BETWEEN ? AND ?', from, to))['COUNT(*)']
    };
  },

  async outOfOrderCount(from, to) {
    return {
      count: (await this.db.get('SELECT COUNT(*) FROM messageSummary WHERE outOfOrder = 1 AND timestamp BETWEEN ? AND ?', from, to))['COUNT(*)']
    };
  },

  async maxHopCount(from, to) {
    const maxHop = (await this.db.get('SELECT MAX(maxHop) FROM messageSummary WHERE valid = 1 AND timestamp BETWEEN ? AND ?', from, to))['MAX(maxHop)'];
    const originator = typeof maxHop === 'number' ? (await this.db.get('SELECT originator FROM messageSummary WHERE valid = 1 AND timestamp BETWEEN ? AND ? AND maxHop >= ? LIMIT 1', from, to, maxHop)).originator : null;
    return {
      count: maxHop,
      originator: originator
    };
  },

  async maxJitterCount(from, to) {
    const maxJitter = (await this.db.get('SELECT MAX(ABS(jitter)) FROM messageSummary WHERE valid = 1 AND timestamp BETWEEN ? AND ?', from, to))['MAX(ABS(jitter))'];
    const originator = typeof maxJitter === 'number' ? (await this.db.get('SELECT originator FROM messageSummary WHERE valid = 1 AND timestamp BETWEEN ? AND ? AND ABS(jitter) = ? LIMIT 1', from, to, maxJitter)).originator : null;
    return {
      count: maxJitter,
      originator: originator
    };
  },

  async messageSummary(to) {
    return (await this.db.get('SELECT * FROM messageHourlySummary WHERE timestamp = ?', to)) || {};
  },

  async messageDailySummary(to) {
    const from = to - 24 * 60 * 60 * 1000;
    const all = await this.db.all('SELECT * FROM messageHourlySummary WHERE timestamp BETWEEN ? AND ?', from, to);
    return {
      timestamp: to,
      valid: all.reduce((a, v) => a + v.valid, 0),
      duplicate: all.reduce((a, v) => a + v.duplicate, 0),
      outOfOrder: all.reduce((a, v) => a + v.outOfOrder, 0),
      maxHop: all.reduce((a, v) => Math.max(a, v.maxHop), 0),
      jitter: all.reduce((a, v) => Math.max(a, v.jitter), 0)
    };
  },

  async getMessageGroup(from, to, samples) {
    const count = 8 * (await this.db.get('SELECT COUNT(*) FROM messageSummary WHERE timestamp BETWEEN ? AND ? AND ROWID % 8 = 0', from, to))['COUNT(*)'];
    const decimation = Math.min(10, Math.ceil(count / samples));
    return {
      decimation: decimation,
      samples: await this.db.all('SELECT originator, valid, duplicate, outOfOrder FROM messageSummary WHERE timestamp BETWEEN ? AND ? AND ROWID % ? = 0', from, to, decimation)
    };
  },

  async getSequenceNrs(originator, from, to, samples) {
    const count = 8 * (await this.db.get('SELECT COUNT(*) FROM message WHERE originator = ? AND timestamp BETWEEN ? AND ? AND ROWID % 8 = 0', originator, from, to))['COUNT(*)'];
    const decimation = Math.min(10, Math.ceil(count / samples));
    return {
      decimation: decimation,
      samples: await this.db.all('SELECT originator, timestamp, seqnr, maxHop FROM message WHERE originator = ? AND timestamp BETWEEN ? AND ? AND timestamp % ? = 0', originator, from, to, decimation)
    };
  }
};


module.exports = Database;
