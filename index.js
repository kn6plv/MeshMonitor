#! /usr/bin/env node

try {
  global.Config = require('./config');
}
catch (_) {
  console.error('Missing config.js!');
  process.exit(1);
}

require('./netMonitor');
require('./nameService');
require('./web/server');
require('./health');
