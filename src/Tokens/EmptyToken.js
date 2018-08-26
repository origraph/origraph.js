import BaseToken from './BaseToken.js';

class EmptyToken extends BaseToken {
  async * iterate () {
    // yield nothing
  }
  toString () {
    return `empty`;
  }
}
export default EmptyToken;
