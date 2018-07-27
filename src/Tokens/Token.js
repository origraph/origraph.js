import Introspectable from '../Common/Introspectable.js';

class Token extends Introspectable {
  constructor (mure) {
    super();
    this.mure = mure;
  }
  merge (otherToken) {
    // By default, all tokens behave the same way (except for KeyToken)
    return this.constructor === otherToken.constructor ? this : null;
  }
  isSuperSetOf (otherToken) {
    // By default, all tokens behave the same way (except for KeyToken)
    return this.constructor === otherToken.constructor ? this : null;
  }
  toString () {
    // All tokens are single characters that we can pull from the REGEX (except
    // for KeyToken)
    return this.constructor.REGEX.toString().match(/[^/\\^]/)[0];
  }
}
Object.defineProperty(Token, 'type', {
  get () {
    return /(.*)Token/.exec(this.name)[1];
  }
});
export default Token;
