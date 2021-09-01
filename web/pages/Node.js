const Page = require('./Page');
const DB = require('../../db');
const Rainbow = require('rainbowvis.js');
const NameService = require('../../nameService');
const Moment = require('moment');

const TIME = 61 * 60;
const SCRUB_RANGE = 1007;
const SCRUB_STEP = 10 * 60;
const STEP = 10;

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
      start: Date.now() - TIME * 1000
    };

    if (arg && arg.address) {
      const selected = sortedNames.find(name => name.address === arg.address);
      if (selected) {
        config.originator = selected.address;
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
            last = point.timestamp + STEP * 1000;
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
            await gen(config.start, config.start + TIME * 1000)
          ));
          break;
        case 'change':
        default:
          config.originator = msg.value.address;
          config.start = Date.now() - TIME * 1000;
          this.html('info', this.template.Node(Object.assign(
            { id: config.id, selected: config.originator, nodes: this.getSortedNames(), step: STEP },
            await gen(config.start, Date.now()))
          ));
          break;
      }
    }
    this.html('info', this.template.Node(Object.assign(
      { id: config.id, selected: config.originator, nodes: this.getSortedNames(), step: STEP },
      await gen(config.start, Date.now()))
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
