import mime from 'mime-types';
import datalib from 'datalib';

const TriggerableMixin = function (superclass) {
  return class extends superclass {
    constructor() {
      super(...arguments);
      this._instanceOfTriggerableMixin = true;
      this._eventHandlers = {};
      this._stickyTriggers = {};
    }

    on(eventName, callback) {
      let [event, namespace] = eventName.split(':');
      this._eventHandlers[event] = this._eventHandlers[event] || {
        '': []
      };

      if (!namespace) {
        this._eventHandlers[event][''].push(callback);
      } else {
        this._eventHandlers[event][namespace] = callback;
      }
    }

    off(eventName, callback) {
      let [event, namespace] = eventName.split(':');

      if (this._eventHandlers[event]) {
        if (!namespace) {
          if (!callback) {
            this._eventHandlers[event][''] = [];
          } else {
            let index = this._eventHandlers[event][''].indexOf(callback);

            if (index >= 0) {
              this._eventHandlers[event][''].splice(index, 1);
            }
          }
        } else {
          delete this._eventHandlers[event][namespace];
        }
      }
    }

    trigger(event, ...args) {
      const handleCallback = callback => {
        setTimeout(() => {
          // Add timeout to prevent blocking
          callback.apply(this, args);
        }, 0);
      };

      if (this._eventHandlers[event]) {
        for (const namespace of Object.keys(this._eventHandlers[event])) {
          if (namespace === '') {
            this._eventHandlers[event][''].forEach(handleCallback);
          } else {
            handleCallback(this._eventHandlers[event][namespace]);
          }
        }
      }
    }

    stickyTrigger(eventName, argObj, delay = 10) {
      this._stickyTriggers[eventName] = this._stickyTriggers[eventName] || {
        argObj: {}
      };
      Object.assign(this._stickyTriggers[eventName].argObj, argObj);
      clearTimeout(this._stickyTriggers.timeout);
      this._stickyTriggers.timeout = setTimeout(() => {
        let argObj = this._stickyTriggers[eventName].argObj;
        delete this._stickyTriggers[eventName];
        this.trigger(eventName, argObj);
      }, delay);
    }

  };
};

Object.defineProperty(TriggerableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfTriggerableMixin
});

function _asyncIterator(iterable) {
  var method;

  if (typeof Symbol === "function") {
    if (Symbol.asyncIterator) {
      method = iterable[Symbol.asyncIterator];
      if (method != null) return method.call(iterable);
    }

    if (Symbol.iterator) {
      method = iterable[Symbol.iterator];
      if (method != null) return method.call(iterable);
    }
  }

  throw new TypeError("Object is not async iterable");
}

function _AwaitValue(value) {
  this.wrapped = value;
}

function _AsyncGenerator(gen) {
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
      var wrappedAwait = value instanceof _AwaitValue;
      Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) {
        if (wrappedAwait) {
          resume("next", arg);
          return;
        }

        settle(result.done ? "return" : "normal", arg);
      }, function (err) {
        resume("throw", err);
      });
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
  _AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
    return this;
  };
}

_AsyncGenerator.prototype.next = function (arg) {
  return this._invoke("next", arg);
};

_AsyncGenerator.prototype.throw = function (arg) {
  return this._invoke("throw", arg);
};

_AsyncGenerator.prototype.return = function (arg) {
  return this._invoke("return", arg);
};

function _wrapAsyncGenerator(fn) {
  return function () {
    return new _AsyncGenerator(fn.apply(this, arguments));
  };
}

function _awaitAsyncGenerator(value) {
  return new _AwaitValue(value);
}

function _asyncGeneratorDelegate(inner, awaitWrap) {
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

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this.index = options.index;
    this.table = options.table;

    if (this.index === undefined || !this.table) {
      throw new Error(`index and table are required`);
    }

    this.classObj = options.classObj || null;
    this.row = options.row || {};
    this.connectedItems = options.connectedItems || {};
    this.duplicateItems = options.duplicateItems || [];
  }

  registerDuplicate(item) {
    this.duplicateItems.push(item);
  }

  connectItem(item) {
    this.connectedItems[item.table.tableId] = this.connectedItems[item.table.tableId] || [];

    if (this.connectedItems[item.table.tableId].indexOf(item) === -1) {
      this.connectedItems[item.table.tableId].push(item);
    }

    for (const dup of this.duplicateItems) {
      item.connectItem(dup);
      dup.connectItem(item);
    }
  }

  disconnect() {
    for (const itemList of Object.values(this.connectedItems)) {
      for (const item of itemList) {
        const index = (item.connectedItems[this.table.tableId] || []).indexOf(this);

        if (index !== -1) {
          item.connectedItems[this.table.tableId].splice(index, 1);
        }
      }
    }

    this.connectedItems = {};
  }

  get instanceId() {
    return `{"classId":"${this.classObj.classId}","index":"${this.index}"}`;
  }

  get exportId() {
    return `${this.classObj.classId}_${this.index}`;
  }

  equals(item) {
    return this.instanceId === item.instanceId;
  }

  handleLimit(options, iterators) {
    return _wrapAsyncGenerator(function* () {
      let limit = Infinity;

      if (options.limit !== undefined) {
        limit = options.limit;
        delete options.limit;
      }

      let i = 0;

      for (const iterator of iterators) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(iterator), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const item = _value;
            yield item;
            i++;

            if (item === null || i >= limit) {
              return;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
              yield _awaitAsyncGenerator(_iterator.return());
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }
    })();
  }

  iterateAcrossConnections(tableIds) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // First make sure that all the table caches have been fully built and
      // connected
      yield _awaitAsyncGenerator(Promise.all(tableIds.map(tableId => {
        return _this.classObj.model.tables[tableId].buildCache();
      })));
      yield* _asyncGeneratorDelegate(_asyncIterator(_this._iterateAcrossConnections(tableIds)), _awaitAsyncGenerator);
    })();
  }

  *_iterateAcrossConnections(tableIds) {
    if (this.reset) {
      return;
    }

    const nextTableId = tableIds[0];

    if (tableIds.length === 1) {
      yield* this.connectedItems[nextTableId] || [];
    } else {
      const remainingTableIds = tableIds.slice(1);

      for (const item of this.connectedItems[nextTableId] || []) {
        yield* item._iterateAcrossConnections(remainingTableIds);
      }
    }
  }

}

Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return /(.*)Wrapper/.exec(this.name)[1];
  }

});

class Table extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this.model = options.model;
    this.tableId = options.tableId;

    if (!this.model || !this.tableId) {
      throw new Error(`model and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};
    this._derivedTables = options.derivedTables || {};
    this._derivedAttributeFunctions = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions || {})) {
      this._derivedAttributeFunctions[attr] = this.hydrateFunction(stringifiedFunc);
    }

    this._suppressedAttributes = options.suppressedAttributes || {};
    this._suppressIndex = !!options.suppressIndex;
    this._indexFilter = options.indexFilter && this.hydrateFunction(options.indexFilter) || null;
    this._attributeFilters = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.attributeFilters || {})) {
      this._attributeFilters[attr] = this.hydrateFunction(stringifiedFunc);
    }

    this._limitPromises = {};
  }

  _toRawObject() {
    const result = {
      tableId: this.tableId,
      attributes: this._attributes,
      derivedTables: this._derivedTables,
      derivedAttributeFunctions: {},
      suppressedAttributes: this._suppressedAttributes,
      suppressIndex: this._suppressIndex,
      attributeFilters: {},
      indexFilter: this._indexFilter && this.dehydrateFunction(this._indexFilter) || null
    };

    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this.dehydrateFunction(func);
    }

    for (const [attr, func] of Object.entries(this._attributeFilters)) {
      result.attributeFilters[attr] = this.dehydrateFunction(func);
    }

    return result;
  }

  getSortHash() {
    return this.type;
  }

  hydrateFunction(stringifiedFunc) {
    return new Function(`return ${stringifiedFunc}`)(); // eslint-disable-line no-new-func
  }

  dehydrateFunction(func) {
    let stringifiedFunc = func.toString(); // Istanbul adds some code to functions for computing coverage, that gets
    // included in the stringification process during testing. See:
    // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022

    stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
    return stringifiedFunc;
  }

  iterate(limit = Infinity) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      if (_this._cache) {
        // The cache has already been built; just grab data from it directly
        yield* _asyncGeneratorDelegate(_asyncIterator(_this._cache.slice(0, limit)), _awaitAsyncGenerator);
      } else if (_this._partialCache && _this._partialCache.length >= limit) {
        // The cache isn't finished, but it's already long enough to satisfy this
        // request
        yield* _asyncGeneratorDelegate(_asyncIterator(_this._partialCache.slice(0, limit)), _awaitAsyncGenerator);
      } else {
        // The cache isn't finished building (and maybe didn't even start yet);
        // kick it off, and then wait for enough items to be processed to satisfy
        // the limit
        _this.buildCache();

        yield* _asyncGeneratorDelegate(_asyncIterator((yield _awaitAsyncGenerator(new Promise((resolve, reject) => {
          _this._limitPromises[limit] = _this._limitPromises[limit] || [];

          _this._limitPromises[limit].push({
            resolve,
            reject
          });
        })))), _awaitAsyncGenerator);
      }
    })();
  }

  _iterate(options) {
    return _wrapAsyncGenerator(function* () {
      throw new Error(`this function should be overridden`);
    })();
  }

  async _buildCache(resolve, reject) {
    this._partialCache = [];
    this._partialCacheLookup = {};

    const iterator = this._iterate();

    let i = 0;
    let temp = {
      done: false
    };

    while (!temp.done) {
      temp = await iterator.next();

      if (!this._partialCache || temp === null) {
        // reset() was called before we could finish; we need to let everyone
        // that was waiting on us know that we can't comply
        this.handleReset(reject);
        return;
      }

      if (!temp.done) {
        if (await this._finishItem(temp.value)) {
          // Okay, this item passed all filters, and is ready to be sent out
          // into the world
          this._partialCacheLookup[temp.value.index] = this._partialCache.length;

          this._partialCache.push(temp.value);

          i++;

          for (let limit of Object.keys(this._limitPromises)) {
            limit = Number(limit); // check if we have enough data now to satisfy any waiting requests

            if (limit <= i) {
              for (const {
                resolve
              } of this._limitPromises[limit]) {
                resolve(this._partialCache.slice(0, limit));
              }

              delete this._limitPromises[limit];
            }
          }
        }
      }
    } // Done iterating! We can graduate the partial cache / lookups into
    // finished ones, and satisfy all the requests


    this._cache = this._partialCache;
    delete this._partialCache;
    this._cacheLookup = this._partialCacheLookup;
    delete this._partialCacheLookup;

    for (let limit of Object.keys(this._limitPromises)) {
      limit = Number(limit);

      for (const {
        resolve
      } of this._limitPromises[limit]) {
        resolve(this._cache.slice(0, limit));
      }

      delete this._limitPromises[limit];
    }

    delete this._cachePromise;
    this.trigger('cacheBuilt');
    resolve(this._cache);
  }

  buildCache() {
    if (this._cache) {
      return this._cache;
    } else if (!this._cachePromise) {
      this._cachePromise = new Promise((resolve, reject) => {
        // The setTimeout here is absolutely necessary, or this._cachePromise
        // won't be stored in time for the next buildCache() call that comes
        // through
        setTimeout(() => {
          this._buildCache(resolve, reject);
        }, 0);
      });
    }

    return this._cachePromise;
  }

  reset() {
    const itemsToReset = (this._cache || []).concat(this._partialCache || []);

    for (const item of itemsToReset) {
      item.reset = true;
    }

    delete this._cache;
    delete this._cacheLookup;
    delete this._partialCache;
    delete this._partialCacheLookup;
    delete this._cachePromise;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  handleReset(reject) {
    for (const limit of Object.keys(this._limitPromises)) {
      this._limitPromises[limit].reject();

      delete this._limitPromises;
    }

    reject();
  }

  async countRows() {
    return (await this.buildCache()).length;
  }

  async _finishItem(wrappedItem) {
    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      wrappedItem.row[attr] = func(wrappedItem);

      if (wrappedItem.row[attr] instanceof Promise) {
        (async () => {
          wrappedItem.delayedRow = wrappedItem.delayedRow || {};
          wrappedItem.delayedRow[attr] = await wrappedItem.row[attr];
        })();
      }
    }

    for (const attr in wrappedItem.row) {
      this._observedAttributes[attr] = true;
    }

    for (const attr in this._suppressedAttributes) {
      delete wrappedItem.row[attr];
    }

    let keep = true;

    if (this._indexFilter) {
      keep = this._indexFilter(wrappedItem.index);
    }

    for (const func of Object.values(this._attributeFilters)) {
      keep = keep && (await func(wrappedItem));

      if (!keep) {
        break;
      }
    }

    if (keep) {
      wrappedItem.trigger('finish');
    } else {
      wrappedItem.disconnect();
      wrappedItem.trigger('filter');
    }

    return keep;
  }

  _wrap(options) {
    options.table = this;
    const classObj = this.classObj;
    const wrappedItem = classObj ? classObj._wrap(options) : new GenericWrapper(options);

    for (const otherItem of options.itemsToConnect || []) {
      wrappedItem.connectItem(otherItem);
      otherItem.connectItem(wrappedItem);
    }

    return wrappedItem;
  }

  get name() {
    throw new Error(`this function should be overridden`);
  }

  getIndexDetails() {
    const details = {
      name: null
    };

    if (this._suppressIndex) {
      details.suppressed = true;
    }

    if (this._indexFilter) {
      details.filtered = true;
    }

    return details;
  }

  getAttributeDetails() {
    const allAttrs = {};

    for (const attr in this._expectedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].expected = true;
    }

    for (const attr in this._observedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].observed = true;
    }

    for (const attr in this._derivedAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].derived = true;
    }

    for (const attr in this._suppressedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].suppressed = true;
    }

    for (const attr in this._attributeFilters) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].filtered = true;
    }

    return allAttrs;
  }

  get attributes() {
    return Object.keys(this.getAttributeDetails());
  }

  get currentData() {
    // Allow probing to see whatever data happens to be available
    return {
      data: this._cache || this._partialCache || [],
      lookup: this._cacheLookup || this._partialCacheLookup || {},
      complete: !!this._cache
    };
  }

  async getItem(index = null) {
    if (this._cacheLookup) {
      return index === null ? this._cache[0] : this._cache[this._cacheLookup[index]];
    } else if (this._partialCacheLookup && (index === null && this._partialCache.length > 0 || this._partialCacheLookup[index] !== undefined)) {
      return index === null ? this._partialCache[0] : this._partialCache[this._partialCacheLookup[index]];
    } // Stupid approach when the cache isn't built: interate until we see the
    // index. Subclasses could override this


    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;

    var _iteratorError;

    try {
      for (var _iterator = _asyncIterator(this.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
        const item = _value;

        if (item === null || item.index === index) {
          return item;
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return != null) {
          await _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    return null;
  }

  deriveAttribute(attribute, func) {
    this._derivedAttributeFunctions[attribute] = func;
    this.reset();
    this.model.trigger('update');
  }

  suppressAttribute(attribute) {
    if (attribute === null) {
      this._suppressIndex = true;
    } else {
      this._suppressedAttributes[attribute] = true;
    }

    this.reset();
    this.model.trigger('update');
  }

  addFilter(func, attribute = null) {
    if (attribute === null) {
      this._indexFilter = func;
    } else {
      this._attributeFilters[attribute] = func;
    }

    this.reset();
    this.model.trigger('update');
  }

  _deriveTable(options) {
    const newTable = this.model.createTable(options);
    this._derivedTables[newTable.tableId] = true;
    this.model.trigger('update');
    return newTable;
  }

  _getExistingTable(options) {
    // Check if the derived table has already been defined
    const existingTable = this.derivedTables.find(tableObj => {
      return Object.entries(options).every(([optionName, optionValue]) => {
        if (optionName === 'type') {
          return tableObj.constructor.name === optionValue;
        } else {
          return tableObj['_' + optionName] === optionValue;
        }
      });
    });
    return existingTable && this.model.tables[existingTable.tableId] || null;
  }

  promote(attribute) {
    const options = {
      type: 'PromotedTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  expand(attribute) {
    const options = {
      type: 'ExpandedTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  unroll(attribute) {
    const options = {
      type: 'UnrolledTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  closedFacet(attribute, values) {
    return values.map(value => {
      const options = {
        type: 'FacetedTable',
        attribute,
        value
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }

  openFacet(attribute, limit = Infinity) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      const values = {};
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this2.iterate(limit)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedItem = _value2;
          const value = yield _awaitAsyncGenerator(wrappedItem.row[attribute]);

          if (!values[value]) {
            values[value] = true;
            const options = {
              type: 'FacetedTable',
              attribute,
              value
            };
            yield _this2._getExistingTable(options) || _this2._deriveTable(options);
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            yield _awaitAsyncGenerator(_iterator2.return());
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    })();
  }

  closedTranspose(indexes) {
    return indexes.map(index => {
      const options = {
        type: 'TransposedTable',
        index
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }

  openTranspose(limit = Infinity) {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator(_this3.iterate(limit)), _step3, _value3; _step3 = yield _awaitAsyncGenerator(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
          const wrappedItem = _value3;
          const options = {
            type: 'TransposedTable',
            index: wrappedItem.index
          };
          yield _this3._getExistingTable(options) || _this3._deriveTable(options);
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
            yield _awaitAsyncGenerator(_iterator3.return());
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }
    })();
  }

  duplicate() {
    return this._deriveTable({
      type: 'DuplicatedTable'
    });
  }

  connect(otherTableList, type = 'ConnectedTable') {
    const newTable = this.model.createTable({
      type
    });
    this._derivedTables[newTable.tableId] = true;

    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this.model.trigger('update');
    return newTable;
  }

  project(tableIds) {
    const newTable = this.model.createTable({
      type: 'ProjectedTable',
      tableOrder: [this.tableId].concat(tableIds)
    });
    this._derivedTables[newTable.tableId] = true;

    for (const otherTableId of tableIds) {
      const otherTable = this.model.tables[otherTableId];
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this.model.trigger('update');
    return newTable;
  }

  get classObj() {
    return Object.values(this.model.classes).find(classObj => {
      return classObj.table === this;
    });
  }

  get parentTables() {
    return Object.values(this.model.tables).reduce((agg, tableObj) => {
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }

      return agg;
    }, []);
  }

  get derivedTables() {
    return Object.keys(this._derivedTables).map(tableId => {
      return this.model.tables[tableId];
    });
  }

  get inUse() {
    if (Object.keys(this._derivedTables).length > 0) {
      return true;
    }

    return Object.values(this.model.classes).some(classObj => {
      return classObj.tableId === this.tableId || classObj.sourceTableIds.indexOf(this.tableId) !== -1 || classObj.targetTableIds.indexOf(this.tableId) !== -1;
    });
  }

  delete(force = false) {
    if (!force && this.inUse) {
      const err = new Error(`Can't delete in-use table ${this.tableId}`);
      err.inUse = true;
      throw err;
    }

    for (const parentTable of this.parentTables) {
      delete parentTable._derivedTables[this.tableId];
    }

    delete this.model.tables[this.tableId];
    this.model.trigger('update');
  }

}

Object.defineProperty(Table, 'type', {
  get() {
    return /(.*)Table/.exec(this.name)[1];
  }

});

class StaticTable extends Table {
  constructor(options) {
    super(options);
    this._name = options.name;
    this._data = options.data || [];

    if (!this._name || !this._data) {
      throw new Error(`name and data are required`);
    }
  }

  get name() {
    return this._name;
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.name = this._name;
    obj.data = this._data;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this._name;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (let index = 0; index < _this._data.length; index++) {
        const item = _this._wrap({
          index,
          row: _this._data[index]
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(item))) {
          yield item;
        }
      }
    })();
  }

}

class StaticDictTable extends Table {
  constructor(options) {
    super(options);
    this._name = options.name;
    this._data = options.data || {};

    if (!this._name || !this._data) {
      throw new Error(`name and data are required`);
    }
  }

  get name() {
    return this._name;
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.name = this._name;
    obj.data = this._data;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this._name;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (const [index, row] of Object.entries(_this._data)) {
        const item = _this._wrap({
          index,
          row
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(item))) {
          yield item;
        }
      }
    })();
  }

}

const SingleParentMixin = function (superclass) {
  return class extends superclass {
    constructor(options) {
      super(options);
      this._instanceOfSingleParentMixin = true;
    }

    get parentTable() {
      const parentTables = this.parentTables;

      if (parentTables.length === 0) {
        throw new Error(`Parent table is required for table of type ${this.type}`);
      } else if (parentTables.length > 1) {
        throw new Error(`Only one parent table allowed for table of type ${this.type}`);
      }

      return parentTables[0];
    }

  };
};

Object.defineProperty(SingleParentMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfSingleParentMixin
});

const AttrTableMixin = function (superclass) {
  return class extends SingleParentMixin(superclass) {
    constructor(options) {
      super(options);
      this._instanceOfAttrTableMixin = true;
      this._attribute = options.attribute;

      if (!this._attribute) {
        throw new Error(`attribute is required`);
      }
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.attribute = this._attribute;
      return obj;
    }

    getSortHash() {
      return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
    }

    get name() {
      return this._attribute;
    }

  };
};

Object.defineProperty(AttrTableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfAttrTableMixin
});

class PromotedTable extends AttrTableMixin(Table) {
  async _buildCache(resolve, reject) {
    // We override _buildCache because we don't actually want to call _finishItem
    // until all unique values have been seen
    this._unfinishedCache = [];
    this._unfinishedCacheLookup = {};
    this._partialCache = [];
    this._partialCacheLookup = {};

    const iterator = this._iterate();

    let temp = {
      done: false
    };

    while (!temp.done) {
      temp = await iterator.next();

      if (!this._partialCache || temp === null) {
        // reset() was called before we could finish; we need to let everyone
        // that was waiting on us know that we can't comply
        this.handleReset(reject);
        return;
      }

      if (!temp.done) {
        this._unfinishedCacheLookup[temp.value.index] = this._unfinishedCache.length;

        this._unfinishedCache.push(temp.value);
      }
    } // Okay, now we've seen everything; we can call _finishItem on each of the
    // unique values


    let i = 0;

    for (const value of this._unfinishedCache) {
      if (await this._finishItem(value)) {
        // Okay, this item passed all filters, and is ready to be sent out
        // into the world
        this._partialCacheLookup[value.index] = this._partialCache.length;

        this._partialCache.push(value);

        i++;

        for (let limit of Object.keys(this._limitPromises)) {
          limit = Number(limit); // check if we have enough data now to satisfy any waiting requests

          if (limit <= i) {
            for (const {
              resolve
            } of this._limitPromises[limit]) {
              resolve(this._partialCache.slice(0, limit));
            }

            delete this._limitPromises[limit];
          }
        }
      }
    } // Done iterating! We can graduate the partial cache / lookups into
    // finished ones, and satisfy all the requests


    delete this._unfinishedCache;
    delete this._unfinishedCacheLookup;
    this._cache = this._partialCache;
    delete this._partialCache;
    this._cacheLookup = this._partialCacheLookup;
    delete this._partialCacheLookup;

    for (let limit of Object.keys(this._limitPromises)) {
      limit = Number(limit);

      for (const {
        resolve
      } of this._limitPromises[limit]) {
        resolve(this._cache.slice(0, limit));
      }

      delete this._limitPromises[limit];
    }

    delete this._cachePromise;
    this.trigger('cacheBuilt');
    resolve(this._cache);
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const index = String((yield _awaitAsyncGenerator(wrappedParent.row[_this._attribute])));

          if (!_this._partialCache) {
            // We were reset!
            return;
          } else if (_this._unfinishedCacheLookup[index] !== undefined) {
            const existingItem = _this._unfinishedCache[_this._unfinishedCacheLookup[index]];
            existingItem.connectItem(wrappedParent);
            wrappedParent.connectItem(existingItem);
          } else {
            const newItem = _this._wrap({
              index,
              itemsToConnect: [wrappedParent]
            });

            yield newItem;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class FacetedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;
    this._value = options.value;

    if (!this._attribute || !this._value === undefined) {
      throw new Error(`attribute and value are required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.value = this._value;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this._attribute + this._value;
  }

  get name() {
    return String(this._value);
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let index = 0;
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if ((yield _awaitAsyncGenerator(wrappedParent.row[_this._attribute])) === _this._value) {
            // Normal faceting just gives a subset of the original table
            const newItem = _this._wrap({
              index,
              row: Object.assign({}, wrappedParent.row),
              itemsToConnect: [wrappedParent]
            });

            if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
              yield newItem;
            }

            index++;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class TransposedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._index = options.index;

    if (this._index === undefined) {
      throw new Error(`index is required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.index = this._index;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash() + this._index;
  }

  get name() {
    return `${this._index}`;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Pre-build the parent table's cache
      yield _awaitAsyncGenerator(_this.parentTable.buildCache()); // Iterate the row's attributes as indexes

      const wrappedParent = _this.parentTable._cache[_this.parentTable._cacheLookup[_this._index]] || {
        row: {}
      };

      for (const [index, value] of Object.entries(wrappedParent.row)) {
        const newItem = _this._wrap({
          index,
          row: typeof value === 'object' ? value : {
            value
          },
          itemsToConnect: [wrappedParent]
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
          yield newItem;
        }
      }
    })();
  }

}

class ConnectedTable extends Table {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('=');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join('=');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTables = _this.parentTables; // Don't try to connect values until all of the parent tables' caches are
      // built; TODO: might be able to do something more responsive here?

      yield _awaitAsyncGenerator(Promise.all(parentTables.map(pTable => pTable.buildCache()))); // Now that the caches are built, just iterate their keys directly. We only
      // care about including rows that have exact matches across all tables, so
      // we can just pick one parent table to iterate

      const baseParentTable = parentTables[0];
      const otherParentTables = parentTables.slice(1);

      for (const index in baseParentTable._cacheLookup) {
        if (!parentTables.every(table => table._cacheLookup)) {
          // One of the parent tables was reset
          _this.reset();

          return;
        }

        if (!otherParentTables.every(table => table._cacheLookup[index] !== undefined)) {
          // No match in one of the other tables; omit this item
          continue;
        } // TODO: add each parent tables' keys as attribute values


        const newItem = _this._wrap({
          index,
          itemsToConnect: parentTables.map(table => table._cache[table._cacheLookup[index]])
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
          yield newItem;
        }
      }
    })();
  }

}

class DuplicatedTable extends SingleParentMixin(Table) {
  get name() {
    return this.parentTable.name;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash();
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Yield the same items with the same connections, but wrapped and finished
      // by this table
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this.parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const item = _value;

          const newItem = _this._wrap({
            index: item.index,
            row: item.row,
            itemsToConnect: Object.values(item.connectedItems).reduce((agg, itemList) => {
              return agg.concat(itemList);
            }, [])
          });

          item.registerDuplicate(newItem);

          if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
            yield newItem;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

const ChildTableMixin = function (superclass) {
  return class extends AttrTableMixin(superclass) {
    constructor(options) {
      super(options);
      this._instanceOfChildTableMixin = true;
    }

    _wrap(options) {
      const newItem = super._wrap(options);

      newItem.parentIndex = options.parentIndex;
      return newItem;
    }

  };
};

Object.defineProperty(ChildTableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfChildTableMixin
});

class ExpandedTable extends ChildTableMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
  }

  get name() {
    return this._attribute;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this.parentTable;
      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const row = wrappedParent.row[_this._attribute];

          if (row !== undefined && row !== null && Object.keys(row).length > 0) {
            const newItem = _this._wrap({
              index,
              row,
              itemsToConnect: [wrappedParent],
              parentIndex: wrappedParent.index
            });

            if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
              yield newItem;
              index++;
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class UnrolledTable extends ChildTableMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
  }

  get name() {
    return this._attribute;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this.parentTable;
      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const rows = wrappedParent.row[_this._attribute];

          if (rows !== undefined && rows !== null && typeof rows[Symbol.iterator] === 'function') {
            for (const row of rows) {
              const newItem = _this._wrap({
                index,
                row,
                itemsToConnect: [wrappedParent],
                parentIndex: wrappedParent.index
              });

              if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
                yield newItem;
                index++;
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class ParentChildTable extends Table {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('/');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join(',');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let parentTable, childTable;

      if (_this.parentTables[0].parentTable === _this.parentTables[1]) {
        parentTable = _this.parentTables[1];
        childTable = _this.parentTables[0];
      } else if (_this.parentTables[1].parentTable === _this.parentTables[0]) {
        parentTable = _this.parentTables[0];
        childTable = _this.parentTables[1];
      } else {
        throw new Error(`ParentChildTable not set up properly`);
      }

      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(childTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const child = _value;
          const parent = yield _awaitAsyncGenerator(parentTable.getItem(child.parentIndex));

          const newItem = _this._wrap({
            index,
            itemsToConnect: [parent, child]
          });

          if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
            yield newItem;
            index++;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class ProjectedTable extends Table {
  constructor(options) {
    super(options);
    this.tableOrder = options.tableOrder;

    if (!this.tableOrder) {
      throw new Error(`tableOrder is required`);
    }
  }

  get name() {
    return this.tableOrder.map(tableId => this.model.tables[tableId].name).join('⨯');
  }

  getSortHash() {
    return super.getSortHash() + this.tableOrder.map(tableId => this.model.tables[tableId].getSortHash()).join('⨯');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const self = _this;
      const firstTable = _this.model.tables[_this.tableOrder[0]];

      const remainingIds = _this.tableOrder.slice(1);

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(firstTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const sourceItem = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator(sourceItem.iterateAcrossConnections(remainingIds)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const lastItem = _value2;

              const newItem = _this._wrap({
                index: sourceItem.index + '⨯' + lastItem.index,
                itemsToConnect: [sourceItem, lastItem]
              });

              if (yield _awaitAsyncGenerator(self._finishItem(newItem))) {
                yield newItem;
              }
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                yield _awaitAsyncGenerator(_iterator2.return());
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
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  PromotedTable: PromotedTable,
  FacetedTable: FacetedTable,
  ConnectedTable: ConnectedTable,
  TransposedTable: TransposedTable,
  DuplicatedTable: DuplicatedTable,
  ExpandedTable: ExpandedTable,
  UnrolledTable: UnrolledTable,
  ParentChildTable: ParentChildTable,
  ProjectedTable: ProjectedTable
});

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this.model = options.model;
    this.classId = options.classId;
    this.tableId = options.tableId;

    if (!this.model || !this.classId || !this.tableId) {
      throw new Error(`model, classId, and tableId are required`);
    }

    this._className = options.className || null;
    this.annotations = options.annotations || {};
  }

  _toRawObject() {
    return {
      classId: this.classId,
      tableId: this.tableId,
      className: this._className,
      annotations: this.annotations
    };
  }

  getSortHash() {
    return this.type + this.className;
  }

  setClassName(value) {
    this._className = value;
    this.model.trigger('update');
  }

  get hasCustomName() {
    return this._className !== null;
  }

  get className() {
    return this._className || this.table.name;
  }

  get variableName() {
    return this.type.toLocaleLowerCase() + '_' + this.className.split(/\W+/g).filter(d => d.length > 0).map(d => d[0].toLocaleUpperCase() + d.slice(1)).join('');
  }

  get table() {
    return this.model.tables[this.tableId];
  }

  get deleted() {
    return !this.model.deleted && this.model.classes[this.classId];
  }

  _wrap(options) {
    options.classObj = this;
    return new GenericWrapper(options);
  }

  interpretAsNodes() {
    const options = this._toRawObject();

    options.type = 'NodeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }

  _deriveNewClass(newTable, type = this.constructor.name) {
    return this.model.createClass({
      tableId: newTable.tableId,
      type
    });
  }

  promote(attribute) {
    return this._deriveNewClass(this.table.promote(attribute).tableId, 'GenericClass');
  }

  expand(attribute) {
    return this._deriveNewClass(this.table.expand(attribute));
  }

  unroll(attribute) {
    return this._deriveNewClass(this.table.unroll(attribute));
  }

  closedFacet(attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this._deriveNewClass(newTable);
    });
  }

  openFacet(attribute) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this.table.openFacet(attribute)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const newTable = _value;
          yield _this._deriveNewClass(newTable);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }

  closedTranspose(indexes) {
    return this.table.closedTranspose(indexes).map(newTable => {
      return this._deriveNewClass(newTable);
    });
  }

  openTranspose() {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this2.table.openTranspose()), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const newTable = _value2;
          yield _this2._deriveNewClass(newTable);
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            yield _awaitAsyncGenerator(_iterator2.return());
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    })();
  }

  delete() {
    delete this.model.classes[this.classId];
    this.model.optimizeTables();
    this.model.trigger('update');
  }

}

Object.defineProperty(GenericClass, 'type', {
  get() {
    return /(.*)Class/.exec(this.name)[1];
  }

});

class NodeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  edges(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let edgeIds = options.classes ? options.classes.map(classObj => classObj.classId) : options.classIds || Object.keys(_this.classObj.edgeClassIds);
      const iterators = [];

      for (const edgeId of edgeIds) {
        if (!_this.classObj.edgeClassIds[edgeId]) {
          continue;
        }

        const edgeClass = _this.classObj.model.classes[edgeId];

        const role = _this.classObj.getEdgeRole(edgeClass);

        if (role === 'both' || role === 'source') {
          const tableIds = edgeClass.sourceTableIds.slice().reverse().concat([edgeClass.tableId]);
          iterators.push(_this.iterateAcrossConnections(tableIds));
        }

        if (role === 'both' || role === 'target') {
          const tableIds = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]);
          iterators.push(_this.iterateAcrossConnections(tableIds));
        }
      }

      yield* _asyncGeneratorDelegate(_asyncIterator(_this.handleLimit(options, iterators)), _awaitAsyncGenerator);
    })();
  }

}

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.edgeClassIds = options.edgeClassIds || {};
  }

  *edgeClasses() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      yield this.model.classes[edgeClassId];
    }
  }

  getEdgeRole(edgeClass) {
    if (!this.edgeClassIds[edgeClass.classId]) {
      return null;
    } else if (edgeClass.sourceClassId === this.classId) {
      if (edgeClass.targetClassId === this.classId) {
        return 'both';
      } else {
        return 'source';
      }
    } else if (edgeClass.targetClassId === this.classId) {
      return 'target';
    } else {
      throw new Error(`Internal mismatch between node and edge classIds`);
    }
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.edgeClassIds = this.edgeClassIds;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new NodeWrapper(options);
  }

  interpretAsNodes() {
    return this;
  }

  interpretAsEdges({
    autoconnect = false
  } = {}) {
    const edgeClassIds = Object.keys(this.edgeClassIds);

    const options = super._toRawObject();

    if (!autoconnect || edgeClassIds.length > 2) {
      // If there are more than two edges, break all connections and make
      // this a floating edge (for now, we're not dealing in hyperedges)
      this.disconnectAllEdges();
    } else if (autoconnect && edgeClassIds.length === 1) {
      // With only one connection, this node should become a self-edge
      const edgeClass = this.model.classes[edgeClassIds[0]]; // Are we the source or target of the existing edge (internally, in terms
      // of sourceId / targetId, not edgeClass.direction)?

      const isSource = edgeClass.sourceClassId === this.classId; // As we're converted to an edge, our new resulting source AND target
      // should be whatever is at the other end of edgeClass (if anything)

      if (isSource) {
        options.sourceClassId = options.targetClassId = edgeClass.targetClassId;
        edgeClass.disconnectSource();
      } else {
        options.sourceClassId = options.targetClassId = edgeClass.sourceClassId;
        edgeClass.disconnectTarget();
      } // If there is a node class on the other end of edgeClass, add our
      // id to its list of connections


      const nodeClass = this.model.classes[options.sourceClassId];

      if (nodeClass) {
        nodeClass.edgeClassIds[this.classId] = true;
      } // tableId lists should emanate out from the (new) edge table; assuming
      // (for a moment) that isSource === true, we'd construct the tableId list
      // like this:


      let tableIdList = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]).concat(edgeClass.sourceTableIds);

      if (!isSource) {
        // Whoops, got it backwards!
        tableIdList.reverse();
      }

      options.directed = edgeClass.directed;
      options.sourceTableIds = options.targetTableIds = tableIdList;
    } else if (autoconnect && edgeClassIds.length === 2) {
      // Okay, we've got two edges, so this is a little more straightforward
      let sourceEdgeClass = this.model.classes[edgeClassIds[0]];
      let targetEdgeClass = this.model.classes[edgeClassIds[1]]; // Figure out the direction, if there is one

      options.directed = false;

      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        if (sourceEdgeClass.targetClassId === this.classId && targetEdgeClass.sourceClassId === this.classId) {
          // We happened to get the edges in order; set directed to true
          options.directed = true;
        } else if (sourceEdgeClass.sourceClassId === this.classId && targetEdgeClass.targetClassId === this.classId) {
          // We got the edges backwards; swap them and set directed to true
          targetEdgeClass = this.model.classes[edgeClassIds[0]];
          sourceEdgeClass = this.model.classes[edgeClassIds[1]];
          options.directed = true;
        }
      } // Okay, now we know how to set source / target ids


      options.sourceClassId = sourceEdgeClass.sourceClassId;
      options.targetClassId = targetEdgeClass.targetClassId; // Add this class to the source's / target's edgeClassIds

      this.model.classes[options.sourceClassId].edgeClassIds[this.classId] = true;
      this.model.classes[options.targetClassId].edgeClassIds[this.classId] = true; // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table

      options.sourceTableIds = sourceEdgeClass.targetTableIds.slice().reverse().concat([sourceEdgeClass.tableId]).concat(sourceEdgeClass.sourceTableIds);

      if (sourceEdgeClass.targetClassId === this.classId) {
        options.sourceTableIds.reverse();
      }

      options.targetTableIds = targetEdgeClass.sourceTableIds.slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.targetTableIds);

      if (targetEdgeClass.targetClassId === this.classId) {
        options.targetTableIds.reverse();
      } // Disconnect the existing edge classes from the new (now edge) class


      this.disconnectAllEdges();
    }

    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }

  connectToNodeClass({
    otherNodeClass,
    attribute,
    otherAttribute
  }) {
    let thisHash, otherHash, sourceTableIds, targetTableIds;

    if (attribute === null) {
      thisHash = this.table;
      sourceTableIds = [];
    } else {
      thisHash = this.table.promote(attribute);
      sourceTableIds = [thisHash.tableId];
    }

    if (otherAttribute === null) {
      otherHash = otherNodeClass.table;
      targetTableIds = [];
    } else {
      otherHash = otherNodeClass.table.promote(otherAttribute);
      targetTableIds = [otherHash.tableId];
    }

    const connectedTable = thisHash.connect([otherHash]);
    const newEdgeClass = this.model.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceTableIds,
      targetClassId: otherNodeClass.classId,
      targetTableIds
    });
    this.edgeClassIds[newEdgeClass.classId] = true;
    otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;
    this.model.trigger('update');
    return newEdgeClass;
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    return edgeClass.connectToNodeClass(options);
  }

  promote(attribute) {
    const newNodeClass = this._deriveNewClass(this.table.promote(attribute), 'NodeClass');

    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
    return newNodeClass;
  }

  connectToChildNodeClass(childClass) {
    const connectedTable = this.table.connect([childClass.table], 'ParentChildTable');
    const newEdgeClass = this.model.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceTableIds: [],
      targetClassId: childClass.classId,
      targetTableIds: []
    });
    this.edgeClassIds[newEdgeClass.classId] = true;
    childClass.edgeClassIds[newEdgeClass.classId] = true;
    this.model.trigger('update');
  }

  expand(attribute) {
    const newNodeClass = this._deriveNewClass(this.table.expand(attribute), 'NodeClass');

    this.connectToChildNodeClass(newNodeClass);
    return newNodeClass;
  }

  unroll(attribute) {
    const newNodeClass = this._deriveNewClass(this.table.unroll(attribute), 'NodeClass');

    this.connectToChildNodeClass(newNodeClass);
    return newNodeClass;
  }

  projectNewEdge(classIdList) {
    const classList = [this].concat(classIdList.map(classId => {
      return this.model.classes[classId];
    }));

    if (classList.length < 3 || classList[classList.length - 1].type !== 'Node') {
      throw new Error(`Invalid classIdList`);
    }

    const sourceClassId = this.classId;
    const targetClassId = classList[classList.length - 1].classId;
    let tableOrder = [];

    for (let i = 1; i < classList.length; i++) {
      const classObj = classList[i];

      if (classObj.type === 'Node') {
        tableOrder.push(classObj.tableId);
      } else {
        const edgeRole = classList[i - 1].getEdgeRole(classObj);

        if (edgeRole === 'source' || edgeRole === 'both') {
          tableOrder = tableOrder.concat(Array.from(classObj.sourceTableIds).reverse());
          tableOrder.push(classObj.tableId);
          tableOrder = tableOrder.concat(classObj.targetTableIds);
        } else {
          tableOrder = tableOrder.concat(Array.from(classObj.targetTableIds).reverse());
          tableOrder.push(classObj.tableId);
          tableOrder = tableOrder.concat(classObj.sourceTableIds);
        }
      }
    }

    const newTable = this.table.project(tableOrder);
    const newClass = this.model.createClass({
      type: 'EdgeClass',
      tableId: newTable.tableId,
      sourceClassId,
      targetClassId,
      sourceTableIds: [],
      targetTableIds: []
    });
    this.edgeClassIds[newClass.classId] = true;
    classList[classList.length - 1].edgeClassIds[newClass.classId] = true;
    return newClass;
  }

  disconnectAllEdges(options) {
    for (const edgeClass of this.connectedClasses()) {
      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSource(options);
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTarget(options);
      }
    }
  }

  *connectedClasses() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      yield this.model.classes[edgeClassId];
    }
  }

  delete() {
    this.disconnectAllEdges();
    super.delete();
  }

}

class EdgeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  sourceNodes(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      if (_this.classObj.sourceClassId === null || options.classes && !options.classes.find(d => _this.classObj.sourceClassId === d.classId) || options.classIds && options.classIds.indexOf(_this.classObj.sourceClassId) === -1) {
        return;
      }

      const sourceTableId = _this.classObj.model.classes[_this.classObj.sourceClassId].tableId;

      const tableIds = _this.classObj.sourceTableIds.concat([sourceTableId]);

      yield* _asyncGeneratorDelegate(_asyncIterator(_this.handleLimit(options, [_this.iterateAcrossConnections(tableIds)])), _awaitAsyncGenerator);
    })();
  }

  targetNodes(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      if (_this2.classObj.targetClassId === null || options.classes && !options.classes.find(d => _this2.classObj.targetClassId === d.classId) || options.classIds && options.classIds.indexOf(_this2.classObj.targetClassId) === -1) {
        return;
      }

      const targetTableId = _this2.classObj.model.classes[_this2.classObj.targetClassId].tableId;

      const tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);

      yield* _asyncGeneratorDelegate(_asyncIterator(_this2.handleLimit(options, [_this2.iterateAcrossConnections(tableIds)])), _awaitAsyncGenerator);
    })();
  }

  nodes(options = {}) {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      yield* _asyncGeneratorDelegate(_asyncIterator(_this3.handleLimit(options, [_this3.sourceNodes(options), _this3.targetNodes(options)])), _awaitAsyncGenerator);
    })();
  }

}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options); // sourceTableIds and targetTableIds are lists of any intermediate tables,
    // beginning with the edge table (but not including it), that lead to the
    // source / target node tables (but not including) those

    this.sourceClassId = options.sourceClassId || null;
    this.sourceTableIds = options.sourceTableIds || [];
    this.targetClassId = options.targetClassId || null;
    this.targetTableIds = options.targetTableIds || [];
    this.directed = options.directed || false;
  }

  get className() {
    return this._className || (this.sourceClass && this.sourceClass.className || '?') + '-' + (this.targetClass && this.targetClass.className || '?');
  }

  get sourceClass() {
    return this.sourceClassId && this.model.classes[this.sourceClassId] || null;
  }

  get targetClass() {
    return this.targetClassId && this.model.classes[this.targetClassId] || null;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.sourceTableIds = this.sourceTableIds;
    result.targetClassId = this.targetClassId;
    result.targetTableIds = this.targetTableIds;
    result.directed = this.directed;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new EdgeWrapper(options);
  }

  _splitTableIdList(tableIdList, otherClass) {
    let result = {
      nodeTableIdList: [],
      edgeTableId: null,
      edgeTableIdList: []
    };

    if (tableIdList.length === 0) {
      // Weird corner case where we're trying to create an edge between
      // adjacent or identical tables... create a ConnectedTable
      result.edgeTableId = this.table.connect(otherClass.table).tableId;
      return result;
    } else {
      // Use a table in the middle as the new edge table; prioritize
      // StaticTable and StaticDictTable
      let staticExists = false;
      let tableDistances = tableIdList.map((tableId, index) => {
        staticExists = staticExists || this.model.tables[tableId].type.startsWith('Static');
        return {
          tableId,
          index,
          dist: Math.abs(tableIdList / 2 - index)
        };
      });

      if (staticExists) {
        tableDistances = tableDistances.filter(({
          tableId
        }) => {
          return this.model.tables[tableId].type.startsWith('Static');
        });
      }

      const {
        tableId,
        index
      } = tableDistances.sort((a, b) => a.dist - b.dist)[0];
      result.edgeTableId = tableId;
      result.edgeTableIdList = tableIdList.slice(0, index).reverse();
      result.nodeTableIdList = tableIdList.slice(index + 1);
    }

    return result;
  }

  interpretAsNodes() {
    const temp = this._toRawObject();

    this.disconnectSource();
    this.disconnectTarget();
    temp.type = 'NodeClass';
    temp.overwrite = true;
    const newNodeClass = this.model.createClass(temp);

    if (temp.sourceClassId) {
      const sourceClass = this.model.classes[temp.sourceClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.sourceTableIds, sourceClass);

      const sourceEdgeClass = this.model.createClass({
        type: 'EdgeClass',
        tableId: edgeTableId,
        directed: temp.directed,
        sourceClassId: temp.sourceClassId,
        sourceTableIds: nodeTableIdList,
        targetClassId: newNodeClass.classId,
        targetTableIds: edgeTableIdList
      });
      sourceClass.edgeClassIds[sourceEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[sourceEdgeClass.classId] = true;
    }

    if (temp.targetClassId && temp.sourceClassId !== temp.targetClassId) {
      const targetClass = this.model.classes[temp.targetClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.targetTableIds, targetClass);

      const targetEdgeClass = this.model.createClass({
        type: 'EdgeClass',
        tableId: edgeTableId,
        directed: temp.directed,
        sourceClassId: newNodeClass.classId,
        sourceTableIds: edgeTableIdList,
        targetClassId: temp.targetClassId,
        targetTableIds: nodeTableIdList
      });
      targetClass.edgeClassIds[targetEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[targetEdgeClass.classId] = true;
    }

    this.table.reset();
    this.model.trigger('update');
    return newNodeClass;
  }

  *connectedClasses() {
    if (this.sourceClassId) {
      yield this.model.classes[this.sourceClassId];
    }

    if (this.targetClassId) {
      yield this.model.classes[this.targetClassId];
    }
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass(options) {
    if (options.side === 'source') {
      this.connectSource(options);
    } else if (options.side === 'target') {
      this.connectTarget(options);
    } else {
      throw new Error(`PoliticalOutsiderError: "${options.side}" is an invalid side`);
    }
  }

  toggleDirection(directed) {
    if (directed === false || this.swappedDirection === true) {
      this.directed = false;
      delete this.swappedDirection;
    } else if (!this.directed) {
      this.directed = true;
      this.swappedDirection = false;
    } else {
      // Directed was already true, just switch source and target
      let temp = this.sourceClassId;
      this.sourceClassId = this.targetClassId;
      this.targetClassId = temp;
      temp = this.sourceTableIds;
      this.sourceTableIds = this.targetTableIds;
      this.targetTableIds = temp;
      this.swappedDirection = true;
    }

    this.model.trigger('update');
  }

  connectSource({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null
  } = {}) {
    if (this.sourceClassId) {
      this.disconnectSource();
    }

    this.sourceClassId = nodeClass.classId;
    const sourceClass = this.model.classes[this.sourceClassId];
    sourceClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.table.promote(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.table.promote(nodeAttribute);
    this.sourceTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.sourceTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.sourceTableIds.push(nodeHash.tableId);
    }

    this.model.trigger('update');
  }

  connectTarget({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null
  } = {}) {
    if (this.targetClassId) {
      this.disconnectTarget();
    }

    this.targetClassId = nodeClass.classId;
    const targetClass = this.model.classes[this.targetClassId];
    targetClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.table.promote(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.table.promote(nodeAttribute);
    this.targetTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.targetTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.targetTableIds.push(nodeHash.tableId);
    }

    this.model.trigger('update');
  }

  disconnectSource() {
    const existingSourceClass = this.model.classes[this.sourceClassId];

    if (existingSourceClass) {
      delete existingSourceClass.edgeClassIds[this.classId];
    }

    this.sourceTableIds = [];
    this.sourceClassId = null;
    this.model.trigger('update');
  }

  disconnectTarget() {
    const existingTargetClass = this.model.classes[this.targetClassId];

    if (existingTargetClass) {
      delete existingTargetClass.edgeClassIds[this.classId];
    }

    this.targetTableIds = [];
    this.targetClassId = null;
    this.model.trigger('update');
  }

  promote(attribute) {
    if (this.sourceClassId && this.targetClassId) {
      return super.promote();
    } else {
      const newNodeClass = this.model.createClass({
        tableId: this.table.promote(attribute).tableId,
        type: 'NodeClass'
      });
      this.connectToNodeClass({
        nodeClass: newNodeClass,
        side: !this.sourceClassId ? 'source' : 'target',
        nodeAttribute: null,
        edgeAttribute: attribute
      });
      return newNodeClass;
    }
  }

  connectFacetedClass(newEdgeClass) {
    // When an edge class is faceted, we want to keep the same connections. This
    // means we need to clone each table chain, and add our own table to it
    // (because our table is the parentTable of the new one)
    if (this.sourceClassId) {
      newEdgeClass.sourceClassId = this.sourceClassId;
      newEdgeClass.sourceTableIds = Array.from(this.sourceTableIds);
      newEdgeClass.sourceTableIds.unshift(this.tableId);
      this.sourceClass.edgeClassIds[newEdgeClass.classId] = true;
    }

    if (this.targetClassId) {
      newEdgeClass.targetClassId = this.targetClassId;
      newEdgeClass.targetTableIds = Array.from(this.targetTableIds);
      newEdgeClass.targetTableIds.unshift(this.tableId);
      this.targetClass.edgeClassIds[newEdgeClass.classId] = true;
    }

    this.model.trigger('update');
  }

  closedFacet(attribute, values) {
    const newClasses = super.closedFacet(attribute, values);

    for (const newClass of newClasses) {
      this.connectFacetedClass(newClass);
    }

    return newClasses;
  }

  openFacet(attribute) {
    var _this = this,
        _superprop_callOpenFacet = (..._args) => super.openFacet(..._args);

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_superprop_callOpenFacet(attribute)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const newClass = _value;

          _this.connectFacetedClass(newClass);

          yield newClass;
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }

  delete() {
    this.disconnectSource();
    this.disconnectTarget();
    super.delete();
  }

}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
});

class FileFormat {
  async buildRow(item) {
    const row = {};

    for (let attr in item.row) {
      row[attr] = await item.row[attr];
    }

    return row;
  }

}

class ParseFailure extends Error {
  constructor(fileFormat) {
    super(`Failed to parse format: ${fileFormat.constructor.name}`);
  }

}

const NODE_NAMES = ['nodes', 'Nodes'];
const EDGE_NAMES = ['edges', 'links', 'Edges', 'Links'];

class D3Json extends FileFormat {
  async importData({
    model,
    text,
    nodeAttribute = null,
    sourceAttribute = 'source',
    targetAttribute = 'target',
    classAttribute = null
  }) {
    const data = JSON.parse(text);
    const nodeName = NODE_NAMES.find(name => data[name] instanceof Array);
    const edgeName = EDGE_NAMES.find(name => data[name] instanceof Array);

    if (!nodeName || !edgeName) {
      throw new ParseFailure(this);
    }

    const coreTable = model.createTable({
      type: 'StaticDictTable',
      name: 'coreTable',
      data: data
    });
    const coreClass = model.createClass({
      type: 'GenericClass',
      tableId: coreTable.tableId
    });
    let [nodes, edges] = coreClass.closedTranspose([nodeName, edgeName]);

    if (classAttribute) {
      if (nodeAttribute === null) {
        throw new Error(`Can't import classes from D3-style JSON without nodeAttribute`);
      }

      const nodeClasses = [];
      const nodeClassLookup = {};
      const edgeClasses = [];
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(nodes.openFacet(classAttribute)), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const nodeClass = _value;
          nodeClassLookup[nodeClass.className] = nodeClasses.length;
          nodeClasses.push(nodeClass.interpretAsNodes());
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            await _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(edges.openFacet(classAttribute)), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const edgeClass = _value2;
          edgeClasses.push(edgeClass.interpretAsEdges());
          const sample = await edgeClass.table.getItem();
          const sourceClassName = sample.row[sourceAttribute + '_' + classAttribute];

          if (nodeClassLookup[sourceClassName] !== undefined) {
            edgeClass.connectToNodeClass({
              nodeClass: nodeClasses[nodeClassLookup[sourceClassName]],
              side: 'source',
              nodeAttribute,
              edgeAttribute: sourceAttribute
            });
          }

          const targetClassName = sample.row[targetAttribute + '_' + classAttribute];

          if (nodeClassLookup[targetClassName] !== undefined) {
            edgeClass.connectToNodeClass({
              nodeClass: nodeClasses[nodeClassLookup[targetClassName]],
              side: 'target',
              nodeAttribute,
              edgeAttribute: targetAttribute
            });
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            await _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    } else {
      nodes = nodes.interpretAsNodes();
      nodes.setClassName(nodeName);
      edges = edges.interpretAsEdges();
      edges.setClassName(edgeName);
      nodes.connectToEdgeClass({
        edgeClass: edges,
        side: 'source',
        nodeAttribute,
        edgeAttribute: sourceAttribute
      });
      nodes.connectToEdgeClass({
        edgeClass: edges,
        side: 'target',
        nodeAttribute,
        edgeAttribute: targetAttribute
      });
    }
  }

  async formatData({
    model,
    includeClasses = Object.values(model.classes),
    pretty = true,
    nodeAttribute = null,
    sourceAttribute = 'source',
    targetAttribute = 'target',
    classAttribute = null
  }) {
    if (classAttribute && !nodeAttribute) {
      throw new Error(`Can't export D3-style JSON with classes, without a nodeAttribute`);
    }

    let result = {
      nodes: [],
      links: []
    };
    const nodeLookup = {};
    const nodeClasses = [];
    const edgeClasses = [];

    for (const classObj of includeClasses) {
      if (classObj.type === 'Node') {
        nodeClasses.push(classObj);
      } else if (classObj.type === 'Edge') {
        edgeClasses.push(classObj);
      } else {
        result.other = result.other || [];
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;

        var _iteratorError3;

        try {
          for (var _iterator3 = _asyncIterator(classObj.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
            const item = _value3;
            result.other.push((await this.buildRow(item)));
          }
        } catch (err) {
          _didIteratorError3 = true;
          _iteratorError3 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
              await _iterator3.return();
            }
          } finally {
            if (_didIteratorError3) {
              throw _iteratorError3;
            }
          }
        }
      }
    }

    for (const nodeClass of nodeClasses) {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;

      var _iteratorError4;

      try {
        for (var _iterator4 = _asyncIterator(nodeClass.table.iterate()), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
          const node = _value4;
          nodeLookup[node.exportId] = result.nodes.length;
          const row = await this.buildRow(node);

          if (nodeAttribute) {
            row[nodeAttribute] = node.exportId;
          }

          if (classAttribute) {
            row[classAttribute] = node.classObj.className;
          }

          result.nodes.push(row);
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
            await _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    }

    for (const edgeClass of edgeClasses) {
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;

      var _iteratorError5;

      try {
        for (var _iterator5 = _asyncIterator(edgeClass.table.iterate()), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
          const edge = _value5;
          const row = await this.buildRow(edge);
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;

          var _iteratorError6;

          try {
            for (var _iterator6 = _asyncIterator(edge.sourceNodes({
              classes: nodeClasses
            })), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
              const source = _value6;
              row[sourceAttribute] = nodeAttribute ? source.exportId : nodeLookup[source.exportId];

              if (classAttribute) {
                row[sourceAttribute + '_' + classAttribute] = source.classObj.className;
              }

              var _iteratorNormalCompletion7 = true;
              var _didIteratorError7 = false;

              var _iteratorError7;

              try {
                for (var _iterator7 = _asyncIterator(edge.targetNodes({
                  classes: nodeClasses
                })), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
                  const target = _value7;
                  row[targetAttribute] = nodeAttribute ? target.exportId : nodeLookup[target.exportId];

                  if (classAttribute) {
                    row[targetAttribute + '_' + classAttribute] = target.classObj.className;
                  }

                  result.links.push(Object.assign({}, row));
                }
              } catch (err) {
                _didIteratorError7 = true;
                _iteratorError7 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion7 && _iterator7.return != null) {
                    await _iterator7.return();
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
              if (!_iteratorNormalCompletion6 && _iterator6.return != null) {
                await _iterator6.return();
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
          if (!_iteratorNormalCompletion5 && _iterator5.return != null) {
            await _iterator5.return();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }
    }

    if (pretty) {
      result.nodes = '  "nodes": [\n    ' + result.nodes.map(row => JSON.stringify(row)).join(',\n    ') + '\n  ]';
      result.links = '  "links": [\n    ' + result.links.map(row => JSON.stringify(row)).join(',\n    ') + '\n  ]';

      if (result.other) {
        result.other = ',\n  "other": [\n    ' + result.other.map(row => JSON.stringify(row)).join(',\n    ') + '\n  ]';
      }

      result = `{\n${result.nodes},\n${result.links}${result.other || ''}\n}\n`;
    } else {
      result = JSON.stringify(result);
    }

    return {
      data: 'data:text/json;base64,' + Buffer.from(result).toString('base64'),
      type: 'text/json',
      extension: 'json'
    };
  }

}

var D3Json$1 = new D3Json();



var FILE_FORMATS = /*#__PURE__*/Object.freeze({
  D3Json: D3Json$1
});

const DATALIB_FORMATS = {
  'json': 'json',
  'csv': 'csv',
  'tsv': 'tsv'
};

class NetworkModel extends TriggerableMixin(class {}) {
  constructor({
    origraph,
    modelId,
    name = modelId,
    annotations = {},
    classes = {},
    tables = {}
  }) {
    super();
    this._origraph = origraph;
    this.modelId = modelId;
    this.name = name;
    this.annotations = annotations;
    this.classes = {};
    this.tables = {};
    this._nextClassId = 1;
    this._nextTableId = 1;

    for (const classObj of Object.values(classes)) {
      this.classes[classObj.classId] = this.hydrate(classObj, CLASSES);
    }

    for (const table of Object.values(tables)) {
      this.tables[table.tableId] = this.hydrate(table, TABLES);
    }

    this.on('update', () => {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = setTimeout(() => {
        this._origraph.save();

        this._saveTimeout = undefined;
      }, 0);
    });
  }

  _toRawObject() {
    const classes = {};
    const tables = {};

    for (const classObj of Object.values(this.classes)) {
      classes[classObj.classId] = classObj._toRawObject();
      classes[classObj.classId].type = classObj.constructor.name;
    }

    for (const tableObj of Object.values(this.tables)) {
      tables[tableObj.tableId] = tableObj._toRawObject();
      tables[tableObj.tableId].type = tableObj.constructor.name;
    }

    return {
      modelId: this.modelId,
      name: this.name,
      annotations: this.annotations,
      classes,
      tables
    };
  }

  get unsaved() {
    return this._saveTimeout !== undefined;
  }

  hydrate(rawObject, TYPES) {
    rawObject.model = this;
    return new TYPES[rawObject.type](rawObject);
  }

  createTable(options) {
    while (!options.tableId || !options.overwrite && this.tables[options.tableId]) {
      options.tableId = `table${this._nextTableId}`;
      this._nextTableId += 1;
    }

    options.model = this;
    this.tables[options.tableId] = new TABLES[options.type](options);
    this.trigger('update');
    return this.tables[options.tableId];
  }

  createClass(options = {
    selector: `empty`
  }) {
    while (!options.classId || !options.overwrite && this.classes[options.classId]) {
      options.classId = `class${this._nextClassId}`;
      this._nextClassId += 1;
    }

    if (this.tables[options.tableId].classObj && !options.overwrite) {
      options.tableId = this.tables[options.tableId].duplicate().tableId;
    }

    options.model = this;
    this.classes[options.classId] = new CLASSES[options.type](options);
    this.trigger('update');
    return this.classes[options.classId];
  }

  findClass(className) {
    return Object.values(this.classes).find(classObj => classObj.className === className);
  }

  rename(newName) {
    this.name = newName;
    this.trigger('update');
  }

  annotate(key, value) {
    this.annotations[key] = value;
    this.trigger('update');
  }

  deleteAnnotation(key) {
    delete this.annotations[key];
    this.trigger('update');
  }

  delete() {
    this._origraph.deleteModel(this.modelId);
  }

  get deleted() {
    return this._origraph.models[this.modelId];
  }

  async addTextFile(options) {
    if (!options.format) {
      options.format = mime.extension(mime.lookup(options.name));
    }

    if (FILE_FORMATS[options.format]) {
      options.model = this;
      return FILE_FORMATS[options.format].importData(options);
    } else if (DATALIB_FORMATS[options.format]) {
      options.data = datalib.read(options.text, {
        type: options.format
      });

      if (options.format === 'csv' || options.format === 'tsv') {
        options.attributes = {};

        for (const attr of options.data.columns) {
          options.attributes[attr] = true;
        }

        delete options.data.columns;
      }

      return this.addStaticTable(options);
    } else {
      throw new Error(`Unsupported file format: ${options.format}`);
    }
  }

  async formatData(options) {
    options.model = this;

    if (FILE_FORMATS[options.format]) {
      return FILE_FORMATS[options.format].formatData(options);
    } else if (DATALIB_FORMATS[options.format]) {
      throw new Error(`Raw ${options.format} export not yet supported`);
    } else {
      throw new Error(`Can't export unknown format: ${options.format}`);
    }
  }

  addStaticTable(options) {
    options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDictTable';
    let newTable = this.createTable(options);
    return this.createClass({
      type: 'GenericClass',
      tableId: newTable.tableId
    });
  }

  optimizeTables() {
    const tablesInUse = {};

    for (const classObj of Object.values(this.classes)) {
      tablesInUse[classObj.tableId] = true;

      for (const tableId of classObj.sourceTableIds || []) {
        tablesInUse[tableId] = true;
      }

      for (const tableId of classObj.targetTableIds || []) {
        tablesInUse[tableId] = true;
      }
    }

    const parentsVisited = {};
    const queue = Object.keys(tablesInUse);

    while (queue.length > 0) {
      const tableId = queue.shift();

      if (!parentsVisited[tableId]) {
        tablesInUse[tableId] = true;
        parentsVisited[tableId] = true;
        const table = this.tables[tableId];

        for (const parentTable of table.parentTables) {
          queue.push(parentTable.tableId);
        }
      }
    }

    for (const tableId of Object.keys(this.tables)) {
      const table = this.tables[tableId];

      if (!tablesInUse[tableId] && table.type !== 'Static' && table.type !== 'StaticDict') {
        table.delete(true);
      }
    } // TODO: If any DuplicatedTable is in use, but the original isn't, swap for the real one

  }

  async getInstanceGraph(instanceIdList) {
    if (!instanceIdList) {
      // Without specified instances, just pick the first 5 from each node
      // and edge class
      instanceIdList = [];

      for (const classObj of Object.values(this.classes)) {
        if (classObj.type === 'Node' || classObj.type === 'Edge') {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;

          var _iteratorError;

          try {
            for (var _iterator = _asyncIterator(classObj.table.iterate(5)), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
              const item = _value;
              instanceIdList.push(item.instanceId);
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return != null) {
                await _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        }
      }
    } // Get the specified items


    const nodeInstances = {};
    const edgeInstances = {};

    for (const instanceId of instanceIdList) {
      const {
        classId,
        index
      } = JSON.parse(instanceId);
      const instance = await this.classes[classId].table.getItem(index);

      if (instance.type === 'Node') {
        nodeInstances[instanceId] = instance;
      } else if (instance.type === 'Edge') {
        edgeInstances[instanceId] = instance;
      }
    } // Add any nodes connected to our edges


    const extraNodes = {};

    for (const edgeId in edgeInstances) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(edgeInstances[edgeId].nodes()), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const node = _value2;

          if (!nodeInstances[node.instanceId]) {
            extraNodes[node.instanceId] = node;
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            await _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    } // Add any edges that connect our nodes


    const extraEdges = {};

    for (const nodeId in nodeInstances) {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator(nodeInstances[nodeId].edges()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
          const edge = _value3;

          if (!edgeInstances[edge.instanceId]) {
            // Check that both ends of the edge connect at least one
            // of our nodes
            let connectsSource = false;
            let connectsTarget = false;
            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;

            var _iteratorError4;

            try {
              for (var _iterator4 = _asyncIterator(edge.sourceNodes()), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                const node = _value4;

                if (nodeInstances[node.instanceId]) {
                  connectsSource = true;
                  break;
                }
              }
            } catch (err) {
              _didIteratorError4 = true;
              _iteratorError4 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
                  await _iterator4.return();
                }
              } finally {
                if (_didIteratorError4) {
                  throw _iteratorError4;
                }
              }
            }

            var _iteratorNormalCompletion5 = true;
            var _didIteratorError5 = false;

            var _iteratorError5;

            try {
              for (var _iterator5 = _asyncIterator(edge.targetNodes()), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
                const node = _value5;

                if (nodeInstances[node.instanceId]) {
                  connectsTarget = true;
                  break;
                }
              }
            } catch (err) {
              _didIteratorError5 = true;
              _iteratorError5 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion5 && _iterator5.return != null) {
                  await _iterator5.return();
                }
              } finally {
                if (_didIteratorError5) {
                  throw _iteratorError5;
                }
              }
            }

            if (connectsSource && connectsTarget) {
              extraEdges[edge.instanceId] = edge;
            }
          }
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
            await _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }
    } // Okay, now we have a complete set of nodes and edges that we want to
    // include; create pairwise edge entries for every connection


    const graph = {
      nodes: [],
      nodeLookup: {},
      edges: []
    }; // Add all the nodes, and populate a lookup for where they are in the list

    for (const node of Object.values(nodeInstances).concat(Object.values(extraNodes))) {
      graph.nodeLookup[node.instanceId] = graph.nodes.length;
      graph.nodes.push({
        nodeInstance: node,
        dummy: false
      });
    } // Add all the edges...


    for (const edge of Object.values(edgeInstances).concat(Object.values(extraEdges))) {
      if (!edge.classObj.sourceClassId) {
        if (!edge.classObj.targetClassId) {
          // Missing both source and target classes; add dummy nodes for both ends
          graph.edges.push({
            edgeInstance: edge,
            source: graph.nodes.length,
            target: graph.nodes.length + 1
          });
          graph.nodes.push({
            dummy: true
          });
          graph.nodes.push({
            dummy: true
          });
        } else {
          // Add dummy source nodes
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;

          var _iteratorError6;

          try {
            for (var _iterator6 = _asyncIterator(edge.targetNodes()), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
              const node = _value6;

              if (graph.nodeLookup[node.instanceId] !== undefined) {
                graph.edges.push({
                  edgeInstance: edge,
                  source: graph.nodes.length,
                  target: graph.nodeLookup[node.instanceId]
                });
                graph.nodes.push({
                  dummy: true
                });
              }
            }
          } catch (err) {
            _didIteratorError6 = true;
            _iteratorError6 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion6 && _iterator6.return != null) {
                await _iterator6.return();
              }
            } finally {
              if (_didIteratorError6) {
                throw _iteratorError6;
              }
            }
          }
        }
      } else if (!edge.classObj.targetClassId) {
        // Add dummy target nodes
        var _iteratorNormalCompletion7 = true;
        var _didIteratorError7 = false;

        var _iteratorError7;

        try {
          for (var _iterator7 = _asyncIterator(edge.sourceNodes()), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
            const node = _value7;

            if (graph.nodeLookup[node.instanceId] !== undefined) {
              graph.edges.push({
                edgeInstance: edge,
                source: graph.nodeLookup[node.instanceId],
                target: graph.nodes.length
              });
              graph.nodes.push({
                dummy: true
              });
            }
          }
        } catch (err) {
          _didIteratorError7 = true;
          _iteratorError7 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion7 && _iterator7.return != null) {
              await _iterator7.return();
            }
          } finally {
            if (_didIteratorError7) {
              throw _iteratorError7;
            }
          }
        }
      } else {
        // There should be both source and target nodes for each edge
        var _iteratorNormalCompletion8 = true;
        var _didIteratorError8 = false;

        var _iteratorError8;

        try {
          for (var _iterator8 = _asyncIterator(edge.sourceNodes()), _step8, _value8; _step8 = await _iterator8.next(), _iteratorNormalCompletion8 = _step8.done, _value8 = await _step8.value, !_iteratorNormalCompletion8; _iteratorNormalCompletion8 = true) {
            const sourceNode = _value8;

            if (graph.nodeLookup[sourceNode.instanceId] !== undefined) {
              var _iteratorNormalCompletion9 = true;
              var _didIteratorError9 = false;

              var _iteratorError9;

              try {
                for (var _iterator9 = _asyncIterator(edge.targetNodes()), _step9, _value9; _step9 = await _iterator9.next(), _iteratorNormalCompletion9 = _step9.done, _value9 = await _step9.value, !_iteratorNormalCompletion9; _iteratorNormalCompletion9 = true) {
                  const targetNode = _value9;

                  if (graph.nodeLookup[targetNode.instanceId] !== undefined) {
                    graph.edges.push({
                      edgeInstance: edge,
                      source: graph.nodeLookup[sourceNode.instanceId],
                      target: graph.nodeLookup[targetNode.instanceId]
                    });
                  }
                }
              } catch (err) {
                _didIteratorError9 = true;
                _iteratorError9 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion9 && _iterator9.return != null) {
                    await _iterator9.return();
                  }
                } finally {
                  if (_didIteratorError9) {
                    throw _iteratorError9;
                  }
                }
              }
            }
          }
        } catch (err) {
          _didIteratorError8 = true;
          _iteratorError8 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion8 && _iterator8.return != null) {
              await _iterator8.return();
            }
          } finally {
            if (_didIteratorError8) {
              throw _iteratorError8;
            }
          }
        }
      }
    }

    return graph;
  }

  getNetworkModelGraph({
    raw = true,
    includeDummies = false,
    classList = Object.values(this.classes)
  } = {}) {
    const edgeClasses = [];
    let graph = {
      classes: [],
      classLookup: {},
      classConnections: []
    };

    for (const classObj of classList) {
      // Add and index the class as a node
      const classSpec = raw ? classObj._toRawObject() : {
        classObj
      };
      classSpec.type = classObj.constructor.name;
      graph.classLookup[classObj.classId] = graph.classes.length;
      graph.classes.push(classSpec);

      if (classObj.type === 'Edge') {
        // Store the edge class so we can create classConnections later
        edgeClasses.push(classObj);
      } else if (classObj.type === 'Node' && includeDummies) {
        // Create a "potential" connection + dummy node
        graph.classConnections.push({
          id: `${classObj.classId}>dummy`,
          source: graph.classes.length - 1,
          target: graph.classes.length,
          directed: false,
          location: 'node',
          dummy: true
        });
        graph.classes.push({
          dummy: true
        });
      }
    } // Create existing classConnections


    for (const edgeClass of edgeClasses) {
      if (edgeClass.sourceClassId !== null) {
        // Connect the source node class to the edge class
        graph.classConnections.push({
          id: `${edgeClass.sourceClassId}>${edgeClass.classId}`,
          source: graph.classLookup[edgeClass.sourceClassId],
          target: graph.classLookup[edgeClass.classId],
          directed: edgeClass.directed,
          location: 'source'
        });
      } else if (includeDummies) {
        // Create a "potential" connection + dummy source class
        graph.classConnections.push({
          id: `dummy>${edgeClass.classId}`,
          source: graph.classes.length,
          target: graph.classLookup[edgeClass.classId],
          directed: edgeClass.directed,
          location: 'source',
          dummy: true
        });
        graph.classes.push({
          dummy: true
        });
      }

      if (edgeClass.targetClassId !== null) {
        // Connect the edge class to the target node class
        graph.classConnections.push({
          id: `${edgeClass.classId}>${edgeClass.targetClassId}`,
          source: graph.classLookup[edgeClass.classId],
          target: graph.classLookup[edgeClass.targetClassId],
          directed: edgeClass.directed,
          location: 'target'
        });
      } else if (includeDummies) {
        // Create a "potential" connection + dummy target class
        graph.classConnections.push({
          id: `${edgeClass.classId}>dummy`,
          source: graph.classLookup[edgeClass.classId],
          target: graph.classes.length,
          directed: edgeClass.directed,
          location: 'target',
          dummy: true
        });
        graph.classes.push({
          dummy: true
        });
      }
    }

    return graph;
  }

  getTableDependencyGraph() {
    const graph = {
      tables: [],
      tableLookup: {},
      tableLinks: []
    };
    const tableList = Object.values(this.tables);

    for (const table of tableList) {
      const tableSpec = table._toRawObject();

      tableSpec.type = table.constructor.name;
      graph.tableLookup[table.tableId] = graph.tables.length;
      graph.tables.push(tableSpec);
    } // Fill the graph with links based on parentTables...


    for (const table of tableList) {
      for (const parentTable of table.parentTables) {
        graph.tableLinks.push({
          source: graph.tableLookup[parentTable.tableId],
          target: graph.tableLookup[table.tableId]
        });
      }
    }

    return graph;
  }

  getModelDump() {
    // Because object key orders aren't deterministic, it can be problematic
    // for testing (because ids can randomly change from test run to test run).
    // This function sorts each key, and just replaces IDs with index numbers
    const rawObj = JSON.parse(JSON.stringify(this._toRawObject()));
    const result = {
      classes: Object.values(rawObj.classes).sort((a, b) => {
        const aHash = this.classes[a.classId].getSortHash();
        const bHash = this.classes[b.classId].getSortHash();

        if (aHash < bHash) {
          return -1;
        } else if (aHash > bHash) {
          return 1;
        } else {
          throw new Error(`class hash collision`);
        }
      }),
      tables: Object.values(rawObj.tables).sort((a, b) => {
        const aHash = this.tables[a.tableId].getSortHash();
        const bHash = this.tables[b.tableId].getSortHash();

        if (aHash < bHash) {
          return -1;
        } else if (aHash > bHash) {
          return 1;
        } else {
          throw new Error(`table hash collision`);
        }
      })
    };
    const classLookup = {};
    const tableLookup = {};
    result.classes.forEach((classObj, index) => {
      classLookup[classObj.classId] = index;
    });
    result.tables.forEach((table, index) => {
      tableLookup[table.tableId] = index;
    });

    for (const table of result.tables) {
      table.tableId = tableLookup[table.tableId];

      for (const tableId of Object.keys(table.derivedTables)) {
        table.derivedTables[tableLookup[tableId]] = table.derivedTables[tableId];
        delete table.derivedTables[tableId];
      }

      delete table.data; // don't include any of the data; we just want the model structure
    }

    for (const classObj of result.classes) {
      classObj.classId = classLookup[classObj.classId];
      classObj.tableId = tableLookup[classObj.tableId];

      if (classObj.sourceClassId) {
        classObj.sourceClassId = classLookup[classObj.sourceClassId];
      }

      if (classObj.sourceTableIds) {
        classObj.sourceTableIds = classObj.sourceTableIds.map(tableId => tableLookup[tableId]);
      }

      if (classObj.targetClassId) {
        classObj.targetClassId = classLookup[classObj.targetClassId];
      }

      if (classObj.targetTableIds) {
        classObj.targetTableIds = classObj.targetTableIds.map(tableId => tableLookup[tableId]);
      }

      for (const classId of Object.keys(classObj.edgeClassIds || {})) {
        classObj.edgeClassIds[classLookup[classId]] = classObj.edgeClassIds[classId];
        delete classObj.edgeClassIds[classId];
      }
    }

    return result;
  }

  createSchemaModel() {
    const graph = this.getModelDump();
    graph.tables.forEach(table => {
      table.derivedTables = Object.keys(table.derivedTables);
    });

    const newModel = this._origraph.createModel({
      name: this.name + '_schema'
    });

    const raw = newModel.addStaticTable({
      data: graph,
      name: 'Raw Dump'
    });
    let [classes, tables] = raw.closedTranspose(['classes', 'tables']);
    classes = classes.interpretAsNodes();
    classes.setClassName('Classes');
    raw.delete();
    const sourceClasses = classes.connectToNodeClass({
      otherNodeClass: classes,
      attribute: 'sourceClassId',
      otherAttribute: null
    });
    sourceClasses.setClassName('Source Class');
    sourceClasses.toggleDirection();
    const targetClasses = classes.connectToNodeClass({
      otherNodeClass: classes,
      attribute: 'targetClassId',
      otherAttribute: null
    });
    targetClasses.setClassName('Target Class');
    targetClasses.toggleDirection();
    tables = tables.interpretAsNodes();
    tables.setClassName('Tables');
    const tableDependencies = tables.connectToNodeClass({
      otherNodeClass: tables,
      attribute: 'derivedTables',
      otherAttribute: null
    });
    tableDependencies.setClassName('Is Parent Of');
    tableDependencies.toggleDirection();
    const coreTables = classes.connectToNodeClass({
      otherNodeClass: tables,
      attribute: 'tableId',
      otherAttribute: null
    });
    coreTables.setClassName('Core Table');
    return newModel;
  }

}

let NEXT_MODEL_ID = 1;

class Origraph extends TriggerableMixin(class {}) {
  constructor(localStorage) {
    super();
    this.localStorage = localStorage; // only defined in the browser context

    this.plugins = {};
    this.models = {};
    let existingModels = this.localStorage && this.localStorage.getItem('origraph_models');

    if (existingModels) {
      for (const [modelId, model] of Object.entries(JSON.parse(existingModels))) {
        model.origraph = this;
        this.models[modelId] = new NetworkModel(model);
      }
    }

    this._currentModelId = null;
  }

  registerPlugin(name, plugin) {
    this.plugins[name] = plugin;
  }

  save() {
    /*
    if (this.localStorage) {
      const models = {};
      for (const [modelId, model] of Object.entries(this.models)) {
        models[modelId] = model._toRawObject();
      }
      this.localStorage.setItem('origraph_models', JSON.stringify(models));
      this.trigger('save');
    }
    */
  }

  closeCurrentModel() {
    this._currentModelId = null;
    this.trigger('changeCurrentModel');
  }

  get currentModel() {
    return this.models[this._currentModelId] || null;
  }

  set currentModel(model) {
    this._currentModelId = model ? model.modelId : null;
    this.trigger('changeCurrentModel');
  }

  async loadModel(options) {
    const newModel = this.createModel({
      modelId: options.name
    });
    await newModel.addTextFile(options);
    return newModel;
  }

  createModel(options = {}) {
    while (!options.modelId || this.models[options.modelId]) {
      options.modelId = `model${NEXT_MODEL_ID}`;
      NEXT_MODEL_ID += 1;
    }

    options.origraph = this;
    this.models[options.modelId] = new NetworkModel(options);
    this._currentModelId = options.modelId;
    this.save();
    this.trigger('changeCurrentModel');
    return this.models[options.modelId];
  }

  deleteModel(modelId = this.currentModelId) {
    if (!this.models[modelId]) {
      throw new Error(`Can't delete non-existent model: ${modelId}`);
    }

    delete this.models[modelId];

    if (this._currentModelId === modelId) {
      this._currentModelId = null;
      this.trigger('changeCurrentModel');
    }

    this.save();
  }

  deleteAllModels() {
    this.models = {};
    this._currentModelId = null;
    this.save();
    this.trigger('changeCurrentModel');
  }

}

var name = "origraph";
var version = "0.2.3";
var description = "A library for flexible graph reshaping";
var main = "dist/origraph.cjs.js";
var module$1 = "dist/origraph.esm.js";
var browser = "dist/origraph.umd.js";
var scripts = {
	build: "rollup -c --environment TARGET:all",
	watch: "rollup -c -w",
	watchcjs: "rollup -c -w --environment TARGET:cjs",
	watchumd: "rollup -c -w --environment TARGET:umd",
	watchesm: "rollup -c -w --environment TARGET:esm",
	test: "jest --runInBand",
	pretest: "rollup -c --environment TARGET:cjs",
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t --detectOpenHandles",
	coveralls: "cat ./coverage/lcov.info | node node_modules/.bin/coveralls"
};
var files = [
	"dist"
];
var repository = {
	type: "git",
	url: "git+https://github.com/origraph/origraph.js.git"
};
var author = "Alex Bigelow";
var license = "MIT";
var bugs = {
	url: "https://github.com/origraph/origraph.js/issues"
};
var homepage = "https://github.com/origraph/origraph.js#readme";
var devDependencies = {
	"@babel/core": "^7.1.6",
	"@babel/plugin-proposal-async-generator-functions": "^7.1.0",
	"@babel/preset-env": "^7.1.6",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.6.0",
	coveralls: "^3.0.2",
	jest: "^23.6.0",
	rollup: "^0.67.3",
	"rollup-plugin-babel": "^4.0.3",
	"rollup-plugin-commonjs": "^9.2.0",
	"rollup-plugin-istanbul": "^2.0.1",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.4.0",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-string": "^2.0.2",
	sha1: "^1.1.1"
};
var dependencies = {
	datalib: "^1.9.2",
	filereader: "^0.10.3",
	"mime-types": "^2.1.21"
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
	"jsnext:main": "dist/origraph.esm.js",
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

let origraph = new Origraph(window.localStorage);
origraph.version = pkg.version;

export default origraph;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9qZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0LmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL1BhcnNlRmFpbHVyZS5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9EM0pzb24uanMiLCIuLi9zcmMvQ29tbW9uL05ldHdvcmtNb2RlbC5qcyIsIi4uL3NyYy9PcmlncmFwaC5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSB8fFxuICAgICAgICB7ICcnOiBbXSB9O1xuICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnB1c2goY2FsbGJhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSA9IGNhbGxiYWNrO1xuICAgICAgfVxuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXSA9IFtdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnQsIC4uLmFyZ3MpIHtcbiAgICAgIGNvbnN0IGhhbmRsZUNhbGxiYWNrID0gY2FsbGJhY2sgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH07XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgZm9yIChjb25zdCBuYW1lc3BhY2Ugb2YgT2JqZWN0LmtleXModGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pKSB7XG4gICAgICAgICAgaWYgKG5hbWVzcGFjZSA9PT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5mb3JFYWNoKGhhbmRsZUNhbGxiYWNrKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFuZGxlQ2FsbGJhY2sodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zID0gb3B0aW9ucy5kdXBsaWNhdGVJdGVtcyB8fCBbXTtcbiAgfVxuICByZWdpc3RlckR1cGxpY2F0ZSAoaXRlbSkge1xuICAgIHRoaXMuZHVwbGljYXRlSXRlbXMucHVzaChpdGVtKTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBkdXAgb2YgdGhpcy5kdXBsaWNhdGVJdGVtcykge1xuICAgICAgaXRlbS5jb25uZWN0SXRlbShkdXApO1xuICAgICAgZHVwLmNvbm5lY3RJdGVtKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBge1wiY2xhc3NJZFwiOlwiJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XCIsXCJpbmRleFwiOlwiJHt0aGlzLmluZGV4fVwifWA7XG4gIH1cbiAgZ2V0IGV4cG9ydElkICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jbGFzc09iai5jbGFzc0lkfV8ke3RoaXMuaW5kZXh9YDtcbiAgfVxuICBlcXVhbHMgKGl0ZW0pIHtcbiAgICByZXR1cm4gdGhpcy5pbnN0YW5jZUlkID09PSBpdGVtLmluc3RhbmNlSWQ7XG4gIH1cbiAgYXN5bmMgKiBoYW5kbGVMaW1pdCAob3B0aW9ucywgaXRlcmF0b3JzKSB7XG4gICAgbGV0IGxpbWl0ID0gSW5maW5pdHk7XG4gICAgaWYgKG9wdGlvbnMubGltaXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGltaXQgPSBvcHRpb25zLmxpbWl0O1xuICAgICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgfVxuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZXJhdG9yIG9mIGl0ZXJhdG9ycykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGl0ZXJhdG9yKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgIGkrKztcbiAgICAgICAgaWYgKGl0ZW0gPT09IG51bGwgfHwgaSA+PSBsaW1pdCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICAvLyBGaXJzdCBtYWtlIHN1cmUgdGhhdCBhbGwgdGhlIHRhYmxlIGNhY2hlcyBoYXZlIGJlZW4gZnVsbHkgYnVpbHQgYW5kXG4gICAgLy8gY29ubmVjdGVkXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwodGFibGVJZHMubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3NPYmoubW9kZWwudGFibGVzW3RhYmxlSWRdLmJ1aWxkQ2FjaGUoKTtcbiAgICB9KSk7XG4gICAgeWllbGQgKiB0aGlzLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpO1xuICB9XG4gICogX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICBpZiAodGhpcy5yZXNldCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBuZXh0VGFibGVJZCA9IHRhYmxlSWRzWzBdO1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbbmV4dFRhYmxlSWRdIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcmVtYWluaW5nVGFibGVJZHMgPSB0YWJsZUlkcy5zbGljZSgxKTtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmNvbm5lY3RlZEl0ZW1zW25leHRUYWJsZUlkXSB8fCBbXSkge1xuICAgICAgICB5aWVsZCAqIGl0ZW0uX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdUYWJsZUlkcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgVGFibGUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcyA9IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cblxuICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5zdXBwcmVzc2VkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gISFvcHRpb25zLnN1cHByZXNzSW5kZXg7XG5cbiAgICB0aGlzLl9pbmRleEZpbHRlciA9IChvcHRpb25zLmluZGV4RmlsdGVyICYmIHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKG9wdGlvbnMuaW5kZXhGaWx0ZXIpKSB8fCBudWxsO1xuICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuYXR0cmlidXRlRmlsdGVycyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnNbYXR0cl0gPSB0aGlzLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cblxuICAgIHRoaXMuX2xpbWl0UHJvbWlzZXMgPSB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuX2F0dHJpYnV0ZXMsXG4gICAgICBkZXJpdmVkVGFibGVzOiB0aGlzLl9kZXJpdmVkVGFibGVzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge30sXG4gICAgICBzdXBwcmVzc2VkQXR0cmlidXRlczogdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMsXG4gICAgICBzdXBwcmVzc0luZGV4OiB0aGlzLl9zdXBwcmVzc0luZGV4LFxuICAgICAgYXR0cmlidXRlRmlsdGVyczoge30sXG4gICAgICBpbmRleEZpbHRlcjogKHRoaXMuX2luZGV4RmlsdGVyICYmIHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24odGhpcy5faW5kZXhGaWx0ZXIpKSB8fCBudWxsXG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgcmVzdWx0LmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAgcmVzdWx0LmF0dHJpYnV0ZUZpbHRlcnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlO1xuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbihgcmV0dXJuICR7c3RyaW5naWZpZWRGdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgfVxuICBkZWh5ZHJhdGVGdW5jdGlvbiAoZnVuYykge1xuICAgIGxldCBzdHJpbmdpZmllZEZ1bmMgPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgLy8gSXN0YW5idWwgYWRkcyBzb21lIGNvZGUgdG8gZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgY292ZXJhZ2UsIHRoYXQgZ2V0c1xuICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3R3YXJsb3N0L2lzdGFuYnVsL2lzc3Vlcy8zMTAjaXNzdWVjb21tZW50LTI3NDg4OTAyMlxuICAgIHN0cmluZ2lmaWVkRnVuYyA9IHN0cmluZ2lmaWVkRnVuYy5yZXBsYWNlKC9jb3ZfKC4rPylcXCtcXCtbLDtdPy9nLCAnJyk7XG4gICAgcmV0dXJuIHN0cmluZ2lmaWVkRnVuYztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIC8vIFRoZSBjYWNoZSBoYXMgYWxyZWFkeSBiZWVuIGJ1aWx0OyBqdXN0IGdyYWIgZGF0YSBmcm9tIGl0IGRpcmVjdGx5XG4gICAgICB5aWVsZCAqIHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZSAmJiB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoID49IGxpbWl0KSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQsIGJ1dCBpdCdzIGFscmVhZHkgbG9uZyBlbm91Z2ggdG8gc2F0aXNmeSB0aGlzXG4gICAgICAvLyByZXF1ZXN0XG4gICAgICB5aWVsZCAqIHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBjYWNoZSBpc24ndCBmaW5pc2hlZCBidWlsZGluZyAoYW5kIG1heWJlIGRpZG4ndCBldmVuIHN0YXJ0IHlldCk7XG4gICAgICAvLyBraWNrIGl0IG9mZiwgYW5kIHRoZW4gd2FpdCBmb3IgZW5vdWdoIGl0ZW1zIHRvIGJlIHByb2Nlc3NlZCB0byBzYXRpc2Z5XG4gICAgICAvLyB0aGUgbGltaXRcbiAgICAgIHRoaXMuYnVpbGRDYWNoZSgpO1xuICAgICAgeWllbGQgKiBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdID0gdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0gfHwgW107XG4gICAgICAgIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdLnB1c2goeyByZXNvbHZlLCByZWplY3QgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jIF9idWlsZENhY2hlIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgPSB7fTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUoKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSB8fCB0ZW1wID09PSBudWxsKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKSkge1xuICAgICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGRhdGEgbm93IHRvIHNhdGlzZnkgYW55IHdhaXRpbmcgcmVxdWVzdHNcbiAgICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRG9uZSBpdGVyYXRpbmchIFdlIGNhbiBncmFkdWF0ZSB0aGUgcGFydGlhbCBjYWNoZSAvIGxvb2t1cHMgaW50b1xuICAgIC8vIGZpbmlzaGVkIG9uZXMsIGFuZCBzYXRpc2Z5IGFsbCB0aGUgcmVxdWVzdHNcbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIHRoaXMuX2NhY2hlTG9va3VwID0gdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICB9XG4gIGJ1aWxkQ2FjaGUgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuX2NhY2hlUHJvbWlzZSkge1xuICAgICAgdGhpcy5fY2FjaGVQcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyBUaGUgc2V0VGltZW91dCBoZXJlIGlzIGFic29sdXRlbHkgbmVjZXNzYXJ5LCBvciB0aGlzLl9jYWNoZVByb21pc2VcbiAgICAgICAgLy8gd29uJ3QgYmUgc3RvcmVkIGluIHRpbWUgZm9yIHRoZSBuZXh0IGJ1aWxkQ2FjaGUoKSBjYWxsIHRoYXQgY29tZXNcbiAgICAgICAgLy8gdGhyb3VnaFxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICB0aGlzLl9idWlsZENhY2hlKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGNvbnN0IGl0ZW1zVG9SZXNldCA9ICh0aGlzLl9jYWNoZSB8fCBbXSlcbiAgICAgIC5jb25jYXQodGhpcy5fcGFydGlhbENhY2hlIHx8IFtdKTtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXNUb1Jlc2V0KSB7XG4gICAgICBpdGVtLnJlc2V0ID0gdHJ1ZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICBmb3IgKGNvbnN0IGRlcml2ZWRUYWJsZSBvZiB0aGlzLmRlcml2ZWRUYWJsZXMpIHtcbiAgICAgIGRlcml2ZWRUYWJsZS5yZXNldCgpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0Jyk7XG4gIH1cbiAgaGFuZGxlUmVzZXQgKHJlamVjdCkge1xuICAgIGZvciAoY29uc3QgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdLnJlamVjdCgpO1xuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXM7XG4gICAgfVxuICAgIHJlamVjdCgpO1xuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLmJ1aWxkQ2FjaGUoKSkubGVuZ3RoO1xuICB9XG4gIGFzeW5jIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICAgIGlmICh3cmFwcGVkSXRlbS5yb3dbYXR0cl0gaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgd3JhcHBlZEl0ZW0uZGVsYXllZFJvdyA9IHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3cgfHwge307XG4gICAgICAgICAgd3JhcHBlZEl0ZW0uZGVsYXllZFJvd1thdHRyXSA9IGF3YWl0IHdyYXBwZWRJdGVtLnJvd1thdHRyXTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgYXdhaXQgZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgICBpZiAoIWtlZXApIHsgYnJlYWs7IH1cbiAgICB9XG4gICAgaWYgKGtlZXApIHtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3cmFwcGVkSXRlbS5kaXNjb25uZWN0KCk7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaWx0ZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIGtlZXA7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGdldEluZGV4RGV0YWlscyAoKSB7XG4gICAgY29uc3QgZGV0YWlscyA9IHsgbmFtZTogbnVsbCB9O1xuICAgIGlmICh0aGlzLl9zdXBwcmVzc0luZGV4KSB7XG4gICAgICBkZXRhaWxzLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGRldGFpbHMuZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZGV0YWlscztcbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHt9O1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5leHBlY3RlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5vYnNlcnZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZGVyaXZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fYXR0cmlidXRlRmlsdGVycykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5nZXRBdHRyaWJ1dGVEZXRhaWxzKCkpO1xuICB9XG4gIGdldCBjdXJyZW50RGF0YSAoKSB7XG4gICAgLy8gQWxsb3cgcHJvYmluZyB0byBzZWUgd2hhdGV2ZXIgZGF0YSBoYXBwZW5zIHRvIGJlIGF2YWlsYWJsZVxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgW10sXG4gICAgICBsb29rdXA6IHRoaXMuX2NhY2hlTG9va3VwIHx8IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCB8fCB7fSxcbiAgICAgIGNvbXBsZXRlOiAhIXRoaXMuX2NhY2hlXG4gICAgfTtcbiAgfVxuICBhc3luYyBnZXRJdGVtIChpbmRleCA9IG51bGwpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVMb29rdXApIHtcbiAgICAgIHJldHVybiBpbmRleCA9PT0gbnVsbCA/IHRoaXMuX2NhY2hlWzBdIDogdGhpcy5fY2FjaGVbdGhpcy5fY2FjaGVMb29rdXBbaW5kZXhdXTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCAmJlxuICAgICAgICAoKGluZGV4ID09PSBudWxsICYmIHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGggPiAwKSB8fFxuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgIHJldHVybiBpbmRleCA9PT0gbnVsbCA/IHRoaXMuX3BhcnRpYWxDYWNoZVswXVxuICAgICAgICA6IHRoaXMuX3BhcnRpYWxDYWNoZVt0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdXTtcbiAgICB9XG4gICAgLy8gU3R1cGlkIGFwcHJvYWNoIHdoZW4gdGhlIGNhY2hlIGlzbid0IGJ1aWx0OiBpbnRlcmF0ZSB1bnRpbCB3ZSBzZWUgdGhlXG4gICAgLy8gaW5kZXguIFN1YmNsYXNzZXMgY291bGQgb3ZlcnJpZGUgdGhpc1xuICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZXJhdGUoKSkge1xuICAgICAgaWYgKGl0ZW0gPT09IG51bGwgfHwgaXRlbS5pbmRleCA9PT0gaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBzdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZV0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhZGRGaWx0ZXIgKGZ1bmMsIGF0dHJpYnV0ZSA9IG51bGwpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pbmRleEZpbHRlciA9IGZ1bmM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIF9kZXJpdmVUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGUgPSB0aGlzLmRlcml2ZWRUYWJsZXMuZmluZCh0YWJsZU9iaiA9PiB7XG4gICAgICByZXR1cm4gT2JqZWN0LmVudHJpZXMob3B0aW9ucykuZXZlcnkoKFtvcHRpb25OYW1lLCBvcHRpb25WYWx1ZV0pID0+IHtcbiAgICAgICAgaWYgKG9wdGlvbk5hbWUgPT09ICd0eXBlJykge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmpbJ18nICsgb3B0aW9uTmFtZV0gPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gKGV4aXN0aW5nVGFibGUgJiYgdGhpcy5tb2RlbC50YWJsZXNbZXhpc3RpbmdUYWJsZS50YWJsZUlkXSkgfHwgbnVsbDtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ1Byb21vdGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnRXhwYW5kZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdVbnJvbGxlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHZhbHVlcy5tYXAodmFsdWUgPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgdmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlLCBsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgY29uc3QgdmFsdWVzID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUobGltaXQpKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9O1xuICAgICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gaW5kZXhlcy5tYXAoaW5kZXggPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUobGltaXQpKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXg6IHdyYXBwZWRJdGVtLmluZGV4XG4gICAgICB9O1xuICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9XG4gIH1cbiAgZHVwbGljYXRlICgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlVGFibGUoe1xuICAgICAgdHlwZTogJ0R1cGxpY2F0ZWRUYWJsZSdcbiAgICB9KTtcbiAgfVxuICBjb25uZWN0IChvdGhlclRhYmxlTGlzdCwgdHlwZSA9ICdDb25uZWN0ZWRUYWJsZScpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUoeyB0eXBlIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIHByb2plY3QgKHRhYmxlSWRzKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdQcm9qZWN0ZWRUYWJsZScsXG4gICAgICB0YWJsZU9yZGVyOiBbdGhpcy50YWJsZUlkXS5jb25jYXQodGFibGVJZHMpXG4gICAgfSk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgZm9yIChjb25zdCBvdGhlclRhYmxlSWQgb2YgdGFibGVJZHMpIHtcbiAgICAgIGNvbnN0IG90aGVyVGFibGUgPSB0aGlzLm1vZGVsLnRhYmxlc1tvdGhlclRhYmxlSWRdO1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIGdldCBjbGFzc09iaiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZSA9PT0gdGhpcztcbiAgICB9KTtcbiAgfVxuICBnZXQgcGFyZW50VGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKTtcbiAgfVxuICBnZXQgZGVyaXZlZFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXTtcbiAgICB9KTtcbiAgfVxuICBnZXQgaW5Vc2UgKCkge1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5zb21lKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZUlkID09PSB0aGlzLnRhYmxlSWQgfHxcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMSB8fFxuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoZm9yY2UgPSBmYWxzZSkge1xuICAgIGlmICghZm9yY2UgJiYgdGhpcy5pblVzZSkge1xuICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgICAgZXJyLmluVXNlID0gdHJ1ZTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0aGlzLnBhcmVudFRhYmxlcykge1xuICAgICAgZGVsZXRlIHBhcmVudFRhYmxlLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUYWJsZSwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVGFibGUvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IFtdO1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9uYW1lO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aXJlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jb25zdCBBdHRyVGFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKHN1cGVyY2xhc3MpIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mQXR0clRhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgICAgfVxuICAgIH1cbiAgICBfdG9SYXdPYmplY3QgKCkge1xuICAgICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgZ2V0U29ydEhhc2ggKCkge1xuICAgICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgfVxuICAgIGdldCBuYW1lICgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShBdHRyVGFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZkF0dHJUYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IEF0dHJUYWJsZU1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IEF0dHJUYWJsZU1peGluIGZyb20gJy4vQXR0clRhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBQcm9tb3RlZFRhYmxlIGV4dGVuZHMgQXR0clRhYmxlTWl4aW4oVGFibGUpIHtcbiAgYXN5bmMgX2J1aWxkQ2FjaGUgKHJlc29sdmUsIHJlamVjdCkge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugd2UgZG9uJ3QgYWN0dWFsbHkgd2FudCB0byBjYWxsIF9maW5pc2hJdGVtXG4gICAgLy8gdW50aWwgYWxsIHVuaXF1ZSB2YWx1ZXMgaGF2ZSBiZWVuIHNlZW5cbiAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXAgPSB7fTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgPSB7fTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUoKTtcbiAgICBsZXQgdGVtcCA9IHsgZG9uZTogZmFsc2UgfTtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSkge1xuICAgICAgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlIHx8IHRlbXAgPT09IG51bGwpIHtcbiAgICAgICAgLy8gcmVzZXQoKSB3YXMgY2FsbGVkIGJlZm9yZSB3ZSBjb3VsZCBmaW5pc2g7IHdlIG5lZWQgdG8gbGV0IGV2ZXJ5b25lXG4gICAgICAgIC8vIHRoYXQgd2FzIHdhaXRpbmcgb24gdXMga25vdyB0aGF0IHdlIGNhbid0IGNvbXBseVxuICAgICAgICB0aGlzLmhhbmRsZVJlc2V0KHJlamVjdCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghdGVtcC5kb25lKSB7XG4gICAgICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFt0ZW1wLnZhbHVlLmluZGV4XSA9IHRoaXMuX3VuZmluaXNoZWRDYWNoZS5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZS5wdXNoKHRlbXAudmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBPa2F5LCBub3cgd2UndmUgc2VlbiBldmVyeXRoaW5nOyB3ZSBjYW4gY2FsbCBfZmluaXNoSXRlbSBvbiBlYWNoIG9mIHRoZVxuICAgIC8vIHVuaXF1ZSB2YWx1ZXNcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCB2YWx1ZSBvZiB0aGlzLl91bmZpbmlzaGVkQ2FjaGUpIHtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKHZhbHVlKSkge1xuICAgICAgICAvLyBPa2F5LCB0aGlzIGl0ZW0gcGFzc2VkIGFsbCBmaWx0ZXJzLCBhbmQgaXMgcmVhZHkgdG8gYmUgc2VudCBvdXRcbiAgICAgICAgLy8gaW50byB0aGUgd29ybGRcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW3ZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZS5wdXNoKHZhbHVlKTtcbiAgICAgICAgaSsrO1xuICAgICAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgaWYgKGxpbWl0IDw9IGkpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRG9uZSBpdGVyYXRpbmchIFdlIGNhbiBncmFkdWF0ZSB0aGUgcGFydGlhbCBjYWNoZSAvIGxvb2t1cHMgaW50b1xuICAgIC8vIGZpbmlzaGVkIG9uZXMsIGFuZCBzYXRpc2Z5IGFsbCB0aGUgcmVxdWVzdHNcbiAgICBkZWxldGUgdGhpcy5fdW5maW5pc2hlZENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXA7XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgaW5kZXggPSBTdHJpbmcoYXdhaXQgd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0IVxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0l0ZW0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGVbdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZSArIHRoaXMuX3ZhbHVlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gU3RyaW5nKHRoaXMuX3ZhbHVlKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBpZiAoYXdhaXQgd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gTm9ybWFsIGZhY2V0aW5nIGp1c3QgZ2l2ZXMgYSBzdWJzZXQgb2YgdGhlIG9yaWdpbmFsIHRhYmxlXG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IE9iamVjdC5hc3NpZ24oe30sIHdyYXBwZWRQYXJlbnQucm93KSxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmFjZXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBUcmFuc3Bvc2VkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2luZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5faW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5pbmRleCA9IHRoaXMuX2luZGV4O1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5faW5kZXg7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLl9pbmRleH1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIC8vIFByZS1idWlsZCB0aGUgcGFyZW50IHRhYmxlJ3MgY2FjaGVcbiAgICBhd2FpdCB0aGlzLnBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcblxuICAgIC8vIEl0ZXJhdGUgdGhlIHJvdydzIGF0dHJpYnV0ZXMgYXMgaW5kZXhlc1xuICAgIGNvbnN0IHdyYXBwZWRQYXJlbnQgPSB0aGlzLnBhcmVudFRhYmxlLl9jYWNoZVt0aGlzLnBhcmVudFRhYmxlLl9jYWNoZUxvb2t1cFt0aGlzLl9pbmRleF1dIHx8IHsgcm93OiB7fSB9O1xuICAgIGZvciAoY29uc3QgWyBpbmRleCwgdmFsdWUgXSBvZiBPYmplY3QuZW50cmllcyh3cmFwcGVkUGFyZW50LnJvdykpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJz0nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignPScpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIERvbid0IHRyeSB0byBjb25uZWN0IHZhbHVlcyB1bnRpbCBhbGwgb2YgdGhlIHBhcmVudCB0YWJsZXMnIGNhY2hlcyBhcmVcbiAgICAvLyBidWlsdDsgVE9ETzogbWlnaHQgYmUgYWJsZSB0byBkbyBzb21ldGhpbmcgbW9yZSByZXNwb25zaXZlIGhlcmU/XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwocGFyZW50VGFibGVzLm1hcChwVGFibGUgPT4gcFRhYmxlLmJ1aWxkQ2FjaGUoKSkpO1xuXG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGVMb29rdXApIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cCkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldFxuICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAvLyBObyBtYXRjaCBpbiBvbmUgb2YgdGhlIG90aGVyIHRhYmxlczsgb21pdCB0aGlzIGl0ZW1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBhZGQgZWFjaCBwYXJlbnQgdGFibGVzJyBrZXlzIGFzIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBwYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLl9jYWNoZVt0YWJsZS5fY2FjaGVMb29rdXBbaW5kZXhdXSlcbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBEdXBsaWNhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gWWllbGQgdGhlIHNhbWUgaXRlbXMgd2l0aCB0aGUgc2FtZSBjb25uZWN0aW9ucywgYnV0IHdyYXBwZWQgYW5kIGZpbmlzaGVkXG4gICAgLy8gYnkgdGhpcyB0YWJsZVxuICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleDogaXRlbS5pbmRleCxcbiAgICAgICAgcm93OiBpdGVtLnJvdyxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IE9iamVjdC52YWx1ZXMoaXRlbS5jb25uZWN0ZWRJdGVtcykucmVkdWNlKChhZ2csIGl0ZW1MaXN0KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoaXRlbUxpc3QpO1xuICAgICAgICB9LCBbXSlcbiAgICAgIH0pO1xuICAgICAgaXRlbS5yZWdpc3RlckR1cGxpY2F0ZShuZXdJdGVtKTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBEdXBsaWNhdGVkVGFibGU7XG4iLCJpbXBvcnQgQXR0clRhYmxlTWl4aW4gZnJvbSAnLi9BdHRyVGFibGVNaXhpbi5qcyc7XG5cbmNvbnN0IENoaWxkVGFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIEF0dHJUYWJsZU1peGluKHN1cGVyY2xhc3MpIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mQ2hpbGRUYWJsZU1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSBzdXBlci5fd3JhcChvcHRpb25zKTtcbiAgICAgIG5ld0l0ZW0ucGFyZW50SW5kZXggPSBvcHRpb25zLnBhcmVudEluZGV4O1xuICAgICAgcmV0dXJuIG5ld0l0ZW07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDaGlsZFRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQ2hpbGRUYWJsZU1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IENoaWxkVGFibGVNaXhpbiBmcm9tICcuL0NoaWxkVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBDaGlsZFRhYmxlTWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHJvdyA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93ICE9PSB1bmRlZmluZWQgJiYgcm93ICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHJvdykubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICBwYXJlbnRJbmRleDogd3JhcHBlZFBhcmVudC5pbmRleFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgQ2hpbGRUYWJsZU1peGluIGZyb20gJy4vQ2hpbGRUYWJsZU1peGluLmpzJztcblxuY2xhc3MgVW5yb2xsZWRUYWJsZSBleHRlbmRzIENoaWxkVGFibGVNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3Qgcm93cyA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93cyAhPT0gdW5kZWZpbmVkICYmIHJvd3MgIT09IG51bGwgJiZcbiAgICAgICAgICB0eXBlb2Ygcm93c1tTeW1ib2wuaXRlcmF0b3JdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZvciAoY29uc3Qgcm93IG9mIHJvd3MpIHtcbiAgICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIHJvdyxcbiAgICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICAgIHBhcmVudEluZGV4OiB3cmFwcGVkUGFyZW50LmluZGV4XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVW5yb2xsZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgUGFyZW50Q2hpbGRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbignLycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5nZXRTb3J0SGFzaCgpKS5qb2luKCcsJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IHBhcmVudFRhYmxlLCBjaGlsZFRhYmxlO1xuICAgIGlmICh0aGlzLnBhcmVudFRhYmxlc1swXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMV0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgfSBlbHNlIGlmICh0aGlzLnBhcmVudFRhYmxlc1sxXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMF0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50Q2hpbGRUYWJsZSBub3Qgc2V0IHVwIHByb3Blcmx5YCk7XG4gICAgfVxuXG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNoaWxkIG9mIGNoaWxkVGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBwYXJlbnQgPSBhd2FpdCBwYXJlbnRUYWJsZS5nZXRJdGVtKGNoaWxkLnBhcmVudEluZGV4KTtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbcGFyZW50LCBjaGlsZF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFBhcmVudENoaWxkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFByb2plY3RlZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMudGFibGVPcmRlciA9IG9wdGlvbnMudGFibGVPcmRlcjtcbiAgICBpZiAoIXRoaXMudGFibGVPcmRlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZU9yZGVyIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZU9yZGVyLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMudGFibGVPcmRlclxuICAgICAgLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLmdldFNvcnRIYXNoKCkpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgY29uc3QgZmlyc3RUYWJsZSA9IHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVPcmRlclswXV07XG4gICAgY29uc3QgcmVtYWluaW5nSWRzID0gdGhpcy50YWJsZU9yZGVyLnNsaWNlKDEpO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlSXRlbSBvZiBmaXJzdFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBsYXN0SXRlbSBvZiBzb3VyY2VJdGVtLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdJZHMpKSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleDogc291cmNlSXRlbS5pbmRleCArICfiqK8nICsgbGFzdEl0ZW0uaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFtzb3VyY2VJdGVtLCBsYXN0SXRlbV1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCBzZWxmLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUHJvamVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSArIHRoaXMuY2xhc3NOYW1lO1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lICE9PSBudWxsO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHwgdGhpcy50YWJsZS5uYW1lO1xuICB9XG4gIGdldCB2YXJpYWJsZU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUudG9Mb2NhbGVMb3dlckNhc2UoKSArICdfJyArXG4gICAgICB0aGlzLmNsYXNzTmFtZVxuICAgICAgICAuc3BsaXQoL1xcVysvZylcbiAgICAgICAgLmZpbHRlcihkID0+IGQubGVuZ3RoID4gMClcbiAgICAgICAgLm1hcChkID0+IGRbMF0udG9Mb2NhbGVVcHBlckNhc2UoKSArIGQuc2xpY2UoMSkpXG4gICAgICAgIC5qb2luKCcnKTtcbiAgfVxuICBnZXQgdGFibGUgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICB9XG4gIGdldCBkZWxldGVkICgpIHtcbiAgICByZXR1cm4gIXRoaXMubW9kZWwuZGVsZXRlZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIF9kZXJpdmVOZXdDbGFzcyAobmV3VGFibGUsIHR5cGUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgdHlwZVxuICAgIH0pO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLCAnR2VuZXJpY0NsYXNzJyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5leHBhbmQoYXR0cmlidXRlKSk7XG4gIH1cbiAgdW5yb2xsIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS51bnJvbGwoYXR0cmlidXRlKSk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkVHJhbnNwb3NlKGluZGV4ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAoKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5UcmFuc3Bvc2UoKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLm1vZGVsLm9wdGltaXplVGFibGVzKCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0ge30pIHtcbiAgICBsZXQgZWRnZUlkcyA9IG9wdGlvbnMuY2xhc3Nlc1xuICAgICAgPyBvcHRpb25zLmNsYXNzZXMubWFwKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzSWQpXG4gICAgICA6IG9wdGlvbnMuY2xhc3NJZHMgfHwgT2JqZWN0LmtleXModGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IGl0ZXJhdG9ycyA9IFtdO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIGVkZ2VJZHMpIHtcbiAgICAgIGlmICghdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHNbZWRnZUlkXSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuY2xhc3NPYmoubW9kZWwuY2xhc3Nlc1tlZGdlSWRdO1xuICAgICAgY29uc3Qgcm9sZSA9IHRoaXMuY2xhc3NPYmouZ2V0RWRnZVJvbGUoZWRnZUNsYXNzKTtcbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAndGFyZ2V0Jykge1xuICAgICAgICBjb25zdCB0YWJsZUlkcyA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGl0ZXJhdG9ycy5wdXNoKHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBpdGVyYXRvcnMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgKiBlZGdlQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGdldEVkZ2VSb2xlIChlZGdlQ2xhc3MpIHtcbiAgICBpZiAoIXRoaXMuZWRnZUNsYXNzSWRzW2VkZ2VDbGFzcy5jbGFzc0lkXSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICByZXR1cm4gJ2JvdGgnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdzb3VyY2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgcmV0dXJuICd0YXJnZXQnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIG1pc21hdGNoIGJldHdlZW4gbm9kZSBhbmQgZWRnZSBjbGFzc0lkc2ApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBOb2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICh7IGF1dG9jb25uZWN0ID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmICghYXV0b2Nvbm5lY3QgfHwgZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgLy8gQXJlIHdlIHRoZSBzb3VyY2Ugb3IgdGFyZ2V0IG9mIHRoZSBleGlzdGluZyBlZGdlIChpbnRlcm5hbGx5LCBpbiB0ZXJtc1xuICAgICAgLy8gb2Ygc291cmNlSWQgLyB0YXJnZXRJZCwgbm90IGVkZ2VDbGFzcy5kaXJlY3Rpb24pP1xuICAgICAgY29uc3QgaXNTb3VyY2UgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkO1xuXG4gICAgICAvLyBBcyB3ZSdyZSBjb252ZXJ0ZWQgdG8gYW4gZWRnZSwgb3VyIG5ldyByZXN1bHRpbmcgc291cmNlIEFORCB0YXJnZXRcbiAgICAgIC8vIHNob3VsZCBiZSB3aGF0ZXZlciBpcyBhdCB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcyAoaWYgYW55dGhpbmcpXG4gICAgICBpZiAoaXNTb3VyY2UpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAvLyBPa2F5LCB3ZSd2ZSBnb3QgdHdvIGVkZ2VzLCBzbyB0aGlzIGlzIGEgbGl0dGxlIG1vcmUgc3RyYWlnaHRmb3J3YXJkXG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgLy8gQWRkIHRoaXMgY2xhc3MgdG8gdGhlIHNvdXJjZSdzIC8gdGFyZ2V0J3MgZWRnZUNsYXNzSWRzXG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBleGlzdGluZyBlZGdlIGNsYXNzZXMgZnJvbSB0aGUgbmV3IChub3cgZWRnZSkgY2xhc3NcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfVxuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgbGV0IHRoaXNIYXNoLCBvdGhlckhhc2gsIHNvdXJjZVRhYmxlSWRzLCB0YXJnZXRUYWJsZUlkcztcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGU7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbIHRoaXNIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgaWYgKG90aGVyQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlLnByb21vdGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbIG90aGVySGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSksICdOb2RlQ2xhc3MnKTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIChjaGlsZENsYXNzKSB7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3QoW2NoaWxkQ2xhc3MudGFibGVdLCAnUGFyZW50Q2hpbGRUYWJsZScpO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogY2hpbGRDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBjaGlsZENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgdW5yb2xsIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLnVucm9sbChhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgcHJvamVjdE5ld0VkZ2UgKGNsYXNzSWRMaXN0KSB7XG4gICAgY29uc3QgY2xhc3NMaXN0ID0gW3RoaXNdLmNvbmNhdChjbGFzc0lkTGlzdC5tYXAoY2xhc3NJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC5jbGFzc2VzW2NsYXNzSWRdO1xuICAgIH0pKTtcbiAgICBpZiAoY2xhc3NMaXN0Lmxlbmd0aCA8IDMgfHwgY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS50eXBlICE9PSAnTm9kZScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjbGFzc0lkTGlzdGApO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VDbGFzc0lkID0gdGhpcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzSWQgPSBjbGFzc0xpc3RbY2xhc3NMaXN0Lmxlbmd0aCAtIDFdLmNsYXNzSWQ7XG4gICAgbGV0IHRhYmxlT3JkZXIgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGNsYXNzTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgY2xhc3NPYmogPSBjbGFzc0xpc3RbaV07XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIHRhYmxlT3JkZXIucHVzaChjbGFzc09iai50YWJsZUlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGVkZ2VSb2xlID0gY2xhc3NMaXN0W2kgLSAxXS5nZXRFZGdlUm9sZShjbGFzc09iaik7XG4gICAgICAgIGlmIChlZGdlUm9sZSA9PT0gJ3NvdXJjZScgfHwgZWRnZVJvbGUgPT09ICdib3RoJykge1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChcbiAgICAgICAgICAgIEFycmF5LmZyb20oY2xhc3NPYmouc291cmNlVGFibGVJZHMpLnJldmVyc2UoKSk7XG4gICAgICAgICAgdGFibGVPcmRlci5wdXNoKGNsYXNzT2JqLnRhYmxlSWQpO1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChjbGFzc09iai50YXJnZXRUYWJsZUlkcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGFibGVPcmRlciA9IHRhYmxlT3JkZXIuY29uY2F0KFxuICAgICAgICAgICAgQXJyYXkuZnJvbShjbGFzc09iai50YXJnZXRUYWJsZUlkcykucmV2ZXJzZSgpKTtcbiAgICAgICAgICB0YWJsZU9yZGVyLnB1c2goY2xhc3NPYmoudGFibGVJZCk7XG4gICAgICAgICAgdGFibGVPcmRlciA9IHRhYmxlT3JkZXIuY29uY2F0KGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMudGFibGUucHJvamVjdCh0YWJsZU9yZGVyKTtcbiAgICBjb25zdCBuZXdDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZCxcbiAgICAgIHRhcmdldENsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkczogW10sXG4gICAgICB0YXJnZXRUYWJsZUlkczogW11cbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS5lZGdlQ2xhc3NJZHNbbmV3Q2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHJldHVybiBuZXdDbGFzcztcbiAgfVxuICBkaXNjb25uZWN0QWxsRWRnZXMgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiB0aGlzLmNvbm5lY3RlZENsYXNzZXMoKSkge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2Uob3B0aW9ucyk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogc291cmNlTm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlVGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZF0udGFibGVJZDtcbiAgICBjb25zdCB0YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHMuY29uY2F0KFsgc291cmNlVGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkXS50YWJsZUlkO1xuICAgIGNvbnN0IHRhYmxlSWRzID0gdGhpcy5jbGFzc09iai50YXJnZXRUYWJsZUlkcy5jb25jYXQoWyB0YXJnZXRUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIG5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSxcbiAgICAgIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucylcbiAgICBdKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuaW1wb3J0IEVkZ2VXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIHNvdXJjZVRhYmxlSWRzIGFuZCB0YXJnZXRUYWJsZUlkcyBhcmUgbGlzdHMgb2YgYW55IGludGVybWVkaWF0ZSB0YWJsZXMsXG4gICAgLy8gYmVnaW5uaW5nIHdpdGggdGhlIGVkZ2UgdGFibGUgKGJ1dCBub3QgaW5jbHVkaW5nIGl0KSwgdGhhdCBsZWFkIHRvIHRoZVxuICAgIC8vIHNvdXJjZSAvIHRhcmdldCBub2RlIHRhYmxlcyAoYnV0IG5vdCBpbmNsdWRpbmcpIHRob3NlXG5cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8XG4gICAgICAoKHRoaXMuc291cmNlQ2xhc3MgJiYgdGhpcy5zb3VyY2VDbGFzcy5jbGFzc05hbWUpIHx8ICc/JykgK1xuICAgICAgJy0nICtcbiAgICAgICgodGhpcy50YXJnZXRDbGFzcyAmJiB0aGlzLnRhcmdldENsYXNzLmNsYXNzTmFtZSkgfHwgJz8nKTtcbiAgfVxuICBnZXQgc291cmNlQ2xhc3MgKCkge1xuICAgIHJldHVybiAodGhpcy5zb3VyY2VDbGFzc0lkICYmIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdKSB8fCBudWxsO1xuICB9XG4gIGdldCB0YXJnZXRDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnRhcmdldENsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC5zb3VyY2VUYWJsZUlkcyA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldFRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEVkZ2VXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIF9zcGxpdFRhYmxlSWRMaXN0ICh0YWJsZUlkTGlzdCwgb3RoZXJDbGFzcykge1xuICAgIGxldCByZXN1bHQgPSB7XG4gICAgICBub2RlVGFibGVJZExpc3Q6IFtdLFxuICAgICAgZWRnZVRhYmxlSWQ6IG51bGwsXG4gICAgICBlZGdlVGFibGVJZExpc3Q6IFtdXG4gICAgfTtcbiAgICBpZiAodGFibGVJZExpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBXZWlyZCBjb3JuZXIgY2FzZSB3aGVyZSB3ZSdyZSB0cnlpbmcgdG8gY3JlYXRlIGFuIGVkZ2UgYmV0d2VlblxuICAgICAgLy8gYWRqYWNlbnQgb3IgaWRlbnRpY2FsIHRhYmxlcy4uLiBjcmVhdGUgYSBDb25uZWN0ZWRUYWJsZVxuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGhpcy50YWJsZS5jb25uZWN0KG90aGVyQ2xhc3MudGFibGUpLnRhYmxlSWQ7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgYSB0YWJsZSBpbiB0aGUgbWlkZGxlIGFzIHRoZSBuZXcgZWRnZSB0YWJsZTsgcHJpb3JpdGl6ZVxuICAgICAgLy8gU3RhdGljVGFibGUgYW5kIFN0YXRpY0RpY3RUYWJsZVxuICAgICAgbGV0IHN0YXRpY0V4aXN0cyA9IGZhbHNlO1xuICAgICAgbGV0IHRhYmxlRGlzdGFuY2VzID0gdGFibGVJZExpc3QubWFwKCh0YWJsZUlkLCBpbmRleCkgPT4ge1xuICAgICAgICBzdGF0aWNFeGlzdHMgPSBzdGF0aWNFeGlzdHMgfHwgdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgcmV0dXJuIHsgdGFibGVJZCwgaW5kZXgsIGRpc3Q6IE1hdGguYWJzKHRhYmxlSWRMaXN0IC8gMiAtIGluZGV4KSB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIHRhYmxlRGlzdGFuY2VzID0gdGFibGVEaXN0YW5jZXMuZmlsdGVyKCh7IHRhYmxlSWQgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHsgdGFibGVJZCwgaW5kZXggfSA9IHRhYmxlRGlzdGFuY2VzLnNvcnQoKGEsIGIpID0+IGEuZGlzdCAtIGIuZGlzdClbMF07XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0YWJsZUlkO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKDAsIGluZGV4KS5yZXZlcnNlKCk7XG4gICAgICByZXN1bHQubm9kZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoaW5kZXggKyAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICB0ZW1wLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICB0ZW1wLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh0ZW1wKTtcblxuICAgIGlmICh0ZW1wLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RlbXAuc291cmNlQ2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC5zb3VyY2VUYWJsZUlkcywgc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IHRlbXAuc291cmNlQ2xhc3NJZCxcbiAgICAgICAgc291cmNlVGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0ZW1wLnRhcmdldENsYXNzSWQgJiYgdGVtcC5zb3VyY2VDbGFzc0lkICE9PSB0ZW1wLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RlbXAudGFyZ2V0Q2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC50YXJnZXRUYWJsZUlkcywgdGFyZ2V0Q2xhc3MpO1xuICAgICAgY29uc3QgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiB0ZW1wLnRhcmdldENsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBub2RlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLnNpZGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2Uob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLnNpZGUgPT09ICd0YXJnZXQnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUG9saXRpY2FsT3V0c2lkZXJFcnJvcjogXCIke29wdGlvbnMuc2lkZX1cIiBpcyBhbiBpbnZhbGlkIHNpZGVgKTtcbiAgICB9XG4gIH1cbiAgdG9nZ2xlRGlyZWN0aW9uIChkaXJlY3RlZCkge1xuICAgIGlmIChkaXJlY3RlZCA9PT0gZmFsc2UgfHwgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBkZWxldGUgdGhpcy5zd2FwcGVkRGlyZWN0aW9uO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZGlyZWN0ZWQpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERpcmVjdGVkIHdhcyBhbHJlYWR5IHRydWUsIGp1c3Qgc3dpdGNoIHNvdXJjZSBhbmQgdGFyZ2V0XG4gICAgICBsZXQgdGVtcCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IHRlbXA7XG4gICAgICB0ZW1wID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IHRlbXA7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RTb3VyY2UgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgfVxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyBzb3VyY2VDbGFzcy50YWJsZSA6IHNvdXJjZUNsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLnByb21vdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gdGFyZ2V0Q2xhc3MudGFibGUgOiB0YXJnZXRDbGFzcy50YWJsZS5wcm9tb3RlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZSAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdTb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1NvdXJjZUNsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdTb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1RhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nVGFyZ2V0Q2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1RhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICByZXR1cm4gc3VwZXIucHJvbW90ZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdGFibGVJZDogdGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgICAgdHlwZTogJ05vZGVDbGFzcydcbiAgICAgIH0pO1xuICAgICAgdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgICBub2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgICAgc2lkZTogIXRoaXMuc291cmNlQ2xhc3NJZCA/ICdzb3VyY2UnIDogJ3RhcmdldCcsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IGF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICAgIH1cbiAgfVxuICBjb25uZWN0RmFjZXRlZENsYXNzIChuZXdFZGdlQ2xhc3MpIHtcbiAgICAvLyBXaGVuIGFuIGVkZ2UgY2xhc3MgaXMgZmFjZXRlZCwgd2Ugd2FudCB0byBrZWVwIHRoZSBzYW1lIGNvbm5lY3Rpb25zLiBUaGlzXG4gICAgLy8gbWVhbnMgd2UgbmVlZCB0byBjbG9uZSBlYWNoIHRhYmxlIGNoYWluLCBhbmQgYWRkIG91ciBvd24gdGFibGUgdG8gaXRcbiAgICAvLyAoYmVjYXVzZSBvdXIgdGFibGUgaXMgdGhlIHBhcmVudFRhYmxlIG9mIHRoZSBuZXcgb25lKVxuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIG5ld0VkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBuZXdFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcyA9IEFycmF5LmZyb20odGhpcy50YXJnZXRUYWJsZUlkcyk7XG4gICAgICBuZXdFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0aGlzLnRhYmxlSWQpO1xuICAgICAgdGhpcy50YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICBjb25zdCBuZXdDbGFzc2VzID0gc3VwZXIuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpO1xuICAgIGZvciAoY29uc3QgbmV3Q2xhc3Mgb2YgbmV3Q2xhc3Nlcykge1xuICAgICAgdGhpcy5jb25uZWN0RmFjZXRlZENsYXNzKG5ld0NsYXNzKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld0NsYXNzZXM7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3Q2xhc3Mgb2Ygc3VwZXIub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHRoaXMuY29ubmVjdEZhY2V0ZWRDbGFzcyhuZXdDbGFzcyk7XG4gICAgICB5aWVsZCBuZXdDbGFzcztcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJjbGFzcyBGaWxlRm9ybWF0IHtcbiAgYXN5bmMgYnVpbGRSb3cgKGl0ZW0pIHtcbiAgICBjb25zdCByb3cgPSB7fTtcbiAgICBmb3IgKGxldCBhdHRyIGluIGl0ZW0ucm93KSB7XG4gICAgICByb3dbYXR0cl0gPSBhd2FpdCBpdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgcmV0dXJuIHJvdztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmlsZUZvcm1hdDtcbiIsImNsYXNzIFBhcnNlRmFpbHVyZSBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IgKGZpbGVGb3JtYXQpIHtcbiAgICBzdXBlcihgRmFpbGVkIHRvIHBhcnNlIGZvcm1hdDogJHtmaWxlRm9ybWF0LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFBhcnNlRmFpbHVyZTtcbiIsImltcG9ydCBGaWxlRm9ybWF0IGZyb20gJy4vRmlsZUZvcm1hdC5qcyc7XG5pbXBvcnQgUGFyc2VGYWlsdXJlIGZyb20gJy4vUGFyc2VGYWlsdXJlLmpzJztcblxuY29uc3QgTk9ERV9OQU1FUyA9IFsnbm9kZXMnLCAnTm9kZXMnXTtcbmNvbnN0IEVER0VfTkFNRVMgPSBbJ2VkZ2VzJywgJ2xpbmtzJywgJ0VkZ2VzJywgJ0xpbmtzJ107XG5cbmNsYXNzIEQzSnNvbiBleHRlbmRzIEZpbGVGb3JtYXQge1xuICBhc3luYyBpbXBvcnREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgdGV4dCxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBzb3VyY2VBdHRyaWJ1dGUgPSAnc291cmNlJyxcbiAgICB0YXJnZXRBdHRyaWJ1dGUgPSAndGFyZ2V0JyxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9IG51bGxcbiAgfSkge1xuICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKHRleHQpO1xuICAgIGNvbnN0IG5vZGVOYW1lID0gTk9ERV9OQU1FUy5maW5kKG5hbWUgPT4gZGF0YVtuYW1lXSBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICBjb25zdCBlZGdlTmFtZSA9IEVER0VfTkFNRVMuZmluZChuYW1lID0+IGRhdGFbbmFtZV0gaW5zdGFuY2VvZiBBcnJheSk7XG4gICAgaWYgKCFub2RlTmFtZSB8fCAhZWRnZU5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZUZhaWx1cmUodGhpcyk7XG4gICAgfVxuXG4gICAgY29uc3QgY29yZVRhYmxlID0gbW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ1N0YXRpY0RpY3RUYWJsZScsXG4gICAgICBuYW1lOiAnY29yZVRhYmxlJyxcbiAgICAgIGRhdGE6IGRhdGFcbiAgICB9KTtcbiAgICBjb25zdCBjb3JlQ2xhc3MgPSBtb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvcmVUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gICAgbGV0IFtub2RlcywgZWRnZXNdID0gY29yZUNsYXNzLmNsb3NlZFRyYW5zcG9zZShbbm9kZU5hbWUsIGVkZ2VOYW1lXSk7XG5cbiAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgIGlmIChub2RlQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgaW1wb3J0IGNsYXNzZXMgZnJvbSBEMy1zdHlsZSBKU09OIHdpdGhvdXQgbm9kZUF0dHJpYnV0ZWApO1xuICAgICAgfVxuICAgICAgY29uc3Qgbm9kZUNsYXNzZXMgPSBbXTtcbiAgICAgIGNvbnN0IG5vZGVDbGFzc0xvb2t1cCA9IHt9O1xuICAgICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZUNsYXNzIG9mIG5vZGVzLm9wZW5GYWNldChjbGFzc0F0dHJpYnV0ZSkpIHtcbiAgICAgICAgbm9kZUNsYXNzTG9va3VwW25vZGVDbGFzcy5jbGFzc05hbWVdID0gbm9kZUNsYXNzZXMubGVuZ3RoO1xuICAgICAgICBub2RlQ2xhc3Nlcy5wdXNoKG5vZGVDbGFzcy5pbnRlcnByZXRBc05vZGVzKCkpO1xuICAgICAgfVxuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZXMub3BlbkZhY2V0KGNsYXNzQXR0cmlidXRlKSkge1xuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGVkZ2VDbGFzcy5pbnRlcnByZXRBc0VkZ2VzKCkpO1xuICAgICAgICBjb25zdCBzYW1wbGUgPSBhd2FpdCBlZGdlQ2xhc3MudGFibGUuZ2V0SXRlbSgpO1xuICAgICAgICBjb25zdCBzb3VyY2VDbGFzc05hbWUgPSBzYW1wbGUucm93W3NvdXJjZUF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXTtcbiAgICAgICAgaWYgKG5vZGVDbGFzc0xvb2t1cFtzb3VyY2VDbGFzc05hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgICAgIG5vZGVDbGFzczogbm9kZUNsYXNzZXNbbm9kZUNsYXNzTG9va3VwW3NvdXJjZUNsYXNzTmFtZV1dLFxuICAgICAgICAgICAgc2lkZTogJ3NvdXJjZScsXG4gICAgICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICAgICAgZWRnZUF0dHJpYnV0ZTogc291cmNlQXR0cmlidXRlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGFyZ2V0Q2xhc3NOYW1lID0gc2FtcGxlLnJvd1t0YXJnZXRBdHRyaWJ1dGUgKyAnXycgKyBjbGFzc0F0dHJpYnV0ZV07XG4gICAgICAgIGlmIChub2RlQ2xhc3NMb29rdXBbdGFyZ2V0Q2xhc3NOYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgICAgICBub2RlQ2xhc3M6IG5vZGVDbGFzc2VzW25vZGVDbGFzc0xvb2t1cFt0YXJnZXRDbGFzc05hbWVdXSxcbiAgICAgICAgICAgIHNpZGU6ICd0YXJnZXQnLFxuICAgICAgICAgICAgbm9kZUF0dHJpYnV0ZSxcbiAgICAgICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHRhcmdldEF0dHJpYnV0ZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGVzID0gbm9kZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgICAgbm9kZXMuc2V0Q2xhc3NOYW1lKG5vZGVOYW1lKTtcbiAgICAgIGVkZ2VzID0gZWRnZXMuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgICAgZWRnZXMuc2V0Q2xhc3NOYW1lKGVkZ2VOYW1lKTtcbiAgICAgIG5vZGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICAgIGVkZ2VDbGFzczogZWRnZXMsXG4gICAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICBlZGdlQXR0cmlidXRlOiBzb3VyY2VBdHRyaWJ1dGVcbiAgICAgIH0pO1xuICAgICAgbm9kZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgICAgZWRnZUNsYXNzOiBlZGdlcyxcbiAgICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHRhcmdldEF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICBpbmNsdWRlQ2xhc3NlcyA9IE9iamVjdC52YWx1ZXMobW9kZWwuY2xhc3NlcyksXG4gICAgcHJldHR5ID0gdHJ1ZSxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBzb3VyY2VBdHRyaWJ1dGUgPSAnc291cmNlJyxcbiAgICB0YXJnZXRBdHRyaWJ1dGUgPSAndGFyZ2V0JyxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9IG51bGxcbiAgfSkge1xuICAgIGlmIChjbGFzc0F0dHJpYnV0ZSAmJiAhbm9kZUF0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBleHBvcnQgRDMtc3R5bGUgSlNPTiB3aXRoIGNsYXNzZXMsIHdpdGhvdXQgYSBub2RlQXR0cmlidXRlYCk7XG4gICAgfVxuICAgIGxldCByZXN1bHQgPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBsaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IG5vZGVMb29rdXAgPSB7fTtcbiAgICBjb25zdCBub2RlQ2xhc3NlcyA9IFtdO1xuICAgIGNvbnN0IGVkZ2VDbGFzc2VzID0gW107XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBpbmNsdWRlQ2xhc3Nlcykge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBub2RlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0Lm90aGVyID0gcmVzdWx0Lm90aGVyIHx8IFtdO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgcmVzdWx0Lm90aGVyLnB1c2goYXdhaXQgdGhpcy5idWlsZFJvdyhpdGVtKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBub2RlQ2xhc3Mgb2Ygbm9kZUNsYXNzZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBub2RlQ2xhc3MudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgIG5vZGVMb29rdXBbbm9kZS5leHBvcnRJZF0gPSByZXN1bHQubm9kZXMubGVuZ3RoO1xuICAgICAgICBjb25zdCByb3cgPSBhd2FpdCB0aGlzLmJ1aWxkUm93KG5vZGUpO1xuICAgICAgICBpZiAobm9kZUF0dHJpYnV0ZSkge1xuICAgICAgICAgIHJvd1tub2RlQXR0cmlidXRlXSA9IG5vZGUuZXhwb3J0SWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNsYXNzQXR0cmlidXRlKSB7XG4gICAgICAgICAgcm93W2NsYXNzQXR0cmlidXRlXSA9IG5vZGUuY2xhc3NPYmouY2xhc3NOYW1lO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5ub2Rlcy5wdXNoKHJvdyk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIGVkZ2VDbGFzc2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgZWRnZUNsYXNzLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICBjb25zdCByb3cgPSBhd2FpdCB0aGlzLmJ1aWxkUm93KGVkZ2UpO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiBlZGdlLnNvdXJjZU5vZGVzKHsgY2xhc3Nlczogbm9kZUNsYXNzZXMgfSkpIHtcbiAgICAgICAgICByb3dbc291cmNlQXR0cmlidXRlXSA9IG5vZGVBdHRyaWJ1dGUgPyBzb3VyY2UuZXhwb3J0SWQgOiBub2RlTG9va3VwW3NvdXJjZS5leHBvcnRJZF07XG4gICAgICAgICAgaWYgKGNsYXNzQXR0cmlidXRlKSB7XG4gICAgICAgICAgICByb3dbc291cmNlQXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdID0gc291cmNlLmNsYXNzT2JqLmNsYXNzTmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgZWRnZS50YXJnZXROb2Rlcyh7IGNsYXNzZXM6IG5vZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgICByb3dbdGFyZ2V0QXR0cmlidXRlXSA9IG5vZGVBdHRyaWJ1dGUgPyB0YXJnZXQuZXhwb3J0SWQgOiBub2RlTG9va3VwW3RhcmdldC5leHBvcnRJZF07XG4gICAgICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgcm93W3RhcmdldEF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXSA9IHRhcmdldC5jbGFzc09iai5jbGFzc05hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQubGlua3MucHVzaChPYmplY3QuYXNzaWduKHt9LCByb3cpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHByZXR0eSkge1xuICAgICAgcmVzdWx0Lm5vZGVzID0gJyAgXCJub2Rlc1wiOiBbXFxuICAgICcgKyByZXN1bHQubm9kZXMubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAuam9pbignLFxcbiAgICAnKSArICdcXG4gIF0nO1xuICAgICAgcmVzdWx0LmxpbmtzID0gJyAgXCJsaW5rc1wiOiBbXFxuICAgICcgKyByZXN1bHQubGlua3MubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAuam9pbignLFxcbiAgICAnKSArICdcXG4gIF0nO1xuICAgICAgaWYgKHJlc3VsdC5vdGhlcikge1xuICAgICAgICByZXN1bHQub3RoZXIgPSAnLFxcbiAgXCJvdGhlclwiOiBbXFxuICAgICcgKyByZXN1bHQub3RoZXIubWFwKHJvdyA9PiBKU09OLnN0cmluZ2lmeShyb3cpKVxuICAgICAgICAgIC5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgXSc7XG4gICAgICB9XG4gICAgICByZXN1bHQgPSBge1xcbiR7cmVzdWx0Lm5vZGVzfSxcXG4ke3Jlc3VsdC5saW5rc30ke3Jlc3VsdC5vdGhlciB8fCAnJ31cXG59XFxuYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gSlNPTi5zdHJpbmdpZnkocmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6ICdkYXRhOnRleHQvanNvbjtiYXNlNjQsJyArIEJ1ZmZlci5mcm9tKHJlc3VsdCkudG9TdHJpbmcoJ2Jhc2U2NCcpLFxuICAgICAgdHlwZTogJ3RleHQvanNvbicsXG4gICAgICBleHRlbnNpb246ICdqc29uJ1xuICAgIH07XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IG5ldyBEM0pzb24oKTtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuXG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4uL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBGSUxFX0ZPUk1BVFMgZnJvbSAnLi4vRmlsZUZvcm1hdHMvRmlsZUZvcm1hdHMuanMnO1xuXG5jb25zdCBEQVRBTElCX0ZPUk1BVFMgPSB7XG4gICdqc29uJzogJ2pzb24nLFxuICAnY3N2JzogJ2NzdicsXG4gICd0c3YnOiAndHN2J1xufTtcblxuY2xhc3MgTmV0d29ya01vZGVsIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoe1xuICAgIG9yaWdyYXBoLFxuICAgIG1vZGVsSWQsXG4gICAgbmFtZSA9IG1vZGVsSWQsXG4gICAgYW5ub3RhdGlvbnMgPSB7fSxcbiAgICBjbGFzc2VzID0ge30sXG4gICAgdGFibGVzID0ge31cbiAgfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fb3JpZ3JhcGggPSBvcmlncmFwaDtcbiAgICB0aGlzLm1vZGVsSWQgPSBtb2RlbElkO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IGFubm90YXRpb25zO1xuICAgIHRoaXMuY2xhc3NlcyA9IHt9O1xuICAgIHRoaXMudGFibGVzID0ge307XG5cbiAgICB0aGlzLl9uZXh0Q2xhc3NJZCA9IDE7XG4gICAgdGhpcy5fbmV4dFRhYmxlSWQgPSAxO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKGNsYXNzZXMpKSB7XG4gICAgICB0aGlzLmNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSB0aGlzLmh5ZHJhdGUoY2xhc3NPYmosIENMQVNTRVMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIE9iamVjdC52YWx1ZXModGFibGVzKSkge1xuICAgICAgdGhpcy50YWJsZXNbdGFibGUudGFibGVJZF0gPSB0aGlzLmh5ZHJhdGUodGFibGUsIFRBQkxFUyk7XG4gICAgfVxuXG4gICAgdGhpcy5vbigndXBkYXRlJywgKCkgPT4ge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3NhdmVUaW1lb3V0KTtcbiAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuX29yaWdyYXBoLnNhdmUoKTtcbiAgICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSB1bmRlZmluZWQ7XG4gICAgICB9LCAwKTtcbiAgICB9KTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IGNsYXNzZXMgPSB7fTtcbiAgICBjb25zdCB0YWJsZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXS50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZU9iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKSkge1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdID0gdGFibGVPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0udHlwZSA9IHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBtb2RlbElkOiB0aGlzLm1vZGVsSWQsXG4gICAgICBuYW1lOiB0aGlzLm5hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9ucyxcbiAgICAgIGNsYXNzZXMsXG4gICAgICB0YWJsZXNcbiAgICB9O1xuICB9XG4gIGdldCB1bnNhdmVkICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc2F2ZVRpbWVvdXQgIT09IHVuZGVmaW5lZDtcbiAgfVxuICBoeWRyYXRlIChyYXdPYmplY3QsIFRZUEVTKSB7XG4gICAgcmF3T2JqZWN0Lm1vZGVsID0gdGhpcztcbiAgICByZXR1cm4gbmV3IFRZUEVTW3Jhd09iamVjdC50eXBlXShyYXdPYmplY3QpO1xuICB9XG4gIGNyZWF0ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgd2hpbGUgKCFvcHRpb25zLnRhYmxlSWQgfHwgKCFvcHRpb25zLm92ZXJ3cml0ZSAmJiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdKSkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHt0aGlzLl9uZXh0VGFibGVJZH1gO1xuICAgICAgdGhpcy5fbmV4dFRhYmxlSWQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSA9IG5ldyBUQUJMRVNbb3B0aW9ucy50eXBlXShvcHRpb25zKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdO1xuICB9XG4gIGNyZWF0ZUNsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYGVtcHR5YCB9KSB7XG4gICAgd2hpbGUgKCFvcHRpb25zLmNsYXNzSWQgfHwgKCFvcHRpb25zLm92ZXJ3cml0ZSAmJiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSkpIHtcbiAgICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7dGhpcy5fbmV4dENsYXNzSWR9YDtcbiAgICAgIHRoaXMuX25leHRDbGFzc0lkICs9IDE7XG4gICAgfVxuICAgIGlmICh0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdLmNsYXNzT2JqICYmICFvcHRpb25zLm92ZXJ3cml0ZSkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXS5kdXBsaWNhdGUoKS50YWJsZUlkO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgZmluZENsYXNzIChjbGFzc05hbWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NOYW1lID09PSBjbGFzc05hbWUpO1xuICB9XG4gIHJlbmFtZSAobmV3TmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhbm5vdGF0ZSAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5fb3JpZ3JhcGguZGVsZXRlTW9kZWwodGhpcy5tb2RlbElkKTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX29yaWdyYXBoLm1vZGVsc1t0aGlzLm1vZGVsSWRdO1xuICB9XG4gIGFzeW5jIGFkZFRleHRGaWxlIChvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zLmZvcm1hdCkge1xuICAgICAgb3B0aW9ucy5mb3JtYXQgPSBtaW1lLmV4dGVuc2lvbihtaW1lLmxvb2t1cChvcHRpb25zLm5hbWUpKTtcbiAgICB9XG4gICAgaWYgKEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgICAgcmV0dXJuIEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0uaW1wb3J0RGF0YShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKERBVEFMSUJfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIG9wdGlvbnMuZGF0YSA9IGRhdGFsaWIucmVhZChvcHRpb25zLnRleHQsIHsgdHlwZTogb3B0aW9ucy5mb3JtYXQgfSk7XG4gICAgICBpZiAob3B0aW9ucy5mb3JtYXQgPT09ICdjc3YnIHx8IG9wdGlvbnMuZm9ybWF0ID09PSAndHN2Jykge1xuICAgICAgICBvcHRpb25zLmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIG9wdGlvbnMuZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgb3B0aW9ucy5hdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgb3B0aW9ucy5kYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZShvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGZvcm1hdDogJHtvcHRpb25zLmZvcm1hdH1gKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIGlmIChGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICByZXR1cm4gRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XS5mb3JtYXREYXRhKG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAoREFUQUxJQl9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBSYXcgJHtvcHRpb25zLmZvcm1hdH0gZXhwb3J0IG5vdCB5ZXQgc3VwcG9ydGVkYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZXhwb3J0IHVua25vd24gZm9ybWF0OiAke29wdGlvbnMuZm9ybWF0fWApO1xuICAgIH1cbiAgfVxuICBhZGRTdGF0aWNUYWJsZSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudHlwZSA9IG9wdGlvbnMuZGF0YSBpbnN0YW5jZW9mIEFycmF5ID8gJ1N0YXRpY1RhYmxlJyA6ICdTdGF0aWNEaWN0VGFibGUnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgb3B0aW1pemVUYWJsZXMgKCkge1xuICAgIGNvbnN0IHRhYmxlc0luVXNlID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIHRhYmxlc0luVXNlW2NsYXNzT2JqLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc09iai5zb3VyY2VUYWJsZUlkcyB8fCBbXSkge1xuICAgICAgICB0YWJsZXNJblVzZVt0YWJsZUlkXSA9IHRydWU7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMgfHwgW10pIHtcbiAgICAgICAgdGFibGVzSW5Vc2VbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBwYXJlbnRzVmlzaXRlZCA9IHt9O1xuICAgIGNvbnN0IHF1ZXVlID0gT2JqZWN0LmtleXModGFibGVzSW5Vc2UpO1xuICAgIHdoaWxlIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCB0YWJsZUlkID0gcXVldWUuc2hpZnQoKTtcbiAgICAgIGlmICghcGFyZW50c1Zpc2l0ZWRbdGFibGVJZF0pIHtcbiAgICAgICAgdGFibGVzSW5Vc2VbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgICBwYXJlbnRzVmlzaXRlZFt0YWJsZUlkXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IHRhYmxlID0gdGhpcy50YWJsZXNbdGFibGVJZF07XG4gICAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgICAgcXVldWUucHVzaChwYXJlbnRUYWJsZS50YWJsZUlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgT2JqZWN0LmtleXModGhpcy50YWJsZXMpKSB7XG4gICAgICBjb25zdCB0YWJsZSA9IHRoaXMudGFibGVzW3RhYmxlSWRdO1xuICAgICAgaWYgKCF0YWJsZXNJblVzZVt0YWJsZUlkXSAmJiB0YWJsZS50eXBlICE9PSAnU3RhdGljJyAmJiB0YWJsZS50eXBlICE9PSAnU3RhdGljRGljdCcpIHtcbiAgICAgICAgdGFibGUuZGVsZXRlKHRydWUpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBUT0RPOiBJZiBhbnkgRHVwbGljYXRlZFRhYmxlIGlzIGluIHVzZSwgYnV0IHRoZSBvcmlnaW5hbCBpc24ndCwgc3dhcCBmb3IgdGhlIHJlYWwgb25lXG4gIH1cbiAgYXN5bmMgZ2V0SW5zdGFuY2VHcmFwaCAoaW5zdGFuY2VJZExpc3QpIHtcbiAgICBpZiAoIWluc3RhbmNlSWRMaXN0KSB7XG4gICAgICAvLyBXaXRob3V0IHNwZWNpZmllZCBpbnN0YW5jZXMsIGp1c3QgcGljayB0aGUgZmlyc3QgNSBmcm9tIGVhY2ggbm9kZVxuICAgICAgLy8gYW5kIGVkZ2UgY2xhc3NcbiAgICAgIGluc3RhbmNlSWRMaXN0ID0gW107XG4gICAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnIHx8IGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKDUpKSB7XG4gICAgICAgICAgICBpbnN0YW5jZUlkTGlzdC5wdXNoKGl0ZW0uaW5zdGFuY2VJZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gR2V0IHRoZSBzcGVjaWZpZWQgaXRlbXNcbiAgICBjb25zdCBub2RlSW5zdGFuY2VzID0ge307XG4gICAgY29uc3QgZWRnZUluc3RhbmNlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgaW5zdGFuY2VJZCBvZiBpbnN0YW5jZUlkTGlzdCkge1xuICAgICAgY29uc3QgeyBjbGFzc0lkLCBpbmRleCB9ID0gSlNPTi5wYXJzZShpbnN0YW5jZUlkKTtcbiAgICAgIGNvbnN0IGluc3RhbmNlID0gYXdhaXQgdGhpcy5jbGFzc2VzW2NsYXNzSWRdLnRhYmxlLmdldEl0ZW0oaW5kZXgpO1xuICAgICAgaWYgKGluc3RhbmNlLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBub2RlSW5zdGFuY2VzW2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICB9IGVsc2UgaWYgKGluc3RhbmNlLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBlZGdlSW5zdGFuY2VzW2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIEFkZCBhbnkgbm9kZXMgY29ubmVjdGVkIHRvIG91ciBlZGdlc1xuICAgIGNvbnN0IGV4dHJhTm9kZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBpbiBlZGdlSW5zdGFuY2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZUluc3RhbmNlc1tlZGdlSWRdLm5vZGVzKCkpIHtcbiAgICAgICAgaWYgKCFub2RlSW5zdGFuY2VzW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICBleHRyYU5vZGVzW25vZGUuaW5zdGFuY2VJZF0gPSBub2RlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIEFkZCBhbnkgZWRnZXMgdGhhdCBjb25uZWN0IG91ciBub2Rlc1xuICAgIGNvbnN0IGV4dHJhRWRnZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IG5vZGVJZCBpbiBub2RlSW5zdGFuY2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2Ygbm9kZUluc3RhbmNlc1tub2RlSWRdLmVkZ2VzKCkpIHtcbiAgICAgICAgaWYgKCFlZGdlSW5zdGFuY2VzW2VkZ2UuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAvLyBDaGVjayB0aGF0IGJvdGggZW5kcyBvZiB0aGUgZWRnZSBjb25uZWN0IGF0IGxlYXN0IG9uZVxuICAgICAgICAgIC8vIG9mIG91ciBub2Rlc1xuICAgICAgICAgIGxldCBjb25uZWN0c1NvdXJjZSA9IGZhbHNlO1xuICAgICAgICAgIGxldCBjb25uZWN0c1RhcmdldCA9IGZhbHNlO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2RlSW5zdGFuY2VzW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAgICAgY29ubmVjdHNTb3VyY2UgPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKG5vZGVJbnN0YW5jZXNbbm9kZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgICAgICBjb25uZWN0c1RhcmdldCA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoY29ubmVjdHNTb3VyY2UgJiYgY29ubmVjdHNUYXJnZXQpIHtcbiAgICAgICAgICAgIGV4dHJhRWRnZXNbZWRnZS5pbnN0YW5jZUlkXSA9IGVkZ2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gT2theSwgbm93IHdlIGhhdmUgYSBjb21wbGV0ZSBzZXQgb2Ygbm9kZXMgYW5kIGVkZ2VzIHRoYXQgd2Ugd2FudCB0b1xuICAgIC8vIGluY2x1ZGU7IGNyZWF0ZSBwYWlyd2lzZSBlZGdlIGVudHJpZXMgZm9yIGV2ZXJ5IGNvbm5lY3Rpb25cbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdXG4gICAgfTtcblxuICAgIC8vIEFkZCBhbGwgdGhlIG5vZGVzLCBhbmQgcG9wdWxhdGUgYSBsb29rdXAgZm9yIHdoZXJlIHRoZXkgYXJlIGluIHRoZSBsaXN0XG4gICAgZm9yIChjb25zdCBub2RlIG9mIE9iamVjdC52YWx1ZXMobm9kZUluc3RhbmNlcykuY29uY2F0KE9iamVjdC52YWx1ZXMoZXh0cmFOb2RlcykpKSB7XG4gICAgICBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPSBncmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICBncmFwaC5ub2Rlcy5wdXNoKHtcbiAgICAgICAgbm9kZUluc3RhbmNlOiBub2RlLFxuICAgICAgICBkdW1teTogZmFsc2VcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFkZCBhbGwgdGhlIGVkZ2VzLi4uXG4gICAgZm9yIChjb25zdCBlZGdlIG9mIE9iamVjdC52YWx1ZXMoZWRnZUluc3RhbmNlcykuY29uY2F0KE9iamVjdC52YWx1ZXMoZXh0cmFFZGdlcykpKSB7XG4gICAgICBpZiAoIWVkZ2UuY2xhc3NPYmouc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBpZiAoIWVkZ2UuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAgIC8vIE1pc3NpbmcgYm90aCBzb3VyY2UgYW5kIHRhcmdldCBjbGFzc2VzOyBhZGQgZHVtbXkgbm9kZXMgZm9yIGJvdGggZW5kc1xuICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aCArIDFcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEFkZCBkdW1teSBzb3VyY2Ugbm9kZXNcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCFlZGdlLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgLy8gQWRkIGR1bW15IHRhcmdldCBub2Rlc1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSxcbiAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGhcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhlcmUgc2hvdWxkIGJlIGJvdGggc291cmNlIGFuZCB0YXJnZXQgbm9kZXMgZm9yIGVhY2ggZWRnZVxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZU5vZGUgb2YgZWRnZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbc291cmNlTm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldE5vZGUgb2YgZWRnZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3RhcmdldE5vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2RlTG9va3VwW3NvdXJjZU5vZGUuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Tm9kZS5pbnN0YW5jZUlkXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXROZXR3b3JrTW9kZWxHcmFwaCAoe1xuICAgIHJhdyA9IHRydWUsXG4gICAgaW5jbHVkZUR1bW1pZXMgPSBmYWxzZSxcbiAgICBjbGFzc0xpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcylcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBsZXQgZ3JhcGggPSB7XG4gICAgICBjbGFzc2VzOiBbXSxcbiAgICAgIGNsYXNzTG9va3VwOiB7fSxcbiAgICAgIGNsYXNzQ29ubmVjdGlvbnM6IFtdXG4gICAgfTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgY2xhc3NMaXN0KSB7XG4gICAgICAvLyBBZGQgYW5kIGluZGV4IHRoZSBjbGFzcyBhcyBhIG5vZGVcbiAgICAgIGNvbnN0IGNsYXNzU3BlYyA9IHJhdyA/IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpIDogeyBjbGFzc09iaiB9O1xuICAgICAgY2xhc3NTcGVjLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGguY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBncmFwaC5jbGFzc2VzLmxlbmd0aDtcbiAgICAgIGdyYXBoLmNsYXNzZXMucHVzaChjbGFzc1NwZWMpO1xuXG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBlZGdlIGNsYXNzIHNvIHdlIGNhbiBjcmVhdGUgY2xhc3NDb25uZWN0aW9ucyBsYXRlclxuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnICYmIGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IG5vZGVcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7Y2xhc3NPYmouY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGggLSAxLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGxvY2F0aW9uOiAnbm9kZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENyZWF0ZSBleGlzdGluZyBjbGFzc0Nvbm5lY3Rpb25zXG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBzb3VyY2Ugbm9kZSBjbGFzcyB0byB0aGUgZWRnZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZH0+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBzb3VyY2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYGR1bW15PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBlZGdlIGNsYXNzIHRvIHRoZSB0YXJnZXQgbm9kZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+JHtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnRhcmdldENsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSB0YXJnZXQgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGggKCkge1xuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgdGFibGVzOiBbXSxcbiAgICAgIHRhYmxlTG9va3VwOiB7fSxcbiAgICAgIHRhYmxlTGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCB0YWJsZUxpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKTtcbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgY29uc3QgdGFibGVTcGVjID0gdGFibGUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZVNwZWMudHlwZSA9IHRhYmxlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGdyYXBoLnRhYmxlcy5sZW5ndGg7XG4gICAgICBncmFwaC50YWJsZXMucHVzaCh0YWJsZVNwZWMpO1xuICAgIH1cbiAgICAvLyBGaWxsIHRoZSBncmFwaCB3aXRoIGxpbmtzIGJhc2VkIG9uIHBhcmVudFRhYmxlcy4uLlxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICBncmFwaC50YWJsZUxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogZ3JhcGgudGFibGVMb29rdXBbcGFyZW50VGFibGUudGFibGVJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE1vZGVsRHVtcCAoKSB7XG4gICAgLy8gQmVjYXVzZSBvYmplY3Qga2V5IG9yZGVycyBhcmVuJ3QgZGV0ZXJtaW5pc3RpYywgaXQgY2FuIGJlIHByb2JsZW1hdGljXG4gICAgLy8gZm9yIHRlc3RpbmcgKGJlY2F1c2UgaWRzIGNhbiByYW5kb21seSBjaGFuZ2UgZnJvbSB0ZXN0IHJ1biB0byB0ZXN0IHJ1bikuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzb3J0cyBlYWNoIGtleSwgYW5kIGp1c3QgcmVwbGFjZXMgSURzIHdpdGggaW5kZXggbnVtYmVyc1xuICAgIGNvbnN0IHJhd09iaiA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodGhpcy5fdG9SYXdPYmplY3QoKSkpO1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLmNsYXNzZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLmNsYXNzZXNbYS5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMuY2xhc3Nlc1tiLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgdGFibGVzOiBPYmplY3QudmFsdWVzKHJhd09iai50YWJsZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLnRhYmxlc1thLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy50YWJsZXNbYi50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZSBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH07XG4gICAgY29uc3QgY2xhc3NMb29rdXAgPSB7fTtcbiAgICBjb25zdCB0YWJsZUxvb2t1cCA9IHt9O1xuICAgIHJlc3VsdC5jbGFzc2VzLmZvckVhY2goKGNsYXNzT2JqLCBpbmRleCkgPT4ge1xuICAgICAgY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBpbmRleDtcbiAgICB9KTtcbiAgICByZXN1bHQudGFibGVzLmZvckVhY2goKHRhYmxlLCBpbmRleCkgPT4ge1xuICAgICAgdGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBpbmRleDtcbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgcmVzdWx0LnRhYmxlcykge1xuICAgICAgdGFibGUudGFibGVJZCA9IHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpKSB7XG4gICAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVMb29rdXBbdGFibGVJZF1dID0gdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgICAgZGVsZXRlIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICB9XG4gICAgICBkZWxldGUgdGFibGUuZGF0YTsgLy8gZG9uJ3QgaW5jbHVkZSBhbnkgb2YgdGhlIGRhdGE7IHdlIGp1c3Qgd2FudCB0aGUgbW9kZWwgc3RydWN0dXJlXG4gICAgfVxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgcmVzdWx0LmNsYXNzZXMpIHtcbiAgICAgIGNsYXNzT2JqLmNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXTtcbiAgICAgIGNsYXNzT2JqLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFtjbGFzc09iai50YWJsZUlkXTtcbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcyA9IGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldENsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai50YXJnZXRDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcyA9IGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgY2xhc3NJZCBvZiBPYmplY3Qua2V5cyhjbGFzc09iai5lZGdlQ2xhc3NJZHMgfHwge30pKSB7XG4gICAgICAgIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0xvb2t1cFtjbGFzc0lkXV0gPSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICAgIGRlbGV0ZSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgY3JlYXRlU2NoZW1hTW9kZWwgKCkge1xuICAgIGNvbnN0IGdyYXBoID0gdGhpcy5nZXRNb2RlbER1bXAoKTtcblxuICAgIGdyYXBoLnRhYmxlcy5mb3JFYWNoKHRhYmxlID0+IHtcbiAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXMgPSBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld01vZGVsID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlTW9kZWwoeyBuYW1lOiB0aGlzLm5hbWUgKyAnX3NjaGVtYScgfSk7XG4gICAgY29uc3QgcmF3ID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGgsXG4gICAgICBuYW1lOiAnUmF3IER1bXAnXG4gICAgfSk7XG4gICAgbGV0IFsgY2xhc3NlcywgdGFibGVzIF0gPSByYXcuY2xvc2VkVHJhbnNwb3NlKFsnY2xhc3NlcycsICd0YWJsZXMnXSk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgIGNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdDbGFzc2VzJyk7XG4gICAgcmF3LmRlbGV0ZSgpO1xuXG4gICAgY29uc3Qgc291cmNlQ2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAnc291cmNlQ2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHNvdXJjZUNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdTb3VyY2UgQ2xhc3MnKTtcbiAgICBzb3VyY2VDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuICAgIGNvbnN0IHRhcmdldENsYXNzZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogY2xhc3NlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhcmdldENsYXNzSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YXJnZXRDbGFzc2VzLnNldENsYXNzTmFtZSgnVGFyZ2V0IENsYXNzJyk7XG4gICAgdGFyZ2V0Q2xhc3Nlcy50b2dnbGVEaXJlY3Rpb24oKTtcblxuICAgIHRhYmxlcyA9IHRhYmxlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgdGFibGVzLnNldENsYXNzTmFtZSgnVGFibGVzJyk7XG5cbiAgICBjb25zdCB0YWJsZURlcGVuZGVuY2llcyA9IHRhYmxlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ2Rlcml2ZWRUYWJsZXMnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YWJsZURlcGVuZGVuY2llcy5zZXRDbGFzc05hbWUoJ0lzIFBhcmVudCBPZicpO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgY29uc3QgY29yZVRhYmxlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YWJsZUlkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgY29yZVRhYmxlcy5zZXRDbGFzc05hbWUoJ0NvcmUgVGFibGUnKTtcbiAgICByZXR1cm4gbmV3TW9kZWw7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE5ldHdvcmtNb2RlbDtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IE5ldHdvcmtNb2RlbCBmcm9tICcuL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMnO1xuXG5sZXQgTkVYVF9NT0RFTF9JRCA9IDE7XG5cbmNsYXNzIE9yaWdyYXBoIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAobG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gb25seSBkZWZpbmVkIGluIHRoZSBicm93c2VyIGNvbnRleHRcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIC8qXG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgICAqL1xuICB9XG4gIGNsb3NlQ3VycmVudE1vZGVsICgpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBnZXQgY3VycmVudE1vZGVsICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbdGhpcy5fY3VycmVudE1vZGVsSWRdIHx8IG51bGw7XG4gIH1cbiAgc2V0IGN1cnJlbnRNb2RlbCAobW9kZWwpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG1vZGVsID8gbW9kZWwubW9kZWxJZCA6IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBhc3luYyBsb2FkTW9kZWwgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwoeyBtb2RlbElkOiBvcHRpb25zLm5hbWUgfSk7XG4gICAgYXdhaXQgbmV3TW9kZWwuYWRkVGV4dEZpbGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG4gIGNyZWF0ZU1vZGVsIChvcHRpb25zID0ge30pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMubW9kZWxJZCB8fCB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsSWQgPSBgbW9kZWwke05FWFRfTU9ERUxfSUR9YDtcbiAgICAgIE5FWFRfTU9ERUxfSUQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5vcmlncmFwaCA9IHRoaXM7XG4gICAgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwob3B0aW9ucyk7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBvcHRpb25zLm1vZGVsSWQ7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXTtcbiAgfVxuICBkZWxldGVNb2RlbCAobW9kZWxJZCA9IHRoaXMuY3VycmVudE1vZGVsSWQpIHtcbiAgICBpZiAoIXRoaXMubW9kZWxzW21vZGVsSWRdKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBub24tZXhpc3RlbnQgbW9kZWw6ICR7bW9kZWxJZH1gKTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWxzW21vZGVsSWRdO1xuICAgIGlmICh0aGlzLl9jdXJyZW50TW9kZWxJZCA9PT0gbW9kZWxJZCkge1xuICAgICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICB9XG4gICAgdGhpcy5zYXZlKCk7XG4gIH1cbiAgZGVsZXRlQWxsTW9kZWxzICgpIHtcbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE9yaWdyYXBoO1xuIiwiaW1wb3J0IE9yaWdyYXBoIGZyb20gJy4vT3JpZ3JhcGguanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgb3JpZ3JhcGggPSBuZXcgT3JpZ3JhcGgod2luZG93LmxvY2FsU3RvcmFnZSk7XG5vcmlncmFwaC52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG9yaWdyYXBoO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJfZXZlbnRIYW5kbGVycyIsIl9zdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJldmVudCIsIm5hbWVzcGFjZSIsInNwbGl0IiwicHVzaCIsIm9mZiIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiaGFuZGxlQ2FsbGJhY2siLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiR2VuZXJpY1dyYXBwZXIiLCJvcHRpb25zIiwidGFibGUiLCJ1bmRlZmluZWQiLCJFcnJvciIsImNsYXNzT2JqIiwicm93IiwiY29ubmVjdGVkSXRlbXMiLCJkdXBsaWNhdGVJdGVtcyIsInJlZ2lzdGVyRHVwbGljYXRlIiwiaXRlbSIsImNvbm5lY3RJdGVtIiwidGFibGVJZCIsImR1cCIsImRpc2Nvbm5lY3QiLCJpdGVtTGlzdCIsInZhbHVlcyIsImluc3RhbmNlSWQiLCJjbGFzc0lkIiwiZXhwb3J0SWQiLCJlcXVhbHMiLCJoYW5kbGVMaW1pdCIsIml0ZXJhdG9ycyIsImxpbWl0IiwiSW5maW5pdHkiLCJpdGVyYXRvciIsIml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInRhYmxlSWRzIiwiUHJvbWlzZSIsImFsbCIsIm1hcCIsIm1vZGVsIiwidGFibGVzIiwiYnVpbGRDYWNoZSIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJyZXNldCIsIm5leHRUYWJsZUlkIiwibGVuZ3RoIiwicmVtYWluaW5nVGFibGVJZHMiLCJzbGljZSIsImV4ZWMiLCJuYW1lIiwiVGFibGUiLCJfZXhwZWN0ZWRBdHRyaWJ1dGVzIiwiYXR0cmlidXRlcyIsIl9vYnNlcnZlZEF0dHJpYnV0ZXMiLCJfZGVyaXZlZFRhYmxlcyIsImRlcml2ZWRUYWJsZXMiLCJfZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImF0dHIiLCJzdHJpbmdpZmllZEZ1bmMiLCJlbnRyaWVzIiwiZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImh5ZHJhdGVGdW5jdGlvbiIsIl9zdXBwcmVzc2VkQXR0cmlidXRlcyIsInN1cHByZXNzZWRBdHRyaWJ1dGVzIiwiX3N1cHByZXNzSW5kZXgiLCJzdXBwcmVzc0luZGV4IiwiX2luZGV4RmlsdGVyIiwiaW5kZXhGaWx0ZXIiLCJfYXR0cmlidXRlRmlsdGVycyIsImF0dHJpYnV0ZUZpbHRlcnMiLCJfbGltaXRQcm9taXNlcyIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiZ2V0U29ydEhhc2giLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiaXRlcmF0ZSIsIl9jYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJyZXNvbHZlIiwicmVqZWN0IiwiX2l0ZXJhdGUiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGVMb29rdXAiLCJkb25lIiwibmV4dCIsImhhbmRsZVJlc2V0IiwiX2ZpbmlzaEl0ZW0iLCJOdW1iZXIiLCJfY2FjaGVMb29rdXAiLCJfY2FjaGVQcm9taXNlIiwiaXRlbXNUb1Jlc2V0IiwiY29uY2F0IiwiZGVyaXZlZFRhYmxlIiwiY291bnRSb3dzIiwid3JhcHBlZEl0ZW0iLCJkZWxheWVkUm93Iiwia2VlcCIsIl93cmFwIiwib3RoZXJJdGVtIiwiaXRlbXNUb0Nvbm5lY3QiLCJnZXRJbmRleERldGFpbHMiLCJkZXRhaWxzIiwic3VwcHJlc3NlZCIsImZpbHRlcmVkIiwiZ2V0QXR0cmlidXRlRGV0YWlscyIsImFsbEF0dHJzIiwiZXhwZWN0ZWQiLCJvYnNlcnZlZCIsImRlcml2ZWQiLCJjdXJyZW50RGF0YSIsImRhdGEiLCJsb29rdXAiLCJjb21wbGV0ZSIsImdldEl0ZW0iLCJkZXJpdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJzdXBwcmVzc0F0dHJpYnV0ZSIsImFkZEZpbHRlciIsIl9kZXJpdmVUYWJsZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGUiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsInByb21vdGUiLCJleHBhbmQiLCJ1bnJvbGwiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNsb3NlZFRyYW5zcG9zZSIsImluZGV4ZXMiLCJvcGVuVHJhbnNwb3NlIiwiZHVwbGljYXRlIiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0Iiwib3RoZXJUYWJsZSIsInByb2plY3QiLCJ0YWJsZU9yZGVyIiwib3RoZXJUYWJsZUlkIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJmb3JjZSIsImVyciIsInBhcmVudFRhYmxlIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQXR0clRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkF0dHJUYWJsZU1peGluIiwiX2F0dHJpYnV0ZSIsIlByb21vdGVkVGFibGUiLCJfdW5maW5pc2hlZENhY2hlIiwiX3VuZmluaXNoZWRDYWNoZUxvb2t1cCIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicFRhYmxlIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJEdXBsaWNhdGVkVGFibGUiLCJDaGlsZFRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpbiIsInBhcmVudEluZGV4IiwiRXhwYW5kZWRUYWJsZSIsIlVucm9sbGVkVGFibGUiLCJyb3dzIiwiUGFyZW50Q2hpbGRUYWJsZSIsImNoaWxkVGFibGUiLCJjaGlsZCIsInBhcmVudCIsIlByb2plY3RlZFRhYmxlIiwic2VsZiIsImZpcnN0VGFibGUiLCJyZW1haW5pbmdJZHMiLCJzb3VyY2VJdGVtIiwibGFzdEl0ZW0iLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbnMiLCJzZXRDbGFzc05hbWUiLCJoYXNDdXN0b21OYW1lIiwidmFyaWFibGVOYW1lIiwiZmlsdGVyIiwiZCIsInRvTG9jYWxlVXBwZXJDYXNlIiwiZGVsZXRlZCIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJfZGVyaXZlTmV3Q2xhc3MiLCJvcHRpbWl6ZVRhYmxlcyIsIk5vZGVXcmFwcGVyIiwiZWRnZXMiLCJlZGdlSWRzIiwiY2xhc3NJZHMiLCJlZGdlQ2xhc3NJZHMiLCJlZGdlSWQiLCJlZGdlQ2xhc3MiLCJyb2xlIiwiZ2V0RWRnZVJvbGUiLCJyZXZlcnNlIiwiTm9kZUNsYXNzIiwiZWRnZUNsYXNzZXMiLCJlZGdlQ2xhc3NJZCIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiYXV0b2Nvbm5lY3QiLCJkaXNjb25uZWN0QWxsRWRnZXMiLCJpc1NvdXJjZSIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0Iiwibm9kZUNsYXNzIiwidGFibGVJZExpc3QiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibmV3Tm9kZUNsYXNzIiwiY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MiLCJjaGlsZENsYXNzIiwicHJvamVjdE5ld0VkZ2UiLCJjbGFzc0lkTGlzdCIsImNsYXNzTGlzdCIsImVkZ2VSb2xlIiwiQXJyYXkiLCJmcm9tIiwibmV3Q2xhc3MiLCJjb25uZWN0ZWRDbGFzc2VzIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VOb2RlcyIsInNvdXJjZVRhYmxlSWQiLCJ0YXJnZXROb2RlcyIsInRhcmdldFRhYmxlSWQiLCJub2RlcyIsIkVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJfc3BsaXRUYWJsZUlkTGlzdCIsIm90aGVyQ2xhc3MiLCJub2RlVGFibGVJZExpc3QiLCJlZGdlVGFibGVJZCIsImVkZ2VUYWJsZUlkTGlzdCIsInN0YXRpY0V4aXN0cyIsInRhYmxlRGlzdGFuY2VzIiwic3RhcnRzV2l0aCIsImRpc3QiLCJNYXRoIiwiYWJzIiwic29ydCIsImEiLCJiIiwic2lkZSIsImNvbm5lY3RTb3VyY2UiLCJjb25uZWN0VGFyZ2V0IiwidG9nZ2xlRGlyZWN0aW9uIiwic3dhcHBlZERpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsInVuc2hpZnQiLCJleGlzdGluZ1NvdXJjZUNsYXNzIiwiZXhpc3RpbmdUYXJnZXRDbGFzcyIsImNvbm5lY3RGYWNldGVkQ2xhc3MiLCJuZXdDbGFzc2VzIiwiRmlsZUZvcm1hdCIsImJ1aWxkUm93IiwiUGFyc2VGYWlsdXJlIiwiZmlsZUZvcm1hdCIsIk5PREVfTkFNRVMiLCJFREdFX05BTUVTIiwiRDNKc29uIiwiaW1wb3J0RGF0YSIsInRleHQiLCJzb3VyY2VBdHRyaWJ1dGUiLCJ0YXJnZXRBdHRyaWJ1dGUiLCJjbGFzc0F0dHJpYnV0ZSIsIkpTT04iLCJwYXJzZSIsIm5vZGVOYW1lIiwiZWRnZU5hbWUiLCJjb3JlVGFibGUiLCJjb3JlQ2xhc3MiLCJub2RlQ2xhc3NlcyIsIm5vZGVDbGFzc0xvb2t1cCIsInNhbXBsZSIsInNvdXJjZUNsYXNzTmFtZSIsInRhcmdldENsYXNzTmFtZSIsImZvcm1hdERhdGEiLCJpbmNsdWRlQ2xhc3NlcyIsInByZXR0eSIsImxpbmtzIiwibm9kZUxvb2t1cCIsIm90aGVyIiwibm9kZSIsImVkZ2UiLCJzb3VyY2UiLCJ0YXJnZXQiLCJzdHJpbmdpZnkiLCJCdWZmZXIiLCJleHRlbnNpb24iLCJEQVRBTElCX0ZPUk1BVFMiLCJOZXR3b3JrTW9kZWwiLCJvcmlncmFwaCIsIm1vZGVsSWQiLCJfb3JpZ3JhcGgiLCJfbmV4dENsYXNzSWQiLCJfbmV4dFRhYmxlSWQiLCJoeWRyYXRlIiwiQ0xBU1NFUyIsIlRBQkxFUyIsIl9zYXZlVGltZW91dCIsInNhdmUiLCJ1bnNhdmVkIiwicmF3T2JqZWN0IiwiVFlQRVMiLCJzZWxlY3RvciIsImZpbmRDbGFzcyIsInJlbmFtZSIsIm5ld05hbWUiLCJhbm5vdGF0ZSIsImtleSIsImRlbGV0ZUFubm90YXRpb24iLCJkZWxldGVNb2RlbCIsIm1vZGVscyIsImFkZFRleHRGaWxlIiwiZm9ybWF0IiwibWltZSIsIkZJTEVfRk9STUFUUyIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwidGFibGVzSW5Vc2UiLCJwYXJlbnRzVmlzaXRlZCIsInF1ZXVlIiwic2hpZnQiLCJnZXRJbnN0YW5jZUdyYXBoIiwiaW5zdGFuY2VJZExpc3QiLCJub2RlSW5zdGFuY2VzIiwiZWRnZUluc3RhbmNlcyIsImluc3RhbmNlIiwiZXh0cmFOb2RlcyIsImV4dHJhRWRnZXMiLCJub2RlSWQiLCJjb25uZWN0c1NvdXJjZSIsImNvbm5lY3RzVGFyZ2V0IiwiZ3JhcGgiLCJub2RlSW5zdGFuY2UiLCJkdW1teSIsImVkZ2VJbnN0YW5jZSIsInNvdXJjZU5vZGUiLCJ0YXJnZXROb2RlIiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJyYXciLCJpbmNsdWRlRHVtbWllcyIsImNsYXNzTG9va3VwIiwiY2xhc3NDb25uZWN0aW9ucyIsImNsYXNzU3BlYyIsImlkIiwibG9jYXRpb24iLCJnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCIsInRhYmxlTG9va3VwIiwidGFibGVMaW5rcyIsInRhYmxlTGlzdCIsInRhYmxlU3BlYyIsImdldE1vZGVsRHVtcCIsInJhd09iaiIsImFIYXNoIiwiYkhhc2giLCJjcmVhdGVTY2hlbWFNb2RlbCIsIm5ld01vZGVsIiwiY3JlYXRlTW9kZWwiLCJzb3VyY2VDbGFzc2VzIiwidGFyZ2V0Q2xhc3NlcyIsInRhYmxlRGVwZW5kZW5jaWVzIiwiY29yZVRhYmxlcyIsIk5FWFRfTU9ERUxfSUQiLCJPcmlncmFwaCIsImxvY2FsU3RvcmFnZSIsInBsdWdpbnMiLCJleGlzdGluZ01vZGVscyIsIl9jdXJyZW50TW9kZWxJZCIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luIiwiY2xvc2VDdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWwiLCJsb2FkTW9kZWwiLCJjdXJyZW50TW9kZWxJZCIsImRlbGV0ZUFsbE1vZGVscyIsIndpbmRvdyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxjQUFMLEdBQXNCLEVBQXRCO1dBQ0tDLGVBQUwsR0FBdUIsRUFBdkI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNuQixDQUFDQyxLQUFELEVBQVFD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
