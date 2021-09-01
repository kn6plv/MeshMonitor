const Page = require('./Page');
const DB = require('../../db');
const Moment = require('moment');
const NameService = require('../../nameService');

const SCRUB_RANGE = 1007;
const SCRUB_STEP = 10 * 60;
const STEP = 10 * 60;
const TIME = STEP;

class PerNode extends Page {

  constructor(root) {
    super(root);
  }

  async select() {
    super.select();
    this.updates = {};

    let sortedNodes = [];
    let lastFrom;
    const gen = async (from, to) => {
      lastFrom = from;
      const nodes = {};
      (await DB.getMessageGroup(from, to)).forEach(entry => {
        const node = nodes[entry.originator] || (nodes[entry.originator] = { originator: NameService.lookupNameByIP(entry.originator) || entry.originator, address: entry.originator, valid: 0, duplicate: 0, outOfOrder: 0, maxHop: 0, minHop: Number.MAX_SAFE_INTEGER });
        node.valid += entry.valid;
        node.duplicate += entry.duplicate;
        node.outOfOrder += entry.outOfOrder;
        node.maxHop = Math.max(node.maxHop, entry.maxHop);
        node.minHop = Math.min(node.minHop, entry.maxHop);
      });
      sortedNodes = Object.values(nodes).sort((a, b) => a.originator.localeCompare(b.originator, { sensitivity: 'base' }));
      const datasets = [];
      [ [ 'valid', 'Valid' ], [ 'duplicate', 'Duplicate' ], [ 'outOfOrder', 'Out Of Order' ] ].forEach(keys => {
        const data = [];
        sortedNodes.forEach(node => data.push(node[keys[0]] / STEP));
        datasets.push({ label: keys[1], data: data });
      });
      return { datasets: datasets, labels: sortedNodes.map(node => node.originator), date: Moment(from).format('MMMM Do, LT') };
    }

    this.updates.nodes = async (op, msg) => {
      switch (op) {
        case 'select':
          const node = sortedNodes[msg.value.idx];
          if (node) {
            this.switchPage('node', { address: node.address, timestamp: lastFrom, duration: 20 * 60 });
          }
          break;
        case 'position':
          const offset = SCRUB_RANGE - msg.value.position;
          const from = Date.now() - (TIME + offset * SCRUB_STEP) * 1000;
          this.send('chart.position.update.nodes', await gen(from, from + TIME * 1000));
          break;
        default:
          break;
      }
    }

    const to = Date.now();
    const from = to - STEP * 1000;
    this.html('info', this.template.PerNode(Object.assign(
      { id: 'nodes' },
      await gen(from, to)
    )));
  }

  async deselect() {
    super.deselect();
    this.updates = {};
  }

  async 'chart.node.select' (msg) {
    const fn = this.updates[msg.value.id];
    if (fn) {
      await fn('select', msg);
    }
  }

  async 'chart.position.change' (msg) {
    const fn = this.updates[msg.value.id];
    if (fn) {
      await fn('position', msg);
    }
  }

}

module.exports = PerNode;
