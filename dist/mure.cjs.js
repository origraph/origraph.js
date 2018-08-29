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
    this.tokenClassList = options.tokenClassList || []; // Reminder: this always needs to be after initializing this.namedFunctions
    // and this.namedStreams

    this.tokenList = options.tokenClassList.map(({
      TokenClass,
      argList
    }) => {
      return new TokenClass(this, argList);
    }); // Reminder: this always needs to be after initializing this.tokenList

    this.Wrappers = this.getWrapperList(); // TODO: preserve these somehow?

    this.indexes = {};
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
      launchedFromClass: this.launchedFromClass
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
    return new Stream(options);
  }

  wrap({
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
    return wrappedItem;
  }

  getIndex(hashFunctionName, token) {
    if (!this.indexes[hashFunctionName]) {
      this.indexes[hashFunctionName] = {};
    }

    const tokenIndex = this.tokenList.indexOf(token);

    if (!this.indexes[hashFunctionName][tokenIndex]) {
      // TODO: figure out external indexes...
      this.indexes[hashFunctionName][tokenIndex] = new this.mure.INDEXES.InMemoryIndex();
    }

    return this.indexes[hashFunctionName][tokenIndex];
  }

  async *iterate() {
    const lastToken = this.tokenList[this.tokenList.length - 1];
    const temp = this.tokenList.slice(0, this.tokenList.length - 1);
    yield* await lastToken.iterate(temp);
  }

  async *sample({
    limit = 10,
    rebuildIndexes = false
  }) {
    const iterator = this.iterate();

    for (let i = 0; i < limit; i++) {
      const temp = await iterator.next();

      if (temp.done) {
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

  async wrap({
    wrappedParent,
    rawItem
  }) {
    // IndexedToken overrides with an async function
    return this.stream.wrap({
      wrappedParent,
      token: this,
      rawItem
    });
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
    yield this.wrap({
      wrappedParent: null,
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
          yield this.wrap({
            wrappedParent,
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
              yield this.wrap({
                wrappedParent,
                rawItem: i
              });
            }
          }
        }

        for (let key in this.keys || {}) {
          if (wrappedParent.rawItem.hasOwnProperty(key)) {
            yield this.wrap({
              wrappedParent,
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

      yield this.wrap({
        wrappedParent,
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
        yield this.wrap({
          wrappedParent,
          rawItem: mappedRawItem
        });
      }
    }
  }

}

class IndexedToken extends BaseToken {
  async wrap({
    wrappedParent,
    rawItem,
    hashes = {}
  }) {
    const wrappedItem = await super.wrap({
      wrappedParent,
      rawItem
    });

    for (const [hashFuncName, hash] of Object.entries(hashes)) {
      const index = this.stream.getIndex(hashFuncName, this);
      await index.addValue(hash, wrappedItem);
    }

    return wrappedItem;
  }

}

class PromoteToken extends IndexedToken {
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
      const hashIndex = this.stream.getIndex(this.hash, this);

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
          yield this.wrap({
            wrappedParent,
            rawItem: mappedRawItem,
            hashes
          });
        }
      }
    }
  }

}

class JoinToken extends IndexedToken {
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
    const finishFunction = this.stream.namedFunctions[this.finish];
    const thisIndex = this.stream.getIndex(this.thisHash, this);
    const otherIndex = otherStream.getIndex(this.otherHash, this);

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
                yield this.wrap({
                  wrappedParent: thisWrappedItem,
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
                yield this.wrap({
                  wrappedParent: thisWrappedItem,
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
                yield this.wrap({
                  wrappedParent: thisWrappedItem,
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
                  yield this.wrap({
                    wrappedParent: thisWrappedItem,
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
                  yield this.wrap({
                    wrappedParent: thisWrappedItem,
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

  toRawObject() {
    const result = {
      classType: this.constructor.name,
      selector: this._selector,
      customClassName: this.customClassName,
      customNameTokenIndex: this.customNameTokenIndex,
      classId: this.classId,
      namedFunctions: {}
    };

    for (let [funcName, func] of Object.entries(this.namedFunctions)) {
      let stringifiedFunc = func.toString(); // Istanbul adds some code to functions for computing coverage, that gets
      // included in the stringification process during testing. See:
      // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022

      stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
      result.namedFunctions[funcName] = stringifiedFunc;
    }

    return result;
  }

  setClassName(value) {
    if (this.customClassName !== value) {
      this.customClassName = value;
      this.customNameTokenIndex = this.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
      this.mure.saveClasses();
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
    return options;
  }

  getStream(options = {}) {
    return new Stream(this.populateStreamOptions(options));
  }

  isSuperSetOfTokenList(tokenList) {
    if (tokenList.length !== this.tokenList.length) {
      return false;
    }

    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }

  interpretAsNodes() {
    const options = this.toRawObject();
    options.mure = this.mure;
    this.mure.classes[this.classId] = new this.mure.CLASSES.NodeClass(options);
    this.mure.saveClasses();
    return this.mure.classes[this.classId];
  }

  interpretAsEdges() {
    const options = this.toRawObject();
    options.mure = this.mure;
    this.mure.classes[this.classId] = new this.mure.CLASSES.EdgeClass(options);
    this.mure.saveClasses();
    return this.mure.classes[this.classId];
  }

  aggregate(hash, reduce) {
    throw new Error(`unimplemented`);
  }

  expand(map) {
    throw new Error(`unimplemented`);
  }

  filter(filter) {
    throw new Error(`unimplemented`);
  }

  split(hash) {
    throw new Error(`unimplemented`);
  }

  delete() {
    delete this.mure.classes[this.classId];
    this.mure.saveClasses();
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

  toRawObject() {
    const result = super.toRawObject(); // TODO: need to deep copy edgeConnections?

    result.edgeConnections = this.edgeConnections;
    return result;
  }

  interpretAsNodes() {
    return this;
  }

  interpretAsEdges() {
    throw new Error(`unimplemented`);
  }

  connectToNodeClass({
    otherNodeClass,
    directed,
    thisHashName,
    otherHashName
  }) {
    const edgeClass = this.mure.newClass({
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
    this.mure.saveClasses();
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }

  delete() {
    for (const edgeClassId of Object.keys(this.edgeConnections)) {
      const edgeClass = this.mure.classes[edgeClassId];

      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.sourceClassId = null;
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.targetClassId = null;
      }
    }

    super.delete();
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

  toRawObject() {
    const result = super.toRawObject();
    result.sourceClassId = this.sourceClassId;
    result.targetClassId = this.targetClassId;
    result.directed = this.directed;
    return result;
  }

  interpretAsNodes() {
    throw new Error(`unimplemented`);
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass({
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
    this.mure.saveClasses();
  }

  toggleNodeDirection(sourceClassId) {
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

    this.mure.saveClasses();
  }

  delete() {
    if (this.sourceClassId) {
      delete this.mure.classes[this.sourceClassId].edgeConnections[this.classId];
    }

    if (this.targetClassId) {
      delete this.mure.classes[this.targetClassId].edgeConnections[this.classId];
    }

    super.delete();
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
    } // if there is no edgeRole, leave the rawItem as-is

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

  saveRoot() {
    if (this.localStorage) {
      this.localStorage.setItem('mure_root', JSON.stringify(this.root));
    }

    this.trigger('rootUpdate');
  }

  loadClasses() {
    let classes = this.localStorage && this.localStorage.getItem('mure_classes');
    classes = classes ? JSON.parse(classes) : {};
    Object.entries(classes).forEach(([classId, rawClassObj]) => {
      const classType = rawClassObj.classType;
      delete rawClassObj.classType;
      rawClassObj.mure = this;
      classes[classId] = new this.CLASSES[classType](rawClassObj);
    });
    return classes;
  }

  saveClasses() {
    if (this.localStorage) {
      const rawClasses = {};

      for (const [classId, classObj] of Object.entries(this.classes)) {
        rawClasses[classId] = classObj.toRawObject();
      }

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

  newClass(options = {
    selector: `root`
  }) {
    options.classId = `class${NEXT_CLASS_ID}`;
    NEXT_CLASS_ID += 1;
    const ClassType = options.ClassType || this.CLASSES.GenericClass;
    delete options.ClassType;
    options.mure = this;
    this.classes[options.classId] = new ClassType(options);
    this.saveClasses();
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

  addStringAsStaticDataSource({
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

  addStaticDataSource(key, obj) {
    this.root[key] = obj;
    this.saveRoot();
    return this.newClass({
      selector: `root.values('${key}').values()`
    });
  }

  removeDataSource(key) {
    delete this.root[key];
    this.saveRoot();
  }

}

var name = "mure";
var version = "0.4.9r2";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvSW5kZXhlZFRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Qcm9tb3RlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0pvaW5Ub2tlbi5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9JbmRleGVzL0luTWVtb3J5SW5kZXguanMiLCIuLi9zcmMvTXVyZS5qcyIsIi4uL3NyYy9tYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIFN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy5uYW1lZFN0cmVhbXMgPSBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fTtcbiAgICB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCBudWxsO1xuICAgIHRoaXMudG9rZW5DbGFzc0xpc3QgPSBvcHRpb25zLnRva2VuQ2xhc3NMaXN0IHx8IFtdO1xuXG4gICAgLy8gUmVtaW5kZXI6IHRoaXMgYWx3YXlzIG5lZWRzIHRvIGJlIGFmdGVyIGluaXRpYWxpemluZyB0aGlzLm5hbWVkRnVuY3Rpb25zXG4gICAgLy8gYW5kIHRoaXMubmFtZWRTdHJlYW1zXG4gICAgdGhpcy50b2tlbkxpc3QgPSBvcHRpb25zLnRva2VuQ2xhc3NMaXN0Lm1hcCgoeyBUb2tlbkNsYXNzLCBhcmdMaXN0IH0pID0+IHtcbiAgICAgIHJldHVybiBuZXcgVG9rZW5DbGFzcyh0aGlzLCBhcmdMaXN0KTtcbiAgICB9KTtcbiAgICAvLyBSZW1pbmRlcjogdGhpcyBhbHdheXMgbmVlZHMgdG8gYmUgYWZ0ZXIgaW5pdGlhbGl6aW5nIHRoaXMudG9rZW5MaXN0XG4gICAgdGhpcy5XcmFwcGVycyA9IHRoaXMuZ2V0V3JhcHBlckxpc3QoKTtcblxuICAgIC8vIFRPRE86IHByZXNlcnZlIHRoZXNlIHNvbWVob3c/XG4gICAgdGhpcy5pbmRleGVzID0ge307XG4gIH1cblxuICBnZXRXcmFwcGVyTGlzdCAoKSB7XG4gICAgLy8gTG9vayB1cCB3aGljaCwgaWYgYW55LCBjbGFzc2VzIGRlc2NyaWJlIHRoZSByZXN1bHQgb2YgZWFjaCB0b2tlbiwgc28gdGhhdFxuICAgIC8vIHdlIGNhbiB3cmFwIGl0ZW1zIGFwcHJvcHJpYXRlbHk6XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0Lm1hcCgodG9rZW4sIGluZGV4KSA9PiB7XG4gICAgICBpZiAoaW5kZXggPT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEgJiYgdGhpcy5sYXVuY2hlZEZyb21DbGFzcykge1xuICAgICAgICAvLyBJZiB0aGlzIHN0cmVhbSB3YXMgc3RhcnRlZCBmcm9tIGEgY2xhc3MsIHdlIGFscmVhZHkga25vdyB3ZSBzaG91bGRcbiAgICAgICAgLy8gdXNlIHRoYXQgY2xhc3MncyB3cmFwcGVyIGZvciB0aGUgbGFzdCB0b2tlblxuICAgICAgICByZXR1cm4gdGhpcy5sYXVuY2hlZEZyb21DbGFzcy5XcmFwcGVyO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBhIGNsYXNzIHRoYXQgZGVzY3JpYmVzIGV4YWN0bHkgZWFjaCBzZXJpZXMgb2YgdG9rZW5zXG4gICAgICBjb25zdCBsb2NhbFRva2VuTGlzdCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIGluZGV4ICsgMSk7XG4gICAgICBjb25zdCBwb3RlbnRpYWxXcmFwcGVycyA9IE9iamVjdC52YWx1ZXModGhpcy5tdXJlLmNsYXNzZXMpXG4gICAgICAgIC5maWx0ZXIoY2xhc3NPYmogPT4ge1xuICAgICAgICAgIGNvbnN0IGNsYXNzVG9rZW5MaXN0ID0gY2xhc3NPYmoudG9rZW5DbGFzc0xpc3Q7XG4gICAgICAgICAgaWYgKCFjbGFzc1Rva2VuTGlzdC5sZW5ndGggIT09IGxvY2FsVG9rZW5MaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbkxpc3QuZXZlcnkoKGxvY2FsVG9rZW4sIGxvY2FsSW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuQ2xhc3NTcGVjID0gY2xhc3NUb2tlbkxpc3RbbG9jYWxJbmRleF07XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbiBpbnN0YW5jZW9mIHRva2VuQ2xhc3NTcGVjLlRva2VuQ2xhc3MgJiZcbiAgICAgICAgICAgICAgdG9rZW4uaXNTdWJzZXRPZih0b2tlbkNsYXNzU3BlYy5hcmdMaXN0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIE5vIGNsYXNzZXMgZGVzY3JpYmUgdGhpcyBzZXJpZXMgb2YgdG9rZW5zLCBzbyB1c2UgdGhlIGdlbmVyaWMgd3JhcHBlclxuICAgICAgICByZXR1cm4gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYE11bHRpcGxlIGNsYXNzZXMgZGVzY3JpYmUgdGhlIHNhbWUgaXRlbSEgQXJiaXRyYXJpbHkgY2hvb3Npbmcgb25lLi4uYCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBvdGVudGlhbFdyYXBwZXJzWzBdLldyYXBwZXI7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5qb2luKCcnKTtcbiAgfVxuXG4gIGZvcmsgKHNlbGVjdG9yKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0oe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgbmFtZWRGdW5jdGlvbnM6IHRoaXMubmFtZWRGdW5jdGlvbnMsXG4gICAgICBuYW1lZFN0cmVhbXM6IHRoaXMubmFtZWRTdHJlYW1zLFxuICAgICAgdG9rZW5DbGFzc0xpc3Q6IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKHNlbGVjdG9yKSxcbiAgICAgIGxhdW5jaGVkRnJvbUNsYXNzOiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzXG4gICAgfSk7XG4gIH1cblxuICBleHRlbmQgKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICBvcHRpb25zLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZEZ1bmN0aW9ucywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkU3RyZWFtcywgb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge30pO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0LmNvbmNhdChbeyBUb2tlbkNsYXNzLCBhcmdMaXN0IH1dKTtcbiAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG5cbiAgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSwgaGFzaGVzID0ge30gfSkge1xuICAgIGxldCB3cmFwcGVySW5kZXggPSAwO1xuICAgIGxldCB0ZW1wID0gd3JhcHBlZFBhcmVudDtcbiAgICB3aGlsZSAodGVtcCAhPT0gbnVsbCkge1xuICAgICAgd3JhcHBlckluZGV4ICs9IDE7XG4gICAgICB0ZW1wID0gdGVtcC53cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IG5ldyB0aGlzLldyYXBwZXJzW3dyYXBwZXJJbmRleF0oeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cblxuICBnZXRJbmRleCAoaGFzaEZ1bmN0aW9uTmFtZSwgdG9rZW4pIHtcbiAgICBpZiAoIXRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSkge1xuICAgICAgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdID0ge307XG4gICAgfVxuICAgIGNvbnN0IHRva2VuSW5kZXggPSB0aGlzLnRva2VuTGlzdC5pbmRleE9mKHRva2VuKTtcbiAgICBpZiAoIXRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXVt0b2tlbkluZGV4XSkge1xuICAgICAgLy8gVE9ETzogZmlndXJlIG91dCBleHRlcm5hbCBpbmRleGVzLi4uXG4gICAgICB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV1bdG9rZW5JbmRleF0gPSBuZXcgdGhpcy5tdXJlLklOREVYRVMuSW5NZW1vcnlJbmRleCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdW3Rva2VuSW5kZXhdO1xuICB9XG5cbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICBjb25zdCBsYXN0VG9rZW4gPSB0aGlzLnRva2VuTGlzdFt0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50b2tlbkxpc3Quc2xpY2UoMCwgdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSk7XG4gICAgeWllbGQgKiBhd2FpdCBsYXN0VG9rZW4uaXRlcmF0ZSh0ZW1wKTtcbiAgfVxuXG4gIGFzeW5jICogc2FtcGxlICh7IGxpbWl0ID0gMTAsIHJlYnVpbGRJbmRleGVzID0gZmFsc2UgfSkge1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVRva2VuIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgLy8gVGhlIHN0cmluZyB2ZXJzaW9uIG9mIG1vc3QgdG9rZW5zIGNhbiBqdXN0IGJlIGRlcml2ZWQgZnJvbSB0aGUgY2xhc3MgdHlwZVxuICAgIHJldHVybiBgLiR7dGhpcy50eXBlLnRvTG93ZXJDYXNlKCl9KClgO1xuICB9XG4gIGlzU3ViU2V0T2YgKCkge1xuICAgIC8vIEJ5IGRlZmF1bHQgKHdpdGhvdXQgYW55IGFyZ3VtZW50cyksIHRva2VucyBvZiB0aGUgc2FtZSBjbGFzcyBhcmUgc3Vic2V0c1xuICAgIC8vIG9mIGVhY2ggb3RoZXJcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlUGFyZW50IChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IHBhcmVudFRva2VuID0gYW5jZXN0b3JUb2tlbnNbYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IGFuY2VzdG9yVG9rZW5zLnNsaWNlKDAsIGFuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDEpO1xuICAgIGxldCB5aWVsZGVkU29tZXRoaW5nID0gZmFsc2U7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRva2VuLml0ZXJhdGUodGVtcCkpIHtcbiAgICAgIHlpZWxkZWRTb21ldGhpbmcgPSB0cnVlO1xuICAgICAgeWllbGQgd3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgaWYgKCF5aWVsZGVkU29tZXRoaW5nICYmIHRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFRva2VuIHlpZWxkZWQgbm8gcmVzdWx0czogJHtwYXJlbnRUb2tlbn1gKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCByYXdJdGVtIH0pIHtcbiAgICAvLyBJbmRleGVkVG9rZW4gb3ZlcnJpZGVzIHdpdGggYW4gYXN5bmMgZnVuY3Rpb25cbiAgICByZXR1cm4gdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgdG9rZW46IHRoaXMsXG4gICAgICByYXdJdGVtXG4gICAgfSk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlVG9rZW4sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRva2VuLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQmFzZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEVtcHR5VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIC8vIHlpZWxkIG5vdGhpbmdcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGBlbXB0eWA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEVtcHR5VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudDogbnVsbCxcbiAgICAgIHJhd0l0ZW06IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0gPSB7fSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKGtleXMgfHwgcmFuZ2VzKSB7XG4gICAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgICAgdGhpcy5yYW5nZXMgPSByYW5nZXM7XG4gICAgfSBlbHNlIGlmICgoYXJnTGlzdCAmJiBhcmdMaXN0Lmxlbmd0aCA9PT0gMSAmJiBhcmdMaXN0WzBdID09PSB1bmRlZmluZWQpIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgZGlmZmVyZW5jZSAob3RoZXJUb2tlbikge1xuICAgIC8vIENvbXB1dGUgd2hhdCBpcyBsZWZ0IG9mIHRoaXMgYWZ0ZXIgc3VidHJhY3Rpbmcgb3V0IGV2ZXJ5dGhpbmcgaW4gb3RoZXJUb2tlblxuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNvbXB1dGUgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIGRpZmZlcmVudCB0b2tlbiB0eXBlc2ApO1xuICAgIH0gZWxzZSBpZiAob3RoZXJUb2tlbi5tYXRjaEFsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEluYWNjdXJhdGUgZGlmZmVyZW5jZSBjb21wdXRlZCEgVE9ETzogbmVlZCB0byBmaWd1cmUgb3V0IGhvdyB0byBpbnZlcnQgY2F0ZWdvcmljYWwga2V5cyFgKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdLZXlzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgaW4gKHRoaXMua2V5cyB8fCB7fSkpIHtcbiAgICAgICAgaWYgKCFvdGhlclRva2VuLmtleXMgfHwgIW90aGVyVG9rZW4ua2V5c1trZXldKSB7XG4gICAgICAgICAgbmV3S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1JhbmdlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICAgIGlmIChvdGhlclRva2VuLnJhbmdlcykge1xuICAgICAgICAgIGxldCBhbGxQb2ludHMgPSB0aGlzLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgYWxsUG9pbnRzID0gYWxsUG9pbnRzLmNvbmNhdChvdGhlclRva2VuLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSkpLnNvcnQoKTtcbiAgICAgICAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbFBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IHsgbG93OiBhbGxQb2ludHNbaV0udmFsdWUgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5leGNsdWRlKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0ubG93IC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5sb3cgPSBhbGxQb2ludHNbaV0uaGlnaCArIDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3UmFuZ2VzID0gdGhpcy5yYW5nZXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgS2V5c1Rva2VuKHRoaXMubXVyZSwgbnVsbCwgeyBrZXlzOiBuZXdLZXlzLCByYW5nZXM6IG5ld1JhbmdlcyB9KTtcbiAgICB9XG4gIH1cbiAgaXNTdWJTZXRPZiAoYXJnTGlzdCkge1xuICAgIGNvbnN0IG90aGVyVG9rZW4gPSBuZXcgS2V5c1Rva2VuKHRoaXMuc3RyZWFtLCBhcmdMaXN0KTtcbiAgICBjb25zdCBkaWZmID0gb3RoZXJUb2tlbi5kaWZmZXJlbmNlKHRoaXMpO1xuICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7IHJldHVybiAnLmtleXMoKSc7IH1cbiAgICByZXR1cm4gJy5rZXlzKCcgKyAodGhpcy5yYW5nZXMgfHwgW10pLm1hcCgoe2xvdywgaGlnaH0pID0+IHtcbiAgICAgIHJldHVybiBsb3cgPT09IGhpZ2ggPyBsb3cgOiBgJHtsb3d9LSR7aGlnaH1gO1xuICAgIH0pLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmtleXMgfHwge30pLm1hcChrZXkgPT4gYCcke2tleX0nYCkpXG4gICAgICAuam9pbignLCcpICsgJyknO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEtleXNUb2tlbiBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxldCB7bG93LCBoaWdofSBvZiB0aGlzLnJhbmdlcyB8fCBbXSkge1xuICAgICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgICAgaGlnaCA9IE1hdGgubWluKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5sZW5ndGggLSAxLCBoaWdoKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gbG93OyBpIDw9IGhpZ2g7IGkrKykge1xuICAgICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgICByYXdJdGVtOiBpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gdGhpcy5rZXlzIHx8IHt9KSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgS2V5c1Rva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFZhbHVlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgY29uc3Qga2V5ID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAoa2V5VHlwZSAhPT0gJ3N0cmluZycgJiYga2V5VHlwZSAhPT0gJ251bWJlcicpKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICByYXdJdGVtOiBvYmpba2V5XVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBWYWx1ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEV2YWx1YXRlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGlmICh0eXBlb2Ygd3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBFdmFsdWF0ZVRva2VuIGlzIG5vdCBhIHN0cmluZ2ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3U3RyZWFtO1xuICAgICAgdHJ5IHtcbiAgICAgICAgbmV3U3RyZWFtID0gdGhpcy5zdHJlYW0uZm9yayh3cmFwcGVkUGFyZW50LnJhd0l0ZW0pO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1ZyB8fCAhKGVyciBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSkge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgeWllbGQgKiBhd2FpdCBuZXdTdHJlYW0uaXRlcmF0ZSgpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXZhbHVhdGVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBNYXBUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tnZW5lcmF0b3JdKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7Z2VuZXJhdG9yfWApO1xuICAgIH1cbiAgICB0aGlzLmdlbmVyYXRvciA9IGdlbmVyYXRvcjtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAubWFwKCR7dGhpcy5nZW5lcmF0b3J9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICByZXR1cm4gZ2VuZXJhdG9yID09PSB0aGlzLmdlbmVyYXRvcjtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmdlbmVyYXRvcl0od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1hcFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEluZGV4ZWRUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgcmF3SXRlbSwgaGFzaGVzID0ge30gfSkge1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gYXdhaXQgc3VwZXIud3JhcCh7IHdyYXBwZWRQYXJlbnQsIHJhd0l0ZW0gfSk7XG4gICAgZm9yIChjb25zdCBbIGhhc2hGdW5jTmFtZSwgaGFzaCBdIG9mIE9iamVjdC5lbnRyaWVzKGhhc2hlcykpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgoaGFzaEZ1bmNOYW1lLCB0aGlzKTtcbiAgICAgIGF3YWl0IGluZGV4LmFkZFZhbHVlKGhhc2gsIHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbmRleGVkVG9rZW47XG4iLCJpbXBvcnQgSW5kZXhlZFRva2VuIGZyb20gJy4vSW5kZXhlZFRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgSW5kZXhlZFRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgbWFwLCBoYXNoLCByZWR1Y2VJbnN0YW5jZXMgXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLnByb21vdGUoJHt0aGlzLm1hcH0sICR7dGhpcy5oYXNofSwgJHt0aGlzLnJlZHVjZUluc3RhbmNlc30pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwID09PSBtYXAgJiZcbiAgICAgIHRoaXMuaGFzaCA9PT0gaGFzaCAmJlxuICAgICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPT09IHJlZHVjZUluc3RhbmNlcztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG1hcEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5tYXBdO1xuICAgICAgY29uc3QgaGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5oYXNoXTtcbiAgICAgIGNvbnN0IHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5yZWR1Y2VJbnN0YW5jZXNdO1xuICAgICAgY29uc3QgaGFzaEluZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy5oYXNoLCB0aGlzKTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiBtYXBGdW5jdGlvbih3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICBjb25zdCBoYXNoID0gaGFzaEZ1bmN0aW9uKG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICBsZXQgb3JpZ2luYWxXcmFwcGVkSXRlbSA9IChhd2FpdCBoYXNoSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpKVswXTtcbiAgICAgICAgaWYgKG9yaWdpbmFsV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWR1Y2VJbnN0YW5jZXMgIT09ICdub29wJykge1xuICAgICAgICAgICAgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24ob3JpZ2luYWxXcmFwcGVkSXRlbSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBoYXNoZXMgPSB7fTtcbiAgICAgICAgICBoYXNoZXNbdGhpcy5oYXNoXSA9IGhhc2g7XG4gICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtLFxuICAgICAgICAgICAgaGFzaGVzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZVRva2VuO1xuIiwiaW1wb3J0IEluZGV4ZWRUb2tlbiBmcm9tICcuL0luZGV4ZWRUb2tlbi5qcyc7XG5cbmNsYXNzIEpvaW5Ub2tlbiBleHRlbmRzIEluZGV4ZWRUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnZGVmYXVsdEZpbmlzaCcsIGVkZ2VSb2xlID0gJ25vbmUnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIHRoaXNIYXNoLCBmaW5pc2ggXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgdGVtcCA9IHN0cmVhbS5uYW1lZFN0cmVhbXNbb3RoZXJTdHJlYW1dO1xuICAgIGlmICghdGVtcCkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIHN0cmVhbTogJHtvdGhlclN0cmVhbX1gKTtcbiAgICB9XG4gICAgLy8gUmVxdWlyZSBvdGhlckhhc2ggb24gdGhlIG90aGVyIHN0cmVhbSwgb3IgY29weSBvdXJzIG92ZXIgaWYgaXQgaXNuJ3RcbiAgICAvLyBhbHJlYWR5IGRlZmluZWRcbiAgICBpZiAoIXRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gaGFzaCBmdW5jdGlvbiBvbiBlaXRoZXIgc3RyZWFtOiAke290aGVySGFzaH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSA9IHN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMub3RoZXJTdHJlYW0gPSBvdGhlclN0cmVhbTtcbiAgICB0aGlzLnRoaXNIYXNoID0gdGhpc0hhc2g7XG4gICAgdGhpcy5vdGhlckhhc2ggPSBvdGhlckhhc2g7XG4gICAgdGhpcy5maW5pc2ggPSBmaW5pc2g7XG4gICAgdGhpcy5lZGdlUm9sZSA9IGVkZ2VSb2xlO1xuICAgIHRoaXMuaGFzaFRoaXNHcmFuZHBhcmVudCA9IGVkZ2VSb2xlID09PSAnZnVsbCc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLmpvaW4oJHt0aGlzLm90aGVyU3RyZWFtfSwgJHt0aGlzLnRoaXNIYXNofSwgJHt0aGlzLm90aGVySGFzaH0sICR7dGhpcy5maW5pc2h9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBvdGhlclN0cmVhbSwgdGhpc0hhc2ggPSAna2V5Jywgb3RoZXJIYXNoID0gJ2tleScsIGZpbmlzaCA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiB0aGlzLm90aGVyU3RyZWFtID09PSBvdGhlclN0cmVhbSAmJlxuICAgICAgdGhpcy50aGlzSGFzaCA9PT0gdGhpc0hhc2ggJiZcbiAgICAgIHRoaXMub3RoZXJIYXNoID09PSBvdGhlckhhc2ggJiZcbiAgICAgIHRoaXMuZmluaXNoID09PSBmaW5pc2g7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IG90aGVyU3RyZWFtID0gdGhpcy5zdHJlYW0ubmFtZWRTdHJlYW1zW3RoaXMub3RoZXJTdHJlYW1dO1xuICAgIGNvbnN0IHRoaXNIYXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLnRoaXNIYXNoXTtcbiAgICBjb25zdCBvdGhlckhhc2hGdW5jdGlvbiA9IG90aGVyU3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMub3RoZXJIYXNoXTtcbiAgICBjb25zdCBmaW5pc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZmluaXNoXTtcblxuICAgIGNvbnN0IHRoaXNJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMudGhpc0hhc2gsIHRoaXMpO1xuICAgIGNvbnN0IG90aGVySW5kZXggPSBvdGhlclN0cmVhbS5nZXRJbmRleCh0aGlzLm90aGVySGFzaCwgdGhpcyk7XG5cbiAgICBpZiAodGhpc0luZGV4LmNvbXBsZXRlKSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBCZXN0IG9mIGFsbCB3b3JsZHM7IHdlIGNhbiBqdXN0IGpvaW4gdGhlIGluZGV4ZXNcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IGhhc2gsIHZhbHVlTGlzdCB9IG9mIHRoaXNJbmRleC5pdGVyRW50cmllcygpKSB7XG4gICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdmFsdWVMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIHRoZSBvdGhlciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIG91ciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJTdHJlYW0uaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIG90aGVySGFzaEZ1bmN0aW9uKG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBBZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4OlxuICAgICAgICAgICAgYXdhaXQgb3RoZXJJbmRleC5hZGRWYWx1ZShoYXNoLCBvdGhlcldyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgb3VyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2YgdGhlIG90aGVyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgICAgICAvLyBPZGQgY29ybmVyIGNhc2UgZm9yIGVkZ2VzOyBzb21ldGltZXMgd2Ugd2FudCB0byBoYXNoIHRoZSBncmFuZHBhcmVudCBpbnN0ZWFkIG9mIHRoZSByZXN1bHQgb2ZcbiAgICAgICAgICAvLyBhbiBpbnRlcm1lZGlhdGUgam9pbjpcbiAgICAgICAgICBjb25zdCB0aGlzSGFzaEl0ZW0gPSB0aGlzLmhhc2hUaGlzR3JhbmRwYXJlbnQgPyB0aGlzV3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCA6IHRoaXNXcmFwcGVkSXRlbTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzSGFzaEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgYXdhaXQgdGhpc0luZGV4LmFkZFZhbHVlKGhhc2gsIHRoaXNIYXNoSXRlbSk7XG4gICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWl0aGVyIHN0cmVhbSBpcyBmdWxseSBpbmRleGVkOyBmb3IgbW9yZSBkaXN0cmlidXRlZCBzYW1wbGluZywgZ3JhYlxuICAgICAgICAvLyBvbmUgaXRlbSBmcm9tIGVhY2ggc3RyZWFtIGF0IGEgdGltZSwgYW5kIHVzZSB0aGUgcGFydGlhbCBpbmRleGVzXG4gICAgICAgIGNvbnN0IHRoaXNJdGVyYXRvciA9IHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucywgdGhpcy50aGlzSW5kaXJlY3RLZXkpO1xuICAgICAgICBsZXQgdGhpc0lzRG9uZSA9IGZhbHNlO1xuICAgICAgICBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuICAgICAgICBsZXQgb3RoZXJJc0RvbmUgPSBmYWxzZTtcblxuICAgICAgICB3aGlsZSAoIXRoaXNJc0RvbmUgfHwgIW90aGVySXNEb25lKSB7XG4gICAgICAgICAgLy8gVGFrZSBvbmUgc2FtcGxlIGZyb20gdGhpcyBzdHJlYW1cbiAgICAgICAgICBsZXQgdGVtcCA9IGF3YWl0IHRoaXNJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgdGhpc0lzRG9uZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICAvLyBPZGQgY29ybmVyIGNhc2UgZm9yIGVkZ2VzOyBzb21ldGltZXMgd2Ugd2FudCB0byBoYXNoIHRoZSBncmFuZHBhcmVudCBpbnN0ZWFkIG9mIHRoZSByZXN1bHQgb2ZcbiAgICAgICAgICAgIC8vIGFuIGludGVybWVkaWF0ZSBqb2luOlxuICAgICAgICAgICAgY29uc3QgdGhpc0hhc2hJdGVtID0gdGhpcy5oYXNoVGhpc0dyYW5kcGFyZW50ID8gdGhpc1dyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgOiB0aGlzV3JhcHBlZEl0ZW07XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzSGFzaEl0ZW0pKSB7XG4gICAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICAgIHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzSGFzaEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE5vdyBmb3IgYSBzYW1wbGUgZnJvbSB0aGUgb3RoZXIgc3RyZWFtXG4gICAgICAgICAgdGVtcCA9IGF3YWl0IG90aGVySXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIG90aGVySXNEb25lID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgLy8gYWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleFxuICAgICAgICAgICAgICBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEpvaW5Ub2tlbjtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuLi9TdHJlYW0uanMnO1xuXG5jb25zdCBBU1RFUklTS1MgPSB7XG4gICdldmFsdWF0ZSc6ICfihqwnLFxuICAnam9pbic6ICfiqK8nLFxuICAnbWFwJzogJ+KGpicsXG4gICdwcm9tb3RlJzogJ+KGkScsXG4gICd2YWx1ZSc6ICfihpInXG59O1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm11cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMuX3NlbGVjdG9yID0gb3B0aW9ucy5zZWxlY3RvcjtcbiAgICB0aGlzLmN1c3RvbUNsYXNzTmFtZSA9IG9wdGlvbnMuY3VzdG9tQ2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9IG9wdGlvbnMuY3VzdG9tTmFtZVRva2VuSW5kZXggfHwgbnVsbDtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sXG4gICAgICB0aGlzLm11cmUuTkFNRURfRlVOQ1RJT05TLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBmb3IgKGxldCBbZnVuY05hbWUsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubmFtZWRGdW5jdGlvbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtmdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc2VsZWN0b3I7XG4gIH1cbiAgZ2V0IHRva2VuQ2xhc3NMaXN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3IodGhpcy5zZWxlY3Rvcik7XG4gIH1cbiAgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzVHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgc2VsZWN0b3I6IHRoaXMuX3NlbGVjdG9yLFxuICAgICAgY3VzdG9tQ2xhc3NOYW1lOiB0aGlzLmN1c3RvbUNsYXNzTmFtZSxcbiAgICAgIGN1c3RvbU5hbWVUb2tlbkluZGV4OiB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4LFxuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgbmFtZWRGdW5jdGlvbnM6IHt9XG4gICAgfTtcbiAgICBmb3IgKGxldCBbZnVuY05hbWUsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubmFtZWRGdW5jdGlvbnMpKSB7XG4gICAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgICAgLy8gSXN0YW5idWwgYWRkcyBzb21lIGNvZGUgdG8gZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgY292ZXJhZ2UsIHRoYXQgZ2V0c1xuICAgICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICAgIHN0cmluZ2lmaWVkRnVuYyA9IHN0cmluZ2lmaWVkRnVuYy5yZXBsYWNlKC9jb3ZfKC4rPylcXCtcXCtbLDtdPy9nLCAnJyk7XG4gICAgICByZXN1bHQubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gc3RyaW5naWZpZWRGdW5jO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICBpZiAodGhpcy5jdXN0b21DbGFzc05hbWUgIT09IHZhbHVlKSB7XG4gICAgICB0aGlzLmN1c3RvbUNsYXNzTmFtZSA9IHZhbHVlO1xuICAgICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9IHRoaXMuc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpLmxlbmd0aDtcbiAgICAgIHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIH1cbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSBudWxsICYmXG4gICAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID09PSB0aGlzLnNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKS5sZW5ndGg7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgY29uc3Qgc2VsZWN0b3IgPSB0aGlzLnNlbGVjdG9yO1xuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IHRva2VuU3RyaW5ncy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSBudWxsICYmIGkgPD0gdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXN0b21DbGFzc05hbWUgKyByZXN1bHQ7XG4gICAgICB9XG4gICAgICBjb25zdCB0ZW1wID0gdG9rZW5TdHJpbmdzW2ldLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAodGVtcFsxXSA9PT0gJ2tleXMnIHx8IHRlbXBbMV0gPT09ICd2YWx1ZXMnKSB7XG4gICAgICAgIGlmICh0ZW1wWzJdID09PSAnJykge1xuICAgICAgICAgIHJlc3VsdCA9ICcqJyArIHJlc3VsdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQgPSB0ZW1wWzJdLnJlcGxhY2UoLycoW14nXSopJy8sICckMScpICsgcmVzdWx0O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSBBU1RFUklTS1NbdGVtcFsxXV0gKyByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAoc2VsZWN0b3Iuc3RhcnRzV2l0aCgnZW1wdHknKSA/ICfiiIUnIDogJycpICsgcmVzdWx0O1xuICB9XG4gIGFkZEhhc2hGdW5jdGlvbiAoZnVuY05hbWUsIGZ1bmMpIHtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IGZ1bmM7XG4gIH1cbiAgcG9wdWxhdGVTdHJlYW1PcHRpb25zIChvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMudG9rZW5DbGFzc0xpc3Q7XG4gICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IHRoaXMubmFtZWRGdW5jdGlvbnM7XG4gICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cbiAgZ2V0U3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbSh0aGlzLnBvcHVsYXRlU3RyZWFtT3B0aW9ucyhvcHRpb25zKSk7XG4gIH1cbiAgaXNTdXBlclNldE9mVG9rZW5MaXN0ICh0b2tlbkxpc3QpIHtcbiAgICBpZiAodG9rZW5MaXN0Lmxlbmd0aCAhPT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5ldmVyeSgodG9rZW4sIGkpID0+IHRva2VuLmlzU3VwZXJTZXRPZih0b2tlbkxpc3RbaV0pKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdID0gbmV3IHRoaXMubXVyZS5DTEFTU0VTLk5vZGVDbGFzcyhvcHRpb25zKTtcbiAgICB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdID0gbmV3IHRoaXMubXVyZS5DTEFTU0VTLkVkZ2VDbGFzcyhvcHRpb25zKTtcbiAgICB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgfVxuICBhZ2dyZWdhdGUgKGhhc2gsIHJlZHVjZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGV4cGFuZCAobWFwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgZmlsdGVyIChmaWx0ZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBzcGxpdCAoaGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICAgIHRoaXMuZWRnZUNvbm5lY3Rpb25zID0gb3B0aW9ucy5lZGdlQ29ubmVjdGlvbnMgfHwge307XG4gIH1cbiAgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLnRvUmF3T2JqZWN0KCk7XG4gICAgLy8gVE9ETzogbmVlZCB0byBkZWVwIGNvcHkgZWRnZUNvbm5lY3Rpb25zP1xuICAgIHJlc3VsdC5lZGdlQ29ubmVjdGlvbnMgPSB0aGlzLmVkZ2VDb25uZWN0aW9ucztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgZGlyZWN0ZWQsIHRoaXNIYXNoTmFtZSwgb3RoZXJIYXNoTmFtZSB9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5tdXJlLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBudWxsLFxuICAgICAgQ2xhc3NUeXBlOiB0aGlzLm11cmUuQ0xBU1NFUy5FZGdlQ2xhc3MsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgZGlyZWN0ZWRcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDb25uZWN0aW9uc1tlZGdlQ2xhc3MuY2xhc3NJZF0gPSB7IG5vZGVIYXNoTmFtZTogdGhpc0hhc2hOYW1lIH07XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW2VkZ2VDbGFzcy5jbGFzc0lkXSA9IHsgbm9kZUhhc2hOYW1lOiBvdGhlckhhc2hOYW1lIH07XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDb25uZWN0aW9ucykpIHtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcblxuICAgIGlmICghdGhpcy5fc2VsZWN0b3IpIHtcbiAgICAgIGlmICghc291cmNlQ2xhc3MgfHwgIXRhcmdldENsYXNzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFydGlhbCBjb25uZWN0aW9ucyB3aXRob3V0IGFuIGVkZ2UgdGFibGUgc2hvdWxkIG5ldmVyIGhhcHBlbmApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm8gZWRnZSB0YWJsZSAoc2ltcGxlIGpvaW4gYmV0d2VlbiB0d28gbm9kZXMpXG4gICAgICAgIGNvbnN0IHNvdXJjZUhhc2ggPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXS5ub2RlSGFzaE5hbWU7XG4gICAgICAgIGNvbnN0IHRhcmdldEhhc2ggPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXS5ub2RlSGFzaE5hbWU7XG4gICAgICAgIHJldHVybiBzb3VyY2VDbGFzcy5zZWxlY3RvciArIGAuam9pbih0YXJnZXQsICR7c291cmNlSGFzaH0sICR7dGFyZ2V0SGFzaH0sIGRlZmF1bHRGaW5pc2gsIHNvdXJjZVRhcmdldClgO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgcmVzdWx0ID0gdGhpcy5fc2VsZWN0b3I7XG4gICAgICBpZiAoIXNvdXJjZUNsYXNzKSB7XG4gICAgICAgIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgICAvLyBObyBjb25uZWN0aW9ucyB5ZXQ7IGp1c3QgeWllbGQgdGhlIHJhdyBlZGdlIHRhYmxlXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBQYXJ0aWFsIGVkZ2UtdGFyZ2V0IGNvbm5lY3Rpb25zXG4gICAgICAgICAgY29uc3QgeyBlZGdlSGFzaE5hbWUsIG5vZGVIYXNoTmFtZSB9ID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdCArIGAuam9pbih0YXJnZXQsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoLCBlZGdlVGFyZ2V0KWA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIXRhcmdldENsYXNzKSB7XG4gICAgICAgIC8vIFBhcnRpYWwgc291cmNlLWVkZ2UgY29ubmVjdGlvbnNcbiAgICAgICAgY29uc3QgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJldHVybiByZXN1bHQgKyBgLmpvaW4oc291cmNlLCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaCwgc291cmNlRWRnZSlgO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRnVsbCBjb25uZWN0aW9uc1xuICAgICAgICBsZXQgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJlc3VsdCArPSBgLmpvaW4oc291cmNlLCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgICAoeyBlZGdlSGFzaE5hbWUsIG5vZGVIYXNoTmFtZSB9ID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0pO1xuICAgICAgICByZXN1bHQgKz0gYC5qb2luKHRhcmdldCwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gsIGZ1bGwpYDtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcG9wdWxhdGVTdHJlYW1PcHRpb25zIChvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zID0ge307XG4gICAgaWYgKCF0aGlzLl9zZWxlY3Rvcikge1xuICAgICAgLy8gVXNlIHRoZSBvcHRpb25zIGZyb20gdGhlIHNvdXJjZSBzdHJlYW0gaW5zdGVhZCBvZiBvdXIgY2xhc3NcbiAgICAgIG9wdGlvbnMgPSBzb3VyY2VDbGFzcy5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy50YXJnZXQgPSB0YXJnZXRDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IHN1cGVyLnBvcHVsYXRlU3RyZWFtT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgIGlmIChzb3VyY2VDbGFzcykge1xuICAgICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy5zb3VyY2UgPSBzb3VyY2VDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICAgIH1cbiAgICAgIGlmICh0YXJnZXRDbGFzcykge1xuICAgICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy50YXJnZXQgPSB0YXJnZXRDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cbiAgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLnRvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSkge1xuICAgIGlmIChkaXJlY3Rpb24gPT09ICdzb3VyY2UnKSB7XG4gICAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICd0YXJnZXQnKSB7XG4gICAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb3VyY2UgYW5kIHRhcmdldCBhcmUgYWxyZWFkeSBkZWZpbmVkOyBwbGVhc2Ugc3BlY2lmeSBhIGRpcmVjdGlvbiB0byBvdmVycmlkZWApO1xuICAgICAgfVxuICAgIH1cbiAgICBub2RlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0gPSB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH07XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgdG9nZ2xlTm9kZURpcmVjdGlvbiAoc291cmNlQ2xhc3NJZCkge1xuICAgIGlmICghc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3Qgc3dhcCB0byB1bmNvbm5lY3RlZCBjbGFzcyBpZDogJHtzb3VyY2VDbGFzc0lkfWApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gc291cmNlQ2xhc3NJZDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy53cmFwcGVkUGFyZW50ID0gd3JhcHBlZFBhcmVudDtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5yYXdJdGVtID0gcmF3SXRlbTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gICAgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnc291cmNlVGFyZ2V0Jykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBzb3VyY2U6IHRoaXMucmF3SXRlbS5sZWZ0LFxuICAgICAgICB0YXJnZXQ6IHRoaXMucmF3SXRlbS5yaWdodFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnZWRnZVRhcmdldCcpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgZWRnZTogdGhpcy5yYXdJdGVtLmxlZnQsXG4gICAgICAgIHRhcmdldDogdGhpcy5yYXdJdGVtLnJpZ2h0XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdzb3VyY2VFZGdlJykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBzb3VyY2U6IHRoaXMucmF3SXRlbS5yaWdodCxcbiAgICAgICAgZWRnZTogdGhpcy5yYXdJdGVtLmxlZnRcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ2Z1bGwnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIHNvdXJjZTogdGhpcy5yYXdJdGVtLmxlZnQucmlnaHQsXG4gICAgICAgIGVkZ2U6IHRoaXMucmF3SXRlbS5sZWZ0LmxlZnQsXG4gICAgICAgIHRhcmdldDogdGhpcy5yYXdJdGVtLnJpZ2h0XG4gICAgICB9O1xuICAgIH1cbiAgICAvLyBpZiB0aGVyZSBpcyBubyBlZGdlUm9sZSwgbGVhdmUgdGhlIHJhd0l0ZW0gYXMtaXNcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuL1N0cmVhbS5qcyc7XG5pbXBvcnQgKiBhcyBUT0tFTlMgZnJvbSAnLi9Ub2tlbnMvVG9rZW5zLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5pbXBvcnQgKiBhcyBJTkRFWEVTIGZyb20gJy4vSW5kZXhlcy9JbmRleGVzLmpzJztcblxubGV0IE5FWFRfQ0xBU1NfSUQgPSAxO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoRmlsZVJlYWRlciwgbG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBlaXRoZXIgd2luZG93LmxvY2FsU3RvcmFnZSBvciBudWxsXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVE9LRU5TID0gVE9LRU5TO1xuICAgIHRoaXMuQ0xBU1NFUyA9IENMQVNTRVM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuICAgIHRoaXMuSU5ERVhFUyA9IElOREVYRVM7XG5cbiAgICAvLyBNb25rZXktcGF0Y2ggYXZhaWxhYmxlIHRva2VucyBhcyBmdW5jdGlvbnMgb250byB0aGUgU3RyZWFtIGNsYXNzXG4gICAgZm9yIChjb25zdCB0b2tlbkNsYXNzTmFtZSBpbiB0aGlzLlRPS0VOUykge1xuICAgICAgY29uc3QgVG9rZW5DbGFzcyA9IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXTtcbiAgICAgIFN0cmVhbS5wcm90b3R5cGVbVG9rZW5DbGFzcy5sb3dlckNhbWVsQ2FzZVR5cGVdID0gZnVuY3Rpb24gKGFyZ0xpc3QsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXh0ZW5kKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7IHlpZWxkIHdyYXBwZWRJdGVtLnJhd0l0ZW07IH0sXG4gICAgICBrZXk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7XG4gICAgICAgIGlmICghd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEdyYW5kcGFyZW50IGlzIG5vdCBhbiBvYmplY3QgLyBhcnJheWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICBpZiAoIShwYXJlbnRUeXBlID09PSAnbnVtYmVyJyB8fCBwYXJlbnRUeXBlID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXNuJ3QgYSBrZXkgLyBpbmRleGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRGaW5pc2g6IGZ1bmN0aW9uICogKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgbGVmdDogdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0sXG4gICAgICAgICAgcmlnaHQ6IG90aGVyV3JhcHBlZEl0ZW0ucmF3SXRlbVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnJvb3QgPSB0aGlzLmxvYWRSb290KCk7XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBvdXIgY2xhc3Mgc3BlY2lmaWNhdGlvbnNcbiAgICB0aGlzLmNsYXNzZXMgPSB0aGlzLmxvYWRDbGFzc2VzKCk7XG4gIH1cblxuICBsb2FkUm9vdCAoKSB7XG4gICAgbGV0IHJvb3QgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX3Jvb3QnKTtcbiAgICByb290ID0gcm9vdCA/IEpTT04ucGFyc2Uocm9vdCkgOiB7fTtcbiAgICByZXR1cm4gcm9vdDtcbiAgfVxuICBzYXZlUm9vdCAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX3Jvb3QnLCBKU09OLnN0cmluZ2lmeSh0aGlzLnJvb3QpKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyb290VXBkYXRlJyk7XG4gIH1cbiAgbG9hZENsYXNzZXMgKCkge1xuICAgIGxldCBjbGFzc2VzID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbXVyZV9jbGFzc2VzJyk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMgPyBKU09OLnBhcnNlKGNsYXNzZXMpIDoge307XG4gICAgT2JqZWN0LmVudHJpZXMoY2xhc3NlcykuZm9yRWFjaCgoWyBjbGFzc0lkLCByYXdDbGFzc09iaiBdKSA9PiB7XG4gICAgICBjb25zdCBjbGFzc1R5cGUgPSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICBkZWxldGUgcmF3Q2xhc3NPYmouY2xhc3NUeXBlO1xuICAgICAgcmF3Q2xhc3NPYmoubXVyZSA9IHRoaXM7XG4gICAgICBjbGFzc2VzW2NsYXNzSWRdID0gbmV3IHRoaXMuQ0xBU1NFU1tjbGFzc1R5cGVdKHJhd0NsYXNzT2JqKTtcbiAgICB9KTtcbiAgICByZXR1cm4gY2xhc3NlcztcbiAgfVxuICBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCByYXdDbGFzc2VzID0ge307XG4gICAgICBmb3IgKGNvbnN0IFsgY2xhc3NJZCwgY2xhc3NPYmogXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICAgIHJhd0NsYXNzZXNbY2xhc3NJZF0gPSBjbGFzc09iai50b1Jhd09iamVjdCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbXVyZV9jbGFzc2VzJywgSlNPTi5zdHJpbmdpZnkocmF3Q2xhc3NlcykpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ2NsYXNzVXBkYXRlJyk7XG4gIH1cblxuICBwYXJzZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZykge1xuICAgIGNvbnN0IHN0YXJ0c1dpdGhSb290ID0gc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgncm9vdCcpO1xuICAgIGlmICghKHN0YXJ0c1dpdGhSb290IHx8IHNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ2VtcHR5JykpKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFNlbGVjdG9ycyBtdXN0IHN0YXJ0IHdpdGggJ3Jvb3QnIG9yICdlbXB0eSdgKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5TdHJpbmdzID0gc2VsZWN0b3JTdHJpbmcubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpO1xuICAgIGlmICghdG9rZW5TdHJpbmdzKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgc2VsZWN0b3Igc3RyaW5nOiAke3NlbGVjdG9yU3RyaW5nfWApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlbkNsYXNzTGlzdCA9IFt7XG4gICAgICBUb2tlbkNsYXNzOiBzdGFydHNXaXRoUm9vdCA/IHRoaXMuVE9LRU5TLlJvb3RUb2tlbiA6IHRoaXMuVE9LRU5TLkVtcHR5VG9rZW5cbiAgICB9XTtcbiAgICB0b2tlblN0cmluZ3MuZm9yRWFjaChjaHVuayA9PiB7XG4gICAgICBjb25zdCB0ZW1wID0gY2h1bmsubWF0Y2goL14uKFteKF0qKVxcKChbXildKilcXCkvKTtcbiAgICAgIGlmICghdGVtcCkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgdG9rZW46ICR7Y2h1bmt9YCk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b2tlbkNsYXNzTmFtZSA9IHRlbXBbMV1bMF0udG9VcHBlckNhc2UoKSArIHRlbXBbMV0uc2xpY2UoMSkgKyAnVG9rZW4nO1xuICAgICAgY29uc3QgYXJnTGlzdCA9IHRlbXBbMl0uc3BsaXQoLyg/PCFcXFxcKSwvKS5tYXAoZCA9PiB7XG4gICAgICAgIGQgPSBkLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIGQgPT09ICcnID8gdW5kZWZpbmVkIDogZDtcbiAgICAgIH0pO1xuICAgICAgaWYgKHRva2VuQ2xhc3NOYW1lID09PSAnVmFsdWVzVG9rZW4nKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLktleXNUb2tlbixcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5WYWx1ZVRva2VuXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0pIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gdG9rZW46ICR7dGVtcFsxXX1gKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdG9rZW5DbGFzc0xpc3Q7XG4gIH1cblxuICBzdHJlYW0gKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnBhcnNlU2VsZWN0b3Iob3B0aW9ucy5zZWxlY3RvciB8fCBgcm9vdC52YWx1ZXMoKWApO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG5cbiAgbmV3Q2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgcm9vdGAgfSkge1xuICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7TkVYVF9DTEFTU19JRH1gO1xuICAgIE5FWFRfQ0xBU1NfSUQgKz0gMTtcbiAgICBjb25zdCBDbGFzc1R5cGUgPSBvcHRpb25zLkNsYXNzVHlwZSB8fCB0aGlzLkNMQVNTRVMuR2VuZXJpY0NsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLkNsYXNzVHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IENsYXNzVHlwZShvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHk7IHRyeSBhZGREeW5hbWljRGF0YVNvdXJjZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSh7XG4gICAgICBrZXk6IGZpbGVPYmoubmFtZSxcbiAgICAgIGV4dGVuc2lvbjogZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24oZmlsZU9iai50eXBlKSxcbiAgICAgIHRleHRcbiAgICB9KTtcbiAgfVxuICBhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBrZXksXG4gICAgZXh0ZW5zaW9uID0gJ3R4dCcsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgbGV0IG9iajtcbiAgICBpZiAodGhpcy5EQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgb2JqID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBkZWxldGUgb2JqLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljRGF0YVNvdXJjZShrZXksIG9iaik7XG4gIH1cbiAgYWRkU3RhdGljRGF0YVNvdXJjZSAoa2V5LCBvYmopIHtcbiAgICB0aGlzLnJvb3Rba2V5XSA9IG9iajtcbiAgICB0aGlzLnNhdmVSb290KCk7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IGByb290LnZhbHVlcygnJHtrZXl9JykudmFsdWVzKClgXG4gICAgfSk7XG4gIH1cbiAgcmVtb3ZlRGF0YVNvdXJjZSAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMucm9vdFtrZXldO1xuICAgIHRoaXMuc2F2ZVJvb3QoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCBGaWxlUmVhZGVyIGZyb20gJ2ZpbGVyZWFkZXInO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKEZpbGVSZWFkZXIsIG51bGwpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImZvckVhY2giLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJPYmplY3QiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIlN0cmVhbSIsIm9wdGlvbnMiLCJtdXJlIiwibmFtZWRGdW5jdGlvbnMiLCJOQU1FRF9GVU5DVElPTlMiLCJuYW1lZFN0cmVhbXMiLCJsYXVuY2hlZEZyb21DbGFzcyIsInRva2VuQ2xhc3NMaXN0IiwidG9rZW5MaXN0IiwibWFwIiwiVG9rZW5DbGFzcyIsImFyZ0xpc3QiLCJXcmFwcGVycyIsImdldFdyYXBwZXJMaXN0IiwiaW5kZXhlcyIsInRva2VuIiwibGVuZ3RoIiwiV3JhcHBlciIsImxvY2FsVG9rZW5MaXN0Iiwic2xpY2UiLCJwb3RlbnRpYWxXcmFwcGVycyIsInZhbHVlcyIsImNsYXNzZXMiLCJmaWx0ZXIiLCJjbGFzc09iaiIsImNsYXNzVG9rZW5MaXN0IiwiZXZlcnkiLCJsb2NhbFRva2VuIiwibG9jYWxJbmRleCIsInRva2VuQ2xhc3NTcGVjIiwiaXNTdWJzZXRPZiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJjb25zb2xlIiwid2FybiIsInNlbGVjdG9yIiwiam9pbiIsImZvcmsiLCJwYXJzZVNlbGVjdG9yIiwiZXh0ZW5kIiwiY29uY2F0Iiwid3JhcCIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwiaGFzaGVzIiwid3JhcHBlckluZGV4IiwidGVtcCIsIndyYXBwZWRJdGVtIiwiZ2V0SW5kZXgiLCJoYXNoRnVuY3Rpb25OYW1lIiwidG9rZW5JbmRleCIsIklOREVYRVMiLCJJbk1lbW9yeUluZGV4IiwiaXRlcmF0ZSIsImxhc3RUb2tlbiIsInNhbXBsZSIsImxpbWl0IiwicmVidWlsZEluZGV4ZXMiLCJpdGVyYXRvciIsIm5leHQiLCJkb25lIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b1N0cmluZyIsInRvTG93ZXJDYXNlIiwiaXNTdWJTZXRPZiIsImFuY2VzdG9yVG9rZW5zIiwiRXJyb3IiLCJpdGVyYXRlUGFyZW50IiwicGFyZW50VG9rZW4iLCJ5aWVsZGVkU29tZXRoaW5nIiwiZGVidWciLCJUeXBlRXJyb3IiLCJleGVjIiwibmFtZSIsIkVtcHR5VG9rZW4iLCJSb290VG9rZW4iLCJyb290IiwiS2V5c1Rva2VuIiwibWF0Y2hBbGwiLCJrZXlzIiwicmFuZ2VzIiwidW5kZWZpbmVkIiwiYXJnIiwibWF0Y2giLCJJbmZpbml0eSIsImQiLCJwYXJzZUludCIsImlzTmFOIiwibG93IiwiaGlnaCIsIm51bSIsIk51bWJlciIsIlN5bnRheEVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImNvbnNvbGlkYXRlUmFuZ2VzIiwic2VsZWN0c05vdGhpbmciLCJuZXdSYW5nZXMiLCJzb3J0IiwiYSIsImIiLCJjdXJyZW50UmFuZ2UiLCJkaWZmZXJlbmNlIiwib3RoZXJUb2tlbiIsIm5ld0tleXMiLCJrZXkiLCJhbGxQb2ludHMiLCJyZWR1Y2UiLCJhZ2ciLCJyYW5nZSIsImluY2x1ZGUiLCJleGNsdWRlIiwiZGlmZiIsIk1hdGgiLCJtYXgiLCJtaW4iLCJoYXNPd25Qcm9wZXJ0eSIsIlZhbHVlVG9rZW4iLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsIm5ld1N0cmVhbSIsImVyciIsIk1hcFRva2VuIiwiZ2VuZXJhdG9yIiwibWFwcGVkUmF3SXRlbSIsIkluZGV4ZWRUb2tlbiIsImhhc2hGdW5jTmFtZSIsImhhc2giLCJlbnRyaWVzIiwiYWRkVmFsdWUiLCJQcm9tb3RlVG9rZW4iLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwibWFwRnVuY3Rpb24iLCJoYXNoRnVuY3Rpb24iLCJyZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiIsImhhc2hJbmRleCIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJnZXRWYWx1ZUxpc3QiLCJKb2luVG9rZW4iLCJvdGhlclN0cmVhbSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiZmluaXNoIiwiZWRnZVJvbGUiLCJoYXNoVGhpc0dyYW5kcGFyZW50IiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwiY29tcGxldGUiLCJ2YWx1ZUxpc3QiLCJpdGVyRW50cmllcyIsIm90aGVyTGlzdCIsIm90aGVyV3JhcHBlZEl0ZW0iLCJ0aGlzV3JhcHBlZEl0ZW0iLCJ0aGlzTGlzdCIsInRoaXNIYXNoSXRlbSIsInRoaXNJdGVyYXRvciIsInRoaXNJbmRpcmVjdEtleSIsInRoaXNJc0RvbmUiLCJvdGhlckl0ZXJhdG9yIiwib3RoZXJJc0RvbmUiLCJBU1RFUklTS1MiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX3NlbGVjdG9yIiwiY3VzdG9tQ2xhc3NOYW1lIiwiY3VzdG9tTmFtZVRva2VuSW5kZXgiLCJmdW5jTmFtZSIsIkZ1bmN0aW9uIiwidG9SYXdPYmplY3QiLCJyZXN1bHQiLCJjbGFzc1R5cGUiLCJzdHJpbmdpZmllZEZ1bmMiLCJzZXRDbGFzc05hbWUiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJjbGFzc05hbWUiLCJ0b2tlblN0cmluZ3MiLCJzdGFydHNXaXRoIiwiYWRkSGFzaEZ1bmN0aW9uIiwicG9wdWxhdGVTdHJlYW1PcHRpb25zIiwiZ2V0U3RyZWFtIiwiaXNTdXBlclNldE9mVG9rZW5MaXN0IiwiaXNTdXBlclNldE9mIiwiaW50ZXJwcmV0QXNOb2RlcyIsIkNMQVNTRVMiLCJOb2RlQ2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiRWRnZUNsYXNzIiwiYWdncmVnYXRlIiwiZXhwYW5kIiwic3BsaXQiLCJkZWxldGUiLCJOb2RlV3JhcHBlciIsImVkZ2VDb25uZWN0aW9ucyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwiZGlyZWN0ZWQiLCJ0aGlzSGFzaE5hbWUiLCJvdGhlckhhc2hOYW1lIiwiZWRnZUNsYXNzIiwibmV3Q2xhc3MiLCJDbGFzc1R5cGUiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsIm5vZGVIYXNoTmFtZSIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5vZGVDbGFzcyIsImVkZ2VDbGFzc0lkIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwic291cmNlSGFzaCIsInRhcmdldEhhc2giLCJlZGdlSGFzaE5hbWUiLCJ0YXJnZXQiLCJzb3VyY2UiLCJkaXJlY3Rpb24iLCJ0b2dnbGVOb2RlRGlyZWN0aW9uIiwibGVmdCIsInJpZ2h0IiwiZWRnZSIsIml0ZXJIYXNoZXMiLCJpdGVyVmFsdWVMaXN0cyIsIk5FWFRfQ0xBU1NfSUQiLCJNdXJlIiwiRmlsZVJlYWRlciIsImxvY2FsU3RvcmFnZSIsIm1pbWUiLCJEQVRBTElCX0ZPUk1BVFMiLCJUT0tFTlMiLCJ0b2tlbkNsYXNzTmFtZSIsInByb3RvdHlwZSIsImlkZW50aXR5IiwicGFyZW50VHlwZSIsImRlZmF1bHRGaW5pc2giLCJzaGExIiwibm9vcCIsImxvYWRSb290IiwibG9hZENsYXNzZXMiLCJnZXRJdGVtIiwicGFyc2UiLCJzYXZlUm9vdCIsInNldEl0ZW0iLCJyYXdDbGFzc09iaiIsInJhd0NsYXNzZXMiLCJzZWxlY3RvclN0cmluZyIsInN0YXJ0c1dpdGhSb290IiwiY2h1bmsiLCJ0b1VwcGVyQ2FzZSIsInRyaW0iLCJhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljRGF0YVNvdXJjZSIsInJlbW92ZURhdGFTb3VyY2UiLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsYUFBTCxHQUFxQixFQUFyQjtXQUNLQyxjQUFMLEdBQXNCLEVBQXRCOzs7SUFFRkMsRUFBRSxDQUFFQyxTQUFGLEVBQWFDLFFBQWIsRUFBdUJDLHVCQUF2QixFQUFnRDtVQUM1QyxDQUFDLEtBQUtMLGFBQUwsQ0FBbUJHLFNBQW5CLENBQUwsRUFBb0M7YUFDN0JILGFBQUwsQ0FBbUJHLFNBQW5CLElBQWdDLEVBQWhDOzs7VUFFRSxDQUFDRSx1QkFBTCxFQUE4QjtZQUN4QixLQUFLTCxhQUFMLENBQW1CRyxTQUFuQixFQUE4QkcsT0FBOUIsQ0FBc0NGLFFBQXRDLE1BQW9ELENBQUMsQ0FBekQsRUFBNEQ7Ozs7O1dBSXpESixhQUFMLENBQW1CRyxTQUFuQixFQUE4QkksSUFBOUIsQ0FBbUNILFFBQW5DOzs7SUFFRkksR0FBRyxDQUFFTCxTQUFGLEVBQWFDLFFBQWIsRUFBdUI7VUFDcEIsS0FBS0osYUFBTCxDQUFtQkcsU0FBbkIsQ0FBSixFQUFtQztZQUM3QixDQUFDQyxRQUFMLEVBQWU7aUJB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
