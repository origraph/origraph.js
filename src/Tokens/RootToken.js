import BaseToken from './BaseToken.js';

class RootToken extends BaseToken {
  async * iterate () {
    yield this.wrap({
      wrappedParent: null,
      rawItem: this.stream.mure.root
    });
  }
  toString () {
    return `root`;
  }
}
export default RootToken;
