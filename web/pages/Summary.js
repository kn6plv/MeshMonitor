const Page = require('./Page');
const DB = require('../../db');

const MIN5_AXIS = [ '-5', '', '', '', '', '', '-4', '', '', '', '', '', '-3', '', '', '', '', '', '-2', '', '', '', '', '', '-1', '', '', '', '', '', 'Now' ];
const HOUR1_AXIS = [ '60', '', '50', '', '40', '', '30', '', '20', '', '10', '', 'Now' ];
const DAY1_AXIS = [ '-23', '', '', '', '', '-18', '', '', '', '', '', '-12', '', '', '', '', '-6', '', '', '', '', '', 'Now' ];

class Summary extends Page {

  constructor(root) {
    super(root);
  }

  async select() {
    this.updates = {};
    this.html('info', this.template.Summary({
      chart5min: [
        await this.generateChart({ id: 'valid_m', title: 'Valid', color: 'green', key: 'validCount', step: 10, scale: 10, adjustY: 200, labels: MIN5_AXIS, ticks: 6 }),
        await this.generateChart({ id: 'duplicate_m', title: 'Duplicate', color: 'blue', key: 'duplicateCount', step: 10, scale: 10, adjustY: 200, labels: MIN5_AXIS, ticks: 6 }),
        await this.generateChart({ id: 'outoforder_m', title: 'Out Of Order', color: 'salmon', key: 'outOfOrderCount', step: 10, scale: 10, adjustY: 200, labels: MIN5_AXIS, ticks: 6 }),
        await this.generateChart({ id: 'maxhop_m', title: 'Max Hops', color: 'purple', key: 'maxHopCount', step: 10, scale: 1, adjustY: 30, labels: MIN5_AXIS, ticks: 6 }),
      ],
      chart1hour: [
        await this.generateChart({ id: 'valid_h', title: 'Valid', color: 'green', key: 'validCount', step: 300, scale: 300, adjustY: 200, labels: HOUR1_AXIS, ticks: 7 }),
        await this.generateChart({ id: 'duplicate_h', title: 'Duplicate', color: 'blue', key: 'duplicateCount', step: 300, scale: 300, adjustY: 200, labels: HOUR1_AXIS, ticks: 7 }),
        await this.generateChart({ id: 'outoforder_h', title: 'Out Of Order', color: 'salmon', key: 'outOfOrderCount', step: 300, scale: 300, adjustY: 200, labels: HOUR1_AXIS, ticks: 7 }),
        await this.generateChart({ id: 'maxhop_h', title: 'Max Hops', color: 'purple', key: 'maxHopCount', step: 300, scale: 1, adjustY: 30, labels: HOUR1_AXIS, ticks: 7 }),
      ],
      chart1day: [
        await this.generateChart({ id: 'valid_d', title: 'Valid', color: 'green', key: 'validCount', step: 3600, scale: 3600, adjustY: 200, labels: DAY1_AXIS, ticks: 13 }),
        await this.generateChart({ id: 'duplicate_d', title: 'Duplicate', color: 'blue', key: 'duplicateCount', step: 3600, scale: 3600, adjustY: 200, labels: DAY1_AXIS, ticks: 13 }),
        await this.generateChart({ id: 'outoforder_d', title: 'Out Of Order', color: 'salmon', key: 'outOfOrderCount', step: 3600, scale: 3600, adjustY: 200, labels: DAY1_AXIS, ticks: 13 }),
        await this.generateChart({ id: 'maxhop_d', title: 'Max Hops', color: 'purple', key: 'maxHopCount', step: 3600, scale: 1, adjustY: 30, labels: DAY1_AXIS, ticks: 13 }),
      ]
    }));
  }

  async deselect() {
    this.updates = {};
  }

  async generateChart(config) {
    const data = [];
    const step = config.step * 1000;
    const to = step * Math.floor(Date.now() / step);
    let from = to - config.labels.length * step;
    for (; from < to; from += step) {
      data.push(Math.round(await DB[config.key](from, from + step) / config.scale));
    }
    this.updates[config.id] = async () => {
      const to = step * Math.floor(Date.now() / step);
      const ndata = [ Math.round(await DB[config.key](to - step, to) / config.scale) ];
      this.send(`chart.update.response.${config.id}`, { data: ndata });
    }
    return Object.assign(config, { data: data, labels: JSON.stringify(config.labels) });
  }

  async 'chart.update.request' (msg) {
    const fn = this.updates[msg.value];
    if (fn) {
      await fn();
    }
  }

}

module.exports = Summary;
