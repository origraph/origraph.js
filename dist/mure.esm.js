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

      if (!yieldedSomething && _this.mure.debug) {
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
  constructor(stream, [otherStream, thisHash = 'key', otherHash = 'key', finish = 'defaultFinish']) {
    super(stream);
    for (const func of [finish, thisHash, finish]) {
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
  RootToken: RootToken,
  KeysToken: KeysToken,
  ValueToken: ValueToken,
  EvaluateToken: EvaluateToken,
  MapToken: MapToken,
  PromoteToken: PromoteToken,
  JoinToken: JoinToken
});

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this.mure = options.mure;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.selector = options.selector || `root.values()`;
    this._customClassName = options.customName || null;
    this.tokenClassList = this.mure.parseSelector(options.selector);
    this.indexes = options.indexes || {};
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      const result = {
        classType: _this.constructor.name,
        selector: _this.selector,
        customName: _this._customClassName,
        indexes: {}
      };
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
  get className() {
    return this._customClassName || 'class name auto-inference not implemented';
  }
  getStream(options = {}) {
    if (options.reset || !this._stream) {
      options.mure = this.mure;
      options.tokenClassList = this.tokenClassList;
      options.namedFunctions = this.namedFunctions;
      options.launchedFromClass = this;
      options.indexes = this.indexes;
      this._stream = new Stream(options);
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
    var _this2 = this;

    return asyncToGenerator(function* () {
      const options = yield _this2.toRawObject();
      options.mure = _this2.mure;
      _this2.mure.classes[_this2.selector] = new _this2.mure.CLASSES.NodeClass(options);
      yield _this2.mure.saveClasses();
      return _this2.mure.classes[_this2.selector];
    })();
  }
  interpretAsEdges() {
    var _this3 = this;

    return asyncToGenerator(function* () {
      const options = yield _this3.toRawObject();
      options.mure = _this3.mure;
      _this3.mure.classes[_this3.selector] = new _this3.mure.CLASSES.EdgeClass(options);
      yield _this3.mure.saveClasses();
      return _this3.mure.classes[_this3.selector];
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
    this.edgeSelectors = options.edgeSelectors || {};
    Object.entries(this.edgeSelectors).forEach(([selector, { nodeHash, edgeHash }]) => {
      if (typeof nodeHash === 'string') {
        nodeHash = new Function(nodeHash); // eslint-disable-line no-new-func
      }
      if (typeof edgeHash === 'string') {
        edgeHash = new Function(edgeHash); // eslint-disable-line no-new-func
      }
      this.edgeSelectors[selector] = { nodeHash, edgeHash };
    });
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
      // prevents `await super`; this is a workaround:
      const result = yield GenericClass.prototype.toRawObject.call(_this);
      result.edgeSelectors = {};
      Object.entries(_this.edgeSelectors).forEach(function ([selector, { nodeHash, edgeHash }]) {
        nodeHash = nodeHash.toString();
        edgeHash = edgeHash.toString();
        result.edgeSelectors[selector] = { nodeHash, edgeHash };
      });
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
  connectToNodeClass({ nodeClass, thisHash, otherHash }) {
    throw new Error(`unimplemented`);
  }
  connectToEdgeClass(options) {
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
    this.sourceSelector = options.sourceSelector || null;
    this.targetSelector = options.targetSelector || null;
    this.directed = options.directed || false;
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
      // prevents `await super`; this is a workaround:
      const result = yield GenericClass.prototype.toRawObject.call(_this);
      result.sourceSelector = _this.sourceSelector;
      result.targetSelector = _this.targetSelector;
      result.directed = _this.directed;
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
  connectToNodeClass({ nodeClass, direction, nodeHash, edgeHash }) {
    if (direction === 'source') {
      if (this.sourceSelector) {
        delete this.mure.classes[this.sourceSelector].edgeSelectors[this.selector];
      }
      this.sourceSelector = nodeClass.selector;
    } else if (direction === 'target') {
      if (this.targetSelector) {
        delete this.mure.classes[this.targetSelector].edgeSelectors[this.selector];
      }
      this.targetSelector = nodeClass.selector;
    } else {
      if (!this.sourceSelector) {
        this.sourceSelector = nodeClass.selector;
      } else if (!this.targetSelector) {
        this.targetSelector = nodeClass.selector;
      } else {
        throw new Error(`Source and target are already defined; please specify a direction to override`);
      }
    }
    nodeClass.edgeSelectors[this.selector] = { nodeHash, edgeHash };
  }
  getStream(options) {
    throw new Error(`unimplemented`);
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
    };

    this.TRUTHY_STRINGS = {
      'true': true,
      'yes': true,
      'y': true
    };
    this.FALSEY_STRINGS = {
      'false': true,
      'no': true,
      'n': true
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
        yield [thisWrappedItem.rawItem, otherWrappedItem.rawItem];
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
    })();
  }
  loadClasses() {
    let classes = this.localStorage && this.localStorage.getItem('mure_classes');
    classes = classes ? JSON.parse(classes) : {};
    Object.entries(classes).forEach(([classSelector, rawClassObj]) => {
      Object.entries(rawClassObj.indexes).forEach(([funcName, rawIndexObj]) => {
        rawClassObj.indexes[funcName] = new this.INDEXES.InMemoryIndex({
          entries: rawIndexObj, complete: true
        });
      });
      const classType = rawClassObj.classType;
      delete rawClassObj.classType;
      rawClassObj.mure = this;
      classes[classSelector] = new this.CLASSES[classType](rawClassObj);
    });
    return classes;
  }
  saveClasses() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      if (_this2.localStorage) {
        const rawClasses = {};
        yield Promise.all(Object.entries(_this2.classes).map((() => {
          var _ref = asyncToGenerator(function* ([classSelector, classObj]) {
            rawClasses[classSelector] = yield classObj.toRawObject();
          });

          return function (_x) {
            return _ref.apply(this, arguments);
          };
        })()));
        _this2.localStorage.setItem('mure_classes', JSON.stringify(rawClasses));
      }
    })();
  }

  parseSelector(selectorString) {
    if (!selectorString.startsWith('root')) {
      throw new SyntaxError(`Selectors must start with 'root'`);
    }
    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);
    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }
    const tokenClassList = [{
      TokenClass: this.TOKENS.RootToken
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

  newClass(options = { selector: `root.values()` }) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      if (_this3.classes[options.selector]) {
        return _this3.classes[options.selector];
      }
      const ClassType = options.ClassType || _this3.CLASSES.GenericClass;
      delete options.ClassType;
      options.mure = _this3;
      _this3.classes[options.selector] = new ClassType(options);
      yield _this3.saveClasses();
      return _this3.classes[options.selector];
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
var version = "0.4.5";
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
	rollup: "^0.64.1",
	"rollup-plugin-babel": "^3.0.7",
	"rollup-plugin-commonjs": "^9.1.5",
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

let mure = new Mure(window.FileReader, window.localStorage);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIFN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy5uYW1lZFN0cmVhbXMgPSBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fTtcbiAgICB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCBudWxsO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgICB0aGlzLnRva2VuQ2xhc3NMaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdCB8fCBbXTtcblxuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy5uYW1lZEZ1bmN0aW9uc1xuICAgIC8vIGFuZCB0aGlzLm5hbWVkU3RyZWFtc1xuICAgIHRoaXMudG9rZW5MaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdC5tYXAoKHsgVG9rZW5DbGFzcywgYXJnTGlzdCB9KSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFRva2VuQ2xhc3ModGhpcywgYXJnTGlzdCk7XG4gICAgfSk7XG4gICAgLy8gUmVtaW5kZXI6IHRoaXMgYWx3YXlzIG5lZWRzIHRvIGJlIGFmdGVyIGluaXRpYWxpemluZyB0aGlzLnRva2VuTGlzdFxuICAgIHRoaXMuV3JhcHBlcnMgPSB0aGlzLmdldFdyYXBwZXJMaXN0KCk7XG4gIH1cblxuICBnZXRXcmFwcGVyTGlzdCAoKSB7XG4gICAgLy8gTG9vayB1cCB3aGljaCwgaWYgYW55LCBjbGFzc2VzIGRlc2NyaWJlIHRoZSByZXN1bHQgb2YgZWFjaCB0b2tlbiwgc28gdGhhdFxuICAgIC8vIHdlIGNhbiB3cmFwIGl0ZW1zIGFwcHJvcHJpYXRlbHk6XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0Lm1hcCgodG9rZW4sIGluZGV4KSA9PiB7XG4gICAgICBpZiAoaW5kZXggPT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEgJiYgdGhpcy5sYXVuY2hlZEZyb21DbGFzcykge1xuICAgICAgICAvLyBJZiB0aGlzIHN0cmVhbSB3YXMgc3RhcnRlZCBmcm9tIGEgY2xhc3MsIHdlIGFscmVhZHkga25vdyB3ZSBzaG91bGRcbiAgICAgICAgLy8gdXNlIHRoYXQgY2xhc3MncyB3cmFwcGVyIGZvciB0aGUgbGFzdCB0b2tlblxuICAgICAgICByZXR1cm4gdGhpcy5sYXVuY2hlZEZyb21DbGFzcy5XcmFwcGVyO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBhIGNsYXNzIHRoYXQgZGVzY3JpYmVzIGV4YWN0bHkgZWFjaCBzZXJpZXMgb2YgdG9rZW5zXG4gICAgICBjb25zdCBsb2NhbFRva2VuTGlzdCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIGluZGV4ICsgMSk7XG4gICAgICBjb25zdCBwb3RlbnRpYWxXcmFwcGVycyA9IE9iamVjdC52YWx1ZXModGhpcy5tdXJlLmNsYXNzZXMpXG4gICAgICAgIC5maWx0ZXIoY2xhc3NPYmogPT4ge1xuICAgICAgICAgIGlmICghY2xhc3NPYmoudG9rZW5DbGFzc0xpc3QubGVuZ3RoICE9PSBsb2NhbFRva2VuTGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW5MaXN0LmV2ZXJ5KChsb2NhbFRva2VuLCBsb2NhbEluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbkNsYXNzU3BlYyA9IGNsYXNzT2JqLnRva2VuQ2xhc3NMaXN0W2xvY2FsSW5kZXhdO1xuICAgICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW4gaW5zdGFuY2VvZiB0b2tlbkNsYXNzU3BlYy5Ub2tlbkNsYXNzICYmXG4gICAgICAgICAgICAgIHRva2VuLmlzU3Vic2V0T2YodG9rZW5DbGFzc1NwZWMuYXJnTGlzdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBObyBjbGFzc2VzIGRlc2NyaWJlIHRoaXMgc2VyaWVzIG9mIHRva2Vucywgc28gdXNlIHRoZSBnZW5lcmljIHdyYXBwZXJcbiAgICAgICAgcmV0dXJuIHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBNdWx0aXBsZSBjbGFzc2VzIGRlc2NyaWJlIHRoZSBzYW1lIGl0ZW0hIEFyYml0cmFyaWx5IGNob29zaW5nIG9uZS4uLmApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwb3RlbnRpYWxXcmFwcGVyc1swXS5XcmFwcGVyO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3Quam9pbignJyk7XG4gIH1cblxuICBmb3JrIChzZWxlY3Rvcikge1xuICAgIHJldHVybiBuZXcgU3RyZWFtKHtcbiAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB0aGlzLm5hbWVkRnVuY3Rpb25zLFxuICAgICAgbmFtZWRTdHJlYW1zOiB0aGlzLm5hbWVkU3RyZWFtcyxcbiAgICAgIHRva2VuQ2xhc3NMaXN0OiB0aGlzLm11cmUucGFyc2VTZWxlY3RvcihzZWxlY3RvciksXG4gICAgICBsYXVuY2hlZEZyb21DbGFzczogdGhpcy5sYXVuY2hlZEZyb21DbGFzcyxcbiAgICAgIGluZGV4ZXM6IHRoaXMuaW5kZXhlc1xuICAgIH0pO1xuICB9XG5cbiAgZXh0ZW5kIChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRGdW5jdGlvbnMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZFN0cmVhbXMsIG9wdGlvbnMubmFtZWRTdHJlYW1zIHx8IHt9KTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdC5jb25jYXQoW3sgVG9rZW5DbGFzcywgYXJnTGlzdCB9XSk7XG4gICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgdGhpcy5sYXVuY2hlZEZyb21DbGFzcztcbiAgICBvcHRpb25zLmluZGV4ZXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmluZGV4ZXMsIG9wdGlvbnMuaW5kZXhlcyB8fCB7fSk7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBhc3luYyB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtLCBoYXNoZXMgPSB7fSB9KSB7XG4gICAgbGV0IHdyYXBwZXJJbmRleCA9IDA7XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB3cmFwcGVySW5kZXggKz0gMTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gbmV3IHRoaXMuV3JhcHBlcnNbd3JhcHBlckluZGV4XSh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKGhhc2hlcykucmVkdWNlKChwcm9taXNlTGlzdCwgW2hhc2hGdW5jdGlvbk5hbWUsIGhhc2hdKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXgoaGFzaEZ1bmN0aW9uTmFtZSk7XG4gICAgICBpZiAoIWluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlTGlzdC5jb25jYXQoWyBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSkgXSk7XG4gICAgICB9XG4gICAgfSwgW10pKTtcbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cblxuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIGNvbnN0IGxhc3RUb2tlbiA9IHRoaXMudG9rZW5MaXN0W3RoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxKTtcbiAgICB5aWVsZCAqIGF3YWl0IGxhc3RUb2tlbi5pdGVyYXRlKHRlbXApO1xuICB9XG5cbiAgZ2V0SW5kZXggKGhhc2hGdW5jdGlvbk5hbWUpIHtcbiAgICBpZiAoIXRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSkge1xuICAgICAgLy8gVE9ETzogaWYgdXNpbmcgbm9kZS5qcywgc3RhcnQgd2l0aCBleHRlcm5hbCAvIG1vcmUgc2NhbGFibGUgaW5kZXhlc1xuICAgICAgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdID0gbmV3IHRoaXMubXVyZS5JTkRFWEVTLkluTWVtb3J5SW5kZXgoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgfVxuXG4gIGFzeW5jIGJ1aWxkSW5kZXggKGhhc2hGdW5jdGlvbk5hbWUpIHtcbiAgICBjb25zdCBoYXNoRnVuY3Rpb24gPSB0aGlzLm5hbWVkRnVuY3Rpb25zW2hhc2hGdW5jdGlvbk5hbWVdO1xuICAgIGlmICghaGFzaEZ1bmN0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7aGFzaEZ1bmN0aW9uTmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmdldEluZGV4KGhhc2hGdW5jdGlvbk5hbWUpO1xuICAgIGlmIChpbmRleC5jb21wbGV0ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgaGFzaEZ1bmN0aW9uKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSk7XG4gICAgICB9XG4gICAgfVxuICAgIGluZGV4LmNvbXBsZXRlID0gdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jICogc2FtcGxlICh7IGxpbWl0ID0gMTAsIHJlYnVpbGRJbmRleGVzID0gZmFsc2UgfSkge1xuICAgIC8vIEJlZm9yZSB3ZSBzdGFydCwgY2xlYW4gb3V0IGFueSBvbGQgaW5kZXhlcyB0aGF0IHdlcmUgbmV2ZXIgZmluaXNoZWRcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLmluZGV4ZXMpLmZvckVhY2goKFtoYXNoRnVuY3Rpb25OYW1lLCBpbmRleF0pID0+IHtcbiAgICAgIGlmIChyZWJ1aWxkSW5kZXhlcyB8fCAhaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgLy8gV2UgYWN0dWFsbHkgZmluaXNoZWQgYSBmdWxsIHBhc3M7IGZsYWcgYWxsIG9mIG91ciBpbmRleGVzIGFzIGNvbXBsZXRlXG4gICAgICAgIE9iamVjdC52YWx1ZXModGhpcy5pbmRleGVzKS5mb3JFYWNoKGluZGV4ID0+IHtcbiAgICAgICAgICBpbmRleC5jb21wbGV0ZSA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVRva2VuIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgLy8gVGhlIHN0cmluZyB2ZXJzaW9uIG9mIG1vc3QgdG9rZW5zIGNhbiBqdXN0IGJlIGRlcml2ZWQgZnJvbSB0aGUgY2xhc3MgdHlwZVxuICAgIHJldHVybiBgLiR7dGhpcy50eXBlLnRvTG93ZXJDYXNlKCl9KClgO1xuICB9XG4gIGlzU3ViU2V0T2YgKCkge1xuICAgIC8vIEJ5IGRlZmF1bHQgKHdpdGhvdXQgYW55IGFyZ3VtZW50cyksIHRva2VucyBvZiB0aGUgc2FtZSBjbGFzcyBhcmUgc3Vic2V0c1xuICAgIC8vIG9mIGVhY2ggb3RoZXJcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlUGFyZW50IChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IHBhcmVudFRva2VuID0gYW5jZXN0b3JUb2tlbnNbYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IGFuY2VzdG9yVG9rZW5zLnNsaWNlKDAsIGFuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDEpO1xuICAgIGxldCB5aWVsZGVkU29tZXRoaW5nID0gZmFsc2U7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRva2VuLml0ZXJhdGUodGVtcCkpIHtcbiAgICAgIHlpZWxkZWRTb21ldGhpbmcgPSB0cnVlO1xuICAgICAgeWllbGQgd3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgaWYgKCF5aWVsZGVkU29tZXRoaW5nICYmIHRoaXMubXVyZS5kZWJ1Zykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVG9rZW4geWllbGRlZCBubyByZXN1bHRzOiAke3BhcmVudFRva2VufWApO1xuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQ6IG51bGwsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0gPSB7fSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKGtleXMgfHwgcmFuZ2VzKSB7XG4gICAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgICAgdGhpcy5yYW5nZXMgPSByYW5nZXM7XG4gICAgfSBlbHNlIGlmICgoYXJnTGlzdCAmJiBhcmdMaXN0Lmxlbmd0aCA9PT0gMSAmJiBhcmdMaXN0WzBdID09PSB1bmRlZmluZWQpIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgZGlmZmVyZW5jZSAob3RoZXJUb2tlbikge1xuICAgIC8vIENvbXB1dGUgd2hhdCBpcyBsZWZ0IG9mIHRoaXMgYWZ0ZXIgc3VidHJhY3Rpbmcgb3V0IGV2ZXJ5dGhpbmcgaW4gb3RoZXJUb2tlblxuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNvbXB1dGUgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIGRpZmZlcmVudCB0b2tlbiB0eXBlc2ApO1xuICAgIH0gZWxzZSBpZiAob3RoZXJUb2tlbi5tYXRjaEFsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEluYWNjdXJhdGUgZGlmZmVyZW5jZSBjb21wdXRlZCEgVE9ETzogbmVlZCB0byBmaWd1cmUgb3V0IGhvdyB0byBpbnZlcnQgY2F0ZWdvcmljYWwga2V5cyFgKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdLZXlzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgaW4gKHRoaXMua2V5cyB8fCB7fSkpIHtcbiAgICAgICAgaWYgKCFvdGhlclRva2VuLmtleXMgfHwgIW90aGVyVG9rZW4ua2V5c1trZXldKSB7XG4gICAgICAgICAgbmV3S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1JhbmdlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICAgIGlmIChvdGhlclRva2VuLnJhbmdlcykge1xuICAgICAgICAgIGxldCBhbGxQb2ludHMgPSB0aGlzLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgYWxsUG9pbnRzID0gYWxsUG9pbnRzLmNvbmNhdChvdGhlclRva2VuLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSkpLnNvcnQoKTtcbiAgICAgICAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbFBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IHsgbG93OiBhbGxQb2ludHNbaV0udmFsdWUgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5leGNsdWRlKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0ubG93IC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5sb3cgPSBhbGxQb2ludHNbaV0uaGlnaCArIDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3UmFuZ2VzID0gdGhpcy5yYW5nZXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgS2V5c1Rva2VuKHRoaXMubXVyZSwgbnVsbCwgeyBrZXlzOiBuZXdLZXlzLCByYW5nZXM6IG5ld1JhbmdlcyB9KTtcbiAgICB9XG4gIH1cbiAgaXNTdWJTZXRPZiAoYXJnTGlzdCkge1xuICAgIGNvbnN0IG90aGVyVG9rZW4gPSBuZXcgS2V5c1Rva2VuKHRoaXMuc3RyZWFtLCBhcmdMaXN0KTtcbiAgICBjb25zdCBkaWZmID0gb3RoZXJUb2tlbi5kaWZmZXJlbmNlKHRoaXMpO1xuICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7IHJldHVybiAnLmtleXMoKSc7IH1cbiAgICByZXR1cm4gJy5rZXlzKCcgKyAodGhpcy5yYW5nZXMgfHwgW10pLm1hcCgoe2xvdywgaGlnaH0pID0+IHtcbiAgICAgIHJldHVybiBsb3cgPT09IGhpZ2ggPyBsb3cgOiBgJHtsb3d9LSR7aGlnaH1gO1xuICAgIH0pLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmtleXMgfHwge30pLm1hcChrZXkgPT4gYCcke2tleX0nYCkpXG4gICAgICAuam9pbignLCcpICsgJyknO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEtleXNUb2tlbiBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxldCB7bG93LCBoaWdofSBvZiB0aGlzLnJhbmdlcyB8fCBbXSkge1xuICAgICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgICAgaGlnaCA9IE1hdGgubWluKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5sZW5ndGggLSAxLCBoaWdoKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gbG93OyBpIDw9IGhpZ2g7IGkrKykge1xuICAgICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgcmF3SXRlbTogaVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW0uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgS2V5c1Rva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFZhbHVlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgY29uc3Qga2V5ID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAoa2V5VHlwZSAhPT0gJ3N0cmluZycgJiYga2V5VHlwZSAhPT0gJ251bWJlcicpKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEV2YWx1YXRlVG9rZW4gaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdTdHJlYW07XG4gICAgICB0cnkge1xuICAgICAgICBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5mb3JrKHdyYXBwZWRQYXJlbnQucmF3SXRlbSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnIHx8ICEoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpKSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFdmFsdWF0ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIE1hcFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gZ2VuZXJhdG9yO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiBnZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZ2VuZXJhdG9yXSh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1hcFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFByb21vdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIG1hcCwgaGFzaCwgcmVkdWNlSW5zdGFuY2VzIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID0gcmVkdWNlSW5zdGFuY2VzO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHJldHVybiB0aGlzLm1hcCA9PT0gbWFwICYmXG4gICAgICB0aGlzLmhhc2ggPT09IGhhc2ggJiZcbiAgICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID09PSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBjb25zdCBtYXBGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMubWFwXTtcbiAgICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuaGFzaF07XG4gICAgICBjb25zdCByZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMucmVkdWNlSW5zdGFuY2VzXTtcbiAgICAgIGNvbnN0IGhhc2hJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMuaGFzaCk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgbWFwRnVuY3Rpb24od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgICAgY29uc3QgaGFzaCA9IGhhc2hGdW5jdGlvbihtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgbGV0IG9yaWdpbmFsV3JhcHBlZEl0ZW0gPSAoYXdhaXQgaGFzaEluZGV4LmdldFZhbHVlTGlzdChoYXNoKSlbMF07XG4gICAgICAgIGlmIChvcmlnaW5hbFdyYXBwZWRJdGVtKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVkdWNlSW5zdGFuY2VzICE9PSAnbm9vcCcpIHtcbiAgICAgICAgICAgIHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgaGFzaGVzID0ge307XG4gICAgICAgICAgaGFzaGVzW3RoaXMuaGFzaF0gPSBoYXNoO1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbSxcbiAgICAgICAgICAgIGhhc2hlc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBKb2luVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2RlZmF1bHRGaW5pc2gnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIGZpbmlzaCwgdGhpc0hhc2gsIGZpbmlzaCBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tmdW5jXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7ZnVuY31gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wID0gc3RyZWFtLm5hbWVkU3RyZWFtc1tvdGhlclN0cmVhbV07XG4gICAgaWYgKCF0ZW1wKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgc3RyZWFtOiAke290aGVyU3RyZWFtfWApO1xuICAgIH1cbiAgICAvLyBSZXF1aXJlIG90aGVySGFzaCBvbiB0aGUgb3RoZXIgc3RyZWFtLCBvciBjb3B5IG91cnMgb3ZlciBpZiBpdCBpc24ndFxuICAgIC8vIGFscmVhZHkgZGVmaW5lZFxuICAgIGlmICghdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBoYXNoIGZ1bmN0aW9uIG9uIGVpdGhlciBzdHJlYW06ICR7b3RoZXJIYXNofWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdID0gc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5vdGhlclN0cmVhbSA9IG90aGVyU3RyZWFtO1xuICAgIHRoaXMudGhpc0hhc2ggPSB0aGlzSGFzaDtcbiAgICB0aGlzLm90aGVySGFzaCA9IG90aGVySGFzaDtcbiAgICB0aGlzLmZpbmlzaCA9IGZpbmlzaDtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAuam9pbigke3RoaXMub3RoZXJTdHJlYW19LCAke3RoaXMudGhpc0hhc2h9LCAke3RoaXMub3RoZXJIYXNofSwgJHt0aGlzLmZpbmlzaH0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIHRoaXMub3RoZXJTdHJlYW0gPT09IG90aGVyU3RyZWFtICYmXG4gICAgICB0aGlzLnRoaXNIYXNoID09PSB0aGlzSGFzaCAmJlxuICAgICAgdGhpcy5vdGhlckhhc2ggPT09IG90aGVySGFzaCAmJlxuICAgICAgdGhpcy5maW5pc2ggPT09IGZpbmlzaDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3Qgb3RoZXJTdHJlYW0gPSB0aGlzLnN0cmVhbS5uYW1lZFN0cmVhbXNbdGhpcy5vdGhlclN0cmVhbV07XG4gICAgY29uc3QgdGhpc0hhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMudGhpc0hhc2hdO1xuICAgIGNvbnN0IG90aGVySGFzaEZ1bmN0aW9uID0gb3RoZXJTdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5vdGhlckhhc2hdO1xuICAgIGNvbnN0IGZpbmlzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5maW5pc2hdO1xuXG4gICAgLy8gY29uc3QgdGhpc0l0ZXJhdG9yID0gdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKTtcbiAgICAvLyBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuXG4gICAgY29uc3QgdGhpc0luZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy50aGlzSGFzaCk7XG4gICAgY29uc3Qgb3RoZXJJbmRleCA9IG90aGVyU3RyZWFtLmdldEluZGV4KHRoaXMub3RoZXJIYXNoKTtcblxuICAgIGlmICh0aGlzSW5kZXguY29tcGxldGUpIHtcbiAgICAgIGlmIChvdGhlckluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIC8vIEJlc3Qgb2YgYWxsIHdvcmxkczsgd2UgY2FuIGp1c3Qgam9pbiB0aGUgaW5kZXhlc1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgaGFzaCwgdmFsdWVMaXN0IH0gb2YgdGhpc0luZGV4Lml0ZXJFbnRyaWVzKCkpIHtcbiAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB2YWx1ZUxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgdGhlIG90aGVyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2Ygb3VyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlclN0cmVhbS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgIC8vIEFkZCBvdGhlcldyYXBwZWRJdGVtIHRvIG90aGVySW5kZXg6XG4gICAgICAgICAgICBhd2FpdCBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgY29uc3QgdGhpc0xpc3QgPSBhd2FpdCB0aGlzSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChvdGhlckluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIC8vIE5lZWQgdG8gaXRlcmF0ZSBvdXIgaXRlbXMsIGFuZCB0YWtlIGFkdmFudGFnZSBvZiB0aGUgb3RoZXIgY29tcGxldGVcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiB0aGlzSGFzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICBhd2FpdCB0aGlzSW5kZXguYWRkVmFsdWUoaGFzaCwgdGhpc1dyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5laXRoZXIgc3RyZWFtIGlzIGZ1bGx5IGluZGV4ZWQ7IGZvciBtb3JlIGRpc3RyaWJ1dGVkIHNhbXBsaW5nLCBncmFiXG4gICAgICAgIC8vIG9uZSBpdGVtIGZyb20gZWFjaCBzdHJlYW0gYXQgYSB0aW1lLCBhbmQgdXNlIHRoZSBwYXJ0aWFsIGluZGV4ZXNcbiAgICAgICAgY29uc3QgdGhpc0l0ZXJhdG9yID0gdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKTtcbiAgICAgICAgbGV0IHRoaXNJc0RvbmUgPSBmYWxzZTtcbiAgICAgICAgY29uc3Qgb3RoZXJJdGVyYXRvciA9IG90aGVyU3RyZWFtLml0ZXJhdGUoKTtcbiAgICAgICAgbGV0IG90aGVySXNEb25lID0gZmFsc2U7XG5cbiAgICAgICAgd2hpbGUgKCF0aGlzSXNEb25lIHx8ICFvdGhlcklzRG9uZSkge1xuICAgICAgICAgIC8vIFRha2Ugb25lIHNhbXBsZSBmcm9tIHRoaXMgc3RyZWFtXG4gICAgICAgICAgbGV0IHRlbXAgPSBhd2FpdCB0aGlzSXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXNJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB0aGlzV3JhcHBlZEl0ZW0gPSBhd2FpdCB0ZW1wLnZhbHVlO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgICB0aGlzSW5kZXguYWRkVmFsdWUoaGFzaCwgdGhpc1dyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE5vdyBmb3IgYSBzYW1wbGUgZnJvbSB0aGUgb3RoZXIgc3RyZWFtXG4gICAgICAgICAgdGVtcCA9IGF3YWl0IG90aGVySXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIG90aGVySXNEb25lID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgLy8gYWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleFxuICAgICAgICAgICAgICBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSm9pblRva2VuO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4uL1N0cmVhbS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sXG4gICAgICB0aGlzLm11cmUuTkFNRURfRlVOQ1RJT05TLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICB0aGlzLnNlbGVjdG9yID0gb3B0aW9ucy5zZWxlY3RvciB8fCBgcm9vdC52YWx1ZXMoKWA7XG4gICAgdGhpcy5fY3VzdG9tQ2xhc3NOYW1lID0gb3B0aW9ucy5jdXN0b21OYW1lIHx8IG51bGw7XG4gICAgdGhpcy50b2tlbkNsYXNzTGlzdCA9IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IpO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NUeXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBzZWxlY3RvcjogdGhpcy5zZWxlY3RvcixcbiAgICAgIGN1c3RvbU5hbWU6IHRoaXMuX2N1c3RvbUNsYXNzTmFtZSxcbiAgICAgIGluZGV4ZXM6IHt9XG4gICAgfTtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyh0aGlzLmluZGV4ZXMpLm1hcChhc3luYyAoW2Z1bmNOYW1lLCBpbmRleF0pID0+IHtcbiAgICAgIGlmIChpbmRleC5jb21wbGV0ZSkge1xuICAgICAgICByZXN1bHQuaW5kZXhlc1tmdW5jTmFtZV0gPSBhd2FpdCBpbmRleC50b1Jhd09iamVjdCgpO1xuICAgICAgfVxuICAgIH0pKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHdyYXAgKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMuV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY3VzdG9tQ2xhc3NOYW1lIHx8ICdjbGFzcyBuYW1lIGF1dG8taW5mZXJlbmNlIG5vdCBpbXBsZW1lbnRlZCc7XG4gIH1cbiAgZ2V0U3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAob3B0aW9ucy5yZXNldCB8fCAhdGhpcy5fc3RyZWFtKSB7XG4gICAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdDtcbiAgICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSB0aGlzLm5hbWVkRnVuY3Rpb25zO1xuICAgICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IHRoaXM7XG4gICAgICBvcHRpb25zLmluZGV4ZXMgPSB0aGlzLmluZGV4ZXM7XG4gICAgICB0aGlzLl9zdHJlYW0gPSBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtO1xuICB9XG4gIGlzU3VwZXJTZXRPZlRva2VuTGlzdCAodG9rZW5MaXN0KSB7XG4gICAgaWYgKHRva2VuTGlzdC5sZW5ndGggIT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QuZXZlcnkoKHRva2VuLCBpKSA9PiB0b2tlbi5pc1N1cGVyU2V0T2YodG9rZW5MaXN0W2ldKSk7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zZWxlY3Rvcl0gPSBuZXcgdGhpcy5tdXJlLkNMQVNTRVMuTm9kZUNsYXNzKG9wdGlvbnMpO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNlbGVjdG9yXTtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gYXdhaXQgdGhpcy50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNlbGVjdG9yXSA9IG5ldyB0aGlzLm11cmUuQ0xBU1NFUy5FZGdlQ2xhc3Mob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc2VsZWN0b3JdO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcjtcbiAgICB0aGlzLmVkZ2VTZWxlY3RvcnMgPSBvcHRpb25zLmVkZ2VTZWxlY3RvcnMgfHwge307XG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5lZGdlU2VsZWN0b3JzKS5mb3JFYWNoKChbc2VsZWN0b3IsIHsgbm9kZUhhc2gsIGVkZ2VIYXNoIH1dKSA9PiB7XG4gICAgICBpZiAodHlwZW9mIG5vZGVIYXNoID09PSAnc3RyaW5nJykge1xuICAgICAgICBub2RlSGFzaCA9IG5ldyBGdW5jdGlvbihub2RlSGFzaCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgZWRnZUhhc2ggPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGVkZ2VIYXNoID0gbmV3IEZ1bmN0aW9uKGVkZ2VIYXNoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICAgICAgfVxuICAgICAgdGhpcy5lZGdlU2VsZWN0b3JzW3NlbGVjdG9yXSA9IHsgbm9kZUhhc2gsIGVkZ2VIYXNoIH07XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIC8vIFRPRE86IGEgYmFiZWwgYnVnIChodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzM5MzApXG4gICAgLy8gcHJldmVudHMgYGF3YWl0IHN1cGVyYDsgdGhpcyBpcyBhIHdvcmthcm91bmQ6XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgR2VuZXJpY0NsYXNzLnByb3RvdHlwZS50b1Jhd09iamVjdC5jYWxsKHRoaXMpO1xuICAgIHJlc3VsdC5lZGdlU2VsZWN0b3JzID0ge307XG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5lZGdlU2VsZWN0b3JzKS5mb3JFYWNoKChbc2VsZWN0b3IsIHsgbm9kZUhhc2gsIGVkZ2VIYXNoIH1dKSA9PiB7XG4gICAgICBub2RlSGFzaCA9IG5vZGVIYXNoLnRvU3RyaW5nKCk7XG4gICAgICBlZGdlSGFzaCA9IGVkZ2VIYXNoLnRvU3RyaW5nKCk7XG4gICAgICByZXN1bHQuZWRnZVNlbGVjdG9yc1tzZWxlY3Rvcl0gPSB7IG5vZGVIYXNoLCBlZGdlSGFzaCB9O1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgdGhpc0hhc2gsIG90aGVySGFzaCB9KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgICB0aGlzLnNvdXJjZVNlbGVjdG9yID0gb3B0aW9ucy5zb3VyY2VTZWxlY3RvciB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0U2VsZWN0b3IgPSBvcHRpb25zLnRhcmdldFNlbGVjdG9yIHx8IG51bGw7XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIC8vIFRPRE86IGEgYmFiZWwgYnVnIChodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzM5MzApXG4gICAgLy8gcHJldmVudHMgYGF3YWl0IHN1cGVyYDsgdGhpcyBpcyBhIHdvcmthcm91bmQ6XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgR2VuZXJpY0NsYXNzLnByb3RvdHlwZS50b1Jhd09iamVjdC5jYWxsKHRoaXMpO1xuICAgIHJlc3VsdC5zb3VyY2VTZWxlY3RvciA9IHRoaXMuc291cmNlU2VsZWN0b3I7XG4gICAgcmVzdWx0LnRhcmdldFNlbGVjdG9yID0gdGhpcy50YXJnZXRTZWxlY3RvcjtcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUhhc2gsIGVkZ2VIYXNoIH0pIHtcbiAgICBpZiAoZGlyZWN0aW9uID09PSAnc291cmNlJykge1xuICAgICAgaWYgKHRoaXMuc291cmNlU2VsZWN0b3IpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlU2VsZWN0b3JdLmVkZ2VTZWxlY3RvcnNbdGhpcy5zZWxlY3Rvcl07XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZVNlbGVjdG9yID0gbm9kZUNsYXNzLnNlbGVjdG9yO1xuICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uID09PSAndGFyZ2V0Jykge1xuICAgICAgaWYgKHRoaXMudGFyZ2V0U2VsZWN0b3IpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0U2VsZWN0b3JdLmVkZ2VTZWxlY3RvcnNbdGhpcy5zZWxlY3Rvcl07XG4gICAgICB9XG4gICAgICB0aGlzLnRhcmdldFNlbGVjdG9yID0gbm9kZUNsYXNzLnNlbGVjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXRoaXMuc291cmNlU2VsZWN0b3IpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VTZWxlY3RvciA9IG5vZGVDbGFzcy5zZWxlY3RvcjtcbiAgICAgIH0gZWxzZSBpZiAoIXRoaXMudGFyZ2V0U2VsZWN0b3IpIHtcbiAgICAgICAgdGhpcy50YXJnZXRTZWxlY3RvciA9IG5vZGVDbGFzcy5zZWxlY3RvcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgU291cmNlIGFuZCB0YXJnZXQgYXJlIGFscmVhZHkgZGVmaW5lZDsgcGxlYXNlIHNwZWNpZnkgYSBkaXJlY3Rpb24gdG8gb3ZlcnJpZGVgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZUNsYXNzLmVkZ2VTZWxlY3RvcnNbdGhpcy5zZWxlY3Rvcl0gPSB7IG5vZGVIYXNoLCBlZGdlSGFzaCB9O1xuICB9XG4gIGdldFN0cmVhbSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy53cmFwcGVkUGFyZW50ID0gd3JhcHBlZFBhcmVudDtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5yYXdJdGVtID0gcmF3SXRlbTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluTWVtb3J5SW5kZXg7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IHNoYTEgZnJvbSAnc2hhMSc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi9TdHJlYW0uanMnO1xuaW1wb3J0ICogYXMgVE9LRU5TIGZyb20gJy4vVG9rZW5zL1Rva2Vucy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBtdXJlLmRlYnVnIHRvIHRydWUgdG8gZGVidWcgc3RyZWFtc1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgdGhpcy5UUlVUSFlfU1RSSU5HUyA9IHtcbiAgICAgICd0cnVlJzogdHJ1ZSxcbiAgICAgICd5ZXMnOiB0cnVlLFxuICAgICAgJ3knOiB0cnVlXG4gICAgfTtcbiAgICB0aGlzLkZBTFNFWV9TVFJJTkdTID0ge1xuICAgICAgJ2ZhbHNlJzogdHJ1ZSxcbiAgICAgICdubyc6IHRydWUsXG4gICAgICAnbic6IHRydWVcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UT0tFTlMgPSBUT0tFTlM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIE1vbmtleS1wYXRjaCBhdmFpbGFibGUgdG9rZW5zIGFzIGZ1bmN0aW9ucyBvbnRvIHRoZSBTdHJlYW0gY2xhc3NcbiAgICBmb3IgKGNvbnN0IHRva2VuQ2xhc3NOYW1lIGluIHRoaXMuVE9LRU5TKSB7XG4gICAgICBjb25zdCBUb2tlbkNsYXNzID0gdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdO1xuICAgICAgU3RyZWFtLnByb3RvdHlwZVtUb2tlbkNsYXNzLmxvd2VyQ2FtZWxDYXNlVHlwZV0gPSBmdW5jdGlvbiAoYXJnTGlzdCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5leHRlbmQoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIFtcbiAgICAgICAgICB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgXTtcbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy5yb290ID0gdGhpcy5sb2FkUm9vdCgpO1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgb3VyIGNsYXNzIHNwZWNpZmljYXRpb25zXG4gICAgdGhpcy5jbGFzc2VzID0gdGhpcy5sb2FkQ2xhc3NlcygpO1xuICB9XG5cbiAgbG9hZFJvb3QgKCkge1xuICAgIGxldCByb290ID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbXVyZV9yb290Jyk7XG4gICAgcm9vdCA9IHJvb3QgPyBKU09OLnBhcnNlKHJvb3QpIDoge307XG4gICAgcmV0dXJuIHJvb3Q7XG4gIH1cbiAgYXN5bmMgc2F2ZVJvb3QgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbXVyZV9yb290JywgSlNPTi5zdHJpbmdpZnkodGhpcy5yb290KSk7XG4gICAgfVxuICB9XG4gIGxvYWRDbGFzc2VzICgpIHtcbiAgICBsZXQgY2xhc3NlcyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ211cmVfY2xhc3NlcycpO1xuICAgIGNsYXNzZXMgPSBjbGFzc2VzID8gSlNPTi5wYXJzZShjbGFzc2VzKSA6IHt9O1xuICAgIE9iamVjdC5lbnRyaWVzKGNsYXNzZXMpLmZvckVhY2goKFsgY2xhc3NTZWxlY3RvciwgcmF3Q2xhc3NPYmogXSkgPT4ge1xuICAgICAgT2JqZWN0LmVudHJpZXMocmF3Q2xhc3NPYmouaW5kZXhlcykuZm9yRWFjaCgoW2Z1bmNOYW1lLCByYXdJbmRleE9ial0pID0+IHtcbiAgICAgICAgcmF3Q2xhc3NPYmouaW5kZXhlc1tmdW5jTmFtZV0gPSBuZXcgdGhpcy5JTkRFWEVTLkluTWVtb3J5SW5kZXgoe1xuICAgICAgICAgIGVudHJpZXM6IHJhd0luZGV4T2JqLCBjb21wbGV0ZTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2xhc3NUeXBlID0gcmF3Q2xhc3NPYmouY2xhc3NUeXBlO1xuICAgICAgZGVsZXRlIHJhd0NsYXNzT2JqLmNsYXNzVHlwZTtcbiAgICAgIHJhd0NsYXNzT2JqLm11cmUgPSB0aGlzO1xuICAgICAgY2xhc3Nlc1tjbGFzc1NlbGVjdG9yXSA9IG5ldyB0aGlzLkNMQVNTRVNbY2xhc3NUeXBlXShyYXdDbGFzc09iaik7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNsYXNzZXM7XG4gIH1cbiAgYXN5bmMgc2F2ZUNsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgcmF3Q2xhc3NlcyA9IHt9O1xuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXModGhpcy5jbGFzc2VzKVxuICAgICAgICAubWFwKGFzeW5jIChbIGNsYXNzU2VsZWN0b3IsIGNsYXNzT2JqIF0pID0+IHtcbiAgICAgICAgICByYXdDbGFzc2VzW2NsYXNzU2VsZWN0b3JdID0gYXdhaXQgY2xhc3NPYmoudG9SYXdPYmplY3QoKTtcbiAgICAgICAgfSkpO1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbXVyZV9jbGFzc2VzJywgSlNPTi5zdHJpbmdpZnkocmF3Q2xhc3NlcykpO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlU2VsZWN0b3IgKHNlbGVjdG9yU3RyaW5nKSB7XG4gICAgaWYgKCFzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdyb290JykpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgU2VsZWN0b3JzIG11c3Qgc3RhcnQgd2l0aCAncm9vdCdgKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5TdHJpbmdzID0gc2VsZWN0b3JTdHJpbmcubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpO1xuICAgIGlmICghdG9rZW5TdHJpbmdzKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgc2VsZWN0b3Igc3RyaW5nOiAke3NlbGVjdG9yU3RyaW5nfWApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlbkNsYXNzTGlzdCA9IFt7XG4gICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5Sb290VG9rZW5cbiAgICB9XTtcbiAgICB0b2tlblN0cmluZ3MuZm9yRWFjaChjaHVuayA9PiB7XG4gICAgICBjb25zdCB0ZW1wID0gY2h1bmsubWF0Y2goL14uKFteKF0qKVxcKChbXildKilcXCkvKTtcbiAgICAgIGlmICghdGVtcCkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgdG9rZW46ICR7Y2h1bmt9YCk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b2tlbkNsYXNzTmFtZSA9IHRlbXBbMV1bMF0udG9VcHBlckNhc2UoKSArIHRlbXBbMV0uc2xpY2UoMSkgKyAnVG9rZW4nO1xuICAgICAgY29uc3QgYXJnTGlzdCA9IHRlbXBbMl0uc3BsaXQoLyg/PCFcXFxcKSwvKS5tYXAoZCA9PiB7XG4gICAgICAgIGQgPSBkLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIGQgPT09ICcnID8gdW5kZWZpbmVkIDogZDtcbiAgICAgIH0pO1xuICAgICAgaWYgKHRva2VuQ2xhc3NOYW1lID09PSAnVmFsdWVzVG9rZW4nKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLktleXNUb2tlbixcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5WYWx1ZVRva2VuXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0pIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gdG9rZW46ICR7dGVtcFsxXX1gKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdG9rZW5DbGFzc0xpc3Q7XG4gIH1cblxuICBzdHJlYW0gKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnBhcnNlU2VsZWN0b3Iob3B0aW9ucy5zZWxlY3RvciB8fCBgcm9vdC52YWx1ZXMoKWApO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG5cbiAgYXN5bmMgbmV3Q2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoKWAgfSkge1xuICAgIGlmICh0aGlzLmNsYXNzZXNbb3B0aW9ucy5zZWxlY3Rvcl0pIHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5zZWxlY3Rvcl07XG4gICAgfVxuICAgIGNvbnN0IENsYXNzVHlwZSA9IG9wdGlvbnMuQ2xhc3NUeXBlIHx8IHRoaXMuQ0xBU1NFUy5HZW5lcmljQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuQ2xhc3NUeXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuc2VsZWN0b3JdID0gbmV3IENsYXNzVHlwZShvcHRpb25zKTtcbiAgICBhd2FpdCB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLnNlbGVjdG9yXTtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY0RhdGFTb3VyY2UoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2Uoe1xuICAgICAga2V5OiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAga2V5LFxuICAgIGV4dGVuc2lvbiA9ICd0eHQnLFxuICAgIHRleHRcbiAgfSkge1xuICAgIGxldCBvYmo7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIG9iaiA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgZGVsZXRlIG9iai5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY0RhdGFTb3VyY2Uoa2V5LCBvYmopO1xuICB9XG4gIGFzeW5jIGFkZFN0YXRpY0RhdGFTb3VyY2UgKGtleSwgb2JqKSB7XG4gICAgdGhpcy5yb290W2tleV0gPSBvYmo7XG4gICAgY29uc3QgdGVtcCA9IGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLnNhdmVSb290KCksIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IGByb290LnZhbHVlcygnJHtrZXl9JykudmFsdWVzKClgXG4gICAgfSldKTtcbiAgICByZXR1cm4gdGVtcFsxXTtcbiAgfVxuICBhc3luYyByZW1vdmVEYXRhU291cmNlIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5yb290W2tleV07XG4gICAgYXdhaXQgdGhpcy5zYXZlUm9vdCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwiaW5kZXgiLCJzcGxpY2UiLCJhcmdzIiwiZm9yRWFjaCIsImFwcGx5IiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJ0aW1lb3V0Iiwic2V0VGltZW91dCIsInRyaWdnZXIiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwiaSIsIlN0cmVhbSIsIm9wdGlvbnMiLCJtdXJlIiwibmFtZWRGdW5jdGlvbnMiLCJOQU1FRF9GVU5DVElPTlMiLCJuYW1lZFN0cmVhbXMiLCJsYXVuY2hlZEZyb21DbGFzcyIsImluZGV4ZXMiLCJ0b2tlbkNsYXNzTGlzdCIsInRva2VuTGlzdCIsIm1hcCIsIlRva2VuQ2xhc3MiLCJhcmdMaXN0IiwiV3JhcHBlcnMiLCJnZXRXcmFwcGVyTGlzdCIsInRva2VuIiwibGVuZ3RoIiwiV3JhcHBlciIsImxvY2FsVG9rZW5MaXN0Iiwic2xpY2UiLCJwb3RlbnRpYWxXcmFwcGVycyIsInZhbHVlcyIsImNsYXNzZXMiLCJmaWx0ZXIiLCJjbGFzc09iaiIsImV2ZXJ5IiwibG9jYWxUb2tlbiIsImxvY2FsSW5kZXgiLCJ0b2tlbkNsYXNzU3BlYyIsImlzU3Vic2V0T2YiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwid2FybiIsInNlbGVjdG9yIiwiam9pbiIsInBhcnNlU2VsZWN0b3IiLCJjb25jYXQiLCJ3cmFwcGVkUGFyZW50IiwicmF3SXRlbSIsImhhc2hlcyIsIndyYXBwZXJJbmRleCIsInRlbXAiLCJ3cmFwcGVkSXRlbSIsIlByb21pc2UiLCJhbGwiLCJlbnRyaWVzIiwicmVkdWNlIiwicHJvbWlzZUxpc3QiLCJoYXNoRnVuY3Rpb25OYW1lIiwiaGFzaCIsImdldEluZGV4IiwiY29tcGxldGUiLCJhZGRWYWx1ZSIsImxhc3RUb2tlbiIsIml0ZXJhdGUiLCJJTkRFWEVTIiwiSW5NZW1vcnlJbmRleCIsImhhc2hGdW5jdGlvbiIsIkVycm9yIiwibGltaXQiLCJyZWJ1aWxkSW5kZXhlcyIsIml0ZXJhdG9yIiwibmV4dCIsImRvbmUiLCJ2YWx1ZSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImNvbnN0cnVjdG9yIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b0xvd2VyQ2FzZSIsImFuY2VzdG9yVG9rZW5zIiwicGFyZW50VG9rZW4iLCJ5aWVsZGVkU29tZXRoaW5nIiwiZGVidWciLCJUeXBlRXJyb3IiLCJleGVjIiwibmFtZSIsIlJvb3RUb2tlbiIsIndyYXAiLCJyb290IiwiS2V5c1Rva2VuIiwibWF0Y2hBbGwiLCJrZXlzIiwicmFuZ2VzIiwidW5kZWZpbmVkIiwiYXJnIiwibWF0Y2giLCJJbmZpbml0eSIsImQiLCJwYXJzZUludCIsImlzTmFOIiwibG93IiwiaGlnaCIsIm51bSIsIk51bWJlciIsIlN5bnRheEVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImNvbnNvbGlkYXRlUmFuZ2VzIiwic2VsZWN0c05vdGhpbmciLCJuZXdSYW5nZXMiLCJzb3J0IiwiYSIsImIiLCJjdXJyZW50UmFuZ2UiLCJvdGhlclRva2VuIiwibmV3S2V5cyIsImtleSIsImFsbFBvaW50cyIsImFnZyIsInJhbmdlIiwiaW5jbHVkZSIsImV4Y2x1ZGUiLCJkaWZmIiwiZGlmZmVyZW5jZSIsIml0ZXJhdGVQYXJlbnQiLCJNYXRoIiwibWF4IiwibWluIiwiaGFzT3duUHJvcGVydHkiLCJWYWx1ZVRva2VuIiwib2JqIiwia2V5VHlwZSIsIkV2YWx1YXRlVG9rZW4iLCJuZXdTdHJlYW0iLCJmb3JrIiwiZXJyIiwiTWFwVG9rZW4iLCJnZW5lcmF0b3IiLCJtYXBwZWRSYXdJdGVtIiwiUHJvbW90ZVRva2VuIiwicmVkdWNlSW5zdGFuY2VzIiwiZnVuYyIsIm1hcEZ1bmN0aW9uIiwicmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24iLCJoYXNoSW5kZXgiLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwiZ2V0VmFsdWVMaXN0IiwiSm9pblRva2VuIiwib3RoZXJTdHJlYW0iLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImZpbmlzaCIsInRoaXNIYXNoRnVuY3Rpb24iLCJvdGhlckhhc2hGdW5jdGlvbiIsImZpbmlzaEZ1bmN0aW9uIiwidGhpc0luZGV4Iiwib3RoZXJJbmRleCIsIml0ZXJFbnRyaWVzIiwidmFsdWVMaXN0Iiwib3RoZXJMaXN0Iiwib3RoZXJXcmFwcGVkSXRlbSIsInRoaXNXcmFwcGVkSXRlbSIsInRoaXNMaXN0IiwidGhpc0l0ZXJhdG9yIiwidGhpc0lzRG9uZSIsIm90aGVySXRlcmF0b3IiLCJvdGhlcklzRG9uZSIsIkdlbmVyaWNDbGFzcyIsIl9jdXN0b21DbGFzc05hbWUiLCJjdXN0b21OYW1lIiwicmVzdWx0IiwiZnVuY05hbWUiLCJ0b1Jhd09iamVjdCIsImNsYXNzTmFtZSIsInJlc2V0IiwiX3N0cmVhbSIsImlzU3VwZXJTZXRPZiIsIkNMQVNTRVMiLCJOb2RlQ2xhc3MiLCJzYXZlQ2xhc3NlcyIsIkVkZ2VDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZVNlbGVjdG9ycyIsIm5vZGVIYXNoIiwiZWRnZUhhc2giLCJGdW5jdGlvbiIsInByb3RvdHlwZSIsImNhbGwiLCJ0b1N0cmluZyIsIm5vZGVDbGFzcyIsImVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlU2VsZWN0b3IiLCJ0YXJnZXRTZWxlY3RvciIsImRpcmVjdGVkIiwiZGlyZWN0aW9uIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiREFUQUxJQl9GT1JNQVRTIiwiVFJVVEhZX1NUUklOR1MiLCJGQUxTRVlfU1RSSU5HUyIsIlRPS0VOUyIsInRva2VuQ2xhc3NOYW1lIiwiZXh0ZW5kIiwicGFyZW50VHlwZSIsInNoYTEiLCJsb2FkUm9vdCIsImxvYWRDbGFzc2VzIiwiZ2V0SXRlbSIsInBhcnNlIiwic2V0SXRlbSIsImNsYXNzU2VsZWN0b3IiLCJyYXdDbGFzc09iaiIsInJhd0luZGV4T2JqIiwiY2xhc3NUeXBlIiwicmF3Q2xhc3NlcyIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aCIsInRva2VuU3RyaW5ncyIsImNodW5rIiwidG9VcHBlckNhc2UiLCJzcGxpdCIsInRyaW0iLCJDbGFzc1R5cGUiLCJjaGFyc2V0IiwiZmlsZU9iaiIsImZpbGVNQiIsInNpemUiLCJza2lwU2l6ZUNoZWNrIiwidGV4dCIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiZW5jb2RpbmciLCJhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UiLCJleHRlbnNpb25PdmVycmlkZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY0RhdGFTb3VyY2UiLCJzYXZlUm9vdCIsIm5ld0Ns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
