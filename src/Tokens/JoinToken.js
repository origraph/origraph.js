import BaseToken from './BaseToken.js';

class JoinToken extends BaseToken {
  constructor (stream, [ otherStream, thisKeys = 'key', otherKeys = 'key', map = 'identity' ]) {
    super(stream);
    if (!stream.streams[otherStream]) {
      throw new SyntaxError(`Unknown stream: ${otherStream}`);
    }
    for (const func of [ thisKeys, otherKeys, map ]) {
      if (!stream.functions[func]) {
        throw new SyntaxError(`Unknown function: ${func}`);
      }
    }
    this.otherStream = otherStream;
    this.thisKeys = thisKeys;
    this.otherKeys = otherKeys;
    this.map = map;
  }
  toString () {
    return `.join(${this.otherStream} ${this.thisKeys}, ${this.otherKeys}, ${this.map})`;
  }
  async * navigate (wrappedParent) {
    // TODO
  }
}

export default JoinToken;
