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
    this._mure = options.mure;
    this.namedFunctions = Object.assign({}, this._mure.NAMED_FUNCTIONS, options.namedFunctions || {});
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
      const potentialWrappers = Object.values(this._mure.classes).filter(classObj => {
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
        return this._mure.WRAPPERS.GenericWrapper;
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
      mure: this._mure,
      namedFunctions: this.namedFunctions,
      namedStreams: this.namedStreams,
      tokenClassList: this._mure.parseSelector(selector),
      launchedFromClass: this.launchedFromClass
    });
  }

  extend(TokenClass, argList, options = {}) {
    options.mure = this._mure;
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
      this.indexes[hashFunctionName][tokenIndex] = new this._mure.INDEXES.InMemoryIndex();
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

      return new KeysToken(this._mure, null, {
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
    this._mure = options.mure;
    this.classId = options.classId;
    this._selector = options.selector;
    this.customClassName = options.customClassName || null;
    this.customNameTokenIndex = options.customNameTokenIndex || null;
    this.annotations = options.annotations || [];
    this.Wrapper = this._mure.WRAPPERS.GenericWrapper;
    this.namedFunctions = Object.assign({}, this._mure.NAMED_FUNCTIONS, options.namedFunctions || {});

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
    return this._mure.parseSelector(this.selector);
  }

  toRawObject() {
    const result = {
      classType: this.constructor.name,
      selector: this._selector,
      customClassName: this.customClassName,
      customNameTokenIndex: this.customNameTokenIndex,
      annotations: this.annotations,
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
      this._mure.saveClasses();
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

  addAttributeAsHashFunction(attrName) {
    this.namedFunctions[attrName] = function* (wrappedItem) {
      yield wrappedItem.rawItem[attrName];
    };
  }

  expandAttributeAsHashFunction(attrName, delimiter = ',') {
    this.namedFunctions[attrName] = function* (wrappedItem) {
      for (const value of wrappedItem.rawItem.split(delimiter)) {
        yield value.trim();
      }
    };
  }

  populateStreamOptions(options = {}) {
    options.mure = this._mure;
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
    options.ClassType = this._mure.CLASSES.NodeClass;
    return this._mure.newClass(options);
  }

  interpretAsEdges() {
    const options = this.toRawObject();
    options.ClassType = this._mure.CLASSES.EdgeClass;
    return this._mure.newClass(options);
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
    delete this._mure.classes[this.classId];
    this._mure.saveClasses();
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
    this.Wrapper = this._mure.WRAPPERS.NodeWrapper;
    this.edgeClassIds = options.edgeClassIds || {};
  }

  toRawObject() {
    const result = super.toRawObject();
    result.edgeClassIds = this.edgeClassIds;
    return result;
  }

  interpretAsNodes() {
    return this;
  }

  interpretAsEdges() {
    throw new Error(`unimplemented`);
    /*
    const edgeIds = Object.keys(this.edgeClassIds);
    if (edgeIds.length > 2) {
      this.disconnectAllEdges();
    }
    const options = super.toRawObject();
    options.ClassType = this._mure.CLASSES.EdgeClass;
    const newEdgeClass = this._mure.createClass(options);
    if (edgeIds.length === 1 || edgeIds.length === 2) {
      const sourceEdgeClass = this._mure.classes[edgeIds[0]];
      newEdgeClass.sourceClassId = sourceEdgeClass.sourceClassId;
      newEdgeClass.sourceChain = sourceEdgeClass.
      newEdgeClass.glompSourceEdge(this._mure.classes[edgeIds[0]]);
    }
    if (edgeIds.length === 2) {
      newEdgeClass.glompTargetEdge(this._mure.classes[edgeIds[1]]);
    }
    this._mure.saveClasses();
    */
  }

  connectToNodeClass({
    otherNodeClass,
    directed,
    thisHashName,
    otherHashName
  }) {
    const newEdge = this._mure.createClass({
      selector: null,
      ClassType: this._mure.CLASSES.EdgeClass,
      sourceClassId: this.classId,
      sourceChain: {
        nodeHash: thisHashName,
        edgeHash: null
      },
      targetClassId: otherNodeClass.classId,
      targetHashName: {
        nodeHash: otherHashName,
        edgeHash: null
      },
      directed
    });
    this.edgeClassIds[newEdge.classId] = true;
    otherNodeClass.edgeClassIds[newEdge.classId] = true;
    this._mure.saveClasses();
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }

  disconnectAllEdges() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      const edgeClass = this._mure.classes[edgeClassId];

      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSources();
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTargets();
      }

      delete this.edgeClassIds[edgeClassId];
    }
  }

  delete() {
    this.disconnectAllEdges();
    super.delete();
  }

}

class Chain {
  constructor({
    nodeHash = null,
    edgeHash = null,
    intermediates = []
  } = {}) {
    this.nodeHash = nodeHash;
    this.edgeHash = edgeHash;
    this.intermediates = intermediates;
  }

  toRawObject() {
    return {
      nodeHash: this.nodeHash,
      edgeHash: this.edgeHash,
      intermediates: this.intermediates
    };
  }

  split() {
    throw new Error(`unimplemented`); // return [ edgewardChain, nodewardChain ]
  }

}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this._mure.WRAPPERS.EdgeWrapper;
    this.sourceClassId = options.sourceClassId || null;
    this.sourceChain = new Chain(options.sourceChain);
    this.targetClassId = options.targetClassId || null;
    this.targetChain = new Chain(options.targetChain);
    this.directed = options.directed || false;
  }

  toRawObject() {
    const result = super.toRawObject();
    result.sourceClassId = this.sourceClassId;
    result.sourceChain = this.sourceChain.toRawObject;
    result.targetClassId = this.targetClassId;
    result.targetChain = this.targetChain.toRawObject;
    result.directed = this.directed;
    return result;
  }

  get selector() {
    // TODO!
    return this._selector;
    /*
    const sourceClass = this._mure.classes[this.sourceClassId];
    const targetClass = this._mure.classes[this.targetClassId];
     if (!this._selector) {
      if (!sourceClass || !targetClass) {
        throw new Error(`Partial connections without an edge table should never happen`);
      } else {
        // No edge table (simple join between two nodes)
        const sourceHash = sourceClass.edgeClassIds[this.classId].nodeHashName;
        const targetHash = targetClass.edgeClassIds[this.classId].nodeHashName;
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
          const { edgeHashName, nodeHashName } = targetClass.edgeClassIds[this.classId];
          return result + `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, edgeTarget)`;
        }
      } else if (!targetClass) {
        // Partial source-edge connections
        const { nodeHashName, edgeHashName } = sourceClass.edgeClassIds[this.classId];
        return result + `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish, sourceEdge)`;
      } else {
        // Full connections
        let { nodeHashName, edgeHashName } = sourceClass.edgeClassIds[this.classId];
        result += `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        ({ edgeHashName, nodeHashName } = targetClass.edgeClassIds[this.classId]);
        result += `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, full)`;
        return result;
      }
    }
    */
  }

  populateStreamOptions(options = {}) {
    const sourceClass = this._mure.classes[this.sourceClassId];
    const targetClass = this._mure.classes[this.targetClassId];
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

  interpretAsNodes() {
    const options = super.toRawObject();
    options.ClassType = this._mure.CLASSES.NodeClass;
    const newNodeClass = this._mure.createClass(options);

    if (this.sourceClassId) {
      const sourceNodeClass = this._mure.classes[this.sourceClassId];
      let [targetChain, sourceChain] = this.sourceChain.split();
      const newSourceEdgeClass = this._mure.createClass({
        ClassType: this._mure.CLASSES.EdgeClass,
        sourceClassId: sourceNodeClass.classId,
        sourceChain: sourceChain.toRawObject(),
        targetClassId: newNodeClass.classId,
        targetChain: targetChain.toRawObject(),
        directed: this.directed
      });
      delete sourceNodeClass.edgeClassIds[newNodeClass.classId];
      sourceNodeClass.edgeClassIds[newSourceEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[newSourceEdgeClass.classId] = true;
    }

    if (this.targetClassId) {
      const targetNodeClass = this._mure.classes[this.targetClassId];
      let [sourceChain, targetChain] = this.targetChain.split();
      const newTargetEdgeClass = this._mure.createClass({
        ClassType: this._mure.CLASSES.EdgeClass,
        sourceClassId: targetNodeClass.classId,
        sourceChain: sourceChain.toRawObject(),
        targetClassId: newNodeClass.classId,
        targetChain: targetChain.toRawObject(),
        directed: this.directed
      });
      delete targetNodeClass.edgeClassIds[newNodeClass.classId];
      targetNodeClass.edgeClassIds[newTargetEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[newTargetEdgeClass.classId] = true;
    }

    this._mure.saveClasses();
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
        delete this._mure.classes[this.sourceClassId].edgeClassIds[this.classId];
      }

      this.sourceClassId = nodeClass.classId;
      this.sourceChain = new Chain({
        nodeHash: nodeHashName,
        edgeHash: edgeHashName
      });
    } else if (direction === 'target') {
      if (this.targetClassId) {
        delete this._mure.classes[this.targetClassId].edgeClassIds[this.classId];
      }

      this.targetClassId = nodeClass.classId;
      this.targetChain = new Chain({
        nodeHash: nodeHashName,
        edgeHash: edgeHashName
      });
    } else {
      if (!this.sourceClassId) {
        this.sourceClassId = nodeClass.classId;
        this.sourceChain = new Chain({
          nodeHash: nodeHashName,
          edgeHash: edgeHashName
        });
      } else if (!this.targetClassId) {
        this.targetClassId = nodeClass.classId;
        this.targetChain = new Chain({
          nodeHash: nodeHashName,
          edgeHash: edgeHashName
        });
      } else {
        throw new Error(`Source and target are already defined; please specify a direction to override`);
      }
    }

    this._mure.saveClasses();
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
        const temp = this.sourceChain;
        this.sourceChain = this.targetChain;
        this.targetChain = temp;
      }
    }

    this._mure.saveClasses();
  }

  disconnectSources() {
    this.sourceClassId = null;
    this.sourceChain = new Chain();
  }

  disconnectTargets() {
    this.targetClassId = null;
    this.targetChain = new Chain();
  }

  delete() {
    if (this.sourceClassId) {
      delete this._mure.classes[this.sourceClassId].edgeClassIds[this.classId];
    }

    if (this.targetClassId) {
      delete this._mure.classes[this.targetClassId].edgeClassIds[this.classId];
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

  getRawClasses() {
    const rawClasses = {};

    for (const [classId, classObj] of Object.entries(this.classes)) {
      rawClasses[classId] = classObj.toRawObject();
    }

    return rawClasses;
  }

  saveClasses() {
    if (this.localStorage) {
      this.localStorage.setItem('mure_classes', JSON.stringify(this.getRawClasses()));
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

  createClass(options = {
    selector: `empty`
  }) {
    if (!options.classId) {
      options.classId = `class${NEXT_CLASS_ID}`;
      NEXT_CLASS_ID += 1;
    }

    const ClassType = options.ClassType || this.CLASSES.GenericClass;
    delete options.ClassType;
    options.mure = this;
    this.classes[options.classId] = new ClassType(options);
    return this.classes[options.classId];
  }

  newClass(options) {
    const newClassObj = this.createClass(options);
    this.saveClasses();
    return newClassObj;
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
var version = "0.4.10";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvSW5kZXhlZFRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Qcm9tb3RlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0pvaW5Ub2tlbi5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0NoYWluLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0luZGV4ZXMvSW5NZW1vcnlJbmRleC5qcyIsIi4uL3NyYy9NdXJlLmpzIiwiLi4vc3JjL21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAoIXRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKSAhPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudE5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgU3RyZWFtIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICB0aGlzLm11cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sXG4gICAgICB0aGlzLm11cmUuTkFNRURfRlVOQ1RJT05TLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICB0aGlzLm5hbWVkU3RyZWFtcyA9IG9wdGlvbnMubmFtZWRTdHJlYW1zIHx8IHt9O1xuICAgIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MgPSBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzIHx8IG51bGw7XG4gICAgdGhpcy50b2tlbkNsYXNzTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgfHwgW107XG5cbiAgICAvLyBSZW1pbmRlcjogdGhpcyBhbHdheXMgbmVlZHMgdG8gYmUgYWZ0ZXIgaW5pdGlhbGl6aW5nIHRoaXMubmFtZWRGdW5jdGlvbnNcbiAgICAvLyBhbmQgdGhpcy5uYW1lZFN0cmVhbXNcbiAgICB0aGlzLnRva2VuTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QubWFwKCh7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBUb2tlbkNsYXNzKHRoaXMsIGFyZ0xpc3QpO1xuICAgIH0pO1xuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy50b2tlbkxpc3RcbiAgICB0aGlzLldyYXBwZXJzID0gdGhpcy5nZXRXcmFwcGVyTGlzdCgpO1xuXG4gICAgLy8gVE9ETzogcHJlc2VydmUgdGhlc2Ugc29tZWhvdz9cbiAgICB0aGlzLmluZGV4ZXMgPSB7fTtcbiAgfVxuXG4gIGdldFdyYXBwZXJMaXN0ICgpIHtcbiAgICAvLyBMb29rIHVwIHdoaWNoLCBpZiBhbnksIGNsYXNzZXMgZGVzY3JpYmUgdGhlIHJlc3VsdCBvZiBlYWNoIHRva2VuLCBzbyB0aGF0XG4gICAgLy8gd2UgY2FuIHdyYXAgaXRlbXMgYXBwcm9wcmlhdGVseTpcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QubWFwKCh0b2tlbiwgaW5kZXgpID0+IHtcbiAgICAgIGlmIChpbmRleCA9PT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSAmJiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzKSB7XG4gICAgICAgIC8vIElmIHRoaXMgc3RyZWFtIHdhcyBzdGFydGVkIGZyb20gYSBjbGFzcywgd2UgYWxyZWFkeSBrbm93IHdlIHNob3VsZFxuICAgICAgICAvLyB1c2UgdGhhdCBjbGFzcydzIHdyYXBwZXIgZm9yIHRoZSBsYXN0IHRva2VuXG4gICAgICAgIHJldHVybiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzLldyYXBwZXI7XG4gICAgICB9XG4gICAgICAvLyBGaW5kIGEgY2xhc3MgdGhhdCBkZXNjcmliZXMgZXhhY3RseSBlYWNoIHNlcmllcyBvZiB0b2tlbnNcbiAgICAgIGNvbnN0IGxvY2FsVG9rZW5MaXN0ID0gdGhpcy50b2tlbkxpc3Quc2xpY2UoMCwgaW5kZXggKyAxKTtcbiAgICAgIGNvbnN0IHBvdGVudGlhbFdyYXBwZXJzID0gT2JqZWN0LnZhbHVlcyh0aGlzLm11cmUuY2xhc3NlcylcbiAgICAgICAgLmZpbHRlcihjbGFzc09iaiA9PiB7XG4gICAgICAgICAgY29uc3QgY2xhc3NUb2tlbkxpc3QgPSBjbGFzc09iai50b2tlbkNsYXNzTGlzdDtcbiAgICAgICAgICBpZiAoIWNsYXNzVG9rZW5MaXN0Lmxlbmd0aCAhPT0gbG9jYWxUb2tlbkxpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuTGlzdC5ldmVyeSgobG9jYWxUb2tlbiwgbG9jYWxJbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdG9rZW5DbGFzc1NwZWMgPSBjbGFzc1Rva2VuTGlzdFtsb2NhbEluZGV4XTtcbiAgICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuIGluc3RhbmNlb2YgdG9rZW5DbGFzc1NwZWMuVG9rZW5DbGFzcyAmJlxuICAgICAgICAgICAgICB0b2tlbi5pc1N1YnNldE9mKHRva2VuQ2xhc3NTcGVjLmFyZ0xpc3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gTm8gY2xhc3NlcyBkZXNjcmliZSB0aGlzIHNlcmllcyBvZiB0b2tlbnMsIHNvIHVzZSB0aGUgZ2VuZXJpYyB3cmFwcGVyXG4gICAgICAgIHJldHVybiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgTXVsdGlwbGUgY2xhc3NlcyBkZXNjcmliZSB0aGUgc2FtZSBpdGVtISBBcmJpdHJhcmlseSBjaG9vc2luZyBvbmUuLi5gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcG90ZW50aWFsV3JhcHBlcnNbMF0uV3JhcHBlcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmpvaW4oJycpO1xuICB9XG5cbiAgZm9yayAoc2VsZWN0b3IpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICBuYW1lZEZ1bmN0aW9uczogdGhpcy5uYW1lZEZ1bmN0aW9ucyxcbiAgICAgIG5hbWVkU3RyZWFtczogdGhpcy5uYW1lZFN0cmVhbXMsXG4gICAgICB0b2tlbkNsYXNzTGlzdDogdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3Ioc2VsZWN0b3IpLFxuICAgICAgbGF1bmNoZWRGcm9tQ2xhc3M6IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3NcbiAgICB9KTtcbiAgfVxuXG4gIGV4dGVuZCAoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkRnVuY3Rpb25zLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBvcHRpb25zLm5hbWVkU3RyZWFtcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRTdHJlYW1zLCBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fSk7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMudG9rZW5DbGFzc0xpc3QuY29uY2F0KFt7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfV0pO1xuICAgIG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgPSBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzIHx8IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3M7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtLCBoYXNoZXMgPSB7fSB9KSB7XG4gICAgbGV0IHdyYXBwZXJJbmRleCA9IDA7XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB3cmFwcGVySW5kZXggKz0gMTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gbmV3IHRoaXMuV3JhcHBlcnNbd3JhcHBlckluZGV4XSh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuXG4gIGdldEluZGV4IChoYXNoRnVuY3Rpb25OYW1lLCB0b2tlbikge1xuICAgIGlmICghdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdKSB7XG4gICAgICB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV0gPSB7fTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5JbmRleCA9IHRoaXMudG9rZW5MaXN0LmluZGV4T2YodG9rZW4pO1xuICAgIGlmICghdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdW3Rva2VuSW5kZXhdKSB7XG4gICAgICAvLyBUT0RPOiBmaWd1cmUgb3V0IGV4dGVybmFsIGluZGV4ZXMuLi5cbiAgICAgIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXVt0b2tlbkluZGV4XSA9IG5ldyB0aGlzLm11cmUuSU5ERVhFUy5Jbk1lbW9yeUluZGV4KCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV1bdG9rZW5JbmRleF07XG4gIH1cblxuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIGNvbnN0IGxhc3RUb2tlbiA9IHRoaXMudG9rZW5MaXN0W3RoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxKTtcbiAgICB5aWVsZCAqIGF3YWl0IGxhc3RUb2tlbi5pdGVyYXRlKHRlbXApO1xuICB9XG5cbiAgYXN5bmMgKiBzYW1wbGUgKHsgbGltaXQgPSAxMCwgcmVidWlsZEluZGV4ZXMgPSBmYWxzZSB9KSB7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGUoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbTtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBCYXNlVG9rZW4gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICAvLyBUaGUgc3RyaW5nIHZlcnNpb24gb2YgbW9zdCB0b2tlbnMgY2FuIGp1c3QgYmUgZGVyaXZlZCBmcm9tIHRoZSBjbGFzcyB0eXBlXG4gICAgcmV0dXJuIGAuJHt0aGlzLnR5cGUudG9Mb3dlckNhc2UoKX0oKWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoKSB7XG4gICAgLy8gQnkgZGVmYXVsdCAod2l0aG91dCBhbnkgYXJndW1lbnRzKSwgdG9rZW5zIG9mIHRoZSBzYW1lIGNsYXNzIGFyZSBzdWJzZXRzXG4gICAgLy8gb2YgZWFjaCBvdGhlclxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVQYXJlbnQgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3QgcGFyZW50VG9rZW4gPSBhbmNlc3RvclRva2Vuc1thbmNlc3RvclRva2Vucy5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0ZW1wID0gYW5jZXN0b3JUb2tlbnMuc2xpY2UoMCwgYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMSk7XG4gICAgbGV0IHlpZWxkZWRTb21ldGhpbmcgPSBmYWxzZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VG9rZW4uaXRlcmF0ZSh0ZW1wKSkge1xuICAgICAgeWllbGRlZFNvbWV0aGluZyA9IHRydWU7XG4gICAgICB5aWVsZCB3cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBpZiAoIXlpZWxkZWRTb21ldGhpbmcgJiYgdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVG9rZW4geWllbGRlZCBubyByZXN1bHRzOiAke3BhcmVudFRva2VufWApO1xuICAgIH1cbiAgfVxuICBhc3luYyB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHJhd0l0ZW0gfSkge1xuICAgIC8vIEluZGV4ZWRUb2tlbiBvdmVycmlkZXMgd2l0aCBhbiBhc3luYyBmdW5jdGlvblxuICAgIHJldHVybiB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW1cbiAgICB9KTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRW1wdHlUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgLy8geWllbGQgbm90aGluZ1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYGVtcHR5YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRW1wdHlUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBSb290VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICB3cmFwcGVkUGFyZW50OiBudWxsLFxuICAgICAgcmF3SXRlbTogdGhpcy5zdHJlYW0ubXVyZS5yb290XG4gICAgfSk7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgcm9vdGA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFJvb3RUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBLZXlzVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBhcmdMaXN0LCB7IG1hdGNoQWxsLCBrZXlzLCByYW5nZXMgfSA9IHt9KSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoa2V5cyB8fCByYW5nZXMpIHtcbiAgICAgIHRoaXMua2V5cyA9IGtleXM7XG4gICAgICB0aGlzLnJhbmdlcyA9IHJhbmdlcztcbiAgICB9IGVsc2UgaWYgKChhcmdMaXN0ICYmIGFyZ0xpc3QubGVuZ3RoID09PSAxICYmIGFyZ0xpc3RbMF0gPT09IHVuZGVmaW5lZCkgfHwgbWF0Y2hBbGwpIHtcbiAgICAgIHRoaXMubWF0Y2hBbGwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdMaXN0LmZvckVhY2goYXJnID0+IHtcbiAgICAgICAgbGV0IHRlbXAgPSBhcmcubWF0Y2goLyhcXGQrKS0oW1xcZOKInl0rKS8pO1xuICAgICAgICBpZiAodGVtcCAmJiB0ZW1wWzJdID09PSAn4oieJykge1xuICAgICAgICAgIHRlbXBbMl0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gdGVtcCA/IHRlbXAubWFwKGQgPT4gZC5wYXJzZUludChkKSkgOiBudWxsO1xuICAgICAgICBpZiAodGVtcCAmJiAhaXNOYU4odGVtcFsxXSkgJiYgIWlzTmFOKHRlbXBbMl0pKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IHRlbXBbMV07IGkgPD0gdGVtcFsyXTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogdGVtcFsxXSwgaGlnaDogdGVtcFsyXSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSBhcmcubWF0Y2goLycoLiopJy8pO1xuICAgICAgICB0ZW1wID0gdGVtcCAmJiB0ZW1wWzFdID8gdGVtcFsxXSA6IGFyZztcbiAgICAgICAgbGV0IG51bSA9IE51bWJlcih0ZW1wKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bSkgfHwgbnVtICE9PSBwYXJzZUludCh0ZW1wKSkgeyAvLyBsZWF2ZSBub24taW50ZWdlciBudW1iZXJzIGFzIHN0cmluZ3NcbiAgICAgICAgICB0aGlzLmtleXMgPSB0aGlzLmtleXMgfHwge307XG4gICAgICAgICAgdGhpcy5rZXlzW3RlbXBdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IG51bSwgaGlnaDogbnVtIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGlmICghdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEJhZCB0b2tlbiBrZXkocykgLyByYW5nZShzKTogJHtKU09OLnN0cmluZ2lmeShhcmdMaXN0KX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICB0aGlzLnJhbmdlcyA9IHRoaXMuY29uc29saWRhdGVSYW5nZXModGhpcy5yYW5nZXMpO1xuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0c05vdGhpbmcgKCkge1xuICAgIHJldHVybiAhdGhpcy5tYXRjaEFsbCAmJiAhdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcztcbiAgfVxuICBjb25zb2xpZGF0ZVJhbmdlcyAocmFuZ2VzKSB7XG4gICAgLy8gTWVyZ2UgYW55IG92ZXJsYXBwaW5nIHJhbmdlc1xuICAgIGNvbnN0IG5ld1JhbmdlcyA9IFtdO1xuICAgIGNvbnN0IHRlbXAgPSByYW5nZXMuc29ydCgoYSwgYikgPT4gYS5sb3cgLSBiLmxvdyk7XG4gICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWN1cnJlbnRSYW5nZSkge1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfSBlbHNlIGlmICh0ZW1wW2ldLmxvdyA8PSBjdXJyZW50UmFuZ2UuaGlnaCkge1xuICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IHRlbXBbaV0uaGlnaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAgIC8vIENvcm5lciBjYXNlOiBhZGQgdGhlIGxhc3QgcmFuZ2VcbiAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgfVxuICAgIHJldHVybiBuZXdSYW5nZXMubGVuZ3RoID4gMCA/IG5ld1JhbmdlcyA6IHVuZGVmaW5lZDtcbiAgfVxuICBkaWZmZXJlbmNlIChvdGhlclRva2VuKSB7XG4gICAgLy8gQ29tcHV0ZSB3aGF0IGlzIGxlZnQgb2YgdGhpcyBhZnRlciBzdWJ0cmFjdGluZyBvdXQgZXZlcnl0aGluZyBpbiBvdGhlclRva2VuXG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgY29tcHV0ZSB0aGUgZGlmZmVyZW5jZSBvZiB0d28gZGlmZmVyZW50IHRva2VuIHR5cGVzYCk7XG4gICAgfSBlbHNlIGlmIChvdGhlclRva2VuLm1hdGNoQWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGNvbnNvbGUud2FybihgSW5hY2N1cmF0ZSBkaWZmZXJlbmNlIGNvbXB1dGVkISBUT0RPOiBuZWVkIHRvIGZpZ3VyZSBvdXQgaG93IHRvIGludmVydCBjYXRlZ29yaWNhbCBrZXlzIWApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld0tleXMgPSB7fTtcbiAgICAgIGZvciAobGV0IGtleSBpbiAodGhpcy5rZXlzIHx8IHt9KSkge1xuICAgICAgICBpZiAoIW90aGVyVG9rZW4ua2V5cyB8fCAhb3RoZXJUb2tlbi5rZXlzW2tleV0pIHtcbiAgICAgICAgICBuZXdLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3UmFuZ2VzID0gW107XG4gICAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgICAgaWYgKG90aGVyVG9rZW4ucmFuZ2VzKSB7XG4gICAgICAgICAgbGV0IGFsbFBvaW50cyA9IHRoaXMucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICBhbGxQb2ludHMgPSBhbGxQb2ludHMuY29uY2F0KG90aGVyVG9rZW4ucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKSkuc29ydCgpO1xuICAgICAgICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0geyBsb3c6IGFsbFBvaW50c1tpXS52YWx1ZSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmV4Y2x1ZGUpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS5sb3cgLSAxO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmxvdyA9IGFsbFBvaW50c1tpXS5oaWdoICsgMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdSYW5nZXMgPSB0aGlzLnJhbmdlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBLZXlzVG9rZW4odGhpcy5tdXJlLCBudWxsLCB7IGtleXM6IG5ld0tleXMsIHJhbmdlczogbmV3UmFuZ2VzIH0pO1xuICAgIH1cbiAgfVxuICBpc1N1YlNldE9mIChhcmdMaXN0KSB7XG4gICAgY29uc3Qgb3RoZXJUb2tlbiA9IG5ldyBLZXlzVG9rZW4odGhpcy5zdHJlYW0sIGFyZ0xpc3QpO1xuICAgIGNvbnN0IGRpZmYgPSBvdGhlclRva2VuLmRpZmZlcmVuY2UodGhpcyk7XG4gICAgcmV0dXJuIGRpZmYgPT09IG51bGwgfHwgZGlmZi5zZWxlY3RzTm90aGluZztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHsgcmV0dXJuICcua2V5cygpJzsgfVxuICAgIHJldHVybiAnLmtleXMoJyArICh0aGlzLnJhbmdlcyB8fCBbXSkubWFwKCh7bG93LCBoaWdofSkgPT4ge1xuICAgICAgcmV0dXJuIGxvdyA9PT0gaGlnaCA/IGxvdyA6IGAke2xvd30tJHtoaWdofWA7XG4gICAgfSkuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMua2V5cyB8fCB7fSkubWFwKGtleSA9PiBgJyR7a2V5fSdgKSlcbiAgICAgIC5qb2luKCcsJykgKyAnKSc7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgICAgZm9yIChsZXQga2V5IGluIHdyYXBwZWRQYXJlbnQucmF3SXRlbSkge1xuICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgICAgbG93ID0gTWF0aC5tYXgoMCwgbG93KTtcbiAgICAgICAgICBoaWdoID0gTWF0aC5taW4od3JhcHBlZFBhcmVudC5yYXdJdGVtLmxlbmd0aCAtIDEsIGhpZ2gpO1xuICAgICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgICAgIHJhd0l0ZW06IGlcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGtleSBpbiB0aGlzLmtleXMgfHwge30pIHtcbiAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgY29uc3Qgb2JqID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgIGNvbnN0IGtleVR5cGUgPSB0eXBlb2Yga2V5O1xuICAgICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IChrZXlUeXBlICE9PSAnc3RyaW5nJyAmJiBrZXlUeXBlICE9PSAnbnVtYmVyJykpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVmFsdWVUb2tlbiB1c2VkIG9uIGEgbm9uLW9iamVjdCwgb3Igd2l0aG91dCBhIHN0cmluZyAvIG51bWVyaWMga2V5YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEV2YWx1YXRlVG9rZW4gaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdTdHJlYW07XG4gICAgICB0cnkge1xuICAgICAgICBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5mb3JrKHdyYXBwZWRQYXJlbnQucmF3SXRlbSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnIHx8ICEoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpKSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFdmFsdWF0ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIE1hcFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gZ2VuZXJhdG9yO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiBnZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZ2VuZXJhdG9yXSh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgSW5kZXhlZFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCByYXdJdGVtLCBoYXNoZXMgPSB7fSB9KSB7XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBhd2FpdCBzdXBlci53cmFwKHsgd3JhcHBlZFBhcmVudCwgcmF3SXRlbSB9KTtcbiAgICBmb3IgKGNvbnN0IFsgaGFzaEZ1bmNOYW1lLCBoYXNoIF0gb2YgT2JqZWN0LmVudHJpZXMoaGFzaGVzKSkge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLnN0cmVhbS5nZXRJbmRleChoYXNoRnVuY05hbWUsIHRoaXMpO1xuICAgICAgYXdhaXQgaW5kZXguYWRkVmFsdWUoaGFzaCwgd3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluZGV4ZWRUb2tlbjtcbiIsImltcG9ydCBJbmRleGVkVG9rZW4gZnJvbSAnLi9JbmRleGVkVG9rZW4uanMnO1xuXG5jbGFzcyBQcm9tb3RlVG9rZW4gZXh0ZW5kcyBJbmRleGVkVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgWyBtYXAsIGhhc2gsIHJlZHVjZUluc3RhbmNlcyBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tmdW5jXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7ZnVuY31gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5tYXAgPSBtYXA7XG4gICAgdGhpcy5oYXNoID0gaGFzaDtcbiAgICB0aGlzLnJlZHVjZUluc3RhbmNlcyA9IHJlZHVjZUluc3RhbmNlcztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAucHJvbW90ZSgke3RoaXMubWFwfSwgJHt0aGlzLmhhc2h9LCAke3RoaXMucmVkdWNlSW5zdGFuY2VzfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICByZXR1cm4gdGhpcy5tYXAgPT09IG1hcCAmJlxuICAgICAgdGhpcy5oYXNoID09PSBoYXNoICYmXG4gICAgICB0aGlzLnJlZHVjZUluc3RhbmNlcyA9PT0gcmVkdWNlSW5zdGFuY2VzO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgY29uc3QgbWFwRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLm1hcF07XG4gICAgICBjb25zdCBoYXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmhhc2hdO1xuICAgICAgY29uc3QgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLnJlZHVjZUluc3RhbmNlc107XG4gICAgICBjb25zdCBoYXNoSW5kZXggPSB0aGlzLnN0cmVhbS5nZXRJbmRleCh0aGlzLmhhc2gsIHRoaXMpO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIG1hcEZ1bmN0aW9uKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICAgIGNvbnN0IGhhc2ggPSBoYXNoRnVuY3Rpb24obWFwcGVkUmF3SXRlbSk7XG4gICAgICAgIGxldCBvcmlnaW5hbFdyYXBwZWRJdGVtID0gKGF3YWl0IGhhc2hJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCkpWzBdO1xuICAgICAgICBpZiAob3JpZ2luYWxXcmFwcGVkSXRlbSkge1xuICAgICAgICAgIGlmICh0aGlzLnJlZHVjZUluc3RhbmNlcyAhPT0gJ25vb3AnKSB7XG4gICAgICAgICAgICByZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbihvcmlnaW5hbFdyYXBwZWRJdGVtLCBtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0udHJpZ2dlcigndXBkYXRlJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGhhc2hlcyA9IHt9O1xuICAgICAgICAgIGhhc2hlc1t0aGlzLmhhc2hdID0gaGFzaDtcbiAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW0sXG4gICAgICAgICAgICBoYXNoZXNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlVG9rZW47XG4iLCJpbXBvcnQgSW5kZXhlZFRva2VuIGZyb20gJy4vSW5kZXhlZFRva2VuLmpzJztcblxuY2xhc3MgSm9pblRva2VuIGV4dGVuZHMgSW5kZXhlZFRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBvdGhlclN0cmVhbSwgdGhpc0hhc2ggPSAna2V5Jywgb3RoZXJIYXNoID0gJ2tleScsIGZpbmlzaCA9ICdkZWZhdWx0RmluaXNoJywgZWRnZVJvbGUgPSAnbm9uZScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgdGhpc0hhc2gsIGZpbmlzaCBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tmdW5jXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7ZnVuY31gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wID0gc3RyZWFtLm5hbWVkU3RyZWFtc1tvdGhlclN0cmVhbV07XG4gICAgaWYgKCF0ZW1wKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgc3RyZWFtOiAke290aGVyU3RyZWFtfWApO1xuICAgIH1cbiAgICAvLyBSZXF1aXJlIG90aGVySGFzaCBvbiB0aGUgb3RoZXIgc3RyZWFtLCBvciBjb3B5IG91cnMgb3ZlciBpZiBpdCBpc24ndFxuICAgIC8vIGFscmVhZHkgZGVmaW5lZFxuICAgIGlmICghdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBoYXNoIGZ1bmN0aW9uIG9uIGVpdGhlciBzdHJlYW06ICR7b3RoZXJIYXNofWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdID0gc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5vdGhlclN0cmVhbSA9IG90aGVyU3RyZWFtO1xuICAgIHRoaXMudGhpc0hhc2ggPSB0aGlzSGFzaDtcbiAgICB0aGlzLm90aGVySGFzaCA9IG90aGVySGFzaDtcbiAgICB0aGlzLmZpbmlzaCA9IGZpbmlzaDtcbiAgICB0aGlzLmVkZ2VSb2xlID0gZWRnZVJvbGU7XG4gICAgdGhpcy5oYXNoVGhpc0dyYW5kcGFyZW50ID0gZWRnZVJvbGUgPT09ICdmdWxsJztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAuam9pbigke3RoaXMub3RoZXJTdHJlYW19LCAke3RoaXMudGhpc0hhc2h9LCAke3RoaXMub3RoZXJIYXNofSwgJHt0aGlzLmZpbmlzaH0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIHRoaXMub3RoZXJTdHJlYW0gPT09IG90aGVyU3RyZWFtICYmXG4gICAgICB0aGlzLnRoaXNIYXNoID09PSB0aGlzSGFzaCAmJlxuICAgICAgdGhpcy5vdGhlckhhc2ggPT09IG90aGVySGFzaCAmJlxuICAgICAgdGhpcy5maW5pc2ggPT09IGZpbmlzaDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3Qgb3RoZXJTdHJlYW0gPSB0aGlzLnN0cmVhbS5uYW1lZFN0cmVhbXNbdGhpcy5vdGhlclN0cmVhbV07XG4gICAgY29uc3QgdGhpc0hhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMudGhpc0hhc2hdO1xuICAgIGNvbnN0IG90aGVySGFzaEZ1bmN0aW9uID0gb3RoZXJTdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5vdGhlckhhc2hdO1xuICAgIGNvbnN0IGZpbmlzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5maW5pc2hdO1xuXG4gICAgY29uc3QgdGhpc0luZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy50aGlzSGFzaCwgdGhpcyk7XG4gICAgY29uc3Qgb3RoZXJJbmRleCA9IG90aGVyU3RyZWFtLmdldEluZGV4KHRoaXMub3RoZXJIYXNoLCB0aGlzKTtcblxuICAgIGlmICh0aGlzSW5kZXguY29tcGxldGUpIHtcbiAgICAgIGlmIChvdGhlckluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIC8vIEJlc3Qgb2YgYWxsIHdvcmxkczsgd2UgY2FuIGp1c3Qgam9pbiB0aGUgaW5kZXhlc1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgaGFzaCwgdmFsdWVMaXN0IH0gb2YgdGhpc0luZGV4Lml0ZXJFbnRyaWVzKCkpIHtcbiAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB2YWx1ZUxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgdGhlIG90aGVyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2Ygb3VyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlclN0cmVhbS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgIC8vIEFkZCBvdGhlcldyYXBwZWRJdGVtIHRvIG90aGVySW5kZXg6XG4gICAgICAgICAgICBhd2FpdCBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgY29uc3QgdGhpc0xpc3QgPSBhd2FpdCB0aGlzSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChvdGhlckluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIC8vIE5lZWQgdG8gaXRlcmF0ZSBvdXIgaXRlbXMsIGFuZCB0YWtlIGFkdmFudGFnZSBvZiB0aGUgb3RoZXIgY29tcGxldGVcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgICAgIC8vIE9kZCBjb3JuZXIgY2FzZSBmb3IgZWRnZXM7IHNvbWV0aW1lcyB3ZSB3YW50IHRvIGhhc2ggdGhlIGdyYW5kcGFyZW50IGluc3RlYWQgb2YgdGhlIHJlc3VsdCBvZlxuICAgICAgICAgIC8vIGFuIGludGVybWVkaWF0ZSBqb2luOlxuICAgICAgICAgIGNvbnN0IHRoaXNIYXNoSXRlbSA9IHRoaXMuaGFzaFRoaXNHcmFuZHBhcmVudCA/IHRoaXNXcmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IDogdGhpc1dyYXBwZWRJdGVtO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiB0aGlzSGFzaEZ1bmN0aW9uKHRoaXNIYXNoSXRlbSkpIHtcbiAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICBhd2FpdCB0aGlzSW5kZXguYWRkVmFsdWUoaGFzaCwgdGhpc0hhc2hJdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5laXRoZXIgc3RyZWFtIGlzIGZ1bGx5IGluZGV4ZWQ7IGZvciBtb3JlIGRpc3RyaWJ1dGVkIHNhbXBsaW5nLCBncmFiXG4gICAgICAgIC8vIG9uZSBpdGVtIGZyb20gZWFjaCBzdHJlYW0gYXQgYSB0aW1lLCBhbmQgdXNlIHRoZSBwYXJ0aWFsIGluZGV4ZXNcbiAgICAgICAgY29uc3QgdGhpc0l0ZXJhdG9yID0gdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zLCB0aGlzLnRoaXNJbmRpcmVjdEtleSk7XG4gICAgICAgIGxldCB0aGlzSXNEb25lID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IG90aGVySXRlcmF0b3IgPSBvdGhlclN0cmVhbS5pdGVyYXRlKCk7XG4gICAgICAgIGxldCBvdGhlcklzRG9uZSA9IGZhbHNlO1xuXG4gICAgICAgIHdoaWxlICghdGhpc0lzRG9uZSB8fCAhb3RoZXJJc0RvbmUpIHtcbiAgICAgICAgICAvLyBUYWtlIG9uZSBzYW1wbGUgZnJvbSB0aGlzIHN0cmVhbVxuICAgICAgICAgIGxldCB0ZW1wID0gYXdhaXQgdGhpc0l0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgICAgICB0aGlzSXNEb25lID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdGhpc1dyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIC8vIE9kZCBjb3JuZXIgY2FzZSBmb3IgZWRnZXM7IHNvbWV0aW1lcyB3ZSB3YW50IHRvIGhhc2ggdGhlIGdyYW5kcGFyZW50IGluc3RlYWQgb2YgdGhlIHJlc3VsdCBvZlxuICAgICAgICAgICAgLy8gYW4gaW50ZXJtZWRpYXRlIGpvaW46XG4gICAgICAgICAgICBjb25zdCB0aGlzSGFzaEl0ZW0gPSB0aGlzLmhhc2hUaGlzR3JhbmRwYXJlbnQgPyB0aGlzV3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCA6IHRoaXNXcmFwcGVkSXRlbTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiB0aGlzSGFzaEZ1bmN0aW9uKHRoaXNIYXNoSXRlbSkpIHtcbiAgICAgICAgICAgICAgLy8gYWRkIHRoaXNXcmFwcGVkSXRlbSB0byB0aGlzSW5kZXhcbiAgICAgICAgICAgICAgdGhpc0luZGV4LmFkZFZhbHVlKGhhc2gsIHRoaXNIYXNoSXRlbSk7XG4gICAgICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm93IGZvciBhIHNhbXBsZSBmcm9tIHRoZSBvdGhlciBzdHJlYW1cbiAgICAgICAgICB0ZW1wID0gYXdhaXQgb3RoZXJJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgb3RoZXJJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBvdGhlcldyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4XG4gICAgICAgICAgICAgIG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSm9pblRva2VuO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4uL1N0cmVhbS5qcyc7XG5cbmNvbnN0IEFTVEVSSVNLUyA9IHtcbiAgJ2V2YWx1YXRlJzogJ+KGrCcsXG4gICdqb2luJzogJ+KorycsXG4gICdtYXAnOiAn4oamJyxcbiAgJ3Byb21vdGUnOiAn4oaRJyxcbiAgJ3ZhbHVlJzogJ+KGkidcbn07XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy5fc2VsZWN0b3IgPSBvcHRpb25zLnNlbGVjdG9yO1xuICAgIHRoaXMuY3VzdG9tQ2xhc3NOYW1lID0gb3B0aW9ucy5jdXN0b21DbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID0gb3B0aW9ucy5jdXN0b21OYW1lVG9rZW5JbmRleCB8fCBudWxsO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBvcHRpb25zLmFubm90YXRpb25zIHx8IFtdO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIGlmICh0eXBlb2YgZnVuYyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBuZXcgRnVuY3Rpb24oYHJldHVybiAke2Z1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLl9zZWxlY3RvcjtcbiAgfVxuICBnZXQgdG9rZW5DbGFzc0xpc3QgKCkge1xuICAgIHJldHVybiB0aGlzLm11cmUucGFyc2VTZWxlY3Rvcih0aGlzLnNlbGVjdG9yKTtcbiAgfVxuICB0b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NUeXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBzZWxlY3RvcjogdGhpcy5fc2VsZWN0b3IsXG4gICAgICBjdXN0b21DbGFzc05hbWU6IHRoaXMuY3VzdG9tQ2xhc3NOYW1lLFxuICAgICAgY3VzdG9tTmFtZVRva2VuSW5kZXg6IHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXgsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9ucyxcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB7fVxuICAgIH07XG4gICAgZm9yIChsZXQgW2Z1bmNOYW1lLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm5hbWVkRnVuY3Rpb25zKSkge1xuICAgICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgICAgcmVzdWx0Lm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IHN0cmluZ2lmaWVkRnVuYztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSB2YWx1ZSkge1xuICAgICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSB2YWx1ZTtcbiAgICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPSB0aGlzLnNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKS5sZW5ndGg7XG4gICAgICB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICB9XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gbnVsbCAmJlxuICAgICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9PT0gdGhpcy5zZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZykubGVuZ3RoO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIGNvbnN0IHNlbGVjdG9yID0gdGhpcy5zZWxlY3RvcjtcbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgIGZvciAobGV0IGkgPSB0b2tlblN0cmluZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGlmICh0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gbnVsbCAmJiBpIDw9IHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VzdG9tQ2xhc3NOYW1lICsgcmVzdWx0O1xuICAgICAgfVxuICAgICAgY29uc3QgdGVtcCA9IHRva2VuU3RyaW5nc1tpXS5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKHRlbXBbMV0gPT09ICdrZXlzJyB8fCB0ZW1wWzFdID09PSAndmFsdWVzJykge1xuICAgICAgICBpZiAodGVtcFsyXSA9PT0gJycpIHtcbiAgICAgICAgICByZXN1bHQgPSAnKicgKyByZXN1bHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0ID0gdGVtcFsyXS5yZXBsYWNlKC8nKFteJ10qKScvLCAnJDEnKSArIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gQVNURVJJU0tTW3RlbXBbMV1dICsgcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gKHNlbGVjdG9yLnN0YXJ0c1dpdGgoJ2VtcHR5JykgPyAn4oiFJyA6ICcnKSArIHJlc3VsdDtcbiAgfVxuICBhZGRIYXNoRnVuY3Rpb24gKGZ1bmNOYW1lLCBmdW5jKSB7XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBmdW5jO1xuICB9XG4gIGFkZEF0dHJpYnV0ZUFzSGFzaEZ1bmN0aW9uIChhdHRyTmFtZSkge1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbYXR0ck5hbWVdID0gZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgIHlpZWxkIHdyYXBwZWRJdGVtLnJhd0l0ZW1bYXR0ck5hbWVdO1xuICAgIH07XG4gIH1cbiAgZXhwYW5kQXR0cmlidXRlQXNIYXNoRnVuY3Rpb24gKGF0dHJOYW1lLCBkZWxpbWl0ZXIgPSAnLCcpIHtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zW2F0dHJOYW1lXSA9IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7XG4gICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHdyYXBwZWRJdGVtLnJhd0l0ZW0uc3BsaXQoZGVsaW1pdGVyKSkge1xuICAgICAgICB5aWVsZCB2YWx1ZS50cmltKCk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuICBwb3B1bGF0ZVN0cmVhbU9wdGlvbnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdDtcbiAgICBvcHRpb25zLm5hbWVkRnVuY3Rpb25zID0gdGhpcy5uYW1lZEZ1bmN0aW9ucztcbiAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfVxuICBnZXRTdHJlYW0gKG9wdGlvbnMgPSB7fSkge1xuICAgIHJldHVybiBuZXcgU3RyZWFtKHRoaXMucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpKTtcbiAgfVxuICBpc1N1cGVyU2V0T2ZUb2tlbkxpc3QgKHRva2VuTGlzdCkge1xuICAgIGlmICh0b2tlbkxpc3QubGVuZ3RoICE9PSB0aGlzLnRva2VuTGlzdC5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmV2ZXJ5KCh0b2tlbiwgaSkgPT4gdG9rZW4uaXNTdXBlclNldE9mKHRva2VuTGlzdFtpXSkpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLnRvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy5DbGFzc1R5cGUgPSB0aGlzLm11cmUuQ0xBU1NFUy5Ob2RlQ2xhc3M7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMuQ2xhc3NUeXBlID0gdGhpcy5tdXJlLkNMQVNTRVMuRWRnZUNsYXNzO1xuICAgIHJldHVybiB0aGlzLm11cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgYWdncmVnYXRlIChoYXNoLCByZWR1Y2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBleHBhbmQgKG1hcCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGZpbHRlciAoZmlsdGVyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgc3BsaXQgKGhhc2gpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcjtcbiAgICB0aGlzLmVkZ2VDb25uZWN0aW9ucyA9IG9wdGlvbnMuZWRnZUNvbm5lY3Rpb25zIHx8IHt9O1xuICB9XG4gIHRvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci50b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ29ubmVjdGlvbnMgPSB0aGlzLmVkZ2VDb25uZWN0aW9ucztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICAgIC8qXG4gICAgY29uc3QgZWRnZUlkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNvbm5lY3Rpb25zKTtcbiAgICBpZiAoZWRnZUlkcy5sZW5ndGggPiAyKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH1cbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLkNsYXNzVHlwZSA9IHRoaXMubXVyZS5DTEFTU0VTLkVkZ2VDbGFzcztcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLm11cmUuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gICAgaWYgKGVkZ2VJZHMubGVuZ3RoID09PSAxIHx8IGVkZ2VJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1tlZGdlSWRzWzBdXTtcbiAgICAgIG5ld0VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBuZXdFZGdlQ2xhc3Muc291cmNlQ2hhaW4gPSBzb3VyY2VFZGdlQ2xhc3MuXG4gICAgICBuZXdFZGdlQ2xhc3MuZ2xvbXBTb3VyY2VFZGdlKHRoaXMubXVyZS5jbGFzc2VzW2VkZ2VJZHNbMF1dKTtcbiAgICB9XG4gICAgaWYgKGVkZ2VJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICBuZXdFZGdlQ2xhc3MuZ2xvbXBUYXJnZXRFZGdlKHRoaXMubXVyZS5jbGFzc2VzW2VkZ2VJZHNbMV1dKTtcbiAgICB9XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgKi9cbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGRpcmVjdGVkLCB0aGlzSGFzaE5hbWUsIG90aGVySGFzaE5hbWUgfSkge1xuICAgIGNvbnN0IG5ld0VkZ2UgPSB0aGlzLm11cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IG51bGwsXG4gICAgICBDbGFzc1R5cGU6IHRoaXMubXVyZS5DTEFTU0VTLkVkZ2VDbGFzcyxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZUNoYWluOiB7IG5vZGVIYXNoOiB0aGlzSGFzaE5hbWUsIGVkZ2VIYXNoOiBudWxsIH0sXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0SGFzaE5hbWU6IHsgbm9kZUhhc2g6IG90aGVySGFzaE5hbWUsIGVkZ2VIYXNoOiBudWxsIH0sXG4gICAgICBkaXJlY3RlZFxuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNvbm5lY3Rpb25zW25ld0VkZ2UuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1tuZXdFZGdlLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNvbm5lY3Rpb25zKSkge1xuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2VzKCk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldHMoKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLmVkZ2VDb25uZWN0aW9uc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJjbGFzcyBDaGFpbiB7XG4gIGNvbnN0cnVjdG9yICh7IG5vZGVIYXNoID0gbnVsbCwgZWRnZUhhc2ggPSBudWxsLCBpbnRlcm1lZGlhdGVzID0gW10gfSA9IHt9KSB7XG4gICAgdGhpcy5ub2RlSGFzaCA9IG5vZGVIYXNoO1xuICAgIHRoaXMuZWRnZUhhc2ggPSBlZGdlSGFzaDtcbiAgICB0aGlzLmludGVybWVkaWF0ZXMgPSBpbnRlcm1lZGlhdGVzO1xuICB9XG4gIHRvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbm9kZUhhc2g6IHRoaXMubm9kZUhhc2gsXG4gICAgICBlZGdlSGFzaDogdGhpcy5lZGdlSGFzaCxcbiAgICAgIGludGVybWVkaWF0ZXM6IHRoaXMuaW50ZXJtZWRpYXRlc1xuICAgIH07XG4gIH1cbiAgc3BsaXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICAgIC8vIHJldHVybiBbIGVkZ2V3YXJkQ2hhaW4sIG5vZGV3YXJkQ2hhaW4gXVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDaGFpbjtcbiIsImltcG9ydCBDaGFpbiBmcm9tICcuL0NoYWluLmpzJztcbmltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZUNoYWluID0gbmV3IENoYWluKG9wdGlvbnMuc291cmNlQ2hhaW4pO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0Q2hhaW4gPSBuZXcgQ2hhaW4ob3B0aW9ucy50YXJnZXRDaGFpbik7XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLnRvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZUNoYWluID0gdGhpcy5zb3VyY2VDaGFpbi50b1Jhd09iamVjdDtcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0Q2hhaW4gPSB0aGlzLnRhcmdldENoYWluLnRvUmF3T2JqZWN0O1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIC8vIFRPRE8hXG4gICAgcmV0dXJuIHRoaXMuX3NlbGVjdG9yO1xuICAgIC8qXG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcblxuICAgIGlmICghdGhpcy5fc2VsZWN0b3IpIHtcbiAgICAgIGlmICghc291cmNlQ2xhc3MgfHwgIXRhcmdldENsYXNzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFydGlhbCBjb25uZWN0aW9ucyB3aXRob3V0IGFuIGVkZ2UgdGFibGUgc2hvdWxkIG5ldmVyIGhhcHBlbmApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm8gZWRnZSB0YWJsZSAoc2ltcGxlIGpvaW4gYmV0d2VlbiB0d28gbm9kZXMpXG4gICAgICAgIGNvbnN0IHNvdXJjZUhhc2ggPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXS5ub2RlSGFzaE5hbWU7XG4gICAgICAgIGNvbnN0IHRhcmdldEhhc2ggPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXS5ub2RlSGFzaE5hbWU7XG4gICAgICAgIHJldHVybiBzb3VyY2VDbGFzcy5zZWxlY3RvciArIGAuam9pbih0YXJnZXQsICR7c291cmNlSGFzaH0sICR7dGFyZ2V0SGFzaH0sIGRlZmF1bHRGaW5pc2gsIHNvdXJjZVRhcmdldClgO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgcmVzdWx0ID0gdGhpcy5fc2VsZWN0b3I7XG4gICAgICBpZiAoIXNvdXJjZUNsYXNzKSB7XG4gICAgICAgIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgICAvLyBObyBjb25uZWN0aW9ucyB5ZXQ7IGp1c3QgeWllbGQgdGhlIHJhdyBlZGdlIHRhYmxlXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBQYXJ0aWFsIGVkZ2UtdGFyZ2V0IGNvbm5lY3Rpb25zXG4gICAgICAgICAgY29uc3QgeyBlZGdlSGFzaE5hbWUsIG5vZGVIYXNoTmFtZSB9ID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdCArIGAuam9pbih0YXJnZXQsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoLCBlZGdlVGFyZ2V0KWA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIXRhcmdldENsYXNzKSB7XG4gICAgICAgIC8vIFBhcnRpYWwgc291cmNlLWVkZ2UgY29ubmVjdGlvbnNcbiAgICAgICAgY29uc3QgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJldHVybiByZXN1bHQgKyBgLmpvaW4oc291cmNlLCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaCwgc291cmNlRWRnZSlgO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRnVsbCBjb25uZWN0aW9uc1xuICAgICAgICBsZXQgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJlc3VsdCArPSBgLmpvaW4oc291cmNlLCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgICAoeyBlZGdlSGFzaE5hbWUsIG5vZGVIYXNoTmFtZSB9ID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0pO1xuICAgICAgICByZXN1bHQgKz0gYC5qb2luKHRhcmdldCwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gsIGZ1bGwpYDtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gICAgKi9cbiAgfVxuICBwb3B1bGF0ZVN0cmVhbU9wdGlvbnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMgPSB7fTtcbiAgICBpZiAoIXRoaXMuX3NlbGVjdG9yKSB7XG4gICAgICAvLyBVc2UgdGhlIG9wdGlvbnMgZnJvbSB0aGUgc291cmNlIHN0cmVhbSBpbnN0ZWFkIG9mIG91ciBjbGFzc1xuICAgICAgb3B0aW9ucyA9IHNvdXJjZUNsYXNzLnBvcHVsYXRlU3RyZWFtT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnRhcmdldCA9IHRhcmdldENsYXNzLmdldFN0cmVhbSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gc3VwZXIucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpO1xuICAgICAgaWYgKHNvdXJjZUNsYXNzKSB7XG4gICAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnNvdXJjZSA9IHNvdXJjZUNsYXNzLmdldFN0cmVhbSgpO1xuICAgICAgfVxuICAgICAgaWYgKHRhcmdldENsYXNzKSB7XG4gICAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnRhcmdldCA9IHRhcmdldENsYXNzLmdldFN0cmVhbSgpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLkNsYXNzVHlwZSA9IHRoaXMubXVyZS5DTEFTU0VTLk5vZGVDbGFzcztcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm11cmUuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG5cbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBjb25zdCBzb3VyY2VOb2RlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgbGV0IFsgdGFyZ2V0Q2hhaW4sIHNvdXJjZUNoYWluIF0gPSB0aGlzLnNvdXJjZUNoYWluLnNwbGl0KCk7XG4gICAgICBjb25zdCBuZXdTb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm11cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgICBDbGFzc1R5cGU6IHRoaXMubXVyZS5DTEFTU0VTLkVkZ2VDbGFzcyxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogc291cmNlTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZUNoYWluOiBzb3VyY2VDaGFpbi50b1Jhd09iamVjdCgpLFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0Q2hhaW46IHRhcmdldENoYWluLnRvUmF3T2JqZWN0KCksXG4gICAgICAgIGRpcmVjdGVkOiB0aGlzLmRpcmVjdGVkXG4gICAgICB9KTtcbiAgICAgIGRlbGV0ZSBzb3VyY2VOb2RlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW25ld05vZGVDbGFzcy5jbGFzc0lkXTtcbiAgICAgIHNvdXJjZU5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbbmV3U291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbbmV3U291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXROb2RlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgICAgbGV0IFsgc291cmNlQ2hhaW4sIHRhcmdldENoYWluIF0gPSB0aGlzLnRhcmdldENoYWluLnNwbGl0KCk7XG4gICAgICBjb25zdCBuZXdUYXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm11cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgICBDbGFzc1R5cGU6IHRoaXMubXVyZS5DTEFTU0VTLkVkZ2VDbGFzcyxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGFyZ2V0Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZUNoYWluOiBzb3VyY2VDaGFpbi50b1Jhd09iamVjdCgpLFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0Q2hhaW46IHRhcmdldENoYWluLnRvUmF3T2JqZWN0KCksXG4gICAgICAgIGRpcmVjdGVkOiB0aGlzLmRpcmVjdGVkXG4gICAgICB9KTtcbiAgICAgIGRlbGV0ZSB0YXJnZXROb2RlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW25ld05vZGVDbGFzcy5jbGFzc0lkXTtcbiAgICAgIHRhcmdldE5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbbmV3VGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbbmV3VGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCBkaXJlY3Rpb24sIG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0pIHtcbiAgICBpZiAoZGlyZWN0aW9uID09PSAnc291cmNlJykge1xuICAgICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDaGFpbiA9IG5ldyBDaGFpbih7IG5vZGVIYXNoOiBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoOiBlZGdlSGFzaE5hbWUgfSk7XG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICd0YXJnZXQnKSB7XG4gICAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB0aGlzLnRhcmdldENoYWluID0gbmV3IENoYWluKHsgbm9kZUhhc2g6IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2g6IGVkZ2VIYXNoTmFtZSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICAgIHRoaXMuc291cmNlQ2hhaW4gPSBuZXcgQ2hhaW4oeyBub2RlSGFzaDogbm9kZUhhc2hOYW1lLCBlZGdlSGFzaDogZWRnZUhhc2hOYW1lIH0pO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgICB0aGlzLnRhcmdldENoYWluID0gbmV3IENoYWluKHsgbm9kZUhhc2g6IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2g6IGVkZ2VIYXNoTmFtZSB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgU291cmNlIGFuZCB0YXJnZXQgYXJlIGFscmVhZHkgZGVmaW5lZDsgcGxlYXNlIHNwZWNpZnkgYSBkaXJlY3Rpb24gdG8gb3ZlcnJpZGVgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgdG9nZ2xlTm9kZURpcmVjdGlvbiAoc291cmNlQ2xhc3NJZCkge1xuICAgIGlmICghc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3Qgc3dhcCB0byB1bmNvbm5lY3RlZCBjbGFzcyBpZDogJHtzb3VyY2VDbGFzc0lkfWApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gc291cmNlQ2xhc3NJZDtcbiAgICAgICAgY29uc3QgdGVtcCA9IHRoaXMuc291cmNlQ2hhaW47XG4gICAgICAgIHRoaXMuc291cmNlQ2hhaW4gPSB0aGlzLnRhcmdldENoYWluO1xuICAgICAgICB0aGlzLnRhcmdldENoYWluID0gdGVtcDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZXMgKCkge1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5zb3VyY2VDaGFpbiA9IG5ldyBDaGFpbigpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXRzICgpIHtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMudGFyZ2V0Q2hhaW4gPSBuZXcgQ2hhaW4oKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXS5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLndyYXBwZWRQYXJlbnQgPSB3cmFwcGVkUGFyZW50O1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICB0aGlzLnJhd0l0ZW0gPSByYXdJdGVtO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgc3VwZXIoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdzb3VyY2VUYXJnZXQnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIHNvdXJjZTogdGhpcy5yYXdJdGVtLmxlZnQsXG4gICAgICAgIHRhcmdldDogdGhpcy5yYXdJdGVtLnJpZ2h0XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdlZGdlVGFyZ2V0Jykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBlZGdlOiB0aGlzLnJhd0l0ZW0ubGVmdCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLnJhd0l0ZW0ucmlnaHRcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ3NvdXJjZUVkZ2UnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIHNvdXJjZTogdGhpcy5yYXdJdGVtLnJpZ2h0LFxuICAgICAgICBlZGdlOiB0aGlzLnJhd0l0ZW0ubGVmdFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnZnVsbCcpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgc291cmNlOiB0aGlzLnJhd0l0ZW0ubGVmdC5yaWdodCxcbiAgICAgICAgZWRnZTogdGhpcy5yYXdJdGVtLmxlZnQubGVmdCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLnJhd0l0ZW0ucmlnaHRcbiAgICAgIH07XG4gICAgfVxuICAgIC8vIGlmIHRoZXJlIGlzIG5vIGVkZ2VSb2xlLCBsZWF2ZSB0aGUgcmF3SXRlbSBhcy1pc1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiY2xhc3MgSW5NZW1vcnlJbmRleCB7XG4gIGNvbnN0cnVjdG9yICh7IGVudHJpZXMgPSB7fSwgY29tcGxldGUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICAgIHRoaXMuY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcztcbiAgfVxuICBhc3luYyAqIGl0ZXJFbnRyaWVzICgpIHtcbiAgICBmb3IgKGNvbnN0IFtoYXNoLCB2YWx1ZUxpc3RdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHsgaGFzaCwgdmFsdWVMaXN0IH07XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlckhhc2hlcyAoKSB7XG4gICAgZm9yIChjb25zdCBoYXNoIG9mIE9iamVjdC5rZXlzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIGhhc2g7XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlclZhbHVlTGlzdHMgKCkge1xuICAgIGZvciAoY29uc3QgdmFsdWVMaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgdmFsdWVMaXN0O1xuICAgIH1cbiAgfVxuICBhc3luYyBnZXRWYWx1ZUxpc3QgKGhhc2gpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzW2hhc2hdIHx8IFtdO1xuICB9XG4gIGFzeW5jIGFkZFZhbHVlIChoYXNoLCB2YWx1ZSkge1xuICAgIC8vIFRPRE86IGFkZCBzb21lIGtpbmQgb2Ygd2FybmluZyBpZiB0aGlzIGlzIGdldHRpbmcgYmlnP1xuICAgIHRoaXMuZW50cmllc1toYXNoXSA9IGF3YWl0IHRoaXMuZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgIGlmICh0aGlzLmVudHJpZXNbaGFzaF0uaW5kZXhPZih2YWx1ZSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbk1lbW9yeUluZGV4O1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4vU3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIFRPS0VOUyBmcm9tICcuL1Rva2Vucy9Ub2tlbnMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcbmltcG9ydCAqIGFzIElOREVYRVMgZnJvbSAnLi9JbmRleGVzL0luZGV4ZXMuanMnO1xuXG5sZXQgTkVYVF9DTEFTU19JRCA9IDE7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBtdXJlLmRlYnVnIHRvIHRydWUgdG8gZGVidWcgc3RyZWFtc1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UT0tFTlMgPSBUT0tFTlM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIE1vbmtleS1wYXRjaCBhdmFpbGFibGUgdG9rZW5zIGFzIGZ1bmN0aW9ucyBvbnRvIHRoZSBTdHJlYW0gY2xhc3NcbiAgICBmb3IgKGNvbnN0IHRva2VuQ2xhc3NOYW1lIGluIHRoaXMuVE9LRU5TKSB7XG4gICAgICBjb25zdCBUb2tlbkNsYXNzID0gdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdO1xuICAgICAgU3RyZWFtLnByb3RvdHlwZVtUb2tlbkNsYXNzLmxvd2VyQ2FtZWxDYXNlVHlwZV0gPSBmdW5jdGlvbiAoYXJnTGlzdCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5leHRlbmQoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIHtcbiAgICAgICAgICBsZWZ0OiB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICByaWdodDogb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMucm9vdCA9IHRoaXMubG9hZFJvb3QoKTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMubG9hZENsYXNzZXMoKTtcbiAgfVxuXG4gIGxvYWRSb290ICgpIHtcbiAgICBsZXQgcm9vdCA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ211cmVfcm9vdCcpO1xuICAgIHJvb3QgPSByb290ID8gSlNPTi5wYXJzZShyb290KSA6IHt9O1xuICAgIHJldHVybiByb290O1xuICB9XG4gIHNhdmVSb290ICgpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ211cmVfcm9vdCcsIEpTT04uc3RyaW5naWZ5KHRoaXMucm9vdCkpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jvb3RVcGRhdGUnKTtcbiAgfVxuICBsb2FkQ2xhc3NlcyAoKSB7XG4gICAgbGV0IGNsYXNzZXMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX2NsYXNzZXMnKTtcbiAgICBjbGFzc2VzID0gY2xhc3NlcyA/IEpTT04ucGFyc2UoY2xhc3NlcykgOiB7fTtcbiAgICBPYmplY3QuZW50cmllcyhjbGFzc2VzKS5mb3JFYWNoKChbIGNsYXNzSWQsIHJhd0NsYXNzT2JqIF0pID0+IHtcbiAgICAgIGNvbnN0IGNsYXNzVHlwZSA9IHJhd0NsYXNzT2JqLmNsYXNzVHlwZTtcbiAgICAgIGRlbGV0ZSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICByYXdDbGFzc09iai5tdXJlID0gdGhpcztcbiAgICAgIGNsYXNzZXNbY2xhc3NJZF0gPSBuZXcgdGhpcy5DTEFTU0VTW2NsYXNzVHlwZV0ocmF3Q2xhc3NPYmopO1xuICAgIH0pO1xuICAgIHJldHVybiBjbGFzc2VzO1xuICB9XG4gIGdldFJhd0NsYXNzZXMgKCkge1xuICAgIGNvbnN0IHJhd0NsYXNzZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFsgY2xhc3NJZCwgY2xhc3NPYmogXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICByYXdDbGFzc2VzW2NsYXNzSWRdID0gY2xhc3NPYmoudG9SYXdPYmplY3QoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJhd0NsYXNzZXM7XG4gIH1cbiAgc2F2ZUNsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbXVyZV9jbGFzc2VzJywgSlNPTi5zdHJpbmdpZnkodGhpcy5nZXRSYXdDbGFzc2VzKCkpKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdjbGFzc1VwZGF0ZScpO1xuICB9XG5cbiAgcGFyc2VTZWxlY3RvciAoc2VsZWN0b3JTdHJpbmcpIHtcbiAgICBjb25zdCBzdGFydHNXaXRoUm9vdCA9IHNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ3Jvb3QnKTtcbiAgICBpZiAoIShzdGFydHNXaXRoUm9vdCB8fCBzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdlbXB0eScpKSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBTZWxlY3RvcnMgbXVzdCBzdGFydCB3aXRoICdyb290JyBvciAnZW1wdHknYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5DbGFzc0xpc3QgPSBbe1xuICAgICAgVG9rZW5DbGFzczogc3RhcnRzV2l0aFJvb3QgPyB0aGlzLlRPS0VOUy5Sb290VG9rZW4gOiB0aGlzLlRPS0VOUy5FbXB0eVRva2VuXG4gICAgfV07XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4ge1xuICAgICAgICBkID0gZC50cmltKCk7XG4gICAgICAgIHJldHVybiBkID09PSAnJyA/IHVuZGVmaW5lZCA6IGQ7XG4gICAgICB9KTtcbiAgICAgIGlmICh0b2tlbkNsYXNzTmFtZSA9PT0gJ1ZhbHVlc1Rva2VuJykge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5LZXlzVG9rZW4sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuVmFsdWVUb2tlblxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSxcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIHRva2VuOiAke3RlbXBbMV19YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRva2VuQ2xhc3NMaXN0O1xuICB9XG5cbiAgc3RyZWFtIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IgfHwgYHJvb3QudmFsdWVzKClgKTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIGNyZWF0ZUNsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYGVtcHR5YCB9KSB7XG4gICAgaWYgKCFvcHRpb25zLmNsYXNzSWQpIHtcbiAgICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7TkVYVF9DTEFTU19JRH1gO1xuICAgICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIH1cbiAgICBjb25zdCBDbGFzc1R5cGUgPSBvcHRpb25zLkNsYXNzVHlwZSB8fCB0aGlzLkNMQVNTRVMuR2VuZXJpY0NsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLkNsYXNzVHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IENsYXNzVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBuZXdDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld0NsYXNzT2JqID0gdGhpcy5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0NsYXNzT2JqO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHk7IHRyeSBhZGREeW5hbWljRGF0YVNvdXJjZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSh7XG4gICAgICBrZXk6IGZpbGVPYmoubmFtZSxcbiAgICAgIGV4dGVuc2lvbjogZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24oZmlsZU9iai50eXBlKSxcbiAgICAgIHRleHRcbiAgICB9KTtcbiAgfVxuICBhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBrZXksXG4gICAgZXh0ZW5zaW9uID0gJ3R4dCcsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgbGV0IG9iajtcbiAgICBpZiAodGhpcy5EQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgb2JqID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBkZWxldGUgb2JqLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljRGF0YVNvdXJjZShrZXksIG9iaik7XG4gIH1cbiAgYWRkU3RhdGljRGF0YVNvdXJjZSAoa2V5LCBvYmopIHtcbiAgICB0aGlzLnJvb3Rba2V5XSA9IG9iajtcbiAgICB0aGlzLnNhdmVSb290KCk7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IGByb290LnZhbHVlcygnJHtrZXl9JykudmFsdWVzKClgXG4gICAgfSk7XG4gIH1cbiAgcmVtb3ZlRGF0YVNvdXJjZSAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMucm9vdFtrZXldO1xuICAgIHRoaXMuc2F2ZVJvb3QoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCBGaWxlUmVhZGVyIGZyb20gJ2ZpbGVyZWFkZXInO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKEZpbGVSZWFkZXIsIG51bGwpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImZvckVhY2giLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJPYmplY3QiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIlN0cmVhbSIsIm9wdGlvbnMiLCJtdXJlIiwibmFtZWRGdW5jdGlvbnMiLCJOQU1FRF9GVU5DVElPTlMiLCJuYW1lZFN0cmVhbXMiLCJsYXVuY2hlZEZyb21DbGFzcyIsInRva2VuQ2xhc3NMaXN0IiwidG9rZW5MaXN0IiwibWFwIiwiVG9rZW5DbGFzcyIsImFyZ0xpc3QiLCJXcmFwcGVycyIsImdldFdyYXBwZXJMaXN0IiwiaW5kZXhlcyIsInRva2VuIiwibGVuZ3RoIiwiV3JhcHBlciIsImxvY2FsVG9rZW5MaXN0Iiwic2xpY2UiLCJwb3RlbnRpYWxXcmFwcGVycyIsInZhbHVlcyIsImNsYXNzZXMiLCJmaWx0ZXIiLCJjbGFzc09iaiIsImNsYXNzVG9rZW5MaXN0IiwiZXZlcnkiLCJsb2NhbFRva2VuIiwibG9jYWxJbmRleCIsInRva2VuQ2xhc3NTcGVjIiwiaXNTdWJzZXRPZiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJjb25zb2xlIiwid2FybiIsInNlbGVjdG9yIiwiam9pbiIsImZvcmsiLCJwYXJzZVNlbGVjdG9yIiwiZXh0ZW5kIiwiY29uY2F0Iiwid3JhcCIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwiaGFzaGVzIiwid3JhcHBlckluZGV4IiwidGVtcCIsIndyYXBwZWRJdGVtIiwiZ2V0SW5kZXgiLCJoYXNoRnVuY3Rpb25OYW1lIiwidG9rZW5JbmRleCIsIklOREVYRVMiLCJJbk1lbW9yeUluZGV4IiwiaXRlcmF0ZSIsImxhc3RUb2tlbiIsInNhbXBsZSIsImxpbWl0IiwicmVidWlsZEluZGV4ZXMiLCJpdGVyYXRvciIsIm5leHQiLCJkb25lIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b1N0cmluZyIsInRvTG93ZXJDYXNlIiwiaXNTdWJTZXRPZiIsImFuY2VzdG9yVG9rZW5zIiwiRXJyb3IiLCJpdGVyYXRlUGFyZW50IiwicGFyZW50VG9rZW4iLCJ5aWVsZGVkU29tZXRoaW5nIiwiZGVidWciLCJUeXBlRXJyb3IiLCJleGVjIiwibmFtZSIsIkVtcHR5VG9rZW4iLCJSb290VG9rZW4iLCJyb290IiwiS2V5c1Rva2VuIiwibWF0Y2hBbGwiLCJrZXlzIiwicmFuZ2VzIiwidW5kZWZpbmVkIiwiYXJnIiwibWF0Y2giLCJJbmZpbml0eSIsImQiLCJwYXJzZUludCIsImlzTmFOIiwibG93IiwiaGlnaCIsIm51bSIsIk51bWJlciIsIlN5bnRheEVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImNvbnNvbGlkYXRlUmFuZ2VzIiwic2VsZWN0c05vdGhpbmciLCJuZXdSYW5nZXMiLCJzb3J0IiwiYSIsImIiLCJjdXJyZW50UmFuZ2UiLCJkaWZmZXJlbmNlIiwib3RoZXJUb2tlbiIsIm5ld0tleXMiLCJrZXkiLCJhbGxQb2ludHMiLCJyZWR1Y2UiLCJhZ2ciLCJyYW5nZSIsImluY2x1ZGUiLCJleGNsdWRlIiwiZGlmZiIsIk1hdGgiLCJtYXgiLCJtaW4iLCJoYXNPd25Qcm9wZXJ0eSIsIlZhbHVlVG9rZW4iLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsIm5ld1N0cmVhbSIsImVyciIsIk1hcFRva2VuIiwiZ2VuZXJhdG9yIiwibWFwcGVkUmF3SXRlbSIsIkluZGV4ZWRUb2tlbiIsImhhc2hGdW5jTmFtZSIsImhhc2giLCJlbnRyaWVzIiwiYWRkVmFsdWUiLCJQcm9tb3RlVG9rZW4iLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwibWFwRnVuY3Rpb24iLCJoYXNoRnVuY3Rpb24iLCJyZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiIsImhhc2hJbmRleCIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJnZXRWYWx1ZUxpc3QiLCJKb2luVG9rZW4iLCJvdGhlclN0cmVhbSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiZmluaXNoIiwiZWRnZVJvbGUiLCJoYXNoVGhpc0dyYW5kcGFyZW50IiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwiY29tcGxldGUiLCJ2YWx1ZUxpc3QiLCJpdGVyRW50cmllcyIsIm90aGVyTGlzdCIsIm90aGVyV3JhcHBlZEl0ZW0iLCJ0aGlzV3JhcHBlZEl0ZW0iLCJ0aGlzTGlzdCIsInRoaXNIYXNoSXRlbSIsInRoaXNJdGVyYXRvciIsInRoaXNJbmRpcmVjdEtleSIsInRoaXNJc0RvbmUiLCJvdGhlckl0ZXJhdG9yIiwib3RoZXJJc0RvbmUiLCJBU1RFUklTS1MiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX3NlbGVjdG9yIiwiY3VzdG9tQ2xhc3NOYW1lIiwiY3VzdG9tTmFtZVRva2VuSW5kZXgiLCJhbm5vdGF0aW9ucyIsImZ1bmNOYW1lIiwiRnVuY3Rpb24iLCJ0b1Jhd09iamVjdCIsInJlc3VsdCIsImNsYXNzVHlwZSIsInN0cmluZ2lmaWVkRnVuYyIsInNldENsYXNzTmFtZSIsInNhdmVDbGFzc2VzIiwiaGFzQ3VzdG9tTmFtZSIsImNsYXNzTmFtZSIsInRva2VuU3RyaW5ncyIsInN0YXJ0c1dpdGgiLCJhZGRIYXNoRnVuY3Rpb24iLCJhZGRBdHRyaWJ1dGVBc0hhc2hGdW5jdGlvbiIsImF0dHJOYW1lIiwiZXhwYW5kQXR0cmlidXRlQXNIYXNoRnVuY3Rpb24iLCJkZWxpbWl0ZXIiLCJzcGxpdCIsInRyaW0iLCJwb3B1bGF0ZVN0cmVhbU9wdGlvbnMiLCJnZXRTdHJlYW0iLCJpc1N1cGVyU2V0T2ZUb2tlbkxpc3QiLCJpc1N1cGVyU2V0T2YiLCJpbnRlcnByZXRBc05vZGVzIiwiQ2xhc3NUeXBlIiwiQ0xBU1NFUyIsIk5vZGVDbGFzcyIsIm5ld0NsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIkVkZ2VDbGFzcyIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsImRlbGV0ZSIsIk5vZGVXcmFwcGVyIiwiZWRnZUNvbm5lY3Rpb25zIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJkaXJlY3RlZCIsInRoaXNIYXNoTmFtZSIsIm90aGVySGFzaE5hbWUiLCJuZXdFZGdlIiwiY3JlYXRlQ2xhc3MiLCJzb3VyY2VDbGFzc0lkIiwic291cmNlQ2hhaW4iLCJub2RlSGFzaCIsImVkZ2VIYXNoIiwidGFyZ2V0Q2xhc3NJZCIsInRhcmdldEhhc2hOYW1lIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwiZWRnZUNsYXNzIiwibm9kZUNsYXNzIiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiZWRnZUNsYXNzSWQiLCJkaXNjb25uZWN0U291cmNlcyIsImRpc2Nvbm5lY3RUYXJnZXRzIiwiQ2hhaW4iLCJpbnRlcm1lZGlhdGVzIiwiRWRnZVdyYXBwZXIiLCJ0YXJnZXRDaGFpbiIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJ0YXJnZXQiLCJzb3VyY2UiLCJuZXdOb2RlQ2xhc3MiLCJzb3VyY2VOb2RlQ2xhc3MiLCJuZXdTb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXROb2RlQ2xhc3MiLCJuZXdUYXJnZXRFZGdlQ2xhc3MiLCJkaXJlY3Rpb24iLCJub2RlSGFzaE5hbWUiLCJlZGdlSGFzaE5hbWUiLCJ0b2dnbGVOb2RlRGlyZWN0aW9uIiwibGVmdCIsInJpZ2h0IiwiZWRnZSIsIml0ZXJIYXNoZXMiLCJpdGVyVmFsdWVMaXN0cyIsIk5FWFRfQ0xBU1NfSUQiLCJNdXJlIiwiRmlsZVJlYWRlciIsImxvY2FsU3RvcmFnZSIsIm1pbWUiLCJEQVRBTElCX0ZPUk1BVFMiLCJUT0tFTlMiLCJ0b2tlbkNsYXNzTmFtZSIsInByb3RvdHlwZSIsImlkZW50aXR5IiwicGFyZW50VHlwZSIsImRlZmF1bHRGaW5pc2giLCJzaGExIiwibm9vcCIsImxvYWRSb290IiwibG9hZENsYXNzZXMiLCJnZXRJdGVtIiwicGFyc2UiLCJzYXZlUm9vdCIsInNldEl0ZW0iLCJyYXdDbGFzc09iaiIsImdldFJhd0NsYXNzZXMiLCJyYXdDbGFzc2VzIiwic2VsZWN0b3JTdHJpbmciLCJzdGFydHNXaXRoUm9vdCIsImNodW5rIiwidG9VcHBlckNhc2UiLCJuZXdDbGFzc09iaiIsImFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UiLCJmaWxlT2JqIiwiZW5jb2RpbmciLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsInRleHQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNEYXRhU291cmNlIiwicmVtb3ZlRGF0YVNvdXJjZSIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QkMsdUJBQXZCLEVBQWdEO1VBQzVDLENBQUMsS0FBS0ws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
