const Page = require('./Page');
const DB = require('../../db');
const Rainbow = require('rainbowvis.js');
const NameService = require('../../nameService');
const Moment = require('moment');

const HOUR1 = 60 * 60 * 1000;

const TIME = 61 * 60;
const SCRUB_RANGE = 1007;
const SCRUB_STEP = 10 * 60;
const DECIMATION = 500;

const graphUpdateCache = {};
let graphId = 1;

class Node extends Page {

  constructor(root) {
    super(root);
    this.gradient = new Rainbow();
    this.gradient.setNumberRange(0, 255);
    this.gradient.setSpectrum('green', 'orange', 'red');
  }

  async select(arg) {
    super.select();
    this.updates = {};

    const sortedNames = this.getSortedNames();
    const config = {
      id: `node_${++graphId}`,
      originator: sortedNames[0].address,
      start: Date.now() - TIME * 1000,
      duration: TIME * 1000
    };

    if (arg && arg.address) {
      config.originator = arg.address;
      const selected = sortedNames.find(name => name.address === arg.address);
      if (!selected) {
        sortedNames.unshift({
          originator: arg.address,
          address: arg.address,
          name: arg.address
        });
      }
      if (arg.timestamp) {
        config.start = HOUR1 * Math.floor(arg.timestamp / HOUR1) - HOUR1;
      }
      if (arg.duration) {
        config.duration = arg.duration * 1000;
      }
    }

    const gen = async (from, to) => {
      const cache = graphUpdateCache[config.originator] || (graphUpdateCache[config.originator] = {});
      if (cache.from !== from || cache.cursor !== to) {
        cache.from = from;
        cache.cursor = to;
        cache.data = [];
        cache.color = [];
        cache.date = Moment(from).format('MMMM Do');
        let last = 0;
        (await DB.getSequenceNrs(config.originator, from, to)).forEach((point, idx) => {
          if (point.timestamp >= last) {
            last = point.timestamp + config.duration / DECIMATION;
            cache.data.push({ x: point.timestamp, y: point.seqnr });
            cache.color.push(this.gradient.colorAt(point.maxHop));
          }
        });
      }
      return cache;
    }

    this.updates[config.id] = async (op, msg) => {
      switch (op) {
        case 'update':
          this.send(`chart.update.response.${config.id}`, Object.assign(
            { update: true, live: true },
            await gen(msg.value.cursor, Date.now())
          ));
          break;
        case 'position':
          const offset = SCRUB_RANGE - msg.value.position;
          config.start = Date.now() - (TIME + offset * SCRUB_STEP) * 1000;
          this.send(`chart.update.response.${config.id}`, Object.assign(
            { update: false, live: offset === 0 },
            await gen(config.start, config.start + config.duration)
          ));
          break;
        case 'change':
        default:
          config.originator = msg.value.address;
          const position = SCRUB_RANGE - ((Date.now() - config.start) / 1000 - TIME) / SCRUB_STEP;
          this.html('info', this.template.Node(Object.assign(
            { id: config.id, selected: config.originator, nodes: sortedNames, step: config.duration / DECIMATION, maxposition: SCRUB_RANGE, position: position, live: config.start + config.duration >= Date.now() },
            await gen(config.start, config.start + config.duration))
          ));
          break;
      }
    }

    const position = SCRUB_RANGE - ((Date.now() - config.start) / 1000 - TIME) / SCRUB_STEP;
    this.html('info', this.template.Node(Object.assign(
      { id: config.id, selected: config.originator, nodes: sortedNames, step: config.duration / DECIMATION, maxposition: SCRUB_RANGE, position: position, live: config.start + config.duration >= Date.now() },
      await gen(config.start, config.start + config.duration))
    ));
  }

  async deselect() {
    super.deselect();
    this.update = {};
  }

  async 'chart.update.request' (msg) {
    const fn = this.updates[msg.value.id];
    if (fn) {
      await fn('update', msg);
    }
  }

  async 'chart.change' (msg) {
    const fn = this.updates[msg.value.id];
    if (fn) {
      await fn('change', msg);
    }
  }

  async 'chart.position.change' (msg) {
    const fn = this.updates[msg.value.id];
    if (fn) {
      await fn('position', msg);
    }
  }

  getSortedNames() {
    return Object.values(NameService.getAllOriginators())
      .sort((a, b) => a.name.localeCompare(b.name, { sensitivity: 'base' }));
  }

}

module.exports = Node;
