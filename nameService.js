const OLSR = require('./olsrlib');

const names = {};

const dev = OLSR.getInstance();
dev.on('message', async m => {
  switch (m.type) {
    case 'NS':
      m.names.forEach(name => {
        if (name.address) {
          names[name.address] = {
            originator: m.originator,
            address: name.address,
            name: name.name
          };
        }
      });
      break;
    default:
      break;
  }
});

module.exports = {
  lookupNameByIP(address) {
    const entry = names[address];
    if (entry && entry.name) {
      return entry.name;
    }
    return null;
  },

  getAllOriginators() {
    const all = {};
    for (let address in names) {
      if (names[address].originator === address) {
        all[address] = names[address];
      }
    }
    return all;
  }
};
