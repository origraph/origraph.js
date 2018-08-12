import BaseToken from './BaseToken.js';

class RootToken extends BaseToken {
  * navigate () {
    yield this.stream.mure.wrap({
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
