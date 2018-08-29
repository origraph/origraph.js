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
  async * iterate (ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      for await (const mappedRawItem of this.stream.namedFunctions[this.generator](wrappedParent)) {
        yield this.wrap({
          wrappedParent,
          rawItem: mappedRawItem
        });
      }
    }
  }
}

export default MapToken;
