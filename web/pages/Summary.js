const Page = require('./Page');
const DB = require('../../db');

const MIN5_AXIS = [ '-5', '', '', '', '', '', '-4', '', '', '', '', '', '-3', '', '', '', '', '', '-2', '', '', '', '', '', '-1', '', '', '', '', '', 'Now' ];
const HOUR1_AXIS = [ '60', '', '50', '', '40', '', '30', '', '20', '', '10', '', 'Now' ];
const DAY1_AXIS = [ '-23', '', '', '', '', '-18', '', '', '', '', '', '-12', '', '', '', '', '-6', '', '', '', '', '', 'Now' ];

const graphUpdateCache = {};

class Summary extends Page {

  constructor(root) {
    super(root);
  }

  async select() {
    super.select();
    this.updates = {};
    const chart5min = [
      await this.generateChart({ id: 'valid_m', title: 'Valid', color: 'green', value: async (from, to) => await DB.validCount(from, to) / 10, step: 10, suggestedY: 200, labels: MIN5_AXIS, ticks: 6, units: { label: 'Seconds', scale: 10 } }),
      await this.generateChart({ id: 'duplicate_m', title: 'Duplicate', color: 'blue', value: async (from, to) => await DB.duplicateCount(from, to) / 10, step: 10, suggestedY: 200, labels: MIN5_AXIS, ticks: 6, units: { label: 'Seconds', scale: 10 } }),
      await this.generateChart({ id: 'outoforder_m', title: 'Out Of Order', color: 'salmon', value: async (from, to) => await DB.outOfOrderCount(from, to) / 10, step: 10, suggestedY: 200, labels: MIN5_AXIS, ticks: 6, units: { label: 'Seconds', scale: 10 } }),
      await this.generateChart({ id: 'maxhop_m', title: 'Max Hops', color: 'purple', value: async (from, to) => await DB.maxHopCount(from, to), step: 10, suggestedY: 30, labels: MIN5_AXIS, ticks: 6, units: { label: 'Seconds', scale: 10 } }),
    ];
    const chart1hour = [
      await this.generateChart({ id: 'valid_h', title: 'Valid', color: 'green', value: async (from, to) => await DB.validCount(from, to) / 300, step: 300, suggestedY: 200, labels: HOUR1_AXIS, ticks: 7, units: { label: 'Minutes', scale: 5 } }),
      await this.generateChart({ id: 'duplicate_h', title: 'Duplicate', color: 'blue', value: async (from, to) => await DB.duplicateCount(from, to) / 300, step: 300, suggestedY: 200, labels: HOUR1_AXIS, ticks: 7, units: { label: 'Minutes', scale: 5 } }),
      await this.generateChart({ id: 'outoforder_h', title: 'Out Of Order', color: 'salmon', value: async (from, to) => await DB.outOfOrderCount(from, to) / 300, step: 300, suggestedY: 200, labels: HOUR1_AXIS, ticks: 7, units: { label: 'Minutes', scale: 5 } }),
      await this.generateChart({ id: 'maxhop_h', title: 'Max Hops', color: 'purple', value: async (from, to) => await DB.maxHopCount(from, to), step: 300, suggestedY: 30, labels: HOUR1_AXIS, ticks: 7, units: { label: 'Minutes', scale: 5 } }),
    ];
    const chart1day = [
      await this.generateChart({ id: 'valid_d', title: 'Valid', color: 'green', value: async (_, to) => (await DB.messageSummary(to)).valid / 3600, step: 3600, suggestedY: 200, labels: DAY1_AXIS, ticks: 13, units: { label: 'Hours', scale: 1 } }),
      await this.generateChart({ id: 'duplicate_d', title: 'Duplicate', color: 'blue', value: async (_, to) => (await DB.messageSummary(to)).duplicate / 3600, step: 3600, suggestedY: 200, labels: DAY1_AXIS, ticks: 13, units: { label: 'Hours', scale: 1 } }),
      await this.generateChart({ id: 'outoforder_d', title: 'Out Of Order', color: 'salmon', value: async (_, to) => (await DB.messageSummary(to)).outOfOrder / 3600, step: 3600, suggestedY: 200, labels: DAY1_AXIS, ticks: 13, units: { label: 'Hours', scale: 1 } }),
      await this.generateChart({ id: 'maxhop_d', title: 'Max Hops', color: 'purple' ,value: async (_, to) => (await DB.messageSummary(to)).maxHop, step: 3600, suggestedY: 30, labels: DAY1_AXIS, ticks: 13, units: { label: 'Hours', scale: 1 } }),
    ];
    this.html('info', this.template.Summary({ chart5min, chart1hour, chart1day }));
  }

  async deselect() {
    super.deselect();
    this.updates = {};
  }

  async generateChart(config) {
    const step = config.step * 1000;
    const gen = async (from) => {
      const cache = graphUpdateCache[config.id] || (graphUpdateCache[config.id] = {});
      const to = step * Math.floor(Date.now() / step);
      if (cache.from !== from || cache.cursor !== to) {
        cache.from = from;
        cache.cursor = to;
        cache.data = [];
        for (; from < to; from += step) {
          cache.data.push(await config.value(from, from + step));
        }
      }
      return cache;
    }
    this.updates[config.id] = async (msg) => this.send(`chart.update.response.${config.id}`, await gen(msg.value.cursor));
    return Object.assign(config, await gen(step * (Math.floor(Date.now() / step) - config.labels.length)), { nrlabels: config.labels.length, labels: JSON.stringify(config.labels) });
  }

  async 'chart.update.request' (msg) {
    const fn = this.updates[msg.value.id];
    if (fn) {
      await fn(msg);
    }
  }

}

module.exports = Summary;
