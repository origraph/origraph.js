import BaseToken from './BaseToken.js';

class MapToken extends BaseToken {
  constructor (stream, [ generator = 'identity' ]) {
    super(stream);
    if (!stream.namedFunctions[generator]) {
      throw new SyntaxError(`Unknown named function: ${generator}`);
    }
    this.generator = generator;
  }
  toString () {
    return `.map(${this.generator})`;
  }
  isSubSetOf ([ generator = 'identity' ]) {
    return generator === this.generator;
  }
  async * navigate (wrappedParent) {
    for await (const mappedRawItem of this.stream.namedFunctions[this.generator](wrappedParent)) {
      yield this.stream.wrap({
        wrappedParent,
        token: this,
        rawItem: mappedRawItem
      });
    }
  }
}

export default MapToken;
