#! /usr/bin/env node

try {
  global.Config = require('./config');
}
catch (_) {
  console.error('Missing config.js!');
  process.exit(1);
}

const options = {};
if (Config.OLSR.Address) {
  options.address = Config.OLSR.Address;
}
if (Config.OLSR.Source) {
  options.source = Config.OLSR.Source;
}
require('./olsrlib').getInstance(options);
require('./netMonitor');
require('./nameService');
require('./web/server');
require('./health');
