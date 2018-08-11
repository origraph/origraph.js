import BaseToken from './BaseToken.js';

class MapToken extends BaseToken {
  constructor (stream, [ generator = 'identity' ]) {
    super(stream);
    if (!stream.functions[generator]) {
      throw new SyntaxError(`Unknown function: ${generator}`);
    }
    this.generator = stream.functions[generator];
  }
  toString () {
    return `.map(${this.generator})`;
  }
  isSuperSetOf (otherToken) {
    return otherToken.constructor === MapToken && otherToken.generator === this.generator;
  }
  async * navigate (wrappedParent, mode) {
    for await (const mappedRawItem of this.generator(wrappedParent)) {
      yield this.stream.mure.wrap({
        wrappedParent,
        token: this,
        rawItem: mappedRawItem
      });
    }
  }
}

export default MapToken;
