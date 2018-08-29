import mime from 'mime-types';
import datalib from 'datalib';
import sha1 from 'sha1';

const TriggerableMixin = function (superclass) {
  return class extends superclass {
    constructor() {
      super(...arguments);
      this._instanceOfTriggerableMixin = true;
      this.eventHandlers = {};
      this.stickyTriggers = {};
    }

    on(eventName, callback, allowDuplicateListeners) {
      if (!this.eventHandlers[eventName]) {
        this.eventHandlers[eventName] = [];
      }

      if (!allowDuplicateListeners) {
        if (this.eventHandlers[eventName].indexOf(callback) !== -1) {
          return;
        }
      }

      this.eventHandlers[eventName].push(callback);
    }

    off(eventName, callback) {
      if (this.eventHandlers[eventName]) {
        if (!callback) {
          delete this.eventHandlers[eventName];
        } else {
          let index = this.eventHandlers[eventName].indexOf(callback);

          if (index >= 0) {
            this.eventHandlers[eventName].splice(index, 1);
          }
        }
      }
    }

    trigger(eventName, ...args) {
      if (this.eventHandlers[eventName]) {
        this.eventHandlers[eventName].forEach(callback => {
          setTimeout(() => {
            // Add timeout to prevent blocking
            callback.apply(this, args);
          }, 0);
        });
      }
    }

    stickyTrigger(eventName, argObj, delay = 10) {
      this.stickyTriggers[eventName] = this.stickyTriggers[eventName] || {
        argObj: {}
      };
      Object.assign(this.stickyTriggers[eventName].argObj, argObj);
      clearTimeout(this.stickyTriggers.timeout);
      this.stickyTriggers.timeout = setTimeout(() => {
        let argObj = this.stickyTriggers[eventName].argObj;
        delete this.stickyTriggers[eventName];
        this.trigger(eventName, argObj);
      }, delay);
    }

  };
};

Object.defineProperty(TriggerableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfTriggerableMixin
});

class Stream {
  constructor(options) {
    this.mure = options.mure;
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.namedStreams = options.namedStreams || {};
    this.launchedFromClass = options.launchedFromClass || null;
    this.indexes = options.indexes || {};
    this.tokenClassList = options.tokenClassList || []; // Reminder: this always needs to be after initializing this.namedFunctions
    // and this.namedStreams

    this.tokenList = options.tokenClassList.map(({
      TokenClass,
      argList
    }) => {
      return new TokenClass(this, argList);
    }); // Reminder: this always needs to be after initializing this.tokenList

    this.Wrappers = this.getWrapperList();
  }

  getWrapperList() {
    // Look up which, if any, classes describe the result of each token, so that
    // we can wrap items appropriately:
    return this.tokenList.map((token, index) => {
      if (index === this.tokenList.length - 1 && this.launchedFromClass) {
        // If this stream was started from a class, we already know we should
        // use that class's wrapper for the last token
        return this.launchedFromClass.Wrapper;
      } // Find a class that describes exactly each series of tokens


      const localTokenList = this.tokenList.slice(0, index + 1);
      const potentialWrappers = Object.values(this.mure.classes).filter(classObj => {
        const classTokenList = classObj.tokenClassList;

        if (!classTokenList.length !== localTokenList.length) {
          return false;
        }

        return localTokenList.every((localToken, localIndex) => {
          const tokenClassSpec = classTokenList[localIndex];
          return localToken instanceof tokenClassSpec.TokenClass && token.isSubsetOf(tokenClassSpec.argList);
        });
      });

      if (potentialWrappers.length === 0) {
        // No classes describe this series of tokens, so use the generic wrapper
        return this.mure.WRAPPERS.GenericWrapper;
      } else {
        if (potentialWrappers.length > 1) {
          console.warn(`Multiple classes describe the same item! Arbitrarily choosing one...`);
        }

        return potentialWrappers[0].Wrapper;
      }
    });
  }

  get selector() {
    return this.tokenList.join('');
  }

  fork(selector) {
    return new Stream({
      mure: this.mure,
      namedFunctions: this.namedFunctions,
      namedStreams: this.namedStreams,
      tokenClassList: this.mure.parseSelector(selector),
      launchedFromClass: this.launchedFromClass,
      indexes: this.indexes
    });
  }

  extend(TokenClass, argList, options = {}) {
    options.mure = this.mure;
    options.namedFunctions = Object.assign({}, this.namedFunctions, options.namedFunctions || {});
    options.namedStreams = Object.assign({}, this.namedStreams, options.namedStreams || {});
    options.tokenClassList = this.tokenClassList.concat([{
      TokenClass,
      argList
    }]);
    options.launchedFromClass = options.launchedFromClass || this.launchedFromClass;
    options.indexes = Object.assign({}, this.indexes, options.indexes || {});
    return new Stream(options);
  }

  async wrap({
    wrappedParent,
    token,
    rawItem,
    hashes = {}
  }) {
    let wrapperIndex = 0;
    let temp = wrappedParent;

    while (temp !== null) {
      wrapperIndex += 1;
      temp = temp.wrappedParent;
    }

    const wrappedItem = new this.Wrappers[wrapperIndex]({
      wrappedParent,
      token,
      rawItem
    });
    await Promise.all(Object.entries(hashes).reduce((promiseList, [hashFunctionName, hash]) => {
      const index = this.getIndex(hashFunctionName);

      if (!index.complete) {
        return promiseList.concat([index.addValue(hash, wrappedItem)]);
      }
    }, []));
    return wrappedItem;
  }

  async *iterate() {
    const lastToken = this.tokenList[this.tokenList.length - 1];
    const temp = this.tokenList.slice(0, this.tokenList.length - 1);
    yield* await lastToken.iterate(temp);
  }

  getIndex(hashFunctionName) {
    if (!this.indexes[hashFunctionName]) {
      // TODO: if using node.js, start with external / more scalable indexes
      this.indexes[hashFunctionName] = new this.mure.INDEXES.InMemoryIndex();
    }

    return this.indexes[hashFunctionName];
  }

  async buildIndex(hashFunctionName) {
    const hashFunction = this.namedFunctions[hashFunctionName];

    if (!hashFunction) {
      throw new Error(`Unknown named function: ${hashFunctionName}`);
    }

    const index = this.getIndex(hashFunctionName);

    if (index.complete) {
      return;
    }

    for await (const wrappedItem of this.iterate()) {
      for await (const hash of hashFunction(wrappedItem)) {
        index.addValue(hash, wrappedItem);
      }
    }

    index.complete = true;
  }

  async *sample({
    limit = 10,
    rebuildIndexes = false
  }) {
    // Before we start, clean out any old indexes that were never finished
    Object.entries(this.indexes).forEach(([hashFunctionName, index]) => {
      if (rebuildIndexes || !index.complete) {
        delete this.indexes[hashFunctionName];
      }
    });
    const iterator = this.iterate();

    for (let i = 0; i < limit; i++) {
      const temp = await iterator.next();

      if (temp.done) {
        // We actually finished a full pass; flag all of our indexes as complete
        Object.values(this.indexes).forEach(index => {
          index.complete = true;
        });
        break;
      }

      yield temp.value;
    }
  }

}

class Introspectable {
  get type() {
    return this.constructor.type;
  }

  get lowerCamelCaseType() {
    return this.constructor.lowerCamelCaseType;
  }

  get humanReadableType() {
    return this.constructor.humanReadableType;
  }

}

Object.defineProperty(Introspectable, 'type', {
  // This can / should be overridden by subclasses that follow a common string
  // pattern, such as RootToken, KeysToken, ParentToken, etc.
  configurable: true,

  get() {
    return this.type;
  }

});
Object.defineProperty(Introspectable, 'lowerCamelCaseType', {
  get() {
    const temp = this.type;
    return temp.replace(/./, temp[0].toLocaleLowerCase());
  }

});
Object.defineProperty(Introspectable, 'humanReadableType', {
  get() {
    // CamelCase to Sentence Case
    return this.type.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

});

class BaseToken extends Introspectable {
  constructor(stream) {
    super();
    this.stream = stream;
  }

  toString() {
    // The string version of most tokens can just be derived from the class type
    return `.${this.type.toLowerCase()}()`;
  }

  isSubSetOf() {
    // By default (without any arguments), tokens of the same class are subsets
    // of each other
    return true;
  }

  async *iterate(ancestorTokens) {
    throw new Error(`This function should be overridden`);
  }

  async *iterateParent(ancestorTokens) {
    const parentToken = ancestorTokens[ancestorTokens.length - 1];
    const temp = ancestorTokens.slice(0, ancestorTokens.length - 1);
    let yieldedSomething = false;

    for await (const wrappedParent of parentToken.iterate(temp)) {
      yieldedSomething = true;
      yield wrappedParent;
    }

    if (!yieldedSomething && this.stream.mure.debug) {
      throw new TypeError(`Token yielded no results: ${parentToken}`);
    }
  }

}

Object.defineProperty(BaseToken, 'type', {
  get() {
    return /(.*)Token/.exec(this.name)[1];
  }

});

class EmptyToken extends BaseToken {
  async *iterate() {// yield nothing
  }

  toString() {
    return `empty`;
  }

}

class RootToken extends BaseToken {
  async *iterate() {
    yield this.stream.wrap({
      wrappedParent: null,
      token: this,
      rawItem: this.stream.mure.root
    });
  }

  toString() {
    return `root`;
  }

}

class KeysToken extends BaseToken {
  constructor(stream, argList, {
    matchAll,
    keys,
    ranges
  } = {}) {
    super(stream);

    if (keys || ranges) {
      this.keys = keys;
      this.ranges = ranges;
    } else if (argList && argList.length === 1 && argList[0] === undefined || matchAll) {
      this.matchAll = true;
    } else {
      argList.forEach(arg => {
        let temp = arg.match(/(\d+)-([\d∞]+)/);

        if (temp && temp[2] === '∞') {
          temp[2] = Infinity;
        }

        temp = temp ? temp.map(d => d.parseInt(d)) : null;

        if (temp && !isNaN(temp[1]) && !isNaN(temp[2])) {
          for (let i = temp[1]; i <= temp[2]; i++) {
            this.ranges = this.ranges || [];
            this.ranges.push({
              low: temp[1],
              high: temp[2]
            });
          }

          return;
        }

        temp = arg.match(/'(.*)'/);
        temp = temp && temp[1] ? temp[1] : arg;
        let num = Number(temp);

        if (isNaN(num) || num !== parseInt(temp)) {
          // leave non-integer numbers as strings
          this.keys = this.keys || {};
          this.keys[temp] = true;
        } else {
          this.ranges = this.ranges || [];
          this.ranges.push({
            low: num,
            high: num
          });
        }
      });

      if (!this.keys && !this.ranges) {
        throw new SyntaxError(`Bad token key(s) / range(s): ${JSON.stringify(argList)}`);
      }
    }

    if (this.ranges) {
      this.ranges = this.consolidateRanges(this.ranges);
    }
  }

  get selectsNothing() {
    return !this.matchAll && !this.keys && !this.ranges;
  }

  consolidateRanges(ranges) {
    // Merge any overlapping ranges
    const newRanges = [];
    const temp = ranges.sort((a, b) => a.low - b.low);
    let currentRange = null;

    for (let i = 0; i < temp.length; i++) {
      if (!currentRange) {
        currentRange = temp[i];
      } else if (temp[i].low <= currentRange.high) {
        currentRange.high = temp[i].high;
      } else {
        newRanges.push(currentRange);
        currentRange = temp[i];
      }
    }

    if (currentRange) {
      // Corner case: add the last range
      newRanges.push(currentRange);
    }

    return newRanges.length > 0 ? newRanges : undefined;
  }

  difference(otherToken) {
    // Compute what is left of this after subtracting out everything in otherToken
    if (!(otherToken instanceof KeysToken)) {
      throw new Error(`Can't compute the difference of two different token types`);
    } else if (otherToken.matchAll) {
      return null;
    } else if (this.matchAll) {
      console.warn(`Inaccurate difference computed! TODO: need to figure out how to invert categorical keys!`);
      return this;
    } else {
      const newKeys = {};

      for (let key in this.keys || {}) {
        if (!otherToken.keys || !otherToken.keys[key]) {
          newKeys[key] = true;
        }
      }

      let newRanges = [];

      if (this.ranges) {
        if (otherToken.ranges) {
          let allPoints = this.ranges.reduce((agg, range) => {
            return agg.concat([{
              include: true,
              low: true,
              value: range.low
            }, {
              include: true,
              high: true,
              value: range.high
            }]);
          }, []);
          allPoints = allPoints.concat(otherToken.ranges.reduce((agg, range) => {
            return agg.concat([{
              exclude: true,
              low: true,
              value: range.low
            }, {
              exclude: true,
              high: true,
              value: range.high
            }]);
          }, [])).sort();
          let currentRange = null;

          for (let i = 0; i < allPoints.length; i++) {
            if (currentRange === null) {
              if (allPoints[i].include && allPoints[i].low) {
                currentRange = {
                  low: allPoints[i].value
                };
              }
            } else if (allPoints[i].include && allPoints[i].high) {
              currentRange.high = allPoints[i].value;

              if (currentRange.high >= currentRange.low) {
                newRanges.push(currentRange);
              }

              currentRange = null;
            } else if (allPoints[i].exclude) {
              if (allPoints[i].low) {
                currentRange.high = allPoints[i].low - 1;

                if (currentRange.high >= currentRange.low) {
                  newRanges.push(currentRange);
                }

                currentRange = null;
              } else if (allPoints[i].high) {
                currentRange.low = allPoints[i].high + 1;
              }
            }
          }
        } else {
          newRanges = this.ranges;
        }
      }

      return new KeysToken(this.mure, null, {
        keys: newKeys,
        ranges: newRanges
      });
    }
  }

  isSubSetOf(argList) {
    const otherToken = new KeysToken(this.stream, argList);
    const diff = otherToken.difference(this);
    return diff === null || diff.selectsNothing;
  }

  toString() {
    if (this.matchAll) {
      return '.keys()';
    }

    return '.keys(' + (this.ranges || []).map(({
      low,
      high
    }) => {
      return low === high ? low : `${low}-${high}`;
    }).concat(Object.keys(this.keys || {}).map(key => `'${key}'`)).join(',') + ')';
  }

  async *iterate(ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      if (typeof wrappedParent.rawItem !== 'object') {
        if (!this.stream.mure.debug) {
          throw new TypeError(`Input to KeysToken is not an object`);
        } else {
          continue;
        }
      }

      if (this.matchAll) {
        for (let key in wrappedParent.rawItem) {
          yield this.stream.wrap({
            wrappedParent,
            token: this,
            rawItem: key
          });
        }
      } else {
        for (let {
          low,
          high
        } of this.ranges || []) {
          low = Math.max(0, low);
          high = Math.min(wrappedParent.rawItem.length - 1, high);

          for (let i = low; i <= high; i++) {
            if (wrappedParent.rawItem[i] !== undefined) {
              yield this.stream.wrap({
                wrappedParent,
                token: this,
                rawItem: i
              });
            }
          }
        }

        for (let key in this.keys || {}) {
          if (wrappedParent.rawItem.hasOwnProperty(key)) {
            yield this.stream.wrap({
              wrappedParent,
              token: this,
              rawItem: key
            });
          }
        }
      }
    }
  }

}

class ValueToken extends BaseToken {
  async *iterate(ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      const obj = wrappedParent && wrappedParent.wrappedParent && wrappedParent.wrappedParent.rawItem;
      const key = wrappedParent && wrappedParent.rawItem;
      const keyType = typeof key;

      if (typeof obj !== 'object' || keyType !== 'string' && keyType !== 'number') {
        if (!this.stream.mure.debug) {
          throw new TypeError(`ValueToken used on a non-object, or without a string / numeric key`);
        } else {
          continue;
        }
      }

      yield this.stream.wrap({
        wrappedParent,
        token: this,
        rawItem: obj[key]
      });
    }
  }

}

class EvaluateToken extends BaseToken {
  async *iterate(ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      if (typeof wrappedParent.rawItem !== 'string') {
        if (!this.stream.mure.debug) {
          throw new TypeError(`Input to EvaluateToken is not a string`);
        } else {
          continue;
        }
      }

      let newStream;

      try {
        newStream = this.stream.fork(wrappedParent.rawItem);
      } catch (err) {
        if (!this.stream.mure.debug || !(err instanceof SyntaxError)) {
          throw err;
        } else {
          continue;
        }
      }

      yield* await newStream.iterate();
    }
  }

}

class MapToken extends BaseToken {
  constructor(stream, [generator = 'identity']) {
    super(stream);

    if (!stream.namedFunctions[generator]) {
      throw new SyntaxError(`Unknown named function: ${generator}`);
    }

    this.generator = generator;
  }

  toString() {
    return `.map(${this.generator})`;
  }

  isSubSetOf([generator = 'identity']) {
    return generator === this.generator;
  }

  async *iterate(ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      for await (const mappedRawItem of this.stream.namedFunctions[this.generator](wrappedParent)) {
        yield this.stream.wrap({
          wrappedParent,
          token: this,
          rawItem: mappedRawItem
        });
      }
    }
  }

}

class PromoteToken extends BaseToken {
  constructor(stream, [map = 'identity', hash = 'sha1', reduceInstances = 'noop']) {
    super(stream);

    for (const func of [map, hash, reduceInstances]) {
      if (!stream.namedFunctions[func]) {
        throw new SyntaxError(`Unknown named function: ${func}`);
      }
    }

    this.map = map;
    this.hash = hash;
    this.reduceInstances = reduceInstances;
  }

  toString() {
    return `.promote(${this.map}, ${this.hash}, ${this.reduceInstances})`;
  }

  isSubSetOf([map = 'identity', hash = 'sha1', reduceInstances = 'noop']) {
    return this.map === map && this.hash === hash && this.reduceInstances === reduceInstances;
  }

  async *iterate(ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      const mapFunction = this.stream.namedFunctions[this.map];
      const hashFunction = this.stream.namedFunctions[this.hash];
      const reduceInstancesFunction = this.stream.namedFunctions[this.reduceInstances];
      const hashIndex = this.stream.getIndex(this.hash);

      for await (const mappedRawItem of mapFunction(wrappedParent)) {
        const hash = hashFunction(mappedRawItem);
        let originalWrappedItem = (await hashIndex.getValueList(hash))[0];

        if (originalWrappedItem) {
          if (this.reduceInstances !== 'noop') {
            reduceInstancesFunction(originalWrappedItem, mappedRawItem);
            originalWrappedItem.trigger('update');
          }
        } else {
          const hashes = {};
          hashes[this.hash] = hash;
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

class JoinToken extends BaseToken {
  constructor(stream, [otherStream, thisHash = 'key', otherHash = 'key', finish = 'defaultFinish', edgeRole = 'none']) {
    super(stream);

    for (const func of [thisHash, finish]) {
      if (!stream.namedFunctions[func]) {
        throw new SyntaxError(`Unknown named function: ${func}`);
      }
    }

    const temp = stream.namedStreams[otherStream];

    if (!temp) {
      throw new SyntaxError(`Unknown named stream: ${otherStream}`);
    } // Require otherHash on the other stream, or copy ours over if it isn't
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
    this.finish = finish;
    this.edgeRole = edgeRole;
    this.hashThisGrandparent = edgeRole === 'full';
  }

  toString() {
    return `.join(${this.otherStream}, ${this.thisHash}, ${this.otherHash}, ${this.finish})`;
  }

  isSubSetOf([otherStream, thisHash = 'key', otherHash = 'key', finish = 'identity']) {
    return this.otherStream === otherStream && this.thisHash === thisHash && this.otherHash === otherHash && this.finish === finish;
  }

  async *iterate(ancestorTokens) {
    const otherStream = this.stream.namedStreams[this.otherStream];
    const thisHashFunction = this.stream.namedFunctions[this.thisHash];
    const otherHashFunction = otherStream.namedFunctions[this.otherHash];
    const finishFunction = this.stream.namedFunctions[this.finish]; // const thisIterator = this.iterateParent(ancestorTokens);
    // const otherIterator = otherStream.iterate();

    const thisIndex = this.stream.getIndex(this.thisHash);
    const otherIndex = otherStream.getIndex(this.otherHash);

    if (thisIndex.complete) {
      if (otherIndex.complete) {
        // Best of all worlds; we can just join the indexes
        for await (const {
          hash,
          valueList
        } of thisIndex.iterEntries()) {
          const otherList = await otherIndex.getValueList(hash);

          for await (const otherWrappedItem of otherList) {
            for await (const thisWrappedItem of valueList) {
              for await (const rawItem of finishFunction(thisWrappedItem, otherWrappedItem)) {
                yield this.stream.wrap({
                  wrappedParent: thisWrappedItem,
                  token: this,
                  rawItem
                });
              }
            }
          }
        }
      } else {
        // Need to iterate the other items, and take advantage of our complete
        // index
        for await (const otherWrappedItem of otherStream.iterate()) {
          for await (const hash of otherHashFunction(otherWrappedItem)) {
            // Add otherWrappedItem to otherIndex:
            await otherIndex.addValue(hash, otherWrappedItem);
            const thisList = await thisIndex.getValueList(hash);

            for await (const thisWrappedItem of thisList) {
              for await (const rawItem of finishFunction(thisWrappedItem, otherWrappedItem)) {
                yield this.stream.wrap({
                  wrappedParent: thisWrappedItem,
                  token: this,
                  rawItem
                });
              }
            }
          }
        }
      }
    } else {
      if (otherIndex.complete) {
        // Need to iterate our items, and take advantage of the other complete
        // index
        for await (const thisWrappedItem of this.iterateParent(ancestorTokens)) {
          // Odd corner case for edges; sometimes we want to hash the grandparent instead of the result of
          // an intermediate join:
          const thisHashItem = this.hashThisGrandparent ? thisWrappedItem.wrappedParent : thisWrappedItem;

          for await (const hash of thisHashFunction(thisHashItem)) {
            // add thisWrappedItem to thisIndex
            await thisIndex.addValue(hash, thisHashItem);
            const otherList = await otherIndex.getValueList(hash);

            for await (const otherWrappedItem of otherList) {
              for await (const rawItem of finishFunction(thisWrappedItem, otherWrappedItem)) {
                yield this.stream.wrap({
                  wrappedParent: thisWrappedItem,
                  token: this,
                  rawItem
                });
              }
            }
          }
        }
      } else {
        // Neither stream is fully indexed; for more distributed sampling, grab
        // one item from each stream at a time, and use the partial indexes
        const thisIterator = this.iterateParent(ancestorTokens, this.thisIndirectKey);
        let thisIsDone = false;
        const otherIterator = otherStream.iterate();
        let otherIsDone = false;

        while (!thisIsDone || !otherIsDone) {
          // Take one sample from this stream
          let temp = await thisIterator.next();

          if (temp.done) {
            thisIsDone = true;
          } else {
            const thisWrappedItem = await temp.value; // Odd corner case for edges; sometimes we want to hash the grandparent instead of the result of
            // an intermediate join:

            const thisHashItem = this.hashThisGrandparent ? thisWrappedItem.wrappedParent : thisWrappedItem;

            for await (const hash of thisHashFunction(thisHashItem)) {
              // add thisWrappedItem to thisIndex
              thisIndex.addValue(hash, thisHashItem);
              const otherList = await otherIndex.getValueList(hash);

              for await (const otherWrappedItem of otherList) {
                for await (const rawItem of finishFunction(thisWrappedItem, otherWrappedItem)) {
                  yield this.stream.wrap({
                    wrappedParent: thisWrappedItem,
                    token: this,
                    rawItem
                  });
                }
              }
            }
          } // Now for a sample from the other stream


          temp = await otherIterator.next();

          if (temp.done) {
            otherIsDone = true;
          } else {
            const otherWrappedItem = await temp.value;

            for await (const hash of otherHashFunction(otherWrappedItem)) {
              // add otherWrappedItem to otherIndex
              otherIndex.addValue(hash, otherWrappedItem);
              const thisList = await thisIndex.getValueList(hash);

              for await (const thisWrappedItem of thisList) {
                for await (const rawItem of finishFunction(thisWrappedItem, otherWrappedItem)) {
                  yield this.stream.wrap({
                    wrappedParent: thisWrappedItem,
                    token: this,
                    rawItem
                  });
                }
              }
            }
          }
        }
      }
    }
  }

}



var TOKENS = /*#__PURE__*/Object.freeze({
  EmptyToken: EmptyToken,
  RootToken: RootToken,
  KeysToken: KeysToken,
  ValueToken: ValueToken,
  EvaluateToken: EvaluateToken,
  MapToken: MapToken,
  PromoteToken: PromoteToken,
  JoinToken: JoinToken
});

const ASTERISKS = {
  'evaluate': '↬',
  'join': '⨯',
  'map': '↦',
  'promote': '↑',
  'value': '→'
};

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this.mure = options.mure;
    this.classId = options.classId;
    this._selector = options.selector;
    this.customClassName = options.customClassName || null;
    this.customNameTokenIndex = options.customNameTokenIndex || null;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.indexes = options.indexes || {};
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});

    for (let [funcName, func] of Object.entries(this.namedFunctions)) {
      if (typeof func === 'string') {
        this.namedFunctions[funcName] = new Function(`return ${func}`)(); // eslint-disable-line no-new-func
      }
    }
  }

  get selector() {
    return this._selector;
  }

  get tokenClassList() {
    return this.mure.parseSelector(this.selector);
  }

  async toRawObject() {
    const result = {
      classType: this.constructor.name,
      selector: this._selector,
      customClassName: this.customClassName,
      customNameTokenIndex: this.customNameTokenIndex,
      classId: this.classId,
      indexes: {},
      namedFunctions: {}
    };

    for (let [funcName, func] of Object.entries(this.namedFunctions)) {
      let stringifiedFunc = func.toString(); // Istanbul adds some code to functions for computing coverage, that gets
      // included in the stringification process during testing. See:
      // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022

      stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
      result.namedFunctions[funcName] = stringifiedFunc;
    }

    await Promise.all(Object.entries(this.indexes).map(async ([funcName, index]) => {
      if (index.complete) {
        result.indexes[funcName] = await index.toRawObject();
      }
    }));
    return result;
  }

  async setClassName(value) {
    if (this.customClassName !== value) {
      this.customClassName = value;
      this.customNameTokenIndex = this.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
      await this.mure.saveClasses();
    }
  }

  get hasCustomName() {
    return this.customClassName !== null && this.customNameTokenIndex === this.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
  }

  get className() {
    const selector = this.selector;
    const tokenStrings = selector.match(/\.([^(]*)\(([^)]*)\)/g);
    let result = '';

    for (let i = tokenStrings.length - 1; i >= 0; i--) {
      if (this.customClassName !== null && i <= this.customNameTokenIndex) {
        return this.customClassName + result;
      }

      const temp = tokenStrings[i].match(/^.([^(]*)\(([^)]*)\)/);

      if (temp[1] === 'keys' || temp[1] === 'values') {
        if (temp[2] === '') {
          result = '*' + result;
        } else {
          result = temp[2].replace(/'([^']*)'/, '$1') + result;
        }
      } else {
        result = ASTERISKS[temp[1]] + result;
      }
    }

    return (selector.startsWith('empty') ? '∅' : '') + result;
  }

  addHashFunction(funcName, func) {
    this.namedFunctions[funcName] = func;
  }

  populateStreamOptions(options = {}) {
    options.mure = this.mure;
    options.tokenClassList = this.tokenClassList;
    options.namedFunctions = this.namedFunctions;
    options.launchedFromClass = this;
    options.indexes = this.indexes;
    return options;
  }

  getStream(options = {}) {
    if (options.reset || !this._stream) {
      this._stream = new Stream(this.populateStreamOptions(options));
    }

    return this._stream;
  }

  isSuperSetOfTokenList(tokenList) {
    if (tokenList.length !== this.tokenList.length) {
      return false;
    }

    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }

  async interpretAsNodes() {
    const options = await this.toRawObject();
    options.mure = this.mure;
    this.mure.classes[this.classId] = new this.mure.CLASSES.NodeClass(options);
    await this.mure.saveClasses();
    return this.mure.classes[this.classId];
  }

  async interpretAsEdges() {
    const options = await this.toRawObject();
    options.mure = this.mure;
    this.mure.classes[this.classId] = new this.mure.CLASSES.EdgeClass(options);
    await this.mure.saveClasses();
    return this.mure.classes[this.classId];
  }

  async aggregate(hash, reduce) {
    throw new Error(`unimplemented`);
  }

  async expand(map) {
    throw new Error(`unimplemented`);
  }

  async filter(filter) {
    throw new Error(`unimplemented`);
  }

  async split(hash) {
    throw new Error(`unimplemented`);
  }

  async delete() {
    delete this.mure.classes[this.classId];
    await this.mure.saveClasses();
  }

}

Object.defineProperty(GenericClass, 'type', {
  get() {
    return /(.*)Class/.exec(this.name)[1];
  }

});

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.NodeWrapper;
    this.edgeConnections = options.edgeConnections || {};
  }

  async toRawObject() {
    // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
    // prevents `await super`; this is a workaround:
    const result = await GenericClass.prototype.toRawObject.call(this); // TODO: need to deep copy edgeConnections?

    result.edgeConnections = this.edgeConnections;
    return result;
  }

  async interpretAsNodes() {
    return this;
  }

  async interpretAsEdges() {
    throw new Error(`unimplemented`);
  }

  async connectToNodeClass({
    otherNodeClass,
    directed,
    thisHashName,
    otherHashName
  }) {
    const edgeClass = await this.mure.newClass({
      selector: null,
      ClassType: this.mure.CLASSES.EdgeClass,
      sourceClassId: this.classId,
      targetClassId: otherNodeClass.classId,
      directed
    });
    this.edgeConnections[edgeClass.classId] = {
      nodeHashName: thisHashName
    };
    otherNodeClass.edgeConnections[edgeClass.classId] = {
      nodeHashName: otherHashName
    };
    delete this._stream;
    await this.mure.saveClasses();
  }

  async connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }

  async delete() {
    for (const edgeClassId of Object.keys(this.edgeConnections)) {
      const edgeClass = this.mure.classes[edgeClassId];

      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.sourceClassId = null;
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.targetClassId = null;
      }
    }

    await super.delete();
  }

}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.EdgeWrapper;
    this.sourceClassId = options.sourceClassId || null;
    this.targetClassId = options.targetClassId || null;
    this.directed = options.directed || false;
  }

  get selector() {
    const sourceClass = this.mure.classes[this.sourceClassId];
    const targetClass = this.mure.classes[this.targetClassId];

    if (!this._selector) {
      if (!sourceClass || !targetClass) {
        throw new Error(`Partial connections without an edge table should never happen`);
      } else {
        // No edge table (simple join between two nodes)
        const sourceHash = sourceClass.edgeConnections[this.classId].nodeHashName;
        const targetHash = targetClass.edgeConnections[this.classId].nodeHashName;
        return sourceClass.selector + `.join(target, ${sourceHash}, ${targetHash}, defaultFinish, sourceTarget)`;
      }
    } else {
      let result = this._selector;

      if (!sourceClass) {
        if (!targetClass) {
          // No connections yet; just yield the raw edge table
          return result;
        } else {
          // Partial edge-target connections
          const {
            edgeHashName,
            nodeHashName
          } = targetClass.edgeConnections[this.classId];
          return result + `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, edgeTarget)`;
        }
      } else if (!targetClass) {
        // Partial source-edge connections
        const {
          nodeHashName,
          edgeHashName
        } = sourceClass.edgeConnections[this.classId];
        return result + `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish, sourceEdge)`;
      } else {
        // Full connections
        let {
          nodeHashName,
          edgeHashName
        } = sourceClass.edgeConnections[this.classId];
        result += `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        ({
          edgeHashName,
          nodeHashName
        } = targetClass.edgeConnections[this.classId]);
        result += `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, full)`;
        return result;
      }
    }
  }

  populateStreamOptions(options = {}) {
    const sourceClass = this.mure.classes[this.sourceClassId];
    const targetClass = this.mure.classes[this.targetClassId];
    options.namedStreams = {};

    if (!this._selector) {
      // Use the options from the source stream instead of our class
      options = sourceClass.populateStreamOptions(options);
      options.namedStreams.target = targetClass.getStream();
    } else {
      options = super.populateStreamOptions(options);

      if (sourceClass) {
        options.namedStreams.source = sourceClass.getStream();
      }

      if (targetClass) {
        options.namedStreams.target = targetClass.getStream();
      }
    }

    return options;
  }

  async toRawObject() {
    // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
    // prevents `await super`; this is a workaround:
    const result = await GenericClass.prototype.toRawObject.call(this);
    result.sourceClassId = this.sourceClassId;
    result.targetClassId = this.targetClassId;
    result.directed = this.directed;
    return result;
  }

  async interpretAsNodes() {
    throw new Error(`unimplemented`);
  }

  async interpretAsEdges() {
    return this;
  }

  async connectToNodeClass({
    nodeClass,
    direction,
    nodeHashName,
    edgeHashName
  }) {
    if (direction === 'source') {
      if (this.sourceClassId) {
        delete this.mure.classes[this.sourceClassId].edgeConnections[this.classId];
      }

      this.sourceClassId = nodeClass.classId;
    } else if (direction === 'target') {
      if (this.targetClassId) {
        delete this.mure.classes[this.targetClassId].edgeConnections[this.classId];
      }

      this.targetClassId = nodeClass.classId;
    } else {
      if (!this.sourceClassId) {
        this.sourceClassId = nodeClass.classId;
      } else if (!this.targetClassId) {
        this.targetClassId = nodeClass.classId;
      } else {
        throw new Error(`Source and target are already defined; please specify a direction to override`);
      }
    }

    nodeClass.edgeConnections[this.classId] = {
      nodeHashName,
      edgeHashName
    };
    delete this._stream;
    await this.mure.saveClasses();
  }

  async toggleNodeDirection(sourceClassId) {
    if (!sourceClassId) {
      this.directed = false;
    } else {
      this.directed = true;

      if (sourceClassId !== this.sourceClassId) {
        if (sourceClassId !== this.targetClassId) {
          throw new Error(`Can't swap to unconnected class id: ${sourceClassId}`);
        }

        this.sourceClassId = this.targetClassId;
        this.targetClassId = sourceClassId;
      }
    }

    delete this._stream;
    await this.mure.saveClasses();
  }

  async delete() {
    if (this.sourceClassId) {
      delete this.mure.classes[this.sourceClassId].edgeConnections[this.classId];
    }

    if (this.targetClassId) {
      delete this.mure.classes[this.targetClassId].edgeConnections[this.classId];
    }

    await super.delete();
  }

}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
});

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor({
    wrappedParent,
    token,
    rawItem
  }) {
    super();
    this.wrappedParent = wrappedParent;
    this.token = token;
    this.rawItem = rawItem;
  }

}

Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return /(.*)Wrapper/.exec(this.name)[1];
  }

});

class NodeWrapper extends GenericWrapper {}

class EdgeWrapper extends GenericWrapper {
  constructor({
    wrappedParent,
    token,
    rawItem
  }) {
    super({
      wrappedParent,
      token,
      rawItem
    });

    if (token.edgeRole === 'sourceTarget') {
      this.rawItem = {
        source: this.rawItem.left,
        target: this.rawItem.right
      };
    } else if (token.edgeRole === 'edgeTarget') {
      this.rawItem = {
        edge: this.rawItem.left,
        target: this.rawItem.right
      };
    } else if (token.edgeRole === 'sourceEdge') {
      this.rawItem = {
        source: this.rawItem.right,
        edge: this.rawItem.left
      };
    } else if (token.edgeRole === 'full') {
      this.rawItem = {
        source: this.rawItem.left.right,
        edge: this.rawItem.left.left,
        target: this.rawItem.right
      };
    } else {
      throw new Error(`Unknown edgeRole: ${token.edgeRole}`);
    }
  }

}



var WRAPPERS = /*#__PURE__*/Object.freeze({
  GenericWrapper: GenericWrapper,
  NodeWrapper: NodeWrapper,
  EdgeWrapper: EdgeWrapper
});

class InMemoryIndex {
  constructor({
    entries = {},
    complete = false
  } = {}) {
    this.entries = entries;
    this.complete = complete;
  }

  async toRawObject() {
    return this.entries;
  }

  async *iterEntries() {
    for (const [hash, valueList] of Object.entries(this.entries)) {
      yield {
        hash,
        valueList
      };
    }
  }

  async *iterHashes() {
    for (const hash of Object.keys(this.entries)) {
      yield hash;
    }
  }

  async *iterValueLists() {
    for (const valueList of Object.values(this.entries)) {
      yield valueList;
    }
  }

  async getValueList(hash) {
    return this.entries[hash] || [];
  }

  async addValue(hash, value) {
    // TODO: add some kind of warning if this is getting big?
    this.entries[hash] = await this.getValueList(hash);

    if (this.entries[hash].indexOf(value) === -1) {
      this.entries[hash].push(value);
    }
  }

}



var INDEXES = /*#__PURE__*/Object.freeze({
  InMemoryIndex: InMemoryIndex
});

let NEXT_CLASS_ID = 1;

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader, localStorage) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set mure.debug to true to debug streams
    // extensions that we want datalib to handle

    this.DATALIB_FORMATS = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv',
      'topojson': 'topojson',
      'treejson': 'treejson'
    }; // Access to core classes via the main library helps avoid circular imports

    this.TOKENS = TOKENS;
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;
    this.INDEXES = INDEXES; // Monkey-patch available tokens as functions onto the Stream class

    for (const tokenClassName in this.TOKENS) {
      const TokenClass = this.TOKENS[tokenClassName];

      Stream.prototype[TokenClass.lowerCamelCaseType] = function (argList, options) {
        return this.extend(TokenClass, argList, options);
      };
    } // Default named functions


    this.NAMED_FUNCTIONS = {
      identity: function* (wrappedItem) {
        yield wrappedItem.rawItem;
      },
      key: function* (wrappedItem) {
        if (!wrappedItem.wrappedParent || !wrappedItem.wrappedParent.wrappedParent || typeof wrappedItem.wrappedParent.wrappedParent.rawItem !== 'object') {
          throw new TypeError(`Grandparent is not an object / array`);
        }

        const parentType = typeof wrappedItem.wrappedParent.rawItem;

        if (!(parentType === 'number' || parentType === 'string')) {
          throw new TypeError(`Parent isn't a key / index`);
        } else {
          yield wrappedItem.wrappedParent.rawItem;
        }
      },
      defaultFinish: function* (thisWrappedItem, otherWrappedItem) {
        yield {
          left: thisWrappedItem.rawItem,
          right: otherWrappedItem.rawItem
        };
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    }; // Object containing each of our data sources

    this.root = this.loadRoot(); // Object containing our class specifications

    this.classes = this.loadClasses();
  }

  loadRoot() {
    let root = this.localStorage && this.localStorage.getItem('mure_root');
    root = root ? JSON.parse(root) : {};
    return root;
  }

  async saveRoot() {
    if (this.localStorage) {
      this.localStorage.setItem('mure_root', JSON.stringify(this.root));
    }

    this.trigger('rootUpdate');
  }

  loadClasses() {
    let classes = this.localStorage && this.localStorage.getItem('mure_classes');
    classes = classes ? JSON.parse(classes) : {};
    Object.entries(classes).forEach(([classId, rawClassObj]) => {
      Object.entries(rawClassObj.indexes).forEach(([funcName, rawIndexObj]) => {
        rawClassObj.indexes[funcName] = new this.INDEXES.InMemoryIndex({
          entries: rawIndexObj,
          complete: true
        });
      });
      const classType = rawClassObj.classType;
      delete rawClassObj.classType;
      rawClassObj.mure = this;
      classes[classId] = new this.CLASSES[classType](rawClassObj);
    });
    return classes;
  }

  async saveClasses() {
    if (this.localStorage) {
      const rawClasses = {};
      await Promise.all(Object.entries(this.classes).map(async ([classId, classObj]) => {
        rawClasses[classId] = await classObj.toRawObject();
      }));
      this.localStorage.setItem('mure_classes', JSON.stringify(rawClasses));
    }

    this.trigger('classUpdate');
  }

  parseSelector(selectorString) {
    const startsWithRoot = selectorString.startsWith('root');

    if (!(startsWithRoot || selectorString.startsWith('empty'))) {
      throw new SyntaxError(`Selectors must start with 'root' or 'empty'`);
    }

    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);

    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }

    const tokenClassList = [{
      TokenClass: startsWithRoot ? this.TOKENS.RootToken : this.TOKENS.EmptyToken
    }];
    tokenStrings.forEach(chunk => {
      const temp = chunk.match(/^.([^(]*)\(([^)]*)\)/);

      if (!temp) {
        throw new SyntaxError(`Invalid token: ${chunk}`);
      }

      const tokenClassName = temp[1][0].toUpperCase() + temp[1].slice(1) + 'Token';
      const argList = temp[2].split(/(?<!\\),/).map(d => {
        d = d.trim();
        return d === '' ? undefined : d;
      });

      if (tokenClassName === 'ValuesToken') {
        tokenClassList.push({
          TokenClass: this.TOKENS.KeysToken,
          argList
        });
        tokenClassList.push({
          TokenClass: this.TOKENS.ValueToken
        });
      } else if (this.TOKENS[tokenClassName]) {
        tokenClassList.push({
          TokenClass: this.TOKENS[tokenClassName],
          argList
        });
      } else {
        throw new SyntaxError(`Unknown token: ${temp[1]}`);
      }
    });
    return tokenClassList;
  }

  stream(options) {
    options.mure = this;
    options.tokenClassList = this.parseSelector(options.selector || `root.values()`);
    return new Stream(options);
  }

  async newClass(options = {
    selector: `root`
  }) {
    options.classId = `class${NEXT_CLASS_ID}`;
    NEXT_CLASS_ID += 1;
    const ClassType = options.ClassType || this.CLASSES.GenericClass;
    delete options.ClassType;
    options.mure = this;
    this.classes[options.classId] = new ClassType(options);
    await this.saveClasses();
    return this.classes[options.classId];
  }

  async addFileAsStaticDataSource({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    const fileMB = fileObj.size / 1048576;

    if (fileMB >= 30) {
      if (skipSizeCheck) {
        console.warn(`Attempting to load ${fileMB}MB file into memory`);
      } else {
        throw new Error(`${fileMB}MB file is too large to load statically; try addDynamicDataSource() instead.`);
      }
    } // extensionOverride allows things like topojson or treejson (that don't
    // have standardized mimeTypes) to be parsed correctly


    let text = await new Promise((resolve, reject) => {
      let reader = new this.FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.readAsText(fileObj, encoding);
    });
    return this.addStringAsStaticDataSource({
      key: fileObj.name,
      extension: extensionOverride || mime.extension(fileObj.type),
      text
    });
  }

  async addStringAsStaticDataSource({
    key,
    extension = 'txt',
    text
  }) {
    let obj;

    if (this.DATALIB_FORMATS[extension]) {
      obj = datalib.read(text, {
        type: extension
      });

      if (extension === 'csv' || extension === 'tsv') {
        delete obj.columns;
      }
    } else if (extension === 'xml') {
      throw new Error('unimplemented');
    } else if (extension === 'txt') {
      throw new Error('unimplemented');
    } else {
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    return this.addStaticDataSource(key, obj);
  }

  async addStaticDataSource(key, obj) {
    this.root[key] = obj;
    const temp = await Promise.all([this.saveRoot(), this.newClass({
      selector: `root.values('${key}').values()`
    })]);
    return temp[1];
  }

  async removeDataSource(key) {
    delete this.root[key];
    await this.saveRoot();
  }

}

var name = "mure";
var version = "0.4.8r3";
var description = "A library for flexible graph reshaping";
var main = "dist/mure.cjs.js";
var module$1 = "dist/mure.esm.js";
var browser = "dist/mure.umd.js";
var scripts = {
	build: "rollup -c --environment TARGET:all",
	watch: "rollup -c -w",
	watchcjs: "rollup -c -w --environment TARGET:cjs",
	watchumd: "rollup -c -w --environment TARGET:umd",
	watchesm: "rollup -c -w --environment TARGET:esm",
	test: "jest --runInBand",
	pretest: "rollup -c --environment TARGET:cjs",
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t",
	coveralls: "cat ./coverage/lcov.info | node node_modules/.bin/coveralls"
};
var files = [
	"dist"
];
var repository = {
	type: "git",
	url: "git+https://github.com/mure-apps/mure-library.git"
};
var author = "Alex Bigelow";
var license = "MIT";
var bugs = {
	url: "https://github.com/mure-apps/mure-library/issues"
};
var homepage = "https://github.com/mure-apps/mure-library#readme";
var devDependencies = {
	"@babel/core": "^7.0.0",
	"@babel/preset-env": "^7.0.0",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.4.2",
	coveralls: "^3.0.2",
	filereader: "^0.10.3",
	jest: "^23.5.0",
	rollup: "^0.65.0",
	"rollup-plugin-babel": "^4.0.2",
	"rollup-plugin-commonjs": "^9.1.6",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.2.1",
	"rollup-plugin-node-resolve": "^3.3.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
	"mime-types": "^2.1.20",
	sha1: "^1.1.1"
};
var peerDependencies = {
	d3: "^5.4.0"
};
var pkg = {
	name: name,
	version: version,
	description: description,
	main: main,
	module: module$1,
	"jsnext:main": "dist/mure.esm.js",
	browser: browser,
	scripts: scripts,
	files: files,
	repository: repository,
	author: author,
	license: license,
	bugs: bugs,
	homepage: homepage,
	devDependencies: devDependencies,
	dependencies: dependencies,
	peerDependencies: peerDependencies
};

let mure = new Mure(window.FileReader, window.localStorage);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIFN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy5uYW1lZFN0cmVhbXMgPSBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fTtcbiAgICB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCBudWxsO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgICB0aGlzLnRva2VuQ2xhc3NMaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdCB8fCBbXTtcblxuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy5uYW1lZEZ1bmN0aW9uc1xuICAgIC8vIGFuZCB0aGlzLm5hbWVkU3RyZWFtc1xuICAgIHRoaXMudG9rZW5MaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdC5tYXAoKHsgVG9rZW5DbGFzcywgYXJnTGlzdCB9KSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFRva2VuQ2xhc3ModGhpcywgYXJnTGlzdCk7XG4gICAgfSk7XG4gICAgLy8gUmVtaW5kZXI6IHRoaXMgYWx3YXlzIG5lZWRzIHRvIGJlIGFmdGVyIGluaXRpYWxpemluZyB0aGlzLnRva2VuTGlzdFxuICAgIHRoaXMuV3JhcHBlcnMgPSB0aGlzLmdldFdyYXBwZXJMaXN0KCk7XG4gIH1cblxuICBnZXRXcmFwcGVyTGlzdCAoKSB7XG4gICAgLy8gTG9vayB1cCB3aGljaCwgaWYgYW55LCBjbGFzc2VzIGRlc2NyaWJlIHRoZSByZXN1bHQgb2YgZWFjaCB0b2tlbiwgc28gdGhhdFxuICAgIC8vIHdlIGNhbiB3cmFwIGl0ZW1zIGFwcHJvcHJpYXRlbHk6XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0Lm1hcCgodG9rZW4sIGluZGV4KSA9PiB7XG4gICAgICBpZiAoaW5kZXggPT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEgJiYgdGhpcy5sYXVuY2hlZEZyb21DbGFzcykge1xuICAgICAgICAvLyBJZiB0aGlzIHN0cmVhbSB3YXMgc3RhcnRlZCBmcm9tIGEgY2xhc3MsIHdlIGFscmVhZHkga25vdyB3ZSBzaG91bGRcbiAgICAgICAgLy8gdXNlIHRoYXQgY2xhc3MncyB3cmFwcGVyIGZvciB0aGUgbGFzdCB0b2tlblxuICAgICAgICByZXR1cm4gdGhpcy5sYXVuY2hlZEZyb21DbGFzcy5XcmFwcGVyO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBhIGNsYXNzIHRoYXQgZGVzY3JpYmVzIGV4YWN0bHkgZWFjaCBzZXJpZXMgb2YgdG9rZW5zXG4gICAgICBjb25zdCBsb2NhbFRva2VuTGlzdCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIGluZGV4ICsgMSk7XG4gICAgICBjb25zdCBwb3RlbnRpYWxXcmFwcGVycyA9IE9iamVjdC52YWx1ZXModGhpcy5tdXJlLmNsYXNzZXMpXG4gICAgICAgIC5maWx0ZXIoY2xhc3NPYmogPT4ge1xuICAgICAgICAgIGNvbnN0IGNsYXNzVG9rZW5MaXN0ID0gY2xhc3NPYmoudG9rZW5DbGFzc0xpc3Q7XG4gICAgICAgICAgaWYgKCFjbGFzc1Rva2VuTGlzdC5sZW5ndGggIT09IGxvY2FsVG9rZW5MaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbkxpc3QuZXZlcnkoKGxvY2FsVG9rZW4sIGxvY2FsSW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuQ2xhc3NTcGVjID0gY2xhc3NUb2tlbkxpc3RbbG9jYWxJbmRleF07XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbiBpbnN0YW5jZW9mIHRva2VuQ2xhc3NTcGVjLlRva2VuQ2xhc3MgJiZcbiAgICAgICAgICAgICAgdG9rZW4uaXNTdWJzZXRPZih0b2tlbkNsYXNzU3BlYy5hcmdMaXN0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIE5vIGNsYXNzZXMgZGVzY3JpYmUgdGhpcyBzZXJpZXMgb2YgdG9rZW5zLCBzbyB1c2UgdGhlIGdlbmVyaWMgd3JhcHBlclxuICAgICAgICByZXR1cm4gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYE11bHRpcGxlIGNsYXNzZXMgZGVzY3JpYmUgdGhlIHNhbWUgaXRlbSEgQXJiaXRyYXJpbHkgY2hvb3Npbmcgb25lLi4uYCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBvdGVudGlhbFdyYXBwZXJzWzBdLldyYXBwZXI7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5qb2luKCcnKTtcbiAgfVxuXG4gIGZvcmsgKHNlbGVjdG9yKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0oe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgbmFtZWRGdW5jdGlvbnM6IHRoaXMubmFtZWRGdW5jdGlvbnMsXG4gICAgICBuYW1lZFN0cmVhbXM6IHRoaXMubmFtZWRTdHJlYW1zLFxuICAgICAgdG9rZW5DbGFzc0xpc3Q6IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKHNlbGVjdG9yKSxcbiAgICAgIGxhdW5jaGVkRnJvbUNsYXNzOiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzLFxuICAgICAgaW5kZXhlczogdGhpcy5pbmRleGVzXG4gICAgfSk7XG4gIH1cblxuICBleHRlbmQgKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICBvcHRpb25zLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZEZ1bmN0aW9ucywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkU3RyZWFtcywgb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge30pO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0LmNvbmNhdChbeyBUb2tlbkNsYXNzLCBhcmdMaXN0IH1dKTtcbiAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzO1xuICAgIG9wdGlvbnMuaW5kZXhlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaW5kZXhlcywgb3B0aW9ucy5pbmRleGVzIHx8IHt9KTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0sIGhhc2hlcyA9IHt9IH0pIHtcbiAgICBsZXQgd3JhcHBlckluZGV4ID0gMDtcbiAgICBsZXQgdGVtcCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgd2hpbGUgKHRlbXAgIT09IG51bGwpIHtcbiAgICAgIHdyYXBwZXJJbmRleCArPSAxO1xuICAgICAgdGVtcCA9IHRlbXAud3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBuZXcgdGhpcy5XcmFwcGVyc1t3cmFwcGVySW5kZXhdKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXMoaGFzaGVzKS5yZWR1Y2UoKHByb21pc2VMaXN0LCBbaGFzaEZ1bmN0aW9uTmFtZSwgaGFzaF0pID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJbmRleChoYXNoRnVuY3Rpb25OYW1lKTtcbiAgICAgIGlmICghaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgcmV0dXJuIHByb21pc2VMaXN0LmNvbmNhdChbIGluZGV4LmFkZFZhbHVlKGhhc2gsIHdyYXBwZWRJdGVtKSBdKTtcbiAgICAgIH1cbiAgICB9LCBbXSkpO1xuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuXG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgbGFzdFRva2VuID0gdGhpcy50b2tlbkxpc3RbdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEpO1xuICAgIHlpZWxkICogYXdhaXQgbGFzdFRva2VuLml0ZXJhdGUodGVtcCk7XG4gIH1cblxuICBnZXRJbmRleCAoaGFzaEZ1bmN0aW9uTmFtZSkge1xuICAgIGlmICghdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdKSB7XG4gICAgICAvLyBUT0RPOiBpZiB1c2luZyBub2RlLmpzLCBzdGFydCB3aXRoIGV4dGVybmFsIC8gbW9yZSBzY2FsYWJsZSBpbmRleGVzXG4gICAgICB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV0gPSBuZXcgdGhpcy5tdXJlLklOREVYRVMuSW5NZW1vcnlJbmRleCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdO1xuICB9XG5cbiAgYXN5bmMgYnVpbGRJbmRleCAoaGFzaEZ1bmN0aW9uTmFtZSkge1xuICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMubmFtZWRGdW5jdGlvbnNbaGFzaEZ1bmN0aW9uTmFtZV07XG4gICAgaWYgKCFoYXNoRnVuY3Rpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtoYXNoRnVuY3Rpb25OYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXgoaGFzaEZ1bmN0aW9uTmFtZSk7XG4gICAgaWYgKGluZGV4LmNvbXBsZXRlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKCkpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBoYXNoRnVuY3Rpb24od3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgIGluZGV4LmFkZFZhbHVlKGhhc2gsIHdyYXBwZWRJdGVtKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaW5kZXguY29tcGxldGUgPSB0cnVlO1xuICB9XG5cbiAgYXN5bmMgKiBzYW1wbGUgKHsgbGltaXQgPSAxMCwgcmVidWlsZEluZGV4ZXMgPSBmYWxzZSB9KSB7XG4gICAgLy8gQmVmb3JlIHdlIHN0YXJ0LCBjbGVhbiBvdXQgYW55IG9sZCBpbmRleGVzIHRoYXQgd2VyZSBuZXZlciBmaW5pc2hlZFxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuaW5kZXhlcykuZm9yRWFjaCgoW2hhc2hGdW5jdGlvbk5hbWUsIGluZGV4XSkgPT4ge1xuICAgICAgaWYgKHJlYnVpbGRJbmRleGVzIHx8ICFpbmRleC5jb21wbGV0ZSkge1xuICAgICAgICBkZWxldGUgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAvLyBXZSBhY3R1YWxseSBmaW5pc2hlZCBhIGZ1bGwgcGFzczsgZmxhZyBhbGwgb2Ygb3VyIGluZGV4ZXMgYXMgY29tcGxldGVcbiAgICAgICAgT2JqZWN0LnZhbHVlcyh0aGlzLmluZGV4ZXMpLmZvckVhY2goaW5kZXggPT4ge1xuICAgICAgICAgIGluZGV4LmNvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbTtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBCYXNlVG9rZW4gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICAvLyBUaGUgc3RyaW5nIHZlcnNpb24gb2YgbW9zdCB0b2tlbnMgY2FuIGp1c3QgYmUgZGVyaXZlZCBmcm9tIHRoZSBjbGFzcyB0eXBlXG4gICAgcmV0dXJuIGAuJHt0aGlzLnR5cGUudG9Mb3dlckNhc2UoKX0oKWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoKSB7XG4gICAgLy8gQnkgZGVmYXVsdCAod2l0aG91dCBhbnkgYXJndW1lbnRzKSwgdG9rZW5zIG9mIHRoZSBzYW1lIGNsYXNzIGFyZSBzdWJzZXRzXG4gICAgLy8gb2YgZWFjaCBvdGhlclxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVQYXJlbnQgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3QgcGFyZW50VG9rZW4gPSBhbmNlc3RvclRva2Vuc1thbmNlc3RvclRva2Vucy5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0ZW1wID0gYW5jZXN0b3JUb2tlbnMuc2xpY2UoMCwgYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMSk7XG4gICAgbGV0IHlpZWxkZWRTb21ldGhpbmcgPSBmYWxzZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VG9rZW4uaXRlcmF0ZSh0ZW1wKSkge1xuICAgICAgeWllbGRlZFNvbWV0aGluZyA9IHRydWU7XG4gICAgICB5aWVsZCB3cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBpZiAoIXlpZWxkZWRTb21ldGhpbmcgJiYgdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVG9rZW4geWllbGRlZCBubyByZXN1bHRzOiAke3BhcmVudFRva2VufWApO1xuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRW1wdHlUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgLy8geWllbGQgbm90aGluZ1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYGVtcHR5YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRW1wdHlUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBSb290VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudDogbnVsbCxcbiAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgcmF3SXRlbTogdGhpcy5zdHJlYW0ubXVyZS5yb290XG4gICAgfSk7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgcm9vdGA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFJvb3RUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBLZXlzVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBhcmdMaXN0LCB7IG1hdGNoQWxsLCBrZXlzLCByYW5nZXMgfSA9IHt9KSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoa2V5cyB8fCByYW5nZXMpIHtcbiAgICAgIHRoaXMua2V5cyA9IGtleXM7XG4gICAgICB0aGlzLnJhbmdlcyA9IHJhbmdlcztcbiAgICB9IGVsc2UgaWYgKChhcmdMaXN0ICYmIGFyZ0xpc3QubGVuZ3RoID09PSAxICYmIGFyZ0xpc3RbMF0gPT09IHVuZGVmaW5lZCkgfHwgbWF0Y2hBbGwpIHtcbiAgICAgIHRoaXMubWF0Y2hBbGwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdMaXN0LmZvckVhY2goYXJnID0+IHtcbiAgICAgICAgbGV0IHRlbXAgPSBhcmcubWF0Y2goLyhcXGQrKS0oW1xcZOKInl0rKS8pO1xuICAgICAgICBpZiAodGVtcCAmJiB0ZW1wWzJdID09PSAn4oieJykge1xuICAgICAgICAgIHRlbXBbMl0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gdGVtcCA/IHRlbXAubWFwKGQgPT4gZC5wYXJzZUludChkKSkgOiBudWxsO1xuICAgICAgICBpZiAodGVtcCAmJiAhaXNOYU4odGVtcFsxXSkgJiYgIWlzTmFOKHRlbXBbMl0pKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IHRlbXBbMV07IGkgPD0gdGVtcFsyXTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogdGVtcFsxXSwgaGlnaDogdGVtcFsyXSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSBhcmcubWF0Y2goLycoLiopJy8pO1xuICAgICAgICB0ZW1wID0gdGVtcCAmJiB0ZW1wWzFdID8gdGVtcFsxXSA6IGFyZztcbiAgICAgICAgbGV0IG51bSA9IE51bWJlcih0ZW1wKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bSkgfHwgbnVtICE9PSBwYXJzZUludCh0ZW1wKSkgeyAvLyBsZWF2ZSBub24taW50ZWdlciBudW1iZXJzIGFzIHN0cmluZ3NcbiAgICAgICAgICB0aGlzLmtleXMgPSB0aGlzLmtleXMgfHwge307XG4gICAgICAgICAgdGhpcy5rZXlzW3RlbXBdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IG51bSwgaGlnaDogbnVtIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGlmICghdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEJhZCB0b2tlbiBrZXkocykgLyByYW5nZShzKTogJHtKU09OLnN0cmluZ2lmeShhcmdMaXN0KX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICB0aGlzLnJhbmdlcyA9IHRoaXMuY29uc29saWRhdGVSYW5nZXModGhpcy5yYW5nZXMpO1xuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0c05vdGhpbmcgKCkge1xuICAgIHJldHVybiAhdGhpcy5tYXRjaEFsbCAmJiAhdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcztcbiAgfVxuICBjb25zb2xpZGF0ZVJhbmdlcyAocmFuZ2VzKSB7XG4gICAgLy8gTWVyZ2UgYW55IG92ZXJsYXBwaW5nIHJhbmdlc1xuICAgIGNvbnN0IG5ld1JhbmdlcyA9IFtdO1xuICAgIGNvbnN0IHRlbXAgPSByYW5nZXMuc29ydCgoYSwgYikgPT4gYS5sb3cgLSBiLmxvdyk7XG4gICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWN1cnJlbnRSYW5nZSkge1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfSBlbHNlIGlmICh0ZW1wW2ldLmxvdyA8PSBjdXJyZW50UmFuZ2UuaGlnaCkge1xuICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IHRlbXBbaV0uaGlnaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAgIC8vIENvcm5lciBjYXNlOiBhZGQgdGhlIGxhc3QgcmFuZ2VcbiAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgfVxuICAgIHJldHVybiBuZXdSYW5nZXMubGVuZ3RoID4gMCA/IG5ld1JhbmdlcyA6IHVuZGVmaW5lZDtcbiAgfVxuICBkaWZmZXJlbmNlIChvdGhlclRva2VuKSB7XG4gICAgLy8gQ29tcHV0ZSB3aGF0IGlzIGxlZnQgb2YgdGhpcyBhZnRlciBzdWJ0cmFjdGluZyBvdXQgZXZlcnl0aGluZyBpbiBvdGhlclRva2VuXG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgY29tcHV0ZSB0aGUgZGlmZmVyZW5jZSBvZiB0d28gZGlmZmVyZW50IHRva2VuIHR5cGVzYCk7XG4gICAgfSBlbHNlIGlmIChvdGhlclRva2VuLm1hdGNoQWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGNvbnNvbGUud2FybihgSW5hY2N1cmF0ZSBkaWZmZXJlbmNlIGNvbXB1dGVkISBUT0RPOiBuZWVkIHRvIGZpZ3VyZSBvdXQgaG93IHRvIGludmVydCBjYXRlZ29yaWNhbCBrZXlzIWApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld0tleXMgPSB7fTtcbiAgICAgIGZvciAobGV0IGtleSBpbiAodGhpcy5rZXlzIHx8IHt9KSkge1xuICAgICAgICBpZiAoIW90aGVyVG9rZW4ua2V5cyB8fCAhb3RoZXJUb2tlbi5rZXlzW2tleV0pIHtcbiAgICAgICAgICBuZXdLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3UmFuZ2VzID0gW107XG4gICAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgICAgaWYgKG90aGVyVG9rZW4ucmFuZ2VzKSB7XG4gICAgICAgICAgbGV0IGFsbFBvaW50cyA9IHRoaXMucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICBhbGxQb2ludHMgPSBhbGxQb2ludHMuY29uY2F0KG90aGVyVG9rZW4ucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKSkuc29ydCgpO1xuICAgICAgICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0geyBsb3c6IGFsbFBvaW50c1tpXS52YWx1ZSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmV4Y2x1ZGUpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS5sb3cgLSAxO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmxvdyA9IGFsbFBvaW50c1tpXS5oaWdoICsgMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdSYW5nZXMgPSB0aGlzLnJhbmdlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBLZXlzVG9rZW4odGhpcy5tdXJlLCBudWxsLCB7IGtleXM6IG5ld0tleXMsIHJhbmdlczogbmV3UmFuZ2VzIH0pO1xuICAgIH1cbiAgfVxuICBpc1N1YlNldE9mIChhcmdMaXN0KSB7XG4gICAgY29uc3Qgb3RoZXJUb2tlbiA9IG5ldyBLZXlzVG9rZW4odGhpcy5zdHJlYW0sIGFyZ0xpc3QpO1xuICAgIGNvbnN0IGRpZmYgPSBvdGhlclRva2VuLmRpZmZlcmVuY2UodGhpcyk7XG4gICAgcmV0dXJuIGRpZmYgPT09IG51bGwgfHwgZGlmZi5zZWxlY3RzTm90aGluZztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHsgcmV0dXJuICcua2V5cygpJzsgfVxuICAgIHJldHVybiAnLmtleXMoJyArICh0aGlzLnJhbmdlcyB8fCBbXSkubWFwKCh7bG93LCBoaWdofSkgPT4ge1xuICAgICAgcmV0dXJuIGxvdyA9PT0gaGlnaCA/IGxvdyA6IGAke2xvd30tJHtoaWdofWA7XG4gICAgfSkuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMua2V5cyB8fCB7fSkubWFwKGtleSA9PiBgJyR7a2V5fSdgKSlcbiAgICAgIC5qb2luKCcsJykgKyAnKSc7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgICAgZm9yIChsZXQga2V5IGluIHdyYXBwZWRQYXJlbnQucmF3SXRlbSkge1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgICAgbG93ID0gTWF0aC5tYXgoMCwgbG93KTtcbiAgICAgICAgICBoaWdoID0gTWF0aC5taW4od3JhcHBlZFBhcmVudC5yYXdJdGVtLmxlbmd0aCAtIDEsIGhpZ2gpO1xuICAgICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICByYXdJdGVtOiBpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gdGhpcy5rZXlzIHx8IHt9KSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgY29uc3Qgb2JqID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgIGNvbnN0IGtleVR5cGUgPSB0eXBlb2Yga2V5O1xuICAgICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IChrZXlUeXBlICE9PSAnc3RyaW5nJyAmJiBrZXlUeXBlICE9PSAnbnVtYmVyJykpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVmFsdWVUb2tlbiB1c2VkIG9uIGEgbm9uLW9iamVjdCwgb3Igd2l0aG91dCBhIHN0cmluZyAvIG51bWVyaWMga2V5YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgcmF3SXRlbTogb2JqW2tleV1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVmFsdWVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFdmFsdWF0ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gRXZhbHVhdGVUb2tlbiBpcyBub3QgYSBzdHJpbmdgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1N0cmVhbTtcbiAgICAgIHRyeSB7XG4gICAgICAgIG5ld1N0cmVhbSA9IHRoaXMuc3RyZWFtLmZvcmsod3JhcHBlZFBhcmVudC5yYXdJdGVtKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcgfHwgIShlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikpIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkICogYXdhaXQgbmV3U3RyZWFtLml0ZXJhdGUoKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZ2VuZXJhdG9yXSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2dlbmVyYXRvcn1gKTtcbiAgICB9XG4gICAgdGhpcy5nZW5lcmF0b3IgPSBnZW5lcmF0b3I7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLm1hcCgke3RoaXMuZ2VuZXJhdG9yfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvciA9PT0gdGhpcy5nZW5lcmF0b3I7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5nZW5lcmF0b3JdKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgbWFwLCBoYXNoLCByZWR1Y2VJbnN0YW5jZXMgXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLnByb21vdGUoJHt0aGlzLm1hcH0sICR7dGhpcy5oYXNofSwgJHt0aGlzLnJlZHVjZUluc3RhbmNlc30pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwID09PSBtYXAgJiZcbiAgICAgIHRoaXMuaGFzaCA9PT0gaGFzaCAmJlxuICAgICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPT09IHJlZHVjZUluc3RhbmNlcztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG1hcEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5tYXBdO1xuICAgICAgY29uc3QgaGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5oYXNoXTtcbiAgICAgIGNvbnN0IHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5yZWR1Y2VJbnN0YW5jZXNdO1xuICAgICAgY29uc3QgaGFzaEluZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy5oYXNoKTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiBtYXBGdW5jdGlvbih3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICBjb25zdCBoYXNoID0gaGFzaEZ1bmN0aW9uKG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICBsZXQgb3JpZ2luYWxXcmFwcGVkSXRlbSA9IChhd2FpdCBoYXNoSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpKVswXTtcbiAgICAgICAgaWYgKG9yaWdpbmFsV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWR1Y2VJbnN0YW5jZXMgIT09ICdub29wJykge1xuICAgICAgICAgICAgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24ob3JpZ2luYWxXcmFwcGVkSXRlbSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBoYXNoZXMgPSB7fTtcbiAgICAgICAgICBoYXNoZXNbdGhpcy5oYXNoXSA9IGhhc2g7XG4gICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtLFxuICAgICAgICAgICAgaGFzaGVzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEpvaW5Ub2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnZGVmYXVsdEZpbmlzaCcsIGVkZ2VSb2xlID0gJ25vbmUnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIHRoaXNIYXNoLCBmaW5pc2ggXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgdGVtcCA9IHN0cmVhbS5uYW1lZFN0cmVhbXNbb3RoZXJTdHJlYW1dO1xuICAgIGlmICghdGVtcCkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIHN0cmVhbTogJHtvdGhlclN0cmVhbX1gKTtcbiAgICB9XG4gICAgLy8gUmVxdWlyZSBvdGhlckhhc2ggb24gdGhlIG90aGVyIHN0cmVhbSwgb3IgY29weSBvdXJzIG92ZXIgaWYgaXQgaXNuJ3RcbiAgICAvLyBhbHJlYWR5IGRlZmluZWRcbiAgICBpZiAoIXRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gaGFzaCBmdW5jdGlvbiBvbiBlaXRoZXIgc3RyZWFtOiAke290aGVySGFzaH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSA9IHN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMub3RoZXJTdHJlYW0gPSBvdGhlclN0cmVhbTtcbiAgICB0aGlzLnRoaXNIYXNoID0gdGhpc0hhc2g7XG4gICAgdGhpcy5vdGhlckhhc2ggPSBvdGhlckhhc2g7XG4gICAgdGhpcy5maW5pc2ggPSBmaW5pc2g7XG4gICAgdGhpcy5lZGdlUm9sZSA9IGVkZ2VSb2xlO1xuICAgIHRoaXMuaGFzaFRoaXNHcmFuZHBhcmVudCA9IGVkZ2VSb2xlID09PSAnZnVsbCc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLmpvaW4oJHt0aGlzLm90aGVyU3RyZWFtfSwgJHt0aGlzLnRoaXNIYXNofSwgJHt0aGlzLm90aGVySGFzaH0sICR7dGhpcy5maW5pc2h9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBvdGhlclN0cmVhbSwgdGhpc0hhc2ggPSAna2V5Jywgb3RoZXJIYXNoID0gJ2tleScsIGZpbmlzaCA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiB0aGlzLm90aGVyU3RyZWFtID09PSBvdGhlclN0cmVhbSAmJlxuICAgICAgdGhpcy50aGlzSGFzaCA9PT0gdGhpc0hhc2ggJiZcbiAgICAgIHRoaXMub3RoZXJIYXNoID09PSBvdGhlckhhc2ggJiZcbiAgICAgIHRoaXMuZmluaXNoID09PSBmaW5pc2g7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IG90aGVyU3RyZWFtID0gdGhpcy5zdHJlYW0ubmFtZWRTdHJlYW1zW3RoaXMub3RoZXJTdHJlYW1dO1xuICAgIGNvbnN0IHRoaXNIYXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLnRoaXNIYXNoXTtcbiAgICBjb25zdCBvdGhlckhhc2hGdW5jdGlvbiA9IG90aGVyU3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMub3RoZXJIYXNoXTtcbiAgICBjb25zdCBmaW5pc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZmluaXNoXTtcblxuICAgIC8vIGNvbnN0IHRoaXNJdGVyYXRvciA9IHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2Vucyk7XG4gICAgLy8gY29uc3Qgb3RoZXJJdGVyYXRvciA9IG90aGVyU3RyZWFtLml0ZXJhdGUoKTtcblxuICAgIGNvbnN0IHRoaXNJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMudGhpc0hhc2gpO1xuICAgIGNvbnN0IG90aGVySW5kZXggPSBvdGhlclN0cmVhbS5nZXRJbmRleCh0aGlzLm90aGVySGFzaCk7XG5cbiAgICBpZiAodGhpc0luZGV4LmNvbXBsZXRlKSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBCZXN0IG9mIGFsbCB3b3JsZHM7IHdlIGNhbiBqdXN0IGpvaW4gdGhlIGluZGV4ZXNcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IGhhc2gsIHZhbHVlTGlzdCB9IG9mIHRoaXNJbmRleC5pdGVyRW50cmllcygpKSB7XG4gICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdmFsdWVMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIHRoZSBvdGhlciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIG91ciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJTdHJlYW0uaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIG90aGVySGFzaEZ1bmN0aW9uKG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBBZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4OlxuICAgICAgICAgICAgYXdhaXQgb3RoZXJJbmRleC5hZGRWYWx1ZShoYXNoLCBvdGhlcldyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgb3VyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2YgdGhlIG90aGVyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgICAgICAvLyBPZGQgY29ybmVyIGNhc2UgZm9yIGVkZ2VzOyBzb21ldGltZXMgd2Ugd2FudCB0byBoYXNoIHRoZSBncmFuZHBhcmVudCBpbnN0ZWFkIG9mIHRoZSByZXN1bHQgb2ZcbiAgICAgICAgICAvLyBhbiBpbnRlcm1lZGlhdGUgam9pbjpcbiAgICAgICAgICBjb25zdCB0aGlzSGFzaEl0ZW0gPSB0aGlzLmhhc2hUaGlzR3JhbmRwYXJlbnQgPyB0aGlzV3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCA6IHRoaXNXcmFwcGVkSXRlbTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzSGFzaEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgYXdhaXQgdGhpc0luZGV4LmFkZFZhbHVlKGhhc2gsIHRoaXNIYXNoSXRlbSk7XG4gICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWl0aGVyIHN0cmVhbSBpcyBmdWxseSBpbmRleGVkOyBmb3IgbW9yZSBkaXN0cmlidXRlZCBzYW1wbGluZywgZ3JhYlxuICAgICAgICAvLyBvbmUgaXRlbSBmcm9tIGVhY2ggc3RyZWFtIGF0IGEgdGltZSwgYW5kIHVzZSB0aGUgcGFydGlhbCBpbmRleGVzXG4gICAgICAgIGNvbnN0IHRoaXNJdGVyYXRvciA9IHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucywgdGhpcy50aGlzSW5kaXJlY3RLZXkpO1xuICAgICAgICBsZXQgdGhpc0lzRG9uZSA9IGZhbHNlO1xuICAgICAgICBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuICAgICAgICBsZXQgb3RoZXJJc0RvbmUgPSBmYWxzZTtcblxuICAgICAgICB3aGlsZSAoIXRoaXNJc0RvbmUgfHwgIW90aGVySXNEb25lKSB7XG4gICAgICAgICAgLy8gVGFrZSBvbmUgc2FtcGxlIGZyb20gdGhpcyBzdHJlYW1cbiAgICAgICAgICBsZXQgdGVtcCA9IGF3YWl0IHRoaXNJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgdGhpc0lzRG9uZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICAvLyBPZGQgY29ybmVyIGNhc2UgZm9yIGVkZ2VzOyBzb21ldGltZXMgd2Ugd2FudCB0byBoYXNoIHRoZSBncmFuZHBhcmVudCBpbnN0ZWFkIG9mIHRoZSByZXN1bHQgb2ZcbiAgICAgICAgICAgIC8vIGFuIGludGVybWVkaWF0ZSBqb2luOlxuICAgICAgICAgICAgY29uc3QgdGhpc0hhc2hJdGVtID0gdGhpcy5oYXNoVGhpc0dyYW5kcGFyZW50ID8gdGhpc1dyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgOiB0aGlzV3JhcHBlZEl0ZW07XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzSGFzaEl0ZW0pKSB7XG4gICAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICAgIHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzSGFzaEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm93IGZvciBhIHNhbXBsZSBmcm9tIHRoZSBvdGhlciBzdHJlYW1cbiAgICAgICAgICB0ZW1wID0gYXdhaXQgb3RoZXJJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgb3RoZXJJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBvdGhlcldyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4XG4gICAgICAgICAgICAgIG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBKb2luVG9rZW47XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi4vU3RyZWFtLmpzJztcblxuY29uc3QgQVNURVJJU0tTID0ge1xuICAnZXZhbHVhdGUnOiAn4oasJyxcbiAgJ2pvaW4nOiAn4qivJyxcbiAgJ21hcCc6ICfihqYnLFxuICAncHJvbW90ZSc6ICfihpEnLFxuICAndmFsdWUnOiAn4oaSJ1xufTtcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLl9zZWxlY3RvciA9IG9wdGlvbnMuc2VsZWN0b3I7XG4gICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSBvcHRpb25zLmN1c3RvbUNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPSBvcHRpb25zLmN1c3RvbU5hbWVUb2tlbkluZGV4IHx8IG51bGw7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIGlmICh0eXBlb2YgZnVuYyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBuZXcgRnVuY3Rpb24oYHJldHVybiAke2Z1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLl9zZWxlY3RvcjtcbiAgfVxuICBnZXQgdG9rZW5DbGFzc0xpc3QgKCkge1xuICAgIHJldHVybiB0aGlzLm11cmUucGFyc2VTZWxlY3Rvcih0aGlzLnNlbGVjdG9yKTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NUeXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBzZWxlY3RvcjogdGhpcy5fc2VsZWN0b3IsXG4gICAgICBjdXN0b21DbGFzc05hbWU6IHRoaXMuY3VzdG9tQ2xhc3NOYW1lLFxuICAgICAgY3VzdG9tTmFtZVRva2VuSW5kZXg6IHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXgsXG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBpbmRleGVzOiB7fSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB7fVxuICAgIH07XG4gICAgZm9yIChsZXQgW2Z1bmNOYW1lLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm5hbWVkRnVuY3Rpb25zKSkge1xuICAgICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgICAgcmVzdWx0Lm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IHN0cmluZ2lmaWVkRnVuYztcbiAgICB9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXModGhpcy5pbmRleGVzKS5tYXAoYXN5bmMgKFtmdW5jTmFtZSwgaW5kZXhdKSA9PiB7XG4gICAgICBpZiAoaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgcmVzdWx0LmluZGV4ZXNbZnVuY05hbWVdID0gYXdhaXQgaW5kZXgudG9SYXdPYmplY3QoKTtcbiAgICAgIH1cbiAgICB9KSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSB2YWx1ZSkge1xuICAgICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSB2YWx1ZTtcbiAgICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPSB0aGlzLnNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKS5sZW5ndGg7XG4gICAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICB9XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gbnVsbCAmJlxuICAgICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9PT0gdGhpcy5zZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZykubGVuZ3RoO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIGNvbnN0IHNlbGVjdG9yID0gdGhpcy5zZWxlY3RvcjtcbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgIGZvciAobGV0IGkgPSB0b2tlblN0cmluZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmICh0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gbnVsbCAmJiBpIDw9IHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VzdG9tQ2xhc3NOYW1lICsgcmVzdWx0O1xuICAgICAgfVxuICAgICAgY29uc3QgdGVtcCA9IHRva2VuU3RyaW5nc1tpXS5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKHRlbXBbMV0gPT09ICdrZXlzJyB8fCB0ZW1wWzFdID09PSAndmFsdWVzJykge1xuICAgICAgICBpZiAodGVtcFsyXSA9PT0gJycpIHtcbiAgICAgICAgICByZXN1bHQgPSAnKicgKyByZXN1bHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0ID0gdGVtcFsyXS5yZXBsYWNlKC8nKFteJ10qKScvLCAnJDEnKSArIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gQVNURVJJU0tTW3RlbXBbMV1dICsgcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gKHNlbGVjdG9yLnN0YXJ0c1dpdGgoJ2VtcHR5JykgPyAn4oiFJyA6ICcnKSArIHJlc3VsdDtcbiAgfVxuICBhZGRIYXNoRnVuY3Rpb24gKGZ1bmNOYW1lLCBmdW5jKSB7XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBmdW5jO1xuICB9XG4gIHBvcHVsYXRlU3RyZWFtT3B0aW9ucyAob3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0O1xuICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSB0aGlzLm5hbWVkRnVuY3Rpb25zO1xuICAgIG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgPSB0aGlzO1xuICAgIG9wdGlvbnMuaW5kZXhlcyA9IHRoaXMuaW5kZXhlcztcbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfVxuICBnZXRTdHJlYW0gKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmIChvcHRpb25zLnJlc2V0IHx8ICF0aGlzLl9zdHJlYW0pIHtcbiAgICAgIHRoaXMuX3N0cmVhbSA9IG5ldyBTdHJlYW0odGhpcy5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucykpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtO1xuICB9XG4gIGlzU3VwZXJTZXRPZlRva2VuTGlzdCAodG9rZW5MaXN0KSB7XG4gICAgaWYgKHRva2VuTGlzdC5sZW5ndGggIT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QuZXZlcnkoKHRva2VuLCBpKSA9PiB0b2tlbi5pc1N1cGVyU2V0T2YodG9rZW5MaXN0W2ldKSk7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXSA9IG5ldyB0aGlzLm11cmUuQ0xBU1NFUy5Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXSA9IG5ldyB0aGlzLm11cmUuQ0xBU1NFUy5FZGdlQ2xhc3Mob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgYXN5bmMgYWdncmVnYXRlIChoYXNoLCByZWR1Y2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBleHBhbmQgKG1hcCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGZpbHRlciAoZmlsdGVyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgc3BsaXQgKGhhc2gpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcjtcbiAgICB0aGlzLmVkZ2VDb25uZWN0aW9ucyA9IG9wdGlvbnMuZWRnZUNvbm5lY3Rpb25zIHx8IHt9O1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICAvLyBUT0RPOiBhIGJhYmVsIGJ1ZyAoaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8zOTMwKVxuICAgIC8vIHByZXZlbnRzIGBhd2FpdCBzdXBlcmA7IHRoaXMgaXMgYSB3b3JrYXJvdW5kOlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEdlbmVyaWNDbGFzcy5wcm90b3R5cGUudG9SYXdPYmplY3QuY2FsbCh0aGlzKTtcbiAgICAvLyBUT0RPOiBuZWVkIHRvIGRlZXAgY29weSBlZGdlQ29ubmVjdGlvbnM/XG4gICAgcmVzdWx0LmVkZ2VDb25uZWN0aW9ucyA9IHRoaXMuZWRnZUNvbm5lY3Rpb25zO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBkaXJlY3RlZCwgdGhpc0hhc2hOYW1lLCBvdGhlckhhc2hOYW1lIH0pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBhd2FpdCB0aGlzLm11cmUubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IG51bGwsXG4gICAgICBDbGFzc1R5cGU6IHRoaXMubXVyZS5DTEFTU0VTLkVkZ2VDbGFzcyxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICBkaXJlY3RlZFxuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNvbm5lY3Rpb25zW2VkZ2VDbGFzcy5jbGFzc0lkXSA9IHsgbm9kZUhhc2hOYW1lOiB0aGlzSGFzaE5hbWUgfTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbZWRnZUNsYXNzLmNsYXNzSWRdID0geyBub2RlSGFzaE5hbWU6IG90aGVySGFzaE5hbWUgfTtcbiAgICBkZWxldGUgdGhpcy5fc3RyZWFtO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyBkZWxldGUgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ29ubmVjdGlvbnMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9IG51bGw7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIGF3YWl0IHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG5cbiAgICBpZiAoIXRoaXMuX3NlbGVjdG9yKSB7XG4gICAgICBpZiAoIXNvdXJjZUNsYXNzIHx8ICF0YXJnZXRDbGFzcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcnRpYWwgY29ubmVjdGlvbnMgd2l0aG91dCBhbiBlZGdlIHRhYmxlIHNob3VsZCBuZXZlciBoYXBwZW5gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vIGVkZ2UgdGFibGUgKHNpbXBsZSBqb2luIGJldHdlZW4gdHdvIG5vZGVzKVxuICAgICAgICBjb25zdCBzb3VyY2VIYXNoID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0ubm9kZUhhc2hOYW1lO1xuICAgICAgICBjb25zdCB0YXJnZXRIYXNoID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0ubm9kZUhhc2hOYW1lO1xuICAgICAgICByZXR1cm4gc291cmNlQ2xhc3Muc2VsZWN0b3IgKyBgLmpvaW4odGFyZ2V0LCAke3NvdXJjZUhhc2h9LCAke3RhcmdldEhhc2h9LCBkZWZhdWx0RmluaXNoLCBzb3VyY2VUYXJnZXQpYDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHJlc3VsdCA9IHRoaXMuX3NlbGVjdG9yO1xuICAgICAgaWYgKCFzb3VyY2VDbGFzcykge1xuICAgICAgICBpZiAoIXRhcmdldENsYXNzKSB7XG4gICAgICAgICAgLy8gTm8gY29ubmVjdGlvbnMgeWV0OyBqdXN0IHlpZWxkIHRoZSByYXcgZWRnZSB0YWJsZVxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gUGFydGlhbCBlZGdlLXRhcmdldCBjb25uZWN0aW9uc1xuICAgICAgICAgIGNvbnN0IHsgZWRnZUhhc2hOYW1lLCBub2RlSGFzaE5hbWUgfSA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICAgIHJldHVybiByZXN1bHQgKyBgLmpvaW4odGFyZ2V0LCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaCwgZWRnZVRhcmdldClgO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCF0YXJnZXRDbGFzcykge1xuICAgICAgICAvLyBQYXJ0aWFsIHNvdXJjZS1lZGdlIGNvbm5lY3Rpb25zXG4gICAgICAgIGNvbnN0IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICByZXR1cm4gcmVzdWx0ICsgYC5qb2luKHNvdXJjZSwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gsIHNvdXJjZUVkZ2UpYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZ1bGwgY29ubmVjdGlvbnNcbiAgICAgICAgbGV0IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICByZXN1bHQgKz0gYC5qb2luKHNvdXJjZSwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gpYDtcbiAgICAgICAgKHsgZWRnZUhhc2hOYW1lLCBub2RlSGFzaE5hbWUgfSA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdKTtcbiAgICAgICAgcmVzdWx0ICs9IGAuam9pbih0YXJnZXQsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoLCBmdWxsKWA7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHBvcHVsYXRlU3RyZWFtT3B0aW9ucyAob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBvcHRpb25zLm5hbWVkU3RyZWFtcyA9IHt9O1xuICAgIGlmICghdGhpcy5fc2VsZWN0b3IpIHtcbiAgICAgIC8vIFVzZSB0aGUgb3B0aW9ucyBmcm9tIHRoZSBzb3VyY2Ugc3RyZWFtIGluc3RlYWQgb2Ygb3VyIGNsYXNzXG4gICAgICBvcHRpb25zID0gc291cmNlQ2xhc3MucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpO1xuICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMudGFyZ2V0ID0gdGFyZ2V0Q2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMgPSBzdXBlci5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICBpZiAoc291cmNlQ2xhc3MpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMuc291cmNlID0gc291cmNlQ2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgICB9XG4gICAgICBpZiAodGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMudGFyZ2V0ID0gdGFyZ2V0Q2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICAvLyBUT0RPOiBhIGJhYmVsIGJ1ZyAoaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8zOTMwKVxuICAgIC8vIHByZXZlbnRzIGBhd2FpdCBzdXBlcmA7IHRoaXMgaXMgYSB3b3JrYXJvdW5kOlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEdlbmVyaWNDbGFzcy5wcm90b3R5cGUudG9SYXdPYmplY3QuY2FsbCh0aGlzKTtcbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgYXN5bmMgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgZGlyZWN0aW9uLCBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICB9XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNvdXJjZSBhbmQgdGFyZ2V0IGFyZSBhbHJlYWR5IGRlZmluZWQ7IHBsZWFzZSBzcGVjaWZ5IGEgZGlyZWN0aW9uIHRvIG92ZXJyaWRlYCk7XG4gICAgICB9XG4gICAgfVxuICAgIG5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXSA9IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfTtcbiAgICBkZWxldGUgdGhpcy5fc3RyZWFtO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGFzeW5jIHRvZ2dsZU5vZGVEaXJlY3Rpb24gKHNvdXJjZUNsYXNzSWQpIHtcbiAgICBpZiAoIXNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IHN3YXAgdG8gdW5jb25uZWN0ZWQgY2xhc3MgaWQ6ICR7c291cmNlQ2xhc3NJZH1gKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IHNvdXJjZUNsYXNzSWQ7XG4gICAgICB9XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9zdHJlYW07XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgYXN5bmMgZGVsZXRlICgpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIGF3YWl0IHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy53cmFwcGVkUGFyZW50ID0gd3JhcHBlZFBhcmVudDtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5yYXdJdGVtID0gcmF3SXRlbTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gICAgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnc291cmNlVGFyZ2V0Jykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBzb3VyY2U6IHRoaXMucmF3SXRlbS5sZWZ0LFxuICAgICAgICB0YXJnZXQ6IHRoaXMucmF3SXRlbS5yaWdodFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnZWRnZVRhcmdldCcpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgZWRnZTogdGhpcy5yYXdJdGVtLmxlZnQsXG4gICAgICAgIHRhcmdldDogdGhpcy5yYXdJdGVtLnJpZ2h0XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdzb3VyY2VFZGdlJykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBzb3VyY2U6IHRoaXMucmF3SXRlbS5yaWdodCxcbiAgICAgICAgZWRnZTogdGhpcy5yYXdJdGVtLmxlZnRcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ2Z1bGwnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIHNvdXJjZTogdGhpcy5yYXdJdGVtLmxlZnQucmlnaHQsXG4gICAgICAgIGVkZ2U6IHRoaXMucmF3SXRlbS5sZWZ0LmxlZnQsXG4gICAgICAgIHRhcmdldDogdGhpcy5yYXdJdGVtLnJpZ2h0XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gZWRnZVJvbGU6ICR7dG9rZW4uZWRnZVJvbGV9YCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiY2xhc3MgSW5NZW1vcnlJbmRleCB7XG4gIGNvbnN0cnVjdG9yICh7IGVudHJpZXMgPSB7fSwgY29tcGxldGUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICAgIHRoaXMuY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcztcbiAgfVxuICBhc3luYyAqIGl0ZXJFbnRyaWVzICgpIHtcbiAgICBmb3IgKGNvbnN0IFtoYXNoLCB2YWx1ZUxpc3RdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHsgaGFzaCwgdmFsdWVMaXN0IH07XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlckhhc2hlcyAoKSB7XG4gICAgZm9yIChjb25zdCBoYXNoIG9mIE9iamVjdC5rZXlzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIGhhc2g7XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlclZhbHVlTGlzdHMgKCkge1xuICAgIGZvciAoY29uc3QgdmFsdWVMaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgdmFsdWVMaXN0O1xuICAgIH1cbiAgfVxuICBhc3luYyBnZXRWYWx1ZUxpc3QgKGhhc2gpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzW2hhc2hdIHx8IFtdO1xuICB9XG4gIGFzeW5jIGFkZFZhbHVlIChoYXNoLCB2YWx1ZSkge1xuICAgIC8vIFRPRE86IGFkZCBzb21lIGtpbmQgb2Ygd2FybmluZyBpZiB0aGlzIGlzIGdldHRpbmcgYmlnP1xuICAgIHRoaXMuZW50cmllc1toYXNoXSA9IGF3YWl0IHRoaXMuZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgIGlmICh0aGlzLmVudHJpZXNbaGFzaF0uaW5kZXhPZih2YWx1ZSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbk1lbW9yeUluZGV4O1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4vU3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIFRPS0VOUyBmcm9tICcuL1Rva2Vucy9Ub2tlbnMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcbmltcG9ydCAqIGFzIElOREVYRVMgZnJvbSAnLi9JbmRleGVzL0luZGV4ZXMuanMnO1xuXG5sZXQgTkVYVF9DTEFTU19JRCA9IDE7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBtdXJlLmRlYnVnIHRvIHRydWUgdG8gZGVidWcgc3RyZWFtc1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UT0tFTlMgPSBUT0tFTlM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIE1vbmtleS1wYXRjaCBhdmFpbGFibGUgdG9rZW5zIGFzIGZ1bmN0aW9ucyBvbnRvIHRoZSBTdHJlYW0gY2xhc3NcbiAgICBmb3IgKGNvbnN0IHRva2VuQ2xhc3NOYW1lIGluIHRoaXMuVE9LRU5TKSB7XG4gICAgICBjb25zdCBUb2tlbkNsYXNzID0gdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdO1xuICAgICAgU3RyZWFtLnByb3RvdHlwZVtUb2tlbkNsYXNzLmxvd2VyQ2FtZWxDYXNlVHlwZV0gPSBmdW5jdGlvbiAoYXJnTGlzdCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5leHRlbmQoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIHtcbiAgICAgICAgICBsZWZ0OiB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICByaWdodDogb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMucm9vdCA9IHRoaXMubG9hZFJvb3QoKTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMubG9hZENsYXNzZXMoKTtcbiAgfVxuXG4gIGxvYWRSb290ICgpIHtcbiAgICBsZXQgcm9vdCA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ211cmVfcm9vdCcpO1xuICAgIHJvb3QgPSByb290ID8gSlNPTi5wYXJzZShyb290KSA6IHt9O1xuICAgIHJldHVybiByb290O1xuICB9XG4gIGFzeW5jIHNhdmVSb290ICgpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ211cmVfcm9vdCcsIEpTT04uc3RyaW5naWZ5KHRoaXMucm9vdCkpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jvb3RVcGRhdGUnKTtcbiAgfVxuICBsb2FkQ2xhc3NlcyAoKSB7XG4gICAgbGV0IGNsYXNzZXMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX2NsYXNzZXMnKTtcbiAgICBjbGFzc2VzID0gY2xhc3NlcyA/IEpTT04ucGFyc2UoY2xhc3NlcykgOiB7fTtcbiAgICBPYmplY3QuZW50cmllcyhjbGFzc2VzKS5mb3JFYWNoKChbIGNsYXNzSWQsIHJhd0NsYXNzT2JqIF0pID0+IHtcbiAgICAgIE9iamVjdC5lbnRyaWVzKHJhd0NsYXNzT2JqLmluZGV4ZXMpLmZvckVhY2goKFtmdW5jTmFtZSwgcmF3SW5kZXhPYmpdKSA9PiB7XG4gICAgICAgIHJhd0NsYXNzT2JqLmluZGV4ZXNbZnVuY05hbWVdID0gbmV3IHRoaXMuSU5ERVhFUy5Jbk1lbW9yeUluZGV4KHtcbiAgICAgICAgICBlbnRyaWVzOiByYXdJbmRleE9iaiwgY29tcGxldGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNsYXNzVHlwZSA9IHJhd0NsYXNzT2JqLmNsYXNzVHlwZTtcbiAgICAgIGRlbGV0ZSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICByYXdDbGFzc09iai5tdXJlID0gdGhpcztcbiAgICAgIGNsYXNzZXNbY2xhc3NJZF0gPSBuZXcgdGhpcy5DTEFTU0VTW2NsYXNzVHlwZV0ocmF3Q2xhc3NPYmopO1xuICAgIH0pO1xuICAgIHJldHVybiBjbGFzc2VzO1xuICB9XG4gIGFzeW5jIHNhdmVDbGFzc2VzICgpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJhd0NsYXNzZXMgPSB7fTtcbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKHRoaXMuY2xhc3NlcylcbiAgICAgICAgLm1hcChhc3luYyAoWyBjbGFzc0lkLCBjbGFzc09iaiBdKSA9PiB7XG4gICAgICAgICAgcmF3Q2xhc3Nlc1tjbGFzc0lkXSA9IGF3YWl0IGNsYXNzT2JqLnRvUmF3T2JqZWN0KCk7XG4gICAgICAgIH0pKTtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ211cmVfY2xhc3NlcycsIEpTT04uc3RyaW5naWZ5KHJhd0NsYXNzZXMpKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdjbGFzc1VwZGF0ZScpO1xuICB9XG5cbiAgcGFyc2VTZWxlY3RvciAoc2VsZWN0b3JTdHJpbmcpIHtcbiAgICBjb25zdCBzdGFydHNXaXRoUm9vdCA9IHNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ3Jvb3QnKTtcbiAgICBpZiAoIShzdGFydHNXaXRoUm9vdCB8fCBzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdlbXB0eScpKSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBTZWxlY3RvcnMgbXVzdCBzdGFydCB3aXRoICdyb290JyBvciAnZW1wdHknYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5DbGFzc0xpc3QgPSBbe1xuICAgICAgVG9rZW5DbGFzczogc3RhcnRzV2l0aFJvb3QgPyB0aGlzLlRPS0VOUy5Sb290VG9rZW4gOiB0aGlzLlRPS0VOUy5FbXB0eVRva2VuXG4gICAgfV07XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4ge1xuICAgICAgICBkID0gZC50cmltKCk7XG4gICAgICAgIHJldHVybiBkID09PSAnJyA/IHVuZGVmaW5lZCA6IGQ7XG4gICAgICB9KTtcbiAgICAgIGlmICh0b2tlbkNsYXNzTmFtZSA9PT0gJ1ZhbHVlc1Rva2VuJykge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5LZXlzVG9rZW4sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuVmFsdWVUb2tlblxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSxcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIHRva2VuOiAke3RlbXBbMV19YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRva2VuQ2xhc3NMaXN0O1xuICB9XG5cbiAgc3RyZWFtIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IgfHwgYHJvb3QudmFsdWVzKClgKTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIG5ld0NsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYHJvb3RgIH0pIHtcbiAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke05FWFRfQ0xBU1NfSUR9YDtcbiAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgY29uc3QgQ2xhc3NUeXBlID0gb3B0aW9ucy5DbGFzc1R5cGUgfHwgdGhpcy5DTEFTU0VTLkdlbmVyaWNDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5DbGFzc1R5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDbGFzc1R5cGUob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY0RhdGFTb3VyY2UoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2Uoe1xuICAgICAga2V5OiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAga2V5LFxuICAgIGV4dGVuc2lvbiA9ICd0eHQnLFxuICAgIHRleHRcbiAgfSkge1xuICAgIGxldCBvYmo7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIG9iaiA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgZGVsZXRlIG9iai5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY0RhdGFTb3VyY2Uoa2V5LCBvYmopO1xuICB9XG4gIGFzeW5jIGFkZFN0YXRpY0RhdGFTb3VyY2UgKGtleSwgb2JqKSB7XG4gICAgdGhpcy5yb290W2tleV0gPSBvYmo7XG4gICAgY29uc3QgdGVtcCA9IGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLnNhdmVSb290KCksIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IGByb290LnZhbHVlcygnJHtrZXl9JykudmFsdWVzKClgXG4gICAgfSldKTtcbiAgICByZXR1cm4gdGVtcFsxXTtcbiAgfVxuICBhc3luYyByZW1vdmVEYXRhU291cmNlIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5yb290W2tleV07XG4gICAgYXdhaXQgdGhpcy5zYXZlUm9vdCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsIm9mZiIsImluZGV4Iiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5Iiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiT2JqZWN0IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJTdHJlYW0iLCJvcHRpb25zIiwibXVyZSIsIm5hbWVkRnVuY3Rpb25zIiwiTkFNRURfRlVOQ1RJT05TIiwibmFtZWRTdHJlYW1zIiwibGF1bmNoZWRGcm9tQ2xhc3MiLCJpbmRleGVzIiwidG9rZW5DbGFzc0xpc3QiLCJ0b2tlbkxpc3QiLCJtYXAiLCJUb2tlbkNsYXNzIiwiYXJnTGlzdCIsIldyYXBwZXJzIiwiZ2V0V3JhcHBlckxpc3QiLCJ0b2tlbiIsImxlbmd0aCIsIldyYXBwZXIiLCJsb2NhbFRva2VuTGlzdCIsInNsaWNlIiwicG90ZW50aWFsV3JhcHBlcnMiLCJ2YWx1ZXMiLCJjbGFzc2VzIiwiZmlsdGVyIiwiY2xhc3NPYmoiLCJjbGFzc1Rva2VuTGlzdCIsImV2ZXJ5IiwibG9jYWxUb2tlbiIsImxvY2FsSW5kZXgiLCJ0b2tlbkNsYXNzU3BlYyIsImlzU3Vic2V0T2YiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwiY29uc29sZSIsIndhcm4iLCJzZWxlY3RvciIsImpvaW4iLCJmb3JrIiwicGFyc2VTZWxlY3RvciIsImV4dGVuZCIsImNvbmNhdCIsIndyYXAiLCJ3cmFwcGVkUGFyZW50IiwicmF3SXRlbSIsImhhc2hlcyIsIndyYXBwZXJJbmRleCIsInRlbXAiLCJ3cmFwcGVkSXRlbSIsIlByb21pc2UiLCJhbGwiLCJlbnRyaWVzIiwicmVkdWNlIiwicHJvbWlzZUxpc3QiLCJoYXNoRnVuY3Rpb25OYW1lIiwiaGFzaCIsImdldEluZGV4IiwiY29tcGxldGUiLCJhZGRWYWx1ZSIsIml0ZXJhdGUiLCJsYXN0VG9rZW4iLCJJTkRFWEVTIiwiSW5NZW1vcnlJbmRleCIsImJ1aWxkSW5kZXgiLCJoYXNoRnVuY3Rpb24iLCJFcnJvciIsInNhbXBsZSIsImxpbWl0IiwicmVidWlsZEluZGV4ZXMiLCJpdGVyYXRvciIsIm5leHQiLCJkb25lIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b1N0cmluZyIsInRvTG93ZXJDYXNlIiwiaXNTdWJTZXRPZiIsImFuY2VzdG9yVG9rZW5zIiwiaXRlcmF0ZVBhcmVudCIsInBhcmVudFRva2VuIiwieWllbGRlZFNvbWV0aGluZyIsImRlYnVnIiwiVHlwZUVycm9yIiwiZXhlYyIsIm5hbWUiLCJFbXB0eVRva2VuIiwiUm9vdFRva2VuIiwicm9vdCIsIktleXNUb2tlbiIsIm1hdGNoQWxsIiwia2V5cyIsInJhbmdlcyIsInVuZGVmaW5lZCIsImFyZyIsIm1hdGNoIiwiSW5maW5pdHkiLCJkIiwicGFyc2VJbnQiLCJpc05hTiIsImxvdyIsImhpZ2giLCJudW0iLCJOdW1iZXIiLCJTeW50YXhFcnJvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJjb25zb2xpZGF0ZVJhbmdlcyIsInNlbGVjdHNOb3RoaW5nIiwibmV3UmFuZ2VzIiwic29ydCIsImEiLCJiIiwiY3VycmVudFJhbmdlIiwiZGlmZmVyZW5jZSIsIm90aGVyVG9rZW4iLCJuZXdLZXlzIiwia2V5IiwiYWxsUG9pbnRzIiwiYWdnIiwicmFuZ2UiLCJpbmNsdWRlIiwiZXhjbHVkZSIsImRpZmYiLCJNYXRoIiwibWF4IiwibWluIiwiaGFzT3duUHJvcGVydHkiLCJWYWx1ZVRva2VuIiwib2JqIiwia2V5VHlwZSIsIkV2YWx1YXRlVG9rZW4iLCJuZXdTdHJlYW0iLCJlcnIiLCJNYXBUb2tlbiIsImdlbmVyYXRvciIsIm1hcHBlZFJhd0l0ZW0iLCJQcm9tb3RlVG9rZW4iLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwibWFwRnVuY3Rpb24iLCJyZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiIsImhhc2hJbmRleCIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJnZXRWYWx1ZUxpc3QiLCJKb2luVG9rZW4iLCJvdGhlclN0cmVhbSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiZmluaXNoIiwiZWRnZVJvbGUiLCJoYXNoVGhpc0dyYW5kcGFyZW50IiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwidmFsdWVMaXN0IiwiaXRlckVudHJpZXMiLCJvdGhlckxpc3QiLCJvdGhlcldyYXBwZWRJdGVtIiwidGhpc1dyYXBwZWRJdGVtIiwidGhpc0xpc3QiLCJ0aGlzSGFzaEl0ZW0iLCJ0aGlzSXRlcmF0b3IiLCJ0aGlzSW5kaXJlY3RLZXkiLCJ0aGlzSXNEb25lIiwib3RoZXJJdGVyYXRvciIsIm90aGVySXNEb25lIiwiQVNURVJJU0tTIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9zZWxlY3RvciIsImN1c3RvbUNsYXNzTmFtZSIsImN1c3RvbU5hbWVUb2tlbkluZGV4IiwiZnVuY05hbWUiLCJGdW5jdGlvbiIsInRvUmF3T2JqZWN0IiwicmVzdWx0IiwiY2xhc3NUeXBlIiwic3RyaW5naWZpZWRGdW5jIiwic2V0Q2xhc3NOYW1lIiwic2F2ZUNsYXNzZXMiLCJoYXNDdXN0b21OYW1lIiwiY2xhc3NOYW1lIiwidG9rZW5TdHJpbmdzIiwic3RhcnRzV2l0aCIsImFkZEhhc2hGdW5jdGlvbiIsInBvcHVsYXRlU3RyZWFtT3B0aW9ucyIsImdldFN0cmVhbSIsInJlc2V0IiwiX3N0cmVhbSIsImlzU3VwZXJTZXRPZlRva2VuTGlzdCIsImlzU3VwZXJTZXRPZiIsImludGVycHJldEFzTm9kZXMiLCJDTEFTU0VTIiwiTm9kZUNsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIkVkZ2VDbGFzcyIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsInNwbGl0IiwiZGVsZXRlIiwiTm9kZVdyYXBwZXIiLCJlZGdlQ29ubmVjdGlvbnMiLCJwcm90b3R5cGUiLCJjYWxsIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJkaXJlY3RlZCIsInRoaXNIYXNoTmFtZSIsIm90aGVySGFzaE5hbWUiLCJlZGdlQ2xhc3MiLCJuZXdDbGFzcyIsIkNsYXNzVHlwZSIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwibm9kZUhhc2hOYW1lIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibm9kZUNsYXNzIiwiZWRnZUNsYXNzSWQiLCJFZGdlV3JhcHBlciIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJzb3VyY2VIYXNoIiwidGFyZ2V0SGFzaCIsImVkZ2VIYXNoTmFtZSIsInRhcmdldCIsInNvdXJjZSIsImRpcmVjdGlvbiIsInRvZ2dsZU5vZGVEaXJlY3Rpb24iLCJsZWZ0IiwicmlnaHQiLCJlZGdlIiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiTkVYVF9DTEFTU19JRCIsIk11cmUiLCJGaWxlUmVhZGVyIiwibG9jYWxTdG9yYWdlIiwibWltZSIsIkRBVEFMSUJfRk9STUFUUyIsIlRPS0VOUyIsInRva2VuQ2xhc3NOYW1lIiwiaWRlbnRpdHkiLCJwYXJlbnRUeXBlIiwiZGVmYXVsdEZpbmlzaCIsInNoYTEiLCJub29wIiwibG9hZFJvb3QiLCJsb2FkQ2xhc3NlcyIsImdldEl0ZW0iLCJwYXJzZSIsInNhdmVSb290Iiwic2V0SXRlbSIsInJhd0NsYXNzT2JqIiwicmF3SW5kZXhPYmoiLCJyYXdDbGFzc2VzIiwic2VsZWN0b3JTdHJpbmciLCJzdGFydHNXaXRoUm9vdCIsImNodW5rIiwidG9VcHBlckNhc2UiLCJ0cmltIiwiYWRkRmlsZUFzU3RhdGljRGF0YVNvdXJjZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwidGV4dCIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljRGF0YVNvdXJjZSIsInJlbW92ZURhdGFTb3VyY2UiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FB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
