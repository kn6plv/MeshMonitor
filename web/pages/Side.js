const Page = require('./Page');
const Health = require('../../health');

class Side extends Page {

  async select() {
    super.select();

    // Monitor health
    Health.on('update', () => {
      this.html('health', this.template.Health({ health: Health.getHealth() }));
    });

    this.html('health', this.template.Health({ health: Health.getHealth() }));
  }

}

module.exports = Side;
