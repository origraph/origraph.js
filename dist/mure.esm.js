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

  setNamedFunction(funcName, func) {
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
    nodeClass,
    thisHashName,
    otherHashName
  }) {
    throw new Error(`unimplemented`);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIFN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy5uYW1lZFN0cmVhbXMgPSBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fTtcbiAgICB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCBudWxsO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgICB0aGlzLnRva2VuQ2xhc3NMaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdCB8fCBbXTtcblxuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy5uYW1lZEZ1bmN0aW9uc1xuICAgIC8vIGFuZCB0aGlzLm5hbWVkU3RyZWFtc1xuICAgIHRoaXMudG9rZW5MaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdC5tYXAoKHsgVG9rZW5DbGFzcywgYXJnTGlzdCB9KSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFRva2VuQ2xhc3ModGhpcywgYXJnTGlzdCk7XG4gICAgfSk7XG4gICAgLy8gUmVtaW5kZXI6IHRoaXMgYWx3YXlzIG5lZWRzIHRvIGJlIGFmdGVyIGluaXRpYWxpemluZyB0aGlzLnRva2VuTGlzdFxuICAgIHRoaXMuV3JhcHBlcnMgPSB0aGlzLmdldFdyYXBwZXJMaXN0KCk7XG4gIH1cblxuICBnZXRXcmFwcGVyTGlzdCAoKSB7XG4gICAgLy8gTG9vayB1cCB3aGljaCwgaWYgYW55LCBjbGFzc2VzIGRlc2NyaWJlIHRoZSByZXN1bHQgb2YgZWFjaCB0b2tlbiwgc28gdGhhdFxuICAgIC8vIHdlIGNhbiB3cmFwIGl0ZW1zIGFwcHJvcHJpYXRlbHk6XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0Lm1hcCgodG9rZW4sIGluZGV4KSA9PiB7XG4gICAgICBpZiAoaW5kZXggPT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEgJiYgdGhpcy5sYXVuY2hlZEZyb21DbGFzcykge1xuICAgICAgICAvLyBJZiB0aGlzIHN0cmVhbSB3YXMgc3RhcnRlZCBmcm9tIGEgY2xhc3MsIHdlIGFscmVhZHkga25vdyB3ZSBzaG91bGRcbiAgICAgICAgLy8gdXNlIHRoYXQgY2xhc3MncyB3cmFwcGVyIGZvciB0aGUgbGFzdCB0b2tlblxuICAgICAgICByZXR1cm4gdGhpcy5sYXVuY2hlZEZyb21DbGFzcy5XcmFwcGVyO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBhIGNsYXNzIHRoYXQgZGVzY3JpYmVzIGV4YWN0bHkgZWFjaCBzZXJpZXMgb2YgdG9rZW5zXG4gICAgICBjb25zdCBsb2NhbFRva2VuTGlzdCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIGluZGV4ICsgMSk7XG4gICAgICBjb25zdCBwb3RlbnRpYWxXcmFwcGVycyA9IE9iamVjdC52YWx1ZXModGhpcy5tdXJlLmNsYXNzZXMpXG4gICAgICAgIC5maWx0ZXIoY2xhc3NPYmogPT4ge1xuICAgICAgICAgIGNvbnN0IGNsYXNzVG9rZW5MaXN0ID0gY2xhc3NPYmoudG9rZW5DbGFzc0xpc3Q7XG4gICAgICAgICAgaWYgKCFjbGFzc1Rva2VuTGlzdC5sZW5ndGggIT09IGxvY2FsVG9rZW5MaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbkxpc3QuZXZlcnkoKGxvY2FsVG9rZW4sIGxvY2FsSW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuQ2xhc3NTcGVjID0gY2xhc3NUb2tlbkxpc3RbbG9jYWxJbmRleF07XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbiBpbnN0YW5jZW9mIHRva2VuQ2xhc3NTcGVjLlRva2VuQ2xhc3MgJiZcbiAgICAgICAgICAgICAgdG9rZW4uaXNTdWJzZXRPZih0b2tlbkNsYXNzU3BlYy5hcmdMaXN0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIE5vIGNsYXNzZXMgZGVzY3JpYmUgdGhpcyBzZXJpZXMgb2YgdG9rZW5zLCBzbyB1c2UgdGhlIGdlbmVyaWMgd3JhcHBlclxuICAgICAgICByZXR1cm4gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYE11bHRpcGxlIGNsYXNzZXMgZGVzY3JpYmUgdGhlIHNhbWUgaXRlbSEgQXJiaXRyYXJpbHkgY2hvb3Npbmcgb25lLi4uYCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBvdGVudGlhbFdyYXBwZXJzWzBdLldyYXBwZXI7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5qb2luKCcnKTtcbiAgfVxuXG4gIGZvcmsgKHNlbGVjdG9yKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0oe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgbmFtZWRGdW5jdGlvbnM6IHRoaXMubmFtZWRGdW5jdGlvbnMsXG4gICAgICBuYW1lZFN0cmVhbXM6IHRoaXMubmFtZWRTdHJlYW1zLFxuICAgICAgdG9rZW5DbGFzc0xpc3Q6IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKHNlbGVjdG9yKSxcbiAgICAgIGxhdW5jaGVkRnJvbUNsYXNzOiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzLFxuICAgICAgaW5kZXhlczogdGhpcy5pbmRleGVzXG4gICAgfSk7XG4gIH1cblxuICBleHRlbmQgKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICBvcHRpb25zLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZEZ1bmN0aW9ucywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkU3RyZWFtcywgb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge30pO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0LmNvbmNhdChbeyBUb2tlbkNsYXNzLCBhcmdMaXN0IH1dKTtcbiAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzO1xuICAgIG9wdGlvbnMuaW5kZXhlcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaW5kZXhlcywgb3B0aW9ucy5pbmRleGVzIHx8IHt9KTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0sIGhhc2hlcyA9IHt9IH0pIHtcbiAgICBsZXQgd3JhcHBlckluZGV4ID0gMDtcbiAgICBsZXQgdGVtcCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgd2hpbGUgKHRlbXAgIT09IG51bGwpIHtcbiAgICAgIHdyYXBwZXJJbmRleCArPSAxO1xuICAgICAgdGVtcCA9IHRlbXAud3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBuZXcgdGhpcy5XcmFwcGVyc1t3cmFwcGVySW5kZXhdKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXMoaGFzaGVzKS5yZWR1Y2UoKHByb21pc2VMaXN0LCBbaGFzaEZ1bmN0aW9uTmFtZSwgaGFzaF0pID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJbmRleChoYXNoRnVuY3Rpb25OYW1lKTtcbiAgICAgIGlmICghaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgcmV0dXJuIHByb21pc2VMaXN0LmNvbmNhdChbIGluZGV4LmFkZFZhbHVlKGhhc2gsIHdyYXBwZWRJdGVtKSBdKTtcbiAgICAgIH1cbiAgICB9LCBbXSkpO1xuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuXG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgbGFzdFRva2VuID0gdGhpcy50b2tlbkxpc3RbdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEpO1xuICAgIHlpZWxkICogYXdhaXQgbGFzdFRva2VuLml0ZXJhdGUodGVtcCk7XG4gIH1cblxuICBnZXRJbmRleCAoaGFzaEZ1bmN0aW9uTmFtZSkge1xuICAgIGlmICghdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdKSB7XG4gICAgICAvLyBUT0RPOiBpZiB1c2luZyBub2RlLmpzLCBzdGFydCB3aXRoIGV4dGVybmFsIC8gbW9yZSBzY2FsYWJsZSBpbmRleGVzXG4gICAgICB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV0gPSBuZXcgdGhpcy5tdXJlLklOREVYRVMuSW5NZW1vcnlJbmRleCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdO1xuICB9XG5cbiAgYXN5bmMgYnVpbGRJbmRleCAoaGFzaEZ1bmN0aW9uTmFtZSkge1xuICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMubmFtZWRGdW5jdGlvbnNbaGFzaEZ1bmN0aW9uTmFtZV07XG4gICAgaWYgKCFoYXNoRnVuY3Rpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtoYXNoRnVuY3Rpb25OYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXgoaGFzaEZ1bmN0aW9uTmFtZSk7XG4gICAgaWYgKGluZGV4LmNvbXBsZXRlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKCkpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBoYXNoRnVuY3Rpb24od3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgIGluZGV4LmFkZFZhbHVlKGhhc2gsIHdyYXBwZWRJdGVtKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaW5kZXguY29tcGxldGUgPSB0cnVlO1xuICB9XG5cbiAgYXN5bmMgKiBzYW1wbGUgKHsgbGltaXQgPSAxMCwgcmVidWlsZEluZGV4ZXMgPSBmYWxzZSB9KSB7XG4gICAgLy8gQmVmb3JlIHdlIHN0YXJ0LCBjbGVhbiBvdXQgYW55IG9sZCBpbmRleGVzIHRoYXQgd2VyZSBuZXZlciBmaW5pc2hlZFxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuaW5kZXhlcykuZm9yRWFjaCgoW2hhc2hGdW5jdGlvbk5hbWUsIGluZGV4XSkgPT4ge1xuICAgICAgaWYgKHJlYnVpbGRJbmRleGVzIHx8ICFpbmRleC5jb21wbGV0ZSkge1xuICAgICAgICBkZWxldGUgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAvLyBXZSBhY3R1YWxseSBmaW5pc2hlZCBhIGZ1bGwgcGFzczsgZmxhZyBhbGwgb2Ygb3VyIGluZGV4ZXMgYXMgY29tcGxldGVcbiAgICAgICAgT2JqZWN0LnZhbHVlcyh0aGlzLmluZGV4ZXMpLmZvckVhY2goaW5kZXggPT4ge1xuICAgICAgICAgIGluZGV4LmNvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbTtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBCYXNlVG9rZW4gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICAvLyBUaGUgc3RyaW5nIHZlcnNpb24gb2YgbW9zdCB0b2tlbnMgY2FuIGp1c3QgYmUgZGVyaXZlZCBmcm9tIHRoZSBjbGFzcyB0eXBlXG4gICAgcmV0dXJuIGAuJHt0aGlzLnR5cGUudG9Mb3dlckNhc2UoKX0oKWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoKSB7XG4gICAgLy8gQnkgZGVmYXVsdCAod2l0aG91dCBhbnkgYXJndW1lbnRzKSwgdG9rZW5zIG9mIHRoZSBzYW1lIGNsYXNzIGFyZSBzdWJzZXRzXG4gICAgLy8gb2YgZWFjaCBvdGhlclxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVQYXJlbnQgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3QgcGFyZW50VG9rZW4gPSBhbmNlc3RvclRva2Vuc1thbmNlc3RvclRva2Vucy5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0ZW1wID0gYW5jZXN0b3JUb2tlbnMuc2xpY2UoMCwgYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMSk7XG4gICAgbGV0IHlpZWxkZWRTb21ldGhpbmcgPSBmYWxzZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VG9rZW4uaXRlcmF0ZSh0ZW1wKSkge1xuICAgICAgeWllbGRlZFNvbWV0aGluZyA9IHRydWU7XG4gICAgICB5aWVsZCB3cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBpZiAoIXlpZWxkZWRTb21ldGhpbmcgJiYgdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVG9rZW4geWllbGRlZCBubyByZXN1bHRzOiAke3BhcmVudFRva2VufWApO1xuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRW1wdHlUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgLy8geWllbGQgbm90aGluZ1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYGVtcHR5YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRW1wdHlUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBSb290VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudDogbnVsbCxcbiAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgcmF3SXRlbTogdGhpcy5zdHJlYW0ubXVyZS5yb290XG4gICAgfSk7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgcm9vdGA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFJvb3RUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBLZXlzVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBhcmdMaXN0LCB7IG1hdGNoQWxsLCBrZXlzLCByYW5nZXMgfSA9IHt9KSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoa2V5cyB8fCByYW5nZXMpIHtcbiAgICAgIHRoaXMua2V5cyA9IGtleXM7XG4gICAgICB0aGlzLnJhbmdlcyA9IHJhbmdlcztcbiAgICB9IGVsc2UgaWYgKChhcmdMaXN0ICYmIGFyZ0xpc3QubGVuZ3RoID09PSAxICYmIGFyZ0xpc3RbMF0gPT09IHVuZGVmaW5lZCkgfHwgbWF0Y2hBbGwpIHtcbiAgICAgIHRoaXMubWF0Y2hBbGwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdMaXN0LmZvckVhY2goYXJnID0+IHtcbiAgICAgICAgbGV0IHRlbXAgPSBhcmcubWF0Y2goLyhcXGQrKS0oW1xcZOKInl0rKS8pO1xuICAgICAgICBpZiAodGVtcCAmJiB0ZW1wWzJdID09PSAn4oieJykge1xuICAgICAgICAgIHRlbXBbMl0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gdGVtcCA/IHRlbXAubWFwKGQgPT4gZC5wYXJzZUludChkKSkgOiBudWxsO1xuICAgICAgICBpZiAodGVtcCAmJiAhaXNOYU4odGVtcFsxXSkgJiYgIWlzTmFOKHRlbXBbMl0pKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IHRlbXBbMV07IGkgPD0gdGVtcFsyXTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogdGVtcFsxXSwgaGlnaDogdGVtcFsyXSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSBhcmcubWF0Y2goLycoLiopJy8pO1xuICAgICAgICB0ZW1wID0gdGVtcCAmJiB0ZW1wWzFdID8gdGVtcFsxXSA6IGFyZztcbiAgICAgICAgbGV0IG51bSA9IE51bWJlcih0ZW1wKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bSkgfHwgbnVtICE9PSBwYXJzZUludCh0ZW1wKSkgeyAvLyBsZWF2ZSBub24taW50ZWdlciBudW1iZXJzIGFzIHN0cmluZ3NcbiAgICAgICAgICB0aGlzLmtleXMgPSB0aGlzLmtleXMgfHwge307XG4gICAgICAgICAgdGhpcy5rZXlzW3RlbXBdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IG51bSwgaGlnaDogbnVtIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGlmICghdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEJhZCB0b2tlbiBrZXkocykgLyByYW5nZShzKTogJHtKU09OLnN0cmluZ2lmeShhcmdMaXN0KX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICB0aGlzLnJhbmdlcyA9IHRoaXMuY29uc29saWRhdGVSYW5nZXModGhpcy5yYW5nZXMpO1xuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0c05vdGhpbmcgKCkge1xuICAgIHJldHVybiAhdGhpcy5tYXRjaEFsbCAmJiAhdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcztcbiAgfVxuICBjb25zb2xpZGF0ZVJhbmdlcyAocmFuZ2VzKSB7XG4gICAgLy8gTWVyZ2UgYW55IG92ZXJsYXBwaW5nIHJhbmdlc1xuICAgIGNvbnN0IG5ld1JhbmdlcyA9IFtdO1xuICAgIGNvbnN0IHRlbXAgPSByYW5nZXMuc29ydCgoYSwgYikgPT4gYS5sb3cgLSBiLmxvdyk7XG4gICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWN1cnJlbnRSYW5nZSkge1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfSBlbHNlIGlmICh0ZW1wW2ldLmxvdyA8PSBjdXJyZW50UmFuZ2UuaGlnaCkge1xuICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IHRlbXBbaV0uaGlnaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAgIC8vIENvcm5lciBjYXNlOiBhZGQgdGhlIGxhc3QgcmFuZ2VcbiAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgfVxuICAgIHJldHVybiBuZXdSYW5nZXMubGVuZ3RoID4gMCA/IG5ld1JhbmdlcyA6IHVuZGVmaW5lZDtcbiAgfVxuICBkaWZmZXJlbmNlIChvdGhlclRva2VuKSB7XG4gICAgLy8gQ29tcHV0ZSB3aGF0IGlzIGxlZnQgb2YgdGhpcyBhZnRlciBzdWJ0cmFjdGluZyBvdXQgZXZlcnl0aGluZyBpbiBvdGhlclRva2VuXG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgY29tcHV0ZSB0aGUgZGlmZmVyZW5jZSBvZiB0d28gZGlmZmVyZW50IHRva2VuIHR5cGVzYCk7XG4gICAgfSBlbHNlIGlmIChvdGhlclRva2VuLm1hdGNoQWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGNvbnNvbGUud2FybihgSW5hY2N1cmF0ZSBkaWZmZXJlbmNlIGNvbXB1dGVkISBUT0RPOiBuZWVkIHRvIGZpZ3VyZSBvdXQgaG93IHRvIGludmVydCBjYXRlZ29yaWNhbCBrZXlzIWApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld0tleXMgPSB7fTtcbiAgICAgIGZvciAobGV0IGtleSBpbiAodGhpcy5rZXlzIHx8IHt9KSkge1xuICAgICAgICBpZiAoIW90aGVyVG9rZW4ua2V5cyB8fCAhb3RoZXJUb2tlbi5rZXlzW2tleV0pIHtcbiAgICAgICAgICBuZXdLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3UmFuZ2VzID0gW107XG4gICAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgICAgaWYgKG90aGVyVG9rZW4ucmFuZ2VzKSB7XG4gICAgICAgICAgbGV0IGFsbFBvaW50cyA9IHRoaXMucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICBhbGxQb2ludHMgPSBhbGxQb2ludHMuY29uY2F0KG90aGVyVG9rZW4ucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKSkuc29ydCgpO1xuICAgICAgICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0geyBsb3c6IGFsbFBvaW50c1tpXS52YWx1ZSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmV4Y2x1ZGUpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS5sb3cgLSAxO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmxvdyA9IGFsbFBvaW50c1tpXS5oaWdoICsgMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdSYW5nZXMgPSB0aGlzLnJhbmdlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBLZXlzVG9rZW4odGhpcy5tdXJlLCBudWxsLCB7IGtleXM6IG5ld0tleXMsIHJhbmdlczogbmV3UmFuZ2VzIH0pO1xuICAgIH1cbiAgfVxuICBpc1N1YlNldE9mIChhcmdMaXN0KSB7XG4gICAgY29uc3Qgb3RoZXJUb2tlbiA9IG5ldyBLZXlzVG9rZW4odGhpcy5zdHJlYW0sIGFyZ0xpc3QpO1xuICAgIGNvbnN0IGRpZmYgPSBvdGhlclRva2VuLmRpZmZlcmVuY2UodGhpcyk7XG4gICAgcmV0dXJuIGRpZmYgPT09IG51bGwgfHwgZGlmZi5zZWxlY3RzTm90aGluZztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHsgcmV0dXJuICcua2V5cygpJzsgfVxuICAgIHJldHVybiAnLmtleXMoJyArICh0aGlzLnJhbmdlcyB8fCBbXSkubWFwKCh7bG93LCBoaWdofSkgPT4ge1xuICAgICAgcmV0dXJuIGxvdyA9PT0gaGlnaCA/IGxvdyA6IGAke2xvd30tJHtoaWdofWA7XG4gICAgfSkuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMua2V5cyB8fCB7fSkubWFwKGtleSA9PiBgJyR7a2V5fSdgKSlcbiAgICAgIC5qb2luKCcsJykgKyAnKSc7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgICAgZm9yIChsZXQga2V5IGluIHdyYXBwZWRQYXJlbnQucmF3SXRlbSkge1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgICAgbG93ID0gTWF0aC5tYXgoMCwgbG93KTtcbiAgICAgICAgICBoaWdoID0gTWF0aC5taW4od3JhcHBlZFBhcmVudC5yYXdJdGVtLmxlbmd0aCAtIDEsIGhpZ2gpO1xuICAgICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICByYXdJdGVtOiBpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gdGhpcy5rZXlzIHx8IHt9KSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgY29uc3Qgb2JqID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgIGNvbnN0IGtleVR5cGUgPSB0eXBlb2Yga2V5O1xuICAgICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IChrZXlUeXBlICE9PSAnc3RyaW5nJyAmJiBrZXlUeXBlICE9PSAnbnVtYmVyJykpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVmFsdWVUb2tlbiB1c2VkIG9uIGEgbm9uLW9iamVjdCwgb3Igd2l0aG91dCBhIHN0cmluZyAvIG51bWVyaWMga2V5YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgcmF3SXRlbTogb2JqW2tleV1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVmFsdWVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFdmFsdWF0ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gRXZhbHVhdGVUb2tlbiBpcyBub3QgYSBzdHJpbmdgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1N0cmVhbTtcbiAgICAgIHRyeSB7XG4gICAgICAgIG5ld1N0cmVhbSA9IHRoaXMuc3RyZWFtLmZvcmsod3JhcHBlZFBhcmVudC5yYXdJdGVtKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcgfHwgIShlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikpIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkICogYXdhaXQgbmV3U3RyZWFtLml0ZXJhdGUoKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZ2VuZXJhdG9yXSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2dlbmVyYXRvcn1gKTtcbiAgICB9XG4gICAgdGhpcy5nZW5lcmF0b3IgPSBnZW5lcmF0b3I7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLm1hcCgke3RoaXMuZ2VuZXJhdG9yfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvciA9PT0gdGhpcy5nZW5lcmF0b3I7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5nZW5lcmF0b3JdKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgbWFwLCBoYXNoLCByZWR1Y2VJbnN0YW5jZXMgXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLnByb21vdGUoJHt0aGlzLm1hcH0sICR7dGhpcy5oYXNofSwgJHt0aGlzLnJlZHVjZUluc3RhbmNlc30pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwID09PSBtYXAgJiZcbiAgICAgIHRoaXMuaGFzaCA9PT0gaGFzaCAmJlxuICAgICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPT09IHJlZHVjZUluc3RhbmNlcztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG1hcEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5tYXBdO1xuICAgICAgY29uc3QgaGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5oYXNoXTtcbiAgICAgIGNvbnN0IHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5yZWR1Y2VJbnN0YW5jZXNdO1xuICAgICAgY29uc3QgaGFzaEluZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy5oYXNoKTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiBtYXBGdW5jdGlvbih3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICBjb25zdCBoYXNoID0gaGFzaEZ1bmN0aW9uKG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICBsZXQgb3JpZ2luYWxXcmFwcGVkSXRlbSA9IChhd2FpdCBoYXNoSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpKVswXTtcbiAgICAgICAgaWYgKG9yaWdpbmFsV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWR1Y2VJbnN0YW5jZXMgIT09ICdub29wJykge1xuICAgICAgICAgICAgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24ob3JpZ2luYWxXcmFwcGVkSXRlbSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBoYXNoZXMgPSB7fTtcbiAgICAgICAgICBoYXNoZXNbdGhpcy5oYXNoXSA9IGhhc2g7XG4gICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtLFxuICAgICAgICAgICAgaGFzaGVzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEpvaW5Ub2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnZGVmYXVsdEZpbmlzaCcsIGVkZ2VSb2xlID0gJ25vbmUnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIHRoaXNIYXNoLCBmaW5pc2ggXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgdGVtcCA9IHN0cmVhbS5uYW1lZFN0cmVhbXNbb3RoZXJTdHJlYW1dO1xuICAgIGlmICghdGVtcCkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIHN0cmVhbTogJHtvdGhlclN0cmVhbX1gKTtcbiAgICB9XG4gICAgLy8gUmVxdWlyZSBvdGhlckhhc2ggb24gdGhlIG90aGVyIHN0cmVhbSwgb3IgY29weSBvdXJzIG92ZXIgaWYgaXQgaXNuJ3RcbiAgICAvLyBhbHJlYWR5IGRlZmluZWRcbiAgICBpZiAoIXRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gaGFzaCBmdW5jdGlvbiBvbiBlaXRoZXIgc3RyZWFtOiAke290aGVySGFzaH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSA9IHN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMub3RoZXJTdHJlYW0gPSBvdGhlclN0cmVhbTtcbiAgICB0aGlzLnRoaXNIYXNoID0gdGhpc0hhc2g7XG4gICAgdGhpcy5vdGhlckhhc2ggPSBvdGhlckhhc2g7XG4gICAgdGhpcy5maW5pc2ggPSBmaW5pc2g7XG4gICAgdGhpcy5lZGdlUm9sZSA9IGVkZ2VSb2xlO1xuICAgIHRoaXMuaGFzaFRoaXNHcmFuZHBhcmVudCA9IGVkZ2VSb2xlID09PSAnZnVsbCc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLmpvaW4oJHt0aGlzLm90aGVyU3RyZWFtfSwgJHt0aGlzLnRoaXNIYXNofSwgJHt0aGlzLm90aGVySGFzaH0sICR7dGhpcy5maW5pc2h9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBvdGhlclN0cmVhbSwgdGhpc0hhc2ggPSAna2V5Jywgb3RoZXJIYXNoID0gJ2tleScsIGZpbmlzaCA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiB0aGlzLm90aGVyU3RyZWFtID09PSBvdGhlclN0cmVhbSAmJlxuICAgICAgdGhpcy50aGlzSGFzaCA9PT0gdGhpc0hhc2ggJiZcbiAgICAgIHRoaXMub3RoZXJIYXNoID09PSBvdGhlckhhc2ggJiZcbiAgICAgIHRoaXMuZmluaXNoID09PSBmaW5pc2g7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IG90aGVyU3RyZWFtID0gdGhpcy5zdHJlYW0ubmFtZWRTdHJlYW1zW3RoaXMub3RoZXJTdHJlYW1dO1xuICAgIGNvbnN0IHRoaXNIYXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLnRoaXNIYXNoXTtcbiAgICBjb25zdCBvdGhlckhhc2hGdW5jdGlvbiA9IG90aGVyU3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMub3RoZXJIYXNoXTtcbiAgICBjb25zdCBmaW5pc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZmluaXNoXTtcblxuICAgIC8vIGNvbnN0IHRoaXNJdGVyYXRvciA9IHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2Vucyk7XG4gICAgLy8gY29uc3Qgb3RoZXJJdGVyYXRvciA9IG90aGVyU3RyZWFtLml0ZXJhdGUoKTtcblxuICAgIGNvbnN0IHRoaXNJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMudGhpc0hhc2gpO1xuICAgIGNvbnN0IG90aGVySW5kZXggPSBvdGhlclN0cmVhbS5nZXRJbmRleCh0aGlzLm90aGVySGFzaCk7XG5cbiAgICBpZiAodGhpc0luZGV4LmNvbXBsZXRlKSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBCZXN0IG9mIGFsbCB3b3JsZHM7IHdlIGNhbiBqdXN0IGpvaW4gdGhlIGluZGV4ZXNcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IGhhc2gsIHZhbHVlTGlzdCB9IG9mIHRoaXNJbmRleC5pdGVyRW50cmllcygpKSB7XG4gICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdmFsdWVMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIHRoZSBvdGhlciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIG91ciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJTdHJlYW0uaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIG90aGVySGFzaEZ1bmN0aW9uKG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBBZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4OlxuICAgICAgICAgICAgYXdhaXQgb3RoZXJJbmRleC5hZGRWYWx1ZShoYXNoLCBvdGhlcldyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgb3VyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2YgdGhlIG90aGVyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgICAgICAvLyBPZGQgY29ybmVyIGNhc2UgZm9yIGVkZ2VzOyBzb21ldGltZXMgd2Ugd2FudCB0byBoYXNoIHRoZSBncmFuZHBhcmVudCBpbnN0ZWFkIG9mIHRoZSByZXN1bHQgb2ZcbiAgICAgICAgICAvLyBhbiBpbnRlcm1lZGlhdGUgam9pbjpcbiAgICAgICAgICBjb25zdCB0aGlzSGFzaEl0ZW0gPSB0aGlzLmhhc2hUaGlzR3JhbmRwYXJlbnQgPyB0aGlzV3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCA6IHRoaXNXcmFwcGVkSXRlbTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzSGFzaEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgYXdhaXQgdGhpc0luZGV4LmFkZFZhbHVlKGhhc2gsIHRoaXNIYXNoSXRlbSk7XG4gICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWl0aGVyIHN0cmVhbSBpcyBmdWxseSBpbmRleGVkOyBmb3IgbW9yZSBkaXN0cmlidXRlZCBzYW1wbGluZywgZ3JhYlxuICAgICAgICAvLyBvbmUgaXRlbSBmcm9tIGVhY2ggc3RyZWFtIGF0IGEgdGltZSwgYW5kIHVzZSB0aGUgcGFydGlhbCBpbmRleGVzXG4gICAgICAgIGNvbnN0IHRoaXNJdGVyYXRvciA9IHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucywgdGhpcy50aGlzSW5kaXJlY3RLZXkpO1xuICAgICAgICBsZXQgdGhpc0lzRG9uZSA9IGZhbHNlO1xuICAgICAgICBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuICAgICAgICBsZXQgb3RoZXJJc0RvbmUgPSBmYWxzZTtcblxuICAgICAgICB3aGlsZSAoIXRoaXNJc0RvbmUgfHwgIW90aGVySXNEb25lKSB7XG4gICAgICAgICAgLy8gVGFrZSBvbmUgc2FtcGxlIGZyb20gdGhpcyBzdHJlYW1cbiAgICAgICAgICBsZXQgdGVtcCA9IGF3YWl0IHRoaXNJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgdGhpc0lzRG9uZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICAvLyBPZGQgY29ybmVyIGNhc2UgZm9yIGVkZ2VzOyBzb21ldGltZXMgd2Ugd2FudCB0byBoYXNoIHRoZSBncmFuZHBhcmVudCBpbnN0ZWFkIG9mIHRoZSByZXN1bHQgb2ZcbiAgICAgICAgICAgIC8vIGFuIGludGVybWVkaWF0ZSBqb2luOlxuICAgICAgICAgICAgY29uc3QgdGhpc0hhc2hJdGVtID0gdGhpcy5oYXNoVGhpc0dyYW5kcGFyZW50ID8gdGhpc1dyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgOiB0aGlzV3JhcHBlZEl0ZW07XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzSGFzaEl0ZW0pKSB7XG4gICAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICAgIHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzSGFzaEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm93IGZvciBhIHNhbXBsZSBmcm9tIHRoZSBvdGhlciBzdHJlYW1cbiAgICAgICAgICB0ZW1wID0gYXdhaXQgb3RoZXJJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgb3RoZXJJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBvdGhlcldyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4XG4gICAgICAgICAgICAgIG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBKb2luVG9rZW47XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi4vU3RyZWFtLmpzJztcblxuY29uc3QgQVNURVJJU0tTID0ge1xuICAnZXZhbHVhdGUnOiAn4oasJyxcbiAgJ2pvaW4nOiAn4qivJyxcbiAgJ21hcCc6ICfihqYnLFxuICAncHJvbW90ZSc6ICfihpEnLFxuICAndmFsdWUnOiAn4oaSJ1xufTtcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLl9zZWxlY3RvciA9IG9wdGlvbnMuc2VsZWN0b3I7XG4gICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSBvcHRpb25zLmN1c3RvbUNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPSBvcHRpb25zLmN1c3RvbU5hbWVUb2tlbkluZGV4IHx8IG51bGw7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIGlmICh0eXBlb2YgZnVuYyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBuZXcgRnVuY3Rpb24oYHJldHVybiAke2Z1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLl9zZWxlY3RvcjtcbiAgfVxuICBnZXQgdG9rZW5DbGFzc0xpc3QgKCkge1xuICAgIHJldHVybiB0aGlzLm11cmUucGFyc2VTZWxlY3Rvcih0aGlzLnNlbGVjdG9yKTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NUeXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBzZWxlY3RvcjogdGhpcy5fc2VsZWN0b3IsXG4gICAgICBjdXN0b21DbGFzc05hbWU6IHRoaXMuY3VzdG9tQ2xhc3NOYW1lLFxuICAgICAgY3VzdG9tTmFtZVRva2VuSW5kZXg6IHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXgsXG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBpbmRleGVzOiB7fSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB7fVxuICAgIH07XG4gICAgZm9yIChsZXQgW2Z1bmNOYW1lLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm5hbWVkRnVuY3Rpb25zKSkge1xuICAgICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgICAgcmVzdWx0Lm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IHN0cmluZ2lmaWVkRnVuYztcbiAgICB9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXModGhpcy5pbmRleGVzKS5tYXAoYXN5bmMgKFtmdW5jTmFtZSwgaW5kZXhdKSA9PiB7XG4gICAgICBpZiAoaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgcmVzdWx0LmluZGV4ZXNbZnVuY05hbWVdID0gYXdhaXQgaW5kZXgudG9SYXdPYmplY3QoKTtcbiAgICAgIH1cbiAgICB9KSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSB2YWx1ZSkge1xuICAgICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSB2YWx1ZTtcbiAgICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPSB0aGlzLnNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKS5sZW5ndGg7XG4gICAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICB9XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gbnVsbCAmJlxuICAgICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9PT0gdGhpcy5zZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZykubGVuZ3RoO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIGNvbnN0IHNlbGVjdG9yID0gdGhpcy5zZWxlY3RvcjtcbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgIGZvciAobGV0IGkgPSB0b2tlblN0cmluZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmICh0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gbnVsbCAmJiBpIDw9IHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VzdG9tQ2xhc3NOYW1lICsgcmVzdWx0O1xuICAgICAgfVxuICAgICAgY29uc3QgdGVtcCA9IHRva2VuU3RyaW5nc1tpXS5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKHRlbXBbMV0gPT09ICdrZXlzJyB8fCB0ZW1wWzFdID09PSAndmFsdWVzJykge1xuICAgICAgICBpZiAodGVtcFsyXSA9PT0gJycpIHtcbiAgICAgICAgICByZXN1bHQgPSAnKicgKyByZXN1bHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0ID0gdGVtcFsyXS5yZXBsYWNlKC8nKFteJ10qKScvLCAnJDEnKSArIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gQVNURVJJU0tTW3RlbXBbMV1dICsgcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gKHNlbGVjdG9yLnN0YXJ0c1dpdGgoJ2VtcHR5JykgPyAn4oiFJyA6ICcnKSArIHJlc3VsdDtcbiAgfVxuICBzZXROYW1lZEZ1bmN0aW9uIChmdW5jTmFtZSwgZnVuYykge1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gZnVuYztcbiAgfVxuICBwb3B1bGF0ZVN0cmVhbU9wdGlvbnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdDtcbiAgICBvcHRpb25zLm5hbWVkRnVuY3Rpb25zID0gdGhpcy5uYW1lZEZ1bmN0aW9ucztcbiAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gdGhpcztcbiAgICBvcHRpb25zLmluZGV4ZXMgPSB0aGlzLmluZGV4ZXM7XG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cbiAgZ2V0U3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAob3B0aW9ucy5yZXNldCB8fCAhdGhpcy5fc3RyZWFtKSB7XG4gICAgICB0aGlzLl9zdHJlYW0gPSBuZXcgU3RyZWFtKHRoaXMucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbTtcbiAgfVxuICBpc1N1cGVyU2V0T2ZUb2tlbkxpc3QgKHRva2VuTGlzdCkge1xuICAgIGlmICh0b2tlbkxpc3QubGVuZ3RoICE9PSB0aGlzLnRva2VuTGlzdC5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmV2ZXJ5KCh0b2tlbiwgaSkgPT4gdG9rZW4uaXNTdXBlclNldE9mKHRva2VuTGlzdFtpXSkpO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhd2FpdCB0aGlzLnRvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF0gPSBuZXcgdGhpcy5tdXJlLkNMQVNTRVMuTm9kZUNsYXNzKG9wdGlvbnMpO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhd2FpdCB0aGlzLnRvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF0gPSBuZXcgdGhpcy5tdXJlLkNMQVNTRVMuRWRnZUNsYXNzKG9wdGlvbnMpO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICB9XG4gIGFzeW5jIGFnZ3JlZ2F0ZSAoaGFzaCwgcmVkdWNlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZXhwYW5kIChtYXApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBmaWx0ZXIgKGZpbHRlcikge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIHNwbGl0IChoYXNoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZGVsZXRlICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXI7XG4gICAgdGhpcy5lZGdlQ29ubmVjdGlvbnMgPSBvcHRpb25zLmVkZ2VDb25uZWN0aW9ucyB8fCB7fTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgLy8gVE9ETzogYSBiYWJlbCBidWcgKGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMzkzMClcbiAgICAvLyBwcmV2ZW50cyBgYXdhaXQgc3VwZXJgOyB0aGlzIGlzIGEgd29ya2Fyb3VuZDpcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBHZW5lcmljQ2xhc3MucHJvdG90eXBlLnRvUmF3T2JqZWN0LmNhbGwodGhpcyk7XG4gICAgLy8gVE9ETzogbmVlZCB0byBkZWVwIGNvcHkgZWRnZUNvbm5lY3Rpb25zP1xuICAgIHJlc3VsdC5lZGdlQ29ubmVjdGlvbnMgPSB0aGlzLmVkZ2VDb25uZWN0aW9ucztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIHRoaXNIYXNoTmFtZSwgb3RoZXJIYXNoTmFtZSB9KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG5cbiAgICBpZiAoIXRoaXMuX3NlbGVjdG9yKSB7XG4gICAgICBpZiAoIXNvdXJjZUNsYXNzIHx8ICF0YXJnZXRDbGFzcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcnRpYWwgY29ubmVjdGlvbnMgd2l0aG91dCBhbiBlZGdlIHRhYmxlIHNob3VsZCBuZXZlciBoYXBwZW5gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vIGVkZ2UgdGFibGUgKHNpbXBsZSBqb2luIGJldHdlZW4gdHdvIG5vZGVzKVxuICAgICAgICBjb25zdCBzb3VyY2VIYXNoID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0ubm9kZUhhc2hOYW1lO1xuICAgICAgICBjb25zdCB0YXJnZXRIYXNoID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0ubm9kZUhhc2hOYW1lO1xuICAgICAgICByZXR1cm4gc291cmNlQ2xhc3Muc2VsZWN0b3IgKyBgLmpvaW4odGFyZ2V0LCAke3NvdXJjZUhhc2h9LCAke3RhcmdldEhhc2h9LCBkZWZhdWx0RmluaXNoLCBzb3VyY2VUYXJnZXQpYDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHJlc3VsdCA9IHRoaXMuX3NlbGVjdG9yO1xuICAgICAgaWYgKCFzb3VyY2VDbGFzcykge1xuICAgICAgICBpZiAoIXRhcmdldENsYXNzKSB7XG4gICAgICAgICAgLy8gTm8gY29ubmVjdGlvbnMgeWV0OyBqdXN0IHlpZWxkIHRoZSByYXcgZWRnZSB0YWJsZVxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gUGFydGlhbCBlZGdlLXRhcmdldCBjb25uZWN0aW9uc1xuICAgICAgICAgIGNvbnN0IHsgZWRnZUhhc2hOYW1lLCBub2RlSGFzaE5hbWUgfSA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICAgIHJldHVybiByZXN1bHQgKyBgLmpvaW4odGFyZ2V0LCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaCwgZWRnZVRhcmdldClgO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCF0YXJnZXRDbGFzcykge1xuICAgICAgICAvLyBQYXJ0aWFsIHNvdXJjZS1lZGdlIGNvbm5lY3Rpb25zXG4gICAgICAgIGNvbnN0IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICByZXR1cm4gcmVzdWx0ICsgYC5qb2luKHNvdXJjZSwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gsIHNvdXJjZUVkZ2UpYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZ1bGwgY29ubmVjdGlvbnNcbiAgICAgICAgbGV0IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICByZXN1bHQgKz0gYC5qb2luKHNvdXJjZSwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gpYDtcbiAgICAgICAgKHsgZWRnZUhhc2hOYW1lLCBub2RlSGFzaE5hbWUgfSA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdKTtcbiAgICAgICAgcmVzdWx0ICs9IGAuam9pbih0YXJnZXQsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoLCBmdWxsKWA7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHBvcHVsYXRlU3RyZWFtT3B0aW9ucyAob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBvcHRpb25zLm5hbWVkU3RyZWFtcyA9IHt9O1xuICAgIGlmICghdGhpcy5fc2VsZWN0b3IpIHtcbiAgICAgIC8vIFVzZSB0aGUgb3B0aW9ucyBmcm9tIHRoZSBzb3VyY2Ugc3RyZWFtIGluc3RlYWQgb2Ygb3VyIGNsYXNzXG4gICAgICBvcHRpb25zID0gc291cmNlQ2xhc3MucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpO1xuICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMudGFyZ2V0ID0gdGFyZ2V0Q2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMgPSBzdXBlci5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICBpZiAoc291cmNlQ2xhc3MpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMuc291cmNlID0gc291cmNlQ2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgICB9XG4gICAgICBpZiAodGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMudGFyZ2V0ID0gdGFyZ2V0Q2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICAvLyBUT0RPOiBhIGJhYmVsIGJ1ZyAoaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8zOTMwKVxuICAgIC8vIHByZXZlbnRzIGBhd2FpdCBzdXBlcmA7IHRoaXMgaXMgYSB3b3JrYXJvdW5kOlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEdlbmVyaWNDbGFzcy5wcm90b3R5cGUudG9SYXdPYmplY3QuY2FsbCh0aGlzKTtcbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgYXN5bmMgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgZGlyZWN0aW9uLCBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICB9XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNvdXJjZSBhbmQgdGFyZ2V0IGFyZSBhbHJlYWR5IGRlZmluZWQ7IHBsZWFzZSBzcGVjaWZ5IGEgZGlyZWN0aW9uIHRvIG92ZXJyaWRlYCk7XG4gICAgICB9XG4gICAgfVxuICAgIG5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXSA9IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfTtcbiAgICBkZWxldGUgdGhpcy5fc3RyZWFtO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy53cmFwcGVkUGFyZW50ID0gd3JhcHBlZFBhcmVudDtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5yYXdJdGVtID0gcmF3SXRlbTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gICAgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnc291cmNlVGFyZ2V0Jykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBzb3VyY2U6IHRoaXMucmF3SXRlbS5sZWZ0LFxuICAgICAgICB0YXJnZXQ6IHRoaXMucmF3SXRlbS5yaWdodFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnZWRnZVRhcmdldCcpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgZWRnZTogdGhpcy5yYXdJdGVtLmxlZnQsXG4gICAgICAgIHRhcmdldDogdGhpcy5yYXdJdGVtLnJpZ2h0XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdzb3VyY2VFZGdlJykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBzb3VyY2U6IHRoaXMucmF3SXRlbS5yaWdodCxcbiAgICAgICAgZWRnZTogdGhpcy5yYXdJdGVtLmxlZnRcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ2Z1bGwnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIHNvdXJjZTogdGhpcy5yYXdJdGVtLmxlZnQucmlnaHQsXG4gICAgICAgIGVkZ2U6IHRoaXMucmF3SXRlbS5sZWZ0LmxlZnQsXG4gICAgICAgIHRhcmdldDogdGhpcy5yYXdJdGVtLnJpZ2h0XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gZWRnZVJvbGU6ICR7dG9rZW4uZWRnZVJvbGV9YCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiY2xhc3MgSW5NZW1vcnlJbmRleCB7XG4gIGNvbnN0cnVjdG9yICh7IGVudHJpZXMgPSB7fSwgY29tcGxldGUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICAgIHRoaXMuY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcztcbiAgfVxuICBhc3luYyAqIGl0ZXJFbnRyaWVzICgpIHtcbiAgICBmb3IgKGNvbnN0IFtoYXNoLCB2YWx1ZUxpc3RdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHsgaGFzaCwgdmFsdWVMaXN0IH07XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlckhhc2hlcyAoKSB7XG4gICAgZm9yIChjb25zdCBoYXNoIG9mIE9iamVjdC5rZXlzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIGhhc2g7XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlclZhbHVlTGlzdHMgKCkge1xuICAgIGZvciAoY29uc3QgdmFsdWVMaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgdmFsdWVMaXN0O1xuICAgIH1cbiAgfVxuICBhc3luYyBnZXRWYWx1ZUxpc3QgKGhhc2gpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzW2hhc2hdIHx8IFtdO1xuICB9XG4gIGFzeW5jIGFkZFZhbHVlIChoYXNoLCB2YWx1ZSkge1xuICAgIC8vIFRPRE86IGFkZCBzb21lIGtpbmQgb2Ygd2FybmluZyBpZiB0aGlzIGlzIGdldHRpbmcgYmlnP1xuICAgIHRoaXMuZW50cmllc1toYXNoXSA9IGF3YWl0IHRoaXMuZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgIGlmICh0aGlzLmVudHJpZXNbaGFzaF0uaW5kZXhPZih2YWx1ZSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbk1lbW9yeUluZGV4O1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4vU3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIFRPS0VOUyBmcm9tICcuL1Rva2Vucy9Ub2tlbnMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcbmltcG9ydCAqIGFzIElOREVYRVMgZnJvbSAnLi9JbmRleGVzL0luZGV4ZXMuanMnO1xuXG5sZXQgTkVYVF9DTEFTU19JRCA9IDE7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBtdXJlLmRlYnVnIHRvIHRydWUgdG8gZGVidWcgc3RyZWFtc1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UT0tFTlMgPSBUT0tFTlM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIE1vbmtleS1wYXRjaCBhdmFpbGFibGUgdG9rZW5zIGFzIGZ1bmN0aW9ucyBvbnRvIHRoZSBTdHJlYW0gY2xhc3NcbiAgICBmb3IgKGNvbnN0IHRva2VuQ2xhc3NOYW1lIGluIHRoaXMuVE9LRU5TKSB7XG4gICAgICBjb25zdCBUb2tlbkNsYXNzID0gdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdO1xuICAgICAgU3RyZWFtLnByb3RvdHlwZVtUb2tlbkNsYXNzLmxvd2VyQ2FtZWxDYXNlVHlwZV0gPSBmdW5jdGlvbiAoYXJnTGlzdCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5leHRlbmQoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIHtcbiAgICAgICAgICBsZWZ0OiB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICByaWdodDogb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMucm9vdCA9IHRoaXMubG9hZFJvb3QoKTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMubG9hZENsYXNzZXMoKTtcbiAgfVxuXG4gIGxvYWRSb290ICgpIHtcbiAgICBsZXQgcm9vdCA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ211cmVfcm9vdCcpO1xuICAgIHJvb3QgPSByb290ID8gSlNPTi5wYXJzZShyb290KSA6IHt9O1xuICAgIHJldHVybiByb290O1xuICB9XG4gIGFzeW5jIHNhdmVSb290ICgpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ211cmVfcm9vdCcsIEpTT04uc3RyaW5naWZ5KHRoaXMucm9vdCkpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jvb3RVcGRhdGUnKTtcbiAgfVxuICBsb2FkQ2xhc3NlcyAoKSB7XG4gICAgbGV0IGNsYXNzZXMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX2NsYXNzZXMnKTtcbiAgICBjbGFzc2VzID0gY2xhc3NlcyA/IEpTT04ucGFyc2UoY2xhc3NlcykgOiB7fTtcbiAgICBPYmplY3QuZW50cmllcyhjbGFzc2VzKS5mb3JFYWNoKChbIGNsYXNzSWQsIHJhd0NsYXNzT2JqIF0pID0+IHtcbiAgICAgIE9iamVjdC5lbnRyaWVzKHJhd0NsYXNzT2JqLmluZGV4ZXMpLmZvckVhY2goKFtmdW5jTmFtZSwgcmF3SW5kZXhPYmpdKSA9PiB7XG4gICAgICAgIHJhd0NsYXNzT2JqLmluZGV4ZXNbZnVuY05hbWVdID0gbmV3IHRoaXMuSU5ERVhFUy5Jbk1lbW9yeUluZGV4KHtcbiAgICAgICAgICBlbnRyaWVzOiByYXdJbmRleE9iaiwgY29tcGxldGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNsYXNzVHlwZSA9IHJhd0NsYXNzT2JqLmNsYXNzVHlwZTtcbiAgICAgIGRlbGV0ZSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICByYXdDbGFzc09iai5tdXJlID0gdGhpcztcbiAgICAgIGNsYXNzZXNbY2xhc3NJZF0gPSBuZXcgdGhpcy5DTEFTU0VTW2NsYXNzVHlwZV0ocmF3Q2xhc3NPYmopO1xuICAgIH0pO1xuICAgIHJldHVybiBjbGFzc2VzO1xuICB9XG4gIGFzeW5jIHNhdmVDbGFzc2VzICgpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJhd0NsYXNzZXMgPSB7fTtcbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKHRoaXMuY2xhc3NlcylcbiAgICAgICAgLm1hcChhc3luYyAoWyBjbGFzc0lkLCBjbGFzc09iaiBdKSA9PiB7XG4gICAgICAgICAgcmF3Q2xhc3Nlc1tjbGFzc0lkXSA9IGF3YWl0IGNsYXNzT2JqLnRvUmF3T2JqZWN0KCk7XG4gICAgICAgIH0pKTtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ211cmVfY2xhc3NlcycsIEpTT04uc3RyaW5naWZ5KHJhd0NsYXNzZXMpKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdjbGFzc1VwZGF0ZScpO1xuICB9XG5cbiAgcGFyc2VTZWxlY3RvciAoc2VsZWN0b3JTdHJpbmcpIHtcbiAgICBjb25zdCBzdGFydHNXaXRoUm9vdCA9IHNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ3Jvb3QnKTtcbiAgICBpZiAoIShzdGFydHNXaXRoUm9vdCB8fCBzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdlbXB0eScpKSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBTZWxlY3RvcnMgbXVzdCBzdGFydCB3aXRoICdyb290JyBvciAnZW1wdHknYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5DbGFzc0xpc3QgPSBbe1xuICAgICAgVG9rZW5DbGFzczogc3RhcnRzV2l0aFJvb3QgPyB0aGlzLlRPS0VOUy5Sb290VG9rZW4gOiB0aGlzLlRPS0VOUy5FbXB0eVRva2VuXG4gICAgfV07XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4ge1xuICAgICAgICBkID0gZC50cmltKCk7XG4gICAgICAgIHJldHVybiBkID09PSAnJyA/IHVuZGVmaW5lZCA6IGQ7XG4gICAgICB9KTtcbiAgICAgIGlmICh0b2tlbkNsYXNzTmFtZSA9PT0gJ1ZhbHVlc1Rva2VuJykge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5LZXlzVG9rZW4sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuVmFsdWVUb2tlblxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSxcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIHRva2VuOiAke3RlbXBbMV19YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRva2VuQ2xhc3NMaXN0O1xuICB9XG5cbiAgc3RyZWFtIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IgfHwgYHJvb3QudmFsdWVzKClgKTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIG5ld0NsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYHJvb3RgIH0pIHtcbiAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke05FWFRfQ0xBU1NfSUR9YDtcbiAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgY29uc3QgQ2xhc3NUeXBlID0gb3B0aW9ucy5DbGFzc1R5cGUgfHwgdGhpcy5DTEFTU0VTLkdlbmVyaWNDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5DbGFzc1R5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDbGFzc1R5cGUob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY0RhdGFTb3VyY2UoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2Uoe1xuICAgICAga2V5OiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAga2V5LFxuICAgIGV4dGVuc2lvbiA9ICd0eHQnLFxuICAgIHRleHRcbiAgfSkge1xuICAgIGxldCBvYmo7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIG9iaiA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgZGVsZXRlIG9iai5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY0RhdGFTb3VyY2Uoa2V5LCBvYmopO1xuICB9XG4gIGFzeW5jIGFkZFN0YXRpY0RhdGFTb3VyY2UgKGtleSwgb2JqKSB7XG4gICAgdGhpcy5yb290W2tleV0gPSBvYmo7XG4gICAgY29uc3QgdGVtcCA9IGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLnNhdmVSb290KCksIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IGByb290LnZhbHVlcygnJHtrZXl9JykudmFsdWVzKClgXG4gICAgfSldKTtcbiAgICByZXR1cm4gdGVtcFsxXTtcbiAgfVxuICBhc3luYyByZW1vdmVEYXRhU291cmNlIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5yb290W2tleV07XG4gICAgYXdhaXQgdGhpcy5zYXZlUm9vdCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsIm9mZiIsImluZGV4Iiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5Iiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiT2JqZWN0IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJTdHJlYW0iLCJvcHRpb25zIiwibXVyZSIsIm5hbWVkRnVuY3Rpb25zIiwiTkFNRURfRlVOQ1RJT05TIiwibmFtZWRTdHJlYW1zIiwibGF1bmNoZWRGcm9tQ2xhc3MiLCJpbmRleGVzIiwidG9rZW5DbGFzc0xpc3QiLCJ0b2tlbkxpc3QiLCJtYXAiLCJUb2tlbkNsYXNzIiwiYXJnTGlzdCIsIldyYXBwZXJzIiwiZ2V0V3JhcHBlckxpc3QiLCJ0b2tlbiIsImxlbmd0aCIsIldyYXBwZXIiLCJsb2NhbFRva2VuTGlzdCIsInNsaWNlIiwicG90ZW50aWFsV3JhcHBlcnMiLCJ2YWx1ZXMiLCJjbGFzc2VzIiwiZmlsdGVyIiwiY2xhc3NPYmoiLCJjbGFzc1Rva2VuTGlzdCIsImV2ZXJ5IiwibG9jYWxUb2tlbiIsImxvY2FsSW5kZXgiLCJ0b2tlbkNsYXNzU3BlYyIsImlzU3Vic2V0T2YiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwiY29uc29sZSIsIndhcm4iLCJzZWxlY3RvciIsImpvaW4iLCJmb3JrIiwicGFyc2VTZWxlY3RvciIsImV4dGVuZCIsImNvbmNhdCIsIndyYXAiLCJ3cmFwcGVkUGFyZW50IiwicmF3SXRlbSIsImhhc2hlcyIsIndyYXBwZXJJbmRleCIsInRlbXAiLCJ3cmFwcGVkSXRlbSIsIlByb21pc2UiLCJhbGwiLCJlbnRyaWVzIiwicmVkdWNlIiwicHJvbWlzZUxpc3QiLCJoYXNoRnVuY3Rpb25OYW1lIiwiaGFzaCIsImdldEluZGV4IiwiY29tcGxldGUiLCJhZGRWYWx1ZSIsIml0ZXJhdGUiLCJsYXN0VG9rZW4iLCJJTkRFWEVTIiwiSW5NZW1vcnlJbmRleCIsImJ1aWxkSW5kZXgiLCJoYXNoRnVuY3Rpb24iLCJFcnJvciIsInNhbXBsZSIsImxpbWl0IiwicmVidWlsZEluZGV4ZXMiLCJpdGVyYXRvciIsIm5leHQiLCJkb25lIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b1N0cmluZyIsInRvTG93ZXJDYXNlIiwiaXNTdWJTZXRPZiIsImFuY2VzdG9yVG9rZW5zIiwiaXRlcmF0ZVBhcmVudCIsInBhcmVudFRva2VuIiwieWllbGRlZFNvbWV0aGluZyIsImRlYnVnIiwiVHlwZUVycm9yIiwiZXhlYyIsIm5hbWUiLCJFbXB0eVRva2VuIiwiUm9vdFRva2VuIiwicm9vdCIsIktleXNUb2tlbiIsIm1hdGNoQWxsIiwia2V5cyIsInJhbmdlcyIsInVuZGVmaW5lZCIsImFyZyIsIm1hdGNoIiwiSW5maW5pdHkiLCJkIiwicGFyc2VJbnQiLCJpc05hTiIsImxvdyIsImhpZ2giLCJudW0iLCJOdW1iZXIiLCJTeW50YXhFcnJvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJjb25zb2xpZGF0ZVJhbmdlcyIsInNlbGVjdHNOb3RoaW5nIiwibmV3UmFuZ2VzIiwic29ydCIsImEiLCJiIiwiY3VycmVudFJhbmdlIiwiZGlmZmVyZW5jZSIsIm90aGVyVG9rZW4iLCJuZXdLZXlzIiwia2V5IiwiYWxsUG9pbnRzIiwiYWdnIiwicmFuZ2UiLCJpbmNsdWRlIiwiZXhjbHVkZSIsImRpZmYiLCJNYXRoIiwibWF4IiwibWluIiwiaGFzT3duUHJvcGVydHkiLCJWYWx1ZVRva2VuIiwib2JqIiwia2V5VHlwZSIsIkV2YWx1YXRlVG9rZW4iLCJuZXdTdHJlYW0iLCJlcnIiLCJNYXBUb2tlbiIsImdlbmVyYXRvciIsIm1hcHBlZFJhd0l0ZW0iLCJQcm9tb3RlVG9rZW4iLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwibWFwRnVuY3Rpb24iLCJyZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiIsImhhc2hJbmRleCIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJnZXRWYWx1ZUxpc3QiLCJKb2luVG9rZW4iLCJvdGhlclN0cmVhbSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiZmluaXNoIiwiZWRnZVJvbGUiLCJoYXNoVGhpc0dyYW5kcGFyZW50IiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwidmFsdWVMaXN0IiwiaXRlckVudHJpZXMiLCJvdGhlckxpc3QiLCJvdGhlcldyYXBwZWRJdGVtIiwidGhpc1dyYXBwZWRJdGVtIiwidGhpc0xpc3QiLCJ0aGlzSGFzaEl0ZW0iLCJ0aGlzSXRlcmF0b3IiLCJ0aGlzSW5kaXJlY3RLZXkiLCJ0aGlzSXNEb25lIiwib3RoZXJJdGVyYXRvciIsIm90aGVySXNEb25lIiwiQVNURVJJU0tTIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9zZWxlY3RvciIsImN1c3RvbUNsYXNzTmFtZSIsImN1c3RvbU5hbWVUb2tlbkluZGV4IiwiZnVuY05hbWUiLCJGdW5jdGlvbiIsInRvUmF3T2JqZWN0IiwicmVzdWx0IiwiY2xhc3NUeXBlIiwic3RyaW5naWZpZWRGdW5jIiwic2V0Q2xhc3NOYW1lIiwic2F2ZUNsYXNzZXMiLCJoYXNDdXN0b21OYW1lIiwiY2xhc3NOYW1lIiwidG9rZW5TdHJpbmdzIiwic3RhcnRzV2l0aCIsInNldE5hbWVkRnVuY3Rpb24iLCJwb3B1bGF0ZVN0cmVhbU9wdGlvbnMiLCJnZXRTdHJlYW0iLCJyZXNldCIsIl9zdHJlYW0iLCJpc1N1cGVyU2V0T2ZUb2tlbkxpc3QiLCJpc1N1cGVyU2V0T2YiLCJpbnRlcnByZXRBc05vZGVzIiwiQ0xBU1NFUyIsIk5vZGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJFZGdlQ2xhc3MiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJzcGxpdCIsImRlbGV0ZSIsIk5vZGVXcmFwcGVyIiwiZWRnZUNvbm5lY3Rpb25zIiwicHJvdG90eXBlIiwiY2FsbCIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm5vZGVDbGFzcyIsInRoaXNIYXNoTmFtZSIsIm90aGVySGFzaE5hbWUiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJlZGdlQ2xhc3MiLCJFZGdlV3JhcHBlciIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiZGlyZWN0ZWQiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwic291cmNlSGFzaCIsIm5vZGVIYXNoTmFtZSIsInRhcmdldEhhc2giLCJlZGdlSGFzaE5hbWUiLCJ0YXJnZXQiLCJzb3VyY2UiLCJkaXJlY3Rpb24iLCJsZWZ0IiwicmlnaHQiLCJlZGdlIiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiTkVYVF9DTEFTU19JRCIsIk11cmUiLCJGaWxlUmVhZGVyIiwibG9jYWxTdG9yYWdlIiwibWltZSIsIkRBVEFMSUJfRk9STUFUUyIsIlRPS0VOUyIsInRva2VuQ2xhc3NOYW1lIiwiaWRlbnRpdHkiLCJwYXJlbnRUeXBlIiwiZGVmYXVsdEZpbmlzaCIsInNoYTEiLCJub29wIiwibG9hZFJvb3QiLCJsb2FkQ2xhc3NlcyIsImdldEl0ZW0iLCJwYXJzZSIsInNhdmVSb290Iiwic2V0SXRlbSIsInJhd0NsYXNzT2JqIiwicmF3SW5kZXhPYmoiLCJyYXdDbGFzc2VzIiwic2VsZWN0b3JTdHJpbmciLCJzdGFydHNXaXRoUm9vdCIsImNodW5rIiwidG9VcHBlckNhc2UiLCJ0cmltIiwibmV3Q2xhc3MiLCJDbGFzc1R5cGUiLCJhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJ0ZXh0IiwicmVzb2x2ZSIsInJlamVjdCIsInJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNEYXRhU291cmNlIiwicmVt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
