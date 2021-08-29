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
    const chart5min = [
      await this.generateChart({ id: 'valid_m', title: 'Valid', color: 'green', key: 'validCount', step: 10, scale: 10, adjustY: 200, labels: MIN5_AXIS, ticks: 6, units: { label: 'Seconds', scale: 10 } }),
      await this.generateChart({ id: 'duplicate_m', title: 'Duplicate', color: 'blue', key: 'duplicateCount', step: 10, scale: 10, adjustY: 200, labels: MIN5_AXIS, ticks: 6, units: { label: 'Seconds', scale: 10 } }),
      await this.generateChart({ id: 'outoforder_m', title: 'Out Of Order', color: 'salmon', key: 'outOfOrderCount', step: 10, scale: 10, adjustY: 200, labels: MIN5_AXIS, ticks: 6, units: { label: 'Seconds', scale: 10 } }),
      await this.generateChart({ id: 'maxhop_m', title: 'Max Hops', color: 'purple', key: 'maxHopCount', step: 10, scale: 1, adjustY: 30, labels: MIN5_AXIS, ticks: 6, units: { label: 'Seconds', scale: 10 } }),
    ];
    const chart1hour = [
      await this.generateChart({ id: 'valid_h', title: 'Valid', color: 'green', key: 'validCount', step: 300, scale: 300, adjustY: 200, labels: HOUR1_AXIS, ticks: 7, units: { label: 'Minutes', scale: 5 } }),
      await this.generateChart({ id: 'duplicate_h', title: 'Duplicate', color: 'blue', key: 'duplicateCount', step: 300, scale: 300, adjustY: 200, labels: HOUR1_AXIS, ticks: 7, units: { label: 'Minutes', scale: 5 } }),
      await this.generateChart({ id: 'outoforder_h', title: 'Out Of Order', color: 'salmon', key: 'outOfOrderCount', step: 300, scale: 300, adjustY: 200, labels: HOUR1_AXIS, ticks: 7, units: { label: 'Minutes', scale: 5 } }),
      await this.generateChart({ id: 'maxhop_h', title: 'Max Hops', color: 'purple', key: 'maxHopCount', step: 300, scale: 1, adjustY: 30, labels: HOUR1_AXIS, ticks: 7, units: { label: 'Minutes', scale: 5 } }),
    ];
    const chart1day = [
      await this.generateChart2({ id: 'valid_d', title: 'Valid', color: 'green', key: 'valid', step: 3600, scale: 3600, adjustY: 200, labels: DAY1_AXIS, ticks: 13, units: { label: 'Hours', scale: 1 } }),
      await this.generateChart2({ id: 'duplicate_d', title: 'Duplicate', color: 'blue', key: 'duplicate', step: 3600, scale: 3600, adjustY: 200, labels: DAY1_AXIS, ticks: 13, units: { label: 'Hours', scale: 1 } }),
      await this.generateChart2({ id: 'outoforder_d', title: 'Out Of Order', color: 'salmon', key: 'outOfOrder', step: 3600, scale: 3600, adjustY: 200, labels: DAY1_AXIS, ticks: 13, units: { label: 'Hours', scale: 1 } }),
      await this.generateChart2({ id: 'maxhop_d', title: 'Max Hops', color: 'purple', key: 'maxHop', step: 3600, scale: 1, adjustY: 30, labels: DAY1_AXIS, ticks: 13, units: { label: 'Hours', scale: 1 } }),
    ];
    this.html('info', this.template.Summary({ chart5min, chart1hour, chart1day }));
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
    const cache = {};
    this.updates[config.id] = async (msg) => {
      const to = step * Math.floor(Date.now() / step);
      let from = step * Math.floor(msg.value.last / step);
      if (cache.from !== from || cache.to !== to) {
        cache.from = from;
        cache.to = to;
        cache.data = [];
        for (; from < to; from += step) {
          cache.data.push(Math.round(await DB[config.key](from, from + step) / config.scale));
        }
      }
      this.send(`chart.update.response.${config.id}`, { data: cache.data });
    }
    return Object.assign(config, { data: data, nrlabels: config.labels.length, labels: JSON.stringify(config.labels) });
  }

  async generateChart2(config) {
    const data = [];
    const step = config.step * 1000;
    const to = step * Math.floor(Date.now() / step);
    let from = to - config.labels.length * step;
    for (; from < to; from += step) {
      data.push(Math.round((await DB.messageSummary(from + step))[config.key] / config.scale));
    }
    this.updates[config.id] = async (msg) => {
      const to = step * Math.floor(Date.now() / step);
      let from = step * Math.floor(msg.value.last / step);
      if (cache.from !== from || cache.to !== to) {
        cache.from = from;
        cache.to = to;
        cache.data = [];
        for (; from < to; from += step) {
          cache.data.push(Math.round((await DB.messageSummary(from + step))[config.key] / config.scale));
        }
      }
      this.send(`chart.update.response.${config.id}`, { data: cache.data });
    }
    return Object.assign(config, { data: data, nrlabels: config.labels.length, labels: JSON.stringify(config.labels) });
  }

  async 'chart.update.request' (msg) {
    const fn = this.updates[msg.value.id];
    if (fn) {
      await fn(msg);
    }
  }

}

module.exports = Summary;
