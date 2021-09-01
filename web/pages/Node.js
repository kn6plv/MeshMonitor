const Page = require('./Page');
const DB = require('../../db');
const Rainbow = require('rainbowvis.js');
const NameService = require('../../nameService');

const TIME = 61 * 60;
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

  async select() {
    super.select();
    this.updates = {};

    const config = {
      id: `node_${++graphId}`,
      originator: this.getSortedNames()[0].address,
      start: Date.now() - TIME * 1000
    };

    const gen = async (from) => {
      const cache = graphUpdateCache[config.originator] || (graphUpdateCache[config.originator] = {});
      const to = Date.now();
      if (cache.from !== from || cache.cursor !== to) {
        cache.from = from;
        cache.cursor = to;
        cache.data = [];
        cache.color = [];
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
      if (op === 'update') {
        this.send(`chart.update.response.${config.id}`, await gen(msg.value.cursor));
      }
      else {
        config.originator = msg.value.address;
        config.start = Date.now() - TIME * 1000;
        this.html('info', this.template.Node(Object.assign({ id: config.id, selected: config.originator, nodes: this.getSortedNames(), step: STEP }, await gen(config.start))));
      }
    }
    this.html('info', this.template.Node(Object.assign({ id: config.id, selected: config.originator, nodes: this.getSortedNames(), step: STEP }, await gen(config.start))));
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

  getSortedNames() {
    return Object.values(NameService.getAllOriginators())
      .sort((a, b) => a.name.localeCompare(b.name, { sensitivity: 'base' }));
  }

}

module.exports = Node;
