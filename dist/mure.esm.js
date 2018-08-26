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
  EmptyToken: EmptyToken,
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
    this.classId = options.classId;
    this._selector = options.selector;
    this.customClassName = options.customClassName || null;
    this.opsSinceCustomName = options.opsSinceCustomName || null;
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
        opsSinceCustomName: _this.opsSinceCustomName,
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
  set className(value) {
    this.customClassName = value;
    this.opsSinceCustomName = 0;
  }
  get className() {
    if (this.opsSinceCustomName === null) {
      return this.selector;
    } else {
      const tokenStrings = this.selector.match(/\.([^(]*)\(([^)]*)\)/g);
      if (this.opsSinceCustomName > tokenStrings.length) {
        return this.selector;
      } else {
        const sliceIndex = tokenStrings.length - this.opsSinceCustomName;
        return `${this.customClassName}.${tokenStrings.slice(sliceIndex).join('.')}`;
      }
    }
  }
  setNamedFunction(funcName, func) {
    this.namedFunctions[funcName] = func;
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
      _this2.mure.classes[_this2.classId] = new _this2.mure.CLASSES.NodeClass(options);
      yield _this2.mure.saveClasses();
      return _this2.mure.classes[_this2.classId];
    })();
  }
  interpretAsEdges() {
    var _this3 = this;

    return asyncToGenerator(function* () {
      const options = yield _this3.toRawObject();
      options.mure = _this3.mure;
      _this3.mure.classes[_this3.classId] = new _this3.mure.CLASSES.EdgeClass(options);
      yield _this3.mure.saveClasses();
      return _this3.mure.classes[_this3.classId];
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
      if (!sourceClass) {
        if (!targetClass) {
          // No connections yet; just yield the raw edge table
          return this._selector;
        } else {
          // Partial edge-target connections
          const { edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId];
          return this._selector + `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        }
      } else if (!targetClass) {
        // Partial source-edge connections
        const { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        return sourceClass.selector + `.join(edge, ${nodeHashName}, ${edgeHashName}, defaultFinish)`;
      } else {
        // Full connections
        let result = sourceClass.selector;
        let { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        result += `.join(edge, ${nodeHashName}, ${edgeHashName}, defaultFinish)`;
        ({ edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId]);
        result += `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        return result;
      }
    }
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
var version = "0.4.8r1";
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

let mure = new Mure(window.FileReader, window.localStorage);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIFN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy5uYW1lZFN0cmVhbXMgPSBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fTtcbiAgICB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCBudWxsO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgICB0aGlzLnRva2VuQ2xhc3NMaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdCB8fCBbXTtcblxuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy5uYW1lZEZ1bmN0aW9uc1xuICAgIC8vIGFuZCB0aGlzLm5hbWVkU3RyZWFtc1xuICAgIHRoaXMudG9rZW5MaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdC5tYXAoKHsgVG9rZW5DbGFzcywgYXJnTGlzdCB9KSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFRva2VuQ2xhc3ModGhpcywgYXJnTGlzdCk7XG4gICAgfSk7XG4gICAgLy8gUmVtaW5kZXI6IHRoaXMgYWx3YXlzIG5lZWRzIHRvIGJlIGFmdGVyIGluaXRpYWxpemluZyB0aGlzLnRva2VuTGlzdFxuICAgIHRoaXMuV3JhcHBlcnMgPSB0aGlzLmdldFdyYXBwZXJMaXN0KCk7XG4gIH1cblxuICBnZXRXcmFwcGVyTGlzdCAoKSB7XG4gICAgLy8gTG9vayB1cCB3aGljaCwgaWYgYW55LCBjbGFzc2VzIGRlc2NyaWJlIHRoZSByZXN1bHQgb2YgZWFjaCB0b2tlbiwgc28gdGhhdFxuICAgIC8vIHdlIGNhbiB3cmFwIGl0ZW1zIGFwcHJvcHJpYXRlbHk6XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0Lm1hcCgodG9rZW4sIGluZGV4KSA9PiB7XG4gICAgICBpZiAoaW5kZXggPT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEgJiYgdGhpcy5sYXVuY2hlZEZyb21DbGFzcykge1xuICAgICAgICAvLyBJZiB0aGlzIHN0cmVhbSB3YXMgc3RhcnRlZCBmcm9tIGEgY2xhc3MsIHdlIGFscmVhZHkga25vdyB3ZSBzaG91bGRcbiAgICAgICAgLy8gdXNlIHRoYXQgY2xhc3MncyB3cmFwcGVyIGZvciB0aGUgbGFzdCB0b2tlblxuICAgICAgICByZXR1cm4gdGhpcy5sYXVuY2hlZEZyb21DbGFzcy5XcmFwcGVyO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBhIGNsYXNzIHRoYXQgZGVzY3JpYmVzIGV4YWN0bHkgZWFjaCBzZXJpZXMgb2YgdG9rZW5zXG4gICAgICBjb25zdCBsb2NhbFRva2VuTGlzdCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIGluZGV4ICsgMSk7XG4gICAgICBjb25zdCBwb3RlbnRpYWxXcmFwcGVycyA9IE9iamVjdC52YWx1ZXModGhpcy5tdXJlLmNsYXNzZXMpXG4gICAgICAgIC5maWx0ZXIoY2xhc3NPYmogPT4ge1xuICAgICAgICAgIGlmICghY2xhc3NPYmoudG9rZW5DbGFzc0xpc3QubGVuZ3RoICE9PSBsb2NhbFRva2VuTGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW5MaXN0LmV2ZXJ5KChsb2NhbFRva2VuLCBsb2NhbEluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbkNsYXNzU3BlYyA9IGNsYXNzT2JqLnRva2VuQ2xhc3NMaXN0W2xvY2FsSW5kZXhdO1xuICAgICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW4gaW5zdGFuY2VvZiB0b2tlbkNsYXNzU3BlYy5Ub2tlbkNsYXNzICYmXG4gICAgICAgICAgICAgIHRva2VuLmlzU3Vic2V0T2YodG9rZW5DbGFzc1NwZWMuYXJnTGlzdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBObyBjbGFzc2VzIGRlc2NyaWJlIHRoaXMgc2VyaWVzIG9mIHRva2Vucywgc28gdXNlIHRoZSBnZW5lcmljIHdyYXBwZXJcbiAgICAgICAgcmV0dXJuIHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBNdWx0aXBsZSBjbGFzc2VzIGRlc2NyaWJlIHRoZSBzYW1lIGl0ZW0hIEFyYml0cmFyaWx5IGNob29zaW5nIG9uZS4uLmApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwb3RlbnRpYWxXcmFwcGVyc1swXS5XcmFwcGVyO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3Quam9pbignJyk7XG4gIH1cblxuICBmb3JrIChzZWxlY3Rvcikge1xuICAgIHJldHVybiBuZXcgU3RyZWFtKHtcbiAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB0aGlzLm5hbWVkRnVuY3Rpb25zLFxuICAgICAgbmFtZWRTdHJlYW1zOiB0aGlzLm5hbWVkU3RyZWFtcyxcbiAgICAgIHRva2VuQ2xhc3NMaXN0OiB0aGlzLm11cmUucGFyc2VTZWxlY3RvcihzZWxlY3RvciksXG4gICAgICBsYXVuY2hlZEZyb21DbGFzczogdGhpcy5sYXVuY2hlZEZyb21DbGFzcyxcbiAgICAgIGluZGV4ZXM6IHRoaXMuaW5kZXhlc1xuICAgIH0pO1xuICB9XG5cbiAgZXh0ZW5kIChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRGdW5jdGlvbnMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZFN0cmVhbXMsIG9wdGlvbnMubmFtZWRTdHJlYW1zIHx8IHt9KTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdC5jb25jYXQoW3sgVG9rZW5DbGFzcywgYXJnTGlzdCB9XSk7XG4gICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgdGhpcy5sYXVuY2hlZEZyb21DbGFzcztcbiAgICBvcHRpb25zLmluZGV4ZXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmluZGV4ZXMsIG9wdGlvbnMuaW5kZXhlcyB8fCB7fSk7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBhc3luYyB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtLCBoYXNoZXMgPSB7fSB9KSB7XG4gICAgbGV0IHdyYXBwZXJJbmRleCA9IDA7XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB3cmFwcGVySW5kZXggKz0gMTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gbmV3IHRoaXMuV3JhcHBlcnNbd3JhcHBlckluZGV4XSh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKGhhc2hlcykucmVkdWNlKChwcm9taXNlTGlzdCwgW2hhc2hGdW5jdGlvbk5hbWUsIGhhc2hdKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXgoaGFzaEZ1bmN0aW9uTmFtZSk7XG4gICAgICBpZiAoIWluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlTGlzdC5jb25jYXQoWyBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSkgXSk7XG4gICAgICB9XG4gICAgfSwgW10pKTtcbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cblxuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIGNvbnN0IGxhc3RUb2tlbiA9IHRoaXMudG9rZW5MaXN0W3RoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxKTtcbiAgICB5aWVsZCAqIGF3YWl0IGxhc3RUb2tlbi5pdGVyYXRlKHRlbXApO1xuICB9XG5cbiAgZ2V0SW5kZXggKGhhc2hGdW5jdGlvbk5hbWUpIHtcbiAgICBpZiAoIXRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSkge1xuICAgICAgLy8gVE9ETzogaWYgdXNpbmcgbm9kZS5qcywgc3RhcnQgd2l0aCBleHRlcm5hbCAvIG1vcmUgc2NhbGFibGUgaW5kZXhlc1xuICAgICAgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdID0gbmV3IHRoaXMubXVyZS5JTkRFWEVTLkluTWVtb3J5SW5kZXgoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgfVxuXG4gIGFzeW5jIGJ1aWxkSW5kZXggKGhhc2hGdW5jdGlvbk5hbWUpIHtcbiAgICBjb25zdCBoYXNoRnVuY3Rpb24gPSB0aGlzLm5hbWVkRnVuY3Rpb25zW2hhc2hGdW5jdGlvbk5hbWVdO1xuICAgIGlmICghaGFzaEZ1bmN0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7aGFzaEZ1bmN0aW9uTmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmdldEluZGV4KGhhc2hGdW5jdGlvbk5hbWUpO1xuICAgIGlmIChpbmRleC5jb21wbGV0ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgaGFzaEZ1bmN0aW9uKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSk7XG4gICAgICB9XG4gICAgfVxuICAgIGluZGV4LmNvbXBsZXRlID0gdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jICogc2FtcGxlICh7IGxpbWl0ID0gMTAsIHJlYnVpbGRJbmRleGVzID0gZmFsc2UgfSkge1xuICAgIC8vIEJlZm9yZSB3ZSBzdGFydCwgY2xlYW4gb3V0IGFueSBvbGQgaW5kZXhlcyB0aGF0IHdlcmUgbmV2ZXIgZmluaXNoZWRcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLmluZGV4ZXMpLmZvckVhY2goKFtoYXNoRnVuY3Rpb25OYW1lLCBpbmRleF0pID0+IHtcbiAgICAgIGlmIChyZWJ1aWxkSW5kZXhlcyB8fCAhaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgLy8gV2UgYWN0dWFsbHkgZmluaXNoZWQgYSBmdWxsIHBhc3M7IGZsYWcgYWxsIG9mIG91ciBpbmRleGVzIGFzIGNvbXBsZXRlXG4gICAgICAgIE9iamVjdC52YWx1ZXModGhpcy5pbmRleGVzKS5mb3JFYWNoKGluZGV4ID0+IHtcbiAgICAgICAgICBpbmRleC5jb21wbGV0ZSA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVRva2VuIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgLy8gVGhlIHN0cmluZyB2ZXJzaW9uIG9mIG1vc3QgdG9rZW5zIGNhbiBqdXN0IGJlIGRlcml2ZWQgZnJvbSB0aGUgY2xhc3MgdHlwZVxuICAgIHJldHVybiBgLiR7dGhpcy50eXBlLnRvTG93ZXJDYXNlKCl9KClgO1xuICB9XG4gIGlzU3ViU2V0T2YgKCkge1xuICAgIC8vIEJ5IGRlZmF1bHQgKHdpdGhvdXQgYW55IGFyZ3VtZW50cyksIHRva2VucyBvZiB0aGUgc2FtZSBjbGFzcyBhcmUgc3Vic2V0c1xuICAgIC8vIG9mIGVhY2ggb3RoZXJcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlUGFyZW50IChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IHBhcmVudFRva2VuID0gYW5jZXN0b3JUb2tlbnNbYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IGFuY2VzdG9yVG9rZW5zLnNsaWNlKDAsIGFuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDEpO1xuICAgIGxldCB5aWVsZGVkU29tZXRoaW5nID0gZmFsc2U7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRva2VuLml0ZXJhdGUodGVtcCkpIHtcbiAgICAgIHlpZWxkZWRTb21ldGhpbmcgPSB0cnVlO1xuICAgICAgeWllbGQgd3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgaWYgKCF5aWVsZGVkU29tZXRoaW5nICYmIHRoaXMubXVyZS5kZWJ1Zykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVG9rZW4geWllbGRlZCBubyByZXN1bHRzOiAke3BhcmVudFRva2VufWApO1xuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRW1wdHlUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgLy8geWllbGQgbm90aGluZ1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYGVtcHR5YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRW1wdHlUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBSb290VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudDogbnVsbCxcbiAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgcmF3SXRlbTogdGhpcy5zdHJlYW0ubXVyZS5yb290XG4gICAgfSk7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgcm9vdGA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFJvb3RUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBLZXlzVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBhcmdMaXN0LCB7IG1hdGNoQWxsLCBrZXlzLCByYW5nZXMgfSA9IHt9KSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoa2V5cyB8fCByYW5nZXMpIHtcbiAgICAgIHRoaXMua2V5cyA9IGtleXM7XG4gICAgICB0aGlzLnJhbmdlcyA9IHJhbmdlcztcbiAgICB9IGVsc2UgaWYgKChhcmdMaXN0ICYmIGFyZ0xpc3QubGVuZ3RoID09PSAxICYmIGFyZ0xpc3RbMF0gPT09IHVuZGVmaW5lZCkgfHwgbWF0Y2hBbGwpIHtcbiAgICAgIHRoaXMubWF0Y2hBbGwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdMaXN0LmZvckVhY2goYXJnID0+IHtcbiAgICAgICAgbGV0IHRlbXAgPSBhcmcubWF0Y2goLyhcXGQrKS0oW1xcZOKInl0rKS8pO1xuICAgICAgICBpZiAodGVtcCAmJiB0ZW1wWzJdID09PSAn4oieJykge1xuICAgICAgICAgIHRlbXBbMl0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gdGVtcCA/IHRlbXAubWFwKGQgPT4gZC5wYXJzZUludChkKSkgOiBudWxsO1xuICAgICAgICBpZiAodGVtcCAmJiAhaXNOYU4odGVtcFsxXSkgJiYgIWlzTmFOKHRlbXBbMl0pKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IHRlbXBbMV07IGkgPD0gdGVtcFsyXTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogdGVtcFsxXSwgaGlnaDogdGVtcFsyXSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSBhcmcubWF0Y2goLycoLiopJy8pO1xuICAgICAgICB0ZW1wID0gdGVtcCAmJiB0ZW1wWzFdID8gdGVtcFsxXSA6IGFyZztcbiAgICAgICAgbGV0IG51bSA9IE51bWJlcih0ZW1wKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bSkgfHwgbnVtICE9PSBwYXJzZUludCh0ZW1wKSkgeyAvLyBsZWF2ZSBub24taW50ZWdlciBudW1iZXJzIGFzIHN0cmluZ3NcbiAgICAgICAgICB0aGlzLmtleXMgPSB0aGlzLmtleXMgfHwge307XG4gICAgICAgICAgdGhpcy5rZXlzW3RlbXBdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IG51bSwgaGlnaDogbnVtIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGlmICghdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEJhZCB0b2tlbiBrZXkocykgLyByYW5nZShzKTogJHtKU09OLnN0cmluZ2lmeShhcmdMaXN0KX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICB0aGlzLnJhbmdlcyA9IHRoaXMuY29uc29saWRhdGVSYW5nZXModGhpcy5yYW5nZXMpO1xuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0c05vdGhpbmcgKCkge1xuICAgIHJldHVybiAhdGhpcy5tYXRjaEFsbCAmJiAhdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcztcbiAgfVxuICBjb25zb2xpZGF0ZVJhbmdlcyAocmFuZ2VzKSB7XG4gICAgLy8gTWVyZ2UgYW55IG92ZXJsYXBwaW5nIHJhbmdlc1xuICAgIGNvbnN0IG5ld1JhbmdlcyA9IFtdO1xuICAgIGNvbnN0IHRlbXAgPSByYW5nZXMuc29ydCgoYSwgYikgPT4gYS5sb3cgLSBiLmxvdyk7XG4gICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWN1cnJlbnRSYW5nZSkge1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfSBlbHNlIGlmICh0ZW1wW2ldLmxvdyA8PSBjdXJyZW50UmFuZ2UuaGlnaCkge1xuICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IHRlbXBbaV0uaGlnaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAgIC8vIENvcm5lciBjYXNlOiBhZGQgdGhlIGxhc3QgcmFuZ2VcbiAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgfVxuICAgIHJldHVybiBuZXdSYW5nZXMubGVuZ3RoID4gMCA/IG5ld1JhbmdlcyA6IHVuZGVmaW5lZDtcbiAgfVxuICBkaWZmZXJlbmNlIChvdGhlclRva2VuKSB7XG4gICAgLy8gQ29tcHV0ZSB3aGF0IGlzIGxlZnQgb2YgdGhpcyBhZnRlciBzdWJ0cmFjdGluZyBvdXQgZXZlcnl0aGluZyBpbiBvdGhlclRva2VuXG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgY29tcHV0ZSB0aGUgZGlmZmVyZW5jZSBvZiB0d28gZGlmZmVyZW50IHRva2VuIHR5cGVzYCk7XG4gICAgfSBlbHNlIGlmIChvdGhlclRva2VuLm1hdGNoQWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGNvbnNvbGUud2FybihgSW5hY2N1cmF0ZSBkaWZmZXJlbmNlIGNvbXB1dGVkISBUT0RPOiBuZWVkIHRvIGZpZ3VyZSBvdXQgaG93IHRvIGludmVydCBjYXRlZ29yaWNhbCBrZXlzIWApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld0tleXMgPSB7fTtcbiAgICAgIGZvciAobGV0IGtleSBpbiAodGhpcy5rZXlzIHx8IHt9KSkge1xuICAgICAgICBpZiAoIW90aGVyVG9rZW4ua2V5cyB8fCAhb3RoZXJUb2tlbi5rZXlzW2tleV0pIHtcbiAgICAgICAgICBuZXdLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3UmFuZ2VzID0gW107XG4gICAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgICAgaWYgKG90aGVyVG9rZW4ucmFuZ2VzKSB7XG4gICAgICAgICAgbGV0IGFsbFBvaW50cyA9IHRoaXMucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICBhbGxQb2ludHMgPSBhbGxQb2ludHMuY29uY2F0KG90aGVyVG9rZW4ucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKSkuc29ydCgpO1xuICAgICAgICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0geyBsb3c6IGFsbFBvaW50c1tpXS52YWx1ZSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmV4Y2x1ZGUpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS5sb3cgLSAxO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmxvdyA9IGFsbFBvaW50c1tpXS5oaWdoICsgMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdSYW5nZXMgPSB0aGlzLnJhbmdlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBLZXlzVG9rZW4odGhpcy5tdXJlLCBudWxsLCB7IGtleXM6IG5ld0tleXMsIHJhbmdlczogbmV3UmFuZ2VzIH0pO1xuICAgIH1cbiAgfVxuICBpc1N1YlNldE9mIChhcmdMaXN0KSB7XG4gICAgY29uc3Qgb3RoZXJUb2tlbiA9IG5ldyBLZXlzVG9rZW4odGhpcy5zdHJlYW0sIGFyZ0xpc3QpO1xuICAgIGNvbnN0IGRpZmYgPSBvdGhlclRva2VuLmRpZmZlcmVuY2UodGhpcyk7XG4gICAgcmV0dXJuIGRpZmYgPT09IG51bGwgfHwgZGlmZi5zZWxlY3RzTm90aGluZztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHsgcmV0dXJuICcua2V5cygpJzsgfVxuICAgIHJldHVybiAnLmtleXMoJyArICh0aGlzLnJhbmdlcyB8fCBbXSkubWFwKCh7bG93LCBoaWdofSkgPT4ge1xuICAgICAgcmV0dXJuIGxvdyA9PT0gaGlnaCA/IGxvdyA6IGAke2xvd30tJHtoaWdofWA7XG4gICAgfSkuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMua2V5cyB8fCB7fSkubWFwKGtleSA9PiBgJyR7a2V5fSdgKSlcbiAgICAgIC5qb2luKCcsJykgKyAnKSc7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgICAgZm9yIChsZXQga2V5IGluIHdyYXBwZWRQYXJlbnQucmF3SXRlbSkge1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgICAgbG93ID0gTWF0aC5tYXgoMCwgbG93KTtcbiAgICAgICAgICBoaWdoID0gTWF0aC5taW4od3JhcHBlZFBhcmVudC5yYXdJdGVtLmxlbmd0aCAtIDEsIGhpZ2gpO1xuICAgICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICByYXdJdGVtOiBpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gdGhpcy5rZXlzIHx8IHt9KSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgY29uc3Qgb2JqID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgIGNvbnN0IGtleVR5cGUgPSB0eXBlb2Yga2V5O1xuICAgICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IChrZXlUeXBlICE9PSAnc3RyaW5nJyAmJiBrZXlUeXBlICE9PSAnbnVtYmVyJykpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVmFsdWVUb2tlbiB1c2VkIG9uIGEgbm9uLW9iamVjdCwgb3Igd2l0aG91dCBhIHN0cmluZyAvIG51bWVyaWMga2V5YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgcmF3SXRlbTogb2JqW2tleV1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVmFsdWVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFdmFsdWF0ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gRXZhbHVhdGVUb2tlbiBpcyBub3QgYSBzdHJpbmdgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1N0cmVhbTtcbiAgICAgIHRyeSB7XG4gICAgICAgIG5ld1N0cmVhbSA9IHRoaXMuc3RyZWFtLmZvcmsod3JhcHBlZFBhcmVudC5yYXdJdGVtKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcgfHwgIShlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikpIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkICogYXdhaXQgbmV3U3RyZWFtLml0ZXJhdGUoKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZ2VuZXJhdG9yXSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2dlbmVyYXRvcn1gKTtcbiAgICB9XG4gICAgdGhpcy5nZW5lcmF0b3IgPSBnZW5lcmF0b3I7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLm1hcCgke3RoaXMuZ2VuZXJhdG9yfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvciA9PT0gdGhpcy5nZW5lcmF0b3I7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5nZW5lcmF0b3JdKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgbWFwLCBoYXNoLCByZWR1Y2VJbnN0YW5jZXMgXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLnByb21vdGUoJHt0aGlzLm1hcH0sICR7dGhpcy5oYXNofSwgJHt0aGlzLnJlZHVjZUluc3RhbmNlc30pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwID09PSBtYXAgJiZcbiAgICAgIHRoaXMuaGFzaCA9PT0gaGFzaCAmJlxuICAgICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPT09IHJlZHVjZUluc3RhbmNlcztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG1hcEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5tYXBdO1xuICAgICAgY29uc3QgaGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5oYXNoXTtcbiAgICAgIGNvbnN0IHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5yZWR1Y2VJbnN0YW5jZXNdO1xuICAgICAgY29uc3QgaGFzaEluZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy5oYXNoKTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiBtYXBGdW5jdGlvbih3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICBjb25zdCBoYXNoID0gaGFzaEZ1bmN0aW9uKG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICBsZXQgb3JpZ2luYWxXcmFwcGVkSXRlbSA9IChhd2FpdCBoYXNoSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpKVswXTtcbiAgICAgICAgaWYgKG9yaWdpbmFsV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWR1Y2VJbnN0YW5jZXMgIT09ICdub29wJykge1xuICAgICAgICAgICAgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24ob3JpZ2luYWxXcmFwcGVkSXRlbSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBoYXNoZXMgPSB7fTtcbiAgICAgICAgICBoYXNoZXNbdGhpcy5oYXNoXSA9IGhhc2g7XG4gICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtLFxuICAgICAgICAgICAgaGFzaGVzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEpvaW5Ub2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnZGVmYXVsdEZpbmlzaCcgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgZmluaXNoLCB0aGlzSGFzaCwgZmluaXNoIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHRlbXAgPSBzdHJlYW0ubmFtZWRTdHJlYW1zW290aGVyU3RyZWFtXTtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBzdHJlYW06ICR7b3RoZXJTdHJlYW19YCk7XG4gICAgfVxuICAgIC8vIFJlcXVpcmUgb3RoZXJIYXNoIG9uIHRoZSBvdGhlciBzdHJlYW0sIG9yIGNvcHkgb3VycyBvdmVyIGlmIGl0IGlzbid0XG4gICAgLy8gYWxyZWFkeSBkZWZpbmVkXG4gICAgaWYgKCF0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGhhc2ggZnVuY3Rpb24gb24gZWl0aGVyIHN0cmVhbTogJHtvdGhlckhhc2h9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0gPSBzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm90aGVyU3RyZWFtID0gb3RoZXJTdHJlYW07XG4gICAgdGhpcy50aGlzSGFzaCA9IHRoaXNIYXNoO1xuICAgIHRoaXMub3RoZXJIYXNoID0gb3RoZXJIYXNoO1xuICAgIHRoaXMuZmluaXNoID0gZmluaXNoO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5qb2luKCR7dGhpcy5vdGhlclN0cmVhbX0sICR7dGhpcy50aGlzSGFzaH0sICR7dGhpcy5vdGhlckhhc2h9LCAke3RoaXMuZmluaXNofSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnaWRlbnRpdHknIF0pIHtcbiAgICByZXR1cm4gdGhpcy5vdGhlclN0cmVhbSA9PT0gb3RoZXJTdHJlYW0gJiZcbiAgICAgIHRoaXMudGhpc0hhc2ggPT09IHRoaXNIYXNoICYmXG4gICAgICB0aGlzLm90aGVySGFzaCA9PT0gb3RoZXJIYXNoICYmXG4gICAgICB0aGlzLmZpbmlzaCA9PT0gZmluaXNoO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBjb25zdCBvdGhlclN0cmVhbSA9IHRoaXMuc3RyZWFtLm5hbWVkU3RyZWFtc1t0aGlzLm90aGVyU3RyZWFtXTtcbiAgICBjb25zdCB0aGlzSGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy50aGlzSGFzaF07XG4gICAgY29uc3Qgb3RoZXJIYXNoRnVuY3Rpb24gPSBvdGhlclN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLm90aGVySGFzaF07XG4gICAgY29uc3QgZmluaXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmZpbmlzaF07XG5cbiAgICAvLyBjb25zdCB0aGlzSXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpO1xuICAgIC8vIGNvbnN0IG90aGVySXRlcmF0b3IgPSBvdGhlclN0cmVhbS5pdGVyYXRlKCk7XG5cbiAgICBjb25zdCB0aGlzSW5kZXggPSB0aGlzLnN0cmVhbS5nZXRJbmRleCh0aGlzLnRoaXNIYXNoKTtcbiAgICBjb25zdCBvdGhlckluZGV4ID0gb3RoZXJTdHJlYW0uZ2V0SW5kZXgodGhpcy5vdGhlckhhc2gpO1xuXG4gICAgaWYgKHRoaXNJbmRleC5jb21wbGV0ZSkge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gQmVzdCBvZiBhbGwgd29ybGRzOyB3ZSBjYW4ganVzdCBqb2luIHRoZSBpbmRleGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBoYXNoLCB2YWx1ZUxpc3QgfSBvZiB0aGlzSW5kZXguaXRlckVudHJpZXMoKSkge1xuICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHZhbHVlTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5lZWQgdG8gaXRlcmF0ZSB0aGUgb3RoZXIgaXRlbXMsIGFuZCB0YWtlIGFkdmFudGFnZSBvZiBvdXIgY29tcGxldGVcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyU3RyZWFtLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgLy8gQWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleDpcbiAgICAgICAgICAgIGF3YWl0IG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIG91ciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIHRoZSBvdGhlciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgLy8gYWRkIHRoaXNXcmFwcGVkSXRlbSB0byB0aGlzSW5kZXhcbiAgICAgICAgICAgIGF3YWl0IHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVpdGhlciBzdHJlYW0gaXMgZnVsbHkgaW5kZXhlZDsgZm9yIG1vcmUgZGlzdHJpYnV0ZWQgc2FtcGxpbmcsIGdyYWJcbiAgICAgICAgLy8gb25lIGl0ZW0gZnJvbSBlYWNoIHN0cmVhbSBhdCBhIHRpbWUsIGFuZCB1c2UgdGhlIHBhcnRpYWwgaW5kZXhlc1xuICAgICAgICBjb25zdCB0aGlzSXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpO1xuICAgICAgICBsZXQgdGhpc0lzRG9uZSA9IGZhbHNlO1xuICAgICAgICBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuICAgICAgICBsZXQgb3RoZXJJc0RvbmUgPSBmYWxzZTtcblxuICAgICAgICB3aGlsZSAoIXRoaXNJc0RvbmUgfHwgIW90aGVySXNEb25lKSB7XG4gICAgICAgICAgLy8gVGFrZSBvbmUgc2FtcGxlIGZyb20gdGhpcyBzdHJlYW1cbiAgICAgICAgICBsZXQgdGVtcCA9IGF3YWl0IHRoaXNJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgdGhpc0lzRG9uZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgdGhpc0hhc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICAgIHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm93IGZvciBhIHNhbXBsZSBmcm9tIHRoZSBvdGhlciBzdHJlYW1cbiAgICAgICAgICB0ZW1wID0gYXdhaXQgb3RoZXJJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgb3RoZXJJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBvdGhlcldyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4XG4gICAgICAgICAgICAgIG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBKb2luVG9rZW47XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi4vU3RyZWFtLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLl9zZWxlY3RvciA9IG9wdGlvbnMuc2VsZWN0b3I7XG4gICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSBvcHRpb25zLmN1c3RvbUNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMub3BzU2luY2VDdXN0b21OYW1lID0gb3B0aW9ucy5vcHNTaW5jZUN1c3RvbU5hbWUgfHwgbnVsbDtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgdGhpcy5pbmRleGVzID0gb3B0aW9ucy5pbmRleGVzIHx8IHt9O1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgZm9yIChsZXQgW2Z1bmNOYW1lLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm5hbWVkRnVuY3Rpb25zKSkge1xuICAgICAgaWYgKHR5cGVvZiBmdW5jID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IG5ldyBGdW5jdGlvbihgcmV0dXJuICR7ZnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gICAgICB9XG4gICAgfVxuICB9XG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NlbGVjdG9yO1xuICB9XG4gIGdldCB0b2tlbkNsYXNzTGlzdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKHRoaXMuc2VsZWN0b3IpO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBjbGFzc1R5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZSxcbiAgICAgIHNlbGVjdG9yOiB0aGlzLl9zZWxlY3RvcixcbiAgICAgIGN1c3RvbUNsYXNzTmFtZTogdGhpcy5jdXN0b21DbGFzc05hbWUsXG4gICAgICBvcHNTaW5jZUN1c3RvbU5hbWU6IHRoaXMub3BzU2luY2VDdXN0b21OYW1lLFxuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgaW5kZXhlczoge30sXG4gICAgICBuYW1lZEZ1bmN0aW9uczoge31cbiAgICB9O1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKHRoaXMuaW5kZXhlcykubWFwKGFzeW5jIChbZnVuY05hbWUsIGluZGV4XSkgPT4ge1xuICAgICAgaWYgKGluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIHJlc3VsdC5pbmRleGVzW2Z1bmNOYW1lXSA9IGF3YWl0IGluZGV4LnRvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgfSkpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgd3JhcCAob3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgdGhpcy5XcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIHNldCBjbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLm9wc1NpbmNlQ3VzdG9tTmFtZSA9IDA7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgaWYgKHRoaXMub3BzU2luY2VDdXN0b21OYW1lID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy5zZWxlY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdG9rZW5TdHJpbmdzID0gdGhpcy5zZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgICBpZiAodGhpcy5vcHNTaW5jZUN1c3RvbU5hbWUgPiB0b2tlblN0cmluZ3MubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNlbGVjdG9yO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgc2xpY2VJbmRleCA9IHRva2VuU3RyaW5ncy5sZW5ndGggLSB0aGlzLm9wc1NpbmNlQ3VzdG9tTmFtZTtcbiAgICAgICAgcmV0dXJuIGAke3RoaXMuY3VzdG9tQ2xhc3NOYW1lfS4ke3Rva2VuU3RyaW5ncy5zbGljZShzbGljZUluZGV4KS5qb2luKCcuJyl9YDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgc2V0TmFtZWRGdW5jdGlvbiAoZnVuY05hbWUsIGZ1bmMpIHtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IGZ1bmM7XG4gIH1cbiAgZ2V0U3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAob3B0aW9ucy5yZXNldCB8fCAhdGhpcy5fc3RyZWFtKSB7XG4gICAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdDtcbiAgICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSB0aGlzLm5hbWVkRnVuY3Rpb25zO1xuICAgICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IHRoaXM7XG4gICAgICBvcHRpb25zLmluZGV4ZXMgPSB0aGlzLmluZGV4ZXM7XG4gICAgICB0aGlzLl9zdHJlYW0gPSBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtO1xuICB9XG4gIGlzU3VwZXJTZXRPZlRva2VuTGlzdCAodG9rZW5MaXN0KSB7XG4gICAgaWYgKHRva2VuTGlzdC5sZW5ndGggIT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QuZXZlcnkoKHRva2VuLCBpKSA9PiB0b2tlbi5pc1N1cGVyU2V0T2YodG9rZW5MaXN0W2ldKSk7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXSA9IG5ldyB0aGlzLm11cmUuQ0xBU1NFUy5Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXSA9IG5ldyB0aGlzLm11cmUuQ0xBU1NFUy5FZGdlQ2xhc3Mob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgYXN5bmMgYWdncmVnYXRlIChoYXNoLCByZWR1Y2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBleHBhbmQgKG1hcCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGZpbHRlciAoZmlsdGVyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgKiBzcGxpdCAoaGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGRlbGV0ZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICAgIHRoaXMuZWRnZUNvbm5lY3Rpb25zID0gb3B0aW9ucy5lZGdlQ29ubmVjdGlvbnMgfHwge307XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIC8vIFRPRE86IGEgYmFiZWwgYnVnIChodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzM5MzApXG4gICAgLy8gcHJldmVudHMgYGF3YWl0IHN1cGVyYDsgdGhpcyBpcyBhIHdvcmthcm91bmQ6XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgR2VuZXJpY0NsYXNzLnByb3RvdHlwZS50b1Jhd09iamVjdC5jYWxsKHRoaXMpO1xuICAgIC8vIFRPRE86IG5lZWQgdG8gZGVlcCBjb3B5IGVkZ2VDb25uZWN0aW9ucz9cbiAgICByZXN1bHQuZWRnZUNvbm5lY3Rpb25zID0gdGhpcy5lZGdlQ29ubmVjdGlvbnM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCB0aGlzSGFzaE5hbWUsIG90aGVySGFzaE5hbWUgfSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuXG4gICAgaWYgKCF0aGlzLl9zZWxlY3Rvcikge1xuICAgICAgaWYgKCFzb3VyY2VDbGFzcyB8fCAhdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJ0aWFsIGNvbm5lY3Rpb25zIHdpdGhvdXQgYW4gZWRnZSB0YWJsZSBzaG91bGQgbmV2ZXIgaGFwcGVuYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBObyBlZGdlIHRhYmxlIChzaW1wbGUgam9pbiBiZXR3ZWVuIHR3byBub2RlcylcbiAgICAgICAgY29uc3Qgc291cmNlSGFzaCA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgY29uc3QgdGFyZ2V0SGFzaCA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgcmV0dXJuIHNvdXJjZUNsYXNzLnNlbGVjdG9yICsgYC5qb2luKHRhcmdldCwgJHtzb3VyY2VIYXNofSwgJHt0YXJnZXRIYXNofSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXNvdXJjZUNsYXNzKSB7XG4gICAgICAgIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgICAvLyBObyBjb25uZWN0aW9ucyB5ZXQ7IGp1c3QgeWllbGQgdGhlIHJhdyBlZGdlIHRhYmxlXG4gICAgICAgICAgcmV0dXJuIHRoaXMuX3NlbGVjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFBhcnRpYWwgZWRnZS10YXJnZXQgY29ubmVjdGlvbnNcbiAgICAgICAgICBjb25zdCB7IGVkZ2VIYXNoTmFtZSwgbm9kZUhhc2hOYW1lIH0gPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fc2VsZWN0b3IgKyBgLmpvaW4odGFyZ2V0LCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCF0YXJnZXRDbGFzcykge1xuICAgICAgICAvLyBQYXJ0aWFsIHNvdXJjZS1lZGdlIGNvbm5lY3Rpb25zXG4gICAgICAgIGNvbnN0IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICByZXR1cm4gc291cmNlQ2xhc3Muc2VsZWN0b3IgKyBgLmpvaW4oZWRnZSwgJHtub2RlSGFzaE5hbWV9LCAke2VkZ2VIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gpYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZ1bGwgY29ubmVjdGlvbnNcbiAgICAgICAgbGV0IHJlc3VsdCA9IHNvdXJjZUNsYXNzLnNlbGVjdG9yO1xuICAgICAgICBsZXQgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJlc3VsdCArPSBgLmpvaW4oZWRnZSwgJHtub2RlSGFzaE5hbWV9LCAke2VkZ2VIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gpYDtcbiAgICAgICAgKHsgZWRnZUhhc2hOYW1lLCBub2RlSGFzaE5hbWUgfSA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdKTtcbiAgICAgICAgcmVzdWx0ICs9IGAuam9pbih0YXJnZXQsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoKWA7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICAvLyBUT0RPOiBhIGJhYmVsIGJ1ZyAoaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8zOTMwKVxuICAgIC8vIHByZXZlbnRzIGBhd2FpdCBzdXBlcmA7IHRoaXMgaXMgYSB3b3JrYXJvdW5kOlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEdlbmVyaWNDbGFzcy5wcm90b3R5cGUudG9SYXdPYmplY3QuY2FsbCh0aGlzKTtcbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgYXN5bmMgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgZGlyZWN0aW9uLCBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICB9XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNvdXJjZSBhbmQgdGFyZ2V0IGFyZSBhbHJlYWR5IGRlZmluZWQ7IHBsZWFzZSBzcGVjaWZ5IGEgZGlyZWN0aW9uIHRvIG92ZXJyaWRlYCk7XG4gICAgICB9XG4gICAgfVxuICAgIG5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXSA9IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfTtcbiAgICBkZWxldGUgdGhpcy5fc3RyZWFtO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy53cmFwcGVkUGFyZW50ID0gd3JhcHBlZFBhcmVudDtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5yYXdJdGVtID0gcmF3SXRlbTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluTWVtb3J5SW5kZXg7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IHNoYTEgZnJvbSAnc2hhMSc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi9TdHJlYW0uanMnO1xuaW1wb3J0ICogYXMgVE9LRU5TIGZyb20gJy4vVG9rZW5zL1Rva2Vucy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRPS0VOUyA9IFRPS0VOUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gTW9ua2V5LXBhdGNoIGF2YWlsYWJsZSB0b2tlbnMgYXMgZnVuY3Rpb25zIG9udG8gdGhlIFN0cmVhbSBjbGFzc1xuICAgIGZvciAoY29uc3QgdG9rZW5DbGFzc05hbWUgaW4gdGhpcy5UT0tFTlMpIHtcbiAgICAgIGNvbnN0IFRva2VuQ2xhc3MgPSB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV07XG4gICAgICBTdHJlYW0ucHJvdG90eXBlW1Rva2VuQ2xhc3MubG93ZXJDYW1lbENhc2VUeXBlXSA9IGZ1bmN0aW9uIChhcmdMaXN0LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmV4dGVuZChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAvLyBpZiByZWxldmFudCwgbWVyZ2UgdGhlIHJlc3VsdHMgb2YgYSBzZXJpZXMgb2Ygam9pbnMgaW50byBhIHNpbmdsZVxuICAgICAgICAgIC8vIGFycmF5XG4gICAgICAgICAgeWllbGQgdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0uY29uY2F0KFsgb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtIF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG90aGVyd2lzZSBqdXN0IHlpZWxkIHRoZSB0d28gcmVzdWx0cyBhcyBhbiBhcnJheVxuICAgICAgICAgIHlpZWxkIFtcbiAgICAgICAgICAgIHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgICAgb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgICAgXTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnJvb3QgPSB0aGlzLmxvYWRSb290KCk7XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBvdXIgY2xhc3Mgc3BlY2lmaWNhdGlvbnNcbiAgICB0aGlzLmNsYXNzZXMgPSB0aGlzLmxvYWRDbGFzc2VzKCk7XG4gIH1cblxuICBsb2FkUm9vdCAoKSB7XG4gICAgbGV0IHJvb3QgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX3Jvb3QnKTtcbiAgICByb290ID0gcm9vdCA/IEpTT04ucGFyc2Uocm9vdCkgOiB7fTtcbiAgICByZXR1cm4gcm9vdDtcbiAgfVxuICBhc3luYyBzYXZlUm9vdCAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX3Jvb3QnLCBKU09OLnN0cmluZ2lmeSh0aGlzLnJvb3QpKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyb290VXBkYXRlJyk7XG4gIH1cbiAgbG9hZENsYXNzZXMgKCkge1xuICAgIGxldCBjbGFzc2VzID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbXVyZV9jbGFzc2VzJyk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMgPyBKU09OLnBhcnNlKGNsYXNzZXMpIDoge307XG4gICAgT2JqZWN0LmVudHJpZXMoY2xhc3NlcykuZm9yRWFjaCgoWyBjbGFzc0lkLCByYXdDbGFzc09iaiBdKSA9PiB7XG4gICAgICBPYmplY3QuZW50cmllcyhyYXdDbGFzc09iai5pbmRleGVzKS5mb3JFYWNoKChbZnVuY05hbWUsIHJhd0luZGV4T2JqXSkgPT4ge1xuICAgICAgICByYXdDbGFzc09iai5pbmRleGVzW2Z1bmNOYW1lXSA9IG5ldyB0aGlzLklOREVYRVMuSW5NZW1vcnlJbmRleCh7XG4gICAgICAgICAgZW50cmllczogcmF3SW5kZXhPYmosIGNvbXBsZXRlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICBjb25zdCBjbGFzc1R5cGUgPSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICBkZWxldGUgcmF3Q2xhc3NPYmouY2xhc3NUeXBlO1xuICAgICAgcmF3Q2xhc3NPYmoubXVyZSA9IHRoaXM7XG4gICAgICBjbGFzc2VzW2NsYXNzSWRdID0gbmV3IHRoaXMuQ0xBU1NFU1tjbGFzc1R5cGVdKHJhd0NsYXNzT2JqKTtcbiAgICB9KTtcbiAgICByZXR1cm4gY2xhc3NlcztcbiAgfVxuICBhc3luYyBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCByYXdDbGFzc2VzID0ge307XG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyh0aGlzLmNsYXNzZXMpXG4gICAgICAgIC5tYXAoYXN5bmMgKFsgY2xhc3NJZCwgY2xhc3NPYmogXSkgPT4ge1xuICAgICAgICAgIHJhd0NsYXNzZXNbY2xhc3NJZF0gPSBhd2FpdCBjbGFzc09iai50b1Jhd09iamVjdCgpO1xuICAgICAgICB9KSk7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX2NsYXNzZXMnLCBKU09OLnN0cmluZ2lmeShyYXdDbGFzc2VzKSk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcignY2xhc3NVcGRhdGUnKTtcbiAgfVxuXG4gIHBhcnNlU2VsZWN0b3IgKHNlbGVjdG9yU3RyaW5nKSB7XG4gICAgY29uc3Qgc3RhcnRzV2l0aFJvb3QgPSBzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdyb290Jyk7XG4gICAgaWYgKCEoc3RhcnRzV2l0aFJvb3QgfHwgc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgnZW1wdHknKSkpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgU2VsZWN0b3JzIG11c3Qgc3RhcnQgd2l0aCAncm9vdCcgb3IgJ2VtcHR5J2ApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3RvclN0cmluZy5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgaWYgKCF0b2tlblN0cmluZ3MpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCBzZWxlY3RvciBzdHJpbmc6ICR7c2VsZWN0b3JTdHJpbmd9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuQ2xhc3NMaXN0ID0gW3tcbiAgICAgIFRva2VuQ2xhc3M6IHN0YXJ0c1dpdGhSb290ID8gdGhpcy5UT0tFTlMuUm9vdFRva2VuIDogdGhpcy5UT0tFTlMuRW1wdHlUb2tlblxuICAgIH1dO1xuICAgIHRva2VuU3RyaW5ncy5mb3JFYWNoKGNodW5rID0+IHtcbiAgICAgIGNvbnN0IHRlbXAgPSBjaHVuay5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKCF0ZW1wKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCB0b2tlbjogJHtjaHVua31gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRva2VuQ2xhc3NOYW1lID0gdGVtcFsxXVswXS50b1VwcGVyQ2FzZSgpICsgdGVtcFsxXS5zbGljZSgxKSArICdUb2tlbic7XG4gICAgICBjb25zdCBhcmdMaXN0ID0gdGVtcFsyXS5zcGxpdCgvKD88IVxcXFwpLC8pLm1hcChkID0+IHtcbiAgICAgICAgZCA9IGQudHJpbSgpO1xuICAgICAgICByZXR1cm4gZCA9PT0gJycgPyB1bmRlZmluZWQgOiBkO1xuICAgICAgfSk7XG4gICAgICBpZiAodG9rZW5DbGFzc05hbWUgPT09ICdWYWx1ZXNUb2tlbicpIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuS2V5c1Rva2VuLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLlZhbHVlVG9rZW5cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSkge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biB0b2tlbjogJHt0ZW1wWzFdfWApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0b2tlbkNsYXNzTGlzdDtcbiAgfVxuXG4gIHN0cmVhbSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMucGFyc2VTZWxlY3RvcihvcHRpb25zLnNlbGVjdG9yIHx8IGByb290LnZhbHVlcygpYCk7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBhc3luYyBuZXdDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGByb290YCB9KSB7XG4gICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIGNvbnN0IENsYXNzVHlwZSA9IG9wdGlvbnMuQ2xhc3NUeXBlIHx8IHRoaXMuQ0xBU1NFUy5HZW5lcmljQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuQ2xhc3NUeXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ2xhc3NUeXBlKG9wdGlvbnMpO1xuICAgIGF3YWl0IHRoaXMuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNEYXRhU291cmNlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlKHtcbiAgICAgIGtleTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFzeW5jIGFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGtleSxcbiAgICBleHRlbnNpb24gPSAndHh0JyxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICBsZXQgb2JqO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBvYmogPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGRlbGV0ZSBvYmouY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNEYXRhU291cmNlKGtleSwgb2JqKTtcbiAgfVxuICBhc3luYyBhZGRTdGF0aWNEYXRhU291cmNlIChrZXksIG9iaikge1xuICAgIHRoaXMucm9vdFtrZXldID0gb2JqO1xuICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5zYXZlUm9vdCgpLCB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoJyR7a2V5fScpLnZhbHVlcygpYFxuICAgIH0pXSk7XG4gICAgcmV0dXJuIHRlbXBbMV07XG4gIH1cbiAgYXN5bmMgcmVtb3ZlRGF0YVNvdXJjZSAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMucm9vdFtrZXldO1xuICAgIGF3YWl0IHRoaXMuc2F2ZVJvb3QoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG11cmUgPSBuZXcgTXVyZSh3aW5kb3cuRmlsZVJlYWRlciwgd2luZG93LmxvY2FsU3RvcmFnZSk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsImluZGV4Iiwic3BsaWNlIiwiYXJncyIsImZvckVhY2giLCJhcHBseSIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwidGltZW91dCIsInNldFRpbWVvdXQiLCJ0cmlnZ2VyIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsImkiLCJTdHJlYW0iLCJvcHRpb25zIiwibXVyZSIsIm5hbWVkRnVuY3Rpb25zIiwiTkFNRURfRlVOQ1RJT05TIiwibmFtZWRTdHJlYW1zIiwibGF1bmNoZWRGcm9tQ2xhc3MiLCJpbmRleGVzIiwidG9rZW5DbGFzc0xpc3QiLCJ0b2tlbkxpc3QiLCJtYXAiLCJUb2tlbkNsYXNzIiwiYXJnTGlzdCIsIldyYXBwZXJzIiwiZ2V0V3JhcHBlckxpc3QiLCJ0b2tlbiIsImxlbmd0aCIsIldyYXBwZXIiLCJsb2NhbFRva2VuTGlzdCIsInNsaWNlIiwicG90ZW50aWFsV3JhcHBlcnMiLCJ2YWx1ZXMiLCJjbGFzc2VzIiwiZmlsdGVyIiwiY2xhc3NPYmoiLCJldmVyeSIsImxvY2FsVG9rZW4iLCJsb2NhbEluZGV4IiwidG9rZW5DbGFzc1NwZWMiLCJpc1N1YnNldE9mIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsIndhcm4iLCJzZWxlY3RvciIsImpvaW4iLCJwYXJzZVNlbGVjdG9yIiwiY29uY2F0Iiwid3JhcHBlZFBhcmVudCIsInJhd0l0ZW0iLCJoYXNoZXMiLCJ3cmFwcGVySW5kZXgiLCJ0ZW1wIiwid3JhcHBlZEl0ZW0iLCJQcm9taXNlIiwiYWxsIiwiZW50cmllcyIsInJlZHVjZSIsInByb21pc2VMaXN0IiwiaGFzaEZ1bmN0aW9uTmFtZSIsImhhc2giLCJnZXRJbmRleCIsImNvbXBsZXRlIiwiYWRkVmFsdWUiLCJsYXN0VG9rZW4iLCJpdGVyYXRlIiwiSU5ERVhFUyIsIkluTWVtb3J5SW5kZXgiLCJoYXNoRnVuY3Rpb24iLCJFcnJvciIsImxpbWl0IiwicmVidWlsZEluZGV4ZXMiLCJpdGVyYXRvciIsIm5leHQiLCJkb25lIiwidmFsdWUiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJjb25zdHJ1Y3RvciIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiQmFzZVRva2VuIiwic3RyZWFtIiwidG9Mb3dlckNhc2UiLCJhbmNlc3RvclRva2VucyIsInBhcmVudFRva2VuIiwieWllbGRlZFNvbWV0aGluZyIsImRlYnVnIiwiVHlwZUVycm9yIiwiZXhlYyIsIm5hbWUiLCJFbXB0eVRva2VuIiwiUm9vdFRva2VuIiwid3JhcCIsInJvb3QiLCJLZXlzVG9rZW4iLCJtYXRjaEFsbCIsImtleXMiLCJyYW5nZXMiLCJ1bmRlZmluZWQiLCJhcmciLCJtYXRjaCIsIkluZmluaXR5IiwiZCIsInBhcnNlSW50IiwiaXNOYU4iLCJsb3ciLCJoaWdoIiwibnVtIiwiTnVtYmVyIiwiU3ludGF4RXJyb3IiLCJKU09OIiwic3RyaW5naWZ5IiwiY29uc29saWRhdGVSYW5nZXMiLCJzZWxlY3RzTm90aGluZyIsIm5ld1JhbmdlcyIsInNvcnQiLCJhIiwiYiIsImN1cnJlbnRSYW5nZSIsIm90aGVyVG9rZW4iLCJuZXdLZXlzIiwia2V5IiwiYWxsUG9pbnRzIiwiYWdnIiwicmFuZ2UiLCJpbmNsdWRlIiwiZXhjbHVkZSIsImRpZmYiLCJkaWZmZXJlbmNlIiwiaXRlcmF0ZVBhcmVudCIsIk1hdGgiLCJtYXgiLCJtaW4iLCJoYXNPd25Qcm9wZXJ0eSIsIlZhbHVlVG9rZW4iLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsIm5ld1N0cmVhbSIsImZvcmsiLCJlcnIiLCJNYXBUb2tlbiIsImdlbmVyYXRvciIsIm1hcHBlZFJhd0l0ZW0iLCJQcm9tb3RlVG9rZW4iLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwibWFwRnVuY3Rpb24iLCJyZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiIsImhhc2hJbmRleCIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJnZXRWYWx1ZUxpc3QiLCJKb2luVG9rZW4iLCJvdGhlclN0cmVhbSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiZmluaXNoIiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwiaXRlckVudHJpZXMiLCJ2YWx1ZUxpc3QiLCJvdGhlckxpc3QiLCJvdGhlcldyYXBwZWRJdGVtIiwidGhpc1dyYXBwZWRJdGVtIiwidGhpc0xpc3QiLCJ0aGlzSXRlcmF0b3IiLCJ0aGlzSXNEb25lIiwib3RoZXJJdGVyYXRvciIsIm90aGVySXNEb25lIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9zZWxlY3RvciIsImN1c3RvbUNsYXNzTmFtZSIsIm9wc1NpbmNlQ3VzdG9tTmFtZSIsImZ1bmNOYW1lIiwiRnVuY3Rpb24iLCJyZXN1bHQiLCJ0b1N0cmluZyIsInRvUmF3T2JqZWN0IiwiY2xhc3NOYW1lIiwidG9rZW5TdHJpbmdzIiwic2xpY2VJbmRleCIsInJlc2V0IiwiX3N0cmVhbSIsImlzU3VwZXJTZXRPZiIsIkNMQVNTRVMiLCJOb2RlQ2xhc3MiLCJzYXZlQ2xhc3NlcyIsIkVkZ2VDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZUNvbm5lY3Rpb25zIiwicHJvdG90eXBlIiwiY2FsbCIsIm5vZGVDbGFzcyIsInRoaXNIYXNoTmFtZSIsIm90aGVySGFzaE5hbWUiLCJlZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJFZGdlV3JhcHBlciIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiZGlyZWN0ZWQiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwic291cmNlSGFzaCIsIm5vZGVIYXNoTmFtZSIsInRhcmdldEhhc2giLCJlZGdlSGFzaE5hbWUiLCJkaXJlY3Rpb24iLCJORVhUX0NMQVNTX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiREFUQUxJQl9GT1JNQVRTIiwiVE9LRU5TIiwidG9rZW5DbGFzc05hbWUiLCJleHRlbmQiLCJwYXJlbnRUeXBlIiwiQXJyYXkiLCJzaGExIiwibG9hZFJvb3QiLCJsb2FkQ2xhc3NlcyIsImdldEl0ZW0iLCJwYXJzZSIsInNldEl0ZW0iLCJyYXdDbGFzc09iaiIsInJhd0luZGV4T2JqIiwiY2xhc3NUeXBlIiwicmF3Q2xhc3NlcyIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aFJvb3QiLCJzdGFydHNXaXRoIiwiY2h1bmsiLCJ0b1VwcGVyQ2FzZSIsInNwbGl0IiwidHJpbSIsIkNsYXNzVHlwZSIsImNoYXJzZXQiLCJmaWxlT2JqIiwiZmlsZU1CIiwic2l6ZSIsInNraXBTaXplQ2hlY2siLCJ0ZXh0IiwicmVzb2x2ZSIsInJlamVjdCIsInJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJlbmNvZGluZyIsImFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSIsImV4dGVuc2lvbk92ZXJyaWRlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljRGF0YVNvdXJjZSIsInNhdmVSb290IiwibmV3Q2xhc3MiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUEsTUFB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
