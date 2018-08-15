import sha1 from 'sha1';
import mime from 'mime-types';
import datalib from 'datalib';

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

const DEFAULT_FUNCTIONS = {
  identity: function* (wrappedParent) {
    yield wrappedParent.rawItem;
  },
  sha1: rawItem => sha1(JSON.stringify(rawItem)),
  noop: () => {}
};

class Stream {
  constructor({
    mure,
    selector = 'root',
    functions = {},
    streams = {},
    traversalMode = 'DFS'
  }) {
    this.mure = mure;
    this.functions = Object.assign({}, DEFAULT_FUNCTIONS, functions);
    this.streams = streams;
    this.traversalMode = traversalMode;
    this.tokenList = this.parseSelector(selector);
  }
  get selector() {
    return this.tokenList.join('');
  }
  parseSelector(selectorString) {
    if (!selectorString.startsWith('root')) {
      throw new SyntaxError(`Selectors must start with 'root'`);
    }
    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);
    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }
    const tokenList = [new this.mure.TOKENS.RootToken(this)];
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
        tokenList.push(new this.mure.TOKENS.KeysToken(this, argList));
        tokenList.push(new this.mure.TOKENS.ValueToken(this, []));
      } else if (this.mure.TOKENS[tokenClassName]) {
        tokenList.push(new this.mure.TOKENS[tokenClassName](this, argList));
      } else {
        throw new SyntaxError(`Unknown token: ${temp[1]}`);
      }
    });
    return tokenList;
  }
  iterate() {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      if (_this.traversalMode === 'BFS') {
        throw new Error(`Breadth-first iteration is not yet implemented.`);
      } else if (_this.traversalMode === 'DFS') {
        const deepHelper = _this.deepHelper(_this.tokenList, _this.tokenList.length - 1);
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = asyncIterator(deepHelper), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const wrappedItem = _value;

            if (!(wrappedItem instanceof _this.mure.WRAPPERS.GenericWrapper)) {
              if (_this.mure.debug) {
                console.warn(wrappedItem);
              }
            } else {
              yield wrappedItem;
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
        throw new Error(`Unknown traversalMode: ${_this.traversalMode}`);
      }
    })();
  }
  /**
   * This helps depth-first iteration (we only want to yield finished paths, so
   * it lazily asks for them one at a time from the *final* token, recursively
   * asking each preceding token to yield dependent paths only as needed)
   */
  deepHelper(tokenList, i) {
    var _this2 = this;

    return asyncGenerator.wrap(function* () {
      if (i === 0) {
        yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(tokenList[0].navigate()))), asyncGenerator.await); // The first token is always the root
      } else {
        let parentYieldedSomething = false;
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = asyncIterator(_this2.deepHelper(tokenList, i - 1)), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            let wrappedParent = _value2;

            parentYieldedSomething = true;
            if (wrappedParent instanceof _this2.mure.WRAPPERS.GenericWrapper) {
              const iterator = yield asyncGenerator.await(tokenList[i].navigate(wrappedParent));
              yield* asyncGeneratorDelegate(asyncIterator(iterator), asyncGenerator.await);
            } else {
              yield wrappedParent;
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

        if (_this2.mure.debug && !parentYieldedSomething) {
          yield `Token yielded nothing: ${tokenList[i - 1]}`;
        }
      }
    })();
  }

  sample({ limit = 10 }) {
    var _this3 = this;

    return asyncGenerator.wrap(function* () {
      const iterator = _this3.iterate();
      for (let i = 0; i < limit; i++) {
        const temp = yield asyncGenerator.await(iterator.next());
        if (temp.done) {
          break;
        }
        yield temp.value;
      }
    })();
  }

  extend(TokenClass, argList, functions = {}, streams = {}) {
    const newStream = new Stream({
      mure: this.mure,
      functions: Object.assign({}, this.functions, functions),
      streams: Object.assign({}, this.streams, streams),
      mode: this.mode
    });
    newStream.tokenList = this.tokenList.concat([new TokenClass(newStream, argList)]);
    return newStream;
  }

  isSuperSetOfTokenList(tokenList) {
    if (tokenList.length !== this.tokenList.length) {
      return false;
    }
    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
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
  isSuperSetOf(otherToken) {
    return otherToken.constructor === this.constructor;
  }
  navigate(wrappedParent) {
    return asyncGenerator.wrap(function* () {
      throw new Error(`This function should be overridden`);
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
  *navigate() {
    yield this.stream.mure.wrap({
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
  isSuperSetOf(otherToken) {
    if (!(otherToken instanceof KeysToken)) {
      return false;
    } else {
      const diff = otherToken.difference(this);
      return diff === null || diff.selectsNothing;
    }
  }
  toString() {
    if (this.matchAll) {
      return '.keys()';
    }
    return '.keys(' + (this.ranges || []).map(({ low, high }) => {
      return low === high ? low : `${low}-${high}`;
    }).concat(Object.keys(this.keys || {}).map(key => `'${key}'`)).join(',') + ')';
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      if (typeof wrappedParent.rawItem !== 'object') {
        if (!_this.stream.mure.debug) {
          throw new TypeError(`Input to KeysToken is not an object`);
        } else {
          return;
        }
      }
      if (_this.matchAll) {
        for (let key in wrappedParent.rawItem) {
          yield _this.stream.mure.wrap({
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
              yield _this.stream.mure.wrap({
                wrappedParent,
                token: _this,
                rawItem: i
              });
            }
          }
        }
        for (let key in _this.keys || {}) {
          if (wrappedParent.rawItem.hasOwnProperty(key)) {
            yield _this.stream.mure.wrap({
              wrappedParent,
              token: _this,
              rawItem: key
            });
          }
        }
      }
    })();
  }
}

class ValueToken extends BaseToken {
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      const obj = wrappedParent && wrappedParent.wrappedParent && wrappedParent.wrappedParent.rawItem;
      const key = wrappedParent && wrappedParent.rawItem;
      const keyType = typeof key;
      if (typeof obj !== 'object' || keyType !== 'string' && keyType !== 'number') {
        if (!_this.stream.mure.debug) {
          throw new TypeError(`ValueToken used on a non-object, or without a string / numeric key`);
        } else {
          return;
        }
      }
      yield _this.stream.mure.wrap({
        wrappedParent,
        token: _this,
        rawItem: obj[key]
      });
    })();
  }
}

class EvaluateToken extends BaseToken {
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      if (typeof wrappedParent.rawItem !== 'string') {
        if (!_this.stream.mure.debug) {
          throw new TypeError(`Input to EvaluateToken is not a string`);
        } else {
          return;
        }
      }
      let newStream;
      try {
        newStream = _this.stream.mure.stream({
          selector: wrappedParent.rawItem,
          functions: _this.stream.functions,
          streams: _this.stream.streams,
          traversalMode: _this.stream.traversalMode
        });
      } catch (err) {
        if (!_this.stream.mure.debug || !(err instanceof SyntaxError)) {
          throw err;
        } else {
          return;
        }
      }
      const iterator = yield asyncGenerator.await(newStream.iterate());
      yield* asyncGeneratorDelegate(asyncIterator(iterator), asyncGenerator.await);
    })();
  }
}

class MapToken extends BaseToken {
  constructor(stream, [generator = 'identity']) {
    super(stream);
    if (!stream.functions[generator]) {
      throw new SyntaxError(`Unknown function: ${generator}`);
    }
    this.generator = generator;
  }
  toString() {
    return `.map(${this.generator})`;
  }
  isSuperSetOf(otherToken) {
    return otherToken.constructor === MapToken && otherToken.generator === this.generator;
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.stream.functions[_this.generator](wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const mappedRawItem = _value;

          yield _this.stream.mure.wrap({
            wrappedParent,
            token: _this,
            rawItem: mappedRawItem
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

class PromoteToken extends BaseToken {
  constructor(stream, [map = 'identity', hash = 'sha1', reduceInstances = 'noop']) {
    super(stream);
    for (const func of [map, hash, reduceInstances]) {
      if (!stream.functions[func]) {
        throw new SyntaxError(`Unknown function: ${func}`);
      }
    }
    this.map = map;
    this.hash = hash;
    this.reduceInstances = reduceInstances;

    this.seenItems = {};
  }
  toString() {
    return `.promote(${this.map}, ${this.hash}, ${this.reduceInstances})`;
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.stream.functions[_this.map](wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const mappedRawItem = _value;

          const hash = _this.stream.functions[_this.hash](mappedRawItem);
          if (_this.seenItems[hash]) {
            if (_this.reduceInstances !== 'noop') {
              _this.stream.functions[_this.reduceInstances](_this.seenItems[hash], mappedRawItem);
              _this.seenItems[hash].trigger('update');
            }
          } else {
            _this.seenItems[hash] = _this.stream.mure.wrap({
              wrappedParent,
              token: _this,
              rawItem: mappedRawItem
            });
            yield _this.seenItems[hash];
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



var TOKENS = /*#__PURE__*/Object.freeze({
  RootToken: RootToken,
  KeysToken: KeysToken,
  ValueToken: ValueToken,
  EvaluateToken: EvaluateToken,
  MapToken: MapToken,
  PromoteToken: PromoteToken
});

class GenericConstruct extends Introspectable {
  constructor({ mure, selector, classNames = [] }) {
    super();
    this.mure = mure;
    this.selector = selector;
    this.stream = this.mure.stream({ selector: selector });
    this.classNames = classNames;
    this.annotations = [];
  }
  wrap(options) {
    return new this.mure.WRAPPERS.GenericWrapper(options);
  }
}
Object.defineProperty(GenericConstruct, 'type', {
  get() {
    return (/(.*)Construct/.exec(this.name)[1]
    );
  }
});

class NodeConstruct extends GenericConstruct {}

class EdgeConstruct extends GenericConstruct {}



var CONSTRUCTS = /*#__PURE__*/Object.freeze({
  GenericConstruct: GenericConstruct,
  NodeConstruct: NodeConstruct,
  EdgeConstruct: EdgeConstruct
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

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node
    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set mure.debug to true to debug streams

    // Object containing each of our data sources
    this.root = {};
    this.classes = {};

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
    this.CONSTRUCTS = CONSTRUCTS;
    this.WRAPPERS = WRAPPERS;

    // Monkey-patch available tokens as functions onto the Stream class
    for (const tokenClassName in this.TOKENS) {
      const TokenClass = this.TOKENS[tokenClassName];
      Stream.prototype[TokenClass.lowerCamelCaseType] = function (argList, functions, streams) {
        return this.extend(TokenClass, argList, functions, streams);
      };
    }
  }

  stream(options = {}) {
    options.mure = this;
    return new Stream(options);
  }
  wrap({ wrappedParent, token, rawItem }) {
    const tokenList = [token];
    let temp = wrappedParent;
    while (temp !== null) {
      tokenList.unshift(temp.token);
      temp = temp.wrappedParent;
    }
    for (let classSelector in this.classes) {
      const construct = this.classes[classSelector];
      if (construct.stream.isSuperSetOfTokenList(tokenList)) {
        return construct.wrap({ wrappedParent, token, rawItem });
      }
    }
    return new this.WRAPPERS.GenericWrapper({ wrappedParent, token, rawItem });
  }

  newClass({ ClassType, selector, classNames }) {
    if (this.classes[selector]) {
      return this.classes[selector];
    }
    this.classes[selector] = new ClassType({ mure: this, selector, classNames });
    return this.classes[selector];
  }

  addFileAsStaticDataSource({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    var _this = this;

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
        let reader = new _this.FileReader();
        reader.onload = function () {
          resolve(reader.result);
        };
        reader.readAsText(fileObj, encoding);
      });
      return _this.addStringAsStaticDataSource({
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
    var _this2 = this;

    return asyncToGenerator(function* () {
      let obj;
      if (_this2.DATALIB_FORMATS[extension]) {
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
      return _this2.addStaticDataSource(key, obj);
    })();
  }
  addStaticDataSource(key, obj) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      _this3.root[key] = obj;
      return _this3.newClass({
        selector: `root.values('${key}').values()`,
        ClassType: _this3.CONSTRUCTS.GenericConstruct,
        classNames: [key]
      });
    })();
  }

  removeDataSource(key) {
    delete this.root[key];
  }
}

var name = "mure";
var version = "0.4.2";
var description = "An integration library for the mure ecosystem of apps";
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

let mure = new Mure(window.FileReader);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL0NvbnN0cnVjdHMvR2VuZXJpY0NvbnN0cnVjdC5qcyIsIi4uL3NyYy9Db25zdHJ1Y3RzL05vZGVDb25zdHJ1Y3QuanMiLCIuLi9zcmMvQ29uc3RydWN0cy9FZGdlQ29uc3RydWN0LmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImltcG9ydCBzaGExIGZyb20gJ3NoYTEnO1xuXG5jb25zdCBERUZBVUxUX0ZVTkNUSU9OUyA9IHtcbiAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRQYXJlbnQpIHsgeWllbGQgd3JhcHBlZFBhcmVudC5yYXdJdGVtOyB9LFxuICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICBub29wOiAoKSA9PiB7fVxufTtcblxuY2xhc3MgU3RyZWFtIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBtdXJlLFxuICAgIHNlbGVjdG9yID0gJ3Jvb3QnLFxuICAgIGZ1bmN0aW9ucyA9IHt9LFxuICAgIHN0cmVhbXMgPSB7fSxcbiAgICB0cmF2ZXJzYWxNb2RlID0gJ0RGUydcbiAgfSkge1xuICAgIHRoaXMubXVyZSA9IG11cmU7XG4gICAgdGhpcy5mdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX0ZVTkNUSU9OUywgZnVuY3Rpb25zKTtcbiAgICB0aGlzLnN0cmVhbXMgPSBzdHJlYW1zO1xuICAgIHRoaXMudHJhdmVyc2FsTW9kZSA9IHRyYXZlcnNhbE1vZGU7XG4gICAgdGhpcy50b2tlbkxpc3QgPSB0aGlzLnBhcnNlU2VsZWN0b3Ioc2VsZWN0b3IpO1xuICB9XG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmpvaW4oJycpO1xuICB9XG4gIHBhcnNlU2VsZWN0b3IgKHNlbGVjdG9yU3RyaW5nKSB7XG4gICAgaWYgKCFzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdyb290JykpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgU2VsZWN0b3JzIG11c3Qgc3RhcnQgd2l0aCAncm9vdCdgKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5TdHJpbmdzID0gc2VsZWN0b3JTdHJpbmcubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpO1xuICAgIGlmICghdG9rZW5TdHJpbmdzKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgc2VsZWN0b3Igc3RyaW5nOiAke3NlbGVjdG9yU3RyaW5nfWApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlbkxpc3QgPSBbbmV3IHRoaXMubXVyZS5UT0tFTlMuUm9vdFRva2VuKHRoaXMpXTtcbiAgICB0b2tlblN0cmluZ3MuZm9yRWFjaChjaHVuayA9PiB7XG4gICAgICBjb25zdCB0ZW1wID0gY2h1bmsubWF0Y2goL14uKFteKF0qKVxcKChbXildKilcXCkvKTtcbiAgICAgIGlmICghdGVtcCkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgdG9rZW46ICR7Y2h1bmt9YCk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b2tlbkNsYXNzTmFtZSA9IHRlbXBbMV1bMF0udG9VcHBlckNhc2UoKSArIHRlbXBbMV0uc2xpY2UoMSkgKyAnVG9rZW4nO1xuICAgICAgY29uc3QgYXJnTGlzdCA9IHRlbXBbMl0uc3BsaXQoLyg/PCFcXFxcKSwvKS5tYXAoZCA9PiB7XG4gICAgICAgIGQgPSBkLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIGQgPT09ICcnID8gdW5kZWZpbmVkIDogZDtcbiAgICAgIH0pO1xuICAgICAgaWYgKHRva2VuQ2xhc3NOYW1lID09PSAnVmFsdWVzVG9rZW4nKSB7XG4gICAgICAgIHRva2VuTGlzdC5wdXNoKG5ldyB0aGlzLm11cmUuVE9LRU5TLktleXNUb2tlbih0aGlzLCBhcmdMaXN0KSk7XG4gICAgICAgIHRva2VuTGlzdC5wdXNoKG5ldyB0aGlzLm11cmUuVE9LRU5TLlZhbHVlVG9rZW4odGhpcywgW10pKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5tdXJlLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0pIHtcbiAgICAgICAgdG9rZW5MaXN0LnB1c2gobmV3IHRoaXMubXVyZS5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKHRoaXMsIGFyZ0xpc3QpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biB0b2tlbjogJHt0ZW1wWzFdfWApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0b2tlbkxpc3Q7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICBpZiAodGhpcy50cmF2ZXJzYWxNb2RlID09PSAnQkZTJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBCcmVhZHRoLWZpcnN0IGl0ZXJhdGlvbiBpcyBub3QgeWV0IGltcGxlbWVudGVkLmApO1xuICAgIH0gZWxzZSBpZiAodGhpcy50cmF2ZXJzYWxNb2RlID09PSAnREZTJykge1xuICAgICAgY29uc3QgZGVlcEhlbHBlciA9IHRoaXMuZGVlcEhlbHBlcih0aGlzLnRva2VuTGlzdCwgdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIGRlZXBIZWxwZXIpIHtcbiAgICAgICAgaWYgKCEod3JhcHBlZEl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIpKSB7XG4gICAgICAgICAgaWYgKHRoaXMubXVyZS5kZWJ1Zykge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKHdyYXBwZWRJdGVtKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHRyYXZlcnNhbE1vZGU6ICR7dGhpcy50cmF2ZXJzYWxNb2RlfWApO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogVGhpcyBoZWxwcyBkZXB0aC1maXJzdCBpdGVyYXRpb24gKHdlIG9ubHkgd2FudCB0byB5aWVsZCBmaW5pc2hlZCBwYXRocywgc29cbiAgICogaXQgbGF6aWx5IGFza3MgZm9yIHRoZW0gb25lIGF0IGEgdGltZSBmcm9tIHRoZSAqZmluYWwqIHRva2VuLCByZWN1cnNpdmVseVxuICAgKiBhc2tpbmcgZWFjaCBwcmVjZWRpbmcgdG9rZW4gdG8geWllbGQgZGVwZW5kZW50IHBhdGhzIG9ubHkgYXMgbmVlZGVkKVxuICAgKi9cbiAgYXN5bmMgKiBkZWVwSGVscGVyICh0b2tlbkxpc3QsIGkpIHtcbiAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgeWllbGQgKiBhd2FpdCB0b2tlbkxpc3RbMF0ubmF2aWdhdGUoKTsgLy8gVGhlIGZpcnN0IHRva2VuIGlzIGFsd2F5cyB0aGUgcm9vdFxuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgcGFyZW50WWllbGRlZFNvbWV0aGluZyA9IGZhbHNlO1xuICAgICAgZm9yIGF3YWl0IChsZXQgd3JhcHBlZFBhcmVudCBvZiB0aGlzLmRlZXBIZWxwZXIodG9rZW5MaXN0LCBpIC0gMSkpIHtcbiAgICAgICAgcGFyZW50WWllbGRlZFNvbWV0aGluZyA9IHRydWU7XG4gICAgICAgIGlmICh3cmFwcGVkUGFyZW50IGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKSB7XG4gICAgICAgICAgY29uc3QgaXRlcmF0b3IgPSBhd2FpdCB0b2tlbkxpc3RbaV0ubmF2aWdhdGUod3JhcHBlZFBhcmVudCk7XG4gICAgICAgICAgeWllbGQgKiBpdGVyYXRvcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkUGFyZW50O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5tdXJlLmRlYnVnICYmICFwYXJlbnRZaWVsZGVkU29tZXRoaW5nKSB7XG4gICAgICAgIHlpZWxkIGBUb2tlbiB5aWVsZGVkIG5vdGhpbmc6ICR7dG9rZW5MaXN0W2kgLSAxXX1gO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jICogc2FtcGxlICh7IGxpbWl0ID0gMTAgfSkge1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgfVxuICB9XG5cbiAgZXh0ZW5kIChUb2tlbkNsYXNzLCBhcmdMaXN0LCBmdW5jdGlvbnMgPSB7fSwgc3RyZWFtcyA9IHt9KSB7XG4gICAgY29uc3QgbmV3U3RyZWFtID0gbmV3IFN0cmVhbSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICBmdW5jdGlvbnM6IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuZnVuY3Rpb25zLCBmdW5jdGlvbnMpLFxuICAgICAgc3RyZWFtczogT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5zdHJlYW1zLCBzdHJlYW1zKSxcbiAgICAgIG1vZGU6IHRoaXMubW9kZVxuICAgIH0pO1xuICAgIG5ld1N0cmVhbS50b2tlbkxpc3QgPSB0aGlzLnRva2VuTGlzdC5jb25jYXQoWyBuZXcgVG9rZW5DbGFzcyhuZXdTdHJlYW0sIGFyZ0xpc3QpIF0pO1xuICAgIHJldHVybiBuZXdTdHJlYW07XG4gIH1cblxuICBpc1N1cGVyU2V0T2ZUb2tlbkxpc3QgKHRva2VuTGlzdCkge1xuICAgIGlmICh0b2tlbkxpc3QubGVuZ3RoICE9PSB0aGlzLnRva2VuTGlzdC5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmV2ZXJ5KCh0b2tlbiwgaSkgPT4gdG9rZW4uaXNTdXBlclNldE9mKHRva2VuTGlzdFtpXSkpO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVRva2VuIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgLy8gVGhlIHN0cmluZyB2ZXJzaW9uIG9mIG1vc3QgdG9rZW5zIGNhbiBqdXN0IGJlIGRlcml2ZWQgZnJvbSB0aGUgY2xhc3MgdHlwZVxuICAgIHJldHVybiBgLiR7dGhpcy50eXBlLnRvTG93ZXJDYXNlKCl9KClgO1xuICB9XG4gIGlzU3VwZXJTZXRPZiAob3RoZXJUb2tlbikge1xuICAgIHJldHVybiBvdGhlclRva2VuLmNvbnN0cnVjdG9yID09PSB0aGlzLmNvbnN0cnVjdG9yO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgKiBuYXZpZ2F0ZSAoKSB7XG4gICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQ6IG51bGwsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0gPSB7fSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKGtleXMgfHwgcmFuZ2VzKSB7XG4gICAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgICAgdGhpcy5yYW5nZXMgPSByYW5nZXM7XG4gICAgfSBlbHNlIGlmICgoYXJnTGlzdCAmJiBhcmdMaXN0Lmxlbmd0aCA9PT0gMSAmJiBhcmdMaXN0WzBdID09PSB1bmRlZmluZWQpIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgZGlmZmVyZW5jZSAob3RoZXJUb2tlbikge1xuICAgIC8vIENvbXB1dGUgd2hhdCBpcyBsZWZ0IG9mIHRoaXMgYWZ0ZXIgc3VidHJhY3Rpbmcgb3V0IGV2ZXJ5dGhpbmcgaW4gb3RoZXJUb2tlblxuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNvbXB1dGUgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIGRpZmZlcmVudCB0b2tlbiB0eXBlc2ApO1xuICAgIH0gZWxzZSBpZiAob3RoZXJUb2tlbi5tYXRjaEFsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEluYWNjdXJhdGUgZGlmZmVyZW5jZSBjb21wdXRlZCEgVE9ETzogbmVlZCB0byBmaWd1cmUgb3V0IGhvdyB0byBpbnZlcnQgY2F0ZWdvcmljYWwga2V5cyFgKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdLZXlzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgaW4gKHRoaXMua2V5cyB8fCB7fSkpIHtcbiAgICAgICAgaWYgKCFvdGhlclRva2VuLmtleXMgfHwgIW90aGVyVG9rZW4ua2V5c1trZXldKSB7XG4gICAgICAgICAgbmV3S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1JhbmdlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICAgIGlmIChvdGhlclRva2VuLnJhbmdlcykge1xuICAgICAgICAgIGxldCBhbGxQb2ludHMgPSB0aGlzLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgYWxsUG9pbnRzID0gYWxsUG9pbnRzLmNvbmNhdChvdGhlclRva2VuLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSkpLnNvcnQoKTtcbiAgICAgICAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbFBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IHsgbG93OiBhbGxQb2ludHNbaV0udmFsdWUgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5leGNsdWRlKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0ubG93IC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5sb3cgPSBhbGxQb2ludHNbaV0uaGlnaCArIDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3UmFuZ2VzID0gdGhpcy5yYW5nZXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgS2V5c1Rva2VuKHRoaXMubXVyZSwgbnVsbCwgeyBrZXlzOiBuZXdLZXlzLCByYW5nZXM6IG5ld1JhbmdlcyB9KTtcbiAgICB9XG4gIH1cbiAgaXNTdXBlclNldE9mIChvdGhlclRva2VuKSB7XG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZGlmZiA9IG90aGVyVG9rZW4uZGlmZmVyZW5jZSh0aGlzKTtcbiAgICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gICAgfVxuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICBpZiAodGhpcy5tYXRjaEFsbCkgeyByZXR1cm4gJy5rZXlzKCknOyB9XG4gICAgcmV0dXJuICcua2V5cygnICsgKHRoaXMucmFuZ2VzIHx8IFtdKS5tYXAoKHtsb3csIGhpZ2h9KSA9PiB7XG4gICAgICByZXR1cm4gbG93ID09PSBoaWdoID8gbG93IDogYCR7bG93fS0ke2hpZ2h9YDtcbiAgICB9KS5jb25jYXQoT2JqZWN0LmtleXModGhpcy5rZXlzIHx8IHt9KS5tYXAoa2V5ID0+IGAnJHtrZXl9J2ApKVxuICAgICAgLmpvaW4oJywnKSArICcpJztcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZm9yIChsZXQge2xvdywgaGlnaH0gb2YgdGhpcy5yYW5nZXMgfHwgW10pIHtcbiAgICAgICAgbG93ID0gTWF0aC5tYXgoMCwgbG93KTtcbiAgICAgICAgaGlnaCA9IE1hdGgubWluKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5sZW5ndGggLSAxLCBoaWdoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IGxvdzsgaSA8PSBoaWdoOyBpKyspIHtcbiAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICByYXdJdGVtOiBpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAobGV0IGtleSBpbiB0aGlzLmtleXMgfHwge30pIHtcbiAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBjb25zdCBvYmogPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgfHwgKGtleVR5cGUgIT09ICdzdHJpbmcnICYmIGtleVR5cGUgIT09ICdudW1iZXInKSkge1xuICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgcmF3SXRlbTogb2JqW2tleV1cbiAgICB9KTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVmFsdWVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFdmFsdWF0ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGlmICh0eXBlb2Ygd3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnc3RyaW5nJykge1xuICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEV2YWx1YXRlVG9rZW4gaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBuZXdTdHJlYW07XG4gICAgdHJ5IHtcbiAgICAgIG5ld1N0cmVhbSA9IHRoaXMuc3RyZWFtLm11cmUuc3RyZWFtKHtcbiAgICAgICAgc2VsZWN0b3I6IHdyYXBwZWRQYXJlbnQucmF3SXRlbSxcbiAgICAgICAgZnVuY3Rpb25zOiB0aGlzLnN0cmVhbS5mdW5jdGlvbnMsXG4gICAgICAgIHN0cmVhbXM6IHRoaXMuc3RyZWFtLnN0cmVhbXMsXG4gICAgICAgIHRyYXZlcnNhbE1vZGU6IHRoaXMuc3RyZWFtLnRyYXZlcnNhbE1vZGVcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnIHx8ICEoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpKSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgaXRlcmF0b3IgPSBhd2FpdCBuZXdTdHJlYW0uaXRlcmF0ZSgpO1xuICAgIHlpZWxkICogaXRlcmF0b3I7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0uZnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gZ2VuZXJhdG9yO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1cGVyU2V0T2YgKG90aGVyVG9rZW4pIHtcbiAgICByZXR1cm4gb3RoZXJUb2tlbi5jb25zdHJ1Y3RvciA9PT0gTWFwVG9rZW4gJiYgb3RoZXJUb2tlbi5nZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5zdHJlYW0uZnVuY3Rpb25zW3RoaXMuZ2VuZXJhdG9yXSh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNYXBUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBQcm9tb3RlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgWyBtYXAsIGhhc2gsIHJlZHVjZUluc3RhbmNlcyBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5mdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG5cbiAgICB0aGlzLnNlZW5JdGVtcyA9IHt9O1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiB0aGlzLnN0cmVhbS5mdW5jdGlvbnNbdGhpcy5tYXBdKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICBjb25zdCBoYXNoID0gdGhpcy5zdHJlYW0uZnVuY3Rpb25zW3RoaXMuaGFzaF0obWFwcGVkUmF3SXRlbSk7XG4gICAgICBpZiAodGhpcy5zZWVuSXRlbXNbaGFzaF0pIHtcbiAgICAgICAgaWYgKHRoaXMucmVkdWNlSW5zdGFuY2VzICE9PSAnbm9vcCcpIHtcbiAgICAgICAgICB0aGlzLnN0cmVhbS5mdW5jdGlvbnNbdGhpcy5yZWR1Y2VJbnN0YW5jZXNdKHRoaXMuc2Vlbkl0ZW1zW2hhc2hdLCBtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgICB0aGlzLnNlZW5JdGVtc1toYXNoXS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZWVuSXRlbXNbaGFzaF0gPSB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgICAgeWllbGQgdGhpcy5zZWVuSXRlbXNbaGFzaF07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVUb2tlbjtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljQ29uc3RydWN0IGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoeyBtdXJlLCBzZWxlY3RvciwgY2xhc3NOYW1lcyA9IFtdIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubXVyZSA9IG11cmU7XG4gICAgdGhpcy5zZWxlY3RvciA9IHNlbGVjdG9yO1xuICAgIHRoaXMuc3RyZWFtID0gdGhpcy5tdXJlLnN0cmVhbSh7IHNlbGVjdG9yOiBzZWxlY3RvciB9KTtcbiAgICB0aGlzLmNsYXNzTmFtZXMgPSBjbGFzc05hbWVzO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBbXTtcbiAgfVxuICB3cmFwIChvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ29uc3RydWN0LCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDb25zdHJ1Y3QvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ29uc3RydWN0O1xuIiwiaW1wb3J0IEdlbmVyaWNDb25zdHJ1Y3QgZnJvbSAnLi9HZW5lcmljQ29uc3RydWN0LmpzJztcblxuY2xhc3MgTm9kZUNvbnN0cnVjdCBleHRlbmRzIEdlbmVyaWNDb25zdHJ1Y3Qge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDb25zdHJ1Y3Q7XG4iLCJpbXBvcnQgR2VuZXJpY0NvbnN0cnVjdCBmcm9tICcuL0dlbmVyaWNDb25zdHJ1Y3QuanMnO1xuXG5jbGFzcyBFZGdlQ29uc3RydWN0IGV4dGVuZHMgR2VuZXJpY0NvbnN0cnVjdCB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNvbnN0cnVjdDtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy53cmFwcGVkUGFyZW50ID0gd3JhcHBlZFBhcmVudDtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5yYXdJdGVtID0gcmF3SXRlbTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi9TdHJlYW0uanMnO1xuaW1wb3J0ICogYXMgVE9LRU5TIGZyb20gJy4vVG9rZW5zL1Rva2Vucy5qcyc7XG5pbXBvcnQgKiBhcyBDT05TVFJVQ1RTIGZyb20gJy4vQ29uc3RydWN0cy9Db25zdHJ1Y3RzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoRmlsZVJlYWRlcikge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBtdXJlLmRlYnVnIHRvIHRydWUgdG8gZGVidWcgc3RyZWFtc1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy5yb290ID0ge307XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICB0aGlzLlRSVVRIWV9TVFJJTkdTID0ge1xuICAgICAgJ3RydWUnOiB0cnVlLFxuICAgICAgJ3llcyc6IHRydWUsXG4gICAgICAneSc6IHRydWVcbiAgICB9O1xuICAgIHRoaXMuRkFMU0VZX1NUUklOR1MgPSB7XG4gICAgICAnZmFsc2UnOiB0cnVlLFxuICAgICAgJ25vJzogdHJ1ZSxcbiAgICAgICduJzogdHJ1ZVxuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRPS0VOUyA9IFRPS0VOUztcbiAgICB0aGlzLkNPTlNUUlVDVFMgPSBDT05TVFJVQ1RTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcblxuICAgIC8vIE1vbmtleS1wYXRjaCBhdmFpbGFibGUgdG9rZW5zIGFzIGZ1bmN0aW9ucyBvbnRvIHRoZSBTdHJlYW0gY2xhc3NcbiAgICBmb3IgKGNvbnN0IHRva2VuQ2xhc3NOYW1lIGluIHRoaXMuVE9LRU5TKSB7XG4gICAgICBjb25zdCBUb2tlbkNsYXNzID0gdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdO1xuICAgICAgU3RyZWFtLnByb3RvdHlwZVtUb2tlbkNsYXNzLmxvd2VyQ2FtZWxDYXNlVHlwZV0gPSBmdW5jdGlvbiAoYXJnTGlzdCwgZnVuY3Rpb25zLCBzdHJlYW1zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmV4dGVuZChUb2tlbkNsYXNzLCBhcmdMaXN0LCBmdW5jdGlvbnMsIHN0cmVhbXMpO1xuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBzdHJlYW0gKG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cbiAgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgY29uc3QgdG9rZW5MaXN0ID0gW3Rva2VuXTtcbiAgICBsZXQgdGVtcCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgd2hpbGUgKHRlbXAgIT09IG51bGwpIHtcbiAgICAgIHRva2VuTGlzdC51bnNoaWZ0KHRlbXAudG9rZW4pO1xuICAgICAgdGVtcCA9IHRlbXAud3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgZm9yIChsZXQgY2xhc3NTZWxlY3RvciBpbiB0aGlzLmNsYXNzZXMpIHtcbiAgICAgIGNvbnN0IGNvbnN0cnVjdCA9IHRoaXMuY2xhc3Nlc1tjbGFzc1NlbGVjdG9yXTtcbiAgICAgIGlmIChjb25zdHJ1Y3Quc3RyZWFtLmlzU3VwZXJTZXRPZlRva2VuTGlzdCh0b2tlbkxpc3QpKSB7XG4gICAgICAgIHJldHVybiBjb25zdHJ1Y3Qud3JhcCh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IHRoaXMuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgfVxuXG4gIG5ld0NsYXNzICh7IENsYXNzVHlwZSwgc2VsZWN0b3IsIGNsYXNzTmFtZXMgfSkge1xuICAgIGlmICh0aGlzLmNsYXNzZXNbc2VsZWN0b3JdKSB7XG4gICAgICByZXR1cm4gdGhpcy5jbGFzc2VzW3NlbGVjdG9yXTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc2VzW3NlbGVjdG9yXSA9IG5ldyBDbGFzc1R5cGUoeyBtdXJlOiB0aGlzLCBzZWxlY3RvciwgY2xhc3NOYW1lcyB9KTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW3NlbGVjdG9yXTtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY0RhdGFTb3VyY2UoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2Uoe1xuICAgICAga2V5OiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAga2V5LFxuICAgIGV4dGVuc2lvbiA9ICd0eHQnLFxuICAgIHRleHRcbiAgfSkge1xuICAgIGxldCBvYmo7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIG9iaiA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgZGVsZXRlIG9iai5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY0RhdGFTb3VyY2Uoa2V5LCBvYmopO1xuICB9XG4gIGFzeW5jIGFkZFN0YXRpY0RhdGFTb3VyY2UgKGtleSwgb2JqKSB7XG4gICAgdGhpcy5yb290W2tleV0gPSBvYmo7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IGByb290LnZhbHVlcygnJHtrZXl9JykudmFsdWVzKClgLFxuICAgICAgQ2xhc3NUeXBlOiB0aGlzLkNPTlNUUlVDVFMuR2VuZXJpY0NvbnN0cnVjdCxcbiAgICAgIGNsYXNzTmFtZXM6IFsga2V5IF1cbiAgICB9KTtcbiAgfVxuXG4gIHJlbW92ZURhdGFTb3VyY2UgKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLnJvb3Rba2V5XTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG11cmUgPSBuZXcgTXVyZSh3aW5kb3cuRmlsZVJlYWRlcik7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsImluZGV4Iiwic3BsaWNlIiwiYXJncyIsImZvckVhY2giLCJhcHBseSIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwidGltZW91dCIsInNldFRpbWVvdXQiLCJ0cmlnZ2VyIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsImkiLCJERUZBVUxUX0ZVTkNUSU9OUyIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwic2hhMSIsIkpTT04iLCJzdHJpbmdpZnkiLCJTdHJlYW0iLCJtdXJlIiwiZnVuY3Rpb25zIiwic3RyZWFtcyIsInRyYXZlcnNhbE1vZGUiLCJ0b2tlbkxpc3QiLCJwYXJzZVNlbGVjdG9yIiwic2VsZWN0b3IiLCJqb2luIiwic2VsZWN0b3JTdHJpbmciLCJzdGFydHNXaXRoIiwiU3ludGF4RXJyb3IiLCJ0b2tlblN0cmluZ3MiLCJtYXRjaCIsIlRPS0VOUyIsIlJvb3RUb2tlbiIsImNodW5rIiwidGVtcCIsInRva2VuQ2xhc3NOYW1lIiwidG9VcHBlckNhc2UiLCJzbGljZSIsImFyZ0xpc3QiLCJzcGxpdCIsIm1hcCIsImQiLCJ0cmltIiwidW5kZWZpbmVkIiwiS2V5c1Rva2VuIiwiVmFsdWVUb2tlbiIsIkVycm9yIiwiZGVlcEhlbHBlciIsImxlbmd0aCIsIndyYXBwZWRJdGVtIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsImRlYnVnIiwid2FybiIsIm5hdmlnYXRlIiwicGFyZW50WWllbGRlZFNvbWV0aGluZyIsIml0ZXJhdG9yIiwibGltaXQiLCJpdGVyYXRlIiwibmV4dCIsImRvbmUiLCJ2YWx1ZSIsIlRva2VuQ2xhc3MiLCJuZXdTdHJlYW0iLCJtb2RlIiwiY29uY2F0IiwiZXZlcnkiLCJ0b2tlbiIsImlzU3VwZXJTZXRPZiIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImNvbnN0cnVjdG9yIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b0xvd2VyQ2FzZSIsIm90aGVyVG9rZW4iLCJleGVjIiwibmFtZSIsIndyYXAiLCJyb290IiwibWF0Y2hBbGwiLCJrZXlzIiwicmFuZ2VzIiwiYXJnIiwiSW5maW5pdHkiLCJwYXJzZUludCIsImlzTmFOIiwibG93IiwiaGlnaCIsIm51bSIsIk51bWJlciIsImNvbnNvbGlkYXRlUmFuZ2VzIiwic2VsZWN0c05vdGhpbmciLCJuZXdSYW5nZXMiLCJzb3J0IiwiYSIsImIiLCJjdXJyZW50UmFuZ2UiLCJuZXdLZXlzIiwia2V5IiwiYWxsUG9pbnRzIiwicmVkdWNlIiwiYWdnIiwicmFuZ2UiLCJpbmNsdWRlIiwiZXhjbHVkZSIsImRpZmYiLCJkaWZmZXJlbmNlIiwiVHlwZUVycm9yIiwiTWF0aCIsIm1heCIsIm1pbiIsImhhc093blByb3BlcnR5Iiwib2JqIiwia2V5VHlwZSIsIkV2YWx1YXRlVG9rZW4iLCJlcnIiLCJNYXBUb2tlbiIsImdlbmVyYXRvciIsIm1hcHBlZFJhd0l0ZW0iLCJQcm9tb3RlVG9rZW4iLCJoYXNoIiwicmVkdWNlSW5zdGFuY2VzIiwiZnVuYyIsInNlZW5JdGVtcyIsIkdlbmVyaWNDb25zdHJ1Y3QiLCJjbGFzc05hbWVzIiwiYW5ub3RhdGlvbnMiLCJvcHRpb25zIiwiTm9kZUNvbnN0cnVjdCIsIkVkZ2VDb25zdHJ1Y3QiLCJOb2RlV3JhcHBlciIsIkVkZ2VXcmFwcGVyIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJtaW1lIiwiY2xhc3NlcyIsIkRBVEFMSUJfRk9STUFUUyIsIlRSVVRIWV9TVFJJTkdTIiwiRkFMU0VZX1NUUklOR1MiLCJDT05TVFJVQ1RTIiwicHJvdG90eXBlIiwiZXh0ZW5kIiwidW5zaGlmdCIsImNsYXNzU2VsZWN0b3IiLCJjb25zdHJ1Y3QiLCJpc1N1cGVyU2V0T2ZUb2tlbkxpc3QiLCJDbGFzc1R5cGUiLCJjaGFyc2V0IiwiZmlsZU9iaiIsImZpbGVNQiIsInNpemUiLCJza2lwU2l6ZUNoZWNrIiwidGV4dCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVhZGVyIiwib25sb2FkIiwicmVzdWx0IiwicmVhZEFzVGV4dCIsImVuY29kaW5nIiwiYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlIiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNEYXRhU291cmNlIiwibmV3Q2xhc3MiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUEsTUFBTUEsbUJBQW1CLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtrQkFDZjtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsYUFBTCxHQUFxQixFQUFyQjtXQUNLQyxjQUFMLEdBQXNCLEVBQXRCOztPQUVFQyxTQUFKLEVBQWVDLFFBQWYsRUFBeUJDLHVCQUF6QixFQUFrRDtVQUM1QyxDQUFDLEtBQUtKLGFBQUwsQ0FBbUJFLFNBQW5CLENBQUwsRUFBb0M7YUFDN0JGLGFBQUwsQ0FBbUJFLFNBQW5CLElBQWdDLEVBQWhDOztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtKLGFBQUwsQ0FBbUJFLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsTUFBb0QsQ0FBQyxDQUF6RCxFQUE0RDs7OztXQUl6REgsYUFBTCxDQUFtQkUsU0FBbkIsRUFBOEJJLElBQTlCLENBQW1DSCxRQUFuQzs7UUFFR0QsU0FBTCxFQUFnQkMsUUFBaEIsRUFBMEI7VUFDcEIsS0FBS0gsYUFBTCxDQUFtQkUsU0FBbkIsQ0FBSixFQUFtQztZQUM3QixDQUFDQyxRQUFMLEVBQWU7aUJBQ04sS0FBS0gsYUFBTCxDQUFtQkUsU0FBbkIsQ0FBUDtTQURGLE1BRU87Y0FDREssUUFBUSxLQUFLUCxhQUFMLENBQW1CRSxTQUFuQixFQUE4QkcsT0FBOUIsQ0FBc0NGLFFBQXRDLENBQVo7Y0FDSUksU0FBUyxDQUFiLEVBQWdCO2lCQUNUUCxhQUFMLENBQW1CRSxTQUFuQixFQUE4Qk0sTUFBOUIsQ0FBcUNELEtBQXJDLEVBQTRDLENBQTVDOzs7OztZQUtDTCxTQUFULEVBQW9CLEdBQUdPLElBQXZCLEVBQTZCO1VBQ3ZCLEtBQUtULGFBQUwsQ0FBbUJFLFNBQW5CLENBQUosRUFBbUM7YUFDNUJGLGFBQUwsQ0FBbUJFLFNBQW5CLEVBQThCUSxPQUE5QixDQUFzQ1AsWUFBWTtxQkFDckMsTUFBTTs7cUJBQ05RLEtBQVQsQ0FBZSxJQUFmLEVBQXFCRixJQUFyQjtXQURGLEVBRUcsQ0FGSDtTQURGOzs7a0JBT1dQLFNBQWYsRUFBMEJVLE1BQTFCLEVBQWtDQyxRQUFRLEVBQTFDLEVBQThDO1dBQ3ZDWixjQUFMLENBQW9CQyxTQUFwQixJQUFpQyxLQUFLRCxjQUFMLENBQW9CQyxTQUFwQixLQUFrQyxFQUFFVSxRQUFRLEVBQVYsRUFBbkU7YUFDT0UsTUFBUCxDQUFjLEtBQUtiLGNBQUwsQ0FBb0JDLFNBQXBCLEVBQStCVSxNQUE3QyxFQUFxREEsTUFBckQ7bUJBQ2EsS0FBS1gsY0FBTCxDQUFvQmMsT0FBakM7V0FDS2QsY0FBTCxDQUFvQmMsT0FBcEIsR0FBOEJDLFdBQVcsTUFBTTtZQUN6Q0osU0FBUyxLQUFLWCxjQUFMLENBQW9CQyxTQUFwQixFQUErQlUsTUFBNUM7ZUFDTyxLQUFLWCxjQUFMLENBQW9CQyxTQUFwQixDQUFQO2FBQ0tlLE9BQUwsQ0FBYWYsU0FBYixFQUF3QlUsTUFBeEI7T0FINEIsRUFJM0JDLEtBSjJCLENBQTlCOztHQTNDSjtDQURGO0FBb0RBSyxPQUFPQyxjQUFQLENBQXNCdkIsZ0JBQXRCLEVBQXdDd0IsT0FBT0MsV0FBL0MsRUFBNEQ7U0FDbkRDLEtBQUssQ0FBQyxDQUFDQSxFQUFFdkI7Q0FEbEI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDbERBLE1BQU13QixvQkFBb0I7WUFDZCxXQUFZQyxhQUFaLEVBQTJCO1VBQVFBLGNBQWNDLE9BQXBCO0dBRGY7UUFFbEJBLFdBQVdDLEtBQUtDLEtBQUtDLFNBQUwsQ0FBZUgsT0FBZixDQUFMLENBRk87UUFHbEIsTUFBTTtDQUhkOztBQU1BLE1BQU1JLE1BQU4sQ0FBYTtjQUNFO1FBQUE7ZUFFQSxNQUZBO2dCQUdDLEVBSEQ7Y0FJRCxFQUpDO29CQUtLO0dBTGxCLEVBTUc7U0FDSUMsSUFBTCxHQUFZQSxJQUFaO1NBQ0tDLFNBQUwsR0FBaUJiLE9BQU9KLE1BQVAsQ0FBYyxFQUFkLEVBQWtCUyxpQkFBbEIsRUFBcUNRLFNBQXJDLENBQWpCO1NBQ0tDLE9BQUwsR0FBZUEsT0FBZjtTQUNLQyxhQUFMLEdBQXFCQSxhQUFyQjtTQUNLQyxTQUFMLEdBQWlCLEtBQUtDLGFBQUwsQ0FBbUJDLFFBQW5CLENBQWpCOztNQUVFQSxRQUFKLEdBQWdCO1dBQ1AsS0FBS0YsU0FBTCxDQUFlRyxJQUFmLENBQW9CLEVBQXBCLENBQVA7O2dCQUVhQyxjQUFmLEVBQStCO1FBQ3pCLENBQUNBLGVBQWVDLFVBQWYsQ0FBMEIsTUFBMUIsQ0FBTCxFQUF3QztZQUNoQyxJQUFJQyxXQUFKLENBQWlCLGtDQUFqQixDQUFOOztVQUVJQyxlQUFlSCxlQUFlSSxLQUFmLENBQXFCLHVCQUFyQixDQUFyQjtRQUNJLENBQUNELFlBQUwsRUFBbUI7WUFDWCxJQUFJRCxXQUFKLENBQWlCLDRCQUEyQkYsY0FBZSxFQUEzRCxDQUFOOztVQUVJSixZQUFZLENBQUMsSUFBSSxLQUFLSixJQUFMLENBQVVhLE1BQVYsQ0FBaUJDLFNBQXJCLENBQStCLElBQS9CLENBQUQsQ0FBbEI7aUJBQ2FsQyxPQUFiLENBQXFCbUMsU0FBUztZQUN0QkMsT0FBT0QsTUFBTUgsS0FBTixDQUFZLHNCQUFaLENBQWI7VUFDSSxDQUFDSSxJQUFMLEVBQVc7Y0FDSCxJQUFJTixXQUFKLENBQWlCLGtCQUFpQkssS0FBTSxFQUF4QyxDQUFOOztZQUVJRSxpQkFBaUJELEtBQUssQ0FBTCxFQUFRLENBQVIsRUFBV0UsV0FBWCxLQUEyQkYsS0FBSyxDQUFMLEVBQVFHLEtBQVIsQ0FBYyxDQUFkLENBQTNCLEdBQThDLE9BQXJFO1lBQ01DLFVBQVVKLEtBQUssQ0FBTCxFQUFRSyxLQUFSLENBQWMsVUFBZCxFQUEwQkMsR0FBMUIsQ0FBOEJDLEtBQUs7WUFDN0NBLEVBQUVDLElBQUYsRUFBSjtlQUNPRCxNQUFNLEVBQU4sR0FBV0UsU0FBWCxHQUF1QkYsQ0FBOUI7T0FGYyxDQUFoQjtVQUlJTixtQkFBbUIsYUFBdkIsRUFBc0M7a0JBQzFCekMsSUFBVixDQUFlLElBQUksS0FBS3dCLElBQUwsQ0FBVWEsTUFBVixDQUFpQmEsU0FBckIsQ0FBK0IsSUFBL0IsRUFBcUNOLE9BQXJDLENBQWY7a0JBQ1U1QyxJQUFWLENBQWUsSUFBSSxLQUFLd0IsSUFBTCxDQUFVYSxNQUFWLENBQWlCYyxVQUFyQixDQUFnQyxJQUFoQyxFQUFzQyxFQUF0QyxDQUFmO09BRkYsTUFHTyxJQUFJLEtBQUszQixJQUFMLENBQVVhLE1BQVYsQ0FBaUJJLGNBQWpCLENBQUosRUFBc0M7a0JBQ2pDekMsSUFBVixDQUFlLElBQUksS0FBS3dCLElBQUwsQ0FBVWEsTUFBVixDQUFpQkksY0FBakIsQ0FBSixDQUFxQyxJQUFyQyxFQUEyQ0csT0FBM0MsQ0FBZjtPQURLLE1BRUE7Y0FDQyxJQUFJVixXQUFKLENBQWlCLGtCQUFpQk0sS0FBSyxDQUFMLENBQVEsRUFBMUMsQ0FBTjs7S0FoQko7V0FtQk9aLFNBQVA7O1NBRUYsR0FBbUI7Ozs7VUFDYixNQUFLRCxhQUFMLEtBQXVCLEtBQTNCLEVBQWtDO2NBQzFCLElBQUl5QixLQUFKLENBQVcsaURBQVgsQ0FBTjtPQURGLE1BRU8sSUFBSSxNQUFLekIsYUFBTCxLQUF1QixLQUEzQixFQUFrQztjQUNqQzBCLGFBQWEsTUFBS0EsVUFBTCxDQUFnQixNQUFLekIsU0FBckIsRUFBZ0MsTUFBS0EsU0FBTCxDQUFlMEIsTUFBZixHQUF3QixDQUF4RCxDQUFuQjs7Ozs7OzZDQUNnQ0QsVUFBaEMsZ09BQTRDO2tCQUEzQkUsV0FBMkI7O2dCQUN0QyxFQUFFQSx1QkFBdUIsTUFBSy9CLElBQUwsQ0FBVWdDLFFBQVYsQ0FBbUJDLGNBQTVDLENBQUosRUFBaUU7a0JBQzNELE1BQUtqQyxJQUFMLENBQVVrQyxLQUFkLEVBQXFCO3dCQUNYQyxJQUFSLENBQWFKLFdBQWI7O2FBRkosTUFJTztvQkFDQ0EsV0FBTjs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FSQyxNQVdBO2NBQ0MsSUFBSUgsS0FBSixDQUFXLDBCQUF5QixNQUFLekIsYUFBYyxFQUF2RCxDQUFOOzs7Ozs7Ozs7WUFRSixDQUFvQkMsU0FBcEIsRUFBK0JaLENBQS9CLEVBQWtDOzs7O1VBQzVCQSxNQUFNLENBQVYsRUFBYTtxREFDSCwyQkFBTVksVUFBVSxDQUFWLEVBQWFnQyxRQUFiLEVBQU4sQ0FBUiwwQkFEVztPQUFiLE1BRU87WUFDREMseUJBQXlCLEtBQTdCOzs7Ozs7OENBQ2dDLE9BQUtSLFVBQUwsQ0FBZ0J6QixTQUFoQixFQUEyQlosSUFBSSxDQUEvQixDQUFoQywwT0FBbUU7Z0JBQXBERSxhQUFvRDs7cUNBQ3hDLElBQXpCO2dCQUNJQSx5QkFBeUIsT0FBS00sSUFBTCxDQUFVZ0MsUUFBVixDQUFtQkMsY0FBaEQsRUFBZ0U7b0JBQ3hESyxXQUFXLDJCQUFNbEMsVUFBVVosQ0FBVixFQUFhNEMsUUFBYixDQUFzQjFDLGFBQXRCLENBQU4sQ0FBakI7MERBQ1E0QyxRQUFSO2FBRkYsTUFHTztvQkFDQzVDLGFBQU47Ozs7Ozs7Ozs7Ozs7Ozs7OztZQUdBLE9BQUtNLElBQUwsQ0FBVWtDLEtBQVYsSUFBbUIsQ0FBQ0csc0JBQXhCLEVBQWdEO2dCQUN2QywwQkFBeUJqQyxVQUFVWixJQUFJLENBQWQsQ0FBaUIsRUFBakQ7Ozs7OztRQUtOLENBQWdCLEVBQUUrQyxRQUFRLEVBQVYsRUFBaEIsRUFBZ0M7Ozs7WUFDeEJELFdBQVcsT0FBS0UsT0FBTCxFQUFqQjtXQUNLLElBQUloRCxJQUFJLENBQWIsRUFBZ0JBLElBQUkrQyxLQUFwQixFQUEyQi9DLEdBQTNCLEVBQWdDO2NBQ3hCd0IsT0FBTywyQkFBTXNCLFNBQVNHLElBQVQsRUFBTixDQUFiO1lBQ0l6QixLQUFLMEIsSUFBVCxFQUFlOzs7Y0FHVDFCLEtBQUsyQixLQUFYOzs7OztTQUlJQyxVQUFSLEVBQW9CeEIsT0FBcEIsRUFBNkJuQixZQUFZLEVBQXpDLEVBQTZDQyxVQUFVLEVBQXZELEVBQTJEO1VBQ25EMkMsWUFBWSxJQUFJOUMsTUFBSixDQUFXO1lBQ3JCLEtBQUtDLElBRGdCO2lCQUVoQlosT0FBT0osTUFBUCxDQUFjLEVBQWQsRUFBa0IsS0FBS2lCLFNBQXZCLEVBQWtDQSxTQUFsQyxDQUZnQjtlQUdsQmIsT0FBT0osTUFBUCxDQUFjLEVBQWQsRUFBa0IsS0FBS2tCLE9BQXZCLEVBQWdDQSxPQUFoQyxDQUhrQjtZQUlyQixLQUFLNEM7S0FKSyxDQUFsQjtjQU1VMUMsU0FBVixHQUFzQixLQUFLQSxTQUFMLENBQWUyQyxNQUFmLENBQXNCLENBQUUsSUFBSUgsVUFBSixDQUFlQyxTQUFmLEVBQTBCekIsT0FBMUIsQ0FBRixDQUF0QixDQUF0QjtXQUNPeUIsU0FBUDs7O3dCQUdxQnpDLFNBQXZCLEVBQWtDO1FBQzVCQSxVQUFVMEIsTUFBVixLQUFxQixLQUFLMUIsU0FBTCxDQUFlMEIsTUFBeEMsRUFBZ0Q7YUFBUyxLQUFQOztXQUMzQyxLQUFLMUIsU0FBTCxDQUFlNEMsS0FBZixDQUFxQixDQUFDQyxLQUFELEVBQVF6RCxDQUFSLEtBQWN5RCxNQUFNQyxZQUFOLENBQW1COUMsVUFBVVosQ0FBVixDQUFuQixDQUFuQyxDQUFQOzs7O0FDMUhKLE1BQU0yRCxjQUFOLENBQXFCO01BQ2ZDLElBQUosR0FBWTtXQUNILEtBQUtDLFdBQUwsQ0FBaUJELElBQXhCOztNQUVFRSxrQkFBSixHQUEwQjtXQUNqQixLQUFLRCxXQUFMLENBQWlCQyxrQkFBeEI7O01BRUVDLGlCQUFKLEdBQXlCO1dBQ2hCLEtBQUtGLFdBQUwsQ0FBaUJFLGlCQUF4Qjs7O0FBR0puRSxPQUFPQyxjQUFQLENBQXNCOEQsY0FBdEIsRUFBc0MsTUFBdEMsRUFBOEM7OztnQkFHOUIsSUFIOEI7UUFJckM7V0FBUyxLQUFLQyxJQUFaOztDQUpYO0FBTUFoRSxPQUFPQyxjQUFQLENBQXNCOEQsY0FBdEIsRUFBc0Msb0JBQXRDLEVBQTREO1FBQ25EO1VBQ0NuQyxPQUFPLEtBQUtvQyxJQUFsQjtXQUNPcEMsS0FBS3dDLE9BQUwsQ0FBYSxHQUFiLEVBQWtCeEMsS0FBSyxDQUFMLEVBQVF5QyxpQkFBUixFQUFsQixDQUFQOztDQUhKO0FBTUFyRSxPQUFPQyxjQUFQLENBQXNCOEQsY0FBdEIsRUFBc0MsbUJBQXRDLEVBQTJEO1FBQ2xEOztXQUVFLEtBQUtDLElBQUwsQ0FBVUksT0FBVixDQUFrQixpQkFBbEIsRUFBcUMsT0FBckMsQ0FBUDs7Q0FISjs7QUNyQkEsTUFBTUUsU0FBTixTQUF3QlAsY0FBeEIsQ0FBdUM7Y0FDeEJRLE1BQWIsRUFBcUI7O1NBRWRBLE1BQUwsR0FBY0EsTUFBZDs7YUFFVTs7V0FFRixJQUFHLEtBQUtQLElBQUwsQ0FBVVEsV0FBVixFQUF3QixJQUFuQzs7ZUFFWUMsVUFBZCxFQUEwQjtXQUNqQkEsV0FBV1IsV0FBWCxLQUEyQixLQUFLQSxXQUF2Qzs7VUFFRixDQUFrQjNELGFBQWxCLEVBQWlDOztZQUN6QixJQUFJa0MsS0FBSixDQUFXLG9DQUFYLENBQU47Ozs7QUFHSnhDLE9BQU9DLGNBQVAsQ0FBc0JxRSxTQUF0QixFQUFpQyxNQUFqQyxFQUF5QztRQUNoQzt3QkFDY0ksSUFBWixDQUFpQixLQUFLQyxJQUF0QixFQUE0QixDQUE1Qjs7O0NBRlg7O0FDaEJBLE1BQU1qRCxTQUFOLFNBQXdCNEMsU0FBeEIsQ0FBa0M7R0FDOUJ0QixRQUFGLEdBQWM7VUFDTixLQUFLdUIsTUFBTCxDQUFZM0QsSUFBWixDQUFpQmdFLElBQWpCLENBQXNCO3FCQUNYLElBRFc7YUFFbkIsSUFGbUI7ZUFHakIsS0FBS0wsTUFBTCxDQUFZM0QsSUFBWixDQUFpQmlFO0tBSHRCLENBQU47O2FBTVU7V0FDRixNQUFSOzs7O0FDVEosTUFBTXZDLFNBQU4sU0FBd0JnQyxTQUF4QixDQUFrQztjQUNuQkMsTUFBYixFQUFxQnZDLE9BQXJCLEVBQThCLEVBQUU4QyxRQUFGLEVBQVlDLElBQVosRUFBa0JDLE1BQWxCLEtBQTZCLEVBQTNELEVBQStEO1VBQ3ZEVCxNQUFOO1FBQ0lRLFFBQVFDLE1BQVosRUFBb0I7V0FDYkQsSUFBTCxHQUFZQSxJQUFaO1dBQ0tDLE1BQUwsR0FBY0EsTUFBZDtLQUZGLE1BR08sSUFBS2hELFdBQVdBLFFBQVFVLE1BQVIsS0FBbUIsQ0FBOUIsSUFBbUNWLFFBQVEsQ0FBUixNQUFlSyxTQUFuRCxJQUFpRXlDLFFBQXJFLEVBQStFO1dBQy9FQSxRQUFMLEdBQWdCLElBQWhCO0tBREssTUFFQTtjQUNHdEYsT0FBUixDQUFnQnlGLE9BQU87WUFDakJyRCxPQUFPcUQsSUFBSXpELEtBQUosQ0FBVSxnQkFBVixDQUFYO1lBQ0lJLFFBQVFBLEtBQUssQ0FBTCxNQUFZLEdBQXhCLEVBQTZCO2VBQ3RCLENBQUwsSUFBVXNELFFBQVY7O2VBRUt0RCxPQUFPQSxLQUFLTSxHQUFMLENBQVNDLEtBQUtBLEVBQUVnRCxRQUFGLENBQVdoRCxDQUFYLENBQWQsQ0FBUCxHQUFzQyxJQUE3QztZQUNJUCxRQUFRLENBQUN3RCxNQUFNeEQsS0FBSyxDQUFMLENBQU4sQ0FBVCxJQUEyQixDQUFDd0QsTUFBTXhELEtBQUssQ0FBTCxDQUFOLENBQWhDLEVBQWdEO2VBQ3pDLElBQUl4QixJQUFJd0IsS0FBSyxDQUFMLENBQWIsRUFBc0J4QixLQUFLd0IsS0FBSyxDQUFMLENBQTNCLEVBQW9DeEIsR0FBcEMsRUFBeUM7aUJBQ2xDNEUsTUFBTCxHQUFjLEtBQUtBLE1BQUwsSUFBZSxFQUE3QjtpQkFDS0EsTUFBTCxDQUFZNUYsSUFBWixDQUFpQixFQUFFaUcsS0FBS3pELEtBQUssQ0FBTCxDQUFQLEVBQWdCMEQsTUFBTTFELEtBQUssQ0FBTCxDQUF0QixFQUFqQjs7OztlQUlHcUQsSUFBSXpELEtBQUosQ0FBVSxRQUFWLENBQVA7ZUFDT0ksUUFBUUEsS0FBSyxDQUFMLENBQVIsR0FBa0JBLEtBQUssQ0FBTCxDQUFsQixHQUE0QnFELEdBQW5DO1lBQ0lNLE1BQU1DLE9BQU81RCxJQUFQLENBQVY7WUFDSXdELE1BQU1HLEdBQU4sS0FBY0EsUUFBUUosU0FBU3ZELElBQVQsQ0FBMUIsRUFBMEM7O2VBQ25DbUQsSUFBTCxHQUFZLEtBQUtBLElBQUwsSUFBYSxFQUF6QjtlQUNLQSxJQUFMLENBQVVuRCxJQUFWLElBQWtCLElBQWxCO1NBRkYsTUFHTztlQUNBb0QsTUFBTCxHQUFjLEtBQUtBLE1BQUwsSUFBZSxFQUE3QjtlQUNLQSxNQUFMLENBQVk1RixJQUFaLENBQWlCLEVBQUVpRyxLQUFLRSxHQUFQLEVBQVlELE1BQU1DLEdBQWxCLEVBQWpCOztPQXJCSjtVQXdCSSxDQUFDLEtBQUtSLElBQU4sSUFBYyxDQUFDLEtBQUtDLE1BQXhCLEVBQWdDO2NBQ3hCLElBQUkxRCxXQUFKLENBQWlCLGdDQUErQmIsS0FBS0MsU0FBTCxDQUFlc0IsT0FBZixDQUF3QixFQUF4RSxDQUFOOzs7UUFHQSxLQUFLZ0QsTUFBVCxFQUFpQjtXQUNWQSxNQUFMLEdBQWMsS0FBS1MsaUJBQUwsQ0FBdUIsS0FBS1QsTUFBNUIsQ0FBZDs7O01BR0FVLGNBQUosR0FBc0I7V0FDYixDQUFDLEtBQUtaLFFBQU4sSUFBa0IsQ0FBQyxLQUFLQyxJQUF4QixJQUFnQyxDQUFDLEtBQUtDLE1BQTdDOztvQkFFaUJBLE1BQW5CLEVBQTJCOztVQUVuQlcsWUFBWSxFQUFsQjtVQUNNL0QsT0FBT29ELE9BQU9ZLElBQVAsQ0FBWSxDQUFDQyxDQUFELEVBQUlDLENBQUosS0FBVUQsRUFBRVIsR0FBRixHQUFRUyxFQUFFVCxHQUFoQyxDQUFiO1FBQ0lVLGVBQWUsSUFBbkI7U0FDSyxJQUFJM0YsSUFBSSxDQUFiLEVBQWdCQSxJQUFJd0IsS0FBS2MsTUFBekIsRUFBaUN0QyxHQUFqQyxFQUFzQztVQUNoQyxDQUFDMkYsWUFBTCxFQUFtQjt1QkFDRm5FLEtBQUt4QixDQUFMLENBQWY7T0FERixNQUVPLElBQUl3QixLQUFLeEIsQ0FBTCxFQUFRaUYsR0FBUixJQUFlVSxhQUFhVCxJQUFoQyxFQUFzQztxQkFDOUJBLElBQWIsR0FBb0IxRCxLQUFLeEIsQ0FBTCxFQUFRa0YsSUFBNUI7T0FESyxNQUVBO2tCQUNLbEcsSUFBVixDQUFlMkcsWUFBZjt1QkFDZW5FLEtBQUt4QixDQUFMLENBQWY7OztRQUdBMkYsWUFBSixFQUFrQjs7Z0JBRU4zRyxJQUFWLENBQWUyRyxZQUFmOztXQUVLSixVQUFVakQsTUFBVixHQUFtQixDQUFuQixHQUF1QmlELFNBQXZCLEdBQW1DdEQsU0FBMUM7O2FBRVVvQyxVQUFaLEVBQXdCOztRQUVsQixFQUFFQSxzQkFBc0JuQyxTQUF4QixDQUFKLEVBQXdDO1lBQ2hDLElBQUlFLEtBQUosQ0FBVywyREFBWCxDQUFOO0tBREYsTUFFTyxJQUFJaUMsV0FBV0ssUUFBZixFQUF5QjthQUN2QixJQUFQO0tBREssTUFFQSxJQUFJLEtBQUtBLFFBQVQsRUFBbUI7Y0FDaEIvQixJQUFSLENBQWMsMEZBQWQ7YUFDTyxJQUFQO0tBRkssTUFHQTtZQUNDaUQsVUFBVSxFQUFoQjtXQUNLLElBQUlDLEdBQVQsSUFBaUIsS0FBS2xCLElBQUwsSUFBYSxFQUE5QixFQUFtQztZQUM3QixDQUFDTixXQUFXTSxJQUFaLElBQW9CLENBQUNOLFdBQVdNLElBQVgsQ0FBZ0JrQixHQUFoQixDQUF6QixFQUErQztrQkFDckNBLEdBQVIsSUFBZSxJQUFmOzs7VUFHQU4sWUFBWSxFQUFoQjtVQUNJLEtBQUtYLE1BQVQsRUFBaUI7WUFDWFAsV0FBV08sTUFBZixFQUF1QjtjQUNqQmtCLFlBQVksS0FBS2xCLE1BQUwsQ0FBWW1CLE1BQVosQ0FBbUIsQ0FBQ0MsR0FBRCxFQUFNQyxLQUFOLEtBQWdCO21CQUMxQ0QsSUFBSXpDLE1BQUosQ0FBVyxDQUNoQixFQUFFMkMsU0FBUyxJQUFYLEVBQWlCakIsS0FBSyxJQUF0QixFQUE0QjlCLE9BQU84QyxNQUFNaEIsR0FBekMsRUFEZ0IsRUFFaEIsRUFBRWlCLFNBQVMsSUFBWCxFQUFpQmhCLE1BQU0sSUFBdkIsRUFBNkIvQixPQUFPOEMsTUFBTWYsSUFBMUMsRUFGZ0IsQ0FBWCxDQUFQO1dBRGMsRUFLYixFQUxhLENBQWhCO3NCQU1ZWSxVQUFVdkMsTUFBVixDQUFpQmMsV0FBV08sTUFBWCxDQUFrQm1CLE1BQWxCLENBQXlCLENBQUNDLEdBQUQsRUFBTUMsS0FBTixLQUFnQjttQkFDN0RELElBQUl6QyxNQUFKLENBQVcsQ0FDaEIsRUFBRTRDLFNBQVMsSUFBWCxFQUFpQmxCLEtBQUssSUFBdEIsRUFBNEI5QixPQUFPOEMsTUFBTWhCLEdBQXpDLEVBRGdCLEVBRWhCLEVBQUVrQixTQUFTLElBQVgsRUFBaUJqQixNQUFNLElBQXZCLEVBQTZCL0IsT0FBTzhDLE1BQU1mLElBQTFDLEVBRmdCLENBQVgsQ0FBUDtXQUQyQixFQUsxQixFQUwwQixDQUFqQixFQUtKTSxJQUxJLEVBQVo7Y0FNSUcsZUFBZSxJQUFuQjtlQUNLLElBQUkzRixJQUFJLENBQWIsRUFBZ0JBLElBQUk4RixVQUFVeEQsTUFBOUIsRUFBc0N0QyxHQUF0QyxFQUEyQztnQkFDckMyRixpQkFBaUIsSUFBckIsRUFBMkI7a0JBQ3JCRyxVQUFVOUYsQ0FBVixFQUFha0csT0FBYixJQUF3QkosVUFBVTlGLENBQVYsRUFBYWlGLEdBQXpDLEVBQThDOytCQUM3QixFQUFFQSxLQUFLYSxVQUFVOUYsQ0FBVixFQUFhbUQsS0FBcEIsRUFBZjs7YUFGSixNQUlPLElBQUkyQyxVQUFVOUYsQ0FBVixFQUFha0csT0FBYixJQUF3QkosVUFBVTlGLENBQVYsRUFBYWtGLElBQXpDLEVBQStDOzJCQUN2Q0EsSUFBYixHQUFvQlksVUFBVTlGLENBQVYsRUFBYW1ELEtBQWpDO2tCQUNJd0MsYUFBYVQsSUFBYixJQUFxQlMsYUFBYVYsR0FBdEMsRUFBMkM7MEJBQy9CakcsSUFBVixDQUFlMkcsWUFBZjs7NkJBRWEsSUFBZjthQUxLLE1BTUEsSUFBSUcsVUFBVTlGLENBQVYsRUFBYW1HLE9BQWpCLEVBQTBCO2tCQUMzQkwsVUFBVTlGLENBQVYsRUFBYWlGLEdBQWpCLEVBQXNCOzZCQUNQQyxJQUFiLEdBQW9CWSxVQUFVOUYsQ0FBVixFQUFhaUYsR0FBYixHQUFtQixDQUF2QztvQkFDSVUsYUFBYVQsSUFBYixJQUFxQlMsYUFBYVYsR0FBdEMsRUFBMkM7NEJBQy9CakcsSUFBVixDQUFlMkcsWUFBZjs7K0JBRWEsSUFBZjtlQUxGLE1BTU8sSUFBSUcsVUFBVTlGLENBQVYsRUFBYWtGLElBQWpCLEVBQXVCOzZCQUNmRCxHQUFiLEdBQW1CYSxVQUFVOUYsQ0FBVixFQUFha0YsSUFBYixHQUFvQixDQUF2Qzs7OztTQWpDUixNQXFDTztzQkFDTyxLQUFLTixNQUFqQjs7O2FBR0csSUFBSTFDLFNBQUosQ0FBYyxLQUFLMUIsSUFBbkIsRUFBeUIsSUFBekIsRUFBK0IsRUFBRW1FLE1BQU1pQixPQUFSLEVBQWlCaEIsUUFBUVcsU0FBekIsRUFBL0IsQ0FBUDs7O2VBR1VsQixVQUFkLEVBQTBCO1FBQ3BCLEVBQUVBLHNCQUFzQm5DLFNBQXhCLENBQUosRUFBd0M7YUFDL0IsS0FBUDtLQURGLE1BRU87WUFDQ2tFLE9BQU8vQixXQUFXZ0MsVUFBWCxDQUFzQixJQUF0QixDQUFiO2FBQ09ELFNBQVMsSUFBVCxJQUFpQkEsS0FBS2QsY0FBN0I7OzthQUdRO1FBQ04sS0FBS1osUUFBVCxFQUFtQjthQUFTLFNBQVA7O1dBQ2QsV0FBVyxDQUFDLEtBQUtFLE1BQUwsSUFBZSxFQUFoQixFQUFvQjlDLEdBQXBCLENBQXdCLENBQUMsRUFBQ21ELEdBQUQsRUFBTUMsSUFBTixFQUFELEtBQWlCO2FBQ2xERCxRQUFRQyxJQUFSLEdBQWVELEdBQWYsR0FBc0IsR0FBRUEsR0FBSSxJQUFHQyxJQUFLLEVBQTNDO0tBRGdCLEVBRWYzQixNQUZlLENBRVIzRCxPQUFPK0UsSUFBUCxDQUFZLEtBQUtBLElBQUwsSUFBYSxFQUF6QixFQUE2QjdDLEdBQTdCLENBQWlDK0QsT0FBUSxJQUFHQSxHQUFJLEdBQWhELENBRlEsRUFHZjlFLElBSGUsQ0FHVixHQUhVLENBQVgsR0FHUSxHQUhmOztVQUtGLENBQWtCYixhQUFsQixFQUFpQzs7OztVQUMzQixPQUFPQSxjQUFjQyxPQUFyQixLQUFpQyxRQUFyQyxFQUErQztZQUN6QyxDQUFDLE1BQUtnRSxNQUFMLENBQVkzRCxJQUFaLENBQWlCa0MsS0FBdEIsRUFBNkI7Z0JBQ3JCLElBQUk0RCxTQUFKLENBQWUscUNBQWYsQ0FBTjtTQURGLE1BRU87Ozs7VUFJTCxNQUFLNUIsUUFBVCxFQUFtQjthQUNaLElBQUltQixHQUFULElBQWdCM0YsY0FBY0MsT0FBOUIsRUFBdUM7Z0JBQy9CLE1BQUtnRSxNQUFMLENBQVkzRCxJQUFaLENBQWlCZ0UsSUFBakIsQ0FBc0I7eUJBQUE7bUJBRW5CLEtBRm1CO3FCQUdqQnFCO1dBSEwsQ0FBTjs7T0FGSixNQVFPO3lCQUNtQixNQUFLakIsTUFBTCxJQUFlLEVBQXZDLEVBQTJDO2NBQWxDLEVBQUNLLEdBQUQsRUFBTUMsSUFBTixFQUFrQzs7Z0JBQ25DcUIsS0FBS0MsR0FBTCxDQUFTLENBQVQsRUFBWXZCLEdBQVosQ0FBTjtpQkFDT3NCLEtBQUtFLEdBQUwsQ0FBU3ZHLGNBQWNDLE9BQWQsQ0FBc0JtQyxNQUF0QixHQUErQixDQUF4QyxFQUEyQzRDLElBQTNDLENBQVA7ZUFDSyxJQUFJbEYsSUFBSWlGLEdBQWIsRUFBa0JqRixLQUFLa0YsSUFBdkIsRUFBNkJsRixHQUE3QixFQUFrQztnQkFDNUJFLGNBQWNDLE9BQWQsQ0FBc0JILENBQXRCLE1BQTZCaUMsU0FBakMsRUFBNEM7b0JBQ3BDLE1BQUtrQyxNQUFMLENBQVkzRCxJQUFaLENBQWlCZ0UsSUFBakIsQ0FBc0I7NkJBQUE7dUJBRW5CLEtBRm1CO3lCQUdqQnhFO2VBSEwsQ0FBTjs7OzthQVFELElBQUk2RixHQUFULElBQWdCLE1BQUtsQixJQUFMLElBQWEsRUFBN0IsRUFBaUM7Y0FDM0J6RSxjQUFjQyxPQUFkLENBQXNCdUcsY0FBdEIsQ0FBcUNiLEdBQXJDLENBQUosRUFBK0M7a0JBQ3ZDLE1BQUsxQixNQUFMLENBQVkzRCxJQUFaLENBQWlCZ0UsSUFBakIsQ0FBc0I7MkJBQUE7cUJBRW5CLEtBRm1CO3VCQUdqQnFCO2FBSEwsQ0FBTjs7Ozs7Ozs7QUM5S1YsTUFBTTFELFVBQU4sU0FBeUIrQixTQUF6QixDQUFtQztVQUNqQyxDQUFrQmhFLGFBQWxCLEVBQWlDOzs7O1lBQ3pCeUcsTUFBTXpHLGlCQUFpQkEsY0FBY0EsYUFBL0IsSUFBZ0RBLGNBQWNBLGFBQWQsQ0FBNEJDLE9BQXhGO1lBQ00wRixNQUFNM0YsaUJBQWlCQSxjQUFjQyxPQUEzQztZQUNNeUcsVUFBVSxPQUFPZixHQUF2QjtVQUNJLE9BQU9jLEdBQVAsS0FBZSxRQUFmLElBQTRCQyxZQUFZLFFBQVosSUFBd0JBLFlBQVksUUFBcEUsRUFBK0U7WUFDekUsQ0FBQyxNQUFLekMsTUFBTCxDQUFZM0QsSUFBWixDQUFpQmtDLEtBQXRCLEVBQTZCO2dCQUNyQixJQUFJNEQsU0FBSixDQUFlLG9FQUFmLENBQU47U0FERixNQUVPOzs7O1lBSUgsTUFBS25DLE1BQUwsQ0FBWTNELElBQVosQ0FBaUJnRSxJQUFqQixDQUFzQjtxQkFBQTtlQUVuQixLQUZtQjtpQkFHakJtQyxJQUFJZCxHQUFKO09BSEwsQ0FBTjs7Ozs7QUNaSixNQUFNZ0IsYUFBTixTQUE0QjNDLFNBQTVCLENBQXNDO1VBQ3BDLENBQWtCaEUsYUFBbEIsRUFBaUM7Ozs7VUFDM0IsT0FBT0EsY0FBY0MsT0FBckIsS0FBaUMsUUFBckMsRUFBK0M7WUFDekMsQ0FBQyxNQUFLZ0UsTUFBTCxDQUFZM0QsSUFBWixDQUFpQmtDLEtBQXRCLEVBQTZCO2dCQUNyQixJQUFJNEQsU0FBSixDQUFlLHdDQUFmLENBQU47U0FERixNQUVPOzs7O1VBSUxqRCxTQUFKO1VBQ0k7b0JBQ1UsTUFBS2MsTUFBTCxDQUFZM0QsSUFBWixDQUFpQjJELE1BQWpCLENBQXdCO29CQUN4QmpFLGNBQWNDLE9BRFU7cUJBRXZCLE1BQUtnRSxNQUFMLENBQVkxRCxTQUZXO21CQUd6QixNQUFLMEQsTUFBTCxDQUFZekQsT0FIYTt5QkFJbkIsTUFBS3lELE1BQUwsQ0FBWXhEO1NBSmpCLENBQVo7T0FERixDQU9FLE9BQU9tRyxHQUFQLEVBQVk7WUFDUixDQUFDLE1BQUszQyxNQUFMLENBQVkzRCxJQUFaLENBQWlCa0MsS0FBbEIsSUFBMkIsRUFBRW9FLGVBQWU1RixXQUFqQixDQUEvQixFQUE4RDtnQkFDdEQ0RixHQUFOO1NBREYsTUFFTzs7OztZQUlIaEUsV0FBVywyQkFBTU8sVUFBVUwsT0FBVixFQUFOLENBQWpCO2tEQUNRRixRQUFSOzs7OztBQ3pCSixNQUFNaUUsUUFBTixTQUF1QjdDLFNBQXZCLENBQWlDO2NBQ2xCQyxNQUFiLEVBQXFCLENBQUU2QyxZQUFZLFVBQWQsQ0FBckIsRUFBaUQ7VUFDekM3QyxNQUFOO1FBQ0ksQ0FBQ0EsT0FBTzFELFNBQVAsQ0FBaUJ1RyxTQUFqQixDQUFMLEVBQWtDO1lBQzFCLElBQUk5RixXQUFKLENBQWlCLHFCQUFvQjhGLFNBQVUsRUFBL0MsQ0FBTjs7U0FFR0EsU0FBTCxHQUFpQkEsU0FBakI7O2FBRVU7V0FDRixRQUFPLEtBQUtBLFNBQVUsR0FBOUI7O2VBRVkzQyxVQUFkLEVBQTBCO1dBQ2pCQSxXQUFXUixXQUFYLEtBQTJCa0QsUUFBM0IsSUFBdUMxQyxXQUFXMkMsU0FBWCxLQUF5QixLQUFLQSxTQUE1RTs7VUFFRixDQUFrQjlHLGFBQWxCLEVBQWlDOzs7Ozs7Ozs7MkNBQ0csTUFBS2lFLE1BQUwsQ0FBWTFELFNBQVosQ0FBc0IsTUFBS3VHLFNBQTNCLEVBQXNDOUcsYUFBdEMsQ0FBbEMsZ09BQXdGO2dCQUF2RStHLGFBQXVFOztnQkFDaEYsTUFBSzlDLE1BQUwsQ0FBWTNELElBQVosQ0FBaUJnRSxJQUFqQixDQUFzQjt5QkFBQTttQkFFbkIsS0FGbUI7cUJBR2pCeUM7V0FITCxDQUFOOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ2hCTixNQUFNQyxZQUFOLFNBQTJCaEQsU0FBM0IsQ0FBcUM7Y0FDdEJDLE1BQWIsRUFBcUIsQ0FBRXJDLE1BQU0sVUFBUixFQUFvQnFGLE9BQU8sTUFBM0IsRUFBbUNDLGtCQUFrQixNQUFyRCxDQUFyQixFQUFvRjtVQUM1RWpELE1BQU47U0FDSyxNQUFNa0QsSUFBWCxJQUFtQixDQUFFdkYsR0FBRixFQUFPcUYsSUFBUCxFQUFhQyxlQUFiLENBQW5CLEVBQW1EO1VBQzdDLENBQUNqRCxPQUFPMUQsU0FBUCxDQUFpQjRHLElBQWpCLENBQUwsRUFBNkI7Y0FDckIsSUFBSW5HLFdBQUosQ0FBaUIscUJBQW9CbUcsSUFBSyxFQUExQyxDQUFOOzs7U0FHQ3ZGLEdBQUwsR0FBV0EsR0FBWDtTQUNLcUYsSUFBTCxHQUFZQSxJQUFaO1NBQ0tDLGVBQUwsR0FBdUJBLGVBQXZCOztTQUVLRSxTQUFMLEdBQWlCLEVBQWpCOzthQUVVO1dBQ0YsWUFBVyxLQUFLeEYsR0FBSSxLQUFJLEtBQUtxRixJQUFLLEtBQUksS0FBS0MsZUFBZ0IsR0FBbkU7O1VBRUYsQ0FBa0JsSCxhQUFsQixFQUFpQzs7Ozs7Ozs7OzJDQUNHLE1BQUtpRSxNQUFMLENBQVkxRCxTQUFaLENBQXNCLE1BQUtxQixHQUEzQixFQUFnQzVCLGFBQWhDLENBQWxDLGdPQUFrRjtnQkFBakUrRyxhQUFpRTs7Z0JBQzFFRSxPQUFPLE1BQUtoRCxNQUFMLENBQVkxRCxTQUFaLENBQXNCLE1BQUswRyxJQUEzQixFQUFpQ0YsYUFBakMsQ0FBYjtjQUNJLE1BQUtLLFNBQUwsQ0FBZUgsSUFBZixDQUFKLEVBQTBCO2dCQUNwQixNQUFLQyxlQUFMLEtBQXlCLE1BQTdCLEVBQXFDO29CQUM5QmpELE1BQUwsQ0FBWTFELFNBQVosQ0FBc0IsTUFBSzJHLGVBQTNCLEVBQTRDLE1BQUtFLFNBQUwsQ0FBZUgsSUFBZixDQUE1QyxFQUFrRUYsYUFBbEU7b0JBQ0tLLFNBQUwsQ0FBZUgsSUFBZixFQUFxQnhILE9BQXJCLENBQTZCLFFBQTdCOztXQUhKLE1BS087a0JBQ0EySCxTQUFMLENBQWVILElBQWYsSUFBdUIsTUFBS2hELE1BQUwsQ0FBWTNELElBQVosQ0FBaUJnRSxJQUFqQixDQUFzQjsyQkFBQTtxQkFFcEMsS0FGb0M7dUJBR2xDeUM7YUFIWSxDQUF2QjtrQkFLTSxNQUFLSyxTQUFMLENBQWVILElBQWYsQ0FBTjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUMvQlIsTUFBTUksZ0JBQU4sU0FBK0I1RCxjQUEvQixDQUE4QztjQUMvQixFQUFFbkQsSUFBRixFQUFRTSxRQUFSLEVBQWtCMEcsYUFBYSxFQUEvQixFQUFiLEVBQWtEOztTQUUzQ2hILElBQUwsR0FBWUEsSUFBWjtTQUNLTSxRQUFMLEdBQWdCQSxRQUFoQjtTQUNLcUQsTUFBTCxHQUFjLEtBQUszRCxJQUFMLENBQVUyRCxNQUFWLENBQWlCLEVBQUVyRCxVQUFVQSxRQUFaLEVBQWpCLENBQWQ7U0FDSzBHLFVBQUwsR0FBa0JBLFVBQWxCO1NBQ0tDLFdBQUwsR0FBbUIsRUFBbkI7O09BRUlDLE9BQU4sRUFBZTtXQUNOLElBQUksS0FBS2xILElBQUwsQ0FBVWdDLFFBQVYsQ0FBbUJDLGNBQXZCLENBQXNDaUYsT0FBdEMsQ0FBUDs7O0FBR0o5SCxPQUFPQyxjQUFQLENBQXNCMEgsZ0JBQXRCLEVBQXdDLE1BQXhDLEVBQWdEO1FBQ3ZDOzRCQUNrQmpELElBQWhCLENBQXFCLEtBQUtDLElBQTFCLEVBQWdDLENBQWhDOzs7Q0FGWDs7QUNiQSxNQUFNb0QsYUFBTixTQUE0QkosZ0JBQTVCLENBQTZDOztBQ0E3QyxNQUFNSyxhQUFOLFNBQTRCTCxnQkFBNUIsQ0FBNkM7Ozs7Ozs7Ozs7QUNDN0MsTUFBTTlFLGNBQU4sU0FBNkJuRSxpQkFBaUJxRixjQUFqQixDQUE3QixDQUE4RDtjQUMvQyxFQUFFekQsYUFBRixFQUFpQnVELEtBQWpCLEVBQXdCdEQsT0FBeEIsRUFBYixFQUFnRDs7U0FFekNELGFBQUwsR0FBcUJBLGFBQXJCO1NBQ0t1RCxLQUFMLEdBQWFBLEtBQWI7U0FDS3RELE9BQUwsR0FBZUEsT0FBZjs7O0FBR0pQLE9BQU9DLGNBQVAsQ0FBc0I0QyxjQUF0QixFQUFzQyxNQUF0QyxFQUE4QztRQUNyQzswQkFDZ0I2QixJQUFkLENBQW1CLEtBQUtDLElBQXhCLEVBQThCLENBQTlCOzs7Q0FGWDs7QUNUQSxNQUFNc0QsV0FBTixTQUEwQnBGLGNBQTFCLENBQXlDOztBQ0F6QyxNQUFNcUYsV0FBTixTQUEwQnJGLGNBQTFCLENBQXlDOzs7Ozs7Ozs7O0FDTXpDLE1BQU1zRixJQUFOLFNBQW1CekosaUJBQWlCLE1BQU0sRUFBdkIsQ0FBbkIsQ0FBOEM7Y0FDL0IwSixVQUFiLEVBQXlCOztTQUVsQkEsVUFBTCxHQUFrQkEsVUFBbEIsQ0FGdUI7U0FHbEJDLElBQUwsR0FBWUEsSUFBWixDQUh1Qjs7U0FLbEJ2RixLQUFMLEdBQWEsS0FBYixDQUx1Qjs7O1NBUWxCK0IsSUFBTCxHQUFZLEVBQVo7U0FDS3lELE9BQUwsR0FBZSxFQUFmOzs7U0FHS0MsZUFBTCxHQUF1QjtjQUNiLE1BRGE7YUFFZCxLQUZjO2FBR2QsS0FIYztrQkFJVCxVQUpTO2tCQUtUO0tBTGQ7O1NBUUtDLGNBQUwsR0FBc0I7Y0FDWixJQURZO2FBRWIsSUFGYTtXQUdmO0tBSFA7U0FLS0MsY0FBTCxHQUFzQjtlQUNYLElBRFc7WUFFZCxJQUZjO1dBR2Y7S0FIUDs7O1NBT0toSCxNQUFMLEdBQWNBLE1BQWQ7U0FDS2lILFVBQUwsR0FBa0JBLFVBQWxCO1NBQ0s5RixRQUFMLEdBQWdCQSxRQUFoQjs7O1NBR0ssTUFBTWYsY0FBWCxJQUE2QixLQUFLSixNQUFsQyxFQUEwQztZQUNsQytCLGFBQWEsS0FBSy9CLE1BQUwsQ0FBWUksY0FBWixDQUFuQjthQUNPOEcsU0FBUCxDQUFpQm5GLFdBQVdVLGtCQUE1QixJQUFrRCxVQUFVbEMsT0FBVixFQUFtQm5CLFNBQW5CLEVBQThCQyxPQUE5QixFQUF1QztlQUNoRixLQUFLOEgsTUFBTCxDQUFZcEYsVUFBWixFQUF3QnhCLE9BQXhCLEVBQWlDbkIsU0FBakMsRUFBNENDLE9BQTVDLENBQVA7T0FERjs7OztTQU1JZ0gsVUFBVSxFQUFsQixFQUFzQjtZQUNabEgsSUFBUixHQUFlLElBQWY7V0FDTyxJQUFJRCxNQUFKLENBQVdtSCxPQUFYLENBQVA7O09BRUksRUFBRXhILGFBQUYsRUFBaUJ1RCxLQUFqQixFQUF3QnRELE9BQXhCLEVBQU4sRUFBeUM7VUFDakNTLFlBQVksQ0FBQzZDLEtBQUQsQ0FBbEI7UUFDSWpDLE9BQU90QixhQUFYO1dBQ09zQixTQUFTLElBQWhCLEVBQXNCO2dCQUNWaUgsT0FBVixDQUFrQmpILEtBQUtpQyxLQUF2QjthQUNPakMsS0FBS3RCLGFBQVo7O1NBRUcsSUFBSXdJLGFBQVQsSUFBMEIsS0FBS1IsT0FBL0IsRUFBd0M7WUFDaENTLFlBQVksS0FBS1QsT0FBTCxDQUFhUSxhQUFiLENBQWxCO1VBQ0lDLFVBQVV4RSxNQUFWLENBQWlCeUUscUJBQWpCLENBQXVDaEksU0FBdkMsQ0FBSixFQUF1RDtlQUM5QytILFVBQVVuRSxJQUFWLENBQWUsRUFBRXRFLGFBQUYsRUFBaUJ1RCxLQUFqQixFQUF3QnRELE9BQXhCLEVBQWYsQ0FBUDs7O1dBR0csSUFBSSxLQUFLcUMsUUFBTCxDQUFjQyxjQUFsQixDQUFpQyxFQUFFdkMsYUFBRixFQUFpQnVELEtBQWpCLEVBQXdCdEQsT0FBeEIsRUFBakMsQ0FBUDs7O1dBR1EsRUFBRTBJLFNBQUYsRUFBYS9ILFFBQWIsRUFBdUIwRyxVQUF2QixFQUFWLEVBQStDO1FBQ3pDLEtBQUtVLE9BQUwsQ0FBYXBILFFBQWIsQ0FBSixFQUE0QjthQUNuQixLQUFLb0gsT0FBTCxDQUFhcEgsUUFBYixDQUFQOztTQUVHb0gsT0FBTCxDQUFhcEgsUUFBYixJQUF5QixJQUFJK0gsU0FBSixDQUFjLEVBQUVySSxNQUFNLElBQVIsRUFBY00sUUFBZCxFQUF3QjBHLFVBQXhCLEVBQWQsQ0FBekI7V0FDTyxLQUFLVSxPQUFMLENBQWFwSCxRQUFiLENBQVA7OzsyQkFHRixDQUFpQztXQUFBO2VBRXBCbUgsS0FBS2EsT0FBTCxDQUFhQyxRQUFRbkYsSUFBckIsQ0FGb0I7d0JBR1gsSUFIVztvQkFJZjtNQUNkLEVBTEosRUFLUTs7OztZQUNBb0YsU0FBU0QsUUFBUUUsSUFBUixHQUFlLE9BQTlCO1VBQ0lELFVBQVUsRUFBZCxFQUFrQjtZQUNaRSxhQUFKLEVBQW1CO2tCQUNUdkcsSUFBUixDQUFjLHNCQUFxQnFHLE1BQU8scUJBQTFDO1NBREYsTUFFTztnQkFDQyxJQUFJNUcsS0FBSixDQUFXLEdBQUU0RyxNQUFPLDhFQUFwQixDQUFOOzs7OztVQUtBRyxPQUFPLE1BQU0sSUFBSUMsT0FBSixDQUFZLFVBQUNDLE9BQUQsRUFBVUMsTUFBVixFQUFxQjtZQUM1Q0MsU0FBUyxJQUFJLE1BQUt2QixVQUFULEVBQWI7ZUFDT3dCLE1BQVAsR0FBZ0IsWUFBTTtrQkFDWkQsT0FBT0UsTUFBZjtTQURGO2VBR09DLFVBQVAsQ0FBa0JYLE9BQWxCLEVBQTJCWSxRQUEzQjtPQUxlLENBQWpCO2FBT08sTUFBS0MsMkJBQUwsQ0FBaUM7YUFDakNiLFFBQVF4RSxJQUR5QjttQkFFM0JzRixxQkFBcUI1QixLQUFLNkIsU0FBTCxDQUFlZixRQUFRbkYsSUFBdkIsQ0FGTTs7T0FBakMsQ0FBUDs7OzZCQU1GLENBQW1DO09BQUE7Z0JBRXJCLEtBRnFCOztHQUFuQyxFQUlHOzs7O1VBQ0crQyxHQUFKO1VBQ0ksT0FBS3dCLGVBQUwsQ0FBcUIyQixTQUFyQixDQUFKLEVBQXFDO2NBQzdCQyxRQUFRQyxJQUFSLENBQWFiLElBQWIsRUFBbUIsRUFBRXZGLE1BQU1rRyxTQUFSLEVBQW5CLENBQU47WUFDSUEsY0FBYyxLQUFkLElBQXVCQSxjQUFjLEtBQXpDLEVBQWdEO2lCQUN2Q25ELElBQUlzRCxPQUFYOztPQUhKLE1BS08sSUFBSUgsY0FBYyxLQUFsQixFQUF5QjtjQUN4QixJQUFJMUgsS0FBSixDQUFVLGVBQVYsQ0FBTjtPQURLLE1BRUEsSUFBSTBILGNBQWMsS0FBbEIsRUFBeUI7Y0FDeEIsSUFBSTFILEtBQUosQ0FBVSxlQUFWLENBQU47T0FESyxNQUVBO2NBQ0MsSUFBSUEsS0FBSixDQUFXLCtCQUE4QjBILFNBQVUsRUFBbkQsQ0FBTjs7YUFFSyxPQUFLSSxtQkFBTCxDQUF5QnJFLEdBQXpCLEVBQThCYyxHQUE5QixDQUFQOzs7cUJBRUYsQ0FBMkJkLEdBQTNCLEVBQWdDYyxHQUFoQyxFQUFxQzs7OzthQUM5QmxDLElBQUwsQ0FBVW9CLEdBQVYsSUFBaUJjLEdBQWpCO2FBQ08sT0FBS3dELFFBQUwsQ0FBYztrQkFDUixnQkFBZXRFLEdBQUksYUFEWDttQkFFUixPQUFLeUMsVUFBTCxDQUFnQmYsZ0JBRlI7b0JBR1AsQ0FBRTFCLEdBQUY7T0FIUCxDQUFQOzs7O21CQU9nQkEsR0FBbEIsRUFBdUI7V0FDZCxLQUFLcEIsSUFBTCxDQUFVb0IsR0FBVixDQUFQOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUMxSUosSUFBSXJGLE9BQU8sSUFBSXVILElBQUosQ0FBU3FDLE9BQU9wQyxVQUFoQixDQUFYO0FBQ0F4SCxLQUFLNkosT0FBTCxHQUFlQyxJQUFJRCxPQUFuQjs7OzsifQ==
