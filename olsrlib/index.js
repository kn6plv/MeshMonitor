const Dgram = require('dgram');
const Emitter = require('events');
const Log = require('debug')('olsr');
const LogHELLO = Log.extend('hello');
const LogTC = Log.extend('tc');
const LogMID = Log.extend('mid');
const LogNS = Log.extend('ns');
const LogHNA = Log.extend('hna');

const DEFAULT_PORT = 698;
const MSG_NAMES = {
  1: 'HELLO', 2: 'TC', 3: 'MID', 4: 'HNA',
  130: 'NS',
  201: 'LQ_HELLO', 202: 'LQ_TC'
};
const LINK_TYPE = [ 'UNSPEC', 'ASYM', 'SYM', 'LOST' ];
const NEIGHBOR_TYPE = [ 'SYM', 'MPR', 'NOT', '<3>' ];
const NAME_TYPES = [ 'HOST', 'FORWARDER', 'SERVICE', 'LATLON', 'MACADDR' ];
const STATE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const JITTER_TIMEOUT = 5 * 60 * 1000; // 5 minutes

class OLSR extends Emitter {

  constructor(config) {
    super();
    this.config = config;
    this.originators = {};
  }

  open() {
    const options = {
      port: this.config.port || DEFAULT_PORT
    };
    if (this.config.address) {
      options.address = this.config.address;
    }
    this.udp = Dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.udp.bind(options);
    this.udp.on('message', (msg, rinfo) => this.incomingMessage(msg, rinfo));
  }

  incomingMessage(msg, rinfo) {
    if (this.config.source && this.config.source !== rinfo.address) {
      return;
    }
    const len = msg.readUInt16BE(0);
    const pktseqnr = msg.readUInt16BE(2);

    if (len != msg.length) {
      Log('Bad message length: specified:', len, 'actual:', msg.length);
      return;
    }

    let msgsize = 0;
    for (let offset = 4; offset < len; offset += msgsize) {
      const msgtype = msg.readUInt8(offset + 0);
      const vtime = msg.readUInt8(offset + 1);
      msgsize = msg.readUInt16BE(offset + 2);
      const originator = this.toIPAddress(msg.slice(offset + 4, offset + 8));
      const ttl = msg.readUInt8(offset + 8);
      const hopcount = msg.readUInt8(offset + 9);
      const msgseqnr = msg.readUInt16BE(offset + 10);
      if (offset + msgsize > msg.length) {
        Log('Truncated:');
        continue;
      }
      const payload = msg.slice(offset + 12, offset + msgsize);

      const validityTimeSeconds = 0.0625 * (1 + (vtime >> 4) / 16) * Math.pow(2, vtime & 15);

      const message = Object.assign({
        timestamp: Date.now(),
        pktseqnr: pktseqnr,
        type: MSG_NAMES[msgtype] || `<${msgtype}>`,
        originator: originator,
        ttl: ttl,
        maxHop: hopcount,
        seqnr: msgseqnr,
        vtime: validityTimeSeconds
      }, this.isValidMsg(originator, ttl, msgseqnr, payload));

      switch (message.type) {
        case 'HELLO':
          this.incomingHello(message, payload);
          LogHELLO(JSON.stringify(message, null, 2));
          break;
        case 'TC':
          this.incomingTC(message, payload);
          LogTC(JSON.stringify(message, null, 2));
          break;
        case 'MID':
          this.incomingMID(message, payload);
          LogMID(JSON.stringify(message, null, 2));
          break;
        case 'HNA':
          this.incomingHNA(message, payload);
          LogHNA(JSON.stringify(message, null, 2));
          break;
        case 'NS':
          this.incomingNS(message, payload);
          LogNS(JSON.stringify(message, null, 2));
          break;
        case 'LQ_HELLO':
          this.incomingLQHello(message, payload);
          LogHELLO(JSON.stringify(message, null, 2));
          break;
        case 'LQ_TC':
          this.incomingLQTC(message, payload);
          LogTC(JSON.stringify(message, null, 2));
          break;
        default:
          message.payload = payload;
          break;
      }

      Log(JSON.stringify(message, null, 2));
      this.emit('message', message);
    }
  }

  incomingHello(message, payload) {
    const htime = payload.readUInt8(2);
    message.hello = {
      willingness: payload.readUInt8(3),
      emissionInterval: 0.0625 * (1 + (htime >> 4)) * Math.pow(2, htime & 15),
      links: []
    };
    let linksize = 0;
    for (let offset = 4; ; offset += linksize) {
      const linkcode = payload.readUInt8(offset) & 15;
      linksize = payload.readUInt16BE(offset + 2);
      if (offset + linksize > payload.length) {
        message.truncated = true;
      }
      const link = {
        linkType: LINK_TYPE[linkcode & 3],
        neighborType: NEIGHBOR_TYPE[linkcode >> 2],
        neighbors: []
      };
      for (let xoffset = 4; offset + xoffset + 4 <= payload.length; xoffset += 4) {
        link.neighbors.push(this.toIPAddress(payload.slice(offset + xoffset, offset + xoffset + 4)));
      }
      message.hello.links.push(link);
    }
  }

  incomingLQHello(message, payload) {
    const htime = payload.readUInt8(2);
    message.lqhello = {
      willingness: payload.readUInt8(3),
      emissionInterval: 0.0625 * (1 + (htime >> 4)) * Math.pow(2, htime & 15),
      links: []
    };
    let linksize = 0;
    for (let offset = 4; offset < payload.length; offset += linksize) {
      const linkcode = payload.readUInt8(offset) & 15;
      linksize = payload.readUInt16BE(offset + 2);
      if (offset + linksize > payload.length) {
        message.truncated = true;
      }
      const link = {
        linkType: LINK_TYPE[linkcode & 3],
        neighborType: NEIGHBOR_TYPE[linkcode >> 2],
        neighbors: []
      };
      for (let xoffset = 4; xoffset + 8 <= linksize; xoffset += 8) {
        const address = {
          address: this.toIPAddress(payload.slice(offset + xoffset, offset + xoffset + 4)),
          lq: Math.round(100 * payload.readUInt8(offset + xoffset + 6) / 255),
          nlq: Math.round(100 * payload.readUInt8(offset + xoffset + 7) / 255),
          ethernet: false
        };
        if (address.lq === 100) {
          address.ethernet = true;
        }
        link.neighbors.push(address);
      }
      message.lqhello.links.push(link);
    }
  }

  incomingTC(message, payload) {
    message.tc = {
      ansn: payload.readUInt16BE(0),
      neighbors: []
    };
    for (let offset = 4; offset + 4 <= payload.length; offset += 4) {
      message.tc.neighbors.push(this.toIPAddress(payload.slice(offset, offset + 4)));
    }
  }

  incomingLQTC(message, payload) {
    message.lqtc = {
      ansn: payload.readUInt16BE(0),
      neighbors: []
    };
    for (let offset = 4; offset + 8 <= payload.length; offset += 8) {
      const address = {
        address: this.toIPAddress(payload.slice(offset, offset + 4)),
        lq: Math.round(100 * payload.readUInt8(offset + 6) / 255),
        nlq: Math.round(100 * payload.readUInt8(offset + 7) / 255),
        ethernet: false
      };
      if (address.lq === 100) {
        address.ethernet = true;
      }
      message.lqtc.neighbors.push(address);
    }
  }

  incomingMID(message, payload) {
    message.mid = [];
    for (let offset = 0; offset + 4 <= payload.length; offset += 4) {
      message.mid.push(this.toIPAddress(payload.slice(offset, offset + 4)));
    }
  }

  incomingHNA(message, payload) {
    message.hna = [];
    for (let offset = 0; offset + 8 <= payload.length; offset += 8) {
      message.hna.push({
        address: this.toIPAddress(payload.slice(offset + 0, offset + 4)),
        netmask: this.toIPAddress(payload.slice(offset + 4, offset + 8)),
      });
    }
  }

  incomingNS(message, payload) {
    message.names = [];
    const nr = payload.readUInt16BE(2);
    let offset = 4;
    for (let i = 0; i < nr; i++) {
      const type = payload.readUInt16BE(offset);
      const nlen = payload.readUInt16BE(offset + 2);
      const name = {
        type: NAME_TYPES[type] || `<${type}>`,
        name: payload.slice(offset + 20, offset + 20 + nlen).toString('latin1')
      };
      if (name.type !== 'SERVICE') {
        name.address = this.toIPAddress(payload.slice(offset + 4, offset + 8));
      }
      message.names.push(name);
      offset += 20 + nlen + (4 - (nlen % 4)) % 4;
    }
  }

  toIPAddress(v) {
    return new Uint8Array(v).join('.');
  }

  isValidMsg(originator, ttl, seqnr, payload) {
    const valid = {
      valid: true,
      outOfOrder: false,
      zeroTtl: false,
      duplicate: false,
      jitter: 0
    };

    if (ttl === 0) {
      Log("Zero ttl:");
      valid.valid = false;
      valid.zeroTtl = true;
    }

    const now = Date.now();
    const originatorState = this.originators[originator] || (this.originators[originator] = { lastSeen: 0 });
    if (now - originatorState.lastSeen > STATE_TIMEOUT) {
      originatorState.seqnr = seqnr - 1;
      originatorState.messages = {};
    }

    const jitter = ((seqnr - originatorState.seqnr) << 16) >> 16;
    const oldPayload = originatorState.messages[seqnr];
    if (jitter <= 0) {
      if (!oldPayload || payload.compare(oldPayload) !== 0) {
        valid.outOfOrder = true;
      }
      else {
        valid.valid = false;
        valid.duplicate = true;
      }
    }
    valid.jitter = now - originatorState.lastSeen > JITTER_TIMEOUT ? 1 : jitter;

    originatorState.seqnr = seqnr;
    originatorState.messages[seqnr] = payload;
    originatorState.lastSeen = now;

    return valid;
  }

}

let instance = null;

module.exports = {
  getInstance(config) {
    if (!instance) {
      instance = new OLSR(config);
      instance.open();
    }
    return instance;
  }
};
