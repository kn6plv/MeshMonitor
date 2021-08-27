#! /usr/bin/env node

const Log = require('debug')('main');
const OLSR = require('./olsrlib');
const DB = require('./db');

const dev = new OLSR();
dev.open();
dev.on('message', m => {
  Log(JSON.stringify(m, null, 2));
  DB.addMessage(m);
  console.log(`valid ${DB.validCount()} invalid ${DB.invalidCount()} duplicate ${DB.duplicateCount()} outOfOrder ${DB.outOfOrderCount()}`);
});
DB.setMessageTrim(10);
