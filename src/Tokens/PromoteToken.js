import BaseToken from './BaseToken.js';

class PromoteToken extends BaseToken {
  constructor (stream, [ map = 'identity', hash = 'md5', reduceInstances = 'noop' ]) {
    super(stream);
    for (const func of [ map, hash, reduceInstances ]) {
      if (!stream.functions[func]) {
        throw new SyntaxError(`Unknown function: ${func}`);
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
  async * navigate (wrappedParent) {
    for await (const mappedRawItem of this.stream.functions[this.map](wrappedParent)) {
      const hash = this.stream.functions[this.hash](mappedRawItem);
      if (this.seenItems[hash]) {
        if (this.reduceInstances !== 'noop') {
          this.stream.functions[this.reduceInstances](this.seenItems[hash], mappedRawItem);
          this.seenItems[hash].trigger('update');
        }
      } else {
        this.seenItems[hash] = this.stream.mure.wrap({
          wrappedParent,
          token: this,
          rawItem: mappedRawItem
        });
      }
    }
  }
}

export default PromoteToken;
