const Page = require('./Page');
const DB = require('../../db');
const NameService = require('../../nameService');

class PerNode extends Page {

  constructor(root) {
    super(root);
  }

  async select() {
    super.select();
    this.updates = {};

    const step = 10 * 60;
    const to = Date.now();
    const from = to - step * 1000;
    const nodes = {};
    (await DB.getMessageGroup(from, to)).forEach(entry => {
      const node = nodes[entry.originator] || (nodes[entry.originator] = { originator: NameService.lookupNameByIP(entry.originator) || entry.originator, address: entry.originator, valid: 0, duplicate: 0, outOfOrder: 0, maxHop: 0, minHop: Number.MAX_SAFE_INTEGER });
      node.valid += entry.valid;
      node.duplicate += entry.duplicate;
      node.outOfOrder += entry.outOfOrder;
      node.maxHop = Math.max(node.maxHop, entry.maxHop);
      node.minHop = Math.min(node.minHop, entry.maxHop);
    });
    const sortedNodes = Object.values(nodes).sort((a, b) => a.originator.localeCompare(b.originator, { sensitivity: 'base' }));
    const datasets = [];
    [ 'valid', 'duplicate', 'outOfOrder' ].forEach(key => {
      const data = [];
      sortedNodes.forEach(node => data.push(node[key] / step));
      datasets.push({ label: key, data: data });
    });
    this.updates.nodes = (msg) => {
      const node = sortedNodes[msg.value.idx];
      if (node) {
        this.switchPage('node', { address: node.address });
      }
    }
    this.html('info', this.template.PerNode({ id: 'nodes', labels: sortedNodes.map(node => node.originator), datasets: datasets }));
  }

  async deselect() {
    super.deselect();
    this.updates = {};
  }

  async 'chart.node.select' (msg) {
    const fn = this.updates[msg.value.id];
    if (fn) {
      await fn(msg);
    }
  }

}

module.exports = PerNode;
