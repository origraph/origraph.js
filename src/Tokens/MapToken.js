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
  async * navigate (path) {
    const item = path[path.length - 1];
    for await (const mappedItem of this.generator(item, path)) {
      yield path.concat([mappedItem]);
    }
  }
}

export default MapToken;
