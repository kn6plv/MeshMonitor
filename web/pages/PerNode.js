const Page = require('./Page');
const DB = require('../../db');

const graphUpdateCache = {};

class PerNode extends Page {

  constructor(root) {
    super(root);
  }

  async select() {
    super.select();
    this.updates = {};
    this.html('info', this.template.PerNode());
  }

  async deselect() {
    super.deselect();
    this.updates = {};
  }

  async generateChart(config) {
  }

  async 'chart.update.request' (msg) {
    const fn = this.updates[msg.value.id];
    if (fn) {
      await fn(msg);
    }
  }

}

module.exports = PerNode;
