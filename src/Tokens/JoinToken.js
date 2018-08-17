import BaseToken from './BaseToken.js';

class JoinToken extends BaseToken {
  constructor (stream, [ otherStream, thisHash = 'key', otherHash = 'key', map = 'identity' ]) {
    super(stream);
    for (const func of [ map, thisHash, map ]) {
      if (!stream.namedFunctions[func]) {
        throw new SyntaxError(`Unknown named function: ${func}`);
      }
    }

    const temp = stream.namedStreams[otherStream];
    if (temp) {
      throw new SyntaxError(`Unknown named stream: ${otherStream}`);
    }
    // Require otherHash on the other stream, or copy ours over if it isn't
    // already defined
    if (!temp.namedFunctions[otherHash]) {
      if (!stream.namedFunctions[otherHash]) {
        throw new SyntaxError(`Unknown hash function on either stream: ${otherHash}`);
      } else {
        temp.namedFunctions[otherHash] = stream.namedFunctions[otherHash];
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
    const otherStream = this.stream.namedStreams[this.otherStream];
    const thisHashFunction = this.stream.namedFunctions[this.thisHash];
    const otherHashFunction = otherStream.namedFunctions[this.otherHash];
    const mapFunction = this.stream.namedFunctions[this.map];

    // const thisIterator = this.iterateParents(ancestorTokens);
    // const otherIterator = otherStream.iterate();

    const thisIndex = this.stream.getIndex(this.thisHash);
    const otherIndex = otherStream.getIndex(this.otherHash);

    if (thisIndex.complete) {
      if (otherIndex.complete) {
        // Best of all worlds; we can just join the indexes
        for await (const { hash, valueList } of thisIndex.iterValues()) {
          for (const otherWrappedItem of await otherIndex.getValueSet(hash)) {
            for (const thisWrappedItem of valueList) {
              yield this.stream.wrap({
                wrappedParent: thisWrappedItem,
                token: this,
                rawItem: mapFunction({
                  thisItem: thisWrappedItem.rawItem,
                  otherItem: otherWrappedItem.rawItem
                })
              });
            }
          }
        }
      } else {
        // Need to iterate the other items, and take advantage of our complete
        // index
        for await (const otherWrappedItem of otherStream.iterate()) {
          const hash = otherHashFunction(otherWrappedItem);
          // Add otherWrappedItem to otherIndex:
          await otherIndex.addValue(hash, otherWrappedItem);
          for (const thisWrappedItem of thisIndex.getValueSet(hash)) {
            yield this.stream.wrap({
              wrappedParent: thisWrappedItem,
              token: this,
              rawItem: mapFunction({
                thisItem: thisWrappedItem.rawItem,
                otherItem: otherWrappedItem.rawItem
              })
            });
          }
        }
      }
    } else {
      if (otherIndex.complete) {
        // Need to iterate our items, and take advantage of the other complete
        // index
        for await (const thisWrappedItem of this.iterateParents(ancestorTokens)) {
          const hash = thisHashFunction(thisWrappedItem);
          // add thisWrappedItem to thisIndex
          await thisIndex.addValue(hash, thisWrappedItem);
          for (const otherWrappedItem of otherIndex.getValueSet(hash)) {
            yield this.stream.wrap({
              wrappedParent: thisWrappedItem,
              token: this,
              rawItem: mapFunction({
                thisItem: thisWrappedItem.rawItem,
                otherItem: otherWrappedItem.rawItem
              })
            });
          }
        }
      } else {
        // Neither stream is fully indexed; for more distributed sampling, grab
        // one item from each stream at a time, and use the partial indexes
        const thisIterator = this.iterateParents(ancestorTokens);
        let thisIsDone = false;
        const otherIterator = otherStream.iterate();
        let otherIsDone = false;

        while (!thisIsDone || !otherIsDone) {
          // Take one sample from this stream
          let temp = thisIterator.next();
          if (temp.done) {
            thisIsDone = true;
          } else {
            const thisWrappedItem = temp.value;
            const hash = thisHashFunction(thisWrappedItem);
            // add thisWrappedItem to thisIndex
            thisIndex.addValue(hash, thisWrappedItem);
            for (const otherWrappedItem of otherIndex.getValueSet(hash)) {
              yield this.stream.wrap({
                wrappedParent: thisWrappedItem,
                token: this,
                rawItem: mapFunction({
                  thisItem: thisWrappedItem.rawItem,
                  otherItem: otherWrappedItem.rawItem
                })
              });
            }
          }

          // Now for a sample from the other stream
          temp = otherIterator.next();
          if (temp.done) {
            otherIsDone = true;
          } else {
            const otherWrappedItem = temp.value;
            const hash = otherHashFunction(otherWrappedItem);
            // add otherWrappedItem to otherIndex
            otherIndex.addValue(hash, otherWrappedItem);
            for (const thisWrappedItem of thisIndex.getValueSet(hash)) {
              yield this.stream.wrap({
                wrappedParent: thisWrappedItem,
                token: this,
                rawItem: mapFunction({
                  thisItem: thisWrappedItem.rawItem,
                  otherItem: otherWrappedItem.rawItem
                })
              });
            }
          }
        }
      }
    }
  }
}

export default JoinToken;
