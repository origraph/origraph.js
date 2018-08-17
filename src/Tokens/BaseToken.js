import Introspectable from '../Common/Introspectable.js';

class BaseToken extends Introspectable {
  constructor (stream) {
    super();
    this.stream = stream;
  }
  toString () {
    // The string version of most tokens can just be derived from the class type
    return `.${this.type.toLowerCase()}()`;
  }
  isSubSetOf () {
    // By default (without any arguments), tokens of the same class are subsets
    // of each other
    return true;
  }
  async * iterate (ancestorTokens) {
    throw new Error(`This function should be overridden`);
  }
  async * iterateParent (ancestorTokens) {
    const parentToken = ancestorTokens[ancestorTokens.length - 1];
    const temp = ancestorTokens.slice(0, ancestorTokens.length - 1);
    let yieldedSomething = false;
    for await (const wrappedParent of parentToken.iterate(temp)) {
      yieldedSomething = true;
      yield wrappedParent;
    }
    if (!yieldedSomething && this.mure.debug) {
      throw new TypeError(`Token yielded no results: ${parentToken}`);
    }
  }
}
Object.defineProperty(BaseToken, 'type', {
  get () {
    return /(.*)Token/.exec(this.name)[1];
  }
});
export default BaseToken;
