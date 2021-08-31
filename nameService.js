const OLSR = require('./olsrlib');

const names = {};

const dev = OLSR.getInstance();
dev.on('message', async m => {
  if (m.type === 'NS') {
    m.names.forEach(name => {
      if (name.address) {
        names[name.address] = name.name;
      }
    });
  }
});

module.exports = {
  lookupNameByIP(ip) {
    return names[ip];
  }
};
