'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var sha1 = _interopDefault(require('sha1'));
var FileReader = _interopDefault(require('filereader'));

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
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node

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

let mure = new Mure(FileReader, null);
mure.version = pkg.version;

module.exports = mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIHRoaXMubmFtZWRTdHJlYW1zID0gb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge307XG4gICAgdGhpcy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgbnVsbDtcbiAgICB0aGlzLmluZGV4ZXMgPSBvcHRpb25zLmluZGV4ZXMgfHwge307XG4gICAgdGhpcy50b2tlbkNsYXNzTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgfHwgW107XG5cbiAgICAvLyBSZW1pbmRlcjogdGhpcyBhbHdheXMgbmVlZHMgdG8gYmUgYWZ0ZXIgaW5pdGlhbGl6aW5nIHRoaXMubmFtZWRGdW5jdGlvbnNcbiAgICAvLyBhbmQgdGhpcy5uYW1lZFN0cmVhbXNcbiAgICB0aGlzLnRva2VuTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QubWFwKCh7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBUb2tlbkNsYXNzKHRoaXMsIGFyZ0xpc3QpO1xuICAgIH0pO1xuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy50b2tlbkxpc3RcbiAgICB0aGlzLldyYXBwZXJzID0gdGhpcy5nZXRXcmFwcGVyTGlzdCgpO1xuICB9XG5cbiAgZ2V0V3JhcHBlckxpc3QgKCkge1xuICAgIC8vIExvb2sgdXAgd2hpY2gsIGlmIGFueSwgY2xhc3NlcyBkZXNjcmliZSB0aGUgcmVzdWx0IG9mIGVhY2ggdG9rZW4sIHNvIHRoYXRcbiAgICAvLyB3ZSBjYW4gd3JhcCBpdGVtcyBhcHByb3ByaWF0ZWx5OlxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5tYXAoKHRva2VuLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKGluZGV4ID09PSB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxICYmIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MpIHtcbiAgICAgICAgLy8gSWYgdGhpcyBzdHJlYW0gd2FzIHN0YXJ0ZWQgZnJvbSBhIGNsYXNzLCB3ZSBhbHJlYWR5IGtub3cgd2Ugc2hvdWxkXG4gICAgICAgIC8vIHVzZSB0aGF0IGNsYXNzJ3Mgd3JhcHBlciBmb3IgdGhlIGxhc3QgdG9rZW5cbiAgICAgICAgcmV0dXJuIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MuV3JhcHBlcjtcbiAgICAgIH1cbiAgICAgIC8vIEZpbmQgYSBjbGFzcyB0aGF0IGRlc2NyaWJlcyBleGFjdGx5IGVhY2ggc2VyaWVzIG9mIHRva2Vuc1xuICAgICAgY29uc3QgbG9jYWxUb2tlbkxpc3QgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCBpbmRleCArIDEpO1xuICAgICAgY29uc3QgcG90ZW50aWFsV3JhcHBlcnMgPSBPYmplY3QudmFsdWVzKHRoaXMubXVyZS5jbGFzc2VzKVxuICAgICAgICAuZmlsdGVyKGNsYXNzT2JqID0+IHtcbiAgICAgICAgICBjb25zdCBjbGFzc1Rva2VuTGlzdCA9IGNsYXNzT2JqLnRva2VuQ2xhc3NMaXN0O1xuICAgICAgICAgIGlmICghY2xhc3NUb2tlbkxpc3QubGVuZ3RoICE9PSBsb2NhbFRva2VuTGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW5MaXN0LmV2ZXJ5KChsb2NhbFRva2VuLCBsb2NhbEluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbkNsYXNzU3BlYyA9IGNsYXNzVG9rZW5MaXN0W2xvY2FsSW5kZXhdO1xuICAgICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW4gaW5zdGFuY2VvZiB0b2tlbkNsYXNzU3BlYy5Ub2tlbkNsYXNzICYmXG4gICAgICAgICAgICAgIHRva2VuLmlzU3Vic2V0T2YodG9rZW5DbGFzc1NwZWMuYXJnTGlzdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBObyBjbGFzc2VzIGRlc2NyaWJlIHRoaXMgc2VyaWVzIG9mIHRva2Vucywgc28gdXNlIHRoZSBnZW5lcmljIHdyYXBwZXJcbiAgICAgICAgcmV0dXJuIHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBNdWx0aXBsZSBjbGFzc2VzIGRlc2NyaWJlIHRoZSBzYW1lIGl0ZW0hIEFyYml0cmFyaWx5IGNob29zaW5nIG9uZS4uLmApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwb3RlbnRpYWxXcmFwcGVyc1swXS5XcmFwcGVyO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3Quam9pbignJyk7XG4gIH1cblxuICBmb3JrIChzZWxlY3Rvcikge1xuICAgIHJldHVybiBuZXcgU3RyZWFtKHtcbiAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB0aGlzLm5hbWVkRnVuY3Rpb25zLFxuICAgICAgbmFtZWRTdHJlYW1zOiB0aGlzLm5hbWVkU3RyZWFtcyxcbiAgICAgIHRva2VuQ2xhc3NMaXN0OiB0aGlzLm11cmUucGFyc2VTZWxlY3RvcihzZWxlY3RvciksXG4gICAgICBsYXVuY2hlZEZyb21DbGFzczogdGhpcy5sYXVuY2hlZEZyb21DbGFzcyxcbiAgICAgIGluZGV4ZXM6IHRoaXMuaW5kZXhlc1xuICAgIH0pO1xuICB9XG5cbiAgZXh0ZW5kIChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRGdW5jdGlvbnMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZFN0cmVhbXMsIG9wdGlvbnMubmFtZWRTdHJlYW1zIHx8IHt9KTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdC5jb25jYXQoW3sgVG9rZW5DbGFzcywgYXJnTGlzdCB9XSk7XG4gICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgdGhpcy5sYXVuY2hlZEZyb21DbGFzcztcbiAgICBvcHRpb25zLmluZGV4ZXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmluZGV4ZXMsIG9wdGlvbnMuaW5kZXhlcyB8fCB7fSk7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBhc3luYyB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtLCBoYXNoZXMgPSB7fSB9KSB7XG4gICAgbGV0IHdyYXBwZXJJbmRleCA9IDA7XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB3cmFwcGVySW5kZXggKz0gMTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gbmV3IHRoaXMuV3JhcHBlcnNbd3JhcHBlckluZGV4XSh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKGhhc2hlcykucmVkdWNlKChwcm9taXNlTGlzdCwgW2hhc2hGdW5jdGlvbk5hbWUsIGhhc2hdKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXgoaGFzaEZ1bmN0aW9uTmFtZSk7XG4gICAgICBpZiAoIWluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlTGlzdC5jb25jYXQoWyBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSkgXSk7XG4gICAgICB9XG4gICAgfSwgW10pKTtcbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cblxuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIGNvbnN0IGxhc3RUb2tlbiA9IHRoaXMudG9rZW5MaXN0W3RoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxKTtcbiAgICB5aWVsZCAqIGF3YWl0IGxhc3RUb2tlbi5pdGVyYXRlKHRlbXApO1xuICB9XG5cbiAgZ2V0SW5kZXggKGhhc2hGdW5jdGlvbk5hbWUpIHtcbiAgICBpZiAoIXRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSkge1xuICAgICAgLy8gVE9ETzogaWYgdXNpbmcgbm9kZS5qcywgc3RhcnQgd2l0aCBleHRlcm5hbCAvIG1vcmUgc2NhbGFibGUgaW5kZXhlc1xuICAgICAgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdID0gbmV3IHRoaXMubXVyZS5JTkRFWEVTLkluTWVtb3J5SW5kZXgoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgfVxuXG4gIGFzeW5jIGJ1aWxkSW5kZXggKGhhc2hGdW5jdGlvbk5hbWUpIHtcbiAgICBjb25zdCBoYXNoRnVuY3Rpb24gPSB0aGlzLm5hbWVkRnVuY3Rpb25zW2hhc2hGdW5jdGlvbk5hbWVdO1xuICAgIGlmICghaGFzaEZ1bmN0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7aGFzaEZ1bmN0aW9uTmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmdldEluZGV4KGhhc2hGdW5jdGlvbk5hbWUpO1xuICAgIGlmIChpbmRleC5jb21wbGV0ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgaGFzaEZ1bmN0aW9uKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSk7XG4gICAgICB9XG4gICAgfVxuICAgIGluZGV4LmNvbXBsZXRlID0gdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jICogc2FtcGxlICh7IGxpbWl0ID0gMTAsIHJlYnVpbGRJbmRleGVzID0gZmFsc2UgfSkge1xuICAgIC8vIEJlZm9yZSB3ZSBzdGFydCwgY2xlYW4gb3V0IGFueSBvbGQgaW5kZXhlcyB0aGF0IHdlcmUgbmV2ZXIgZmluaXNoZWRcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLmluZGV4ZXMpLmZvckVhY2goKFtoYXNoRnVuY3Rpb25OYW1lLCBpbmRleF0pID0+IHtcbiAgICAgIGlmIChyZWJ1aWxkSW5kZXhlcyB8fCAhaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgLy8gV2UgYWN0dWFsbHkgZmluaXNoZWQgYSBmdWxsIHBhc3M7IGZsYWcgYWxsIG9mIG91ciBpbmRleGVzIGFzIGNvbXBsZXRlXG4gICAgICAgIE9iamVjdC52YWx1ZXModGhpcy5pbmRleGVzKS5mb3JFYWNoKGluZGV4ID0+IHtcbiAgICAgICAgICBpbmRleC5jb21wbGV0ZSA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVRva2VuIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgLy8gVGhlIHN0cmluZyB2ZXJzaW9uIG9mIG1vc3QgdG9rZW5zIGNhbiBqdXN0IGJlIGRlcml2ZWQgZnJvbSB0aGUgY2xhc3MgdHlwZVxuICAgIHJldHVybiBgLiR7dGhpcy50eXBlLnRvTG93ZXJDYXNlKCl9KClgO1xuICB9XG4gIGlzU3ViU2V0T2YgKCkge1xuICAgIC8vIEJ5IGRlZmF1bHQgKHdpdGhvdXQgYW55IGFyZ3VtZW50cyksIHRva2VucyBvZiB0aGUgc2FtZSBjbGFzcyBhcmUgc3Vic2V0c1xuICAgIC8vIG9mIGVhY2ggb3RoZXJcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlUGFyZW50IChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IHBhcmVudFRva2VuID0gYW5jZXN0b3JUb2tlbnNbYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IGFuY2VzdG9yVG9rZW5zLnNsaWNlKDAsIGFuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDEpO1xuICAgIGxldCB5aWVsZGVkU29tZXRoaW5nID0gZmFsc2U7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRva2VuLml0ZXJhdGUodGVtcCkpIHtcbiAgICAgIHlpZWxkZWRTb21ldGhpbmcgPSB0cnVlO1xuICAgICAgeWllbGQgd3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgaWYgKCF5aWVsZGVkU29tZXRoaW5nICYmIHRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFRva2VuIHlpZWxkZWQgbm8gcmVzdWx0czogJHtwYXJlbnRUb2tlbn1gKTtcbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlVG9rZW4sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRva2VuLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQmFzZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEVtcHR5VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIC8vIHlpZWxkIG5vdGhpbmdcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGBlbXB0eWA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEVtcHR5VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQ6IG51bGwsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0gPSB7fSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKGtleXMgfHwgcmFuZ2VzKSB7XG4gICAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgICAgdGhpcy5yYW5nZXMgPSByYW5nZXM7XG4gICAgfSBlbHNlIGlmICgoYXJnTGlzdCAmJiBhcmdMaXN0Lmxlbmd0aCA9PT0gMSAmJiBhcmdMaXN0WzBdID09PSB1bmRlZmluZWQpIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgZGlmZmVyZW5jZSAob3RoZXJUb2tlbikge1xuICAgIC8vIENvbXB1dGUgd2hhdCBpcyBsZWZ0IG9mIHRoaXMgYWZ0ZXIgc3VidHJhY3Rpbmcgb3V0IGV2ZXJ5dGhpbmcgaW4gb3RoZXJUb2tlblxuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNvbXB1dGUgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIGRpZmZlcmVudCB0b2tlbiB0eXBlc2ApO1xuICAgIH0gZWxzZSBpZiAob3RoZXJUb2tlbi5tYXRjaEFsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEluYWNjdXJhdGUgZGlmZmVyZW5jZSBjb21wdXRlZCEgVE9ETzogbmVlZCB0byBmaWd1cmUgb3V0IGhvdyB0byBpbnZlcnQgY2F0ZWdvcmljYWwga2V5cyFgKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdLZXlzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgaW4gKHRoaXMua2V5cyB8fCB7fSkpIHtcbiAgICAgICAgaWYgKCFvdGhlclRva2VuLmtleXMgfHwgIW90aGVyVG9rZW4ua2V5c1trZXldKSB7XG4gICAgICAgICAgbmV3S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1JhbmdlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICAgIGlmIChvdGhlclRva2VuLnJhbmdlcykge1xuICAgICAgICAgIGxldCBhbGxQb2ludHMgPSB0aGlzLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgYWxsUG9pbnRzID0gYWxsUG9pbnRzLmNvbmNhdChvdGhlclRva2VuLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSkpLnNvcnQoKTtcbiAgICAgICAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbFBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IHsgbG93OiBhbGxQb2ludHNbaV0udmFsdWUgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5leGNsdWRlKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0ubG93IC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5sb3cgPSBhbGxQb2ludHNbaV0uaGlnaCArIDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3UmFuZ2VzID0gdGhpcy5yYW5nZXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgS2V5c1Rva2VuKHRoaXMubXVyZSwgbnVsbCwgeyBrZXlzOiBuZXdLZXlzLCByYW5nZXM6IG5ld1JhbmdlcyB9KTtcbiAgICB9XG4gIH1cbiAgaXNTdWJTZXRPZiAoYXJnTGlzdCkge1xuICAgIGNvbnN0IG90aGVyVG9rZW4gPSBuZXcgS2V5c1Rva2VuKHRoaXMuc3RyZWFtLCBhcmdMaXN0KTtcbiAgICBjb25zdCBkaWZmID0gb3RoZXJUb2tlbi5kaWZmZXJlbmNlKHRoaXMpO1xuICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7IHJldHVybiAnLmtleXMoKSc7IH1cbiAgICByZXR1cm4gJy5rZXlzKCcgKyAodGhpcy5yYW5nZXMgfHwgW10pLm1hcCgoe2xvdywgaGlnaH0pID0+IHtcbiAgICAgIHJldHVybiBsb3cgPT09IGhpZ2ggPyBsb3cgOiBgJHtsb3d9LSR7aGlnaH1gO1xuICAgIH0pLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmtleXMgfHwge30pLm1hcChrZXkgPT4gYCcke2tleX0nYCkpXG4gICAgICAuam9pbignLCcpICsgJyknO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEtleXNUb2tlbiBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxldCB7bG93LCBoaWdofSBvZiB0aGlzLnJhbmdlcyB8fCBbXSkge1xuICAgICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgICAgaGlnaCA9IE1hdGgubWluKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5sZW5ndGggLSAxLCBoaWdoKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gbG93OyBpIDw9IGhpZ2g7IGkrKykge1xuICAgICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgcmF3SXRlbTogaVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW0uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgS2V5c1Rva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFZhbHVlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgY29uc3Qga2V5ID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAoa2V5VHlwZSAhPT0gJ3N0cmluZycgJiYga2V5VHlwZSAhPT0gJ251bWJlcicpKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEV2YWx1YXRlVG9rZW4gaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdTdHJlYW07XG4gICAgICB0cnkge1xuICAgICAgICBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5mb3JrKHdyYXBwZWRQYXJlbnQucmF3SXRlbSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnIHx8ICEoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpKSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFdmFsdWF0ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIE1hcFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gZ2VuZXJhdG9yO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiBnZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZ2VuZXJhdG9yXSh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1hcFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFByb21vdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIG1hcCwgaGFzaCwgcmVkdWNlSW5zdGFuY2VzIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID0gcmVkdWNlSW5zdGFuY2VzO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHJldHVybiB0aGlzLm1hcCA9PT0gbWFwICYmXG4gICAgICB0aGlzLmhhc2ggPT09IGhhc2ggJiZcbiAgICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID09PSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBjb25zdCBtYXBGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMubWFwXTtcbiAgICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuaGFzaF07XG4gICAgICBjb25zdCByZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMucmVkdWNlSW5zdGFuY2VzXTtcbiAgICAgIGNvbnN0IGhhc2hJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMuaGFzaCk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgbWFwRnVuY3Rpb24od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgICAgY29uc3QgaGFzaCA9IGhhc2hGdW5jdGlvbihtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgbGV0IG9yaWdpbmFsV3JhcHBlZEl0ZW0gPSAoYXdhaXQgaGFzaEluZGV4LmdldFZhbHVlTGlzdChoYXNoKSlbMF07XG4gICAgICAgIGlmIChvcmlnaW5hbFdyYXBwZWRJdGVtKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVkdWNlSW5zdGFuY2VzICE9PSAnbm9vcCcpIHtcbiAgICAgICAgICAgIHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgaGFzaGVzID0ge307XG4gICAgICAgICAgaGFzaGVzW3RoaXMuaGFzaF0gPSBoYXNoO1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbSxcbiAgICAgICAgICAgIGhhc2hlc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBKb2luVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2RlZmF1bHRGaW5pc2gnLCBlZGdlUm9sZSA9ICdub25lJyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgWyB0aGlzSGFzaCwgZmluaXNoIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHRlbXAgPSBzdHJlYW0ubmFtZWRTdHJlYW1zW290aGVyU3RyZWFtXTtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBzdHJlYW06ICR7b3RoZXJTdHJlYW19YCk7XG4gICAgfVxuICAgIC8vIFJlcXVpcmUgb3RoZXJIYXNoIG9uIHRoZSBvdGhlciBzdHJlYW0sIG9yIGNvcHkgb3VycyBvdmVyIGlmIGl0IGlzbid0XG4gICAgLy8gYWxyZWFkeSBkZWZpbmVkXG4gICAgaWYgKCF0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGhhc2ggZnVuY3Rpb24gb24gZWl0aGVyIHN0cmVhbTogJHtvdGhlckhhc2h9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0gPSBzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm90aGVyU3RyZWFtID0gb3RoZXJTdHJlYW07XG4gICAgdGhpcy50aGlzSGFzaCA9IHRoaXNIYXNoO1xuICAgIHRoaXMub3RoZXJIYXNoID0gb3RoZXJIYXNoO1xuICAgIHRoaXMuZmluaXNoID0gZmluaXNoO1xuICAgIHRoaXMuZWRnZVJvbGUgPSBlZGdlUm9sZTtcbiAgICB0aGlzLmhhc2hUaGlzR3JhbmRwYXJlbnQgPSBlZGdlUm9sZSA9PT0gJ2Z1bGwnO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5qb2luKCR7dGhpcy5vdGhlclN0cmVhbX0sICR7dGhpcy50aGlzSGFzaH0sICR7dGhpcy5vdGhlckhhc2h9LCAke3RoaXMuZmluaXNofSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnaWRlbnRpdHknIF0pIHtcbiAgICByZXR1cm4gdGhpcy5vdGhlclN0cmVhbSA9PT0gb3RoZXJTdHJlYW0gJiZcbiAgICAgIHRoaXMudGhpc0hhc2ggPT09IHRoaXNIYXNoICYmXG4gICAgICB0aGlzLm90aGVySGFzaCA9PT0gb3RoZXJIYXNoICYmXG4gICAgICB0aGlzLmZpbmlzaCA9PT0gZmluaXNoO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBjb25zdCBvdGhlclN0cmVhbSA9IHRoaXMuc3RyZWFtLm5hbWVkU3RyZWFtc1t0aGlzLm90aGVyU3RyZWFtXTtcbiAgICBjb25zdCB0aGlzSGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy50aGlzSGFzaF07XG4gICAgY29uc3Qgb3RoZXJIYXNoRnVuY3Rpb24gPSBvdGhlclN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLm90aGVySGFzaF07XG4gICAgY29uc3QgZmluaXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmZpbmlzaF07XG5cbiAgICAvLyBjb25zdCB0aGlzSXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpO1xuICAgIC8vIGNvbnN0IG90aGVySXRlcmF0b3IgPSBvdGhlclN0cmVhbS5pdGVyYXRlKCk7XG5cbiAgICBjb25zdCB0aGlzSW5kZXggPSB0aGlzLnN0cmVhbS5nZXRJbmRleCh0aGlzLnRoaXNIYXNoKTtcbiAgICBjb25zdCBvdGhlckluZGV4ID0gb3RoZXJTdHJlYW0uZ2V0SW5kZXgodGhpcy5vdGhlckhhc2gpO1xuXG4gICAgaWYgKHRoaXNJbmRleC5jb21wbGV0ZSkge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gQmVzdCBvZiBhbGwgd29ybGRzOyB3ZSBjYW4ganVzdCBqb2luIHRoZSBpbmRleGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBoYXNoLCB2YWx1ZUxpc3QgfSBvZiB0aGlzSW5kZXguaXRlckVudHJpZXMoKSkge1xuICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHZhbHVlTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5lZWQgdG8gaXRlcmF0ZSB0aGUgb3RoZXIgaXRlbXMsIGFuZCB0YWtlIGFkdmFudGFnZSBvZiBvdXIgY29tcGxldGVcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyU3RyZWFtLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgLy8gQWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleDpcbiAgICAgICAgICAgIGF3YWl0IG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIG91ciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIHRoZSBvdGhlciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICAgICAgLy8gT2RkIGNvcm5lciBjYXNlIGZvciBlZGdlczsgc29tZXRpbWVzIHdlIHdhbnQgdG8gaGFzaCB0aGUgZ3JhbmRwYXJlbnQgaW5zdGVhZCBvZiB0aGUgcmVzdWx0IG9mXG4gICAgICAgICAgLy8gYW4gaW50ZXJtZWRpYXRlIGpvaW46XG4gICAgICAgICAgY29uc3QgdGhpc0hhc2hJdGVtID0gdGhpcy5oYXNoVGhpc0dyYW5kcGFyZW50ID8gdGhpc1dyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgOiB0aGlzV3JhcHBlZEl0ZW07XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc0hhc2hJdGVtKSkge1xuICAgICAgICAgICAgLy8gYWRkIHRoaXNXcmFwcGVkSXRlbSB0byB0aGlzSW5kZXhcbiAgICAgICAgICAgIGF3YWl0IHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzSGFzaEl0ZW0pO1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVpdGhlciBzdHJlYW0gaXMgZnVsbHkgaW5kZXhlZDsgZm9yIG1vcmUgZGlzdHJpYnV0ZWQgc2FtcGxpbmcsIGdyYWJcbiAgICAgICAgLy8gb25lIGl0ZW0gZnJvbSBlYWNoIHN0cmVhbSBhdCBhIHRpbWUsIGFuZCB1c2UgdGhlIHBhcnRpYWwgaW5kZXhlc1xuICAgICAgICBjb25zdCB0aGlzSXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMsIHRoaXMudGhpc0luZGlyZWN0S2V5KTtcbiAgICAgICAgbGV0IHRoaXNJc0RvbmUgPSBmYWxzZTtcbiAgICAgICAgY29uc3Qgb3RoZXJJdGVyYXRvciA9IG90aGVyU3RyZWFtLml0ZXJhdGUoKTtcbiAgICAgICAgbGV0IG90aGVySXNEb25lID0gZmFsc2U7XG5cbiAgICAgICAgd2hpbGUgKCF0aGlzSXNEb25lIHx8ICFvdGhlcklzRG9uZSkge1xuICAgICAgICAgIC8vIFRha2Ugb25lIHNhbXBsZSBmcm9tIHRoaXMgc3RyZWFtXG4gICAgICAgICAgbGV0IHRlbXAgPSBhd2FpdCB0aGlzSXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXNJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB0aGlzV3JhcHBlZEl0ZW0gPSBhd2FpdCB0ZW1wLnZhbHVlO1xuICAgICAgICAgICAgLy8gT2RkIGNvcm5lciBjYXNlIGZvciBlZGdlczsgc29tZXRpbWVzIHdlIHdhbnQgdG8gaGFzaCB0aGUgZ3JhbmRwYXJlbnQgaW5zdGVhZCBvZiB0aGUgcmVzdWx0IG9mXG4gICAgICAgICAgICAvLyBhbiBpbnRlcm1lZGlhdGUgam9pbjpcbiAgICAgICAgICAgIGNvbnN0IHRoaXNIYXNoSXRlbSA9IHRoaXMuaGFzaFRoaXNHcmFuZHBhcmVudCA/IHRoaXNXcmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IDogdGhpc1dyYXBwZWRJdGVtO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc0hhc2hJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgICB0aGlzSW5kZXguYWRkVmFsdWUoaGFzaCwgdGhpc0hhc2hJdGVtKTtcbiAgICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE5vdyBmb3IgYSBzYW1wbGUgZnJvbSB0aGUgb3RoZXIgc3RyZWFtXG4gICAgICAgICAgdGVtcCA9IGF3YWl0IG90aGVySXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIG90aGVySXNEb25lID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgLy8gYWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleFxuICAgICAgICAgICAgICBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSm9pblRva2VuO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4uL1N0cmVhbS5qcyc7XG5cbmNvbnN0IEFTVEVSSVNLUyA9IHtcbiAgJ2V2YWx1YXRlJzogJ+KGrCcsXG4gICdqb2luJzogJ+KorycsXG4gICdtYXAnOiAn4oamJyxcbiAgJ3Byb21vdGUnOiAn4oaRJyxcbiAgJ3ZhbHVlJzogJ+KGkidcbn07XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy5fc2VsZWN0b3IgPSBvcHRpb25zLnNlbGVjdG9yO1xuICAgIHRoaXMuY3VzdG9tQ2xhc3NOYW1lID0gb3B0aW9ucy5jdXN0b21DbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID0gb3B0aW9ucy5jdXN0b21OYW1lVG9rZW5JbmRleCB8fCBudWxsO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICB0aGlzLmluZGV4ZXMgPSBvcHRpb25zLmluZGV4ZXMgfHwge307XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sXG4gICAgICB0aGlzLm11cmUuTkFNRURfRlVOQ1RJT05TLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBmb3IgKGxldCBbZnVuY05hbWUsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubmFtZWRGdW5jdGlvbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtmdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc2VsZWN0b3I7XG4gIH1cbiAgZ2V0IHRva2VuQ2xhc3NMaXN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3IodGhpcy5zZWxlY3Rvcik7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzVHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgc2VsZWN0b3I6IHRoaXMuX3NlbGVjdG9yLFxuICAgICAgY3VzdG9tQ2xhc3NOYW1lOiB0aGlzLmN1c3RvbUNsYXNzTmFtZSxcbiAgICAgIGN1c3RvbU5hbWVUb2tlbkluZGV4OiB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4LFxuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgaW5kZXhlczoge30sXG4gICAgICBuYW1lZEZ1bmN0aW9uczoge31cbiAgICB9O1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIGxldCBzdHJpbmdpZmllZEZ1bmMgPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3R3YXJsb3N0L2lzdGFuYnVsL2lzc3Vlcy8zMTAjaXNzdWVjb21tZW50LTI3NDg4OTAyMlxuICAgICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICAgIHJlc3VsdC5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBzdHJpbmdpZmllZEZ1bmM7XG4gICAgfVxuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKHRoaXMuaW5kZXhlcykubWFwKGFzeW5jIChbZnVuY05hbWUsIGluZGV4XSkgPT4ge1xuICAgICAgaWYgKGluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIHJlc3VsdC5pbmRleGVzW2Z1bmNOYW1lXSA9IGF3YWl0IGluZGV4LnRvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgfSkpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIGlmICh0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gdmFsdWUpIHtcbiAgICAgIHRoaXMuY3VzdG9tQ2xhc3NOYW1lID0gdmFsdWU7XG4gICAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID0gdGhpcy5zZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZykubGVuZ3RoO1xuICAgICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgfVxuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5jdXN0b21DbGFzc05hbWUgIT09IG51bGwgJiZcbiAgICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPT09IHRoaXMuc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpLmxlbmd0aDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICBjb25zdCBzZWxlY3RvciA9IHRoaXMuc2VsZWN0b3I7XG4gICAgY29uc3QgdG9rZW5TdHJpbmdzID0gc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpO1xuICAgIGxldCByZXN1bHQgPSAnJztcbiAgICBmb3IgKGxldCBpID0gdG9rZW5TdHJpbmdzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAodGhpcy5jdXN0b21DbGFzc05hbWUgIT09IG51bGwgJiYgaSA8PSB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmN1c3RvbUNsYXNzTmFtZSArIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRlbXAgPSB0b2tlblN0cmluZ3NbaV0ubWF0Y2goL14uKFteKF0qKVxcKChbXildKilcXCkvKTtcbiAgICAgIGlmICh0ZW1wWzFdID09PSAna2V5cycgfHwgdGVtcFsxXSA9PT0gJ3ZhbHVlcycpIHtcbiAgICAgICAgaWYgKHRlbXBbMl0gPT09ICcnKSB7XG4gICAgICAgICAgcmVzdWx0ID0gJyonICsgcmVzdWx0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdCA9IHRlbXBbMl0ucmVwbGFjZSgvJyhbXiddKiknLywgJyQxJykgKyByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdCA9IEFTVEVSSVNLU1t0ZW1wWzFdXSArIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIChzZWxlY3Rvci5zdGFydHNXaXRoKCdlbXB0eScpID8gJ+KIhScgOiAnJykgKyByZXN1bHQ7XG4gIH1cbiAgc2V0TmFtZWRGdW5jdGlvbiAoZnVuY05hbWUsIGZ1bmMpIHtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IGZ1bmM7XG4gIH1cbiAgcG9wdWxhdGVTdHJlYW1PcHRpb25zIChvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMudG9rZW5DbGFzc0xpc3Q7XG4gICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IHRoaXMubmFtZWRGdW5jdGlvbnM7XG4gICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IHRoaXM7XG4gICAgb3B0aW9ucy5pbmRleGVzID0gdGhpcy5pbmRleGVzO1xuICAgIHJldHVybiBvcHRpb25zO1xuICB9XG4gIGdldFN0cmVhbSAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKG9wdGlvbnMucmVzZXQgfHwgIXRoaXMuX3N0cmVhbSkge1xuICAgICAgdGhpcy5fc3RyZWFtID0gbmV3IFN0cmVhbSh0aGlzLnBvcHVsYXRlU3RyZWFtT3B0aW9ucyhvcHRpb25zKSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9zdHJlYW07XG4gIH1cbiAgaXNTdXBlclNldE9mVG9rZW5MaXN0ICh0b2tlbkxpc3QpIHtcbiAgICBpZiAodG9rZW5MaXN0Lmxlbmd0aCAhPT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5ldmVyeSgodG9rZW4sIGkpID0+IHRva2VuLmlzU3VwZXJTZXRPZih0b2tlbkxpc3RbaV0pKTtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gYXdhaXQgdGhpcy50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdID0gbmV3IHRoaXMubXVyZS5DTEFTU0VTLk5vZGVDbGFzcyhvcHRpb25zKTtcbiAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gYXdhaXQgdGhpcy50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdID0gbmV3IHRoaXMubXVyZS5DTEFTU0VTLkVkZ2VDbGFzcyhvcHRpb25zKTtcbiAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgfVxuICBhc3luYyBhZ2dyZWdhdGUgKGhhc2gsIHJlZHVjZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGV4cGFuZCAobWFwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZmlsdGVyIChmaWx0ZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBzcGxpdCAoaGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGRlbGV0ZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICAgIHRoaXMuZWRnZUNvbm5lY3Rpb25zID0gb3B0aW9ucy5lZGdlQ29ubmVjdGlvbnMgfHwge307XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIC8vIFRPRE86IGEgYmFiZWwgYnVnIChodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzM5MzApXG4gICAgLy8gcHJldmVudHMgYGF3YWl0IHN1cGVyYDsgdGhpcyBpcyBhIHdvcmthcm91bmQ6XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgR2VuZXJpY0NsYXNzLnByb3RvdHlwZS50b1Jhd09iamVjdC5jYWxsKHRoaXMpO1xuICAgIC8vIFRPRE86IG5lZWQgdG8gZGVlcCBjb3B5IGVkZ2VDb25uZWN0aW9ucz9cbiAgICByZXN1bHQuZWRnZUNvbm5lY3Rpb25zID0gdGhpcy5lZGdlQ29ubmVjdGlvbnM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCB0aGlzSGFzaE5hbWUsIG90aGVySGFzaE5hbWUgfSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuXG4gICAgaWYgKCF0aGlzLl9zZWxlY3Rvcikge1xuICAgICAgaWYgKCFzb3VyY2VDbGFzcyB8fCAhdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJ0aWFsIGNvbm5lY3Rpb25zIHdpdGhvdXQgYW4gZWRnZSB0YWJsZSBzaG91bGQgbmV2ZXIgaGFwcGVuYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBObyBlZGdlIHRhYmxlIChzaW1wbGUgam9pbiBiZXR3ZWVuIHR3byBub2RlcylcbiAgICAgICAgY29uc3Qgc291cmNlSGFzaCA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgY29uc3QgdGFyZ2V0SGFzaCA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgcmV0dXJuIHNvdXJjZUNsYXNzLnNlbGVjdG9yICsgYC5qb2luKHRhcmdldCwgJHtzb3VyY2VIYXNofSwgJHt0YXJnZXRIYXNofSwgZGVmYXVsdEZpbmlzaCwgc291cmNlVGFyZ2V0KWA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByZXN1bHQgPSB0aGlzLl9zZWxlY3RvcjtcbiAgICAgIGlmICghc291cmNlQ2xhc3MpIHtcbiAgICAgICAgaWYgKCF0YXJnZXRDbGFzcykge1xuICAgICAgICAgIC8vIE5vIGNvbm5lY3Rpb25zIHlldDsganVzdCB5aWVsZCB0aGUgcmF3IGVkZ2UgdGFibGVcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFBhcnRpYWwgZWRnZS10YXJnZXQgY29ubmVjdGlvbnNcbiAgICAgICAgICBjb25zdCB7IGVkZ2VIYXNoTmFtZSwgbm9kZUhhc2hOYW1lIH0gPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0ICsgYC5qb2luKHRhcmdldCwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gsIGVkZ2VUYXJnZXQpYDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgLy8gUGFydGlhbCBzb3VyY2UtZWRnZSBjb25uZWN0aW9uc1xuICAgICAgICBjb25zdCB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0gPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdCArIGAuam9pbihzb3VyY2UsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoLCBzb3VyY2VFZGdlKWA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBGdWxsIGNvbm5lY3Rpb25zXG4gICAgICAgIGxldCB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0gPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgcmVzdWx0ICs9IGAuam9pbihzb3VyY2UsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoKWA7XG4gICAgICAgICh7IGVkZ2VIYXNoTmFtZSwgbm9kZUhhc2hOYW1lIH0gPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXSk7XG4gICAgICAgIHJlc3VsdCArPSBgLmpvaW4odGFyZ2V0LCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaCwgZnVsbClgO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBwb3B1bGF0ZVN0cmVhbU9wdGlvbnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMgPSB7fTtcbiAgICBpZiAoIXRoaXMuX3NlbGVjdG9yKSB7XG4gICAgICAvLyBVc2UgdGhlIG9wdGlvbnMgZnJvbSB0aGUgc291cmNlIHN0cmVhbSBpbnN0ZWFkIG9mIG91ciBjbGFzc1xuICAgICAgb3B0aW9ucyA9IHNvdXJjZUNsYXNzLnBvcHVsYXRlU3RyZWFtT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnRhcmdldCA9IHRhcmdldENsYXNzLmdldFN0cmVhbSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gc3VwZXIucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpO1xuICAgICAgaWYgKHNvdXJjZUNsYXNzKSB7XG4gICAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnNvdXJjZSA9IHNvdXJjZUNsYXNzLmdldFN0cmVhbSgpO1xuICAgICAgfVxuICAgICAgaWYgKHRhcmdldENsYXNzKSB7XG4gICAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnRhcmdldCA9IHRhcmdldENsYXNzLmdldFN0cmVhbSgpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgLy8gVE9ETzogYSBiYWJlbCBidWcgKGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMzkzMClcbiAgICAvLyBwcmV2ZW50cyBgYXdhaXQgc3VwZXJgOyB0aGlzIGlzIGEgd29ya2Fyb3VuZDpcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBHZW5lcmljQ2xhc3MucHJvdG90eXBlLnRvUmF3T2JqZWN0LmNhbGwodGhpcyk7XG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSkge1xuICAgIGlmIChkaXJlY3Rpb24gPT09ICdzb3VyY2UnKSB7XG4gICAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICd0YXJnZXQnKSB7XG4gICAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb3VyY2UgYW5kIHRhcmdldCBhcmUgYWxyZWFkeSBkZWZpbmVkOyBwbGVhc2Ugc3BlY2lmeSBhIGRpcmVjdGlvbiB0byBvdmVycmlkZWApO1xuICAgICAgfVxuICAgIH1cbiAgICBub2RlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0gPSB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH07XG4gICAgZGVsZXRlIHRoaXMuX3N0cmVhbTtcbiAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMud3JhcHBlZFBhcmVudCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMucmF3SXRlbSA9IHJhd0l0ZW07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcih7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ3NvdXJjZVRhcmdldCcpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgc291cmNlOiB0aGlzLnJhd0l0ZW0ubGVmdCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLnJhd0l0ZW0ucmlnaHRcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ2VkZ2VUYXJnZXQnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIGVkZ2U6IHRoaXMucmF3SXRlbS5sZWZ0LFxuICAgICAgICB0YXJnZXQ6IHRoaXMucmF3SXRlbS5yaWdodFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnc291cmNlRWRnZScpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgc291cmNlOiB0aGlzLnJhd0l0ZW0ucmlnaHQsXG4gICAgICAgIGVkZ2U6IHRoaXMucmF3SXRlbS5sZWZ0XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdmdWxsJykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBzb3VyY2U6IHRoaXMucmF3SXRlbS5sZWZ0LnJpZ2h0LFxuICAgICAgICBlZGdlOiB0aGlzLnJhd0l0ZW0ubGVmdC5sZWZ0LFxuICAgICAgICB0YXJnZXQ6IHRoaXMucmF3SXRlbS5yaWdodFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGVkZ2VSb2xlOiAke3Rva2VuLmVkZ2VSb2xlfWApO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuL1N0cmVhbS5qcyc7XG5pbXBvcnQgKiBhcyBUT0tFTlMgZnJvbSAnLi9Ub2tlbnMvVG9rZW5zLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5pbXBvcnQgKiBhcyBJTkRFWEVTIGZyb20gJy4vSW5kZXhlcy9JbmRleGVzLmpzJztcblxubGV0IE5FWFRfQ0xBU1NfSUQgPSAxO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoRmlsZVJlYWRlciwgbG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBlaXRoZXIgd2luZG93LmxvY2FsU3RvcmFnZSBvciBudWxsXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVE9LRU5TID0gVE9LRU5TO1xuICAgIHRoaXMuQ0xBU1NFUyA9IENMQVNTRVM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuICAgIHRoaXMuSU5ERVhFUyA9IElOREVYRVM7XG5cbiAgICAvLyBNb25rZXktcGF0Y2ggYXZhaWxhYmxlIHRva2VucyBhcyBmdW5jdGlvbnMgb250byB0aGUgU3RyZWFtIGNsYXNzXG4gICAgZm9yIChjb25zdCB0b2tlbkNsYXNzTmFtZSBpbiB0aGlzLlRPS0VOUykge1xuICAgICAgY29uc3QgVG9rZW5DbGFzcyA9IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXTtcbiAgICAgIFN0cmVhbS5wcm90b3R5cGVbVG9rZW5DbGFzcy5sb3dlckNhbWVsQ2FzZVR5cGVdID0gZnVuY3Rpb24gKGFyZ0xpc3QsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXh0ZW5kKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7IHlpZWxkIHdyYXBwZWRJdGVtLnJhd0l0ZW07IH0sXG4gICAgICBrZXk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7XG4gICAgICAgIGlmICghd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEdyYW5kcGFyZW50IGlzIG5vdCBhbiBvYmplY3QgLyBhcnJheWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICBpZiAoIShwYXJlbnRUeXBlID09PSAnbnVtYmVyJyB8fCBwYXJlbnRUeXBlID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXNuJ3QgYSBrZXkgLyBpbmRleGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRGaW5pc2g6IGZ1bmN0aW9uICogKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgbGVmdDogdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0sXG4gICAgICAgICAgcmlnaHQ6IG90aGVyV3JhcHBlZEl0ZW0ucmF3SXRlbVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnJvb3QgPSB0aGlzLmxvYWRSb290KCk7XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBvdXIgY2xhc3Mgc3BlY2lmaWNhdGlvbnNcbiAgICB0aGlzLmNsYXNzZXMgPSB0aGlzLmxvYWRDbGFzc2VzKCk7XG4gIH1cblxuICBsb2FkUm9vdCAoKSB7XG4gICAgbGV0IHJvb3QgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX3Jvb3QnKTtcbiAgICByb290ID0gcm9vdCA/IEpTT04ucGFyc2Uocm9vdCkgOiB7fTtcbiAgICByZXR1cm4gcm9vdDtcbiAgfVxuICBhc3luYyBzYXZlUm9vdCAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX3Jvb3QnLCBKU09OLnN0cmluZ2lmeSh0aGlzLnJvb3QpKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyb290VXBkYXRlJyk7XG4gIH1cbiAgbG9hZENsYXNzZXMgKCkge1xuICAgIGxldCBjbGFzc2VzID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbXVyZV9jbGFzc2VzJyk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMgPyBKU09OLnBhcnNlKGNsYXNzZXMpIDoge307XG4gICAgT2JqZWN0LmVudHJpZXMoY2xhc3NlcykuZm9yRWFjaCgoWyBjbGFzc0lkLCByYXdDbGFzc09iaiBdKSA9PiB7XG4gICAgICBPYmplY3QuZW50cmllcyhyYXdDbGFzc09iai5pbmRleGVzKS5mb3JFYWNoKChbZnVuY05hbWUsIHJhd0luZGV4T2JqXSkgPT4ge1xuICAgICAgICByYXdDbGFzc09iai5pbmRleGVzW2Z1bmNOYW1lXSA9IG5ldyB0aGlzLklOREVYRVMuSW5NZW1vcnlJbmRleCh7XG4gICAgICAgICAgZW50cmllczogcmF3SW5kZXhPYmosIGNvbXBsZXRlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICBjb25zdCBjbGFzc1R5cGUgPSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICBkZWxldGUgcmF3Q2xhc3NPYmouY2xhc3NUeXBlO1xuICAgICAgcmF3Q2xhc3NPYmoubXVyZSA9IHRoaXM7XG4gICAgICBjbGFzc2VzW2NsYXNzSWRdID0gbmV3IHRoaXMuQ0xBU1NFU1tjbGFzc1R5cGVdKHJhd0NsYXNzT2JqKTtcbiAgICB9KTtcbiAgICByZXR1cm4gY2xhc3NlcztcbiAgfVxuICBhc3luYyBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCByYXdDbGFzc2VzID0ge307XG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyh0aGlzLmNsYXNzZXMpXG4gICAgICAgIC5tYXAoYXN5bmMgKFsgY2xhc3NJZCwgY2xhc3NPYmogXSkgPT4ge1xuICAgICAgICAgIHJhd0NsYXNzZXNbY2xhc3NJZF0gPSBhd2FpdCBjbGFzc09iai50b1Jhd09iamVjdCgpO1xuICAgICAgICB9KSk7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX2NsYXNzZXMnLCBKU09OLnN0cmluZ2lmeShyYXdDbGFzc2VzKSk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcignY2xhc3NVcGRhdGUnKTtcbiAgfVxuXG4gIHBhcnNlU2VsZWN0b3IgKHNlbGVjdG9yU3RyaW5nKSB7XG4gICAgY29uc3Qgc3RhcnRzV2l0aFJvb3QgPSBzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdyb290Jyk7XG4gICAgaWYgKCEoc3RhcnRzV2l0aFJvb3QgfHwgc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgnZW1wdHknKSkpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgU2VsZWN0b3JzIG11c3Qgc3RhcnQgd2l0aCAncm9vdCcgb3IgJ2VtcHR5J2ApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3RvclN0cmluZy5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgaWYgKCF0b2tlblN0cmluZ3MpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCBzZWxlY3RvciBzdHJpbmc6ICR7c2VsZWN0b3JTdHJpbmd9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuQ2xhc3NMaXN0ID0gW3tcbiAgICAgIFRva2VuQ2xhc3M6IHN0YXJ0c1dpdGhSb290ID8gdGhpcy5UT0tFTlMuUm9vdFRva2VuIDogdGhpcy5UT0tFTlMuRW1wdHlUb2tlblxuICAgIH1dO1xuICAgIHRva2VuU3RyaW5ncy5mb3JFYWNoKGNodW5rID0+IHtcbiAgICAgIGNvbnN0IHRlbXAgPSBjaHVuay5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKCF0ZW1wKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCB0b2tlbjogJHtjaHVua31gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRva2VuQ2xhc3NOYW1lID0gdGVtcFsxXVswXS50b1VwcGVyQ2FzZSgpICsgdGVtcFsxXS5zbGljZSgxKSArICdUb2tlbic7XG4gICAgICBjb25zdCBhcmdMaXN0ID0gdGVtcFsyXS5zcGxpdCgvKD88IVxcXFwpLC8pLm1hcChkID0+IHtcbiAgICAgICAgZCA9IGQudHJpbSgpO1xuICAgICAgICByZXR1cm4gZCA9PT0gJycgPyB1bmRlZmluZWQgOiBkO1xuICAgICAgfSk7XG4gICAgICBpZiAodG9rZW5DbGFzc05hbWUgPT09ICdWYWx1ZXNUb2tlbicpIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuS2V5c1Rva2VuLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLlZhbHVlVG9rZW5cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSkge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biB0b2tlbjogJHt0ZW1wWzFdfWApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0b2tlbkNsYXNzTGlzdDtcbiAgfVxuXG4gIHN0cmVhbSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMucGFyc2VTZWxlY3RvcihvcHRpb25zLnNlbGVjdG9yIHx8IGByb290LnZhbHVlcygpYCk7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBhc3luYyBuZXdDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGByb290YCB9KSB7XG4gICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIGNvbnN0IENsYXNzVHlwZSA9IG9wdGlvbnMuQ2xhc3NUeXBlIHx8IHRoaXMuQ0xBU1NFUy5HZW5lcmljQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuQ2xhc3NUeXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ2xhc3NUeXBlKG9wdGlvbnMpO1xuICAgIGF3YWl0IHRoaXMuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNEYXRhU291cmNlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlKHtcbiAgICAgIGtleTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFzeW5jIGFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGtleSxcbiAgICBleHRlbnNpb24gPSAndHh0JyxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICBsZXQgb2JqO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBvYmogPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGRlbGV0ZSBvYmouY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNEYXRhU291cmNlKGtleSwgb2JqKTtcbiAgfVxuICBhc3luYyBhZGRTdGF0aWNEYXRhU291cmNlIChrZXksIG9iaikge1xuICAgIHRoaXMucm9vdFtrZXldID0gb2JqO1xuICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5zYXZlUm9vdCgpLCB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoJyR7a2V5fScpLnZhbHVlcygpYFxuICAgIH0pXSk7XG4gICAgcmV0dXJuIHRlbXBbMV07XG4gIH1cbiAgYXN5bmMgcmVtb3ZlRGF0YVNvdXJjZSAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMucm9vdFtrZXldO1xuICAgIGF3YWl0IHRoaXMuc2F2ZVJvb3QoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCBGaWxlUmVhZGVyIGZyb20gJ2ZpbGVyZWFkZXInO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKEZpbGVSZWFkZXIsIG51bGwpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImZvckVhY2giLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJPYmplY3QiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIlN0cmVhbSIsIm9wdGlvbnMiLCJtdXJlIiwibmFtZWRGdW5jdGlvbnMiLCJOQU1FRF9GVU5DVElPTlMiLCJuYW1lZFN0cmVhbXMiLCJsYXVuY2hlZEZyb21DbGFzcyIsImluZGV4ZXMiLCJ0b2tlbkNsYXNzTGlzdCIsInRva2VuTGlzdCIsIm1hcCIsIlRva2VuQ2xhc3MiLCJhcmdMaXN0IiwiV3JhcHBlcnMiLCJnZXRXcmFwcGVyTGlzdCIsInRva2VuIiwibGVuZ3RoIiwiV3JhcHBlciIsImxvY2FsVG9rZW5MaXN0Iiwic2xpY2UiLCJwb3RlbnRpYWxXcmFwcGVycyIsInZhbHVlcyIsImNsYXNzZXMiLCJmaWx0ZXIiLCJjbGFzc09iaiIsImNsYXNzVG9rZW5MaXN0IiwiZXZlcnkiLCJsb2NhbFRva2VuIiwibG9jYWxJbmRleCIsInRva2VuQ2xhc3NTcGVjIiwiaXNTdWJzZXRPZiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJjb25zb2xlIiwid2FybiIsInNlbGVjdG9yIiwiam9pbiIsImZvcmsiLCJwYXJzZVNlbGVjdG9yIiwiZXh0ZW5kIiwiY29uY2F0Iiwid3JhcCIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwiaGFzaGVzIiwid3JhcHBlckluZGV4IiwidGVtcCIsIndyYXBwZWRJdGVtIiwiUHJvbWlzZSIsImFsbCIsImVudHJpZXMiLCJyZWR1Y2UiLCJwcm9taXNlTGlzdCIsImhhc2hGdW5jdGlvbk5hbWUiLCJoYXNoIiwiZ2V0SW5kZXgiLCJjb21wbGV0ZSIsImFkZFZhbHVlIiwiaXRlcmF0ZSIsImxhc3RUb2tlbiIsIklOREVYRVMiLCJJbk1lbW9yeUluZGV4IiwiYnVpbGRJbmRleCIsImhhc2hGdW5jdGlvbiIsIkVycm9yIiwic2FtcGxlIiwibGltaXQiLCJyZWJ1aWxkSW5kZXhlcyIsIml0ZXJhdG9yIiwibmV4dCIsImRvbmUiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkJhc2VUb2tlbiIsInN0cmVhbSIsInRvU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJpc1N1YlNldE9mIiwiYW5jZXN0b3JUb2tlbnMiLCJpdGVyYXRlUGFyZW50IiwicGFyZW50VG9rZW4iLCJ5aWVsZGVkU29tZXRoaW5nIiwiZGVidWciLCJUeXBlRXJyb3IiLCJleGVjIiwibmFtZSIsIkVtcHR5VG9rZW4iLCJSb290VG9rZW4iLCJyb290IiwiS2V5c1Rva2VuIiwibWF0Y2hBbGwiLCJrZXlzIiwicmFuZ2VzIiwidW5kZWZpbmVkIiwiYXJnIiwibWF0Y2giLCJJbmZpbml0eSIsImQiLCJwYXJzZUludCIsImlzTmFOIiwibG93IiwiaGlnaCIsIm51bSIsIk51bWJlciIsIlN5bnRheEVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImNvbnNvbGlkYXRlUmFuZ2VzIiwic2VsZWN0c05vdGhpbmciLCJuZXdSYW5nZXMiLCJzb3J0IiwiYSIsImIiLCJjdXJyZW50UmFuZ2UiLCJkaWZmZXJlbmNlIiwib3RoZXJUb2tlbiIsIm5ld0tleXMiLCJrZXkiLCJhbGxQb2ludHMiLCJhZ2ciLCJyYW5nZSIsImluY2x1ZGUiLCJleGNsdWRlIiwiZGlmZiIsIk1hdGgiLCJtYXgiLCJtaW4iLCJoYXNPd25Qcm9wZXJ0eSIsIlZhbHVlVG9rZW4iLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsIm5ld1N0cmVhbSIsImVyciIsIk1hcFRva2VuIiwiZ2VuZXJhdG9yIiwibWFwcGVkUmF3SXRlbSIsIlByb21vdGVUb2tlbiIsInJlZHVjZUluc3RhbmNlcyIsImZ1bmMiLCJtYXBGdW5jdGlvbiIsInJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uIiwiaGFzaEluZGV4Iiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsImdldFZhbHVlTGlzdCIsIkpvaW5Ub2tlbiIsIm90aGVyU3RyZWFtIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJmaW5pc2giLCJlZGdlUm9sZSIsImhhc2hUaGlzR3JhbmRwYXJlbnQiLCJ0aGlzSGFzaEZ1bmN0aW9uIiwib3RoZXJIYXNoRnVuY3Rpb24iLCJmaW5pc2hGdW5jdGlvbiIsInRoaXNJbmRleCIsIm90aGVySW5kZXgiLCJ2YWx1ZUxpc3QiLCJpdGVyRW50cmllcyIsIm90aGVyTGlzdCIsIm90aGVyV3JhcHBlZEl0ZW0iLCJ0aGlzV3JhcHBlZEl0ZW0iLCJ0aGlzTGlzdCIsInRoaXNIYXNoSXRlbSIsInRoaXNJdGVyYXRvciIsInRoaXNJbmRpcmVjdEtleSIsInRoaXNJc0RvbmUiLCJvdGhlckl0ZXJhdG9yIiwib3RoZXJJc0RvbmUiLCJBU1RFUklTS1MiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX3NlbGVjdG9yIiwiY3VzdG9tQ2xhc3NOYW1lIiwiY3VzdG9tTmFtZVRva2VuSW5kZXgiLCJmdW5jTmFtZSIsIkZ1bmN0aW9uIiwidG9SYXdPYmplY3QiLCJyZXN1bHQiLCJjbGFzc1R5cGUiLCJzdHJpbmdpZmllZEZ1bmMiLCJzZXRDbGFzc05hbWUiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJjbGFzc05hbWUiLCJ0b2tlblN0cmluZ3MiLCJzdGFydHNXaXRoIiwic2V0TmFtZWRGdW5jdGlvbiIsInBvcHVsYXRlU3RyZWFtT3B0aW9ucyIsImdldFN0cmVhbSIsInJlc2V0IiwiX3N0cmVhbSIsImlzU3VwZXJTZXRPZlRva2VuTGlzdCIsImlzU3VwZXJTZXRPZiIsImludGVycHJldEFzTm9kZXMiLCJDTEFTU0VTIiwiTm9kZUNsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIkVkZ2VDbGFzcyIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsInNwbGl0IiwiZGVsZXRlIiwiTm9kZVdyYXBwZXIiLCJlZGdlQ29ubmVjdGlvbnMiLCJwcm90b3R5cGUiLCJjYWxsIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwibm9kZUNsYXNzIiwidGhpc0hhc2hOYW1lIiwib3RoZXJIYXNoTmFtZSIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsImVkZ2VDbGFzcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJkaXJlY3RlZCIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJzb3VyY2VIYXNoIiwibm9kZUhhc2hOYW1lIiwidGFyZ2V0SGFzaCIsImVkZ2VIYXNoTmFtZSIsInRhcmdldCIsInNvdXJjZSIsImRpcmVjdGlvbiIsImxlZnQiLCJyaWdodCIsImVkZ2UiLCJpdGVySGFzaGVzIiwiaXRlclZhbHVlTGlzdHMiLCJORVhUX0NMQVNTX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiREFUQUxJQl9GT1JNQVRTIiwiVE9LRU5TIiwidG9rZW5DbGFzc05hbWUiLCJpZGVudGl0eSIsInBhcmVudFR5cGUiLCJkZWZhdWx0RmluaXNoIiwic2hhMSIsIm5vb3AiLCJsb2FkUm9vdCIsImxvYWRDbGFzc2VzIiwiZ2V0SXRlbSIsInBhcnNlIiwic2F2ZVJvb3QiLCJzZXRJdGVtIiwicmF3Q2xhc3NPYmoiLCJyYXdJbmRleE9iaiIsInJhd0NsYXNzZXMiLCJzZWxlY3RvclN0cmluZyIsInN0YXJ0c1dpdGhSb290IiwiY2h1bmsiLCJ0b1VwcGVyQ2FzZSIsInRyaW0iLCJuZXdDbGFzcyIsIkNsYXNzVHlwZSIsImFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UiLCJmaWxlT2JqIiwiZW5jb2RpbmciLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsInRleHQiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVhZGVyIiwib25sb2FkIiwicmVhZEFzVGV4dCIsImFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY0Rh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
