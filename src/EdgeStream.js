import Stream from './Stream.js';

class EdgeStream extends Stream {
  constructor ({
    mure,
    selector = 'root',
    namedFunctions = {},
    streams = {},
    traversalMode = 'DFS',
    sourceStream = null,
    targetStream = null,
    sourceKeyFunction = Stream.DEFAULT_FUNCTIONS.key,
    targetKeyFunction = Stream.DEFAULT_FUNCTIONS.key,
    myKeyFunction = Stream.DEFAULT_FUNCTIONS.key
  }) {
    super({ mure, selector, functions, streams, traversalMode });
    this.sourceStream = sourceStream;
    this.targetStream = targetStream;
  }

  async * sample ({ limit }) {
    const myIterator = this.iterate();
    const sourceIterator = this.sourceStream === null ? null
      : this.sourceStream.iterate();
    const targetIterator = this.targetStream === null ? null
      : this.targetStream.iterate();

    const myKeyHash = {};
    const sourceKeyHash = {};
    const targetKeyHash = {};

    let yieldedCount = 0;
    while (yieldedCount < limit) {
      // With each pass, get and wrap one item from each iterator
      let myItem = myIterator.next();
      myItem = myItem.done ? null : this.wrap({
        wrappedParent: null,
        token: null,
        rawItem: myItem.value
      });

      let sourceItem = sourceIterator === null ? null : sourceIterator.next();
      sourceItem = sourceItem && !sourceItem.done ? sourceItem.value : null;
      let targetItem = targetIterator === null ? null : targetIterator.next();
      targetItem = targetItem && !targetItem.done ? targetItem.value : null;

      // In the event that *none* of the streams gave us something, we're done!
      if (myItem === null && sourceItem === null && targetItem === null) {
        return;
      }

      // Populate the hashes
      if (myItem) {
        for (const key of this.myKeys(myItem)) {
          myKeyHash[key] = myKeyHash[key] || [];
          myKeyHash[key]
        }
      }
    }
  }
}

export default EdgeStream;
