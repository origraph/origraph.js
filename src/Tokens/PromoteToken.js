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
  }
  toString () {
    return `.promote(${this.map}, ${this.hash}, ${this.reduceInstances})`;
  }
  isSubSetOf ([ map = 'identity', hash = 'sha1', reduceInstances = 'noop' ]) {
    return this.map === map &&
      this.hash === hash &&
      this.reduceInstances === reduceInstances;
  }
  async * iterate (ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      const mapFunction = this.stream.namedFunctions[this.map];
      const hashFunction = this.stream.namedFunctions[this.hash];
      const reduceInstancesFunction = this.stream.namedFunctions[this.reduceInstances];
      const hashIndex = this.stream.getIndex(this.hash);
      for await (const mappedRawItem of mapFunction(wrappedParent)) {
        const hashValue = hashFunction(mappedRawItem);
        let originalWrappedItem = hashIndex.getValues(hashValue)[0];
        if (originalWrappedItem) {
          if (this.reduceInstances !== 'noop') {
            reduceInstancesFunction(originalWrappedItem, mappedRawItem);
            originalWrappedItem.trigger('update');
          }
        } else {
          const hashes = {};
          hashes[this.hash] = hashValue;
          yield this.stream.wrap({
            wrappedParent,
            token: this,
            rawItem: mappedRawItem,
            hashes
          });
        }
      }
    }
  }
}

export default PromoteToken;
