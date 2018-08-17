import BaseToken from './BaseToken.js';

class JoinToken extends BaseToken {
  constructor (stream, [ otherStream, thisHash = 'key', otherHash = 'key', map = 'identity' ]) {
    super(stream);
    if (!stream.namedStreams[otherStream]) {
      throw new SyntaxError(`Unknown named stream: ${otherStream}`);
    }
    for (const func of [ map, thisHash, otherHash, map ]) {
      if (!stream.namedFunctions[func]) {
        throw new SyntaxError(`Unknown named function: ${func}`);
      }
    }
    this.otherStream = otherStream;
    this.thisHash = thisHash;
    this.otherHash = otherHash;
    this.map = map;
  }
  toString () {
    return `.join(${this.otherStream}, ${this.thisHash}, ${this.otherHash}, ${this.map})`;
  }
  isSubSetOf ([ otherStream, thisHash = 'key', otherHash = 'key', map = 'identity' ]) {
    return this.otherStream === otherStream &&
      this.thisHash === thisHash &&
      this.otherHash === otherHash &&
      this.map === map;
  }
  async * iterate (ancestorTokens) {
    const otherIterator = this.getOtherIterator();
    const thisHashFunction = this.stream.namedFunctions[this.thisHash];
    const otherHashFunction = this.stream.namedFunctions[this.otherHash];
    const mapFunction = this.stream.namedFunctions[this.map];

    const thisIndex = this.stream.getIndex(this.thisHash);
    const otherIndex = otherStream.getIndex(this.otherHash);

    if (thisIndex.complete) {
      if (otherIndex.complete) {
        // Best of all worlds; we can just iterate the hash values
      } else {
        // Need to iterate the other items, and take advantage of our complete
        // index
      }
    } else {
      if (otherIndex.complete) {
        // Need to iterate our items, and take advantage of the other complete
        // index
      } else {
        // Neither stream is fully indexed; grab one item from the other stream
        // in parallel to this one
      }
    }
  }
}

export default JoinToken;
