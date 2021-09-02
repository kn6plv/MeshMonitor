const Page = require('./Page');
const DB = require('../../db');
const Rainbow = require('rainbowvis.js');
const NameService = require('../../nameService');
const Moment = require('moment');

const DISPLAY_DURATION = 30 * 60 * 1000; // 30 minutes
const SCRUB_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const SCRUB_STEP = 10 * 60 * 1000; // 10 minutes
const SAMPLES = 500;

const graphUpdateCache = {};

class Node extends Page {

  constructor(root) {
    super(root);
    this.gradient = new Rainbow();
    this.gradient.setNumberRange(0, 255);
    this.gradient.setSpectrum('green', 'orange', 'red');
  }

  async select(arg) {
    super.select();

    const sortedNames = this.getSortedNames();
    const config = {
      originator: sortedNames[0].address,
      cursor: Date.now()
    };

    if (arg) {
      if (arg.name) {
        const selected = sortedNames.find(name => name.name === arg.name);
        if (selected) {
          config.originator = selected.address;
        }
        else {
          sortedNames.unshift({
            originator: arg.name,
            address: arg.name,
            name: arg.name
          });
          config.originator = arg.name;
        }
      }
      if (arg.timestamp) {
        config.cursor = this.roundTime(arg.timestamp);
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
        cache.position = SCRUB_DURATION / SCRUB_STEP - Math.floor((Date.now() - to) / SCRUB_STEP);
        cache.live = cache.position >= SCRUB_DURATION / SCRUB_STEP;
        let last = 0;
        (await DB.getSequenceNrs(config.originator, from, to, SAMPLES)).samples.forEach((point, idx) => {
          if (point.timestamp >= last) {
            last = point.timestamp + DISPLAY_DURATION / SAMPLES;
            cache.data.push({ x: point.timestamp, y: point.seqnr });
            cache.color.push(this.gradient.colorAt(point.maxHop));
          }
        });
      }
      return cache;
    }

    this.updates = async (op, msg) => {
      switch (op) {
        case 'update':
          this.send(`chart.update.response`, Object.assign(
            { update: true },
            await gen(msg.value.cursor, Date.now())
          ));
          break;
        case 'change':
          config.cursor = this.roundTime(msg.value.timestamp);
          const selected = sortedNames.find(name => name.name === msg.value.name);
          if (selected && config.originator !== selected.address) {
            config.originator = selected.address;
            this.html('info', this.template.Node(Object.assign(
              { selected: config.originator, nodes: sortedNames, step: DISPLAY_DURATION / SAMPLES / 1000, scrubDuration: SCRUB_DURATION, scrubStep: SCRUB_STEP },
              await gen(config.cursor - DISPLAY_DURATION, config.cursor))
            ));
          }
          else {
            this.send(`chart.update.response`, Object.assign(
              { update: false },
              await gen(config.cursor - DISPLAY_DURATION, config.cursor)
            ));
          }
          break;
        default:
          break;
      }
    }

    this.html('info', this.template.Node(Object.assign(
      { selected: config.originator, nodes: sortedNames, step: DISPLAY_DURATION / SAMPLES / 1000, scrubDuration: SCRUB_DURATION, scrubStep: SCRUB_STEP  },
      await gen(config.cursor - DISPLAY_DURATION, config.cursor))
    ));
  }

  async reselect(arg) {
    const fn = this.updates;
    if (fn) {
      await fn('change', { value: arg });
    }
  }

  async deselect() {
    super.deselect();
    this.updates = null;
  }

  async 'chart.update.request' (msg) {
    const fn = this.updates;
    if (fn) {
      await fn('update', msg);
    }
  }

  getSortedNames() {
    return Object.values(NameService.getAllOriginators())
      .sort((a, b) => a.name.localeCompare(b.name, { sensitivity: 'base' }));
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

module.exports = Node;
