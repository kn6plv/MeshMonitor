const Page = require('./Page');
const Health = require('../../health');

class Side extends Page {

  async select() {
    super.select();

    this._healthUpdate = () => this.html('health', this.template.Health({ health: Health.getHealth() }));

    // Monitor health
    Health.on('update', this._healthUpdate);

    this._healthUpdate();
  }

  async deselect() {
    Health.off('update', this._healthUpdate);
  }

}

module.exports = Side;
