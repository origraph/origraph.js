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
    delete this._stream;
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
    delete this._stream;
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

    delete this._stream;
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
var version = "0.4.9r1";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvSW5kZXhlZFRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Qcm9tb3RlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0pvaW5Ub2tlbi5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9JbmRleGVzL0luTWVtb3J5SW5kZXguanMiLCIuLi9zcmMvTXVyZS5qcyIsIi4uL3NyYy9tYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIFN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy5uYW1lZFN0cmVhbXMgPSBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fTtcbiAgICB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCBudWxsO1xuICAgIHRoaXMudG9rZW5DbGFzc0xpc3QgPSBvcHRpb25zLnRva2VuQ2xhc3NMaXN0IHx8IFtdO1xuXG4gICAgLy8gUmVtaW5kZXI6IHRoaXMgYWx3YXlzIG5lZWRzIHRvIGJlIGFmdGVyIGluaXRpYWxpemluZyB0aGlzLm5hbWVkRnVuY3Rpb25zXG4gICAgLy8gYW5kIHRoaXMubmFtZWRTdHJlYW1zXG4gICAgdGhpcy50b2tlbkxpc3QgPSBvcHRpb25zLnRva2VuQ2xhc3NMaXN0Lm1hcCgoeyBUb2tlbkNsYXNzLCBhcmdMaXN0IH0pID0+IHtcbiAgICAgIHJldHVybiBuZXcgVG9rZW5DbGFzcyh0aGlzLCBhcmdMaXN0KTtcbiAgICB9KTtcbiAgICAvLyBSZW1pbmRlcjogdGhpcyBhbHdheXMgbmVlZHMgdG8gYmUgYWZ0ZXIgaW5pdGlhbGl6aW5nIHRoaXMudG9rZW5MaXN0XG4gICAgdGhpcy5XcmFwcGVycyA9IHRoaXMuZ2V0V3JhcHBlckxpc3QoKTtcblxuICAgIC8vIFRPRE86IHByZXNlcnZlIHRoZXNlIHNvbWVob3c/XG4gICAgdGhpcy5pbmRleGVzID0ge307XG4gIH1cblxuICBnZXRXcmFwcGVyTGlzdCAoKSB7XG4gICAgLy8gTG9vayB1cCB3aGljaCwgaWYgYW55LCBjbGFzc2VzIGRlc2NyaWJlIHRoZSByZXN1bHQgb2YgZWFjaCB0b2tlbiwgc28gdGhhdFxuICAgIC8vIHdlIGNhbiB3cmFwIGl0ZW1zIGFwcHJvcHJpYXRlbHk6XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0Lm1hcCgodG9rZW4sIGluZGV4KSA9PiB7XG4gICAgICBpZiAoaW5kZXggPT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEgJiYgdGhpcy5sYXVuY2hlZEZyb21DbGFzcykge1xuICAgICAgICAvLyBJZiB0aGlzIHN0cmVhbSB3YXMgc3RhcnRlZCBmcm9tIGEgY2xhc3MsIHdlIGFscmVhZHkga25vdyB3ZSBzaG91bGRcbiAgICAgICAgLy8gdXNlIHRoYXQgY2xhc3MncyB3cmFwcGVyIGZvciB0aGUgbGFzdCB0b2tlblxuICAgICAgICByZXR1cm4gdGhpcy5sYXVuY2hlZEZyb21DbGFzcy5XcmFwcGVyO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBhIGNsYXNzIHRoYXQgZGVzY3JpYmVzIGV4YWN0bHkgZWFjaCBzZXJpZXMgb2YgdG9rZW5zXG4gICAgICBjb25zdCBsb2NhbFRva2VuTGlzdCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIGluZGV4ICsgMSk7XG4gICAgICBjb25zdCBwb3RlbnRpYWxXcmFwcGVycyA9IE9iamVjdC52YWx1ZXModGhpcy5tdXJlLmNsYXNzZXMpXG4gICAgICAgIC5maWx0ZXIoY2xhc3NPYmogPT4ge1xuICAgICAgICAgIGNvbnN0IGNsYXNzVG9rZW5MaXN0ID0gY2xhc3NPYmoudG9rZW5DbGFzc0xpc3Q7XG4gICAgICAgICAgaWYgKCFjbGFzc1Rva2VuTGlzdC5sZW5ndGggIT09IGxvY2FsVG9rZW5MaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbkxpc3QuZXZlcnkoKGxvY2FsVG9rZW4sIGxvY2FsSW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuQ2xhc3NTcGVjID0gY2xhc3NUb2tlbkxpc3RbbG9jYWxJbmRleF07XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbiBpbnN0YW5jZW9mIHRva2VuQ2xhc3NTcGVjLlRva2VuQ2xhc3MgJiZcbiAgICAgICAgICAgICAgdG9rZW4uaXNTdWJzZXRPZih0b2tlbkNsYXNzU3BlYy5hcmdMaXN0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIE5vIGNsYXNzZXMgZGVzY3JpYmUgdGhpcyBzZXJpZXMgb2YgdG9rZW5zLCBzbyB1c2UgdGhlIGdlbmVyaWMgd3JhcHBlclxuICAgICAgICByZXR1cm4gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYE11bHRpcGxlIGNsYXNzZXMgZGVzY3JpYmUgdGhlIHNhbWUgaXRlbSEgQXJiaXRyYXJpbHkgY2hvb3Npbmcgb25lLi4uYCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBvdGVudGlhbFdyYXBwZXJzWzBdLldyYXBwZXI7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5qb2luKCcnKTtcbiAgfVxuXG4gIGZvcmsgKHNlbGVjdG9yKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0oe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgbmFtZWRGdW5jdGlvbnM6IHRoaXMubmFtZWRGdW5jdGlvbnMsXG4gICAgICBuYW1lZFN0cmVhbXM6IHRoaXMubmFtZWRTdHJlYW1zLFxuICAgICAgdG9rZW5DbGFzc0xpc3Q6IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKHNlbGVjdG9yKSxcbiAgICAgIGxhdW5jaGVkRnJvbUNsYXNzOiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzXG4gICAgfSk7XG4gIH1cblxuICBleHRlbmQgKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICBvcHRpb25zLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZEZ1bmN0aW9ucywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkU3RyZWFtcywgb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge30pO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0LmNvbmNhdChbeyBUb2tlbkNsYXNzLCBhcmdMaXN0IH1dKTtcbiAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG5cbiAgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSwgaGFzaGVzID0ge30gfSkge1xuICAgIGxldCB3cmFwcGVySW5kZXggPSAwO1xuICAgIGxldCB0ZW1wID0gd3JhcHBlZFBhcmVudDtcbiAgICB3aGlsZSAodGVtcCAhPT0gbnVsbCkge1xuICAgICAgd3JhcHBlckluZGV4ICs9IDE7XG4gICAgICB0ZW1wID0gdGVtcC53cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IG5ldyB0aGlzLldyYXBwZXJzW3dyYXBwZXJJbmRleF0oeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cblxuICBnZXRJbmRleCAoaGFzaEZ1bmN0aW9uTmFtZSwgdG9rZW4pIHtcbiAgICBpZiAoIXRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSkge1xuICAgICAgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdID0ge307XG4gICAgfVxuICAgIGNvbnN0IHRva2VuSW5kZXggPSB0aGlzLnRva2VuTGlzdC5pbmRleE9mKHRva2VuKTtcbiAgICBpZiAoIXRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXVt0b2tlbkluZGV4XSkge1xuICAgICAgLy8gVE9ETzogZmlndXJlIG91dCBleHRlcm5hbCBpbmRleGVzLi4uXG4gICAgICB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV1bdG9rZW5JbmRleF0gPSBuZXcgdGhpcy5tdXJlLklOREVYRVMuSW5NZW1vcnlJbmRleCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdW3Rva2VuSW5kZXhdO1xuICB9XG5cbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICBjb25zdCBsYXN0VG9rZW4gPSB0aGlzLnRva2VuTGlzdFt0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50b2tlbkxpc3Quc2xpY2UoMCwgdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSk7XG4gICAgeWllbGQgKiBhd2FpdCBsYXN0VG9rZW4uaXRlcmF0ZSh0ZW1wKTtcbiAgfVxuXG4gIGFzeW5jICogc2FtcGxlICh7IGxpbWl0ID0gMTAsIHJlYnVpbGRJbmRleGVzID0gZmFsc2UgfSkge1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVRva2VuIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgLy8gVGhlIHN0cmluZyB2ZXJzaW9uIG9mIG1vc3QgdG9rZW5zIGNhbiBqdXN0IGJlIGRlcml2ZWQgZnJvbSB0aGUgY2xhc3MgdHlwZVxuICAgIHJldHVybiBgLiR7dGhpcy50eXBlLnRvTG93ZXJDYXNlKCl9KClgO1xuICB9XG4gIGlzU3ViU2V0T2YgKCkge1xuICAgIC8vIEJ5IGRlZmF1bHQgKHdpdGhvdXQgYW55IGFyZ3VtZW50cyksIHRva2VucyBvZiB0aGUgc2FtZSBjbGFzcyBhcmUgc3Vic2V0c1xuICAgIC8vIG9mIGVhY2ggb3RoZXJcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlUGFyZW50IChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IHBhcmVudFRva2VuID0gYW5jZXN0b3JUb2tlbnNbYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IGFuY2VzdG9yVG9rZW5zLnNsaWNlKDAsIGFuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDEpO1xuICAgIGxldCB5aWVsZGVkU29tZXRoaW5nID0gZmFsc2U7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRva2VuLml0ZXJhdGUodGVtcCkpIHtcbiAgICAgIHlpZWxkZWRTb21ldGhpbmcgPSB0cnVlO1xuICAgICAgeWllbGQgd3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgaWYgKCF5aWVsZGVkU29tZXRoaW5nICYmIHRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFRva2VuIHlpZWxkZWQgbm8gcmVzdWx0czogJHtwYXJlbnRUb2tlbn1gKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCByYXdJdGVtIH0pIHtcbiAgICAvLyBJbmRleGVkVG9rZW4gb3ZlcnJpZGVzIHdpdGggYW4gYXN5bmMgZnVuY3Rpb25cbiAgICByZXR1cm4gdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgdG9rZW46IHRoaXMsXG4gICAgICByYXdJdGVtXG4gICAgfSk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlVG9rZW4sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRva2VuLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQmFzZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEVtcHR5VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIC8vIHlpZWxkIG5vdGhpbmdcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGBlbXB0eWA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEVtcHR5VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudDogbnVsbCxcbiAgICAgIHJhd0l0ZW06IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0gPSB7fSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKGtleXMgfHwgcmFuZ2VzKSB7XG4gICAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgICAgdGhpcy5yYW5nZXMgPSByYW5nZXM7XG4gICAgfSBlbHNlIGlmICgoYXJnTGlzdCAmJiBhcmdMaXN0Lmxlbmd0aCA9PT0gMSAmJiBhcmdMaXN0WzBdID09PSB1bmRlZmluZWQpIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgZGlmZmVyZW5jZSAob3RoZXJUb2tlbikge1xuICAgIC8vIENvbXB1dGUgd2hhdCBpcyBsZWZ0IG9mIHRoaXMgYWZ0ZXIgc3VidHJhY3Rpbmcgb3V0IGV2ZXJ5dGhpbmcgaW4gb3RoZXJUb2tlblxuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNvbXB1dGUgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIGRpZmZlcmVudCB0b2tlbiB0eXBlc2ApO1xuICAgIH0gZWxzZSBpZiAob3RoZXJUb2tlbi5tYXRjaEFsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEluYWNjdXJhdGUgZGlmZmVyZW5jZSBjb21wdXRlZCEgVE9ETzogbmVlZCB0byBmaWd1cmUgb3V0IGhvdyB0byBpbnZlcnQgY2F0ZWdvcmljYWwga2V5cyFgKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdLZXlzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgaW4gKHRoaXMua2V5cyB8fCB7fSkpIHtcbiAgICAgICAgaWYgKCFvdGhlclRva2VuLmtleXMgfHwgIW90aGVyVG9rZW4ua2V5c1trZXldKSB7XG4gICAgICAgICAgbmV3S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1JhbmdlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICAgIGlmIChvdGhlclRva2VuLnJhbmdlcykge1xuICAgICAgICAgIGxldCBhbGxQb2ludHMgPSB0aGlzLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgYWxsUG9pbnRzID0gYWxsUG9pbnRzLmNvbmNhdChvdGhlclRva2VuLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSkpLnNvcnQoKTtcbiAgICAgICAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbFBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IHsgbG93OiBhbGxQb2ludHNbaV0udmFsdWUgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5leGNsdWRlKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0ubG93IC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5sb3cgPSBhbGxQb2ludHNbaV0uaGlnaCArIDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3UmFuZ2VzID0gdGhpcy5yYW5nZXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgS2V5c1Rva2VuKHRoaXMubXVyZSwgbnVsbCwgeyBrZXlzOiBuZXdLZXlzLCByYW5nZXM6IG5ld1JhbmdlcyB9KTtcbiAgICB9XG4gIH1cbiAgaXNTdWJTZXRPZiAoYXJnTGlzdCkge1xuICAgIGNvbnN0IG90aGVyVG9rZW4gPSBuZXcgS2V5c1Rva2VuKHRoaXMuc3RyZWFtLCBhcmdMaXN0KTtcbiAgICBjb25zdCBkaWZmID0gb3RoZXJUb2tlbi5kaWZmZXJlbmNlKHRoaXMpO1xuICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7IHJldHVybiAnLmtleXMoKSc7IH1cbiAgICByZXR1cm4gJy5rZXlzKCcgKyAodGhpcy5yYW5nZXMgfHwgW10pLm1hcCgoe2xvdywgaGlnaH0pID0+IHtcbiAgICAgIHJldHVybiBsb3cgPT09IGhpZ2ggPyBsb3cgOiBgJHtsb3d9LSR7aGlnaH1gO1xuICAgIH0pLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmtleXMgfHwge30pLm1hcChrZXkgPT4gYCcke2tleX0nYCkpXG4gICAgICAuam9pbignLCcpICsgJyknO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEtleXNUb2tlbiBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxldCB7bG93LCBoaWdofSBvZiB0aGlzLnJhbmdlcyB8fCBbXSkge1xuICAgICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgICAgaGlnaCA9IE1hdGgubWluKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5sZW5ndGggLSAxLCBoaWdoKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gbG93OyBpIDw9IGhpZ2g7IGkrKykge1xuICAgICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgICByYXdJdGVtOiBpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gdGhpcy5rZXlzIHx8IHt9KSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgS2V5c1Rva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFZhbHVlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgY29uc3Qga2V5ID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAoa2V5VHlwZSAhPT0gJ3N0cmluZycgJiYga2V5VHlwZSAhPT0gJ251bWJlcicpKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICByYXdJdGVtOiBvYmpba2V5XVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBWYWx1ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEV2YWx1YXRlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGlmICh0eXBlb2Ygd3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBFdmFsdWF0ZVRva2VuIGlzIG5vdCBhIHN0cmluZ2ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3U3RyZWFtO1xuICAgICAgdHJ5IHtcbiAgICAgICAgbmV3U3RyZWFtID0gdGhpcy5zdHJlYW0uZm9yayh3cmFwcGVkUGFyZW50LnJhd0l0ZW0pO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1ZyB8fCAhKGVyciBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSkge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgeWllbGQgKiBhd2FpdCBuZXdTdHJlYW0uaXRlcmF0ZSgpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXZhbHVhdGVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBNYXBUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tnZW5lcmF0b3JdKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7Z2VuZXJhdG9yfWApO1xuICAgIH1cbiAgICB0aGlzLmdlbmVyYXRvciA9IGdlbmVyYXRvcjtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAubWFwKCR7dGhpcy5nZW5lcmF0b3J9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICByZXR1cm4gZ2VuZXJhdG9yID09PSB0aGlzLmdlbmVyYXRvcjtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmdlbmVyYXRvcl0od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1hcFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEluZGV4ZWRUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgcmF3SXRlbSwgaGFzaGVzID0ge30gfSkge1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gYXdhaXQgc3VwZXIud3JhcCh7IHdyYXBwZWRQYXJlbnQsIHJhd0l0ZW0gfSk7XG4gICAgZm9yIChjb25zdCBbIGhhc2hGdW5jTmFtZSwgaGFzaCBdIG9mIE9iamVjdC5lbnRyaWVzKGhhc2hlcykpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgoaGFzaEZ1bmNOYW1lLCB0aGlzKTtcbiAgICAgIGF3YWl0IGluZGV4LmFkZFZhbHVlKGhhc2gsIHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbmRleGVkVG9rZW47XG4iLCJpbXBvcnQgSW5kZXhlZFRva2VuIGZyb20gJy4vSW5kZXhlZFRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgSW5kZXhlZFRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgbWFwLCBoYXNoLCByZWR1Y2VJbnN0YW5jZXMgXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLnByb21vdGUoJHt0aGlzLm1hcH0sICR7dGhpcy5oYXNofSwgJHt0aGlzLnJlZHVjZUluc3RhbmNlc30pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwID09PSBtYXAgJiZcbiAgICAgIHRoaXMuaGFzaCA9PT0gaGFzaCAmJlxuICAgICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPT09IHJlZHVjZUluc3RhbmNlcztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG1hcEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5tYXBdO1xuICAgICAgY29uc3QgaGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5oYXNoXTtcbiAgICAgIGNvbnN0IHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5yZWR1Y2VJbnN0YW5jZXNdO1xuICAgICAgY29uc3QgaGFzaEluZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy5oYXNoLCB0aGlzKTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiBtYXBGdW5jdGlvbih3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICBjb25zdCBoYXNoID0gaGFzaEZ1bmN0aW9uKG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICBsZXQgb3JpZ2luYWxXcmFwcGVkSXRlbSA9IChhd2FpdCBoYXNoSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpKVswXTtcbiAgICAgICAgaWYgKG9yaWdpbmFsV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWR1Y2VJbnN0YW5jZXMgIT09ICdub29wJykge1xuICAgICAgICAgICAgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24ob3JpZ2luYWxXcmFwcGVkSXRlbSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBoYXNoZXMgPSB7fTtcbiAgICAgICAgICBoYXNoZXNbdGhpcy5oYXNoXSA9IGhhc2g7XG4gICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtLFxuICAgICAgICAgICAgaGFzaGVzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZVRva2VuO1xuIiwiaW1wb3J0IEluZGV4ZWRUb2tlbiBmcm9tICcuL0luZGV4ZWRUb2tlbi5qcyc7XG5cbmNsYXNzIEpvaW5Ub2tlbiBleHRlbmRzIEluZGV4ZWRUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnZGVmYXVsdEZpbmlzaCcsIGVkZ2VSb2xlID0gJ25vbmUnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIHRoaXNIYXNoLCBmaW5pc2ggXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgdGVtcCA9IHN0cmVhbS5uYW1lZFN0cmVhbXNbb3RoZXJTdHJlYW1dO1xuICAgIGlmICghdGVtcCkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIHN0cmVhbTogJHtvdGhlclN0cmVhbX1gKTtcbiAgICB9XG4gICAgLy8gUmVxdWlyZSBvdGhlckhhc2ggb24gdGhlIG90aGVyIHN0cmVhbSwgb3IgY29weSBvdXJzIG92ZXIgaWYgaXQgaXNuJ3RcbiAgICAvLyBhbHJlYWR5IGRlZmluZWRcbiAgICBpZiAoIXRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gaGFzaCBmdW5jdGlvbiBvbiBlaXRoZXIgc3RyZWFtOiAke290aGVySGFzaH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSA9IHN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMub3RoZXJTdHJlYW0gPSBvdGhlclN0cmVhbTtcbiAgICB0aGlzLnRoaXNIYXNoID0gdGhpc0hhc2g7XG4gICAgdGhpcy5vdGhlckhhc2ggPSBvdGhlckhhc2g7XG4gICAgdGhpcy5maW5pc2ggPSBmaW5pc2g7XG4gICAgdGhpcy5lZGdlUm9sZSA9IGVkZ2VSb2xlO1xuICAgIHRoaXMuaGFzaFRoaXNHcmFuZHBhcmVudCA9IGVkZ2VSb2xlID09PSAnZnVsbCc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLmpvaW4oJHt0aGlzLm90aGVyU3RyZWFtfSwgJHt0aGlzLnRoaXNIYXNofSwgJHt0aGlzLm90aGVySGFzaH0sICR7dGhpcy5maW5pc2h9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBvdGhlclN0cmVhbSwgdGhpc0hhc2ggPSAna2V5Jywgb3RoZXJIYXNoID0gJ2tleScsIGZpbmlzaCA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiB0aGlzLm90aGVyU3RyZWFtID09PSBvdGhlclN0cmVhbSAmJlxuICAgICAgdGhpcy50aGlzSGFzaCA9PT0gdGhpc0hhc2ggJiZcbiAgICAgIHRoaXMub3RoZXJIYXNoID09PSBvdGhlckhhc2ggJiZcbiAgICAgIHRoaXMuZmluaXNoID09PSBmaW5pc2g7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IG90aGVyU3RyZWFtID0gdGhpcy5zdHJlYW0ubmFtZWRTdHJlYW1zW3RoaXMub3RoZXJTdHJlYW1dO1xuICAgIGNvbnN0IHRoaXNIYXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLnRoaXNIYXNoXTtcbiAgICBjb25zdCBvdGhlckhhc2hGdW5jdGlvbiA9IG90aGVyU3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMub3RoZXJIYXNoXTtcbiAgICBjb25zdCBmaW5pc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZmluaXNoXTtcblxuICAgIGNvbnN0IHRoaXNJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMudGhpc0hhc2gsIHRoaXMpO1xuICAgIGNvbnN0IG90aGVySW5kZXggPSBvdGhlclN0cmVhbS5nZXRJbmRleCh0aGlzLm90aGVySGFzaCwgdGhpcyk7XG5cbiAgICBpZiAodGhpc0luZGV4LmNvbXBsZXRlKSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBCZXN0IG9mIGFsbCB3b3JsZHM7IHdlIGNhbiBqdXN0IGpvaW4gdGhlIGluZGV4ZXNcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IGhhc2gsIHZhbHVlTGlzdCB9IG9mIHRoaXNJbmRleC5pdGVyRW50cmllcygpKSB7XG4gICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdmFsdWVMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIHRoZSBvdGhlciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIG91ciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJTdHJlYW0uaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIG90aGVySGFzaEZ1bmN0aW9uKG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBBZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4OlxuICAgICAgICAgICAgYXdhaXQgb3RoZXJJbmRleC5hZGRWYWx1ZShoYXNoLCBvdGhlcldyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgb3VyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2YgdGhlIG90aGVyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgICAgICAvLyBPZGQgY29ybmVyIGNhc2UgZm9yIGVkZ2VzOyBzb21ldGltZXMgd2Ugd2FudCB0byBoYXNoIHRoZSBncmFuZHBhcmVudCBpbnN0ZWFkIG9mIHRoZSByZXN1bHQgb2ZcbiAgICAgICAgICAvLyBhbiBpbnRlcm1lZGlhdGUgam9pbjpcbiAgICAgICAgICBjb25zdCB0aGlzSGFzaEl0ZW0gPSB0aGlzLmhhc2hUaGlzR3JhbmRwYXJlbnQgPyB0aGlzV3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCA6IHRoaXNXcmFwcGVkSXRlbTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzSGFzaEl0ZW0pKSB7XG4gICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgYXdhaXQgdGhpc0luZGV4LmFkZFZhbHVlKGhhc2gsIHRoaXNIYXNoSXRlbSk7XG4gICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWl0aGVyIHN0cmVhbSBpcyBmdWxseSBpbmRleGVkOyBmb3IgbW9yZSBkaXN0cmlidXRlZCBzYW1wbGluZywgZ3JhYlxuICAgICAgICAvLyBvbmUgaXRlbSBmcm9tIGVhY2ggc3RyZWFtIGF0IGEgdGltZSwgYW5kIHVzZSB0aGUgcGFydGlhbCBpbmRleGVzXG4gICAgICAgIGNvbnN0IHRoaXNJdGVyYXRvciA9IHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucywgdGhpcy50aGlzSW5kaXJlY3RLZXkpO1xuICAgICAgICBsZXQgdGhpc0lzRG9uZSA9IGZhbHNlO1xuICAgICAgICBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuICAgICAgICBsZXQgb3RoZXJJc0RvbmUgPSBmYWxzZTtcblxuICAgICAgICB3aGlsZSAoIXRoaXNJc0RvbmUgfHwgIW90aGVySXNEb25lKSB7XG4gICAgICAgICAgLy8gVGFrZSBvbmUgc2FtcGxlIGZyb20gdGhpcyBzdHJlYW1cbiAgICAgICAgICBsZXQgdGVtcCA9IGF3YWl0IHRoaXNJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgdGhpc0lzRG9uZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICAvLyBPZGQgY29ybmVyIGNhc2UgZm9yIGVkZ2VzOyBzb21ldGltZXMgd2Ugd2FudCB0byBoYXNoIHRoZSBncmFuZHBhcmVudCBpbnN0ZWFkIG9mIHRoZSByZXN1bHQgb2ZcbiAgICAgICAgICAgIC8vIGFuIGludGVybWVkaWF0ZSBqb2luOlxuICAgICAgICAgICAgY29uc3QgdGhpc0hhc2hJdGVtID0gdGhpcy5oYXNoVGhpc0dyYW5kcGFyZW50ID8gdGhpc1dyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgOiB0aGlzV3JhcHBlZEl0ZW07XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzSGFzaEl0ZW0pKSB7XG4gICAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICAgIHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzSGFzaEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE5vdyBmb3IgYSBzYW1wbGUgZnJvbSB0aGUgb3RoZXIgc3RyZWFtXG4gICAgICAgICAgdGVtcCA9IGF3YWl0IG90aGVySXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIG90aGVySXNEb25lID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgLy8gYWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleFxuICAgICAgICAgICAgICBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEpvaW5Ub2tlbjtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuLi9TdHJlYW0uanMnO1xuXG5jb25zdCBBU1RFUklTS1MgPSB7XG4gICdldmFsdWF0ZSc6ICfihqwnLFxuICAnam9pbic6ICfiqK8nLFxuICAnbWFwJzogJ+KGpicsXG4gICdwcm9tb3RlJzogJ+KGkScsXG4gICd2YWx1ZSc6ICfihpInXG59O1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm11cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMuX3NlbGVjdG9yID0gb3B0aW9ucy5zZWxlY3RvcjtcbiAgICB0aGlzLmN1c3RvbUNsYXNzTmFtZSA9IG9wdGlvbnMuY3VzdG9tQ2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9IG9wdGlvbnMuY3VzdG9tTmFtZVRva2VuSW5kZXggfHwgbnVsbDtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sXG4gICAgICB0aGlzLm11cmUuTkFNRURfRlVOQ1RJT05TLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBmb3IgKGxldCBbZnVuY05hbWUsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubmFtZWRGdW5jdGlvbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtmdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc2VsZWN0b3I7XG4gIH1cbiAgZ2V0IHRva2VuQ2xhc3NMaXN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3IodGhpcy5zZWxlY3Rvcik7XG4gIH1cbiAgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzVHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgc2VsZWN0b3I6IHRoaXMuX3NlbGVjdG9yLFxuICAgICAgY3VzdG9tQ2xhc3NOYW1lOiB0aGlzLmN1c3RvbUNsYXNzTmFtZSxcbiAgICAgIGN1c3RvbU5hbWVUb2tlbkluZGV4OiB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4LFxuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgbmFtZWRGdW5jdGlvbnM6IHt9XG4gICAgfTtcbiAgICBmb3IgKGxldCBbZnVuY05hbWUsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubmFtZWRGdW5jdGlvbnMpKSB7XG4gICAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgICAgLy8gSXN0YW5idWwgYWRkcyBzb21lIGNvZGUgdG8gZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgY292ZXJhZ2UsIHRoYXQgZ2V0c1xuICAgICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICAgIHN0cmluZ2lmaWVkRnVuYyA9IHN0cmluZ2lmaWVkRnVuYy5yZXBsYWNlKC9jb3ZfKC4rPylcXCtcXCtbLDtdPy9nLCAnJyk7XG4gICAgICByZXN1bHQubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gc3RyaW5naWZpZWRGdW5jO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICBpZiAodGhpcy5jdXN0b21DbGFzc05hbWUgIT09IHZhbHVlKSB7XG4gICAgICB0aGlzLmN1c3RvbUNsYXNzTmFtZSA9IHZhbHVlO1xuICAgICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9IHRoaXMuc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpLmxlbmd0aDtcbiAgICAgIHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIH1cbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSBudWxsICYmXG4gICAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID09PSB0aGlzLnNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKS5sZW5ndGg7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgY29uc3Qgc2VsZWN0b3IgPSB0aGlzLnNlbGVjdG9yO1xuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IHRva2VuU3RyaW5ncy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSBudWxsICYmIGkgPD0gdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXN0b21DbGFzc05hbWUgKyByZXN1bHQ7XG4gICAgICB9XG4gICAgICBjb25zdCB0ZW1wID0gdG9rZW5TdHJpbmdzW2ldLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAodGVtcFsxXSA9PT0gJ2tleXMnIHx8IHRlbXBbMV0gPT09ICd2YWx1ZXMnKSB7XG4gICAgICAgIGlmICh0ZW1wWzJdID09PSAnJykge1xuICAgICAgICAgIHJlc3VsdCA9ICcqJyArIHJlc3VsdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQgPSB0ZW1wWzJdLnJlcGxhY2UoLycoW14nXSopJy8sICckMScpICsgcmVzdWx0O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSBBU1RFUklTS1NbdGVtcFsxXV0gKyByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAoc2VsZWN0b3Iuc3RhcnRzV2l0aCgnZW1wdHknKSA/ICfiiIUnIDogJycpICsgcmVzdWx0O1xuICB9XG4gIGFkZEhhc2hGdW5jdGlvbiAoZnVuY05hbWUsIGZ1bmMpIHtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IGZ1bmM7XG4gIH1cbiAgcG9wdWxhdGVTdHJlYW1PcHRpb25zIChvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMudG9rZW5DbGFzc0xpc3Q7XG4gICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IHRoaXMubmFtZWRGdW5jdGlvbnM7XG4gICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cbiAgZ2V0U3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAob3B0aW9ucy5yZXNldCB8fCAhdGhpcy5fc3RyZWFtKSB7XG4gICAgICB0aGlzLl9zdHJlYW0gPSBuZXcgU3RyZWFtKHRoaXMucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbTtcbiAgfVxuICBpc1N1cGVyU2V0T2ZUb2tlbkxpc3QgKHRva2VuTGlzdCkge1xuICAgIGlmICh0b2tlbkxpc3QubGVuZ3RoICE9PSB0aGlzLnRva2VuTGlzdC5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmV2ZXJ5KCh0b2tlbiwgaSkgPT4gdG9rZW4uaXNTdXBlclNldE9mKHRva2VuTGlzdFtpXSkpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLnRvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF0gPSBuZXcgdGhpcy5tdXJlLkNMQVNTRVMuTm9kZUNsYXNzKG9wdGlvbnMpO1xuICAgIHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLnRvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF0gPSBuZXcgdGhpcy5tdXJlLkNMQVNTRVMuRWRnZUNsYXNzKG9wdGlvbnMpO1xuICAgIHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoaGFzaCwgcmVkdWNlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgZXhwYW5kIChtYXApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBmaWx0ZXIgKGZpbHRlcikge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIHNwbGl0IChoYXNoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXI7XG4gICAgdGhpcy5lZGdlQ29ubmVjdGlvbnMgPSBvcHRpb25zLmVkZ2VDb25uZWN0aW9ucyB8fCB7fTtcbiAgfVxuICB0b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIudG9SYXdPYmplY3QoKTtcbiAgICAvLyBUT0RPOiBuZWVkIHRvIGRlZXAgY29weSBlZGdlQ29ubmVjdGlvbnM/XG4gICAgcmVzdWx0LmVkZ2VDb25uZWN0aW9ucyA9IHRoaXMuZWRnZUNvbm5lY3Rpb25zO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBkaXJlY3RlZCwgdGhpc0hhc2hOYW1lLCBvdGhlckhhc2hOYW1lIH0pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm11cmUubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IG51bGwsXG4gICAgICBDbGFzc1R5cGU6IHRoaXMubXVyZS5DTEFTU0VTLkVkZ2VDbGFzcyxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICBkaXJlY3RlZFxuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNvbm5lY3Rpb25zW2VkZ2VDbGFzcy5jbGFzc0lkXSA9IHsgbm9kZUhhc2hOYW1lOiB0aGlzSGFzaE5hbWUgfTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbZWRnZUNsYXNzLmNsYXNzSWRdID0geyBub2RlSGFzaE5hbWU6IG90aGVySGFzaE5hbWUgfTtcbiAgICBkZWxldGUgdGhpcy5fc3RyZWFtO1xuICAgIHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ29ubmVjdGlvbnMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9IG51bGw7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG5cbiAgICBpZiAoIXRoaXMuX3NlbGVjdG9yKSB7XG4gICAgICBpZiAoIXNvdXJjZUNsYXNzIHx8ICF0YXJnZXRDbGFzcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcnRpYWwgY29ubmVjdGlvbnMgd2l0aG91dCBhbiBlZGdlIHRhYmxlIHNob3VsZCBuZXZlciBoYXBwZW5gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vIGVkZ2UgdGFibGUgKHNpbXBsZSBqb2luIGJldHdlZW4gdHdvIG5vZGVzKVxuICAgICAgICBjb25zdCBzb3VyY2VIYXNoID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0ubm9kZUhhc2hOYW1lO1xuICAgICAgICBjb25zdCB0YXJnZXRIYXNoID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0ubm9kZUhhc2hOYW1lO1xuICAgICAgICByZXR1cm4gc291cmNlQ2xhc3Muc2VsZWN0b3IgKyBgLmpvaW4odGFyZ2V0LCAke3NvdXJjZUhhc2h9LCAke3RhcmdldEhhc2h9LCBkZWZhdWx0RmluaXNoLCBzb3VyY2VUYXJnZXQpYDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHJlc3VsdCA9IHRoaXMuX3NlbGVjdG9yO1xuICAgICAgaWYgKCFzb3VyY2VDbGFzcykge1xuICAgICAgICBpZiAoIXRhcmdldENsYXNzKSB7XG4gICAgICAgICAgLy8gTm8gY29ubmVjdGlvbnMgeWV0OyBqdXN0IHlpZWxkIHRoZSByYXcgZWRnZSB0YWJsZVxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gUGFydGlhbCBlZGdlLXRhcmdldCBjb25uZWN0aW9uc1xuICAgICAgICAgIGNvbnN0IHsgZWRnZUhhc2hOYW1lLCBub2RlSGFzaE5hbWUgfSA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICAgIHJldHVybiByZXN1bHQgKyBgLmpvaW4odGFyZ2V0LCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaCwgZWRnZVRhcmdldClgO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCF0YXJnZXRDbGFzcykge1xuICAgICAgICAvLyBQYXJ0aWFsIHNvdXJjZS1lZGdlIGNvbm5lY3Rpb25zXG4gICAgICAgIGNvbnN0IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICByZXR1cm4gcmVzdWx0ICsgYC5qb2luKHNvdXJjZSwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gsIHNvdXJjZUVkZ2UpYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZ1bGwgY29ubmVjdGlvbnNcbiAgICAgICAgbGV0IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICByZXN1bHQgKz0gYC5qb2luKHNvdXJjZSwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gpYDtcbiAgICAgICAgKHsgZWRnZUhhc2hOYW1lLCBub2RlSGFzaE5hbWUgfSA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdKTtcbiAgICAgICAgcmVzdWx0ICs9IGAuam9pbih0YXJnZXQsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoLCBmdWxsKWA7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHBvcHVsYXRlU3RyZWFtT3B0aW9ucyAob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBvcHRpb25zLm5hbWVkU3RyZWFtcyA9IHt9O1xuICAgIGlmICghdGhpcy5fc2VsZWN0b3IpIHtcbiAgICAgIC8vIFVzZSB0aGUgb3B0aW9ucyBmcm9tIHRoZSBzb3VyY2Ugc3RyZWFtIGluc3RlYWQgb2Ygb3VyIGNsYXNzXG4gICAgICBvcHRpb25zID0gc291cmNlQ2xhc3MucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpO1xuICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMudGFyZ2V0ID0gdGFyZ2V0Q2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMgPSBzdXBlci5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICBpZiAoc291cmNlQ2xhc3MpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMuc291cmNlID0gc291cmNlQ2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgICB9XG4gICAgICBpZiAodGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMudGFyZ2V0ID0gdGFyZ2V0Q2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xuICB9XG4gIHRvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci50b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCBkaXJlY3Rpb24sIG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0pIHtcbiAgICBpZiAoZGlyZWN0aW9uID09PSAnc291cmNlJykge1xuICAgICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uID09PSAndGFyZ2V0Jykge1xuICAgICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXS5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIH0gZWxzZSBpZiAoIXRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgU291cmNlIGFuZCB0YXJnZXQgYXJlIGFscmVhZHkgZGVmaW5lZDsgcGxlYXNlIHNwZWNpZnkgYSBkaXJlY3Rpb24gdG8gb3ZlcnJpZGVgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdID0geyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9O1xuICAgIGRlbGV0ZSB0aGlzLl9zdHJlYW07XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgdG9nZ2xlTm9kZURpcmVjdGlvbiAoc291cmNlQ2xhc3NJZCkge1xuICAgIGlmICghc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3Qgc3dhcCB0byB1bmNvbm5lY3RlZCBjbGFzcyBpZDogJHtzb3VyY2VDbGFzc0lkfWApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gc291cmNlQ2xhc3NJZDtcbiAgICAgIH1cbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX3N0cmVhbTtcbiAgICB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXS5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLndyYXBwZWRQYXJlbnQgPSB3cmFwcGVkUGFyZW50O1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICB0aGlzLnJhd0l0ZW0gPSByYXdJdGVtO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgc3VwZXIoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdzb3VyY2VUYXJnZXQnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIHNvdXJjZTogdGhpcy5yYXdJdGVtLmxlZnQsXG4gICAgICAgIHRhcmdldDogdGhpcy5yYXdJdGVtLnJpZ2h0XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdlZGdlVGFyZ2V0Jykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBlZGdlOiB0aGlzLnJhd0l0ZW0ubGVmdCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLnJhd0l0ZW0ucmlnaHRcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ3NvdXJjZUVkZ2UnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIHNvdXJjZTogdGhpcy5yYXdJdGVtLnJpZ2h0LFxuICAgICAgICBlZGdlOiB0aGlzLnJhd0l0ZW0ubGVmdFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnZnVsbCcpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgc291cmNlOiB0aGlzLnJhd0l0ZW0ubGVmdC5yaWdodCxcbiAgICAgICAgZWRnZTogdGhpcy5yYXdJdGVtLmxlZnQubGVmdCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLnJhd0l0ZW0ucmlnaHRcbiAgICAgIH07XG4gICAgfVxuICAgIC8vIGlmIHRoZXJlIGlzIG5vIGVkZ2VSb2xlLCBsZWF2ZSB0aGUgcmF3SXRlbSBhcy1pc1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiY2xhc3MgSW5NZW1vcnlJbmRleCB7XG4gIGNvbnN0cnVjdG9yICh7IGVudHJpZXMgPSB7fSwgY29tcGxldGUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICAgIHRoaXMuY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcztcbiAgfVxuICBhc3luYyAqIGl0ZXJFbnRyaWVzICgpIHtcbiAgICBmb3IgKGNvbnN0IFtoYXNoLCB2YWx1ZUxpc3RdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHsgaGFzaCwgdmFsdWVMaXN0IH07XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlckhhc2hlcyAoKSB7XG4gICAgZm9yIChjb25zdCBoYXNoIG9mIE9iamVjdC5rZXlzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIGhhc2g7XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlclZhbHVlTGlzdHMgKCkge1xuICAgIGZvciAoY29uc3QgdmFsdWVMaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgdmFsdWVMaXN0O1xuICAgIH1cbiAgfVxuICBhc3luYyBnZXRWYWx1ZUxpc3QgKGhhc2gpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzW2hhc2hdIHx8IFtdO1xuICB9XG4gIGFzeW5jIGFkZFZhbHVlIChoYXNoLCB2YWx1ZSkge1xuICAgIC8vIFRPRE86IGFkZCBzb21lIGtpbmQgb2Ygd2FybmluZyBpZiB0aGlzIGlzIGdldHRpbmcgYmlnP1xuICAgIHRoaXMuZW50cmllc1toYXNoXSA9IGF3YWl0IHRoaXMuZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgIGlmICh0aGlzLmVudHJpZXNbaGFzaF0uaW5kZXhPZih2YWx1ZSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbk1lbW9yeUluZGV4O1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4vU3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIFRPS0VOUyBmcm9tICcuL1Rva2Vucy9Ub2tlbnMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcbmltcG9ydCAqIGFzIElOREVYRVMgZnJvbSAnLi9JbmRleGVzL0luZGV4ZXMuanMnO1xuXG5sZXQgTkVYVF9DTEFTU19JRCA9IDE7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBtdXJlLmRlYnVnIHRvIHRydWUgdG8gZGVidWcgc3RyZWFtc1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UT0tFTlMgPSBUT0tFTlM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIE1vbmtleS1wYXRjaCBhdmFpbGFibGUgdG9rZW5zIGFzIGZ1bmN0aW9ucyBvbnRvIHRoZSBTdHJlYW0gY2xhc3NcbiAgICBmb3IgKGNvbnN0IHRva2VuQ2xhc3NOYW1lIGluIHRoaXMuVE9LRU5TKSB7XG4gICAgICBjb25zdCBUb2tlbkNsYXNzID0gdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdO1xuICAgICAgU3RyZWFtLnByb3RvdHlwZVtUb2tlbkNsYXNzLmxvd2VyQ2FtZWxDYXNlVHlwZV0gPSBmdW5jdGlvbiAoYXJnTGlzdCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5leHRlbmQoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIHtcbiAgICAgICAgICBsZWZ0OiB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICByaWdodDogb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMucm9vdCA9IHRoaXMubG9hZFJvb3QoKTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMubG9hZENsYXNzZXMoKTtcbiAgfVxuXG4gIGxvYWRSb290ICgpIHtcbiAgICBsZXQgcm9vdCA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ211cmVfcm9vdCcpO1xuICAgIHJvb3QgPSByb290ID8gSlNPTi5wYXJzZShyb290KSA6IHt9O1xuICAgIHJldHVybiByb290O1xuICB9XG4gIHNhdmVSb290ICgpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ211cmVfcm9vdCcsIEpTT04uc3RyaW5naWZ5KHRoaXMucm9vdCkpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jvb3RVcGRhdGUnKTtcbiAgfVxuICBsb2FkQ2xhc3NlcyAoKSB7XG4gICAgbGV0IGNsYXNzZXMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX2NsYXNzZXMnKTtcbiAgICBjbGFzc2VzID0gY2xhc3NlcyA/IEpTT04ucGFyc2UoY2xhc3NlcykgOiB7fTtcbiAgICBPYmplY3QuZW50cmllcyhjbGFzc2VzKS5mb3JFYWNoKChbIGNsYXNzSWQsIHJhd0NsYXNzT2JqIF0pID0+IHtcbiAgICAgIGNvbnN0IGNsYXNzVHlwZSA9IHJhd0NsYXNzT2JqLmNsYXNzVHlwZTtcbiAgICAgIGRlbGV0ZSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICByYXdDbGFzc09iai5tdXJlID0gdGhpcztcbiAgICAgIGNsYXNzZXNbY2xhc3NJZF0gPSBuZXcgdGhpcy5DTEFTU0VTW2NsYXNzVHlwZV0ocmF3Q2xhc3NPYmopO1xuICAgIH0pO1xuICAgIHJldHVybiBjbGFzc2VzO1xuICB9XG4gIHNhdmVDbGFzc2VzICgpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJhd0NsYXNzZXMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgWyBjbGFzc0lkLCBjbGFzc09iaiBdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgICAgcmF3Q2xhc3Nlc1tjbGFzc0lkXSA9IGNsYXNzT2JqLnRvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX2NsYXNzZXMnLCBKU09OLnN0cmluZ2lmeShyYXdDbGFzc2VzKSk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcignY2xhc3NVcGRhdGUnKTtcbiAgfVxuXG4gIHBhcnNlU2VsZWN0b3IgKHNlbGVjdG9yU3RyaW5nKSB7XG4gICAgY29uc3Qgc3RhcnRzV2l0aFJvb3QgPSBzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdyb290Jyk7XG4gICAgaWYgKCEoc3RhcnRzV2l0aFJvb3QgfHwgc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgnZW1wdHknKSkpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgU2VsZWN0b3JzIG11c3Qgc3RhcnQgd2l0aCAncm9vdCcgb3IgJ2VtcHR5J2ApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3RvclN0cmluZy5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgaWYgKCF0b2tlblN0cmluZ3MpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCBzZWxlY3RvciBzdHJpbmc6ICR7c2VsZWN0b3JTdHJpbmd9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuQ2xhc3NMaXN0ID0gW3tcbiAgICAgIFRva2VuQ2xhc3M6IHN0YXJ0c1dpdGhSb290ID8gdGhpcy5UT0tFTlMuUm9vdFRva2VuIDogdGhpcy5UT0tFTlMuRW1wdHlUb2tlblxuICAgIH1dO1xuICAgIHRva2VuU3RyaW5ncy5mb3JFYWNoKGNodW5rID0+IHtcbiAgICAgIGNvbnN0IHRlbXAgPSBjaHVuay5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKCF0ZW1wKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCB0b2tlbjogJHtjaHVua31gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRva2VuQ2xhc3NOYW1lID0gdGVtcFsxXVswXS50b1VwcGVyQ2FzZSgpICsgdGVtcFsxXS5zbGljZSgxKSArICdUb2tlbic7XG4gICAgICBjb25zdCBhcmdMaXN0ID0gdGVtcFsyXS5zcGxpdCgvKD88IVxcXFwpLC8pLm1hcChkID0+IHtcbiAgICAgICAgZCA9IGQudHJpbSgpO1xuICAgICAgICByZXR1cm4gZCA9PT0gJycgPyB1bmRlZmluZWQgOiBkO1xuICAgICAgfSk7XG4gICAgICBpZiAodG9rZW5DbGFzc05hbWUgPT09ICdWYWx1ZXNUb2tlbicpIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuS2V5c1Rva2VuLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLlZhbHVlVG9rZW5cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSkge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biB0b2tlbjogJHt0ZW1wWzFdfWApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0b2tlbkNsYXNzTGlzdDtcbiAgfVxuXG4gIHN0cmVhbSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMucGFyc2VTZWxlY3RvcihvcHRpb25zLnNlbGVjdG9yIHx8IGByb290LnZhbHVlcygpYCk7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBuZXdDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGByb290YCB9KSB7XG4gICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIGNvbnN0IENsYXNzVHlwZSA9IG9wdGlvbnMuQ2xhc3NUeXBlIHx8IHRoaXMuQ0xBU1NFUy5HZW5lcmljQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuQ2xhc3NUeXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ2xhc3NUeXBlKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNEYXRhU291cmNlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlKHtcbiAgICAgIGtleTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGtleSxcbiAgICBleHRlbnNpb24gPSAndHh0JyxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICBsZXQgb2JqO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBvYmogPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGRlbGV0ZSBvYmouY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNEYXRhU291cmNlKGtleSwgb2JqKTtcbiAgfVxuICBhZGRTdGF0aWNEYXRhU291cmNlIChrZXksIG9iaikge1xuICAgIHRoaXMucm9vdFtrZXldID0gb2JqO1xuICAgIHRoaXMuc2F2ZVJvb3QoKTtcbiAgICByZXR1cm4gdGhpcy5uZXdDbGFzcyh7XG4gICAgICBzZWxlY3RvcjogYHJvb3QudmFsdWVzKCcke2tleX0nKS52YWx1ZXMoKWBcbiAgICB9KTtcbiAgfVxuICByZW1vdmVEYXRhU291cmNlIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5yb290W2tleV07XG4gICAgdGhpcy5zYXZlUm9vdCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IEZpbGVSZWFkZXIgZnJvbSAnZmlsZXJlYWRlcic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUoRmlsZVJlYWRlciwgbnVsbCk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJvZmYiLCJpbmRleCIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiZm9yRWFjaCIsInNldFRpbWVvdXQiLCJhcHBseSIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsIk9iamVjdCIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiU3RyZWFtIiwib3B0aW9ucyIsIm11cmUiLCJuYW1lZEZ1bmN0aW9ucyIsIk5BTUVEX0ZVTkNUSU9OUyIsIm5hbWVkU3RyZWFtcyIsImxhdW5jaGVkRnJvbUNsYXNzIiwidG9rZW5DbGFzc0xpc3QiLCJ0b2tlbkxpc3QiLCJtYXAiLCJUb2tlbkNsYXNzIiwiYXJnTGlzdCIsIldyYXBwZXJzIiwiZ2V0V3JhcHBlckxpc3QiLCJpbmRleGVzIiwidG9rZW4iLCJsZW5ndGgiLCJXcmFwcGVyIiwibG9jYWxUb2tlbkxpc3QiLCJzbGljZSIsInBvdGVudGlhbFdyYXBwZXJzIiwidmFsdWVzIiwiY2xhc3NlcyIsImZpbHRlciIsImNsYXNzT2JqIiwiY2xhc3NUb2tlbkxpc3QiLCJldmVyeSIsImxvY2FsVG9rZW4iLCJsb2NhbEluZGV4IiwidG9rZW5DbGFzc1NwZWMiLCJpc1N1YnNldE9mIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsImNvbnNvbGUiLCJ3YXJuIiwic2VsZWN0b3IiLCJqb2luIiwiZm9yayIsInBhcnNlU2VsZWN0b3IiLCJleHRlbmQiLCJjb25jYXQiLCJ3cmFwIiwid3JhcHBlZFBhcmVudCIsInJhd0l0ZW0iLCJoYXNoZXMiLCJ3cmFwcGVySW5kZXgiLCJ0ZW1wIiwid3JhcHBlZEl0ZW0iLCJnZXRJbmRleCIsImhhc2hGdW5jdGlvbk5hbWUiLCJ0b2tlbkluZGV4IiwiSU5ERVhFUyIsIkluTWVtb3J5SW5kZXgiLCJpdGVyYXRlIiwibGFzdFRva2VuIiwic2FtcGxlIiwibGltaXQiLCJyZWJ1aWxkSW5kZXhlcyIsIml0ZXJhdG9yIiwibmV4dCIsImRvbmUiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkJhc2VUb2tlbiIsInN0cmVhbSIsInRvU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJpc1N1YlNldE9mIiwiYW5jZXN0b3JUb2tlbnMiLCJFcnJvciIsIml0ZXJhdGVQYXJlbnQiLCJwYXJlbnRUb2tlbiIsInlpZWxkZWRTb21ldGhpbmciLCJkZWJ1ZyIsIlR5cGVFcnJvciIsImV4ZWMiLCJuYW1lIiwiRW1wdHlUb2tlbiIsIlJvb3RUb2tlbiIsInJvb3QiLCJLZXlzVG9rZW4iLCJtYXRjaEFsbCIsImtleXMiLCJyYW5nZXMiLCJ1bmRlZmluZWQiLCJhcmciLCJtYXRjaCIsIkluZmluaXR5IiwiZCIsInBhcnNlSW50IiwiaXNOYU4iLCJsb3ciLCJoaWdoIiwibnVtIiwiTnVtYmVyIiwiU3ludGF4RXJyb3IiLCJKU09OIiwic3RyaW5naWZ5IiwiY29uc29saWRhdGVSYW5nZXMiLCJzZWxlY3RzTm90aGluZyIsIm5ld1JhbmdlcyIsInNvcnQiLCJhIiwiYiIsImN1cnJlbnRSYW5nZSIsImRpZmZlcmVuY2UiLCJvdGhlclRva2VuIiwibmV3S2V5cyIsImtleSIsImFsbFBvaW50cyIsInJlZHVjZSIsImFnZyIsInJhbmdlIiwiaW5jbHVkZSIsImV4Y2x1ZGUiLCJkaWZmIiwiTWF0aCIsIm1heCIsIm1pbiIsImhhc093blByb3BlcnR5IiwiVmFsdWVUb2tlbiIsIm9iaiIsImtleVR5cGUiLCJFdmFsdWF0ZVRva2VuIiwibmV3U3RyZWFtIiwiZXJyIiwiTWFwVG9rZW4iLCJnZW5lcmF0b3IiLCJtYXBwZWRSYXdJdGVtIiwiSW5kZXhlZFRva2VuIiwiaGFzaEZ1bmNOYW1lIiwiaGFzaCIsImVudHJpZXMiLCJhZGRWYWx1ZSIsIlByb21vdGVUb2tlbiIsInJlZHVjZUluc3RhbmNlcyIsImZ1bmMiLCJtYXBGdW5jdGlvbiIsImhhc2hGdW5jdGlvbiIsInJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uIiwiaGFzaEluZGV4Iiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsImdldFZhbHVlTGlzdCIsIkpvaW5Ub2tlbiIsIm90aGVyU3RyZWFtIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJmaW5pc2giLCJlZGdlUm9sZSIsImhhc2hUaGlzR3JhbmRwYXJlbnQiLCJ0aGlzSGFzaEZ1bmN0aW9uIiwib3RoZXJIYXNoRnVuY3Rpb24iLCJmaW5pc2hGdW5jdGlvbiIsInRoaXNJbmRleCIsIm90aGVySW5kZXgiLCJjb21wbGV0ZSIsInZhbHVlTGlzdCIsIml0ZXJFbnRyaWVzIiwib3RoZXJMaXN0Iiwib3RoZXJXcmFwcGVkSXRlbSIsInRoaXNXcmFwcGVkSXRlbSIsInRoaXNMaXN0IiwidGhpc0hhc2hJdGVtIiwidGhpc0l0ZXJhdG9yIiwidGhpc0luZGlyZWN0S2V5IiwidGhpc0lzRG9uZSIsIm90aGVySXRlcmF0b3IiLCJvdGhlcklzRG9uZSIsIkFTVEVSSVNLUyIsIkdlbmVyaWNDbGFzcyIsImNsYXNzSWQiLCJfc2VsZWN0b3IiLCJjdXN0b21DbGFzc05hbWUiLCJjdXN0b21OYW1lVG9rZW5JbmRleCIsImZ1bmNOYW1lIiwiRnVuY3Rpb24iLCJ0b1Jhd09iamVjdCIsInJlc3VsdCIsImNsYXNzVHlwZSIsInN0cmluZ2lmaWVkRnVuYyIsInNldENsYXNzTmFtZSIsInNhdmVDbGFzc2VzIiwiaGFzQ3VzdG9tTmFtZSIsImNsYXNzTmFtZSIsInRva2VuU3RyaW5ncyIsInN0YXJ0c1dpdGgiLCJhZGRIYXNoRnVuY3Rpb24iLCJwb3B1bGF0ZVN0cmVhbU9wdGlvbnMiLCJnZXRTdHJlYW0iLCJyZXNldCIsIl9zdHJlYW0iLCJpc1N1cGVyU2V0T2ZUb2tlbkxpc3QiLCJpc1N1cGVyU2V0T2YiLCJpbnRlcnByZXRBc05vZGVzIiwiQ0xBU1NFUyIsIk5vZGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJFZGdlQ2xhc3MiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJzcGxpdCIsImRlbGV0ZSIsIk5vZGVXcmFwcGVyIiwiZWRnZUNvbm5lY3Rpb25zIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJkaXJlY3RlZCIsInRoaXNIYXNoTmFtZSIsIm90aGVySGFzaE5hbWUiLCJlZGdlQ2xhc3MiLCJuZXdDbGFzcyIsIkNsYXNzVHlwZSIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwibm9kZUhhc2hOYW1lIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibm9kZUNsYXNzIiwiZWRnZUNsYXNzSWQiLCJFZGdlV3JhcHBlciIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJzb3VyY2VIYXNoIiwidGFyZ2V0SGFzaCIsImVkZ2VIYXNoTmFtZSIsInRhcmdldCIsInNvdXJjZSIsImRpcmVjdGlvbiIsInRvZ2dsZU5vZGVEaXJlY3Rpb24iLCJsZWZ0IiwicmlnaHQiLCJlZGdlIiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiTkVYVF9DTEFTU19JRCIsIk11cmUiLCJGaWxlUmVhZGVyIiwibG9jYWxTdG9yYWdlIiwibWltZSIsIkRBVEFMSUJfRk9STUFUUyIsIlRPS0VOUyIsInRva2VuQ2xhc3NOYW1lIiwicHJvdG90eXBlIiwiaWRlbnRpdHkiLCJwYXJlbnRUeXBlIiwiZGVmYXVsdEZpbmlzaCIsInNoYTEiLCJub29wIiwibG9hZFJvb3QiLCJsb2FkQ2xhc3NlcyIsImdldEl0ZW0iLCJwYXJzZSIsInNhdmVSb290Iiwic2V0SXRlbSIsInJhd0NsYXNzT2JqIiwicmF3Q2xhc3NlcyIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aFJvb3QiLCJjaHVuayIsInRvVXBwZXJDYXNlIiwidHJpbSIsImFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UiLCJmaWxlT2JqIiwiZW5jb2RpbmciLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsInRleHQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNEYXRhU291cmNlIiwicmVtb3ZlRGF0YVNvdXJjZSIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QkMsdUJBQXZCLEVBQWdEO1VBQzVDLENBQUMsS0FBS0wsYUFBTCxDQUFtQkcsU0FBbkIsQ0FBTCxFQUFvQzthQUM3QkgsYUFBTCxDQUFtQkcsU0FBbkIsSUFBZ0MsRUFBaEM7OztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtMLGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsTUFB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
