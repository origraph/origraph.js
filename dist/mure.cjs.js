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
      this.stickyTriggers[eventName] = this.stickyTriggers[eventName] || { argObj: {} };
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

var asyncIterator = function (iterable) {
  if (typeof Symbol === "function") {
    if (Symbol.asyncIterator) {
      var method = iterable[Symbol.asyncIterator];
      if (method != null) return method.call(iterable);
    }

    if (Symbol.iterator) {
      return iterable[Symbol.iterator]();
    }
  }

  throw new TypeError("Object is not async iterable");
};

var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();

var asyncGeneratorDelegate = function (inner, awaitWrap) {
  var iter = {},
      waiting = false;

  function pump(key, value) {
    waiting = true;
    value = new Promise(function (resolve) {
      resolve(inner[key](value));
    });
    return {
      done: false,
      value: awaitWrap(value)
    };
  }

  if (typeof Symbol === "function" && Symbol.iterator) {
    iter[Symbol.iterator] = function () {
      return this;
    };
  }

  iter.next = function (value) {
    if (waiting) {
      waiting = false;
      return value;
    }

    return pump("next", value);
  };

  if (typeof inner.throw === "function") {
    iter.throw = function (value) {
      if (waiting) {
        waiting = false;
        throw value;
      }

      return pump("throw", value);
    };
  }

  if (typeof inner.return === "function") {
    iter.return = function (value) {
      return pump("return", value);
    };
  }

  return iter;
};

var asyncToGenerator = function (fn) {
  return function () {
    var gen = fn.apply(this, arguments);
    return new Promise(function (resolve, reject) {
      function step(key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error) {
          reject(error);
          return;
        }

        if (info.done) {
          resolve(value);
        } else {
          return Promise.resolve(value).then(function (value) {
            step("next", value);
          }, function (err) {
            step("throw", err);
          });
        }
      }

      return step("next");
    });
  };
};

class Stream {
  constructor(options) {
    this.mure = options.mure;
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.namedStreams = options.namedStreams || {};
    this.launchedFromClass = options.launchedFromClass || null;
    this.indexes = options.indexes || {};
    this.tokenClassList = options.tokenClassList || [];

    // Reminder: this always needs to be after initializing this.namedFunctions
    // and this.namedStreams
    this.tokenList = options.tokenClassList.map(({ TokenClass, argList }) => {
      return new TokenClass(this, argList);
    });
    // Reminder: this always needs to be after initializing this.tokenList
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
      }
      // Find a class that describes exactly each series of tokens
      const localTokenList = this.tokenList.slice(0, index + 1);
      const potentialWrappers = Object.values(this.mure.classes).filter(classObj => {
        if (!classObj.tokenClassList.length !== localTokenList.length) {
          return false;
        }
        return localTokenList.every((localToken, localIndex) => {
          const tokenClassSpec = classObj.tokenClassList[localIndex];
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
    options.tokenClassList = this.tokenClassList.concat([{ TokenClass, argList }]);
    options.launchedFromClass = options.launchedFromClass || this.launchedFromClass;
    options.indexes = Object.assign({}, this.indexes, options.indexes || {});
    return new Stream(options);
  }

  wrap({ wrappedParent, token, rawItem, hashes = {} }) {
    var _this = this;

    return asyncToGenerator(function* () {
      let wrapperIndex = 0;
      let temp = wrappedParent;
      while (temp !== null) {
        wrapperIndex += 1;
        temp = temp.wrappedParent;
      }
      const wrappedItem = new _this.Wrappers[wrapperIndex]({ wrappedParent, token, rawItem });
      yield Promise.all(Object.entries(hashes).reduce(function (promiseList, [hashFunctionName, hash]) {
        const index = _this.getIndex(hashFunctionName);
        if (!index.complete) {
          return promiseList.concat([index.addValue(hash, wrappedItem)]);
        }
      }, []));
      return wrappedItem;
    })();
  }

  iterate() {
    var _this2 = this;

    return asyncGenerator.wrap(function* () {
      const lastToken = _this2.tokenList[_this2.tokenList.length - 1];
      const temp = _this2.tokenList.slice(0, _this2.tokenList.length - 1);
      yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(lastToken.iterate(temp)))), asyncGenerator.await);
    })();
  }

  getIndex(hashFunctionName) {
    if (!this.indexes[hashFunctionName]) {
      // TODO: if using node.js, start with external / more scalable indexes
      this.indexes[hashFunctionName] = new this.mure.INDEXES.InMemoryIndex();
    }
    return this.indexes[hashFunctionName];
  }

  buildIndex(hashFunctionName) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      const hashFunction = _this3.namedFunctions[hashFunctionName];
      if (!hashFunction) {
        throw new Error(`Unknown named function: ${hashFunctionName}`);
      }
      const index = _this3.getIndex(hashFunctionName);
      if (index.complete) {
        return;
      }
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this3.iterate()), _step, _value; _step = yield _iterator.next(), _iteratorNormalCompletion = _step.done, _value = yield _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedItem = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = asyncIterator(hashFunction(wrappedItem)), _step2, _value2; _step2 = yield _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const hash = _value2;

              index.addValue(hash, wrappedItem);
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                yield _iterator2.return();
              }
            } finally {
              if (_didIteratorError2) {
                throw _iteratorError2;
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      index.complete = true;
    })();
  }

  sample({ limit = 10, rebuildIndexes = false }) {
    var _this4 = this;

    return asyncGenerator.wrap(function* () {
      // Before we start, clean out any old indexes that were never finished
      Object.entries(_this4.indexes).forEach(function ([hashFunctionName, index]) {
        if (rebuildIndexes || !index.complete) {
          delete _this4.indexes[hashFunctionName];
        }
      });
      const iterator = _this4.iterate();
      for (let i = 0; i < limit; i++) {
        const temp = yield asyncGenerator.await(iterator.next());
        if (temp.done) {
          // We actually finished a full pass; flag all of our indexes as complete
          Object.values(_this4.indexes).forEach(function (index) {
            index.complete = true;
          });
          break;
        }
        yield temp.value;
      }
    })();
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
  iterate(ancestorTokens) {
    return asyncGenerator.wrap(function* () {
      throw new Error(`This function should be overridden`);
    })();
  }
  iterateParent(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      const parentToken = ancestorTokens[ancestorTokens.length - 1];
      const temp = ancestorTokens.slice(0, ancestorTokens.length - 1);
      let yieldedSomething = false;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(parentToken.iterate(temp)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          yieldedSomething = true;
          yield wrappedParent;
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield asyncGenerator.await(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      if (!yieldedSomething && _this.stream.mure.debug) {
        throw new TypeError(`Token yielded no results: ${parentToken}`);
      }
    })();
  }
}
Object.defineProperty(BaseToken, 'type', {
  get() {
    return (/(.*)Token/.exec(this.name)[1]
    );
  }
});

class EmptyToken extends BaseToken {
  iterate() {
    // yield nothing

    return asyncGenerator.wrap(function* () {})();
  }
  toString() {
    return `empty`;
  }
}

class RootToken extends BaseToken {
  iterate() {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      yield _this.stream.wrap({
        wrappedParent: null,
        token: _this,
        rawItem: _this.stream.mure.root
      });
    })();
  }
  toString() {
    return `root`;
  }
}

class KeysToken extends BaseToken {
  constructor(stream, argList, { matchAll, keys, ranges } = {}) {
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
            this.ranges.push({ low: temp[1], high: temp[2] });
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
          this.ranges.push({ low: num, high: num });
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
            return agg.concat([{ include: true, low: true, value: range.low }, { include: true, high: true, value: range.high }]);
          }, []);
          allPoints = allPoints.concat(otherToken.ranges.reduce((agg, range) => {
            return agg.concat([{ exclude: true, low: true, value: range.low }, { exclude: true, high: true, value: range.high }]);
          }, [])).sort();
          let currentRange = null;
          for (let i = 0; i < allPoints.length; i++) {
            if (currentRange === null) {
              if (allPoints[i].include && allPoints[i].low) {
                currentRange = { low: allPoints[i].value };
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
      return new KeysToken(this.mure, null, { keys: newKeys, ranges: newRanges });
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
    return '.keys(' + (this.ranges || []).map(({ low, high }) => {
      return low === high ? low : `${low}-${high}`;
    }).concat(Object.keys(this.keys || {}).map(key => `'${key}'`)).join(',') + ')';
  }
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if (typeof wrappedParent.rawItem !== 'object') {
            if (!_this.stream.mure.debug) {
              throw new TypeError(`Input to KeysToken is not an object`);
            } else {
              continue;
            }
          }
          if (_this.matchAll) {
            for (let key in wrappedParent.rawItem) {
              yield _this.stream.wrap({
                wrappedParent,
                token: _this,
                rawItem: key
              });
            }
          } else {
            for (let _ref of _this.ranges || []) {
              let { low, high } = _ref;

              low = Math.max(0, low);
              high = Math.min(wrappedParent.rawItem.length - 1, high);
              for (let i = low; i <= high; i++) {
                if (wrappedParent.rawItem[i] !== undefined) {
                  yield _this.stream.wrap({
                    wrappedParent,
                    token: _this,
                    rawItem: i
                  });
                }
              }
            }
            for (let key in _this.keys || {}) {
              if (wrappedParent.rawItem.hasOwnProperty(key)) {
                yield _this.stream.wrap({
                  wrappedParent,
                  token: _this,
                  rawItem: key
                });
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield asyncGenerator.await(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }
}

class ValueToken extends BaseToken {
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          const obj = wrappedParent && wrappedParent.wrappedParent && wrappedParent.wrappedParent.rawItem;
          const key = wrappedParent && wrappedParent.rawItem;
          const keyType = typeof key;
          if (typeof obj !== 'object' || keyType !== 'string' && keyType !== 'number') {
            if (!_this.stream.mure.debug) {
              throw new TypeError(`ValueToken used on a non-object, or without a string / numeric key`);
            } else {
              continue;
            }
          }
          yield _this.stream.wrap({
            wrappedParent,
            token: _this,
            rawItem: obj[key]
          });
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield asyncGenerator.await(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }
}

class EvaluateToken extends BaseToken {
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if (typeof wrappedParent.rawItem !== 'string') {
            if (!_this.stream.mure.debug) {
              throw new TypeError(`Input to EvaluateToken is not a string`);
            } else {
              continue;
            }
          }
          let newStream;
          try {
            newStream = _this.stream.fork(wrappedParent.rawItem);
          } catch (err) {
            if (!_this.stream.mure.debug || !(err instanceof SyntaxError)) {
              throw err;
            } else {
              continue;
            }
          }
          yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(newStream.iterate()))), asyncGenerator.await);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield asyncGenerator.await(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
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
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = asyncIterator(_this.stream.namedFunctions[_this.generator](wrappedParent)), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const mappedRawItem = _value2;

              yield _this.stream.wrap({
                wrappedParent,
                token: _this,
                rawItem: mappedRawItem
              });
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                yield asyncGenerator.await(_iterator2.return());
              }
            } finally {
              if (_didIteratorError2) {
                throw _iteratorError2;
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield asyncGenerator.await(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
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
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          const mapFunction = _this.stream.namedFunctions[_this.map];
          const hashFunction = _this.stream.namedFunctions[_this.hash];
          const reduceInstancesFunction = _this.stream.namedFunctions[_this.reduceInstances];
          const hashIndex = _this.stream.getIndex(_this.hash);
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = asyncIterator(mapFunction(wrappedParent)), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const mappedRawItem = _value2;

              const hash = hashFunction(mappedRawItem);
              let originalWrappedItem = (yield asyncGenerator.await(hashIndex.getValueList(hash)))[0];
              if (originalWrappedItem) {
                if (_this.reduceInstances !== 'noop') {
                  reduceInstancesFunction(originalWrappedItem, mappedRawItem);
                  originalWrappedItem.trigger('update');
                }
              } else {
                const hashes = {};
                hashes[_this.hash] = hash;
                yield _this.stream.wrap({
                  wrappedParent,
                  token: _this,
                  rawItem: mappedRawItem,
                  hashes
                });
              }
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                yield asyncGenerator.await(_iterator2.return());
              }
            } finally {
              if (_didIteratorError2) {
                throw _iteratorError2;
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield asyncGenerator.await(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }
}

class JoinToken extends BaseToken {
  constructor(stream, [otherStream, thisHash = 'key', otherHash = 'key', finish = 'defaultFinish', nthJoin = 0]) {
    super(stream);
    for (const func of [thisHash, finish]) {
      if (!stream.namedFunctions[func]) {
        throw new SyntaxError(`Unknown named function: ${func}`);
      }
    }

    const temp = stream.namedStreams[otherStream];
    if (!temp) {
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
    this.finish = finish;
    this.nthJoin = nthJoin;
  }
  toString() {
    return `.join(${this.otherStream}, ${this.thisHash}, ${this.otherHash}, ${this.finish})`;
  }
  isSubSetOf([otherStream, thisHash = 'key', otherHash = 'key', finish = 'identity']) {
    return this.otherStream === otherStream && this.thisHash === thisHash && this.otherHash === otherHash && this.finish === finish;
  }
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      const otherStream = _this.stream.namedStreams[_this.otherStream];
      const thisHashFunction = _this.stream.namedFunctions[_this.thisHash];
      const otherHashFunction = otherStream.namedFunctions[_this.otherHash];
      const finishFunction = _this.stream.namedFunctions[_this.finish];

      // const thisIterator = this.iterateParent(ancestorTokens);
      // const otherIterator = otherStream.iterate();

      const thisIndex = _this.stream.getIndex(_this.thisHash);
      const otherIndex = otherStream.getIndex(_this.otherHash);

      if (thisIndex.complete) {
        if (otherIndex.complete) {
          // Best of all worlds; we can just join the indexes
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = asyncIterator(thisIndex.iterEntries()), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
              const { hash, valueList } = _value;

              const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
              var _iteratorNormalCompletion2 = true;
              var _didIteratorError2 = false;
              var _iteratorError2 = undefined;

              try {
                for (var _iterator2 = asyncIterator(otherList), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                  const otherWrappedItem = _value2;
                  var _iteratorNormalCompletion3 = true;
                  var _didIteratorError3 = false;
                  var _iteratorError3 = undefined;

                  try {
                    for (var _iterator3 = asyncIterator(valueList), _step3, _value3; _step3 = yield asyncGenerator.await(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield asyncGenerator.await(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
                      const thisWrappedItem = _value3;
                      var _iteratorNormalCompletion4 = true;
                      var _didIteratorError4 = false;
                      var _iteratorError4 = undefined;

                      try {
                        for (var _iterator4 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step4, _value4; _step4 = yield asyncGenerator.await(_iterator4.next()), _iteratorNormalCompletion4 = _step4.done, _value4 = yield asyncGenerator.await(_step4.value), !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                          const rawItem = _value4;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError4 = true;
                        _iteratorError4 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion4 && _iterator4.return) {
                            yield asyncGenerator.await(_iterator4.return());
                          }
                        } finally {
                          if (_didIteratorError4) {
                            throw _iteratorError4;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError3 = true;
                    _iteratorError3 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion3 && _iterator3.return) {
                        yield asyncGenerator.await(_iterator3.return());
                      }
                    } finally {
                      if (_didIteratorError3) {
                        throw _iteratorError3;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion2 && _iterator2.return) {
                    yield asyncGenerator.await(_iterator2.return());
                  }
                } finally {
                  if (_didIteratorError2) {
                    throw _iteratorError2;
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return) {
                yield asyncGenerator.await(_iterator.return());
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        } else {
          // Need to iterate the other items, and take advantage of our complete
          // index
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;
          var _iteratorError5 = undefined;

          try {
            for (var _iterator5 = asyncIterator(otherStream.iterate()), _step5, _value5; _step5 = yield asyncGenerator.await(_iterator5.next()), _iteratorNormalCompletion5 = _step5.done, _value5 = yield asyncGenerator.await(_step5.value), !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
              const otherWrappedItem = _value5;
              var _iteratorNormalCompletion6 = true;
              var _didIteratorError6 = false;
              var _iteratorError6 = undefined;

              try {
                for (var _iterator6 = asyncIterator(otherHashFunction(otherWrappedItem)), _step6, _value6; _step6 = yield asyncGenerator.await(_iterator6.next()), _iteratorNormalCompletion6 = _step6.done, _value6 = yield asyncGenerator.await(_step6.value), !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
                  const hash = _value6;

                  // Add otherWrappedItem to otherIndex:
                  yield asyncGenerator.await(otherIndex.addValue(hash, otherWrappedItem));
                  const thisList = yield asyncGenerator.await(thisIndex.getValueList(hash));
                  var _iteratorNormalCompletion7 = true;
                  var _didIteratorError7 = false;
                  var _iteratorError7 = undefined;

                  try {
                    for (var _iterator7 = asyncIterator(thisList), _step7, _value7; _step7 = yield asyncGenerator.await(_iterator7.next()), _iteratorNormalCompletion7 = _step7.done, _value7 = yield asyncGenerator.await(_step7.value), !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
                      const thisWrappedItem = _value7;
                      var _iteratorNormalCompletion8 = true;
                      var _didIteratorError8 = false;
                      var _iteratorError8 = undefined;

                      try {
                        for (var _iterator8 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step8, _value8; _step8 = yield asyncGenerator.await(_iterator8.next()), _iteratorNormalCompletion8 = _step8.done, _value8 = yield asyncGenerator.await(_step8.value), !_iteratorNormalCompletion8; _iteratorNormalCompletion8 = true) {
                          const rawItem = _value8;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError8 = true;
                        _iteratorError8 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion8 && _iterator8.return) {
                            yield asyncGenerator.await(_iterator8.return());
                          }
                        } finally {
                          if (_didIteratorError8) {
                            throw _iteratorError8;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError7 = true;
                    _iteratorError7 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion7 && _iterator7.return) {
                        yield asyncGenerator.await(_iterator7.return());
                      }
                    } finally {
                      if (_didIteratorError7) {
                        throw _iteratorError7;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError6 = true;
                _iteratorError6 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion6 && _iterator6.return) {
                    yield asyncGenerator.await(_iterator6.return());
                  }
                } finally {
                  if (_didIteratorError6) {
                    throw _iteratorError6;
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError5 = true;
            _iteratorError5 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion5 && _iterator5.return) {
                yield asyncGenerator.await(_iterator5.return());
              }
            } finally {
              if (_didIteratorError5) {
                throw _iteratorError5;
              }
            }
          }
        }
      } else {
        if (otherIndex.complete) {
          // Need to iterate our items, and take advantage of the other complete
          // index
          var _iteratorNormalCompletion9 = true;
          var _didIteratorError9 = false;
          var _iteratorError9 = undefined;

          try {
            for (var _iterator9 = asyncIterator(_this.iterateParent(ancestorTokens)), _step9, _value9; _step9 = yield asyncGenerator.await(_iterator9.next()), _iteratorNormalCompletion9 = _step9.done, _value9 = yield asyncGenerator.await(_step9.value), !_iteratorNormalCompletion9; _iteratorNormalCompletion9 = true) {
              const thisWrappedItem = _value9;
              var _iteratorNormalCompletion10 = true;
              var _didIteratorError10 = false;
              var _iteratorError10 = undefined;

              try {
                for (var _iterator10 = asyncIterator(thisHashFunction(thisWrappedItem)), _step10, _value10; _step10 = yield asyncGenerator.await(_iterator10.next()), _iteratorNormalCompletion10 = _step10.done, _value10 = yield asyncGenerator.await(_step10.value), !_iteratorNormalCompletion10; _iteratorNormalCompletion10 = true) {
                  const hash = _value10;

                  // add thisWrappedItem to thisIndex
                  yield asyncGenerator.await(thisIndex.addValue(hash, thisWrappedItem));
                  const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
                  var _iteratorNormalCompletion11 = true;
                  var _didIteratorError11 = false;
                  var _iteratorError11 = undefined;

                  try {
                    for (var _iterator11 = asyncIterator(otherList), _step11, _value11; _step11 = yield asyncGenerator.await(_iterator11.next()), _iteratorNormalCompletion11 = _step11.done, _value11 = yield asyncGenerator.await(_step11.value), !_iteratorNormalCompletion11; _iteratorNormalCompletion11 = true) {
                      const otherWrappedItem = _value11;
                      var _iteratorNormalCompletion12 = true;
                      var _didIteratorError12 = false;
                      var _iteratorError12 = undefined;

                      try {
                        for (var _iterator12 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step12, _value12; _step12 = yield asyncGenerator.await(_iterator12.next()), _iteratorNormalCompletion12 = _step12.done, _value12 = yield asyncGenerator.await(_step12.value), !_iteratorNormalCompletion12; _iteratorNormalCompletion12 = true) {
                          const rawItem = _value12;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError12 = true;
                        _iteratorError12 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion12 && _iterator12.return) {
                            yield asyncGenerator.await(_iterator12.return());
                          }
                        } finally {
                          if (_didIteratorError12) {
                            throw _iteratorError12;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError11 = true;
                    _iteratorError11 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion11 && _iterator11.return) {
                        yield asyncGenerator.await(_iterator11.return());
                      }
                    } finally {
                      if (_didIteratorError11) {
                        throw _iteratorError11;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError10 = true;
                _iteratorError10 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion10 && _iterator10.return) {
                    yield asyncGenerator.await(_iterator10.return());
                  }
                } finally {
                  if (_didIteratorError10) {
                    throw _iteratorError10;
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError9 = true;
            _iteratorError9 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion9 && _iterator9.return) {
                yield asyncGenerator.await(_iterator9.return());
              }
            } finally {
              if (_didIteratorError9) {
                throw _iteratorError9;
              }
            }
          }
        } else {
          // Neither stream is fully indexed; for more distributed sampling, grab
          // one item from each stream at a time, and use the partial indexes
          const thisIterator = _this.iterateParent(ancestorTokens);
          let thisIsDone = false;
          const otherIterator = otherStream.iterate();
          let otherIsDone = false;

          while (!thisIsDone || !otherIsDone) {
            // Take one sample from this stream
            let temp = yield asyncGenerator.await(thisIterator.next());
            if (temp.done) {
              thisIsDone = true;
            } else {
              const thisWrappedItem = yield asyncGenerator.await(temp.value);
              var _iteratorNormalCompletion13 = true;
              var _didIteratorError13 = false;
              var _iteratorError13 = undefined;

              try {
                for (var _iterator13 = asyncIterator(thisHashFunction(thisWrappedItem)), _step13, _value13; _step13 = yield asyncGenerator.await(_iterator13.next()), _iteratorNormalCompletion13 = _step13.done, _value13 = yield asyncGenerator.await(_step13.value), !_iteratorNormalCompletion13; _iteratorNormalCompletion13 = true) {
                  const hash = _value13;

                  // add thisWrappedItem to thisIndex
                  thisIndex.addValue(hash, thisWrappedItem);
                  const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
                  var _iteratorNormalCompletion14 = true;
                  var _didIteratorError14 = false;
                  var _iteratorError14 = undefined;

                  try {
                    for (var _iterator14 = asyncIterator(otherList), _step14, _value14; _step14 = yield asyncGenerator.await(_iterator14.next()), _iteratorNormalCompletion14 = _step14.done, _value14 = yield asyncGenerator.await(_step14.value), !_iteratorNormalCompletion14; _iteratorNormalCompletion14 = true) {
                      const otherWrappedItem = _value14;
                      var _iteratorNormalCompletion15 = true;
                      var _didIteratorError15 = false;
                      var _iteratorError15 = undefined;

                      try {
                        for (var _iterator15 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step15, _value15; _step15 = yield asyncGenerator.await(_iterator15.next()), _iteratorNormalCompletion15 = _step15.done, _value15 = yield asyncGenerator.await(_step15.value), !_iteratorNormalCompletion15; _iteratorNormalCompletion15 = true) {
                          const rawItem = _value15;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError15 = true;
                        _iteratorError15 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion15 && _iterator15.return) {
                            yield asyncGenerator.await(_iterator15.return());
                          }
                        } finally {
                          if (_didIteratorError15) {
                            throw _iteratorError15;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError14 = true;
                    _iteratorError14 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion14 && _iterator14.return) {
                        yield asyncGenerator.await(_iterator14.return());
                      }
                    } finally {
                      if (_didIteratorError14) {
                        throw _iteratorError14;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError13 = true;
                _iteratorError13 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion13 && _iterator13.return) {
                    yield asyncGenerator.await(_iterator13.return());
                  }
                } finally {
                  if (_didIteratorError13) {
                    throw _iteratorError13;
                  }
                }
              }
            }

            // Now for a sample from the other stream
            temp = yield asyncGenerator.await(otherIterator.next());
            if (temp.done) {
              otherIsDone = true;
            } else {
              const otherWrappedItem = yield asyncGenerator.await(temp.value);
              var _iteratorNormalCompletion16 = true;
              var _didIteratorError16 = false;
              var _iteratorError16 = undefined;

              try {
                for (var _iterator16 = asyncIterator(otherHashFunction(otherWrappedItem)), _step16, _value16; _step16 = yield asyncGenerator.await(_iterator16.next()), _iteratorNormalCompletion16 = _step16.done, _value16 = yield asyncGenerator.await(_step16.value), !_iteratorNormalCompletion16; _iteratorNormalCompletion16 = true) {
                  const hash = _value16;

                  // add otherWrappedItem to otherIndex
                  otherIndex.addValue(hash, otherWrappedItem);
                  const thisList = yield asyncGenerator.await(thisIndex.getValueList(hash));
                  var _iteratorNormalCompletion17 = true;
                  var _didIteratorError17 = false;
                  var _iteratorError17 = undefined;

                  try {
                    for (var _iterator17 = asyncIterator(thisList), _step17, _value17; _step17 = yield asyncGenerator.await(_iterator17.next()), _iteratorNormalCompletion17 = _step17.done, _value17 = yield asyncGenerator.await(_step17.value), !_iteratorNormalCompletion17; _iteratorNormalCompletion17 = true) {
                      const thisWrappedItem = _value17;
                      var _iteratorNormalCompletion18 = true;
                      var _didIteratorError18 = false;
                      var _iteratorError18 = undefined;

                      try {
                        for (var _iterator18 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step18, _value18; _step18 = yield asyncGenerator.await(_iterator18.next()), _iteratorNormalCompletion18 = _step18.done, _value18 = yield asyncGenerator.await(_step18.value), !_iteratorNormalCompletion18; _iteratorNormalCompletion18 = true) {
                          const rawItem = _value18;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError18 = true;
                        _iteratorError18 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion18 && _iterator18.return) {
                            yield asyncGenerator.await(_iterator18.return());
                          }
                        } finally {
                          if (_didIteratorError18) {
                            throw _iteratorError18;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError17 = true;
                    _iteratorError17 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion17 && _iterator17.return) {
                        yield asyncGenerator.await(_iterator17.return());
                      }
                    } finally {
                      if (_didIteratorError17) {
                        throw _iteratorError17;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError16 = true;
                _iteratorError16 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion16 && _iterator16.return) {
                    yield asyncGenerator.await(_iterator16.return());
                  }
                } finally {
                  if (_didIteratorError16) {
                    throw _iteratorError16;
                  }
                }
              }
            }
          }
        }
      }
    })();
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
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      const result = {
        classType: _this.constructor.name,
        selector: _this._selector,
        customClassName: _this.customClassName,
        customNameTokenIndex: _this.customNameTokenIndex,
        classId: _this.classId,
        indexes: {},
        namedFunctions: {}
      };
      for (let [funcName, func] of Object.entries(_this.namedFunctions)) {
        result.namedFunctions[funcName] = func.toString();
      }
      yield Promise.all(Object.entries(_this.indexes).map((() => {
        var _ref = asyncToGenerator(function* ([funcName, index]) {
          if (index.complete) {
            result.indexes[funcName] = yield index.toRawObject();
          }
        });

        return function (_x) {
          return _ref.apply(this, arguments);
        };
      })()));
      return result;
    })();
  }
  wrap(options) {
    return new this.Wrapper(options);
  }
  setClassName(value) {
    var _this2 = this;

    return asyncToGenerator(function* () {
      if (_this2.customClassName !== value) {
        _this2.customClassName = value;
        _this2.customNameTokenIndex = _this2.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
        yield _this2.mure.saveClasses();
      }
    })();
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
  interpretAsNodes() {
    var _this3 = this;

    return asyncToGenerator(function* () {
      const options = yield _this3.toRawObject();
      options.mure = _this3.mure;
      _this3.mure.classes[_this3.classId] = new _this3.mure.CLASSES.NodeClass(options);
      yield _this3.mure.saveClasses();
      return _this3.mure.classes[_this3.classId];
    })();
  }
  interpretAsEdges() {
    var _this4 = this;

    return asyncToGenerator(function* () {
      const options = yield _this4.toRawObject();
      options.mure = _this4.mure;
      _this4.mure.classes[_this4.classId] = new _this4.mure.CLASSES.EdgeClass(options);
      yield _this4.mure.saveClasses();
      return _this4.mure.classes[_this4.classId];
    })();
  }
  aggregate(hash, reduce) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  expand(map) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  filter(filter) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  split(hash) {
    return asyncGenerator.wrap(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  delete() {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
}
Object.defineProperty(GenericClass, 'type', {
  get() {
    return (/(.*)Class/.exec(this.name)[1]
    );
  }
});

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.NodeWrapper;
    this.edgeConnections = options.edgeConnections || {};
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
      // prevents `await super`; this is a workaround:
      const result = yield GenericClass.prototype.toRawObject.call(_this);
      // TODO: need to deep copy edgeConnections?
      result.edgeConnections = _this.edgeConnections;
      return result;
    })();
  }
  interpretAsNodes() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      return _this2;
    })();
  }
  interpretAsEdges() {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  connectToNodeClass({ nodeClass, thisHashName, otherHashName }) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  connectToEdgeClass(options) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      const edgeClass = options.edgeClass;
      delete options.edgeClass;
      options.nodeClass = _this3;
      edgeClass.connectToNodeClass(options);
    })();
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
        return sourceClass.selector + `.join(target, ${sourceHash}, ${targetHash}, defaultFinish)`;
      }
    } else {
      let result = this._selector;
      if (!sourceClass) {
        if (!targetClass) {
          // No connections yet; just yield the raw edge table
          return result;
        } else {
          // Partial edge-target connections
          const { edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId];
          return result + `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        }
      } else if (!targetClass) {
        // Partial source-edge connections
        const { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        return result + `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
      } else {
        // Full connections
        let { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        result += `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        ({ edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId]);
        result += `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, 1)`;
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
    var _this = this;

    return asyncToGenerator(function* () {
      // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
      // prevents `await super`; this is a workaround:
      const result = yield GenericClass.prototype.toRawObject.call(_this);
      result.sourceClassId = _this.sourceClassId;
      result.targetClassId = _this.targetClassId;
      result.directed = _this.directed;
      return result;
    })();
  }
  interpretAsNodes() {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  interpretAsEdges() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      return _this2;
    })();
  }
  connectToNodeClass({ nodeClass, direction, nodeHashName, edgeHashName }) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      if (direction === 'source') {
        if (_this3.sourceClassId) {
          delete _this3.mure.classes[_this3.sourceClassId].edgeConnections[_this3.classId];
        }
        _this3.sourceClassId = nodeClass.classId;
      } else if (direction === 'target') {
        if (_this3.targetClassId) {
          delete _this3.mure.classes[_this3.targetClassId].edgeConnections[_this3.classId];
        }
        _this3.targetClassId = nodeClass.classId;
      } else {
        if (!_this3.sourceClassId) {
          _this3.sourceClassId = nodeClass.classId;
        } else if (!_this3.targetClassId) {
          _this3.targetClassId = nodeClass.classId;
        } else {
          throw new Error(`Source and target are already defined; please specify a direction to override`);
        }
      }
      nodeClass.edgeConnections[_this3.classId] = { nodeHashName, edgeHashName };
      delete _this3._stream;
      yield _this3.mure.saveClasses();
    })();
  }
}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
});

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor({ wrappedParent, token, rawItem }) {
    super();
    this.wrappedParent = wrappedParent;
    this.token = token;
    this.rawItem = rawItem;
  }
}
Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return (/(.*)Wrapper/.exec(this.name)[1]
    );
  }
});

class NodeWrapper extends GenericWrapper {}

class EdgeWrapper extends GenericWrapper {}



var WRAPPERS = /*#__PURE__*/Object.freeze({
  GenericWrapper: GenericWrapper,
  NodeWrapper: NodeWrapper,
  EdgeWrapper: EdgeWrapper
});

class InMemoryIndex {
  constructor({ entries = {}, complete = false } = {}) {
    this.entries = entries;
    this.complete = complete;
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      return _this.entries;
    })();
  }
  iterEntries() {
    var _this2 = this;

    return asyncGenerator.wrap(function* () {
      for (const [hash, valueList] of Object.entries(_this2.entries)) {
        yield { hash, valueList };
      }
    })();
  }
  iterHashes() {
    var _this3 = this;

    return asyncGenerator.wrap(function* () {
      for (const hash of Object.keys(_this3.entries)) {
        yield hash;
      }
    })();
  }
  iterValueLists() {
    var _this4 = this;

    return asyncGenerator.wrap(function* () {
      for (const valueList of Object.values(_this4.entries)) {
        yield valueList;
      }
    })();
  }
  getValueList(hash) {
    var _this5 = this;

    return asyncToGenerator(function* () {
      return _this5.entries[hash] || [];
    })();
  }
  addValue(hash, value) {
    var _this6 = this;

    return asyncToGenerator(function* () {
      // TODO: add some kind of warning if this is getting big?
      _this6.entries[hash] = yield _this6.getValueList(hash);
      _this6.entries[hash].push(value);
    })();
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
    };

    // Access to core classes via the main library helps avoid circular imports
    this.TOKENS = TOKENS;
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;
    this.INDEXES = INDEXES;

    // Monkey-patch available tokens as functions onto the Stream class
    for (const tokenClassName in this.TOKENS) {
      const TokenClass = this.TOKENS[tokenClassName];
      Stream.prototype[TokenClass.lowerCamelCaseType] = function (argList, options) {
        return this.extend(TokenClass, argList, options);
      };
    }

    // Default named functions
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
        if (thisWrappedItem.rawItem instanceof Array) {
          // if relevant, merge the results of a series of joins into a single
          // array
          yield thisWrappedItem.rawItem.concat([otherWrappedItem.rawItem]);
        } else {
          // otherwise just yield the two results as an array
          yield [thisWrappedItem.rawItem, otherWrappedItem.rawItem];
        }
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    };

    // Object containing each of our data sources
    this.root = this.loadRoot();

    // Object containing our class specifications
    this.classes = this.loadClasses();
  }

  loadRoot() {
    let root = this.localStorage && this.localStorage.getItem('mure_root');
    root = root ? JSON.parse(root) : {};
    return root;
  }
  saveRoot() {
    var _this = this;

    return asyncToGenerator(function* () {
      if (_this.localStorage) {
        _this.localStorage.setItem('mure_root', JSON.stringify(_this.root));
      }
      _this.trigger('rootUpdate');
    })();
  }
  loadClasses() {
    let classes = this.localStorage && this.localStorage.getItem('mure_classes');
    classes = classes ? JSON.parse(classes) : {};
    Object.entries(classes).forEach(([classId, rawClassObj]) => {
      Object.entries(rawClassObj.indexes).forEach(([funcName, rawIndexObj]) => {
        rawClassObj.indexes[funcName] = new this.INDEXES.InMemoryIndex({
          entries: rawIndexObj, complete: true
        });
      });
      const classType = rawClassObj.classType;
      delete rawClassObj.classType;
      rawClassObj.mure = this;
      classes[classId] = new this.CLASSES[classType](rawClassObj);
    });
    return classes;
  }
  saveClasses() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      if (_this2.localStorage) {
        const rawClasses = {};
        yield Promise.all(Object.entries(_this2.classes).map((() => {
          var _ref = asyncToGenerator(function* ([classId, classObj]) {
            rawClasses[classId] = yield classObj.toRawObject();
          });

          return function (_x) {
            return _ref.apply(this, arguments);
          };
        })()));
        _this2.localStorage.setItem('mure_classes', JSON.stringify(rawClasses));
      }
      _this2.trigger('classUpdate');
    })();
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

  newClass(options = { selector: `root` }) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      options.classId = `class${NEXT_CLASS_ID}`;
      NEXT_CLASS_ID += 1;
      const ClassType = options.ClassType || _this3.CLASSES.GenericClass;
      delete options.ClassType;
      options.mure = _this3;
      _this3.classes[options.classId] = new ClassType(options);
      yield _this3.saveClasses();
      return _this3.classes[options.classId];
    })();
  }

  addFileAsStaticDataSource({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    var _this4 = this;

    return asyncToGenerator(function* () {
      const fileMB = fileObj.size / 1048576;
      if (fileMB >= 30) {
        if (skipSizeCheck) {
          console.warn(`Attempting to load ${fileMB}MB file into memory`);
        } else {
          throw new Error(`${fileMB}MB file is too large to load statically; try addDynamicDataSource() instead.`);
        }
      }
      // extensionOverride allows things like topojson or treejson (that don't
      // have standardized mimeTypes) to be parsed correctly
      let text = yield new Promise(function (resolve, reject) {
        let reader = new _this4.FileReader();
        reader.onload = function () {
          resolve(reader.result);
        };
        reader.readAsText(fileObj, encoding);
      });
      return _this4.addStringAsStaticDataSource({
        key: fileObj.name,
        extension: extensionOverride || mime.extension(fileObj.type),
        text
      });
    })();
  }
  addStringAsStaticDataSource({
    key,
    extension = 'txt',
    text
  }) {
    var _this5 = this;

    return asyncToGenerator(function* () {
      let obj;
      if (_this5.DATALIB_FORMATS[extension]) {
        obj = datalib.read(text, { type: extension });
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
      return _this5.addStaticDataSource(key, obj);
    })();
  }
  addStaticDataSource(key, obj) {
    var _this6 = this;

    return asyncToGenerator(function* () {
      _this6.root[key] = obj;
      const temp = yield Promise.all([_this6.saveRoot(), _this6.newClass({
        selector: `root.values('${key}').values()`
      })]);
      return temp[1];
    })();
  }
  removeDataSource(key) {
    var _this7 = this;

    return asyncToGenerator(function* () {
      delete _this7.root[key];
      yield _this7.saveRoot();
    })();
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
var files = ["dist"];
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
	"babel-core": "^6.26.3",
	"babel-plugin-external-helpers": "^6.22.0",
	"babel-preset-env": "^1.7.0",
	"babel-preset-stage-3": "^6.24.1",
	coveralls: "^3.0.2",
	filereader: "^0.10.3",
	jest: "^23.5.0",
	"pouchdb-node": "^7.0.0",
	rollup: "^0.65.0",
	"rollup-plugin-babel": "^3.0.7",
	"rollup-plugin-commonjs": "^9.1.6",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.2.1",
	"rollup-plugin-node-resolve": "^3.3.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
	"mime-types": "^2.1.19",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIHRoaXMubmFtZWRTdHJlYW1zID0gb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge307XG4gICAgdGhpcy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgbnVsbDtcbiAgICB0aGlzLmluZGV4ZXMgPSBvcHRpb25zLmluZGV4ZXMgfHwge307XG4gICAgdGhpcy50b2tlbkNsYXNzTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgfHwgW107XG5cbiAgICAvLyBSZW1pbmRlcjogdGhpcyBhbHdheXMgbmVlZHMgdG8gYmUgYWZ0ZXIgaW5pdGlhbGl6aW5nIHRoaXMubmFtZWRGdW5jdGlvbnNcbiAgICAvLyBhbmQgdGhpcy5uYW1lZFN0cmVhbXNcbiAgICB0aGlzLnRva2VuTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QubWFwKCh7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBUb2tlbkNsYXNzKHRoaXMsIGFyZ0xpc3QpO1xuICAgIH0pO1xuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy50b2tlbkxpc3RcbiAgICB0aGlzLldyYXBwZXJzID0gdGhpcy5nZXRXcmFwcGVyTGlzdCgpO1xuICB9XG5cbiAgZ2V0V3JhcHBlckxpc3QgKCkge1xuICAgIC8vIExvb2sgdXAgd2hpY2gsIGlmIGFueSwgY2xhc3NlcyBkZXNjcmliZSB0aGUgcmVzdWx0IG9mIGVhY2ggdG9rZW4sIHNvIHRoYXRcbiAgICAvLyB3ZSBjYW4gd3JhcCBpdGVtcyBhcHByb3ByaWF0ZWx5OlxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5tYXAoKHRva2VuLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKGluZGV4ID09PSB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxICYmIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MpIHtcbiAgICAgICAgLy8gSWYgdGhpcyBzdHJlYW0gd2FzIHN0YXJ0ZWQgZnJvbSBhIGNsYXNzLCB3ZSBhbHJlYWR5IGtub3cgd2Ugc2hvdWxkXG4gICAgICAgIC8vIHVzZSB0aGF0IGNsYXNzJ3Mgd3JhcHBlciBmb3IgdGhlIGxhc3QgdG9rZW5cbiAgICAgICAgcmV0dXJuIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MuV3JhcHBlcjtcbiAgICAgIH1cbiAgICAgIC8vIEZpbmQgYSBjbGFzcyB0aGF0IGRlc2NyaWJlcyBleGFjdGx5IGVhY2ggc2VyaWVzIG9mIHRva2Vuc1xuICAgICAgY29uc3QgbG9jYWxUb2tlbkxpc3QgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCBpbmRleCArIDEpO1xuICAgICAgY29uc3QgcG90ZW50aWFsV3JhcHBlcnMgPSBPYmplY3QudmFsdWVzKHRoaXMubXVyZS5jbGFzc2VzKVxuICAgICAgICAuZmlsdGVyKGNsYXNzT2JqID0+IHtcbiAgICAgICAgICBpZiAoIWNsYXNzT2JqLnRva2VuQ2xhc3NMaXN0Lmxlbmd0aCAhPT0gbG9jYWxUb2tlbkxpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuTGlzdC5ldmVyeSgobG9jYWxUb2tlbiwgbG9jYWxJbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdG9rZW5DbGFzc1NwZWMgPSBjbGFzc09iai50b2tlbkNsYXNzTGlzdFtsb2NhbEluZGV4XTtcbiAgICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuIGluc3RhbmNlb2YgdG9rZW5DbGFzc1NwZWMuVG9rZW5DbGFzcyAmJlxuICAgICAgICAgICAgICB0b2tlbi5pc1N1YnNldE9mKHRva2VuQ2xhc3NTcGVjLmFyZ0xpc3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gTm8gY2xhc3NlcyBkZXNjcmliZSB0aGlzIHNlcmllcyBvZiB0b2tlbnMsIHNvIHVzZSB0aGUgZ2VuZXJpYyB3cmFwcGVyXG4gICAgICAgIHJldHVybiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgTXVsdGlwbGUgY2xhc3NlcyBkZXNjcmliZSB0aGUgc2FtZSBpdGVtISBBcmJpdHJhcmlseSBjaG9vc2luZyBvbmUuLi5gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcG90ZW50aWFsV3JhcHBlcnNbMF0uV3JhcHBlcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmpvaW4oJycpO1xuICB9XG5cbiAgZm9yayAoc2VsZWN0b3IpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICBuYW1lZEZ1bmN0aW9uczogdGhpcy5uYW1lZEZ1bmN0aW9ucyxcbiAgICAgIG5hbWVkU3RyZWFtczogdGhpcy5uYW1lZFN0cmVhbXMsXG4gICAgICB0b2tlbkNsYXNzTGlzdDogdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3Ioc2VsZWN0b3IpLFxuICAgICAgbGF1bmNoZWRGcm9tQ2xhc3M6IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MsXG4gICAgICBpbmRleGVzOiB0aGlzLmluZGV4ZXNcbiAgICB9KTtcbiAgfVxuXG4gIGV4dGVuZCAoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkRnVuY3Rpb25zLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBvcHRpb25zLm5hbWVkU3RyZWFtcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRTdHJlYW1zLCBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fSk7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMudG9rZW5DbGFzc0xpc3QuY29uY2F0KFt7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfV0pO1xuICAgIG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgPSBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzIHx8IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3M7XG4gICAgb3B0aW9ucy5pbmRleGVzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5pbmRleGVzLCBvcHRpb25zLmluZGV4ZXMgfHwge30pO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG5cbiAgYXN5bmMgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSwgaGFzaGVzID0ge30gfSkge1xuICAgIGxldCB3cmFwcGVySW5kZXggPSAwO1xuICAgIGxldCB0ZW1wID0gd3JhcHBlZFBhcmVudDtcbiAgICB3aGlsZSAodGVtcCAhPT0gbnVsbCkge1xuICAgICAgd3JhcHBlckluZGV4ICs9IDE7XG4gICAgICB0ZW1wID0gdGVtcC53cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IG5ldyB0aGlzLldyYXBwZXJzW3dyYXBwZXJJbmRleF0oeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyhoYXNoZXMpLnJlZHVjZSgocHJvbWlzZUxpc3QsIFtoYXNoRnVuY3Rpb25OYW1lLCBoYXNoXSkgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmdldEluZGV4KGhhc2hGdW5jdGlvbk5hbWUpO1xuICAgICAgaWYgKCFpbmRleC5jb21wbGV0ZSkge1xuICAgICAgICByZXR1cm4gcHJvbWlzZUxpc3QuY29uY2F0KFsgaW5kZXguYWRkVmFsdWUoaGFzaCwgd3JhcHBlZEl0ZW0pIF0pO1xuICAgICAgfVxuICAgIH0sIFtdKSk7XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG5cbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICBjb25zdCBsYXN0VG9rZW4gPSB0aGlzLnRva2VuTGlzdFt0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50b2tlbkxpc3Quc2xpY2UoMCwgdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSk7XG4gICAgeWllbGQgKiBhd2FpdCBsYXN0VG9rZW4uaXRlcmF0ZSh0ZW1wKTtcbiAgfVxuXG4gIGdldEluZGV4IChoYXNoRnVuY3Rpb25OYW1lKSB7XG4gICAgaWYgKCF0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV0pIHtcbiAgICAgIC8vIFRPRE86IGlmIHVzaW5nIG5vZGUuanMsIHN0YXJ0IHdpdGggZXh0ZXJuYWwgLyBtb3JlIHNjYWxhYmxlIGluZGV4ZXNcbiAgICAgIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSA9IG5ldyB0aGlzLm11cmUuSU5ERVhFUy5Jbk1lbW9yeUluZGV4KCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV07XG4gIH1cblxuICBhc3luYyBidWlsZEluZGV4IChoYXNoRnVuY3Rpb25OYW1lKSB7XG4gICAgY29uc3QgaGFzaEZ1bmN0aW9uID0gdGhpcy5uYW1lZEZ1bmN0aW9uc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgICBpZiAoIWhhc2hGdW5jdGlvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2hhc2hGdW5jdGlvbk5hbWV9YCk7XG4gICAgfVxuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJbmRleChoYXNoRnVuY3Rpb25OYW1lKTtcbiAgICBpZiAoaW5kZXguY29tcGxldGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIGhhc2hGdW5jdGlvbih3cmFwcGVkSXRlbSkpIHtcbiAgICAgICAgaW5kZXguYWRkVmFsdWUoaGFzaCwgd3JhcHBlZEl0ZW0pO1xuICAgICAgfVxuICAgIH1cbiAgICBpbmRleC5jb21wbGV0ZSA9IHRydWU7XG4gIH1cblxuICBhc3luYyAqIHNhbXBsZSAoeyBsaW1pdCA9IDEwLCByZWJ1aWxkSW5kZXhlcyA9IGZhbHNlIH0pIHtcbiAgICAvLyBCZWZvcmUgd2Ugc3RhcnQsIGNsZWFuIG91dCBhbnkgb2xkIGluZGV4ZXMgdGhhdCB3ZXJlIG5ldmVyIGZpbmlzaGVkXG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5pbmRleGVzKS5mb3JFYWNoKChbaGFzaEZ1bmN0aW9uTmFtZSwgaW5kZXhdKSA9PiB7XG4gICAgICBpZiAocmVidWlsZEluZGV4ZXMgfHwgIWluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV07XG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGUoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIC8vIFdlIGFjdHVhbGx5IGZpbmlzaGVkIGEgZnVsbCBwYXNzOyBmbGFnIGFsbCBvZiBvdXIgaW5kZXhlcyBhcyBjb21wbGV0ZVxuICAgICAgICBPYmplY3QudmFsdWVzKHRoaXMuaW5kZXhlcykuZm9yRWFjaChpbmRleCA9PiB7XG4gICAgICAgICAgaW5kZXguY29tcGxldGUgPSB0cnVlO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RyZWFtO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEJhc2VUb2tlbiBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zdHJlYW0gPSBzdHJlYW07XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIC8vIFRoZSBzdHJpbmcgdmVyc2lvbiBvZiBtb3N0IHRva2VucyBjYW4ganVzdCBiZSBkZXJpdmVkIGZyb20gdGhlIGNsYXNzIHR5cGVcbiAgICByZXR1cm4gYC4ke3RoaXMudHlwZS50b0xvd2VyQ2FzZSgpfSgpYDtcbiAgfVxuICBpc1N1YlNldE9mICgpIHtcbiAgICAvLyBCeSBkZWZhdWx0ICh3aXRob3V0IGFueSBhcmd1bWVudHMpLCB0b2tlbnMgb2YgdGhlIHNhbWUgY2xhc3MgYXJlIHN1YnNldHNcbiAgICAvLyBvZiBlYWNoIG90aGVyXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZVBhcmVudCAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUb2tlbiA9IGFuY2VzdG9yVG9rZW5zW2FuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSBhbmNlc3RvclRva2Vucy5zbGljZSgwLCBhbmNlc3RvclRva2Vucy5sZW5ndGggLSAxKTtcbiAgICBsZXQgeWllbGRlZFNvbWV0aGluZyA9IGZhbHNlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUb2tlbi5pdGVyYXRlKHRlbXApKSB7XG4gICAgICB5aWVsZGVkU29tZXRoaW5nID0gdHJ1ZTtcbiAgICAgIHlpZWxkIHdyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGlmICgheWllbGRlZFNvbWV0aGluZyAmJiB0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBUb2tlbiB5aWVsZGVkIG5vIHJlc3VsdHM6ICR7cGFyZW50VG9rZW59YCk7XG4gICAgfVxuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQmFzZVRva2VuLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUb2tlbi8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEJhc2VUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFbXB0eVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICAvLyB5aWVsZCBub3RoaW5nXG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgZW1wdHlgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFbXB0eVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFJvb3RUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICB3cmFwcGVkUGFyZW50OiBudWxsLFxuICAgICAgdG9rZW46IHRoaXMsXG4gICAgICByYXdJdGVtOiB0aGlzLnN0cmVhbS5tdXJlLnJvb3RcbiAgICB9KTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGByb290YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUm9vdFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEtleXNUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIGFyZ0xpc3QsIHsgbWF0Y2hBbGwsIGtleXMsIHJhbmdlcyB9ID0ge30pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmIChrZXlzIHx8IHJhbmdlcykge1xuICAgICAgdGhpcy5rZXlzID0ga2V5cztcbiAgICAgIHRoaXMucmFuZ2VzID0gcmFuZ2VzO1xuICAgIH0gZWxzZSBpZiAoKGFyZ0xpc3QgJiYgYXJnTGlzdC5sZW5ndGggPT09IDEgJiYgYXJnTGlzdFswXSA9PT0gdW5kZWZpbmVkKSB8fCBtYXRjaEFsbCkge1xuICAgICAgdGhpcy5tYXRjaEFsbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFyZ0xpc3QuZm9yRWFjaChhcmcgPT4ge1xuICAgICAgICBsZXQgdGVtcCA9IGFyZy5tYXRjaCgvKFxcZCspLShbXFxk4oieXSspLyk7XG4gICAgICAgIGlmICh0ZW1wICYmIHRlbXBbMl0gPT09ICfiiJ4nKSB7XG4gICAgICAgICAgdGVtcFsyXSA9IEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSB0ZW1wID8gdGVtcC5tYXAoZCA9PiBkLnBhcnNlSW50KGQpKSA6IG51bGw7XG4gICAgICAgIGlmICh0ZW1wICYmICFpc05hTih0ZW1wWzFdKSAmJiAhaXNOYU4odGVtcFsyXSkpIHtcbiAgICAgICAgICBmb3IgKGxldCBpID0gdGVtcFsxXTsgaSA8PSB0ZW1wWzJdOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5yYW5nZXMgfHwgW107XG4gICAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiB0ZW1wWzFdLCBoaWdoOiB0ZW1wWzJdIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IGFyZy5tYXRjaCgvJyguKiknLyk7XG4gICAgICAgIHRlbXAgPSB0ZW1wICYmIHRlbXBbMV0gPyB0ZW1wWzFdIDogYXJnO1xuICAgICAgICBsZXQgbnVtID0gTnVtYmVyKHRlbXApO1xuICAgICAgICBpZiAoaXNOYU4obnVtKSB8fCBudW0gIT09IHBhcnNlSW50KHRlbXApKSB7IC8vIGxlYXZlIG5vbi1pbnRlZ2VyIG51bWJlcnMgYXMgc3RyaW5nc1xuICAgICAgICAgIHRoaXMua2V5cyA9IHRoaXMua2V5cyB8fCB7fTtcbiAgICAgICAgICB0aGlzLmtleXNbdGVtcF0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5yYW5nZXMgfHwgW107XG4gICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogbnVtLCBoaWdoOiBudW0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCF0aGlzLmtleXMgJiYgIXRoaXMucmFuZ2VzKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgQmFkIHRva2VuIGtleShzKSAvIHJhbmdlKHMpOiAke0pTT04uc3RyaW5naWZ5KGFyZ0xpc3QpfWApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5jb25zb2xpZGF0ZVJhbmdlcyh0aGlzLnJhbmdlcyk7XG4gICAgfVxuICB9XG4gIGdldCBzZWxlY3RzTm90aGluZyAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1hdGNoQWxsICYmICF0aGlzLmtleXMgJiYgIXRoaXMucmFuZ2VzO1xuICB9XG4gIGNvbnNvbGlkYXRlUmFuZ2VzIChyYW5nZXMpIHtcbiAgICAvLyBNZXJnZSBhbnkgb3ZlcmxhcHBpbmcgcmFuZ2VzXG4gICAgY29uc3QgbmV3UmFuZ2VzID0gW107XG4gICAgY29uc3QgdGVtcCA9IHJhbmdlcy5zb3J0KChhLCBiKSA9PiBhLmxvdyAtIGIubG93KTtcbiAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRlbXAubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghY3VycmVudFJhbmdlKSB7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9IGVsc2UgaWYgKHRlbXBbaV0ubG93IDw9IGN1cnJlbnRSYW5nZS5oaWdoKSB7XG4gICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gdGVtcFtpXS5oaWdoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGN1cnJlbnRSYW5nZSkge1xuICAgICAgLy8gQ29ybmVyIGNhc2U6IGFkZCB0aGUgbGFzdCByYW5nZVxuICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld1Jhbmdlcy5sZW5ndGggPiAwID8gbmV3UmFuZ2VzIDogdW5kZWZpbmVkO1xuICB9XG4gIGRpZmZlcmVuY2UgKG90aGVyVG9rZW4pIHtcbiAgICAvLyBDb21wdXRlIHdoYXQgaXMgbGVmdCBvZiB0aGlzIGFmdGVyIHN1YnRyYWN0aW5nIG91dCBldmVyeXRoaW5nIGluIG90aGVyVG9rZW5cbiAgICBpZiAoIShvdGhlclRva2VuIGluc3RhbmNlb2YgS2V5c1Rva2VuKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBjb21wdXRlIHRoZSBkaWZmZXJlbmNlIG9mIHR3byBkaWZmZXJlbnQgdG9rZW4gdHlwZXNgKTtcbiAgICB9IGVsc2UgaWYgKG90aGVyVG9rZW4ubWF0Y2hBbGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAodGhpcy5tYXRjaEFsbCkge1xuICAgICAgY29uc29sZS53YXJuKGBJbmFjY3VyYXRlIGRpZmZlcmVuY2UgY29tcHV0ZWQhIFRPRE86IG5lZWQgdG8gZmlndXJlIG91dCBob3cgdG8gaW52ZXJ0IGNhdGVnb3JpY2FsIGtleXMhYCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmV3S2V5cyA9IHt9O1xuICAgICAgZm9yIChsZXQga2V5IGluICh0aGlzLmtleXMgfHwge30pKSB7XG4gICAgICAgIGlmICghb3RoZXJUb2tlbi5rZXlzIHx8ICFvdGhlclRva2VuLmtleXNba2V5XSkge1xuICAgICAgICAgIG5ld0tleXNba2V5XSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdSYW5nZXMgPSBbXTtcbiAgICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgICBpZiAob3RoZXJUb2tlbi5yYW5nZXMpIHtcbiAgICAgICAgICBsZXQgYWxsUG9pbnRzID0gdGhpcy5yYW5nZXMucmVkdWNlKChhZ2csIHJhbmdlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChbXG4gICAgICAgICAgICAgIHsgaW5jbHVkZTogdHJ1ZSwgbG93OiB0cnVlLCB2YWx1ZTogcmFuZ2UubG93IH0sXG4gICAgICAgICAgICAgIHsgaW5jbHVkZTogdHJ1ZSwgaGlnaDogdHJ1ZSwgdmFsdWU6IHJhbmdlLmhpZ2ggfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgfSwgW10pO1xuICAgICAgICAgIGFsbFBvaW50cyA9IGFsbFBvaW50cy5jb25jYXQob3RoZXJUb2tlbi5yYW5nZXMucmVkdWNlKChhZ2csIHJhbmdlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChbXG4gICAgICAgICAgICAgIHsgZXhjbHVkZTogdHJ1ZSwgbG93OiB0cnVlLCB2YWx1ZTogcmFuZ2UubG93IH0sXG4gICAgICAgICAgICAgIHsgZXhjbHVkZTogdHJ1ZSwgaGlnaDogdHJ1ZSwgdmFsdWU6IHJhbmdlLmhpZ2ggfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgfSwgW10pKS5zb3J0KCk7XG4gICAgICAgICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxQb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSB7IGxvdzogYWxsUG9pbnRzW2ldLnZhbHVlIH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmhpZ2gpIHtcbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0udmFsdWU7XG4gICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uZXhjbHVkZSkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLmxvdyAtIDE7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmhpZ2gpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UubG93ID0gYWxsUG9pbnRzW2ldLmhpZ2ggKyAxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5ld1JhbmdlcyA9IHRoaXMucmFuZ2VzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IEtleXNUb2tlbih0aGlzLm11cmUsIG51bGwsIHsga2V5czogbmV3S2V5cywgcmFuZ2VzOiBuZXdSYW5nZXMgfSk7XG4gICAgfVxuICB9XG4gIGlzU3ViU2V0T2YgKGFyZ0xpc3QpIHtcbiAgICBjb25zdCBvdGhlclRva2VuID0gbmV3IEtleXNUb2tlbih0aGlzLnN0cmVhbSwgYXJnTGlzdCk7XG4gICAgY29uc3QgZGlmZiA9IG90aGVyVG9rZW4uZGlmZmVyZW5jZSh0aGlzKTtcbiAgICByZXR1cm4gZGlmZiA9PT0gbnVsbCB8fCBkaWZmLnNlbGVjdHNOb3RoaW5nO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICBpZiAodGhpcy5tYXRjaEFsbCkgeyByZXR1cm4gJy5rZXlzKCknOyB9XG4gICAgcmV0dXJuICcua2V5cygnICsgKHRoaXMucmFuZ2VzIHx8IFtdKS5tYXAoKHtsb3csIGhpZ2h9KSA9PiB7XG4gICAgICByZXR1cm4gbG93ID09PSBoaWdoID8gbG93IDogYCR7bG93fS0ke2hpZ2h9YDtcbiAgICB9KS5jb25jYXQoT2JqZWN0LmtleXModGhpcy5rZXlzIHx8IHt9KS5tYXAoa2V5ID0+IGAnJHtrZXl9J2ApKVxuICAgICAgLmpvaW4oJywnKSArICcpJztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGlmICh0eXBlb2Ygd3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBLZXlzVG9rZW4gaXMgbm90IGFuIG9iamVjdGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5tYXRjaEFsbCkge1xuICAgICAgICBmb3IgKGxldCBrZXkgaW4gd3JhcHBlZFBhcmVudC5yYXdJdGVtKSB7XG4gICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChsZXQge2xvdywgaGlnaH0gb2YgdGhpcy5yYW5nZXMgfHwgW10pIHtcbiAgICAgICAgICBsb3cgPSBNYXRoLm1heCgwLCBsb3cpO1xuICAgICAgICAgIGhpZ2ggPSBNYXRoLm1pbih3cmFwcGVkUGFyZW50LnJhd0l0ZW0ubGVuZ3RoIC0gMSwgaGlnaCk7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IGxvdzsgaSA8PSBoaWdoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW1baV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgIHJhd0l0ZW06IGlcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGtleSBpbiB0aGlzLmtleXMgfHwge30pIHtcbiAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEtleXNUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBWYWx1ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBjb25zdCBvYmogPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgIGNvbnN0IGtleSA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgY29uc3Qga2V5VHlwZSA9IHR5cGVvZiBrZXk7XG4gICAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgfHwgKGtleVR5cGUgIT09ICdzdHJpbmcnICYmIGtleVR5cGUgIT09ICdudW1iZXInKSkge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBWYWx1ZVRva2VuIHVzZWQgb24gYSBub24tb2JqZWN0LCBvciB3aXRob3V0IGEgc3RyaW5nIC8gbnVtZXJpYyBrZXlgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICByYXdJdGVtOiBvYmpba2V5XVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBWYWx1ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEV2YWx1YXRlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGlmICh0eXBlb2Ygd3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBFdmFsdWF0ZVRva2VuIGlzIG5vdCBhIHN0cmluZ2ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3U3RyZWFtO1xuICAgICAgdHJ5IHtcbiAgICAgICAgbmV3U3RyZWFtID0gdGhpcy5zdHJlYW0uZm9yayh3cmFwcGVkUGFyZW50LnJhd0l0ZW0pO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1ZyB8fCAhKGVyciBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSkge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgeWllbGQgKiBhd2FpdCBuZXdTdHJlYW0uaXRlcmF0ZSgpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXZhbHVhdGVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBNYXBUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tnZW5lcmF0b3JdKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7Z2VuZXJhdG9yfWApO1xuICAgIH1cbiAgICB0aGlzLmdlbmVyYXRvciA9IGdlbmVyYXRvcjtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAubWFwKCR7dGhpcy5nZW5lcmF0b3J9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICByZXR1cm4gZ2VuZXJhdG9yID09PSB0aGlzLmdlbmVyYXRvcjtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmdlbmVyYXRvcl0od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNYXBUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBQcm9tb3RlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgWyBtYXAsIGhhc2gsIHJlZHVjZUluc3RhbmNlcyBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tmdW5jXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7ZnVuY31gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5tYXAgPSBtYXA7XG4gICAgdGhpcy5oYXNoID0gaGFzaDtcbiAgICB0aGlzLnJlZHVjZUluc3RhbmNlcyA9IHJlZHVjZUluc3RhbmNlcztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAucHJvbW90ZSgke3RoaXMubWFwfSwgJHt0aGlzLmhhc2h9LCAke3RoaXMucmVkdWNlSW5zdGFuY2VzfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICByZXR1cm4gdGhpcy5tYXAgPT09IG1hcCAmJlxuICAgICAgdGhpcy5oYXNoID09PSBoYXNoICYmXG4gICAgICB0aGlzLnJlZHVjZUluc3RhbmNlcyA9PT0gcmVkdWNlSW5zdGFuY2VzO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgY29uc3QgbWFwRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLm1hcF07XG4gICAgICBjb25zdCBoYXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmhhc2hdO1xuICAgICAgY29uc3QgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLnJlZHVjZUluc3RhbmNlc107XG4gICAgICBjb25zdCBoYXNoSW5kZXggPSB0aGlzLnN0cmVhbS5nZXRJbmRleCh0aGlzLmhhc2gpO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIG1hcEZ1bmN0aW9uKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICAgIGNvbnN0IGhhc2ggPSBoYXNoRnVuY3Rpb24obWFwcGVkUmF3SXRlbSk7XG4gICAgICAgIGxldCBvcmlnaW5hbFdyYXBwZWRJdGVtID0gKGF3YWl0IGhhc2hJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCkpWzBdO1xuICAgICAgICBpZiAob3JpZ2luYWxXcmFwcGVkSXRlbSkge1xuICAgICAgICAgIGlmICh0aGlzLnJlZHVjZUluc3RhbmNlcyAhPT0gJ25vb3AnKSB7XG4gICAgICAgICAgICByZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbihvcmlnaW5hbFdyYXBwZWRJdGVtLCBtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0udHJpZ2dlcigndXBkYXRlJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGhhc2hlcyA9IHt9O1xuICAgICAgICAgIGhhc2hlc1t0aGlzLmhhc2hdID0gaGFzaDtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW0sXG4gICAgICAgICAgICBoYXNoZXNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgSm9pblRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBvdGhlclN0cmVhbSwgdGhpc0hhc2ggPSAna2V5Jywgb3RoZXJIYXNoID0gJ2tleScsIGZpbmlzaCA9ICdkZWZhdWx0RmluaXNoJywgbnRoSm9pbiA9IDAgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgdGhpc0hhc2gsIGZpbmlzaCBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tmdW5jXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7ZnVuY31gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wID0gc3RyZWFtLm5hbWVkU3RyZWFtc1tvdGhlclN0cmVhbV07XG4gICAgaWYgKCF0ZW1wKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgc3RyZWFtOiAke290aGVyU3RyZWFtfWApO1xuICAgIH1cbiAgICAvLyBSZXF1aXJlIG90aGVySGFzaCBvbiB0aGUgb3RoZXIgc3RyZWFtLCBvciBjb3B5IG91cnMgb3ZlciBpZiBpdCBpc24ndFxuICAgIC8vIGFscmVhZHkgZGVmaW5lZFxuICAgIGlmICghdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBoYXNoIGZ1bmN0aW9uIG9uIGVpdGhlciBzdHJlYW06ICR7b3RoZXJIYXNofWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdID0gc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5vdGhlclN0cmVhbSA9IG90aGVyU3RyZWFtO1xuICAgIHRoaXMudGhpc0hhc2ggPSB0aGlzSGFzaDtcbiAgICB0aGlzLm90aGVySGFzaCA9IG90aGVySGFzaDtcbiAgICB0aGlzLmZpbmlzaCA9IGZpbmlzaDtcbiAgICB0aGlzLm50aEpvaW4gPSBudGhKb2luO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5qb2luKCR7dGhpcy5vdGhlclN0cmVhbX0sICR7dGhpcy50aGlzSGFzaH0sICR7dGhpcy5vdGhlckhhc2h9LCAke3RoaXMuZmluaXNofSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnaWRlbnRpdHknIF0pIHtcbiAgICByZXR1cm4gdGhpcy5vdGhlclN0cmVhbSA9PT0gb3RoZXJTdHJlYW0gJiZcbiAgICAgIHRoaXMudGhpc0hhc2ggPT09IHRoaXNIYXNoICYmXG4gICAgICB0aGlzLm90aGVySGFzaCA9PT0gb3RoZXJIYXNoICYmXG4gICAgICB0aGlzLmZpbmlzaCA9PT0gZmluaXNoO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBjb25zdCBvdGhlclN0cmVhbSA9IHRoaXMuc3RyZWFtLm5hbWVkU3RyZWFtc1t0aGlzLm90aGVyU3RyZWFtXTtcbiAgICBjb25zdCB0aGlzSGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy50aGlzSGFzaF07XG4gICAgY29uc3Qgb3RoZXJIYXNoRnVuY3Rpb24gPSBvdGhlclN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLm90aGVySGFzaF07XG4gICAgY29uc3QgZmluaXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmZpbmlzaF07XG5cbiAgICAvLyBjb25zdCB0aGlzSXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpO1xuICAgIC8vIGNvbnN0IG90aGVySXRlcmF0b3IgPSBvdGhlclN0cmVhbS5pdGVyYXRlKCk7XG5cbiAgICBjb25zdCB0aGlzSW5kZXggPSB0aGlzLnN0cmVhbS5nZXRJbmRleCh0aGlzLnRoaXNIYXNoKTtcbiAgICBjb25zdCBvdGhlckluZGV4ID0gb3RoZXJTdHJlYW0uZ2V0SW5kZXgodGhpcy5vdGhlckhhc2gpO1xuXG4gICAgaWYgKHRoaXNJbmRleC5jb21wbGV0ZSkge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gQmVzdCBvZiBhbGwgd29ybGRzOyB3ZSBjYW4ganVzdCBqb2luIHRoZSBpbmRleGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBoYXNoLCB2YWx1ZUxpc3QgfSBvZiB0aGlzSW5kZXguaXRlckVudHJpZXMoKSkge1xuICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHZhbHVlTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5lZWQgdG8gaXRlcmF0ZSB0aGUgb3RoZXIgaXRlbXMsIGFuZCB0YWtlIGFkdmFudGFnZSBvZiBvdXIgY29tcGxldGVcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyU3RyZWFtLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgLy8gQWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleDpcbiAgICAgICAgICAgIGF3YWl0IG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIG91ciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIHRoZSBvdGhlciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgLy8gYWRkIHRoaXNXcmFwcGVkSXRlbSB0byB0aGlzSW5kZXhcbiAgICAgICAgICAgIGF3YWl0IHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVpdGhlciBzdHJlYW0gaXMgZnVsbHkgaW5kZXhlZDsgZm9yIG1vcmUgZGlzdHJpYnV0ZWQgc2FtcGxpbmcsIGdyYWJcbiAgICAgICAgLy8gb25lIGl0ZW0gZnJvbSBlYWNoIHN0cmVhbSBhdCBhIHRpbWUsIGFuZCB1c2UgdGhlIHBhcnRpYWwgaW5kZXhlc1xuICAgICAgICBjb25zdCB0aGlzSXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpO1xuICAgICAgICBsZXQgdGhpc0lzRG9uZSA9IGZhbHNlO1xuICAgICAgICBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuICAgICAgICBsZXQgb3RoZXJJc0RvbmUgPSBmYWxzZTtcblxuICAgICAgICB3aGlsZSAoIXRoaXNJc0RvbmUgfHwgIW90aGVySXNEb25lKSB7XG4gICAgICAgICAgLy8gVGFrZSBvbmUgc2FtcGxlIGZyb20gdGhpcyBzdHJlYW1cbiAgICAgICAgICBsZXQgdGVtcCA9IGF3YWl0IHRoaXNJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgdGhpc0lzRG9uZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICAgIHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm93IGZvciBhIHNhbXBsZSBmcm9tIHRoZSBvdGhlciBzdHJlYW1cbiAgICAgICAgICB0ZW1wID0gYXdhaXQgb3RoZXJJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgb3RoZXJJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBvdGhlcldyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4XG4gICAgICAgICAgICAgIG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBKb2luVG9rZW47XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi4vU3RyZWFtLmpzJztcblxuY29uc3QgQVNURVJJU0tTID0ge1xuICAnZXZhbHVhdGUnOiAn4oasJyxcbiAgJ2pvaW4nOiAn4qivJyxcbiAgJ21hcCc6ICfihqYnLFxuICAncHJvbW90ZSc6ICfihpEnLFxuICAndmFsdWUnOiAn4oaSJ1xufTtcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLl9zZWxlY3RvciA9IG9wdGlvbnMuc2VsZWN0b3I7XG4gICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSBvcHRpb25zLmN1c3RvbUNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPSBvcHRpb25zLmN1c3RvbU5hbWVUb2tlbkluZGV4IHx8IG51bGw7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIGlmICh0eXBlb2YgZnVuYyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBuZXcgRnVuY3Rpb24oYHJldHVybiAke2Z1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLl9zZWxlY3RvcjtcbiAgfVxuICBnZXQgdG9rZW5DbGFzc0xpc3QgKCkge1xuICAgIHJldHVybiB0aGlzLm11cmUucGFyc2VTZWxlY3Rvcih0aGlzLnNlbGVjdG9yKTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NUeXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBzZWxlY3RvcjogdGhpcy5fc2VsZWN0b3IsXG4gICAgICBjdXN0b21DbGFzc05hbWU6IHRoaXMuY3VzdG9tQ2xhc3NOYW1lLFxuICAgICAgY3VzdG9tTmFtZVRva2VuSW5kZXg6IHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXgsXG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBpbmRleGVzOiB7fSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB7fVxuICAgIH07XG4gICAgZm9yIChsZXQgW2Z1bmNOYW1lLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm5hbWVkRnVuY3Rpb25zKSkge1xuICAgICAgcmVzdWx0Lm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICB9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXModGhpcy5pbmRleGVzKS5tYXAoYXN5bmMgKFtmdW5jTmFtZSwgaW5kZXhdKSA9PiB7XG4gICAgICBpZiAoaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgcmVzdWx0LmluZGV4ZXNbZnVuY05hbWVdID0gYXdhaXQgaW5kZXgudG9SYXdPYmplY3QoKTtcbiAgICAgIH1cbiAgICB9KSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICB3cmFwIChvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLldyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIGlmICh0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gdmFsdWUpIHtcbiAgICAgIHRoaXMuY3VzdG9tQ2xhc3NOYW1lID0gdmFsdWU7XG4gICAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID0gdGhpcy5zZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZykubGVuZ3RoO1xuICAgICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgfVxuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5jdXN0b21DbGFzc05hbWUgIT09IG51bGwgJiZcbiAgICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPT09IHRoaXMuc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpLmxlbmd0aDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICBjb25zdCBzZWxlY3RvciA9IHRoaXMuc2VsZWN0b3I7XG4gICAgY29uc3QgdG9rZW5TdHJpbmdzID0gc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpO1xuICAgIGxldCByZXN1bHQgPSAnJztcbiAgICBmb3IgKGxldCBpID0gdG9rZW5TdHJpbmdzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAodGhpcy5jdXN0b21DbGFzc05hbWUgIT09IG51bGwgJiYgaSA8PSB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmN1c3RvbUNsYXNzTmFtZSArIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRlbXAgPSB0b2tlblN0cmluZ3NbaV0ubWF0Y2goL14uKFteKF0qKVxcKChbXildKilcXCkvKTtcbiAgICAgIGlmICh0ZW1wWzFdID09PSAna2V5cycgfHwgdGVtcFsxXSA9PT0gJ3ZhbHVlcycpIHtcbiAgICAgICAgaWYgKHRlbXBbMl0gPT09ICcnKSB7XG4gICAgICAgICAgcmVzdWx0ID0gJyonICsgcmVzdWx0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdCA9IHRlbXBbMl0ucmVwbGFjZSgvJyhbXiddKiknLywgJyQxJykgKyByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdCA9IEFTVEVSSVNLU1t0ZW1wWzFdXSArIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIChzZWxlY3Rvci5zdGFydHNXaXRoKCdlbXB0eScpID8gJ+KIhScgOiAnJykgKyByZXN1bHQ7XG4gIH1cbiAgc2V0TmFtZWRGdW5jdGlvbiAoZnVuY05hbWUsIGZ1bmMpIHtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IGZ1bmM7XG4gIH1cbiAgcG9wdWxhdGVTdHJlYW1PcHRpb25zIChvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMudG9rZW5DbGFzc0xpc3Q7XG4gICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IHRoaXMubmFtZWRGdW5jdGlvbnM7XG4gICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IHRoaXM7XG4gICAgb3B0aW9ucy5pbmRleGVzID0gdGhpcy5pbmRleGVzO1xuICAgIHJldHVybiBvcHRpb25zO1xuICB9XG4gIGdldFN0cmVhbSAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKG9wdGlvbnMucmVzZXQgfHwgIXRoaXMuX3N0cmVhbSkge1xuICAgICAgdGhpcy5fc3RyZWFtID0gbmV3IFN0cmVhbSh0aGlzLnBvcHVsYXRlU3RyZWFtT3B0aW9ucyhvcHRpb25zKSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9zdHJlYW07XG4gIH1cbiAgaXNTdXBlclNldE9mVG9rZW5MaXN0ICh0b2tlbkxpc3QpIHtcbiAgICBpZiAodG9rZW5MaXN0Lmxlbmd0aCAhPT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5ldmVyeSgodG9rZW4sIGkpID0+IHRva2VuLmlzU3VwZXJTZXRPZih0b2tlbkxpc3RbaV0pKTtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gYXdhaXQgdGhpcy50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdID0gbmV3IHRoaXMubXVyZS5DTEFTU0VTLk5vZGVDbGFzcyhvcHRpb25zKTtcbiAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gYXdhaXQgdGhpcy50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdID0gbmV3IHRoaXMubXVyZS5DTEFTU0VTLkVkZ2VDbGFzcyhvcHRpb25zKTtcbiAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgfVxuICBhc3luYyBhZ2dyZWdhdGUgKGhhc2gsIHJlZHVjZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGV4cGFuZCAobWFwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZmlsdGVyIChmaWx0ZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyAqIHNwbGl0IChoYXNoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZGVsZXRlICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXI7XG4gICAgdGhpcy5lZGdlQ29ubmVjdGlvbnMgPSBvcHRpb25zLmVkZ2VDb25uZWN0aW9ucyB8fCB7fTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgLy8gVE9ETzogYSBiYWJlbCBidWcgKGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMzkzMClcbiAgICAvLyBwcmV2ZW50cyBgYXdhaXQgc3VwZXJgOyB0aGlzIGlzIGEgd29ya2Fyb3VuZDpcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBHZW5lcmljQ2xhc3MucHJvdG90eXBlLnRvUmF3T2JqZWN0LmNhbGwodGhpcyk7XG4gICAgLy8gVE9ETzogbmVlZCB0byBkZWVwIGNvcHkgZWRnZUNvbm5lY3Rpb25zP1xuICAgIHJlc3VsdC5lZGdlQ29ubmVjdGlvbnMgPSB0aGlzLmVkZ2VDb25uZWN0aW9ucztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIHRoaXNIYXNoTmFtZSwgb3RoZXJIYXNoTmFtZSB9KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG5cbiAgICBpZiAoIXRoaXMuX3NlbGVjdG9yKSB7XG4gICAgICBpZiAoIXNvdXJjZUNsYXNzIHx8ICF0YXJnZXRDbGFzcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcnRpYWwgY29ubmVjdGlvbnMgd2l0aG91dCBhbiBlZGdlIHRhYmxlIHNob3VsZCBuZXZlciBoYXBwZW5gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vIGVkZ2UgdGFibGUgKHNpbXBsZSBqb2luIGJldHdlZW4gdHdvIG5vZGVzKVxuICAgICAgICBjb25zdCBzb3VyY2VIYXNoID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0ubm9kZUhhc2hOYW1lO1xuICAgICAgICBjb25zdCB0YXJnZXRIYXNoID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0ubm9kZUhhc2hOYW1lO1xuICAgICAgICByZXR1cm4gc291cmNlQ2xhc3Muc2VsZWN0b3IgKyBgLmpvaW4odGFyZ2V0LCAke3NvdXJjZUhhc2h9LCAke3RhcmdldEhhc2h9LCBkZWZhdWx0RmluaXNoKWA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByZXN1bHQgPSB0aGlzLl9zZWxlY3RvcjtcbiAgICAgIGlmICghc291cmNlQ2xhc3MpIHtcbiAgICAgICAgaWYgKCF0YXJnZXRDbGFzcykge1xuICAgICAgICAgIC8vIE5vIGNvbm5lY3Rpb25zIHlldDsganVzdCB5aWVsZCB0aGUgcmF3IGVkZ2UgdGFibGVcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFBhcnRpYWwgZWRnZS10YXJnZXQgY29ubmVjdGlvbnNcbiAgICAgICAgICBjb25zdCB7IGVkZ2VIYXNoTmFtZSwgbm9kZUhhc2hOYW1lIH0gPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0ICsgYC5qb2luKHRhcmdldCwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gpYDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgLy8gUGFydGlhbCBzb3VyY2UtZWRnZSBjb25uZWN0aW9uc1xuICAgICAgICBjb25zdCB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0gPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdCArIGAuam9pbihzb3VyY2UsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoKWA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBGdWxsIGNvbm5lY3Rpb25zXG4gICAgICAgIGxldCB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0gPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgcmVzdWx0ICs9IGAuam9pbihzb3VyY2UsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoKWA7XG4gICAgICAgICh7IGVkZ2VIYXNoTmFtZSwgbm9kZUhhc2hOYW1lIH0gPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXSk7XG4gICAgICAgIHJlc3VsdCArPSBgLmpvaW4odGFyZ2V0LCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaCwgMSlgO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBwb3B1bGF0ZVN0cmVhbU9wdGlvbnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMgPSB7fTtcbiAgICBpZiAoIXRoaXMuX3NlbGVjdG9yKSB7XG4gICAgICAvLyBVc2UgdGhlIG9wdGlvbnMgZnJvbSB0aGUgc291cmNlIHN0cmVhbSBpbnN0ZWFkIG9mIG91ciBjbGFzc1xuICAgICAgb3B0aW9ucyA9IHNvdXJjZUNsYXNzLnBvcHVsYXRlU3RyZWFtT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnRhcmdldCA9IHRhcmdldENsYXNzLmdldFN0cmVhbSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gc3VwZXIucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpO1xuICAgICAgaWYgKHNvdXJjZUNsYXNzKSB7XG4gICAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnNvdXJjZSA9IHNvdXJjZUNsYXNzLmdldFN0cmVhbSgpO1xuICAgICAgfVxuICAgICAgaWYgKHRhcmdldENsYXNzKSB7XG4gICAgICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zLnRhcmdldCA9IHRhcmdldENsYXNzLmdldFN0cmVhbSgpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgLy8gVE9ETzogYSBiYWJlbCBidWcgKGh0dHBzOi8vZ2l0aHViLmNvbS9iYWJlbC9iYWJlbC9pc3N1ZXMvMzkzMClcbiAgICAvLyBwcmV2ZW50cyBgYXdhaXQgc3VwZXJgOyB0aGlzIGlzIGEgd29ya2Fyb3VuZDpcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBHZW5lcmljQ2xhc3MucHJvdG90eXBlLnRvUmF3T2JqZWN0LmNhbGwodGhpcyk7XG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSkge1xuICAgIGlmIChkaXJlY3Rpb24gPT09ICdzb3VyY2UnKSB7XG4gICAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICd0YXJnZXQnKSB7XG4gICAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb3VyY2UgYW5kIHRhcmdldCBhcmUgYWxyZWFkeSBkZWZpbmVkOyBwbGVhc2Ugc3BlY2lmeSBhIGRpcmVjdGlvbiB0byBvdmVycmlkZWApO1xuICAgICAgfVxuICAgIH1cbiAgICBub2RlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0gPSB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH07XG4gICAgZGVsZXRlIHRoaXMuX3N0cmVhbTtcbiAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMud3JhcHBlZFBhcmVudCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMucmF3SXRlbSA9IHJhd0l0ZW07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJjbGFzcyBJbk1lbW9yeUluZGV4IHtcbiAgY29uc3RydWN0b3IgKHsgZW50cmllcyA9IHt9LCBjb21wbGV0ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXM7XG4gICAgdGhpcy5jb21wbGV0ZSA9IGNvbXBsZXRlO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzO1xuICB9XG4gIGFzeW5jICogaXRlckVudHJpZXMgKCkge1xuICAgIGZvciAoY29uc3QgW2hhc2gsIHZhbHVlTGlzdF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgeyBoYXNoLCB2YWx1ZUxpc3QgfTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVySGFzaGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IGhhc2ggb2YgT2JqZWN0LmtleXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgaGFzaDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyVmFsdWVMaXN0cyAoKSB7XG4gICAgZm9yIChjb25zdCB2YWx1ZUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB2YWx1ZUxpc3Q7XG4gICAgfVxuICB9XG4gIGFzeW5jIGdldFZhbHVlTGlzdCAoaGFzaCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXNbaGFzaF0gfHwgW107XG4gIH1cbiAgYXN5bmMgYWRkVmFsdWUgKGhhc2gsIHZhbHVlKSB7XG4gICAgLy8gVE9ETzogYWRkIHNvbWUga2luZCBvZiB3YXJuaW5nIGlmIHRoaXMgaXMgZ2V0dGluZyBiaWc/XG4gICAgdGhpcy5lbnRyaWVzW2hhc2hdID0gYXdhaXQgdGhpcy5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBJbk1lbW9yeUluZGV4O1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcbmltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4vU3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIFRPS0VOUyBmcm9tICcuL1Rva2Vucy9Ub2tlbnMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcbmltcG9ydCAqIGFzIElOREVYRVMgZnJvbSAnLi9JbmRleGVzL0luZGV4ZXMuanMnO1xuXG5sZXQgTkVYVF9DTEFTU19JRCA9IDE7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBtdXJlLmRlYnVnIHRvIHRydWUgdG8gZGVidWcgc3RyZWFtc1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UT0tFTlMgPSBUT0tFTlM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIE1vbmtleS1wYXRjaCBhdmFpbGFibGUgdG9rZW5zIGFzIGZ1bmN0aW9ucyBvbnRvIHRoZSBTdHJlYW0gY2xhc3NcbiAgICBmb3IgKGNvbnN0IHRva2VuQ2xhc3NOYW1lIGluIHRoaXMuVE9LRU5TKSB7XG4gICAgICBjb25zdCBUb2tlbkNsYXNzID0gdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdO1xuICAgICAgU3RyZWFtLnByb3RvdHlwZVtUb2tlbkNsYXNzLmxvd2VyQ2FtZWxDYXNlVHlwZV0gPSBmdW5jdGlvbiAoYXJnTGlzdCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5leHRlbmQoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIGlmICh0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgICAgLy8gaWYgcmVsZXZhbnQsIG1lcmdlIHRoZSByZXN1bHRzIG9mIGEgc2VyaWVzIG9mIGpvaW5zIGludG8gYSBzaW5nbGVcbiAgICAgICAgICAvLyBhcnJheVxuICAgICAgICAgIHlpZWxkIHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLmNvbmNhdChbIG90aGVyV3JhcHBlZEl0ZW0ucmF3SXRlbSBdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBvdGhlcndpc2UganVzdCB5aWVsZCB0aGUgdHdvIHJlc3VsdHMgYXMgYW4gYXJyYXlcbiAgICAgICAgICB5aWVsZCBbXG4gICAgICAgICAgICB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICAgIG90aGVyV3JhcHBlZEl0ZW0ucmF3SXRlbVxuICAgICAgICAgIF07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy5yb290ID0gdGhpcy5sb2FkUm9vdCgpO1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgb3VyIGNsYXNzIHNwZWNpZmljYXRpb25zXG4gICAgdGhpcy5jbGFzc2VzID0gdGhpcy5sb2FkQ2xhc3NlcygpO1xuICB9XG5cbiAgbG9hZFJvb3QgKCkge1xuICAgIGxldCByb290ID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbXVyZV9yb290Jyk7XG4gICAgcm9vdCA9IHJvb3QgPyBKU09OLnBhcnNlKHJvb3QpIDoge307XG4gICAgcmV0dXJuIHJvb3Q7XG4gIH1cbiAgYXN5bmMgc2F2ZVJvb3QgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbXVyZV9yb290JywgSlNPTi5zdHJpbmdpZnkodGhpcy5yb290KSk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncm9vdFVwZGF0ZScpO1xuICB9XG4gIGxvYWRDbGFzc2VzICgpIHtcbiAgICBsZXQgY2xhc3NlcyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ211cmVfY2xhc3NlcycpO1xuICAgIGNsYXNzZXMgPSBjbGFzc2VzID8gSlNPTi5wYXJzZShjbGFzc2VzKSA6IHt9O1xuICAgIE9iamVjdC5lbnRyaWVzKGNsYXNzZXMpLmZvckVhY2goKFsgY2xhc3NJZCwgcmF3Q2xhc3NPYmogXSkgPT4ge1xuICAgICAgT2JqZWN0LmVudHJpZXMocmF3Q2xhc3NPYmouaW5kZXhlcykuZm9yRWFjaCgoW2Z1bmNOYW1lLCByYXdJbmRleE9ial0pID0+IHtcbiAgICAgICAgcmF3Q2xhc3NPYmouaW5kZXhlc1tmdW5jTmFtZV0gPSBuZXcgdGhpcy5JTkRFWEVTLkluTWVtb3J5SW5kZXgoe1xuICAgICAgICAgIGVudHJpZXM6IHJhd0luZGV4T2JqLCBjb21wbGV0ZTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2xhc3NUeXBlID0gcmF3Q2xhc3NPYmouY2xhc3NUeXBlO1xuICAgICAgZGVsZXRlIHJhd0NsYXNzT2JqLmNsYXNzVHlwZTtcbiAgICAgIHJhd0NsYXNzT2JqLm11cmUgPSB0aGlzO1xuICAgICAgY2xhc3Nlc1tjbGFzc0lkXSA9IG5ldyB0aGlzLkNMQVNTRVNbY2xhc3NUeXBlXShyYXdDbGFzc09iaik7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNsYXNzZXM7XG4gIH1cbiAgYXN5bmMgc2F2ZUNsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgcmF3Q2xhc3NlcyA9IHt9O1xuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXModGhpcy5jbGFzc2VzKVxuICAgICAgICAubWFwKGFzeW5jIChbIGNsYXNzSWQsIGNsYXNzT2JqIF0pID0+IHtcbiAgICAgICAgICByYXdDbGFzc2VzW2NsYXNzSWRdID0gYXdhaXQgY2xhc3NPYmoudG9SYXdPYmplY3QoKTtcbiAgICAgICAgfSkpO1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbXVyZV9jbGFzc2VzJywgSlNPTi5zdHJpbmdpZnkocmF3Q2xhc3NlcykpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ2NsYXNzVXBkYXRlJyk7XG4gIH1cblxuICBwYXJzZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZykge1xuICAgIGNvbnN0IHN0YXJ0c1dpdGhSb290ID0gc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgncm9vdCcpO1xuICAgIGlmICghKHN0YXJ0c1dpdGhSb290IHx8IHNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ2VtcHR5JykpKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFNlbGVjdG9ycyBtdXN0IHN0YXJ0IHdpdGggJ3Jvb3QnIG9yICdlbXB0eSdgKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5TdHJpbmdzID0gc2VsZWN0b3JTdHJpbmcubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpO1xuICAgIGlmICghdG9rZW5TdHJpbmdzKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgc2VsZWN0b3Igc3RyaW5nOiAke3NlbGVjdG9yU3RyaW5nfWApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlbkNsYXNzTGlzdCA9IFt7XG4gICAgICBUb2tlbkNsYXNzOiBzdGFydHNXaXRoUm9vdCA/IHRoaXMuVE9LRU5TLlJvb3RUb2tlbiA6IHRoaXMuVE9LRU5TLkVtcHR5VG9rZW5cbiAgICB9XTtcbiAgICB0b2tlblN0cmluZ3MuZm9yRWFjaChjaHVuayA9PiB7XG4gICAgICBjb25zdCB0ZW1wID0gY2h1bmsubWF0Y2goL14uKFteKF0qKVxcKChbXildKilcXCkvKTtcbiAgICAgIGlmICghdGVtcCkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgdG9rZW46ICR7Y2h1bmt9YCk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b2tlbkNsYXNzTmFtZSA9IHRlbXBbMV1bMF0udG9VcHBlckNhc2UoKSArIHRlbXBbMV0uc2xpY2UoMSkgKyAnVG9rZW4nO1xuICAgICAgY29uc3QgYXJnTGlzdCA9IHRlbXBbMl0uc3BsaXQoLyg/PCFcXFxcKSwvKS5tYXAoZCA9PiB7XG4gICAgICAgIGQgPSBkLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIGQgPT09ICcnID8gdW5kZWZpbmVkIDogZDtcbiAgICAgIH0pO1xuICAgICAgaWYgKHRva2VuQ2xhc3NOYW1lID09PSAnVmFsdWVzVG9rZW4nKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLktleXNUb2tlbixcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5WYWx1ZVRva2VuXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0pIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gdG9rZW46ICR7dGVtcFsxXX1gKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdG9rZW5DbGFzc0xpc3Q7XG4gIH1cblxuICBzdHJlYW0gKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnBhcnNlU2VsZWN0b3Iob3B0aW9ucy5zZWxlY3RvciB8fCBgcm9vdC52YWx1ZXMoKWApO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG5cbiAgYXN5bmMgbmV3Q2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgcm9vdGAgfSkge1xuICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7TkVYVF9DTEFTU19JRH1gO1xuICAgIE5FWFRfQ0xBU1NfSUQgKz0gMTtcbiAgICBjb25zdCBDbGFzc1R5cGUgPSBvcHRpb25zLkNsYXNzVHlwZSB8fCB0aGlzLkNMQVNTRVMuR2VuZXJpY0NsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLkNsYXNzVHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IENsYXNzVHlwZShvcHRpb25zKTtcbiAgICBhd2FpdCB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHk7IHRyeSBhZGREeW5hbWljRGF0YVNvdXJjZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSh7XG4gICAgICBrZXk6IGZpbGVPYmoubmFtZSxcbiAgICAgIGV4dGVuc2lvbjogZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24oZmlsZU9iai50eXBlKSxcbiAgICAgIHRleHRcbiAgICB9KTtcbiAgfVxuICBhc3luYyBhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBrZXksXG4gICAgZXh0ZW5zaW9uID0gJ3R4dCcsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgbGV0IG9iajtcbiAgICBpZiAodGhpcy5EQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgb2JqID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBkZWxldGUgb2JqLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljRGF0YVNvdXJjZShrZXksIG9iaik7XG4gIH1cbiAgYXN5bmMgYWRkU3RhdGljRGF0YVNvdXJjZSAoa2V5LCBvYmopIHtcbiAgICB0aGlzLnJvb3Rba2V5XSA9IG9iajtcbiAgICBjb25zdCB0ZW1wID0gYXdhaXQgUHJvbWlzZS5hbGwoW3RoaXMuc2F2ZVJvb3QoKSwgdGhpcy5uZXdDbGFzcyh7XG4gICAgICBzZWxlY3RvcjogYHJvb3QudmFsdWVzKCcke2tleX0nKS52YWx1ZXMoKWBcbiAgICB9KV0pO1xuICAgIHJldHVybiB0ZW1wWzFdO1xuICB9XG4gIGFzeW5jIHJlbW92ZURhdGFTb3VyY2UgKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLnJvb3Rba2V5XTtcbiAgICBhd2FpdCB0aGlzLnNhdmVSb290KCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVyZTtcbiIsImltcG9ydCBNdXJlIGZyb20gJy4vTXVyZS5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5pbXBvcnQgRmlsZVJlYWRlciBmcm9tICdmaWxlcmVhZGVyJztcblxubGV0IG11cmUgPSBuZXcgTXVyZShGaWxlUmVhZGVyLCBudWxsKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwiaW5kZXgiLCJzcGxpY2UiLCJhcmdzIiwiZm9yRWFjaCIsImFwcGx5IiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJ0aW1lb3V0Iiwic2V0VGltZW91dCIsInRyaWdnZXIiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwiaSIsIlN0cmVhbSIsIm9wdGlvbnMiLCJtdXJlIiwibmFtZWRGdW5jdGlvbnMiLCJOQU1FRF9GVU5DVElPTlMiLCJuYW1lZFN0cmVhbXMiLCJsYXVuY2hlZEZyb21DbGFzcyIsImluZGV4ZXMiLCJ0b2tlbkNsYXNzTGlzdCIsInRva2VuTGlzdCIsIm1hcCIsIlRva2VuQ2xhc3MiLCJhcmdMaXN0IiwiV3JhcHBlcnMiLCJnZXRXcmFwcGVyTGlzdCIsInRva2VuIiwibGVuZ3RoIiwiV3JhcHBlciIsImxvY2FsVG9rZW5MaXN0Iiwic2xpY2UiLCJwb3RlbnRpYWxXcmFwcGVycyIsInZhbHVlcyIsImNsYXNzZXMiLCJmaWx0ZXIiLCJjbGFzc09iaiIsImV2ZXJ5IiwibG9jYWxUb2tlbiIsImxvY2FsSW5kZXgiLCJ0b2tlbkNsYXNzU3BlYyIsImlzU3Vic2V0T2YiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwid2FybiIsInNlbGVjdG9yIiwiam9pbiIsInBhcnNlU2VsZWN0b3IiLCJjb25jYXQiLCJ3cmFwcGVkUGFyZW50IiwicmF3SXRlbSIsImhhc2hlcyIsIndyYXBwZXJJbmRleCIsInRlbXAiLCJ3cmFwcGVkSXRlbSIsIlByb21pc2UiLCJhbGwiLCJlbnRyaWVzIiwicmVkdWNlIiwicHJvbWlzZUxpc3QiLCJoYXNoRnVuY3Rpb25OYW1lIiwiaGFzaCIsImdldEluZGV4IiwiY29tcGxldGUiLCJhZGRWYWx1ZSIsImxhc3RUb2tlbiIsIml0ZXJhdGUiLCJJTkRFWEVTIiwiSW5NZW1vcnlJbmRleCIsImhhc2hGdW5jdGlvbiIsIkVycm9yIiwibGltaXQiLCJyZWJ1aWxkSW5kZXhlcyIsIml0ZXJhdG9yIiwibmV4dCIsImRvbmUiLCJ2YWx1ZSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImNvbnN0cnVjdG9yIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b0xvd2VyQ2FzZSIsImFuY2VzdG9yVG9rZW5zIiwicGFyZW50VG9rZW4iLCJ5aWVsZGVkU29tZXRoaW5nIiwiZGVidWciLCJUeXBlRXJyb3IiLCJleGVjIiwibmFtZSIsIkVtcHR5VG9rZW4iLCJSb290VG9rZW4iLCJ3cmFwIiwicm9vdCIsIktleXNUb2tlbiIsIm1hdGNoQWxsIiwia2V5cyIsInJhbmdlcyIsInVuZGVmaW5lZCIsImFyZyIsIm1hdGNoIiwiSW5maW5pdHkiLCJkIiwicGFyc2VJbnQiLCJpc05hTiIsImxvdyIsImhpZ2giLCJudW0iLCJOdW1iZXIiLCJTeW50YXhFcnJvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJjb25zb2xpZGF0ZVJhbmdlcyIsInNlbGVjdHNOb3RoaW5nIiwibmV3UmFuZ2VzIiwic29ydCIsImEiLCJiIiwiY3VycmVudFJhbmdlIiwib3RoZXJUb2tlbiIsIm5ld0tleXMiLCJrZXkiLCJhbGxQb2ludHMiLCJhZ2ciLCJyYW5nZSIsImluY2x1ZGUiLCJleGNsdWRlIiwiZGlmZiIsImRpZmZlcmVuY2UiLCJpdGVyYXRlUGFyZW50IiwiTWF0aCIsIm1heCIsIm1pbiIsImhhc093blByb3BlcnR5IiwiVmFsdWVUb2tlbiIsIm9iaiIsImtleVR5cGUiLCJFdmFsdWF0ZVRva2VuIiwibmV3U3RyZWFtIiwiZm9yayIsImVyciIsIk1hcFRva2VuIiwiZ2VuZXJhdG9yIiwibWFwcGVkUmF3SXRlbSIsIlByb21vdGVUb2tlbiIsInJlZHVjZUluc3RhbmNlcyIsImZ1bmMiLCJtYXBGdW5jdGlvbiIsInJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uIiwiaGFzaEluZGV4Iiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsImdldFZhbHVlTGlzdCIsIkpvaW5Ub2tlbiIsIm90aGVyU3RyZWFtIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJmaW5pc2giLCJudGhKb2luIiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwiaXRlckVudHJpZXMiLCJ2YWx1ZUxpc3QiLCJvdGhlckxpc3QiLCJvdGhlcldyYXBwZWRJdGVtIiwidGhpc1dyYXBwZWRJdGVtIiwidGhpc0xpc3QiLCJ0aGlzSXRlcmF0b3IiLCJ0aGlzSXNEb25lIiwib3RoZXJJdGVyYXRvciIsIm90aGVySXNEb25lIiwiQVNURVJJU0tTIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9zZWxlY3RvciIsImN1c3RvbUNsYXNzTmFtZSIsImN1c3RvbU5hbWVUb2tlbkluZGV4IiwiZnVuY05hbWUiLCJGdW5jdGlvbiIsInJlc3VsdCIsInRvU3RyaW5nIiwidG9SYXdPYmplY3QiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJjbGFzc05hbWUiLCJ0b2tlblN0cmluZ3MiLCJzdGFydHNXaXRoIiwicmVzZXQiLCJfc3RyZWFtIiwicG9wdWxhdGVTdHJlYW1PcHRpb25zIiwiaXNTdXBlclNldE9mIiwiQ0xBU1NFUyIsIk5vZGVDbGFzcyIsIkVkZ2VDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZUNvbm5lY3Rpb25zIiwicHJvdG90eXBlIiwiY2FsbCIsIm5vZGVDbGFzcyIsInRoaXNIYXNoTmFtZSIsIm90aGVySGFzaE5hbWUiLCJlZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJFZGdlV3JhcHBlciIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiZGlyZWN0ZWQiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwic291cmNlSGFzaCIsIm5vZGVIYXNoTmFtZSIsInRhcmdldEhhc2giLCJlZGdlSGFzaE5hbWUiLCJ0YXJnZXQiLCJnZXRTdHJlYW0iLCJzb3VyY2UiLCJkaXJlY3Rpb24iLCJORVhUX0NMQVNTX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiREFUQUxJQl9GT1JNQVRTIiwiVE9LRU5TIiwidG9rZW5DbGFzc05hbWUiLCJleHRlbmQiLCJwYXJlbnRUeXBlIiwiQXJyYXkiLCJzaGExIiwibG9hZFJvb3QiLCJsb2FkQ2xhc3NlcyIsImdldEl0ZW0iLCJwYXJzZSIsInNldEl0ZW0iLCJyYXdDbGFzc09iaiIsInJhd0luZGV4T2JqIiwiY2xhc3NUeXBlIiwicmF3Q2xhc3NlcyIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aFJvb3QiLCJjaHVuayIsInRvVXBwZXJDYXNlIiwic3BsaXQiLCJ0cmltIiwiQ2xhc3NUeXBlIiwiY2hhcnNldCIsImZpbGVPYmoiLCJmaWxlTUIiLCJzaXplIiwic2tpcFNpemVDaGVjayIsInRleHQiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVhZGVyIiwib25sb2FkIiwicmVhZEFzVGV4dCIsImVuY29kaW5nIiwiYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlIiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNEYXRhU291cmNlIiwic2F2ZVJvb3QiLCJuZXdDbGFzcyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE1BQU1BLG1CQUFtQixVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7a0JBQ2Y7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGFBQUwsR0FBcUIsRUFBckI7V0FDS0MsY0FBTCxHQUFzQixF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
