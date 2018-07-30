import Introspectable from '../Common/Introspectable.js';

class Token extends Introspectable {
  constructor (mure) {
    super();
    this.mure = mure;
  }
  /**
   * With the exception of KeyToken, a lot of set operations are well-defined:
   */
  union (otherToken) {
    return this.constructor === otherToken.constructor ? this : null;
  }
  difference (otherToken) {
    if (this.constructor === otherToken.constructor) {
      return null;
    } else {
      throw new Error(`Can't compute the difference of two different token types`);
    }
  }
  isSuperSetOf (otherToken) {
    return this.constructor === otherToken.constructor;
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
