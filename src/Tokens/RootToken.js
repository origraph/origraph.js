import BaseToken from './BaseToken.js';

class RootToken extends BaseToken {
  * navigate (path) {
    yield [path[0]];
  }
  toString () {
    return `root`;
  }
}
export default RootToken;
