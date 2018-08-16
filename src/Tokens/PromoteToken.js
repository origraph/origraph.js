import BaseToken from './BaseToken.js';

class PromoteToken extends BaseToken {
  constructor (stream, [ map = 'identity', hash = 'sha1', reduceInstances = 'noop' ]) {
    super(stream);
    for (const func of [ map, hash, reduceInstances ]) {
      if (!stream.namedFunctions[func]) {
        throw new SyntaxError(`Unknown named function: ${func}`);
      }
    }
    this.map = map;
    this.hash = hash;
    this.reduceInstances = reduceInstances;

    this.seenItems = {};
  }
  toString () {
    return `.promote(${this.map}, ${this.hash}, ${this.reduceInstances})`;
  }
  isSubSetOf ([ map = 'identity', hash = 'sha1', reduceInstances = 'noop' ]) {
    return this.map === map && this.hash === hash && this.reduceInstances === 'noop';
  }
  async * navigate (wrappedParent) {
    for await (const mappedRawItem of this.stream.namedFunctions[this.map](wrappedParent)) {
      const hash = this.stream.namedFunctions[this.hash](mappedRawItem);
      if (this.seenItems[hash]) {
        if (this.reduceInstances !== 'noop') {
          this.stream.namedFunctions[this.reduceInstances](this.seenItems[hash], mappedRawItem);
          this.seenItems[hash].trigger('update');
        }
      } else {
        this.seenItems[hash] = this.stream.wrap({
          wrappedParent,
          token: this,
          rawItem: mappedRawItem
        });
        yield this.seenItems[hash];
      }
    }
  }
}

export default PromoteToken;
