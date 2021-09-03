#! /usr/bin/env node

try {
  global.Config = require('./config');
}
catch (_) {
  console.error('Missing config.js - using defaults');
  global.Config = {};
}

require('./netMonitor');
require('./nameService');
require('./web/server');
require('./health');
