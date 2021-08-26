#! /usr/bin/env node

const OLSR = require('./olsrlib');

const dev = new OLSR();
dev.open();
dev.on('message', m => m.type == 'NS' && console.log(JSON.stringify(m, null, 2)));
