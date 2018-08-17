import BaseToken from './BaseToken.js';

class RootToken extends BaseToken {
  * iterate () {
    yield this.stream.wrap({
      wrappedParent: null,
      token: this,
      rawItem: this.stream.mure.root
    });
  }
  toString () {
    return `root`;
  }
}
export default RootToken;
