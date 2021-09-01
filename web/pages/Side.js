const Page = require('./Page');

class Side extends Page {

  constructor(root) {
    super(root);
  }

  async select() {
    super.select();
  }

  async deselect() {
    super.deselect();
  }

}

module.exports = Side;
