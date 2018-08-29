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
    throw new Error(`unimplemented`);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIFN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy5uYW1lZFN0cmVhbXMgPSBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fTtcbiAgICB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCBudWxsO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgICB0aGlzLnRva2VuQ2xhc3NMaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdCB8fCBbXTtcblxuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy5uYW1lZEZ1bmN0aW9uc1xuICAgIC8vIGFuZCB0aGlzLm5hbWVkU3RyZWFtc1xuICAgIHRoaXMudG9rZW5MaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdC5tYXAoKHsgVG9rZW5DbGFzcywgYXJnTGlzdCB9KSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFRva2VuQ2xhc3ModGhpcywgYXJnTGlzdCk7XG4gICAgfSk7XG4gICAgLy8gUmVtaW5kZXI6IHRoaXMgYWx3YXlzIG5lZWRzIHRvIGJlIGFmdGVyIGluaXRpYWxpemluZyB0aGlzLnRva2VuTGlzdFxuICAgIHRoaXMuV3JhcHBlcnMgPSB0aGlzLmdldFdyYXBwZXJMaXN0KCk7XG4gIH1cblxuICBnZXRXcmFwcGVyTGlzdCAoKSB7XG4gICAgLy8gTG9vayB1cCB3aGljaCwgaWYgYW55LCBjbGFzc2VzIGRlc2NyaWJlIHRoZSByZXN1bHQgb2YgZWFjaCB0b2tlbiwgc28gdGhhdFxuICAgIC8vIHdlIGNhbiB3cmFwIGl0ZW1zIGFwcHJvcHJpYXRlbHk6XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0Lm1hcCgodG9rZW4sIGluZGV4KSA9PiB7XG4gICAgICBpZiAoaW5kZXggPT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEgJiYgdGhpcy5sYXVuY2hlZEZyb21DbGFzcykge1xuICAgICAgICAvLyBJZiB0aGlzIHN0cmVhbSB3YXMgc3RhcnRlZCBmcm9tIGEgY2xhc3MsIHdlIGFscmVhZHkga25vdyB3ZSBzaG91bGRcbiAgICAgICAgLy8gdXNlIHRoYXQgY2xhc3MncyB3cmFwcGVyIGZvciB0aGUgbGFzdCB0b2tlblxuICAgICAgICByZXR1cm4gdGhpcy5sYXVuY2hlZEZyb21DbGFzcy5XcmFwcGVyO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBhIGNsYXNzIHRoYXQgZGVzY3JpYmVzIGV4YWN0bHkgZWFjaCBzZXJpZXMgb2YgdG9rZW5zXG4gICAgICBjb25zdCBsb2NhbFRva2VuTGlzdCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIGluZGV4ICsgMSk7XG4gICAgICBjb25zdCBwb3RlbnRpYWxXcmFwcGVycyA9IE9iamVjdC52YWx1ZXModGhpcy5tdXJlLmNsYXNzZXMpXG4gICAgICAgIC5maWx0ZXIoY2xhc3NPYmogPT4ge1xuICAgICAgICAgIGNvbnN0IGNsYXNzVG9rZW5MaXN0ID0gY2xhc3NPYmoudG9rZW5DbGFzc0xpc3Q7XG4gICAgICAgICAgaWYgKCFjbGFzc1Rva2VuTGlzdC5sZW5ndGggIT09IGxvY2FsVG9rZW5MaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbkxpc3QuZXZlcnkoKGxvY2FsVG9rZW4sIGxvY2FsSW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuQ2xhc3NTcGVjID0gY2xhc3NUb2tlbkxpc3RbbG9jYWxJbmRleF07XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbiBpbnN0YW5jZW9mIHRva2VuQ2xhc3NTcGVjLlRva2VuQ2xhc3MgJiZcbiAgICAgICAgICAgICAgdG9rZW4uaXNTdWJzZXRPZih0b2tlbkNsYXNzU3BlYy5hcmdMaXN0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIE5vIGNsYXNzZXMgZGVzY3JpYmUgdGhpcyBzZXJpZXMgb2YgdG9rZW5zLCBzbyB1c2UgdGhlIGdlbmVyaWMgd3JhcHBlclxuICAgICAgICByZXR1cm4gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYE11bHRpcGxlIGNsYXNzZXMgZGVzY3JpYmUgdGhlIHNhbWUgaXRlbSEgQXJiaXRyYXJpbHkgY2hvb3Npbmcgb25lLi4uYCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBvdGVudGlhbFdyYXBwZXJzWzBdLldyYXBwZXI7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5qb2luKCcnKTtcbiAgfVxuXG4gIGZvcmsgKHNlbGVjdG9yKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0oe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgbmFtZWRGdW5jdGlvbnM6IHRoaXMubmFtZWRGdW5jdGlvbnMsXG4gICAgICBuYW1lZFN0cmVhbXM6IHRoaXMubmFtZWRTdHJlYW1zLFxuICAgICAgdG9rZW5DbGFzc0xpc3Q6IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKHNlbGVjdG9yKSxcbiAgICAgIGxhdW5jaGVkRnJvbUNsYXNzOiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzLFxuICAgICAgaW5kZXhlczogdGhpcy5pbmRleGVzXG4gICAgfSk7XG4gIH1cblxuICBleHRlbmQgKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICBvcHRpb25zLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZEZ1bmN0aW9ucywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkU3RyZWFtcywgb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge30pO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0LmNvbmNhdChbeyBUb2tlbkNsYXNzLCBhcmdMaXN0IH1dKTtcbiAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzO1xuICAgIG9wdGlvbnMuaW5kZXhlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaW5kZXhlcywgb3B0aW9ucy5pbmRleGVzIHx8IHt9KTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0sIGhhc2hlcyA9IHt9IH0pIHtcbiAgICBsZXQgd3JhcHBlckluZGV4ID0gMDtcbiAgICBsZXQgdGVtcCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgd2hpbGUgKHRlbXAgIT09IG51bGwpIHtcbiAgICAgIHdyYXBwZXJJbmRleCArPSAxO1xuICAgICAgdGVtcCA9IHRlbXAud3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBuZXcgdGhpcy5XcmFwcGVyc1t3cmFwcGVySW5kZXhdKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXMoaGFzaGVzKS5yZWR1Y2UoKHByb21pc2VMaXN0LCBbaGFzaEZ1bmN0aW9uTmFtZSwgaGFzaF0pID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJbmRleChoYXNoRnVuY3Rpb25OYW1lKTtcbiAgICAgIGlmICghaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgcmV0dXJuIHByb21pc2VMaXN0LmNvbmNhdChbIGluZGV4LmFkZFZhbHVlKGhhc2gsIHdyYXBwZWRJdGVtKSBdKTtcbiAgICAgIH1cbiAgICB9LCBbXSkpO1xuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuXG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgbGFzdFRva2VuID0gdGhpcy50b2tlbkxpc3RbdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEpO1xuICAgIHlpZWxkICogYXdhaXQgbGFzdFRva2VuLml0ZXJhdGUodGVtcCk7XG4gIH1cblxuICBnZXRJbmRleCAoaGFzaEZ1bmN0aW9uTmFtZSkge1xuICAgIGlmICghdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdKSB7XG4gICAgICAvLyBUT0RPOiBpZiB1c2luZyBub2RlLmpzLCBzdGFydCB3aXRoIGV4dGVybmFsIC8gbW9yZSBzY2FsYWJsZSBpbmRleGVzXG4gICAgICB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV0gPSBuZXcgdGhpcy5tdXJlLklOREVYRVMuSW5NZW1vcnlJbmRleCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdO1xuICB9XG5cbiAgYXN5bmMgYnVpbGRJbmRleCAoaGFzaEZ1bmN0aW9uTmFtZSkge1xuICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMubmFtZWRGdW5jdGlvbnNbaGFzaEZ1bmN0aW9uTmFtZV07XG4gICAgaWYgKCFoYXNoRnVuY3Rpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtoYXNoRnVuY3Rpb25OYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXgoaGFzaEZ1bmN0aW9uTmFtZSk7XG4gICAgaWYgKGluZGV4LmNvbXBsZXRlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKCkpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBoYXNoRnVuY3Rpb24od3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgIGluZGV4LmFkZFZhbHVlKGhhc2gsIHdyYXBwZWRJdGVtKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaW5kZXguY29tcGxldGUgPSB0cnVlO1xuICB9XG5cbiAgYXN5bmMgKiBzYW1wbGUgKHsgbGltaXQgPSAxMCwgcmVidWlsZEluZGV4ZXMgPSBmYWxzZSB9KSB7XG4gICAgLy8gQmVmb3JlIHdlIHN0YXJ0LCBjbGVhbiBvdXQgYW55IG9sZCBpbmRleGVzIHRoYXQgd2VyZSBuZXZlciBmaW5pc2hlZFxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuaW5kZXhlcykuZm9yRWFjaCgoW2hhc2hGdW5jdGlvbk5hbWUsIGluZGV4XSkgPT4ge1xuICAgICAgaWYgKHJlYnVpbGRJbmRleGVzIHx8ICFpbmRleC5jb21wbGV0ZSkge1xuICAgICAgICBkZWxldGUgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAvLyBXZSBhY3R1YWxseSBmaW5pc2hlZCBhIGZ1bGwgcGFzczsgZmxhZyBhbGwgb2Ygb3VyIGluZGV4ZXMgYXMgY29tcGxldGVcbiAgICAgICAgT2JqZWN0LnZhbHVlcyh0aGlzLmluZGV4ZXMpLmZvckVhY2goaW5kZXggPT4ge1xuICAgICAgICAgIGluZGV4LmNvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbTtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBCYXNlVG9rZW4gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICAvLyBUaGUgc3RyaW5nIHZlcnNpb24gb2YgbW9zdCB0b2tlbnMgY2FuIGp1c3QgYmUgZGVyaXZlZCBmcm9tIHRoZSBjbGFzcyB0eXBlXG4gICAgcmV0dXJuIGAuJHt0aGlzLnR5cGUudG9Mb3dlckNhc2UoKX0oKWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoKSB7XG4gICAgLy8gQnkgZGVmYXVsdCAod2l0aG91dCBhbnkgYXJndW1lbnRzKSwgdG9rZW5zIG9mIHRoZSBzYW1lIGNsYXNzIGFyZSBzdWJzZXRzXG4gICAgLy8gb2YgZWFjaCBvdGhlclxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVQYXJlbnQgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3QgcGFyZW50VG9rZW4gPSBhbmNlc3RvclRva2Vuc1thbmNlc3RvclRva2Vucy5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0ZW1wID0gYW5jZXN0b3JUb2tlbnMuc2xpY2UoMCwgYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMSk7XG4gICAgbGV0IHlpZWxkZWRTb21ldGhpbmcgPSBmYWxzZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VG9rZW4uaXRlcmF0ZSh0ZW1wKSkge1xuICAgICAgeWllbGRlZFNvbWV0aGluZyA9IHRydWU7XG4gICAgICB5aWVsZCB3cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBpZiAoIXlpZWxkZWRTb21ldGhpbmcgJiYgdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVG9rZW4geWllbGRlZCBubyByZXN1bHRzOiAke3BhcmVudFRva2VufWApO1xuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRW1wdHlUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgLy8geWllbGQgbm90aGluZ1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYGVtcHR5YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRW1wdHlUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBSb290VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudDogbnVsbCxcbiAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgcmF3SXRlbTogdGhpcy5zdHJlYW0ubXVyZS5yb290XG4gICAgfSk7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgcm9vdGA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFJvb3RUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBLZXlzVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBhcmdMaXN0LCB7IG1hdGNoQWxsLCBrZXlzLCByYW5nZXMgfSA9IHt9KSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoa2V5cyB8fCByYW5nZXMpIHtcbiAgICAgIHRoaXMua2V5cyA9IGtleXM7XG4gICAgICB0aGlzLnJhbmdlcyA9IHJhbmdlcztcbiAgICB9IGVsc2UgaWYgKChhcmdMaXN0ICYmIGFyZ0xpc3QubGVuZ3RoID09PSAxICYmIGFyZ0xpc3RbMF0gPT09IHVuZGVmaW5lZCkgfHwgbWF0Y2hBbGwpIHtcbiAgICAgIHRoaXMubWF0Y2hBbGwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdMaXN0LmZvckVhY2goYXJnID0+IHtcbiAgICAgICAgbGV0IHRlbXAgPSBhcmcubWF0Y2goLyhcXGQrKS0oW1xcZOKInl0rKS8pO1xuICAgICAgICBpZiAodGVtcCAmJiB0ZW1wWzJdID09PSAn4oieJykge1xuICAgICAgICAgIHRlbXBbMl0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gdGVtcCA/IHRlbXAubWFwKGQgPT4gZC5wYXJzZUludChkKSkgOiBudWxsO1xuICAgICAgICBpZiAodGVtcCAmJiAhaXNOYU4odGVtcFsxXSkgJiYgIWlzTmFOKHRlbXBbMl0pKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IHRlbXBbMV07IGkgPD0gdGVtcFsyXTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogdGVtcFsxXSwgaGlnaDogdGVtcFsyXSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSBhcmcubWF0Y2goLycoLiopJy8pO1xuICAgICAgICB0ZW1wID0gdGVtcCAmJiB0ZW1wWzFdID8gdGVtcFsxXSA6IGFyZztcbiAgICAgICAgbGV0IG51bSA9IE51bWJlcih0ZW1wKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bSkgfHwgbnVtICE9PSBwYXJzZUludCh0ZW1wKSkgeyAvLyBsZWF2ZSBub24taW50ZWdlciBudW1iZXJzIGFzIHN0cmluZ3NcbiAgICAgICAgICB0aGlzLmtleXMgPSB0aGlzLmtleXMgfHwge307XG4gICAgICAgICAgdGhpcy5rZXlzW3RlbXBdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IG51bSwgaGlnaDogbnVtIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGlmICghdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEJhZCB0b2tlbiBrZXkocykgLyByYW5nZShzKTogJHtKU09OLnN0cmluZ2lmeShhcmdMaXN0KX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICB0aGlzLnJhbmdlcyA9IHRoaXMuY29uc29saWRhdGVSYW5nZXModGhpcy5yYW5nZXMpO1xuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0c05vdGhpbmcgKCkge1xuICAgIHJldHVybiAhdGhpcy5tYXRjaEFsbCAmJiAhdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcztcbiAgfVxuICBjb25zb2xpZGF0ZVJhbmdlcyAocmFuZ2VzKSB7XG4gICAgLy8gTWVyZ2UgYW55IG92ZXJsYXBwaW5nIHJhbmdlc1xuICAgIGNvbnN0IG5ld1JhbmdlcyA9IFtdO1xuICAgIGNvbnN0IHRlbXAgPSByYW5nZXMuc29ydCgoYSwgYikgPT4gYS5sb3cgLSBiLmxvdyk7XG4gICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWN1cnJlbnRSYW5nZSkge1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfSBlbHNlIGlmICh0ZW1wW2ldLmxvdyA8PSBjdXJyZW50UmFuZ2UuaGlnaCkge1xuICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IHRlbXBbaV0uaGlnaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAgIC8vIENvcm5lciBjYXNlOiBhZGQgdGhlIGxhc3QgcmFuZ2VcbiAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgfVxuICAgIHJldHVybiBuZXdSYW5nZXMubGVuZ3RoID4gMCA/IG5ld1JhbmdlcyA6IHVuZGVmaW5lZDtcbiAgfVxuICBkaWZmZXJlbmNlIChvdGhlclRva2VuKSB7XG4gICAgLy8gQ29tcHV0ZSB3aGF0IGlzIGxlZnQgb2YgdGhpcyBhZnRlciBzdWJ0cmFjdGluZyBvdXQgZXZlcnl0aGluZyBpbiBvdGhlclRva2VuXG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgY29tcHV0ZSB0aGUgZGlmZmVyZW5jZSBvZiB0d28gZGlmZmVyZW50IHRva2VuIHR5cGVzYCk7XG4gICAgfSBlbHNlIGlmIChvdGhlclRva2VuLm1hdGNoQWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGNvbnNvbGUud2FybihgSW5hY2N1cmF0ZSBkaWZmZXJlbmNlIGNvbXB1dGVkISBUT0RPOiBuZWVkIHRvIGZpZ3VyZSBvdXQgaG93IHRvIGludmVydCBjYXRlZ29yaWNhbCBrZXlzIWApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld0tleXMgPSB7fTtcbiAgICAgIGZvciAobGV0IGtleSBpbiAodGhpcy5rZXlzIHx8IHt9KSkge1xuICAgICAgICBpZiAoIW90aGVyVG9rZW4ua2V5cyB8fCAhb3RoZXJUb2tlbi5rZXlzW2tleV0pIHtcbiAgICAgICAgICBuZXdLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3UmFuZ2VzID0gW107XG4gICAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgICAgaWYgKG90aGVyVG9rZW4ucmFuZ2VzKSB7XG4gICAgICAgICAgbGV0IGFsbFBvaW50cyA9IHRoaXMucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICBhbGxQb2ludHMgPSBhbGxQb2ludHMuY29uY2F0KG90aGVyVG9rZW4ucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKSkuc29ydCgpO1xuICAgICAgICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0geyBsb3c6IGFsbFBvaW50c1tpXS52YWx1ZSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmV4Y2x1ZGUpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS5sb3cgLSAxO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmxvdyA9IGFsbFBvaW50c1tpXS5oaWdoICsgMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdSYW5nZXMgPSB0aGlzLnJhbmdlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBLZXlzVG9rZW4odGhpcy5tdXJlLCBudWxsLCB7IGtleXM6IG5ld0tleXMsIHJhbmdlczogbmV3UmFuZ2VzIH0pO1xuICAgIH1cbiAgfVxuICBpc1N1YlNldE9mIChhcmdMaXN0KSB7XG4gICAgY29uc3Qgb3RoZXJUb2tlbiA9IG5ldyBLZXlzVG9rZW4odGhpcy5zdHJlYW0sIGFyZ0xpc3QpO1xuICAgIGNvbnN0IGRpZmYgPSBvdGhlclRva2VuLmRpZmZlcmVuY2UodGhpcyk7XG4gICAgcmV0dXJuIGRpZmYgPT09IG51bGwgfHwgZGlmZi5zZWxlY3RzTm90aGluZztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHsgcmV0dXJuICcua2V5cygpJzsgfVxuICAgIHJldHVybiAnLmtleXMoJyArICh0aGlzLnJhbmdlcyB8fCBbXSkubWFwKCh7bG93LCBoaWdofSkgPT4ge1xuICAgICAgcmV0dXJuIGxvdyA9PT0gaGlnaCA/IGxvdyA6IGAke2xvd30tJHtoaWdofWA7XG4gICAgfSkuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMua2V5cyB8fCB7fSkubWFwKGtleSA9PiBgJyR7a2V5fSdgKSlcbiAgICAgIC5qb2luKCcsJykgKyAnKSc7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgICAgZm9yIChsZXQga2V5IGluIHdyYXBwZWRQYXJlbnQucmF3SXRlbSkge1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgICAgbG93ID0gTWF0aC5tYXgoMCwgbG93KTtcbiAgICAgICAgICBoaWdoID0gTWF0aC5taW4od3JhcHBlZFBhcmVudC5yYXdJdGVtLmxlbmd0aCAtIDEsIGhpZ2gpO1xuICAgICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICByYXdJdGVtOiBpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gdGhpcy5rZXlzIHx8IHt9KSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgY29uc3Qgb2JqID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgIGNvbnN0IGtleVR5cGUgPSB0eXBlb2Yga2V5O1xuICAgICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IChrZXlUeXBlICE9PSAnc3RyaW5nJyAmJiBrZXlUeXBlICE9PSAnbnVtYmVyJykpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVmFsdWVUb2tlbiB1c2VkIG9uIGEgbm9uLW9iamVjdCwgb3Igd2l0aG91dCBhIHN0cmluZyAvIG51bWVyaWMga2V5YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgcmF3SXRlbTogb2JqW2tleV1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVmFsdWVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFdmFsdWF0ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gRXZhbHVhdGVUb2tlbiBpcyBub3QgYSBzdHJpbmdgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1N0cmVhbTtcbiAgICAgIHRyeSB7XG4gICAgICAgIG5ld1N0cmVhbSA9IHRoaXMuc3RyZWFtLmZvcmsod3JhcHBlZFBhcmVudC5yYXdJdGVtKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcgfHwgIShlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikpIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkICogYXdhaXQgbmV3U3RyZWFtLml0ZXJhdGUoKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZ2VuZXJhdG9yXSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2dlbmVyYXRvcn1gKTtcbiAgICB9XG4gICAgdGhpcy5nZW5lcmF0b3IgPSBnZW5lcmF0b3I7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLm1hcCgke3RoaXMuZ2VuZXJhdG9yfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvciA9PT0gdGhpcy5nZW5lcmF0b3I7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5nZW5lcmF0b3JdKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgbWFwLCBoYXNoLCByZWR1Y2VJbnN0YW5jZXMgXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLnByb21vdGUoJHt0aGlzLm1hcH0sICR7dGhpcy5oYXNofSwgJHt0aGlzLnJlZHVjZUluc3RhbmNlc30pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwID09PSBtYXAgJiZcbiAgICAgIHRoaXMuaGFzaCA9PT0gaGFzaCAmJlxuICAgICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPT09IHJlZHVjZUluc3RhbmNlcztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG1hcEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5tYXBdO1xuICAgICAgY29uc3QgaGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5oYXNoXTtcbiAgICAgIGNvbnN0IHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5yZWR1Y2VJbnN0YW5jZXNdO1xuICAgICAgY29uc3QgaGFzaEluZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy5oYXNoKTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiBtYXBGdW5jdGlvbih3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICBjb25zdCBoYXNoID0gaGFzaEZ1bmN0aW9uKG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICBsZXQgb3JpZ2luYWxXcmFwcGVkSXRlbSA9IChhd2FpdCBoYXNoSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpKVswXTtcbiAgICAgICAgaWYgKG9yaWdpbmFsV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWR1Y2VJbnN0YW5jZXMgIT09ICdub29wJykge1xuICAgICAgICAgICAgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24ob3JpZ2luYWxXcmFwcGVkSXRlbSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBoYXNoZXMgPSB7fTtcbiAgICAgICAgICBoYXNoZXNbdGhpcy5oYXNoXSA9IGhhc2g7XG4gICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtLFxuICAgICAgICAgICAgaGFzaGVzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEpvaW5Ub2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnZGVmYXVsdEZpbmlzaCcsIGVkZ2VSb2xlID0gJ25vbmUnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIHRoaXNIYXNoLCBmaW5pc2ggXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgdGVtcCA9IHN0cmVhbS5uYW1lZFN0cmVhbXNbb3RoZXJTdHJlYW1dO1xuICAgIGlmICghdGVtcCkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIHN0cmVhbTogJHtvdGhlclN0cmVhbX1gKTtcbiAgICB9XG4gICAgLy8gUmVxdWlyZSBvdGhlckhhc2ggb24gdGhlIG90aGVyIHN0cmVhbSwgb3IgY29weSBvdXJzIG92ZXIgaWYgaXQgaXNuJ3RcbiAgICAvLyBhbHJlYWR5IGRlZmluZWRcbiAgICBpZiAoIXRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gaGFzaCBmdW5jdGlvbiBvbiBlaXRoZXIgc3RyZWFtOiAke290aGVySGFzaH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSA9IHN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMub3RoZXJTdHJlYW0gPSBvdGhlclN0cmVhbTtcbiAgICB0aGlzLnRoaXNIYXNoID0gdGhpc0hhc2g7XG4gICAgdGhpcy5vdGhlckhhc2ggPSBvdGhlckhhc2g7XG4gICAgdGhpcy5maW5pc2ggPSBmaW5pc2g7XG4gICAgdGhpcy5lZGdlUm9sZSA9IGVkZ2VSb2xlO1xuICAgIHRoaXMuaGFzaFRoaXNHcmFuZHBhcmVudCA9IGVkZ2VSb2xlID09PSAnZnVsbCc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLmpvaW4oJHt0aGlzLm90aGVyU3RyZWFtfSwgJHt0aGlzLnRoaXNIYXNofSwgJHt0aGlzLm90aGVySGFzaH0sICR7dGhpcy5maW5pc2h9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBvdGhlclN0cmVhbSwgdGhpc0hhc2ggPSAna2V5Jywgb3RoZXJIYXNoID0gJ2tleScsIGZpbmlzaCA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiB0aGlzLm90aGVyU3RyZWFtID09PSBvdGhlclN0cmVhbSAmJlxuICAgICAgdGhpcy50aGlzSGFzaCA9PT0gdGhpc0hhc2ggJiZcbiAgICAgIHRoaXMub3RoZXJIYXNoID09PSBvdGhlckhhc2ggJiZcbiAgICAgIHRoaXMuZmluaXNoID09PSBmaW5pc2g7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IG90aGVyU3RyZWFtID0gdGhpcy5zdHJlYW0ubmFtZWRTdHJlYW1zW3RoaXMub3RoZXJTdHJlYW1dO1xuICAgIGNvbnN0IHRoaXNIYXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLnRoaXNIYXNoXTtcbiAgICBjb25zdCBvdGhlckhhc2hGdW5jdGlvbiA9IG90aGVyU3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMub3RoZXJIYXNoXTtcbiAgICBjb25zdCBmaW5pc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZmluaXNoXTtcblxuICAgIC8vIGNvbnN0IHRoaXNJdGVyYXRvciA9IHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2Vucyk7XG4gICAgLy8gY29uc3Qgb3RoZXJJdGVyYXRvciA9IG90aGVyU3RyZWFtLml0ZXJhdGUoKTtcblxuICAgIGNvbnN0IHRoaXNJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMudGhpc0hhc2gpO1xuICAgIGNvbnN0IG90aGVySW5kZXggPSBvdGhlclN0cmVhbS5nZXRJbmRleCh0aGlzLm90aGVySGFzaCk7XG5cbiAgICBpZiAodGhpc0luZGV4LmNvbXBsZXRlKSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBCZXN0IG9mIGFsbCB3b3JsZHM7IHdlIGNhbiBqdXN0IGpvaW4gdGhlIGluZGV4ZXNcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IGhhc2gsIHZhbHVlTGlzdCB9IG9mIHRoaXNJbmRleC5pdGVyRW50cmllcygpKSB7XG4gICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdmFsdWVMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIHRoZSBvdGhlciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIG91ciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJTdHJlYW0uaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIG90aGVySGFzaEZ1bmN0aW9uKG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBBZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4OlxuICAgICAgICAgICAgYXdhaXQgb3RoZXJJbmRleC5hZGRWYWx1ZShoYXNoLCBvdGhlcldyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgb3VyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2YgdGhlIG90aGVyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgICAgICAvLyBPZGQgY29ybmVyIGNhc2UgZm9yIGVkZ2VzOyBzb21ldGltZXMgd2Ugd2FudCB0byBoYXNoIHRoZSBncmFuZHBhcmVudCBpbnN0ZWFkIG9mIHRoZSByZXN1bHQgb2ZcbiAgICAgICAgICAvLyBhbiBpbnRlcm1lZGlhdGUgam9pbjpcbiAgICAgICAgICBjb25zdCB0aGlzSGFzaEl0ZW0gPSB0aGlzLmhhc2hUaGlzR3JhbmRwYXJlbnQgPyB0aGlzV3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCA6IHRoaXNXcmFwcGVkSXRlbTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzSGFzaEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgYXdhaXQgdGhpc0luZGV4LmFkZFZhbHVlKGhhc2gsIHRoaXNIYXNoSXRlbSk7XG4gICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWl0aGVyIHN0cmVhbSBpcyBmdWxseSBpbmRleGVkOyBmb3IgbW9yZSBkaXN0cmlidXRlZCBzYW1wbGluZywgZ3JhYlxuICAgICAgICAvLyBvbmUgaXRlbSBmcm9tIGVhY2ggc3RyZWFtIGF0IGEgdGltZSwgYW5kIHVzZSB0aGUgcGFydGlhbCBpbmRleGVzXG4gICAgICAgIGNvbnN0IHRoaXNJdGVyYXRvciA9IHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucywgdGhpcy50aGlzSW5kaXJlY3RLZXkpO1xuICAgICAgICBsZXQgdGhpc0lzRG9uZSA9IGZhbHNlO1xuICAgICAgICBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuICAgICAgICBsZXQgb3RoZXJJc0RvbmUgPSBmYWxzZTtcblxuICAgICAgICB3aGlsZSAoIXRoaXNJc0RvbmUgfHwgIW90aGVySXNEb25lKSB7XG4gICAgICAgICAgLy8gVGFrZSBvbmUgc2FtcGxlIGZyb20gdGhpcyBzdHJlYW1cbiAgICAgICAgICBsZXQgdGVtcCA9IGF3YWl0IHRoaXNJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgdGhpc0lzRG9uZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICAvLyBPZGQgY29ybmVyIGNhc2UgZm9yIGVkZ2VzOyBzb21ldGltZXMgd2Ugd2FudCB0byBoYXNoIHRoZSBncmFuZHBhcmVudCBpbnN0ZWFkIG9mIHRoZSByZXN1bHQgb2ZcbiAgICAgICAgICAgIC8vIGFuIGludGVybWVkaWF0ZSBqb2luOlxuICAgICAgICAgICAgY29uc3QgdGhpc0hhc2hJdGVtID0gdGhpcy5oYXNoVGhpc0dyYW5kcGFyZW50ID8gdGhpc1dyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgOiB0aGlzV3JhcHBlZEl0ZW07XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzSGFzaEl0ZW0pKSB7XG4gICAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICAgIHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzSGFzaEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm93IGZvciBhIHNhbXBsZSBmcm9tIHRoZSBvdGhlciBzdHJlYW1cbiAgICAgICAgICB0ZW1wID0gYXdhaXQgb3RoZXJJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgb3RoZXJJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBvdGhlcldyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4XG4gICAgICAgICAgICAgIG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBKb2luVG9rZW47XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi4vU3RyZWFtLmpzJztcblxuY29uc3QgQVNURVJJU0tTID0ge1xuICAnZXZhbHVhdGUnOiAn4oasJyxcbiAgJ2pvaW4nOiAn4qivJyxcbiAgJ21hcCc6ICfihqYnLFxuICAncHJvbW90ZSc6ICfihpEnLFxuICAndmFsdWUnOiAn4oaSJ1xufTtcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLl9zZWxlY3RvciA9IG9wdGlvbnMuc2VsZWN0b3I7XG4gICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSBvcHRpb25zLmN1c3RvbUNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPSBvcHRpb25zLmN1c3RvbU5hbWVUb2tlbkluZGV4IHx8IG51bGw7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIGlmICh0eXBlb2YgZnVuYyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBuZXcgRnVuY3Rpb24oYHJldHVybiAke2Z1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLl9zZWxlY3RvcjtcbiAgfVxuICBnZXQgdG9rZW5DbGFzc0xpc3QgKCkge1xuICAgIHJldHVybiB0aGlzLm11cmUucGFyc2VTZWxlY3Rvcih0aGlzLnNlbGVjdG9yKTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NUeXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBzZWxlY3RvcjogdGhpcy5fc2VsZWN0b3IsXG4gICAgICBjdXN0b21DbGFzc05hbWU6IHRoaXMuY3VzdG9tQ2xhc3NOYW1lLFxuICAgICAgY3VzdG9tTmFtZVRva2VuSW5kZXg6IHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXgsXG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBpbmRleGVzOiB7fSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB7fVxuICAgIH07XG4gICAgZm9yIChsZXQgW2Z1bmNOYW1lLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm5hbWVkRnVuY3Rpb25zKSkge1xuICAgICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgICAgcmVzdWx0Lm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IHN0cmluZ2lmaWVkRnVuYztcbiAgICB9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXModGhpcy5pbmRleGVzKS5tYXAoYXN5bmMgKFtmdW5jTmFtZSwgaW5kZXhdKSA9PiB7XG4gICAgICBpZiAoaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgcmVzdWx0LmluZGV4ZXNbZnVuY05hbWVdID0gYXdhaXQgaW5kZXgudG9SYXdPYmplY3QoKTtcbiAgICAgIH1cbiAgICB9KSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSB2YWx1ZSkge1xuICAgICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSB2YWx1ZTtcbiAgICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPSB0aGlzLnNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKS5sZW5ndGg7XG4gICAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICB9XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gbnVsbCAmJlxuICAgICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9PT0gdGhpcy5zZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZykubGVuZ3RoO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIGNvbnN0IHNlbGVjdG9yID0gdGhpcy5zZWxlY3RvcjtcbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgIGZvciAobGV0IGkgPSB0b2tlblN0cmluZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmICh0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gbnVsbCAmJiBpIDw9IHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VzdG9tQ2xhc3NOYW1lICsgcmVzdWx0O1xuICAgICAgfVxuICAgICAgY29uc3QgdGVtcCA9IHRva2VuU3RyaW5nc1tpXS5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKHRlbXBbMV0gPT09ICdrZXlzJyB8fCB0ZW1wWzFdID09PSAndmFsdWVzJykge1xuICAgICAgICBpZiAodGVtcFsyXSA9PT0gJycpIHtcbiAgICAgICAgICByZXN1bHQgPSAnKicgKyByZXN1bHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0ID0gdGVtcFsyXS5yZXBsYWNlKC8nKFteJ10qKScvLCAnJDEnKSArIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gQVNURVJJU0tTW3RlbXBbMV1dICsgcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gKHNlbGVjdG9yLnN0YXJ0c1dpdGgoJ2VtcHR5JykgPyAn4oiFJyA6ICcnKSArIHJlc3VsdDtcbiAgfVxuICBhZGRIYXNoRnVuY3Rpb24gKGZ1bmNOYW1lLCBmdW5jKSB7XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBmdW5jO1xuICB9XG4gIHBvcHVsYXRlU3RyZWFtT3B0aW9ucyAob3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0O1xuICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSB0aGlzLm5hbWVkRnVuY3Rpb25zO1xuICAgIG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgPSB0aGlzO1xuICAgIG9wdGlvbnMuaW5kZXhlcyA9IHRoaXMuaW5kZXhlcztcbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfVxuICBnZXRTdHJlYW0gKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmIChvcHRpb25zLnJlc2V0IHx8ICF0aGlzLl9zdHJlYW0pIHtcbiAgICAgIHRoaXMuX3N0cmVhbSA9IG5ldyBTdHJlYW0odGhpcy5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucykpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtO1xuICB9XG4gIGlzU3VwZXJTZXRPZlRva2VuTGlzdCAodG9rZW5MaXN0KSB7XG4gICAgaWYgKHRva2VuTGlzdC5sZW5ndGggIT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QuZXZlcnkoKHRva2VuLCBpKSA9PiB0b2tlbi5pc1N1cGVyU2V0T2YodG9rZW5MaXN0W2ldKSk7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXSA9IG5ldyB0aGlzLm11cmUuQ0xBU1NFUy5Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXSA9IG5ldyB0aGlzLm11cmUuQ0xBU1NFUy5FZGdlQ2xhc3Mob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgYXN5bmMgYWdncmVnYXRlIChoYXNoLCByZWR1Y2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBleHBhbmQgKG1hcCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGZpbHRlciAoZmlsdGVyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgc3BsaXQgKGhhc2gpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBkZWxldGUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcjtcbiAgICB0aGlzLmVkZ2VDb25uZWN0aW9ucyA9IG9wdGlvbnMuZWRnZUNvbm5lY3Rpb25zIHx8IHt9O1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICAvLyBUT0RPOiBhIGJhYmVsIGJ1ZyAoaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8zOTMwKVxuICAgIC8vIHByZXZlbnRzIGBhd2FpdCBzdXBlcmA7IHRoaXMgaXMgYSB3b3JrYXJvdW5kOlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEdlbmVyaWNDbGFzcy5wcm90b3R5cGUudG9SYXdPYmplY3QuY2FsbCh0aGlzKTtcbiAgICAvLyBUT0RPOiBuZWVkIHRvIGRlZXAgY29weSBlZGdlQ29ubmVjdGlvbnM/XG4gICAgcmVzdWx0LmVkZ2VDb25uZWN0aW9ucyA9IHRoaXMuZWRnZUNvbm5lY3Rpb25zO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBkaXJlY3RlZCwgdGhpc0hhc2hOYW1lLCBvdGhlckhhc2hOYW1lIH0pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBhd2FpdCB0aGlzLm11cmUubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IG51bGwsXG4gICAgICBDbGFzc1R5cGU6IHRoaXMubXVyZS5DTEFTU0VTLkVkZ2VDbGFzcyxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICBkaXJlY3RlZFxuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNvbm5lY3Rpb25zW2VkZ2VDbGFzcy5jbGFzc0lkXSA9IHsgbm9kZUhhc2hOYW1lOiB0aGlzSGFzaE5hbWUgfTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbZWRnZUNsYXNzLmNsYXNzSWRdID0geyBub2RlSGFzaE5hbWU6IG90aGVySGFzaE5hbWUgfTtcbiAgICBkZWxldGUgdGhpcy5fc3RyZWFtO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuXG4gICAgaWYgKCF0aGlzLl9zZWxlY3Rvcikge1xuICAgICAgaWYgKCFzb3VyY2VDbGFzcyB8fCAhdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJ0aWFsIGNvbm5lY3Rpb25zIHdpdGhvdXQgYW4gZWRnZSB0YWJsZSBzaG91bGQgbmV2ZXIgaGFwcGVuYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBObyBlZGdlIHRhYmxlIChzaW1wbGUgam9pbiBiZXR3ZWVuIHR3byBub2RlcylcbiAgICAgICAgY29uc3Qgc291cmNlSGFzaCA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgY29uc3QgdGFyZ2V0SGFzaCA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgcmV0dXJuIHNvdXJjZUNsYXNzLnNlbGVjdG9yICsgYC5qb2luKHRhcmdldCwgJHtzb3VyY2VIYXNofSwgJHt0YXJnZXRIYXNofSwgZGVmYXVsdEZpbmlzaCwgc291cmNlVGFyZ2V0KWA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByZXN1bHQgPSB0aGlzLl9zZWxlY3RvcjtcbiAgICAgIGlmICghc291cmNlQ2xhc3MpIHtcbiAgICAgICAgaWYgKCF0YXJnZXRDbGFzcykge1xuICAgICAgICAgIC8vIE5vIGNvbm5lY3Rpb25zIHlldDsganVzdCB5aWVsZCB0aGUgcmF3IGVkZ2UgdGFibGVcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFBhcnRpYWwgZWRnZS10YXJnZXQgY29ubmVjdGlvbnNcbiAgICAgICAgICBjb25zdCB7IGVkZ2VIYXNoTmFtZSwgbm9kZUhhc2hOYW1lIH0gPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0ICsgYC5qb2luKHRhcmdldCwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gsIGVkZ2VUYXJnZXQpYDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgLy8gUGFydGlhbCBzb3VyY2UtZWRnZSBjb25uZWN0aW9uc1xuICAgICAgICBjb25zdCB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0gPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdCArIGAuam9pbihzb3VyY2UsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoLCBzb3VyY2VFZGdlKWA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBGdWxsIGNvbm5lY3Rpb25zXG4gICAgICAgIGxldCB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0gPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgcmVzdWx0ICs9IGAuam9pbihzb3VyY2UsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoKWA7XG4gICAgICAgICh7IGVkZ2VIYXNoTmFtZSwgbm9kZUhhc2hOYW1lIH0gPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXSk7XG4gICAgICAgIHJlc3VsdCArPSBgLmpvaW4odGFyZ2V0LCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaCwgZnVsbClgO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBwb3B1bGF0ZVN0cmVhbU9wdGlvbnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMgPSB7fTtcbiAgICBpZiAoIXRoaXMuX3NlbGVjdG9yKSB7XG4gICAgICAvLyBVc2UgdGhlIG9wdGlvbnMgZnJvbSB0aGUgc291cmNlIHN0cmVhbSBpbnN0ZWFkIG9mIG91ciBjbGFzc1xuICAgICAgb3B0aW9ucyA9IHNvdXJjZUNsYXNzLnBvcHVsYXRlU3RyZWFtT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnRhcmdldCA9IHRhcmdldENsYXNzLmdldFN0cmVhbSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gc3VwZXIucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpO1xuICAgICAgaWYgKHNvdXJjZUNsYXNzKSB7XG4gICAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnNvdXJjZSA9IHNvdXJjZUNsYXNzLmdldFN0cmVhbSgpO1xuICAgICAgfVxuICAgICAgaWYgKHRhcmdldENsYXNzKSB7XG4gICAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnRhcmdldCA9IHRhcmdldENsYXNzLmdldFN0cmVhbSgpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgLy8gVE9ETzogYSBiYWJlbCBidWcgKGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMzkzMClcbiAgICAvLyBwcmV2ZW50cyBgYXdhaXQgc3VwZXJgOyB0aGlzIGlzIGEgd29ya2Fyb3VuZDpcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBHZW5lcmljQ2xhc3MucHJvdG90eXBlLnRvUmF3T2JqZWN0LmNhbGwodGhpcyk7XG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSkge1xuICAgIGlmIChkaXJlY3Rpb24gPT09ICdzb3VyY2UnKSB7XG4gICAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICd0YXJnZXQnKSB7XG4gICAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb3VyY2UgYW5kIHRhcmdldCBhcmUgYWxyZWFkeSBkZWZpbmVkOyBwbGVhc2Ugc3BlY2lmeSBhIGRpcmVjdGlvbiB0byBvdmVycmlkZWApO1xuICAgICAgfVxuICAgIH1cbiAgICBub2RlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0gPSB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH07XG4gICAgZGVsZXRlIHRoaXMuX3N0cmVhbTtcbiAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMud3JhcHBlZFBhcmVudCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMucmF3SXRlbSA9IHJhd0l0ZW07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcih7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ3NvdXJjZVRhcmdldCcpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgc291cmNlOiB0aGlzLnJhd0l0ZW0ubGVmdCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLnJhd0l0ZW0ucmlnaHRcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ2VkZ2VUYXJnZXQnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIGVkZ2U6IHRoaXMucmF3SXRlbS5sZWZ0LFxuICAgICAgICB0YXJnZXQ6IHRoaXMucmF3SXRlbS5yaWdodFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnc291cmNlRWRnZScpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgc291cmNlOiB0aGlzLnJhd0l0ZW0ucmlnaHQsXG4gICAgICAgIGVkZ2U6IHRoaXMucmF3SXRlbS5sZWZ0XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdmdWxsJykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBzb3VyY2U6IHRoaXMucmF3SXRlbS5sZWZ0LnJpZ2h0LFxuICAgICAgICBlZGdlOiB0aGlzLnJhd0l0ZW0ubGVmdC5sZWZ0LFxuICAgICAgICB0YXJnZXQ6IHRoaXMucmF3SXRlbS5yaWdodFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGVkZ2VSb2xlOiAke3Rva2VuLmVkZ2VSb2xlfWApO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuL1N0cmVhbS5qcyc7XG5pbXBvcnQgKiBhcyBUT0tFTlMgZnJvbSAnLi9Ub2tlbnMvVG9rZW5zLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5pbXBvcnQgKiBhcyBJTkRFWEVTIGZyb20gJy4vSW5kZXhlcy9JbmRleGVzLmpzJztcblxubGV0IE5FWFRfQ0xBU1NfSUQgPSAxO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoRmlsZVJlYWRlciwgbG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBlaXRoZXIgd2luZG93LmxvY2FsU3RvcmFnZSBvciBudWxsXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVE9LRU5TID0gVE9LRU5TO1xuICAgIHRoaXMuQ0xBU1NFUyA9IENMQVNTRVM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuICAgIHRoaXMuSU5ERVhFUyA9IElOREVYRVM7XG5cbiAgICAvLyBNb25rZXktcGF0Y2ggYXZhaWxhYmxlIHRva2VucyBhcyBmdW5jdGlvbnMgb250byB0aGUgU3RyZWFtIGNsYXNzXG4gICAgZm9yIChjb25zdCB0b2tlbkNsYXNzTmFtZSBpbiB0aGlzLlRPS0VOUykge1xuICAgICAgY29uc3QgVG9rZW5DbGFzcyA9IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXTtcbiAgICAgIFN0cmVhbS5wcm90b3R5cGVbVG9rZW5DbGFzcy5sb3dlckNhbWVsQ2FzZVR5cGVdID0gZnVuY3Rpb24gKGFyZ0xpc3QsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXh0ZW5kKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7IHlpZWxkIHdyYXBwZWRJdGVtLnJhd0l0ZW07IH0sXG4gICAgICBrZXk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7XG4gICAgICAgIGlmICghd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEdyYW5kcGFyZW50IGlzIG5vdCBhbiBvYmplY3QgLyBhcnJheWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICBpZiAoIShwYXJlbnRUeXBlID09PSAnbnVtYmVyJyB8fCBwYXJlbnRUeXBlID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXNuJ3QgYSBrZXkgLyBpbmRleGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRGaW5pc2g6IGZ1bmN0aW9uICogKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgbGVmdDogdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0sXG4gICAgICAgICAgcmlnaHQ6IG90aGVyV3JhcHBlZEl0ZW0ucmF3SXRlbVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnJvb3QgPSB0aGlzLmxvYWRSb290KCk7XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBvdXIgY2xhc3Mgc3BlY2lmaWNhdGlvbnNcbiAgICB0aGlzLmNsYXNzZXMgPSB0aGlzLmxvYWRDbGFzc2VzKCk7XG4gIH1cblxuICBsb2FkUm9vdCAoKSB7XG4gICAgbGV0IHJvb3QgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX3Jvb3QnKTtcbiAgICByb290ID0gcm9vdCA/IEpTT04ucGFyc2Uocm9vdCkgOiB7fTtcbiAgICByZXR1cm4gcm9vdDtcbiAgfVxuICBhc3luYyBzYXZlUm9vdCAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX3Jvb3QnLCBKU09OLnN0cmluZ2lmeSh0aGlzLnJvb3QpKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyb290VXBkYXRlJyk7XG4gIH1cbiAgbG9hZENsYXNzZXMgKCkge1xuICAgIGxldCBjbGFzc2VzID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbXVyZV9jbGFzc2VzJyk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMgPyBKU09OLnBhcnNlKGNsYXNzZXMpIDoge307XG4gICAgT2JqZWN0LmVudHJpZXMoY2xhc3NlcykuZm9yRWFjaCgoWyBjbGFzc0lkLCByYXdDbGFzc09iaiBdKSA9PiB7XG4gICAgICBPYmplY3QuZW50cmllcyhyYXdDbGFzc09iai5pbmRleGVzKS5mb3JFYWNoKChbZnVuY05hbWUsIHJhd0luZGV4T2JqXSkgPT4ge1xuICAgICAgICByYXdDbGFzc09iai5pbmRleGVzW2Z1bmNOYW1lXSA9IG5ldyB0aGlzLklOREVYRVMuSW5NZW1vcnlJbmRleCh7XG4gICAgICAgICAgZW50cmllczogcmF3SW5kZXhPYmosIGNvbXBsZXRlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICBjb25zdCBjbGFzc1R5cGUgPSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICBkZWxldGUgcmF3Q2xhc3NPYmouY2xhc3NUeXBlO1xuICAgICAgcmF3Q2xhc3NPYmoubXVyZSA9IHRoaXM7XG4gICAgICBjbGFzc2VzW2NsYXNzSWRdID0gbmV3IHRoaXMuQ0xBU1NFU1tjbGFzc1R5cGVdKHJhd0NsYXNzT2JqKTtcbiAgICB9KTtcbiAgICByZXR1cm4gY2xhc3NlcztcbiAgfVxuICBhc3luYyBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCByYXdDbGFzc2VzID0ge307XG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyh0aGlzLmNsYXNzZXMpXG4gICAgICAgIC5tYXAoYXN5bmMgKFsgY2xhc3NJZCwgY2xhc3NPYmogXSkgPT4ge1xuICAgICAgICAgIHJhd0NsYXNzZXNbY2xhc3NJZF0gPSBhd2FpdCBjbGFzc09iai50b1Jhd09iamVjdCgpO1xuICAgICAgICB9KSk7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX2NsYXNzZXMnLCBKU09OLnN0cmluZ2lmeShyYXdDbGFzc2VzKSk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcignY2xhc3NVcGRhdGUnKTtcbiAgfVxuXG4gIHBhcnNlU2VsZWN0b3IgKHNlbGVjdG9yU3RyaW5nKSB7XG4gICAgY29uc3Qgc3RhcnRzV2l0aFJvb3QgPSBzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdyb290Jyk7XG4gICAgaWYgKCEoc3RhcnRzV2l0aFJvb3QgfHwgc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgnZW1wdHknKSkpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgU2VsZWN0b3JzIG11c3Qgc3RhcnQgd2l0aCAncm9vdCcgb3IgJ2VtcHR5J2ApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3RvclN0cmluZy5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgaWYgKCF0b2tlblN0cmluZ3MpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCBzZWxlY3RvciBzdHJpbmc6ICR7c2VsZWN0b3JTdHJpbmd9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuQ2xhc3NMaXN0ID0gW3tcbiAgICAgIFRva2VuQ2xhc3M6IHN0YXJ0c1dpdGhSb290ID8gdGhpcy5UT0tFTlMuUm9vdFRva2VuIDogdGhpcy5UT0tFTlMuRW1wdHlUb2tlblxuICAgIH1dO1xuICAgIHRva2VuU3RyaW5ncy5mb3JFYWNoKGNodW5rID0+IHtcbiAgICAgIGNvbnN0IHRlbXAgPSBjaHVuay5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKCF0ZW1wKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCB0b2tlbjogJHtjaHVua31gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRva2VuQ2xhc3NOYW1lID0gdGVtcFsxXVswXS50b1VwcGVyQ2FzZSgpICsgdGVtcFsxXS5zbGljZSgxKSArICdUb2tlbic7XG4gICAgICBjb25zdCBhcmdMaXN0ID0gdGVtcFsyXS5zcGxpdCgvKD88IVxcXFwpLC8pLm1hcChkID0+IHtcbiAgICAgICAgZCA9IGQudHJpbSgpO1xuICAgICAgICByZXR1cm4gZCA9PT0gJycgPyB1bmRlZmluZWQgOiBkO1xuICAgICAgfSk7XG4gICAgICBpZiAodG9rZW5DbGFzc05hbWUgPT09ICdWYWx1ZXNUb2tlbicpIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuS2V5c1Rva2VuLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLlZhbHVlVG9rZW5cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSkge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biB0b2tlbjogJHt0ZW1wWzFdfWApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0b2tlbkNsYXNzTGlzdDtcbiAgfVxuXG4gIHN0cmVhbSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMucGFyc2VTZWxlY3RvcihvcHRpb25zLnNlbGVjdG9yIHx8IGByb290LnZhbHVlcygpYCk7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBhc3luYyBuZXdDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGByb290YCB9KSB7XG4gICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIGNvbnN0IENsYXNzVHlwZSA9IG9wdGlvbnMuQ2xhc3NUeXBlIHx8IHRoaXMuQ0xBU1NFUy5HZW5lcmljQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuQ2xhc3NUeXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ2xhc3NUeXBlKG9wdGlvbnMpO1xuICAgIGF3YWl0IHRoaXMuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNEYXRhU291cmNlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlKHtcbiAgICAgIGtleTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFzeW5jIGFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGtleSxcbiAgICBleHRlbnNpb24gPSAndHh0JyxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICBsZXQgb2JqO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBvYmogPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGRlbGV0ZSBvYmouY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNEYXRhU291cmNlKGtleSwgb2JqKTtcbiAgfVxuICBhc3luYyBhZGRTdGF0aWNEYXRhU291cmNlIChrZXksIG9iaikge1xuICAgIHRoaXMucm9vdFtrZXldID0gb2JqO1xuICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5zYXZlUm9vdCgpLCB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoJyR7a2V5fScpLnZhbHVlcygpYFxuICAgIH0pXSk7XG4gICAgcmV0dXJuIHRlbXBbMV07XG4gIH1cbiAgYXN5bmMgcmVtb3ZlRGF0YVNvdXJjZSAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMucm9vdFtrZXldO1xuICAgIGF3YWl0IHRoaXMuc2F2ZVJvb3QoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG11cmUgPSBuZXcgTXVyZSh3aW5kb3cuRmlsZVJlYWRlciwgd2luZG93LmxvY2FsU3RvcmFnZSk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJvZmYiLCJpbmRleCIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiZm9yRWFjaCIsInNldFRpbWVvdXQiLCJhcHBseSIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsIk9iamVjdCIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiU3RyZWFtIiwib3B0aW9ucyIsIm11cmUiLCJuYW1lZEZ1bmN0aW9ucyIsIk5BTUVEX0ZVTkNUSU9OUyIsIm5hbWVkU3RyZWFtcyIsImxhdW5jaGVkRnJvbUNsYXNzIiwiaW5kZXhlcyIsInRva2VuQ2xhc3NMaXN0IiwidG9rZW5MaXN0IiwibWFwIiwiVG9rZW5DbGFzcyIsImFyZ0xpc3QiLCJXcmFwcGVycyIsImdldFdyYXBwZXJMaXN0IiwidG9rZW4iLCJsZW5ndGgiLCJXcmFwcGVyIiwibG9jYWxUb2tlbkxpc3QiLCJzbGljZSIsInBvdGVudGlhbFdyYXBwZXJzIiwidmFsdWVzIiwiY2xhc3NlcyIsImZpbHRlciIsImNsYXNzT2JqIiwiY2xhc3NUb2tlbkxpc3QiLCJldmVyeSIsImxvY2FsVG9rZW4iLCJsb2NhbEluZGV4IiwidG9rZW5DbGFzc1NwZWMiLCJpc1N1YnNldE9mIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsImNvbnNvbGUiLCJ3YXJuIiwic2VsZWN0b3IiLCJqb2luIiwiZm9yayIsInBhcnNlU2VsZWN0b3IiLCJleHRlbmQiLCJjb25jYXQiLCJ3cmFwIiwid3JhcHBlZFBhcmVudCIsInJhd0l0ZW0iLCJoYXNoZXMiLCJ3cmFwcGVySW5kZXgiLCJ0ZW1wIiwid3JhcHBlZEl0ZW0iLCJQcm9taXNlIiwiYWxsIiwiZW50cmllcyIsInJlZHVjZSIsInByb21pc2VMaXN0IiwiaGFzaEZ1bmN0aW9uTmFtZSIsImhhc2giLCJnZXRJbmRleCIsImNvbXBsZXRlIiwiYWRkVmFsdWUiLCJpdGVyYXRlIiwibGFzdFRva2VuIiwiSU5ERVhFUyIsIkluTWVtb3J5SW5kZXgiLCJidWlsZEluZGV4IiwiaGFzaEZ1bmN0aW9uIiwiRXJyb3IiLCJzYW1wbGUiLCJsaW1pdCIsInJlYnVpbGRJbmRleGVzIiwiaXRlcmF0b3IiLCJuZXh0IiwiZG9uZSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiQmFzZVRva2VuIiwic3RyZWFtIiwidG9TdHJpbmciLCJ0b0xvd2VyQ2FzZSIsImlzU3ViU2V0T2YiLCJhbmNlc3RvclRva2VucyIsIml0ZXJhdGVQYXJlbnQiLCJwYXJlbnRUb2tlbiIsInlpZWxkZWRTb21ldGhpbmciLCJkZWJ1ZyIsIlR5cGVFcnJvciIsImV4ZWMiLCJuYW1lIiwiRW1wdHlUb2tlbiIsIlJvb3RUb2tlbiIsInJvb3QiLCJLZXlzVG9rZW4iLCJtYXRjaEFsbCIsImtleXMiLCJyYW5nZXMiLCJ1bmRlZmluZWQiLCJhcmciLCJtYXRjaCIsIkluZmluaXR5IiwiZCIsInBhcnNlSW50IiwiaXNOYU4iLCJsb3ciLCJoaWdoIiwibnVtIiwiTnVtYmVyIiwiU3ludGF4RXJyb3IiLCJKU09OIiwic3RyaW5naWZ5IiwiY29uc29saWRhdGVSYW5nZXMiLCJzZWxlY3RzTm90aGluZyIsIm5ld1JhbmdlcyIsInNvcnQiLCJhIiwiYiIsImN1cnJlbnRSYW5nZSIsImRpZmZlcmVuY2UiLCJvdGhlclRva2VuIiwibmV3S2V5cyIsImtleSIsImFsbFBvaW50cyIsImFnZyIsInJhbmdlIiwiaW5jbHVkZSIsImV4Y2x1ZGUiLCJkaWZmIiwiTWF0aCIsIm1heCIsIm1pbiIsImhhc093blByb3BlcnR5IiwiVmFsdWVUb2tlbiIsIm9iaiIsImtleVR5cGUiLCJFdmFsdWF0ZVRva2VuIiwibmV3U3RyZWFtIiwiZXJyIiwiTWFwVG9rZW4iLCJnZW5lcmF0b3IiLCJtYXBwZWRSYXdJdGVtIiwiUHJvbW90ZVRva2VuIiwicmVkdWNlSW5zdGFuY2VzIiwiZnVuYyIsIm1hcEZ1bmN0aW9uIiwicmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24iLCJoYXNoSW5kZXgiLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwiZ2V0VmFsdWVMaXN0IiwiSm9pblRva2VuIiwib3RoZXJTdHJlYW0iLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImZpbmlzaCIsImVkZ2VSb2xlIiwiaGFzaFRoaXNHcmFuZHBhcmVudCIsInRoaXNIYXNoRnVuY3Rpb24iLCJvdGhlckhhc2hGdW5jdGlvbiIsImZpbmlzaEZ1bmN0aW9uIiwidGhpc0luZGV4Iiwib3RoZXJJbmRleCIsInZhbHVlTGlzdCIsIml0ZXJFbnRyaWVzIiwib3RoZXJMaXN0Iiwib3RoZXJXcmFwcGVkSXRlbSIsInRoaXNXcmFwcGVkSXRlbSIsInRoaXNMaXN0IiwidGhpc0hhc2hJdGVtIiwidGhpc0l0ZXJhdG9yIiwidGhpc0luZGlyZWN0S2V5IiwidGhpc0lzRG9uZSIsIm90aGVySXRlcmF0b3IiLCJvdGhlcklzRG9uZSIsIkFTVEVSSVNLUyIsIkdlbmVyaWNDbGFzcyIsImNsYXNzSWQiLCJfc2VsZWN0b3IiLCJjdXN0b21DbGFzc05hbWUiLCJjdXN0b21OYW1lVG9rZW5JbmRleCIsImZ1bmNOYW1lIiwiRnVuY3Rpb24iLCJ0b1Jhd09iamVjdCIsInJlc3VsdCIsImNsYXNzVHlwZSIsInN0cmluZ2lmaWVkRnVuYyIsInNldENsYXNzTmFtZSIsInNhdmVDbGFzc2VzIiwiaGFzQ3VzdG9tTmFtZSIsImNsYXNzTmFtZSIsInRva2VuU3RyaW5ncyIsInN0YXJ0c1dpdGgiLCJhZGRIYXNoRnVuY3Rpb24iLCJwb3B1bGF0ZVN0cmVhbU9wdGlvbnMiLCJnZXRTdHJlYW0iLCJyZXNldCIsIl9zdHJlYW0iLCJpc1N1cGVyU2V0T2ZUb2tlbkxpc3QiLCJpc1N1cGVyU2V0T2YiLCJpbnRlcnByZXRBc05vZGVzIiwiQ0xBU1NFUyIsIk5vZGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJFZGdlQ2xhc3MiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJzcGxpdCIsImRlbGV0ZSIsIk5vZGVXcmFwcGVyIiwiZWRnZUNvbm5lY3Rpb25zIiwicHJvdG90eXBlIiwiY2FsbCIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwiZGlyZWN0ZWQiLCJ0aGlzSGFzaE5hbWUiLCJvdGhlckhhc2hOYW1lIiwiZWRnZUNsYXNzIiwibmV3Q2xhc3MiLCJDbGFzc1R5cGUiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsIm5vZGVIYXNoTmFtZSIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5vZGVDbGFzcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsInNvdXJjZUhhc2giLCJ0YXJnZXRIYXNoIiwiZWRnZUhhc2hOYW1lIiwidGFyZ2V0Iiwic291cmNlIiwiZGlyZWN0aW9uIiwibGVmdCIsInJpZ2h0IiwiZWRnZSIsIml0ZXJIYXNoZXMiLCJpdGVyVmFsdWVMaXN0cyIsIk5FWFRfQ0xBU1NfSUQiLCJNdXJlIiwiRmlsZVJlYWRlciIsImxvY2FsU3RvcmFnZSIsIm1pbWUiLCJEQVRBTElCX0ZPUk1BVFMiLCJUT0tFTlMiLCJ0b2tlbkNsYXNzTmFtZSIsImlkZW50aXR5IiwicGFyZW50VHlwZSIsImRlZmF1bHRGaW5pc2giLCJzaGExIiwibm9vcCIsImxvYWRSb290IiwibG9hZENsYXNzZXMiLCJnZXRJdGVtIiwicGFyc2UiLCJzYXZlUm9vdCIsInNldEl0ZW0iLCJyYXdDbGFzc09iaiIsInJhd0luZGV4T2JqIiwicmF3Q2xhc3NlcyIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aFJvb3QiLCJjaHVuayIsInRvVXBwZXJDYXNlIiwidHJpbSIsImFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UiLCJmaWxlT2JqIiwiZW5jb2RpbmciLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsInRleHQiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVhZGVyIiwib25sb2FkIiwicmVhZEFzVGV4dCIsImFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY0RhdGFTb3VyY2UiLCJyZW1vdmVEYXRhU291cmNlIiwid2luZG93IiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QkMsdUJBQXZCLEVBQWdEO1VBQzVDLENBQUMsS0FBS0wsYUFBTCxDQUFtQkcsU0FBbkIsQ0FBTCxFQUFvQzthQUM3QkgsYUFBTCxDQUFtQkcsU0FBbkIsSUFBZ0MsRUFBaEM7OztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtMLGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsTUFBb0QsQ0FB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
