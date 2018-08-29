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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIHRoaXMubmFtZWRTdHJlYW1zID0gb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge307XG4gICAgdGhpcy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgbnVsbDtcbiAgICB0aGlzLmluZGV4ZXMgPSBvcHRpb25zLmluZGV4ZXMgfHwge307XG4gICAgdGhpcy50b2tlbkNsYXNzTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgfHwgW107XG5cbiAgICAvLyBSZW1pbmRlcjogdGhpcyBhbHdheXMgbmVlZHMgdG8gYmUgYWZ0ZXIgaW5pdGlhbGl6aW5nIHRoaXMubmFtZWRGdW5jdGlvbnNcbiAgICAvLyBhbmQgdGhpcy5uYW1lZFN0cmVhbXNcbiAgICB0aGlzLnRva2VuTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QubWFwKCh7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBUb2tlbkNsYXNzKHRoaXMsIGFyZ0xpc3QpO1xuICAgIH0pO1xuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy50b2tlbkxpc3RcbiAgICB0aGlzLldyYXBwZXJzID0gdGhpcy5nZXRXcmFwcGVyTGlzdCgpO1xuICB9XG5cbiAgZ2V0V3JhcHBlckxpc3QgKCkge1xuICAgIC8vIExvb2sgdXAgd2hpY2gsIGlmIGFueSwgY2xhc3NlcyBkZXNjcmliZSB0aGUgcmVzdWx0IG9mIGVhY2ggdG9rZW4sIHNvIHRoYXRcbiAgICAvLyB3ZSBjYW4gd3JhcCBpdGVtcyBhcHByb3ByaWF0ZWx5OlxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5tYXAoKHRva2VuLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKGluZGV4ID09PSB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxICYmIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MpIHtcbiAgICAgICAgLy8gSWYgdGhpcyBzdHJlYW0gd2FzIHN0YXJ0ZWQgZnJvbSBhIGNsYXNzLCB3ZSBhbHJlYWR5IGtub3cgd2Ugc2hvdWxkXG4gICAgICAgIC8vIHVzZSB0aGF0IGNsYXNzJ3Mgd3JhcHBlciBmb3IgdGhlIGxhc3QgdG9rZW5cbiAgICAgICAgcmV0dXJuIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MuV3JhcHBlcjtcbiAgICAgIH1cbiAgICAgIC8vIEZpbmQgYSBjbGFzcyB0aGF0IGRlc2NyaWJlcyBleGFjdGx5IGVhY2ggc2VyaWVzIG9mIHRva2Vuc1xuICAgICAgY29uc3QgbG9jYWxUb2tlbkxpc3QgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCBpbmRleCArIDEpO1xuICAgICAgY29uc3QgcG90ZW50aWFsV3JhcHBlcnMgPSBPYmplY3QudmFsdWVzKHRoaXMubXVyZS5jbGFzc2VzKVxuICAgICAgICAuZmlsdGVyKGNsYXNzT2JqID0+IHtcbiAgICAgICAgICBjb25zdCBjbGFzc1Rva2VuTGlzdCA9IGNsYXNzT2JqLnRva2VuQ2xhc3NMaXN0O1xuICAgICAgICAgIGlmICghY2xhc3NUb2tlbkxpc3QubGVuZ3RoICE9PSBsb2NhbFRva2VuTGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW5MaXN0LmV2ZXJ5KChsb2NhbFRva2VuLCBsb2NhbEluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbkNsYXNzU3BlYyA9IGNsYXNzVG9rZW5MaXN0W2xvY2FsSW5kZXhdO1xuICAgICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW4gaW5zdGFuY2VvZiB0b2tlbkNsYXNzU3BlYy5Ub2tlbkNsYXNzICYmXG4gICAgICAgICAgICAgIHRva2VuLmlzU3Vic2V0T2YodG9rZW5DbGFzc1NwZWMuYXJnTGlzdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBObyBjbGFzc2VzIGRlc2NyaWJlIHRoaXMgc2VyaWVzIG9mIHRva2Vucywgc28gdXNlIHRoZSBnZW5lcmljIHdyYXBwZXJcbiAgICAgICAgcmV0dXJuIHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBNdWx0aXBsZSBjbGFzc2VzIGRlc2NyaWJlIHRoZSBzYW1lIGl0ZW0hIEFyYml0cmFyaWx5IGNob29zaW5nIG9uZS4uLmApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwb3RlbnRpYWxXcmFwcGVyc1swXS5XcmFwcGVyO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3Quam9pbignJyk7XG4gIH1cblxuICBmb3JrIChzZWxlY3Rvcikge1xuICAgIHJldHVybiBuZXcgU3RyZWFtKHtcbiAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB0aGlzLm5hbWVkRnVuY3Rpb25zLFxuICAgICAgbmFtZWRTdHJlYW1zOiB0aGlzLm5hbWVkU3RyZWFtcyxcbiAgICAgIHRva2VuQ2xhc3NMaXN0OiB0aGlzLm11cmUucGFyc2VTZWxlY3RvcihzZWxlY3RvciksXG4gICAgICBsYXVuY2hlZEZyb21DbGFzczogdGhpcy5sYXVuY2hlZEZyb21DbGFzcyxcbiAgICAgIGluZGV4ZXM6IHRoaXMuaW5kZXhlc1xuICAgIH0pO1xuICB9XG5cbiAgZXh0ZW5kIChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRGdW5jdGlvbnMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZFN0cmVhbXMsIG9wdGlvbnMubmFtZWRTdHJlYW1zIHx8IHt9KTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdC5jb25jYXQoW3sgVG9rZW5DbGFzcywgYXJnTGlzdCB9XSk7XG4gICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgdGhpcy5sYXVuY2hlZEZyb21DbGFzcztcbiAgICBvcHRpb25zLmluZGV4ZXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmluZGV4ZXMsIG9wdGlvbnMuaW5kZXhlcyB8fCB7fSk7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBhc3luYyB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtLCBoYXNoZXMgPSB7fSB9KSB7XG4gICAgbGV0IHdyYXBwZXJJbmRleCA9IDA7XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB3cmFwcGVySW5kZXggKz0gMTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gbmV3IHRoaXMuV3JhcHBlcnNbd3JhcHBlckluZGV4XSh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKGhhc2hlcykucmVkdWNlKChwcm9taXNlTGlzdCwgW2hhc2hGdW5jdGlvbk5hbWUsIGhhc2hdKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXgoaGFzaEZ1bmN0aW9uTmFtZSk7XG4gICAgICBpZiAoIWluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlTGlzdC5jb25jYXQoWyBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSkgXSk7XG4gICAgICB9XG4gICAgfSwgW10pKTtcbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cblxuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIGNvbnN0IGxhc3RUb2tlbiA9IHRoaXMudG9rZW5MaXN0W3RoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxKTtcbiAgICB5aWVsZCAqIGF3YWl0IGxhc3RUb2tlbi5pdGVyYXRlKHRlbXApO1xuICB9XG5cbiAgZ2V0SW5kZXggKGhhc2hGdW5jdGlvbk5hbWUpIHtcbiAgICBpZiAoIXRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSkge1xuICAgICAgLy8gVE9ETzogaWYgdXNpbmcgbm9kZS5qcywgc3RhcnQgd2l0aCBleHRlcm5hbCAvIG1vcmUgc2NhbGFibGUgaW5kZXhlc1xuICAgICAgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdID0gbmV3IHRoaXMubXVyZS5JTkRFWEVTLkluTWVtb3J5SW5kZXgoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgfVxuXG4gIGFzeW5jIGJ1aWxkSW5kZXggKGhhc2hGdW5jdGlvbk5hbWUpIHtcbiAgICBjb25zdCBoYXNoRnVuY3Rpb24gPSB0aGlzLm5hbWVkRnVuY3Rpb25zW2hhc2hGdW5jdGlvbk5hbWVdO1xuICAgIGlmICghaGFzaEZ1bmN0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7aGFzaEZ1bmN0aW9uTmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmdldEluZGV4KGhhc2hGdW5jdGlvbk5hbWUpO1xuICAgIGlmIChpbmRleC5jb21wbGV0ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgaGFzaEZ1bmN0aW9uKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSk7XG4gICAgICB9XG4gICAgfVxuICAgIGluZGV4LmNvbXBsZXRlID0gdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jICogc2FtcGxlICh7IGxpbWl0ID0gMTAsIHJlYnVpbGRJbmRleGVzID0gZmFsc2UgfSkge1xuICAgIC8vIEJlZm9yZSB3ZSBzdGFydCwgY2xlYW4gb3V0IGFueSBvbGQgaW5kZXhlcyB0aGF0IHdlcmUgbmV2ZXIgZmluaXNoZWRcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLmluZGV4ZXMpLmZvckVhY2goKFtoYXNoRnVuY3Rpb25OYW1lLCBpbmRleF0pID0+IHtcbiAgICAgIGlmIChyZWJ1aWxkSW5kZXhlcyB8fCAhaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgLy8gV2UgYWN0dWFsbHkgZmluaXNoZWQgYSBmdWxsIHBhc3M7IGZsYWcgYWxsIG9mIG91ciBpbmRleGVzIGFzIGNvbXBsZXRlXG4gICAgICAgIE9iamVjdC52YWx1ZXModGhpcy5pbmRleGVzKS5mb3JFYWNoKGluZGV4ID0+IHtcbiAgICAgICAgICBpbmRleC5jb21wbGV0ZSA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVRva2VuIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgLy8gVGhlIHN0cmluZyB2ZXJzaW9uIG9mIG1vc3QgdG9rZW5zIGNhbiBqdXN0IGJlIGRlcml2ZWQgZnJvbSB0aGUgY2xhc3MgdHlwZVxuICAgIHJldHVybiBgLiR7dGhpcy50eXBlLnRvTG93ZXJDYXNlKCl9KClgO1xuICB9XG4gIGlzU3ViU2V0T2YgKCkge1xuICAgIC8vIEJ5IGRlZmF1bHQgKHdpdGhvdXQgYW55IGFyZ3VtZW50cyksIHRva2VucyBvZiB0aGUgc2FtZSBjbGFzcyBhcmUgc3Vic2V0c1xuICAgIC8vIG9mIGVhY2ggb3RoZXJcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlUGFyZW50IChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IHBhcmVudFRva2VuID0gYW5jZXN0b3JUb2tlbnNbYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IGFuY2VzdG9yVG9rZW5zLnNsaWNlKDAsIGFuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDEpO1xuICAgIGxldCB5aWVsZGVkU29tZXRoaW5nID0gZmFsc2U7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRva2VuLml0ZXJhdGUodGVtcCkpIHtcbiAgICAgIHlpZWxkZWRTb21ldGhpbmcgPSB0cnVlO1xuICAgICAgeWllbGQgd3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgaWYgKCF5aWVsZGVkU29tZXRoaW5nICYmIHRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFRva2VuIHlpZWxkZWQgbm8gcmVzdWx0czogJHtwYXJlbnRUb2tlbn1gKTtcbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlVG9rZW4sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRva2VuLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQmFzZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEVtcHR5VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIC8vIHlpZWxkIG5vdGhpbmdcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGBlbXB0eWA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEVtcHR5VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQ6IG51bGwsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0gPSB7fSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKGtleXMgfHwgcmFuZ2VzKSB7XG4gICAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgICAgdGhpcy5yYW5nZXMgPSByYW5nZXM7XG4gICAgfSBlbHNlIGlmICgoYXJnTGlzdCAmJiBhcmdMaXN0Lmxlbmd0aCA9PT0gMSAmJiBhcmdMaXN0WzBdID09PSB1bmRlZmluZWQpIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgZGlmZmVyZW5jZSAob3RoZXJUb2tlbikge1xuICAgIC8vIENvbXB1dGUgd2hhdCBpcyBsZWZ0IG9mIHRoaXMgYWZ0ZXIgc3VidHJhY3Rpbmcgb3V0IGV2ZXJ5dGhpbmcgaW4gb3RoZXJUb2tlblxuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNvbXB1dGUgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIGRpZmZlcmVudCB0b2tlbiB0eXBlc2ApO1xuICAgIH0gZWxzZSBpZiAob3RoZXJUb2tlbi5tYXRjaEFsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEluYWNjdXJhdGUgZGlmZmVyZW5jZSBjb21wdXRlZCEgVE9ETzogbmVlZCB0byBmaWd1cmUgb3V0IGhvdyB0byBpbnZlcnQgY2F0ZWdvcmljYWwga2V5cyFgKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdLZXlzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgaW4gKHRoaXMua2V5cyB8fCB7fSkpIHtcbiAgICAgICAgaWYgKCFvdGhlclRva2VuLmtleXMgfHwgIW90aGVyVG9rZW4ua2V5c1trZXldKSB7XG4gICAgICAgICAgbmV3S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1JhbmdlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICAgIGlmIChvdGhlclRva2VuLnJhbmdlcykge1xuICAgICAgICAgIGxldCBhbGxQb2ludHMgPSB0aGlzLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgYWxsUG9pbnRzID0gYWxsUG9pbnRzLmNvbmNhdChvdGhlclRva2VuLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSkpLnNvcnQoKTtcbiAgICAgICAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbFBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IHsgbG93OiBhbGxQb2ludHNbaV0udmFsdWUgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5leGNsdWRlKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0ubG93IC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5sb3cgPSBhbGxQb2ludHNbaV0uaGlnaCArIDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3UmFuZ2VzID0gdGhpcy5yYW5nZXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgS2V5c1Rva2VuKHRoaXMubXVyZSwgbnVsbCwgeyBrZXlzOiBuZXdLZXlzLCByYW5nZXM6IG5ld1JhbmdlcyB9KTtcbiAgICB9XG4gIH1cbiAgaXNTdWJTZXRPZiAoYXJnTGlzdCkge1xuICAgIGNvbnN0IG90aGVyVG9rZW4gPSBuZXcgS2V5c1Rva2VuKHRoaXMuc3RyZWFtLCBhcmdMaXN0KTtcbiAgICBjb25zdCBkaWZmID0gb3RoZXJUb2tlbi5kaWZmZXJlbmNlKHRoaXMpO1xuICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7IHJldHVybiAnLmtleXMoKSc7IH1cbiAgICByZXR1cm4gJy5rZXlzKCcgKyAodGhpcy5yYW5nZXMgfHwgW10pLm1hcCgoe2xvdywgaGlnaH0pID0+IHtcbiAgICAgIHJldHVybiBsb3cgPT09IGhpZ2ggPyBsb3cgOiBgJHtsb3d9LSR7aGlnaH1gO1xuICAgIH0pLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmtleXMgfHwge30pLm1hcChrZXkgPT4gYCcke2tleX0nYCkpXG4gICAgICAuam9pbignLCcpICsgJyknO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEtleXNUb2tlbiBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxldCB7bG93LCBoaWdofSBvZiB0aGlzLnJhbmdlcyB8fCBbXSkge1xuICAgICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgICAgaGlnaCA9IE1hdGgubWluKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5sZW5ndGggLSAxLCBoaWdoKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gbG93OyBpIDw9IGhpZ2g7IGkrKykge1xuICAgICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgcmF3SXRlbTogaVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW0uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgS2V5c1Rva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFZhbHVlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgY29uc3Qga2V5ID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAoa2V5VHlwZSAhPT0gJ3N0cmluZycgJiYga2V5VHlwZSAhPT0gJ251bWJlcicpKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEV2YWx1YXRlVG9rZW4gaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdTdHJlYW07XG4gICAgICB0cnkge1xuICAgICAgICBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5mb3JrKHdyYXBwZWRQYXJlbnQucmF3SXRlbSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnIHx8ICEoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpKSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFdmFsdWF0ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIE1hcFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gZ2VuZXJhdG9yO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiBnZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZ2VuZXJhdG9yXSh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1hcFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFByb21vdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIG1hcCwgaGFzaCwgcmVkdWNlSW5zdGFuY2VzIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID0gcmVkdWNlSW5zdGFuY2VzO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHJldHVybiB0aGlzLm1hcCA9PT0gbWFwICYmXG4gICAgICB0aGlzLmhhc2ggPT09IGhhc2ggJiZcbiAgICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID09PSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBjb25zdCBtYXBGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMubWFwXTtcbiAgICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuaGFzaF07XG4gICAgICBjb25zdCByZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMucmVkdWNlSW5zdGFuY2VzXTtcbiAgICAgIGNvbnN0IGhhc2hJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMuaGFzaCk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgbWFwRnVuY3Rpb24od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgICAgY29uc3QgaGFzaCA9IGhhc2hGdW5jdGlvbihtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgbGV0IG9yaWdpbmFsV3JhcHBlZEl0ZW0gPSAoYXdhaXQgaGFzaEluZGV4LmdldFZhbHVlTGlzdChoYXNoKSlbMF07XG4gICAgICAgIGlmIChvcmlnaW5hbFdyYXBwZWRJdGVtKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVkdWNlSW5zdGFuY2VzICE9PSAnbm9vcCcpIHtcbiAgICAgICAgICAgIHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgaGFzaGVzID0ge307XG4gICAgICAgICAgaGFzaGVzW3RoaXMuaGFzaF0gPSBoYXNoO1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbSxcbiAgICAgICAgICAgIGhhc2hlc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBKb2luVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2RlZmF1bHRGaW5pc2gnLCBlZGdlUm9sZSA9ICdub25lJyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgWyB0aGlzSGFzaCwgZmluaXNoIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHRlbXAgPSBzdHJlYW0ubmFtZWRTdHJlYW1zW290aGVyU3RyZWFtXTtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBzdHJlYW06ICR7b3RoZXJTdHJlYW19YCk7XG4gICAgfVxuICAgIC8vIFJlcXVpcmUgb3RoZXJIYXNoIG9uIHRoZSBvdGhlciBzdHJlYW0sIG9yIGNvcHkgb3VycyBvdmVyIGlmIGl0IGlzbid0XG4gICAgLy8gYWxyZWFkeSBkZWZpbmVkXG4gICAgaWYgKCF0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGhhc2ggZnVuY3Rpb24gb24gZWl0aGVyIHN0cmVhbTogJHtvdGhlckhhc2h9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0gPSBzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm90aGVyU3RyZWFtID0gb3RoZXJTdHJlYW07XG4gICAgdGhpcy50aGlzSGFzaCA9IHRoaXNIYXNoO1xuICAgIHRoaXMub3RoZXJIYXNoID0gb3RoZXJIYXNoO1xuICAgIHRoaXMuZmluaXNoID0gZmluaXNoO1xuICAgIHRoaXMuZWRnZVJvbGUgPSBlZGdlUm9sZTtcbiAgICB0aGlzLmhhc2hUaGlzR3JhbmRwYXJlbnQgPSBlZGdlUm9sZSA9PT0gJ2Z1bGwnO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5qb2luKCR7dGhpcy5vdGhlclN0cmVhbX0sICR7dGhpcy50aGlzSGFzaH0sICR7dGhpcy5vdGhlckhhc2h9LCAke3RoaXMuZmluaXNofSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnaWRlbnRpdHknIF0pIHtcbiAgICByZXR1cm4gdGhpcy5vdGhlclN0cmVhbSA9PT0gb3RoZXJTdHJlYW0gJiZcbiAgICAgIHRoaXMudGhpc0hhc2ggPT09IHRoaXNIYXNoICYmXG4gICAgICB0aGlzLm90aGVySGFzaCA9PT0gb3RoZXJIYXNoICYmXG4gICAgICB0aGlzLmZpbmlzaCA9PT0gZmluaXNoO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBjb25zdCBvdGhlclN0cmVhbSA9IHRoaXMuc3RyZWFtLm5hbWVkU3RyZWFtc1t0aGlzLm90aGVyU3RyZWFtXTtcbiAgICBjb25zdCB0aGlzSGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy50aGlzSGFzaF07XG4gICAgY29uc3Qgb3RoZXJIYXNoRnVuY3Rpb24gPSBvdGhlclN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLm90aGVySGFzaF07XG4gICAgY29uc3QgZmluaXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmZpbmlzaF07XG5cbiAgICAvLyBjb25zdCB0aGlzSXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpO1xuICAgIC8vIGNvbnN0IG90aGVySXRlcmF0b3IgPSBvdGhlclN0cmVhbS5pdGVyYXRlKCk7XG5cbiAgICBjb25zdCB0aGlzSW5kZXggPSB0aGlzLnN0cmVhbS5nZXRJbmRleCh0aGlzLnRoaXNIYXNoKTtcbiAgICBjb25zdCBvdGhlckluZGV4ID0gb3RoZXJTdHJlYW0uZ2V0SW5kZXgodGhpcy5vdGhlckhhc2gpO1xuXG4gICAgaWYgKHRoaXNJbmRleC5jb21wbGV0ZSkge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gQmVzdCBvZiBhbGwgd29ybGRzOyB3ZSBjYW4ganVzdCBqb2luIHRoZSBpbmRleGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBoYXNoLCB2YWx1ZUxpc3QgfSBvZiB0aGlzSW5kZXguaXRlckVudHJpZXMoKSkge1xuICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHZhbHVlTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5lZWQgdG8gaXRlcmF0ZSB0aGUgb3RoZXIgaXRlbXMsIGFuZCB0YWtlIGFkdmFudGFnZSBvZiBvdXIgY29tcGxldGVcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyU3RyZWFtLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgLy8gQWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleDpcbiAgICAgICAgICAgIGF3YWl0IG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIG91ciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIHRoZSBvdGhlciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICAgICAgLy8gT2RkIGNvcm5lciBjYXNlIGZvciBlZGdlczsgc29tZXRpbWVzIHdlIHdhbnQgdG8gaGFzaCB0aGUgZ3JhbmRwYXJlbnQgaW5zdGVhZCBvZiB0aGUgcmVzdWx0IG9mXG4gICAgICAgICAgLy8gYW4gaW50ZXJtZWRpYXRlIGpvaW46XG4gICAgICAgICAgY29uc3QgdGhpc0hhc2hJdGVtID0gdGhpcy5oYXNoVGhpc0dyYW5kcGFyZW50ID8gdGhpc1dyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgOiB0aGlzV3JhcHBlZEl0ZW07XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc0hhc2hJdGVtKSkge1xuICAgICAgICAgICAgLy8gYWRkIHRoaXNXcmFwcGVkSXRlbSB0byB0aGlzSW5kZXhcbiAgICAgICAgICAgIGF3YWl0IHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzSGFzaEl0ZW0pO1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVpdGhlciBzdHJlYW0gaXMgZnVsbHkgaW5kZXhlZDsgZm9yIG1vcmUgZGlzdHJpYnV0ZWQgc2FtcGxpbmcsIGdyYWJcbiAgICAgICAgLy8gb25lIGl0ZW0gZnJvbSBlYWNoIHN0cmVhbSBhdCBhIHRpbWUsIGFuZCB1c2UgdGhlIHBhcnRpYWwgaW5kZXhlc1xuICAgICAgICBjb25zdCB0aGlzSXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMsIHRoaXMudGhpc0luZGlyZWN0S2V5KTtcbiAgICAgICAgbGV0IHRoaXNJc0RvbmUgPSBmYWxzZTtcbiAgICAgICAgY29uc3Qgb3RoZXJJdGVyYXRvciA9IG90aGVyU3RyZWFtLml0ZXJhdGUoKTtcbiAgICAgICAgbGV0IG90aGVySXNEb25lID0gZmFsc2U7XG5cbiAgICAgICAgd2hpbGUgKCF0aGlzSXNEb25lIHx8ICFvdGhlcklzRG9uZSkge1xuICAgICAgICAgIC8vIFRha2Ugb25lIHNhbXBsZSBmcm9tIHRoaXMgc3RyZWFtXG4gICAgICAgICAgbGV0IHRlbXAgPSBhd2FpdCB0aGlzSXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXNJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB0aGlzV3JhcHBlZEl0ZW0gPSBhd2FpdCB0ZW1wLnZhbHVlO1xuICAgICAgICAgICAgLy8gT2RkIGNvcm5lciBjYXNlIGZvciBlZGdlczsgc29tZXRpbWVzIHdlIHdhbnQgdG8gaGFzaCB0aGUgZ3JhbmRwYXJlbnQgaW5zdGVhZCBvZiB0aGUgcmVzdWx0IG9mXG4gICAgICAgICAgICAvLyBhbiBpbnRlcm1lZGlhdGUgam9pbjpcbiAgICAgICAgICAgIGNvbnN0IHRoaXNIYXNoSXRlbSA9IHRoaXMuaGFzaFRoaXNHcmFuZHBhcmVudCA/IHRoaXNXcmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IDogdGhpc1dyYXBwZWRJdGVtO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc0hhc2hJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgICB0aGlzSW5kZXguYWRkVmFsdWUoaGFzaCwgdGhpc0hhc2hJdGVtKTtcbiAgICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE5vdyBmb3IgYSBzYW1wbGUgZnJvbSB0aGUgb3RoZXIgc3RyZWFtXG4gICAgICAgICAgdGVtcCA9IGF3YWl0IG90aGVySXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIG90aGVySXNEb25lID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgLy8gYWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleFxuICAgICAgICAgICAgICBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSm9pblRva2VuO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4uL1N0cmVhbS5qcyc7XG5cbmNvbnN0IEFTVEVSSVNLUyA9IHtcbiAgJ2V2YWx1YXRlJzogJ+KGrCcsXG4gICdqb2luJzogJ+KorycsXG4gICdtYXAnOiAn4oamJyxcbiAgJ3Byb21vdGUnOiAn4oaRJyxcbiAgJ3ZhbHVlJzogJ+KGkidcbn07XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy5fc2VsZWN0b3IgPSBvcHRpb25zLnNlbGVjdG9yO1xuICAgIHRoaXMuY3VzdG9tQ2xhc3NOYW1lID0gb3B0aW9ucy5jdXN0b21DbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID0gb3B0aW9ucy5jdXN0b21OYW1lVG9rZW5JbmRleCB8fCBudWxsO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICB0aGlzLmluZGV4ZXMgPSBvcHRpb25zLmluZGV4ZXMgfHwge307XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sXG4gICAgICB0aGlzLm11cmUuTkFNRURfRlVOQ1RJT05TLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBmb3IgKGxldCBbZnVuY05hbWUsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubmFtZWRGdW5jdGlvbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtmdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc2VsZWN0b3I7XG4gIH1cbiAgZ2V0IHRva2VuQ2xhc3NMaXN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3IodGhpcy5zZWxlY3Rvcik7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzVHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgc2VsZWN0b3I6IHRoaXMuX3NlbGVjdG9yLFxuICAgICAgY3VzdG9tQ2xhc3NOYW1lOiB0aGlzLmN1c3RvbUNsYXNzTmFtZSxcbiAgICAgIGN1c3RvbU5hbWVUb2tlbkluZGV4OiB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4LFxuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgaW5kZXhlczoge30sXG4gICAgICBuYW1lZEZ1bmN0aW9uczoge31cbiAgICB9O1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIGxldCBzdHJpbmdpZmllZEZ1bmMgPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3R3YXJsb3N0L2lzdGFuYnVsL2lzc3Vlcy8zMTAjaXNzdWVjb21tZW50LTI3NDg4OTAyMlxuICAgICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICAgIHJlc3VsdC5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBzdHJpbmdpZmllZEZ1bmM7XG4gICAgfVxuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKHRoaXMuaW5kZXhlcykubWFwKGFzeW5jIChbZnVuY05hbWUsIGluZGV4XSkgPT4ge1xuICAgICAgaWYgKGluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIHJlc3VsdC5pbmRleGVzW2Z1bmNOYW1lXSA9IGF3YWl0IGluZGV4LnRvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgfSkpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIGlmICh0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gdmFsdWUpIHtcbiAgICAgIHRoaXMuY3VzdG9tQ2xhc3NOYW1lID0gdmFsdWU7XG4gICAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID0gdGhpcy5zZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZykubGVuZ3RoO1xuICAgICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgfVxuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5jdXN0b21DbGFzc05hbWUgIT09IG51bGwgJiZcbiAgICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPT09IHRoaXMuc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpLmxlbmd0aDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICBjb25zdCBzZWxlY3RvciA9IHRoaXMuc2VsZWN0b3I7XG4gICAgY29uc3QgdG9rZW5TdHJpbmdzID0gc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpO1xuICAgIGxldCByZXN1bHQgPSAnJztcbiAgICBmb3IgKGxldCBpID0gdG9rZW5TdHJpbmdzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAodGhpcy5jdXN0b21DbGFzc05hbWUgIT09IG51bGwgJiYgaSA8PSB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmN1c3RvbUNsYXNzTmFtZSArIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRlbXAgPSB0b2tlblN0cmluZ3NbaV0ubWF0Y2goL14uKFteKF0qKVxcKChbXildKilcXCkvKTtcbiAgICAgIGlmICh0ZW1wWzFdID09PSAna2V5cycgfHwgdGVtcFsxXSA9PT0gJ3ZhbHVlcycpIHtcbiAgICAgICAgaWYgKHRlbXBbMl0gPT09ICcnKSB7XG4gICAgICAgICAgcmVzdWx0ID0gJyonICsgcmVzdWx0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdCA9IHRlbXBbMl0ucmVwbGFjZSgvJyhbXiddKiknLywgJyQxJykgKyByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdCA9IEFTVEVSSVNLU1t0ZW1wWzFdXSArIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIChzZWxlY3Rvci5zdGFydHNXaXRoKCdlbXB0eScpID8gJ+KIhScgOiAnJykgKyByZXN1bHQ7XG4gIH1cbiAgYWRkSGFzaEZ1bmN0aW9uIChmdW5jTmFtZSwgZnVuYykge1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gZnVuYztcbiAgfVxuICBwb3B1bGF0ZVN0cmVhbU9wdGlvbnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdDtcbiAgICBvcHRpb25zLm5hbWVkRnVuY3Rpb25zID0gdGhpcy5uYW1lZEZ1bmN0aW9ucztcbiAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gdGhpcztcbiAgICBvcHRpb25zLmluZGV4ZXMgPSB0aGlzLmluZGV4ZXM7XG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cbiAgZ2V0U3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAob3B0aW9ucy5yZXNldCB8fCAhdGhpcy5fc3RyZWFtKSB7XG4gICAgICB0aGlzLl9zdHJlYW0gPSBuZXcgU3RyZWFtKHRoaXMucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbTtcbiAgfVxuICBpc1N1cGVyU2V0T2ZUb2tlbkxpc3QgKHRva2VuTGlzdCkge1xuICAgIGlmICh0b2tlbkxpc3QubGVuZ3RoICE9PSB0aGlzLnRva2VuTGlzdC5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmV2ZXJ5KCh0b2tlbiwgaSkgPT4gdG9rZW4uaXNTdXBlclNldE9mKHRva2VuTGlzdFtpXSkpO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhd2FpdCB0aGlzLnRvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF0gPSBuZXcgdGhpcy5tdXJlLkNMQVNTRVMuTm9kZUNsYXNzKG9wdGlvbnMpO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhd2FpdCB0aGlzLnRvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF0gPSBuZXcgdGhpcy5tdXJlLkNMQVNTRVMuRWRnZUNsYXNzKG9wdGlvbnMpO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICB9XG4gIGFzeW5jIGFnZ3JlZ2F0ZSAoaGFzaCwgcmVkdWNlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZXhwYW5kIChtYXApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBmaWx0ZXIgKGZpbHRlcikge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIHNwbGl0IChoYXNoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZGVsZXRlICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXI7XG4gICAgdGhpcy5lZGdlQ29ubmVjdGlvbnMgPSBvcHRpb25zLmVkZ2VDb25uZWN0aW9ucyB8fCB7fTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgLy8gVE9ETzogYSBiYWJlbCBidWcgKGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMzkzMClcbiAgICAvLyBwcmV2ZW50cyBgYXdhaXQgc3VwZXJgOyB0aGlzIGlzIGEgd29ya2Fyb3VuZDpcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBHZW5lcmljQ2xhc3MucHJvdG90eXBlLnRvUmF3T2JqZWN0LmNhbGwodGhpcyk7XG4gICAgLy8gVE9ETzogbmVlZCB0byBkZWVwIGNvcHkgZWRnZUNvbm5lY3Rpb25zP1xuICAgIHJlc3VsdC5lZGdlQ29ubmVjdGlvbnMgPSB0aGlzLmVkZ2VDb25uZWN0aW9ucztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgZGlyZWN0ZWQsIHRoaXNIYXNoTmFtZSwgb3RoZXJIYXNoTmFtZSB9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gYXdhaXQgdGhpcy5tdXJlLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBudWxsLFxuICAgICAgQ2xhc3NUeXBlOiB0aGlzLm11cmUuQ0xBU1NFUy5FZGdlQ2xhc3MsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgZGlyZWN0ZWRcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDb25uZWN0aW9uc1tlZGdlQ2xhc3MuY2xhc3NJZF0gPSB7IG5vZGVIYXNoTmFtZTogdGhpc0hhc2hOYW1lIH07XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW2VkZ2VDbGFzcy5jbGFzc0lkXSA9IHsgbm9kZUhhc2hOYW1lOiBvdGhlckhhc2hOYW1lIH07XG4gICAgZGVsZXRlIHRoaXMuX3N0cmVhbTtcbiAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBhc3luYyBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcblxuICAgIGlmICghdGhpcy5fc2VsZWN0b3IpIHtcbiAgICAgIGlmICghc291cmNlQ2xhc3MgfHwgIXRhcmdldENsYXNzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFydGlhbCBjb25uZWN0aW9ucyB3aXRob3V0IGFuIGVkZ2UgdGFibGUgc2hvdWxkIG5ldmVyIGhhcHBlbmApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm8gZWRnZSB0YWJsZSAoc2ltcGxlIGpvaW4gYmV0d2VlbiB0d28gbm9kZXMpXG4gICAgICAgIGNvbnN0IHNvdXJjZUhhc2ggPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXS5ub2RlSGFzaE5hbWU7XG4gICAgICAgIGNvbnN0IHRhcmdldEhhc2ggPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXS5ub2RlSGFzaE5hbWU7XG4gICAgICAgIHJldHVybiBzb3VyY2VDbGFzcy5zZWxlY3RvciArIGAuam9pbih0YXJnZXQsICR7c291cmNlSGFzaH0sICR7dGFyZ2V0SGFzaH0sIGRlZmF1bHRGaW5pc2gsIHNvdXJjZVRhcmdldClgO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgcmVzdWx0ID0gdGhpcy5fc2VsZWN0b3I7XG4gICAgICBpZiAoIXNvdXJjZUNsYXNzKSB7XG4gICAgICAgIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgICAvLyBObyBjb25uZWN0aW9ucyB5ZXQ7IGp1c3QgeWllbGQgdGhlIHJhdyBlZGdlIHRhYmxlXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBQYXJ0aWFsIGVkZ2UtdGFyZ2V0IGNvbm5lY3Rpb25zXG4gICAgICAgICAgY29uc3QgeyBlZGdlSGFzaE5hbWUsIG5vZGVIYXNoTmFtZSB9ID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdCArIGAuam9pbih0YXJnZXQsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoLCBlZGdlVGFyZ2V0KWA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIXRhcmdldENsYXNzKSB7XG4gICAgICAgIC8vIFBhcnRpYWwgc291cmNlLWVkZ2UgY29ubmVjdGlvbnNcbiAgICAgICAgY29uc3QgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJldHVybiByZXN1bHQgKyBgLmpvaW4oc291cmNlLCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaCwgc291cmNlRWRnZSlgO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRnVsbCBjb25uZWN0aW9uc1xuICAgICAgICBsZXQgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJlc3VsdCArPSBgLmpvaW4oc291cmNlLCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgICAoeyBlZGdlSGFzaE5hbWUsIG5vZGVIYXNoTmFtZSB9ID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0pO1xuICAgICAgICByZXN1bHQgKz0gYC5qb2luKHRhcmdldCwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gsIGZ1bGwpYDtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcG9wdWxhdGVTdHJlYW1PcHRpb25zIChvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zID0ge307XG4gICAgaWYgKCF0aGlzLl9zZWxlY3Rvcikge1xuICAgICAgLy8gVXNlIHRoZSBvcHRpb25zIGZyb20gdGhlIHNvdXJjZSBzdHJlYW0gaW5zdGVhZCBvZiBvdXIgY2xhc3NcbiAgICAgIG9wdGlvbnMgPSBzb3VyY2VDbGFzcy5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy50YXJnZXQgPSB0YXJnZXRDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IHN1cGVyLnBvcHVsYXRlU3RyZWFtT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgIGlmIChzb3VyY2VDbGFzcykge1xuICAgICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy5zb3VyY2UgPSBzb3VyY2VDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICAgIH1cbiAgICAgIGlmICh0YXJnZXRDbGFzcykge1xuICAgICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy50YXJnZXQgPSB0YXJnZXRDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIC8vIFRPRE86IGEgYmFiZWwgYnVnIChodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzM5MzApXG4gICAgLy8gcHJldmVudHMgYGF3YWl0IHN1cGVyYDsgdGhpcyBpcyBhIHdvcmthcm91bmQ6XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgR2VuZXJpY0NsYXNzLnByb3RvdHlwZS50b1Jhd09iamVjdC5jYWxsKHRoaXMpO1xuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBhc3luYyBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCBkaXJlY3Rpb24sIG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0pIHtcbiAgICBpZiAoZGlyZWN0aW9uID09PSAnc291cmNlJykge1xuICAgICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uID09PSAndGFyZ2V0Jykge1xuICAgICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXS5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIH0gZWxzZSBpZiAoIXRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgU291cmNlIGFuZCB0YXJnZXQgYXJlIGFscmVhZHkgZGVmaW5lZDsgcGxlYXNlIHNwZWNpZnkgYSBkaXJlY3Rpb24gdG8gb3ZlcnJpZGVgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdID0geyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9O1xuICAgIGRlbGV0ZSB0aGlzLl9zdHJlYW07XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLndyYXBwZWRQYXJlbnQgPSB3cmFwcGVkUGFyZW50O1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICB0aGlzLnJhd0l0ZW0gPSByYXdJdGVtO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgc3VwZXIoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdzb3VyY2VUYXJnZXQnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIHNvdXJjZTogdGhpcy5yYXdJdGVtLmxlZnQsXG4gICAgICAgIHRhcmdldDogdGhpcy5yYXdJdGVtLnJpZ2h0XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdlZGdlVGFyZ2V0Jykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBlZGdlOiB0aGlzLnJhd0l0ZW0ubGVmdCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLnJhd0l0ZW0ucmlnaHRcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ3NvdXJjZUVkZ2UnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIHNvdXJjZTogdGhpcy5yYXdJdGVtLnJpZ2h0LFxuICAgICAgICBlZGdlOiB0aGlzLnJhd0l0ZW0ubGVmdFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnZnVsbCcpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgc291cmNlOiB0aGlzLnJhd0l0ZW0ubGVmdC5yaWdodCxcbiAgICAgICAgZWRnZTogdGhpcy5yYXdJdGVtLmxlZnQubGVmdCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLnJhd0l0ZW0ucmlnaHRcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlZGdlUm9sZTogJHt0b2tlbi5lZGdlUm9sZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJjbGFzcyBJbk1lbW9yeUluZGV4IHtcbiAgY29uc3RydWN0b3IgKHsgZW50cmllcyA9IHt9LCBjb21wbGV0ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXM7XG4gICAgdGhpcy5jb21wbGV0ZSA9IGNvbXBsZXRlO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzO1xuICB9XG4gIGFzeW5jICogaXRlckVudHJpZXMgKCkge1xuICAgIGZvciAoY29uc3QgW2hhc2gsIHZhbHVlTGlzdF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgeyBoYXNoLCB2YWx1ZUxpc3QgfTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVySGFzaGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IGhhc2ggb2YgT2JqZWN0LmtleXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgaGFzaDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyVmFsdWVMaXN0cyAoKSB7XG4gICAgZm9yIChjb25zdCB2YWx1ZUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB2YWx1ZUxpc3Q7XG4gICAgfVxuICB9XG4gIGFzeW5jIGdldFZhbHVlTGlzdCAoaGFzaCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXNbaGFzaF0gfHwgW107XG4gIH1cbiAgYXN5bmMgYWRkVmFsdWUgKGhhc2gsIHZhbHVlKSB7XG4gICAgLy8gVE9ETzogYWRkIHNvbWUga2luZCBvZiB3YXJuaW5nIGlmIHRoaXMgaXMgZ2V0dGluZyBiaWc/XG4gICAgdGhpcy5lbnRyaWVzW2hhc2hdID0gYXdhaXQgdGhpcy5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgaWYgKHRoaXMuZW50cmllc1toYXNoXS5pbmRleE9mKHZhbHVlKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuZW50cmllc1toYXNoXS5wdXNoKHZhbHVlKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluTWVtb3J5SW5kZXg7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IHNoYTEgZnJvbSAnc2hhMSc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi9TdHJlYW0uanMnO1xuaW1wb3J0ICogYXMgVE9LRU5TIGZyb20gJy4vVG9rZW5zL1Rva2Vucy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRPS0VOUyA9IFRPS0VOUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gTW9ua2V5LXBhdGNoIGF2YWlsYWJsZSB0b2tlbnMgYXMgZnVuY3Rpb25zIG9udG8gdGhlIFN0cmVhbSBjbGFzc1xuICAgIGZvciAoY29uc3QgdG9rZW5DbGFzc05hbWUgaW4gdGhpcy5UT0tFTlMpIHtcbiAgICAgIGNvbnN0IFRva2VuQ2xhc3MgPSB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV07XG4gICAgICBTdHJlYW0ucHJvdG90eXBlW1Rva2VuQ2xhc3MubG93ZXJDYW1lbENhc2VUeXBlXSA9IGZ1bmN0aW9uIChhcmdMaXN0LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmV4dGVuZChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgeWllbGQge1xuICAgICAgICAgIGxlZnQ6IHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgIHJpZ2h0OiBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy5yb290ID0gdGhpcy5sb2FkUm9vdCgpO1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgb3VyIGNsYXNzIHNwZWNpZmljYXRpb25zXG4gICAgdGhpcy5jbGFzc2VzID0gdGhpcy5sb2FkQ2xhc3NlcygpO1xuICB9XG5cbiAgbG9hZFJvb3QgKCkge1xuICAgIGxldCByb290ID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbXVyZV9yb290Jyk7XG4gICAgcm9vdCA9IHJvb3QgPyBKU09OLnBhcnNlKHJvb3QpIDoge307XG4gICAgcmV0dXJuIHJvb3Q7XG4gIH1cbiAgYXN5bmMgc2F2ZVJvb3QgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbXVyZV9yb290JywgSlNPTi5zdHJpbmdpZnkodGhpcy5yb290KSk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncm9vdFVwZGF0ZScpO1xuICB9XG4gIGxvYWRDbGFzc2VzICgpIHtcbiAgICBsZXQgY2xhc3NlcyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ211cmVfY2xhc3NlcycpO1xuICAgIGNsYXNzZXMgPSBjbGFzc2VzID8gSlNPTi5wYXJzZShjbGFzc2VzKSA6IHt9O1xuICAgIE9iamVjdC5lbnRyaWVzKGNsYXNzZXMpLmZvckVhY2goKFsgY2xhc3NJZCwgcmF3Q2xhc3NPYmogXSkgPT4ge1xuICAgICAgT2JqZWN0LmVudHJpZXMocmF3Q2xhc3NPYmouaW5kZXhlcykuZm9yRWFjaCgoW2Z1bmNOYW1lLCByYXdJbmRleE9ial0pID0+IHtcbiAgICAgICAgcmF3Q2xhc3NPYmouaW5kZXhlc1tmdW5jTmFtZV0gPSBuZXcgdGhpcy5JTkRFWEVTLkluTWVtb3J5SW5kZXgoe1xuICAgICAgICAgIGVudHJpZXM6IHJhd0luZGV4T2JqLCBjb21wbGV0ZTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2xhc3NUeXBlID0gcmF3Q2xhc3NPYmouY2xhc3NUeXBlO1xuICAgICAgZGVsZXRlIHJhd0NsYXNzT2JqLmNsYXNzVHlwZTtcbiAgICAgIHJhd0NsYXNzT2JqLm11cmUgPSB0aGlzO1xuICAgICAgY2xhc3Nlc1tjbGFzc0lkXSA9IG5ldyB0aGlzLkNMQVNTRVNbY2xhc3NUeXBlXShyYXdDbGFzc09iaik7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNsYXNzZXM7XG4gIH1cbiAgYXN5bmMgc2F2ZUNsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgcmF3Q2xhc3NlcyA9IHt9O1xuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXModGhpcy5jbGFzc2VzKVxuICAgICAgICAubWFwKGFzeW5jIChbIGNsYXNzSWQsIGNsYXNzT2JqIF0pID0+IHtcbiAgICAgICAgICByYXdDbGFzc2VzW2NsYXNzSWRdID0gYXdhaXQgY2xhc3NPYmoudG9SYXdPYmplY3QoKTtcbiAgICAgICAgfSkpO1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbXVyZV9jbGFzc2VzJywgSlNPTi5zdHJpbmdpZnkocmF3Q2xhc3NlcykpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ2NsYXNzVXBkYXRlJyk7XG4gIH1cblxuICBwYXJzZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZykge1xuICAgIGNvbnN0IHN0YXJ0c1dpdGhSb290ID0gc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgncm9vdCcpO1xuICAgIGlmICghKHN0YXJ0c1dpdGhSb290IHx8IHNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ2VtcHR5JykpKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFNlbGVjdG9ycyBtdXN0IHN0YXJ0IHdpdGggJ3Jvb3QnIG9yICdlbXB0eSdgKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5TdHJpbmdzID0gc2VsZWN0b3JTdHJpbmcubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpO1xuICAgIGlmICghdG9rZW5TdHJpbmdzKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgc2VsZWN0b3Igc3RyaW5nOiAke3NlbGVjdG9yU3RyaW5nfWApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlbkNsYXNzTGlzdCA9IFt7XG4gICAgICBUb2tlbkNsYXNzOiBzdGFydHNXaXRoUm9vdCA/IHRoaXMuVE9LRU5TLlJvb3RUb2tlbiA6IHRoaXMuVE9LRU5TLkVtcHR5VG9rZW5cbiAgICB9XTtcbiAgICB0b2tlblN0cmluZ3MuZm9yRWFjaChjaHVuayA9PiB7XG4gICAgICBjb25zdCB0ZW1wID0gY2h1bmsubWF0Y2goL14uKFteKF0qKVxcKChbXildKilcXCkvKTtcbiAgICAgIGlmICghdGVtcCkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgdG9rZW46ICR7Y2h1bmt9YCk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b2tlbkNsYXNzTmFtZSA9IHRlbXBbMV1bMF0udG9VcHBlckNhc2UoKSArIHRlbXBbMV0uc2xpY2UoMSkgKyAnVG9rZW4nO1xuICAgICAgY29uc3QgYXJnTGlzdCA9IHRlbXBbMl0uc3BsaXQoLyg/PCFcXFxcKSwvKS5tYXAoZCA9PiB7XG4gICAgICAgIGQgPSBkLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIGQgPT09ICcnID8gdW5kZWZpbmVkIDogZDtcbiAgICAgIH0pO1xuICAgICAgaWYgKHRva2VuQ2xhc3NOYW1lID09PSAnVmFsdWVzVG9rZW4nKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLktleXNUb2tlbixcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5WYWx1ZVRva2VuXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0pIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gdG9rZW46ICR7dGVtcFsxXX1gKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdG9rZW5DbGFzc0xpc3Q7XG4gIH1cblxuICBzdHJlYW0gKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnBhcnNlU2VsZWN0b3Iob3B0aW9ucy5zZWxlY3RvciB8fCBgcm9vdC52YWx1ZXMoKWApO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG5cbiAgYXN5bmMgbmV3Q2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgcm9vdGAgfSkge1xuICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7TkVYVF9DTEFTU19JRH1gO1xuICAgIE5FWFRfQ0xBU1NfSUQgKz0gMTtcbiAgICBjb25zdCBDbGFzc1R5cGUgPSBvcHRpb25zLkNsYXNzVHlwZSB8fCB0aGlzLkNMQVNTRVMuR2VuZXJpY0NsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLkNsYXNzVHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IENsYXNzVHlwZShvcHRpb25zKTtcbiAgICBhd2FpdCB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHk7IHRyeSBhZGREeW5hbWljRGF0YVNvdXJjZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSh7XG4gICAgICBrZXk6IGZpbGVPYmoubmFtZSxcbiAgICAgIGV4dGVuc2lvbjogZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24oZmlsZU9iai50eXBlKSxcbiAgICAgIHRleHRcbiAgICB9KTtcbiAgfVxuICBhc3luYyBhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBrZXksXG4gICAgZXh0ZW5zaW9uID0gJ3R4dCcsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgbGV0IG9iajtcbiAgICBpZiAodGhpcy5EQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgb2JqID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBkZWxldGUgb2JqLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljRGF0YVNvdXJjZShrZXksIG9iaik7XG4gIH1cbiAgYXN5bmMgYWRkU3RhdGljRGF0YVNvdXJjZSAoa2V5LCBvYmopIHtcbiAgICB0aGlzLnJvb3Rba2V5XSA9IG9iajtcbiAgICBjb25zdCB0ZW1wID0gYXdhaXQgUHJvbWlzZS5hbGwoW3RoaXMuc2F2ZVJvb3QoKSwgdGhpcy5uZXdDbGFzcyh7XG4gICAgICBzZWxlY3RvcjogYHJvb3QudmFsdWVzKCcke2tleX0nKS52YWx1ZXMoKWBcbiAgICB9KV0pO1xuICAgIHJldHVybiB0ZW1wWzFdO1xuICB9XG4gIGFzeW5jIHJlbW92ZURhdGFTb3VyY2UgKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLnJvb3Rba2V5XTtcbiAgICBhd2FpdCB0aGlzLnNhdmVSb290KCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVyZTtcbiIsImltcG9ydCBNdXJlIGZyb20gJy4vTXVyZS5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5pbXBvcnQgRmlsZVJlYWRlciBmcm9tICdmaWxlcmVhZGVyJztcblxubGV0IG11cmUgPSBuZXcgTXVyZShGaWxlUmVhZGVyLCBudWxsKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsIm9mZiIsImluZGV4Iiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5Iiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiT2JqZWN0IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJTdHJlYW0iLCJvcHRpb25zIiwibXVyZSIsIm5hbWVkRnVuY3Rpb25zIiwiTkFNRURfRlVOQ1RJT05TIiwibmFtZWRTdHJlYW1zIiwibGF1bmNoZWRGcm9tQ2xhc3MiLCJpbmRleGVzIiwidG9rZW5DbGFzc0xpc3QiLCJ0b2tlbkxpc3QiLCJtYXAiLCJUb2tlbkNsYXNzIiwiYXJnTGlzdCIsIldyYXBwZXJzIiwiZ2V0V3JhcHBlckxpc3QiLCJ0b2tlbiIsImxlbmd0aCIsIldyYXBwZXIiLCJsb2NhbFRva2VuTGlzdCIsInNsaWNlIiwicG90ZW50aWFsV3JhcHBlcnMiLCJ2YWx1ZXMiLCJjbGFzc2VzIiwiZmlsdGVyIiwiY2xhc3NPYmoiLCJjbGFzc1Rva2VuTGlzdCIsImV2ZXJ5IiwibG9jYWxUb2tlbiIsImxvY2FsSW5kZXgiLCJ0b2tlbkNsYXNzU3BlYyIsImlzU3Vic2V0T2YiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwiY29uc29sZSIsIndhcm4iLCJzZWxlY3RvciIsImpvaW4iLCJmb3JrIiwicGFyc2VTZWxlY3RvciIsImV4dGVuZCIsImNvbmNhdCIsIndyYXAiLCJ3cmFwcGVkUGFyZW50IiwicmF3SXRlbSIsImhhc2hlcyIsIndyYXBwZXJJbmRleCIsInRlbXAiLCJ3cmFwcGVkSXRlbSIsIlByb21pc2UiLCJhbGwiLCJlbnRyaWVzIiwicmVkdWNlIiwicHJvbWlzZUxpc3QiLCJoYXNoRnVuY3Rpb25OYW1lIiwiaGFzaCIsImdldEluZGV4IiwiY29tcGxldGUiLCJhZGRWYWx1ZSIsIml0ZXJhdGUiLCJsYXN0VG9rZW4iLCJJTkRFWEVTIiwiSW5NZW1vcnlJbmRleCIsImJ1aWxkSW5kZXgiLCJoYXNoRnVuY3Rpb24iLCJFcnJvciIsInNhbXBsZSIsImxpbWl0IiwicmVidWlsZEluZGV4ZXMiLCJpdGVyYXRvciIsIm5leHQiLCJkb25lIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b1N0cmluZyIsInRvTG93ZXJDYXNlIiwiaXNTdWJTZXRPZiIsImFuY2VzdG9yVG9rZW5zIiwiaXRlcmF0ZVBhcmVudCIsInBhcmVudFRva2VuIiwieWllbGRlZFNvbWV0aGluZyIsImRlYnVnIiwiVHlwZUVycm9yIiwiZXhlYyIsIm5hbWUiLCJFbXB0eVRva2VuIiwiUm9vdFRva2VuIiwicm9vdCIsIktleXNUb2tlbiIsIm1hdGNoQWxsIiwia2V5cyIsInJhbmdlcyIsInVuZGVmaW5lZCIsImFyZyIsIm1hdGNoIiwiSW5maW5pdHkiLCJkIiwicGFyc2VJbnQiLCJpc05hTiIsImxvdyIsImhpZ2giLCJudW0iLCJOdW1iZXIiLCJTeW50YXhFcnJvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJjb25zb2xpZGF0ZVJhbmdlcyIsInNlbGVjdHNOb3RoaW5nIiwibmV3UmFuZ2VzIiwic29ydCIsImEiLCJiIiwiY3VycmVudFJhbmdlIiwiZGlmZmVyZW5jZSIsIm90aGVyVG9rZW4iLCJuZXdLZXlzIiwia2V5IiwiYWxsUG9pbnRzIiwiYWdnIiwicmFuZ2UiLCJpbmNsdWRlIiwiZXhjbHVkZSIsImRpZmYiLCJNYXRoIiwibWF4IiwibWluIiwiaGFzT3duUHJvcGVydHkiLCJWYWx1ZVRva2VuIiwib2JqIiwia2V5VHlwZSIsIkV2YWx1YXRlVG9rZW4iLCJuZXdTdHJlYW0iLCJlcnIiLCJNYXBUb2tlbiIsImdlbmVyYXRvciIsIm1hcHBlZFJhd0l0ZW0iLCJQcm9tb3RlVG9rZW4iLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwibWFwRnVuY3Rpb24iLCJyZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiIsImhhc2hJbmRleCIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJnZXRWYWx1ZUxpc3QiLCJKb2luVG9rZW4iLCJvdGhlclN0cmVhbSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiZmluaXNoIiwiZWRnZVJvbGUiLCJoYXNoVGhpc0dyYW5kcGFyZW50IiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwidmFsdWVMaXN0IiwiaXRlckVudHJpZXMiLCJvdGhlckxpc3QiLCJvdGhlcldyYXBwZWRJdGVtIiwidGhpc1dyYXBwZWRJdGVtIiwidGhpc0xpc3QiLCJ0aGlzSGFzaEl0ZW0iLCJ0aGlzSXRlcmF0b3IiLCJ0aGlzSW5kaXJlY3RLZXkiLCJ0aGlzSXNEb25lIiwib3RoZXJJdGVyYXRvciIsIm90aGVySXNEb25lIiwiQVNURVJJU0tTIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9zZWxlY3RvciIsImN1c3RvbUNsYXNzTmFtZSIsImN1c3RvbU5hbWVUb2tlbkluZGV4IiwiZnVuY05hbWUiLCJGdW5jdGlvbiIsInRvUmF3T2JqZWN0IiwicmVzdWx0IiwiY2xhc3NUeXBlIiwic3RyaW5naWZpZWRGdW5jIiwic2V0Q2xhc3NOYW1lIiwic2F2ZUNsYXNzZXMiLCJoYXNDdXN0b21OYW1lIiwiY2xhc3NOYW1lIiwidG9rZW5TdHJpbmdzIiwic3RhcnRzV2l0aCIsImFkZEhhc2hGdW5jdGlvbiIsInBvcHVsYXRlU3RyZWFtT3B0aW9ucyIsImdldFN0cmVhbSIsInJlc2V0IiwiX3N0cmVhbSIsImlzU3VwZXJTZXRPZlRva2VuTGlzdCIsImlzU3VwZXJTZXRPZiIsImludGVycHJldEFzTm9kZXMiLCJDTEFTU0VTIiwiTm9kZUNsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIkVkZ2VDbGFzcyIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsInNwbGl0IiwiZGVsZXRlIiwiTm9kZVdyYXBwZXIiLCJlZGdlQ29ubmVjdGlvbnMiLCJwcm90b3R5cGUiLCJjYWxsIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJkaXJlY3RlZCIsInRoaXNIYXNoTmFtZSIsIm90aGVySGFzaE5hbWUiLCJlZGdlQ2xhc3MiLCJuZXdDbGFzcyIsIkNsYXNzVHlwZSIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwibm9kZUhhc2hOYW1lIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibm9kZUNsYXNzIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwic291cmNlSGFzaCIsInRhcmdldEhhc2giLCJlZGdlSGFzaE5hbWUiLCJ0YXJnZXQiLCJzb3VyY2UiLCJkaXJlY3Rpb24iLCJsZWZ0IiwicmlnaHQiLCJlZGdlIiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiTkVYVF9DTEFTU19JRCIsIk11cmUiLCJGaWxlUmVhZGVyIiwibG9jYWxTdG9yYWdlIiwibWltZSIsIkRBVEFMSUJfRk9STUFUUyIsIlRPS0VOUyIsInRva2VuQ2xhc3NOYW1lIiwiaWRlbnRpdHkiLCJwYXJlbnRUeXBlIiwiZGVmYXVsdEZpbmlzaCIsInNoYTEiLCJub29wIiwibG9hZFJvb3QiLCJsb2FkQ2xhc3NlcyIsImdldEl0ZW0iLCJwYXJzZSIsInNhdmVSb290Iiwic2V0SXRlbSIsInJhd0NsYXNzT2JqIiwicmF3SW5kZXhPYmoiLCJyYXdDbGFzc2VzIiwic2VsZWN0b3JTdHJpbmciLCJzdGFydHNXaXRoUm9vdCIsImNodW5rIiwidG9VcHBlckNhc2UiLCJ0cmltIiwiYWRkRmlsZUFzU3RhdGljRGF0YVNvdXJjZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwidGV4dCIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljRGF0YVNvdXJjZSIsInJlbW92ZURhdGFTb3VyY2UiLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsYUFBTCxHQUFxQixFQUFyQjtXQUNLQyxjQUFMLEdBQXNCLEVBQXRCOzs7SUFFRkMsRUFBRSxDQUFFQyxTQUFGLEVBQWFDLFFBQWIsRUFBdUJDLHVCQUF2QixFQUFnRDtVQUM1QyxDQUFDLEtBQUtMLGFBQUwsQ0FBbUJHLFNBQW5CLENBQUwsRUFBb0M7YUFDN0JILGFBQUwsQ0FBbUJHLFNBQW5CLElBQWdDLEVBQWhDOzs7VUFFRSxDQUFDRSx1QkFBTCxFQUE4QjtZQUN4QixLQUFLTCxhQUFMLENBQW1CRyxTQUFuQixFQUE4QkcsT0FBOUIsQ0FBc0NGLFFBQXRD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
