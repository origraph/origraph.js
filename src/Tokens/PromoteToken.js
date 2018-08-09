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
  async * navigate (path) {
    const item = path[path.length - 1];
    for await (const mappedItem of this.map(item, path)) {
      const mappedPath = path.concat([ mappedItem ]);
      const hash = this.hash(mappedItem, mappedPath);
      if (this.seenItems[hash]) {
        this.reduceInstances(this.seenItems[hash], mappedItem, mappedPath);
      } else {
        this.seenItems[hash] = mappedItem;
        yield mappedPath;
      }
    }
  }
}

export default PromoteToken;
