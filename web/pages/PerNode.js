const Page = require('./Page');
const DB = require('../../db');
const Moment = require('moment');
const NameService = require('../../nameService');

const DISPLAY_DURATION = 30 * 60 * 1000; // 30 minutes
const SCRUB_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const SCRUB_STEP = 10 * 60 * 1000; // 10 minutes

const SAMPLES = 500;

class PerNode extends Page {

  async select(arg) {
    super.select();

    let sortedNodes = [];
    let lastFrom;
    const gen = async (from, to) => {
      lastFrom = from;
      const nodes = {};
      const known = NameService.getAllOriginators();
      for (let originator in known) {
        nodes[originator] = { originator: known[originator].name, address: originator, valid: 0, duplicate: 0, outOfOrder: 0, maxHop: 0, minHop: Number.MAX_SAFE_INTEGER };
      }
      const results = await DB.getMessageGroup(from, to, SAMPLES);
      results.samples.forEach(entry => {
        const node = nodes[entry.originator] || (nodes[entry.originator] = { originator: NameService.lookupNameByIP(entry.originator) || entry.originator, address: entry.originator, valid: 0, duplicate: 0, outOfOrder: 0, maxHop: 0, minHop: Number.MAX_SAFE_INTEGER });
        node.valid += entry.valid * results.decimation;
        node.duplicate += entry.duplicate * results.decimation;
        node.outOfOrder += entry.outOfOrder * results.decimation;
      });
      sortedNodes = Object.values(nodes).sort((a, b) => a.originator.localeCompare(b.originator, { sensitivity: 'base' }));
      const datasets = [];
      [ [ 'valid', 'Valid' ], [ 'duplicate', 'Duplicate' ], [ 'outOfOrder', 'Out Of Order' ] ].forEach(keys => {
        const data = [];
        sortedNodes.forEach(node => data.push(node[keys[0]] / SCRUB_STEP * 1000));
        datasets.push({ label: keys[1], data: data });
      });
      return { datasets: datasets, labels: sortedNodes.map(node => node.originator), timestamp: to, date: Moment(to).format('MMMM Do, LT') };
    }

    this.update = async (timestamp) => {
      const to = this.roundTime(timestamp);
      const position = SCRUB_DURATION / SCRUB_STEP - Math.floor((Date.now() - to) / SCRUB_STEP);
      this.send('chart.position.update', Object.assign(
        { live: position >= SCRUB_DURATION / SCRUB_STEP, position: position, scrubDuration: SCRUB_DURATION, scrubStep: SCRUB_STEP },
        await gen(to - DISPLAY_DURATION, to)
      ));
    }

    const to = this.roundTime(arg && arg.timestamp);
    const position = SCRUB_DURATION / SCRUB_STEP - Math.floor((Date.now() - to) / SCRUB_STEP);
    this.html('info', this.template.PerNode(Object.assign(
      { live: position >= SCRUB_DURATION / SCRUB_STEP, position: position, scrubDuration: SCRUB_DURATION, scrubStep: SCRUB_STEP },
      await gen(to - DISPLAY_DURATION, to)
    )));
  }

  async deselect() {
    super.deselect();
    this.update = null;
  }

  async reselect(arg) {
    const fn = this.update;
    if (fn) {
      await fn(arg.timestamp);
    }
  }

  async 'chart.update.request' (msg) {
    const fn = this.update;
    if (fn) {
      await fn(undefined);
    }
  }

  roundTime(time) {
    if (!time) {
      return Date.now();
    }
    else if (Date.now() - time < SCRUB_STEP) {
      return time;
    }
    else {
      return SCRUB_STEP * Math.floor(time / SCRUB_STEP);
    }
  }

}

module.exports = PerNode;
