#! /usr/bin/env node

const Log = require('debug')('main');
const OLSR = require('./olsrlib');
const DB = require('./db');

const dev = new OLSR();
dev.open();
dev.on('message', m => {
  Log(JSON.stringify(m, null, 2));
  DB.addMessage(m);
  const to = Date.now();
  const from = to - 10000;
  console.log(`valid ${DB.validCount(from, to)} invalid ${DB.invalidCount(from, to)} duplicate ${DB.duplicateCount(from, to)} outOfOrder ${DB.outOfOrderCount(from, to)} maxHops ${DB.maxHops(from, to)}`);
});
DB.setMessageTrim(10, 1);
