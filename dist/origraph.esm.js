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
    return this.parentTables.map(parentTable => parentTable.name).join('⨯');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join(',');
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
  ParentChildTable: ParentChildTable
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
    const classList = classIdList.map(classId => {
      return this.model.classes[classId];
    });

    if (classList.length < 2 || classList[classList.length - 1].type !== 'Node') {
      throw new Error(`Invalid classIdList`);
    }

    const sourceClassId = this.classId;
    const targetClassId = classList[classList.length - 1].classId;
    const sourceTableIds = [];
    const targetTableIds = [];

    for (let i = 0; i < classList.length - 1; i++) {
      if (classList[i].type === 'Node') {
        targetTableIds.push(classList[i].tableId);
      } else {
        const temp = Array.from(classList[i].sourceTableIds).reverse();

        for (const tableId of temp) {
          targetTableIds.push(tableId);
        }

        targetTableIds.push(classList[i].tableId);

        for (const tableId of classList[i].targetTableIds) {
          targetTableIds.push(tableId);
        }
      }
    }

    const tableId = this.table.connect([this.model.tables[targetTableIds[0]]]).tableId;
    return this.model.createClass({
      type: 'EdgeClass',
      tableId,
      sourceClassId,
      targetClassId,
      sourceTableIds,
      targetTableIds
    });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL0ZpbGVGb3JtYXQuanMiLCIuLi9zcmMvRmlsZUZvcm1hdHMvUGFyc2VGYWlsdXJlLmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL0QzSnNvbi5qcyIsIi4uL3NyYy9Db21tb24vTmV0d29ya01vZGVsLmpzIiwiLi4vc3JjL09yaWdyYXBoLmpzIiwiLi4vc3JjL21vZHVsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdIHx8XG4gICAgICAgIHsgJyc6IFtdIH07XG4gICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10ucHVzaChjYWxsYmFjayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdID0gY2FsbGJhY2s7XG4gICAgICB9XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddID0gW107XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudCwgLi4uYXJncykge1xuICAgICAgY29uc3QgaGFuZGxlQ2FsbGJhY2sgPSBjYWxsYmFjayA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWVzcGFjZSBvZiBPYmplY3Qua2V5cyh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkpIHtcbiAgICAgICAgICBpZiAobmFtZXNwYWNlID09PSAnJykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmZvckVhY2goaGFuZGxlQ2FsbGJhY2spO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoYW5kbGVDYWxsYmFjayh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLnRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGFuZCB0YWJsZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc09iaiA9IG9wdGlvbnMuY2xhc3NPYmogfHwgbnVsbDtcbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSBvcHRpb25zLmNvbm5lY3RlZEl0ZW1zIHx8IHt9O1xuICAgIHRoaXMuZHVwbGljYXRlSXRlbXMgPSBvcHRpb25zLmR1cGxpY2F0ZUl0ZW1zIHx8IFtdO1xuICB9XG4gIHJlZ2lzdGVyRHVwbGljYXRlIChpdGVtKSB7XG4gICAgdGhpcy5kdXBsaWNhdGVJdGVtcy5wdXNoKGl0ZW0pO1xuICB9XG4gIGNvbm5lY3RJdGVtIChpdGVtKSB7XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdIHx8IFtdO1xuICAgIGlmICh0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0uaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGR1cCBvZiB0aGlzLmR1cGxpY2F0ZUl0ZW1zKSB7XG4gICAgICBpdGVtLmNvbm5lY3RJdGVtKGR1cCk7XG4gICAgICBkdXAuY29ubmVjdEl0ZW0oaXRlbSk7XG4gICAgfVxuICB9XG4gIGRpc2Nvbm5lY3QgKCkge1xuICAgIGZvciAoY29uc3QgaXRlbUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNvbm5lY3RlZEl0ZW1zKSkge1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1MaXN0KSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gKGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXSB8fCBbXSkuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgIGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSB7fTtcbiAgfVxuICBnZXQgaW5zdGFuY2VJZCAoKSB7XG4gICAgcmV0dXJuIGB7XCJjbGFzc0lkXCI6XCIke3RoaXMuY2xhc3NPYmouY2xhc3NJZH1cIixcImluZGV4XCI6XCIke3RoaXMuaW5kZXh9XCJ9YDtcbiAgfVxuICBnZXQgZXhwb3J0SWQgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XyR7dGhpcy5pbmRleH1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGhhbmRsZUxpbWl0IChvcHRpb25zLCBpdGVyYXRvcnMpIHtcbiAgICBsZXQgbGltaXQgPSBJbmZpbml0eTtcbiAgICBpZiAob3B0aW9ucy5saW1pdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsaW1pdCA9IG9wdGlvbnMubGltaXQ7XG4gICAgICBkZWxldGUgb3B0aW9ucy5saW1pdDtcbiAgICB9XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgaXRlcmF0b3Igb2YgaXRlcmF0b3JzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgaXRlcmF0b3IpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgaSsrO1xuICAgICAgICBpZiAoaXRlbSA9PT0gbnVsbCB8fCBpID49IGxpbWl0KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIC8vIEZpcnN0IG1ha2Ugc3VyZSB0aGF0IGFsbCB0aGUgdGFibGUgY2FjaGVzIGhhdmUgYmVlbiBmdWxseSBidWlsdCBhbmRcbiAgICAvLyBjb25uZWN0ZWRcbiAgICBhd2FpdCBQcm9taXNlLmFsbCh0YWJsZUlkcy5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5jbGFzc09iai5tb2RlbC50YWJsZXNbdGFibGVJZF0uYnVpbGRDYWNoZSgpO1xuICAgIH0pKTtcbiAgICB5aWVsZCAqIHRoaXMuX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcyk7XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0aGlzLnJlc2V0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IG5leHRUYWJsZUlkID0gdGFibGVJZHNbMF07XG4gICAgaWYgKHRhYmxlSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgeWllbGQgKiAodGhpcy5jb25uZWN0ZWRJdGVtc1tuZXh0VGFibGVJZF0gfHwgW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCByZW1haW5pbmdUYWJsZUlkcyA9IHRhYmxlSWRzLnNsaWNlKDEpO1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuY29ubmVjdGVkSXRlbXNbbmV4dFRhYmxlSWRdIHx8IFtdKSB7XG4gICAgICAgIHlpZWxkICogaXRlbS5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHJlbWFpbmluZ1RhYmxlSWRzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMubW9kZWwgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG5cbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzID0gb3B0aW9ucy5kZXJpdmVkVGFibGVzIHx8IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIHx8IHt9KSkge1xuICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLnN1cHByZXNzZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSAhIW9wdGlvbnMuc3VwcHJlc3NJbmRleDtcblxuICAgIHRoaXMuX2luZGV4RmlsdGVyID0gKG9wdGlvbnMuaW5kZXhGaWx0ZXIgJiYgdGhpcy5oeWRyYXRlRnVuY3Rpb24ob3B0aW9ucy5pbmRleEZpbHRlcikpIHx8IG51bGw7XG4gICAgdGhpcy5fYXR0cmlidXRlRmlsdGVycyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5hdHRyaWJ1dGVGaWx0ZXJzIHx8IHt9KSkge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fbGltaXRQcm9taXNlcyA9IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICBkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zOiB7fSxcbiAgICAgIHN1cHByZXNzZWRBdHRyaWJ1dGVzOiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyxcbiAgICAgIHN1cHByZXNzSW5kZXg6IHRoaXMuX3N1cHByZXNzSW5kZXgsXG4gICAgICBhdHRyaWJ1dGVGaWx0ZXJzOiB7fSxcbiAgICAgIGluZGV4RmlsdGVyOiAodGhpcy5faW5kZXhGaWx0ZXIgJiYgdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbih0aGlzLl9pbmRleEZpbHRlcikpIHx8IG51bGxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICByZXN1bHQuYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGU7XG4gIH1cbiAgaHlkcmF0ZUZ1bmN0aW9uIChzdHJpbmdpZmllZEZ1bmMpIHtcbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgLy8gVGhlIGNhY2hlIGhhcyBhbHJlYWR5IGJlZW4gYnVpbHQ7IGp1c3QgZ3JhYiBkYXRhIGZyb20gaXQgZGlyZWN0bHlcbiAgICAgIHlpZWxkICogdGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlICYmIHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGggPj0gbGltaXQpIHtcbiAgICAgIC8vIFRoZSBjYWNoZSBpc24ndCBmaW5pc2hlZCwgYnV0IGl0J3MgYWxyZWFkeSBsb25nIGVub3VnaCB0byBzYXRpc2Z5IHRoaXNcbiAgICAgIC8vIHJlcXVlc3RcbiAgICAgIHlpZWxkICogdGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkIGJ1aWxkaW5nIChhbmQgbWF5YmUgZGlkbid0IGV2ZW4gc3RhcnQgeWV0KTtcbiAgICAgIC8vIGtpY2sgaXQgb2ZmLCBhbmQgdGhlbiB3YWl0IGZvciBlbm91Z2ggaXRlbXMgdG8gYmUgcHJvY2Vzc2VkIHRvIHNhdGlzZnlcbiAgICAgIC8vIHRoZSBsaW1pdFxuICAgICAgdGhpcy5idWlsZENhY2hlKCk7XG4gICAgICB5aWVsZCAqIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0gPSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSB8fCBbXTtcbiAgICAgICAgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0ucHVzaCh7IHJlc29sdmUsIHJlamVjdCB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgX2J1aWxkQ2FjaGUgKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IFtdO1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZSgpO1xuICAgIGxldCBpID0gMDtcbiAgICBsZXQgdGVtcCA9IHsgZG9uZTogZmFsc2UgfTtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSkge1xuICAgICAgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlIHx8IHRlbXAgPT09IG51bGwpIHtcbiAgICAgICAgLy8gcmVzZXQoKSB3YXMgY2FsbGVkIGJlZm9yZSB3ZSBjb3VsZCBmaW5pc2g7IHdlIG5lZWQgdG8gbGV0IGV2ZXJ5b25lXG4gICAgICAgIC8vIHRoYXQgd2FzIHdhaXRpbmcgb24gdXMga25vdyB0aGF0IHdlIGNhbid0IGNvbXBseVxuICAgICAgICB0aGlzLmhhbmRsZVJlc2V0KHJlamVjdCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghdGVtcC5kb25lKSB7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKHRlbXAudmFsdWUpKSB7XG4gICAgICAgICAgLy8gT2theSwgdGhpcyBpdGVtIHBhc3NlZCBhbGwgZmlsdGVycywgYW5kIGlzIHJlYWR5IHRvIGJlIHNlbnQgb3V0XG4gICAgICAgICAgLy8gaW50byB0aGUgd29ybGRcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbdGVtcC52YWx1ZS5pbmRleF0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoO1xuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZS5wdXNoKHRlbXAudmFsdWUpO1xuICAgICAgICAgIGkrKztcbiAgICAgICAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggZGF0YSBub3cgdG8gc2F0aXNmeSBhbnkgd2FpdGluZyByZXF1ZXN0c1xuICAgICAgICAgICAgaWYgKGxpbWl0IDw9IGkpIHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBEb25lIGl0ZXJhdGluZyEgV2UgY2FuIGdyYWR1YXRlIHRoZSBwYXJ0aWFsIGNhY2hlIC8gbG9va3VwcyBpbnRvXG4gICAgLy8gZmluaXNoZWQgb25lcywgYW5kIHNhdGlzZnkgYWxsIHRoZSByZXF1ZXN0c1xuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgdGhpcy5fY2FjaGVMb29rdXAgPSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdjYWNoZUJ1aWx0Jyk7XG4gICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gIH1cbiAgYnVpbGRDYWNoZSAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGU7XG4gICAgfSBlbHNlIGlmICghdGhpcy5fY2FjaGVQcm9taXNlKSB7XG4gICAgICB0aGlzLl9jYWNoZVByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vIFRoZSBzZXRUaW1lb3V0IGhlcmUgaXMgYWJzb2x1dGVseSBuZWNlc3NhcnksIG9yIHRoaXMuX2NhY2hlUHJvbWlzZVxuICAgICAgICAvLyB3b24ndCBiZSBzdG9yZWQgaW4gdGltZSBmb3IgdGhlIG5leHQgYnVpbGRDYWNoZSgpIGNhbGwgdGhhdCBjb21lc1xuICAgICAgICAvLyB0aHJvdWdoXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIHRoaXMuX2J1aWxkQ2FjaGUocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgY29uc3QgaXRlbXNUb1Jlc2V0ID0gKHRoaXMuX2NhY2hlIHx8IFtdKVxuICAgICAgLmNvbmNhdCh0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgW10pO1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtc1RvUmVzZXQpIHtcbiAgICAgIGl0ZW0ucmVzZXQgPSB0cnVlO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBoYW5kbGVSZXNldCAocmVqZWN0KSB7XG4gICAgZm9yIChjb25zdCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0ucmVqZWN0KCk7XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlcztcbiAgICB9XG4gICAgcmVqZWN0KCk7XG4gIH1cbiAgYXN5bmMgY291bnRSb3dzICgpIHtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpKS5sZW5ndGg7XG4gIH1cbiAgYXN5bmMgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgICAgaWYgKHdyYXBwZWRJdGVtLnJvd1thdHRyXSBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB3cmFwcGVkSXRlbS5kZWxheWVkUm93ID0gd3JhcHBlZEl0ZW0uZGVsYXllZFJvdyB8fCB7fTtcbiAgICAgICAgICB3cmFwcGVkSXRlbS5kZWxheWVkUm93W2F0dHJdID0gYXdhaXQgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgICAgICB9KSgpO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gd3JhcHBlZEl0ZW0ucm93KSB7XG4gICAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGRlbGV0ZSB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZnVuYyBvZiBPYmplY3QudmFsdWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBhd2FpdCBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICAvLyBBbGxvdyBwcm9iaW5nIHRvIHNlZSB3aGF0ZXZlciBkYXRhIGhhcHBlbnMgdG8gYmUgYXZhaWxhYmxlXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6IHRoaXMuX2NhY2hlIHx8IHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSxcbiAgICAgIGxvb2t1cDogdGhpcy5fY2FjaGVMb29rdXAgfHwgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGFzeW5jIGdldEl0ZW0gKGluZGV4ID0gbnVsbCkge1xuICAgIGlmICh0aGlzLl9jYWNoZUxvb2t1cCkge1xuICAgICAgcmV0dXJuIGluZGV4ID09PSBudWxsID8gdGhpcy5fY2FjaGVbMF0gOiB0aGlzLl9jYWNoZVt0aGlzLl9jYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlTG9va3VwICYmXG4gICAgICAgICgoaW5kZXggPT09IG51bGwgJiYgdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aCA+IDApIHx8XG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgcmV0dXJuIGluZGV4ID09PSBudWxsID8gdGhpcy5fcGFydGlhbENhY2hlWzBdXG4gICAgICAgIDogdGhpcy5fcGFydGlhbENhY2hlW3RoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgIH1cbiAgICAvLyBTdHVwaWQgYXBwcm9hY2ggd2hlbiB0aGUgY2FjaGUgaXNuJ3QgYnVpbHQ6IGludGVyYXRlIHVudGlsIHdlIHNlZSB0aGVcbiAgICAvLyBpbmRleC4gU3ViY2xhc3NlcyBjb3VsZCBvdmVycmlkZSB0aGlzXG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBpZiAoaXRlbSA9PT0gbnVsbCB8fCBpdGVtLmluZGV4ID09PSBpbmRleCkge1xuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHN1cHByZXNzQXR0cmlidXRlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFkZEZpbHRlciAoZnVuYywgYXR0cmlidXRlID0gbnVsbCkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2luZGV4RmlsdGVyID0gZnVuYztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZSA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZSAmJiB0aGlzLm1vZGVsLnRhYmxlc1tleGlzdGluZ1RhYmxlLnRhYmxlSWRdKSB8fCBudWxsO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnUHJvbW90ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdFeHBhbmRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgdW5yb2xsIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ1Vucm9sbGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZShsaW1pdCkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiBpbmRleGVzLm1hcChpbmRleCA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXhcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZShsaW1pdCkpIHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleDogd3JhcHBlZEl0ZW0uaW5kZXhcbiAgICAgIH07XG4gICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuICBkdXBsaWNhdGUgKCkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVUYWJsZSh7XG4gICAgICB0eXBlOiAnRHVwbGljYXRlZFRhYmxlJ1xuICAgIH0pO1xuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0LCB0eXBlID0gJ0Nvbm5lY3RlZFRhYmxlJykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZSh7IHR5cGUgfSk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgZm9yIChjb25zdCBvdGhlclRhYmxlIG9mIG90aGVyVGFibGVMaXN0KSB7XG4gICAgICBvdGhlclRhYmxlLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGdldCBpblVzZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLmNsYXNzZXMpLnNvbWUoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlSWQgPT09IHRoaXMudGFibGVJZCB8fFxuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xIHx8XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTE7XG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlIChmb3JjZSA9IGZhbHNlKSB7XG4gICAgaWYgKCFmb3JjZSAmJiB0aGlzLmluVXNlKSB7XG4gICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBpbi11c2UgdGFibGUgJHt0aGlzLnRhYmxlSWR9YCk7XG4gICAgICBlcnIuaW5Vc2UgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9uYW1lO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLl9kYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93OiB0aGlzLl9kYXRhW2luZGV4XSB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljRGljdFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB7fTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX25hbWU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpcmVkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNvbnN0IEF0dHJUYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oc3VwZXJjbGFzcykge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgICB9XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgICB9XG4gICAgZ2V0IG5hbWUgKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEF0dHJUYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mQXR0clRhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQXR0clRhYmxlTWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgQXR0clRhYmxlTWl4aW4gZnJvbSAnLi9BdHRyVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFByb21vdGVkVGFibGUgZXh0ZW5kcyBBdHRyVGFibGVNaXhpbihUYWJsZSkge1xuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgLy8gV2Ugb3ZlcnJpZGUgX2J1aWxkQ2FjaGUgYmVjYXVzZSB3ZSBkb24ndCBhY3R1YWxseSB3YW50IHRvIGNhbGwgX2ZpbmlzaEl0ZW1cbiAgICAvLyB1bnRpbCBhbGwgdW5pcXVlIHZhbHVlcyBoYXZlIGJlZW4gc2VlblxuICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZSA9IFtdO1xuICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cCA9IHt9O1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IFtdO1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZSgpO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgdGVtcCA9PT0gbnVsbCkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fdW5maW5pc2hlZENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIE9rYXksIG5vdyB3ZSd2ZSBzZWVuIGV2ZXJ5dGhpbmc7IHdlIGNhbiBjYWxsIF9maW5pc2hJdGVtIG9uIGVhY2ggb2YgdGhlXG4gICAgLy8gdW5pcXVlIHZhbHVlc1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHRoaXMuX3VuZmluaXNoZWRDYWNoZSkge1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odmFsdWUpKSB7XG4gICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbdmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godmFsdWUpO1xuICAgICAgICBpKys7XG4gICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGRhdGEgbm93IHRvIHNhdGlzZnkgYW55IHdhaXRpbmcgcmVxdWVzdHNcbiAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICAgICAgICByZXNvbHZlKHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBEb25lIGl0ZXJhdGluZyEgV2UgY2FuIGdyYWR1YXRlIHRoZSBwYXJ0aWFsIGNhY2hlIC8gbG9va3VwcyBpbnRvXG4gICAgLy8gZmluaXNoZWQgb25lcywgYW5kIHNhdGlzZnkgYWxsIHRoZSByZXF1ZXN0c1xuICAgIGRlbGV0ZSB0aGlzLl91bmZpbmlzaGVkQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cDtcbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIHRoaXMuX2NhY2hlTG9va3VwID0gdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IFN0cmluZyhhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQhXG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3VuZmluaXNoZWRDYWNoZVt0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbaW5kZXhdXTtcbiAgICAgICAgZXhpc3RpbmdJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB3cmFwcGVkUGFyZW50LmNvbm5lY3RJdGVtKGV4aXN0aW5nSXRlbSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmFjZXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICB0aGlzLl92YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlICsgdGhpcy5fdmFsdWU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBTdHJpbmcodGhpcy5fdmFsdWUpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAvLyBOb3JtYWwgZmFjZXRpbmcganVzdCBnaXZlcyBhIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgdGFibGVcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogT2JqZWN0LmFzc2lnbih7fSwgd3JhcHBlZFBhcmVudC5yb3cpLFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIFRyYW5zcG9zZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5faW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIGlmICh0aGlzLl9pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmluZGV4ID0gdGhpcy5faW5kZXg7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9pbmRleDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMuX2luZGV4fWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGF3YWl0IHRoaXMucGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuXG4gICAgLy8gSXRlcmF0ZSB0aGUgcm93J3MgYXR0cmlidXRlcyBhcyBpbmRleGVzXG4gICAgY29uc3Qgd3JhcHBlZFBhcmVudCA9IHRoaXMucGFyZW50VGFibGUuX2NhY2hlW3RoaXMucGFyZW50VGFibGUuX2NhY2hlTG9va3VwW3RoaXMuX2luZGV4XV0gfHwgeyByb3c6IHt9IH07XG4gICAgZm9yIChjb25zdCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgcm93OiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gdmFsdWUgOiB7IHZhbHVlIH0sXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVHJhbnNwb3NlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLmdldFNvcnRIYXNoKCkpLmpvaW4oJywnKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBEb24ndCB0cnkgdG8gY29ubmVjdCB2YWx1ZXMgdW50aWwgYWxsIG9mIHRoZSBwYXJlbnQgdGFibGVzJyBjYWNoZXMgYXJlXG4gICAgLy8gYnVpbHQ7IFRPRE86IG1pZ2h0IGJlIGFibGUgdG8gZG8gc29tZXRoaW5nIG1vcmUgcmVzcG9uc2l2ZSBoZXJlP1xuICAgIGF3YWl0IFByb21pc2UuYWxsKHBhcmVudFRhYmxlcy5tYXAocFRhYmxlID0+IHBUYWJsZS5idWlsZENhY2hlKCkpKTtcblxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlTG9va3VwKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVMb29rdXApKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXRcbiAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XV0pXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRHVwbGljYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIC8vIFlpZWxkIHRoZSBzYW1lIGl0ZW1zIHdpdGggdGhlIHNhbWUgY29ubmVjdGlvbnMsIGJ1dCB3cmFwcGVkIGFuZCBmaW5pc2hlZFxuICAgIC8vIGJ5IHRoaXMgdGFibGVcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXg6IGl0ZW0uaW5kZXgsXG4gICAgICAgIHJvdzogaXRlbS5yb3csXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBPYmplY3QudmFsdWVzKGl0ZW0uY29ubmVjdGVkSXRlbXMpLnJlZHVjZSgoYWdnLCBpdGVtTGlzdCkgPT4ge1xuICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KGl0ZW1MaXN0KTtcbiAgICAgICAgfSwgW10pXG4gICAgICB9KTtcbiAgICAgIGl0ZW0ucmVnaXN0ZXJEdXBsaWNhdGUobmV3SXRlbSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRlZFRhYmxlO1xuIiwiaW1wb3J0IEF0dHJUYWJsZU1peGluIGZyb20gJy4vQXR0clRhYmxlTWl4aW4uanMnO1xuXG5jb25zdCBDaGlsZFRhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBBdHRyVGFibGVNaXhpbihzdXBlcmNsYXNzKSB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIF93cmFwIChvcHRpb25zKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gc3VwZXIuX3dyYXAob3B0aW9ucyk7XG4gICAgICBuZXdJdGVtLnBhcmVudEluZGV4ID0gb3B0aW9ucy5wYXJlbnRJbmRleDtcbiAgICAgIHJldHVybiBuZXdJdGVtO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQ2hpbGRUYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mQ2hpbGRUYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IENoaWxkVGFibGVNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBDaGlsZFRhYmxlTWl4aW4gZnJvbSAnLi9DaGlsZFRhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgQ2hpbGRUYWJsZU1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCByb3cgPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKHJvdyAhPT0gdW5kZWZpbmVkICYmIHJvdyAhPT0gbnVsbCAmJiBPYmplY3Qua2V5cyhyb3cpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdyxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF0sXG4gICAgICAgICAgcGFyZW50SW5kZXg6IHdyYXBwZWRQYXJlbnQuaW5kZXhcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgICBpbmRleCsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFeHBhbmRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IENoaWxkVGFibGVNaXhpbiBmcm9tICcuL0NoaWxkVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFVucm9sbGVkVGFibGUgZXh0ZW5kcyBDaGlsZFRhYmxlTWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHJvd3MgPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKHJvd3MgIT09IHVuZGVmaW5lZCAmJiByb3dzICE9PSBudWxsICYmXG4gICAgICAgICAgdHlwZW9mIHJvd3NbU3ltYm9sLml0ZXJhdG9yXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzKSB7XG4gICAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgICByb3csXG4gICAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF0sXG4gICAgICAgICAgICBwYXJlbnRJbmRleDogd3JhcHBlZFBhcmVudC5pbmRleFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFVucm9sbGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFBhcmVudENoaWxkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJy8nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignLCcpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBwYXJlbnRUYWJsZSwgY2hpbGRUYWJsZTtcbiAgICBpZiAodGhpcy5wYXJlbnRUYWJsZXNbMF0ucGFyZW50VGFibGUgPT09IHRoaXMucGFyZW50VGFibGVzWzFdKSB7XG4gICAgICBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzFdO1xuICAgICAgY2hpbGRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzBdO1xuICAgIH0gZWxzZSBpZiAodGhpcy5wYXJlbnRUYWJsZXNbMV0ucGFyZW50VGFibGUgPT09IHRoaXMucGFyZW50VGFibGVzWzBdKSB7XG4gICAgICBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzBdO1xuICAgICAgY2hpbGRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzFdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudENoaWxkVGFibGUgbm90IHNldCB1cCBwcm9wZXJseWApO1xuICAgIH1cblxuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaGlsZCBvZiBjaGlsZFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgcGFyZW50ID0gYXdhaXQgcGFyZW50VGFibGUuZ2V0SXRlbShjaGlsZC5wYXJlbnRJbmRleCk7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogW3BhcmVudCwgY2hpbGRdXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQYXJlbnRDaGlsZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgKyB0aGlzLmNsYXNzTmFtZTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlTmV3Q2xhc3MgKG5ld1RhYmxlLCB0eXBlID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGVcbiAgICB9KTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCwgJ0dlbmVyaWNDbGFzcycpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSkpO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUudW5yb2xsKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC5vcHRpbWl6ZVRhYmxlcygpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IGVkZ2VJZHMgPSBvcHRpb25zLmNsYXNzZXNcbiAgICAgID8gb3B0aW9ucy5jbGFzc2VzLm1hcChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc0lkKVxuICAgICAgOiBvcHRpb25zLmNsYXNzSWRzIHx8IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBpdGVyYXRvcnMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBvZiBlZGdlSWRzKSB7XG4gICAgICBpZiAoIXRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzW2VkZ2VJZF0pIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLm1vZGVsLmNsYXNzZXNbZWRnZUlkXTtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmNsYXNzT2JqLmdldEVkZ2VSb2xlKGVkZ2VDbGFzcyk7XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICAgIGNvbnN0IHRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgaXRlcmF0b3JzLnB1c2godGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpKTtcbiAgICAgIH1cbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgaXRlcmF0b3JzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuaW1wb3J0IE5vZGVXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkcyA9IG9wdGlvbnMuZWRnZUNsYXNzSWRzIHx8IHt9O1xuICB9XG4gICogZWRnZUNsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBnZXRFZGdlUm9sZSAoZWRnZUNsYXNzKSB7XG4gICAgaWYgKCF0aGlzLmVkZ2VDbGFzc0lkc1tlZGdlQ2xhc3MuY2xhc3NJZF0pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgcmV0dXJuICdib3RoJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnc291cmNlJztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgIHJldHVybiAndGFyZ2V0JztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnRlcm5hbCBtaXNtYXRjaCBiZXR3ZWVuIG5vZGUgYW5kIGVkZ2UgY2xhc3NJZHNgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuZWRnZUNsYXNzSWRzID0gdGhpcy5lZGdlQ2xhc3NJZHM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgTm9kZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoeyBhdXRvY29ubmVjdCA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoIWF1dG9jb25uZWN0IHx8IGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIC8vIEFyZSB3ZSB0aGUgc291cmNlIG9yIHRhcmdldCBvZiB0aGUgZXhpc3RpbmcgZWRnZSAoaW50ZXJuYWxseSwgaW4gdGVybXNcbiAgICAgIC8vIG9mIHNvdXJjZUlkIC8gdGFyZ2V0SWQsIG5vdCBlZGdlQ2xhc3MuZGlyZWN0aW9uKT9cbiAgICAgIGNvbnN0IGlzU291cmNlID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZDtcblxuICAgICAgLy8gQXMgd2UncmUgY29udmVydGVkIHRvIGFuIGVkZ2UsIG91ciBuZXcgcmVzdWx0aW5nIHNvdXJjZSBBTkQgdGFyZ2V0XG4gICAgICAvLyBzaG91bGQgYmUgd2hhdGV2ZXIgaXMgYXQgdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MgKGlmIGFueXRoaW5nKVxuICAgICAgaWYgKGlzU291cmNlKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIG5vZGUgY2xhc3Mgb24gdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MsIGFkZCBvdXJcbiAgICAgIC8vIGlkIHRvIGl0cyBsaXN0IG9mIGNvbm5lY3Rpb25zXG4gICAgICBjb25zdCBub2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGlmIChub2RlQ2xhc3MpIHtcbiAgICAgICAgbm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdGFibGVJZCBsaXN0cyBzaG91bGQgZW1hbmF0ZSBvdXQgZnJvbSB0aGUgKG5ldykgZWRnZSB0YWJsZTsgYXNzdW1pbmdcbiAgICAgIC8vIChmb3IgYSBtb21lbnQpIHRoYXQgaXNTb3VyY2UgPT09IHRydWUsIHdlJ2QgY29uc3RydWN0IHRoZSB0YWJsZUlkIGxpc3RcbiAgICAgIC8vIGxpa2UgdGhpczpcbiAgICAgIGxldCB0YWJsZUlkTGlzdCA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgZWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKCFpc1NvdXJjZSkge1xuICAgICAgICAvLyBXaG9vcHMsIGdvdCBpdCBiYWNrd2FyZHMhXG4gICAgICAgIHRhYmxlSWRMaXN0LnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBlZGdlQ2xhc3MuZGlyZWN0ZWQ7XG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhYmxlSWRMaXN0O1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgLy8gT2theSwgd2UndmUgZ290IHR3byBlZGdlcywgc28gdGhpcyBpcyBhIGxpdHRsZSBtb3JlIHN0cmFpZ2h0Zm9yd2FyZFxuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIC8vIEFkZCB0aGlzIGNsYXNzIHRvIHRoZSBzb3VyY2UncyAvIHRhcmdldCdzIGVkZ2VDbGFzc0lkc1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgLy8gQ29uY2F0ZW5hdGUgdGhlIGludGVybWVkaWF0ZSB0YWJsZUlkIGxpc3RzLCBlbWFuYXRpbmcgb3V0IGZyb20gdGhlXG4gICAgICAvLyAobmV3KSBlZGdlIHRhYmxlXG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gc291cmNlRWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBzb3VyY2VFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YXJnZXRFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHRhcmdldEVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQodGFyZ2V0RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgIGlmICh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgLy8gRGlzY29ubmVjdCB0aGUgZXhpc3RpbmcgZWRnZSBjbGFzc2VzIGZyb20gdGhlIG5ldyAobm93IGVkZ2UpIGNsYXNzXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH1cbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGxldCB0aGlzSGFzaCwgb3RoZXJIYXNoLCBzb3VyY2VUYWJsZUlkcywgdGFyZ2V0VGFibGVJZHM7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gWyB0aGlzSGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGlmIChvdGhlckF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGU7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZS5wcm9tb3RlKG90aGVyQXR0cmlidXRlKTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gWyBvdGhlckhhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHNcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgIGF0dHJpYnV0ZSxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBjb25uZWN0VG9DaGlsZE5vZGVDbGFzcyAoY2hpbGRDbGFzcykge1xuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpcy50YWJsZS5jb25uZWN0KFtjaGlsZENsYXNzLnRhYmxlXSwgJ1BhcmVudENoaWxkVGFibGUnKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzOiBbXSxcbiAgICAgIHRhcmdldENsYXNzSWQ6IGNoaWxkQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzOiBbXVxuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgY2hpbGRDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5leHBhbmQoYXR0cmlidXRlKSwgJ05vZGVDbGFzcycpO1xuICAgIHRoaXMuY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MobmV3Tm9kZUNsYXNzKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS51bnJvbGwoYXR0cmlidXRlKSwgJ05vZGVDbGFzcycpO1xuICAgIHRoaXMuY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MobmV3Tm9kZUNsYXNzKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIHByb2plY3ROZXdFZGdlIChjbGFzc0lkTGlzdCkge1xuICAgIGNvbnN0IGNsYXNzTGlzdCA9IGNsYXNzSWRMaXN0Lm1hcChjbGFzc0lkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLmNsYXNzZXNbY2xhc3NJZF07XG4gICAgfSk7XG4gICAgaWYgKGNsYXNzTGlzdC5sZW5ndGggPCAyIHx8IGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0udHlwZSAhPT0gJ05vZGUnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY2xhc3NJZExpc3RgKTtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlQ2xhc3NJZCA9IHRoaXMuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzc0lkID0gY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNsYXNzTGlzdC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGlmIChjbGFzc0xpc3RbaV0udHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIHRhcmdldFRhYmxlSWRzLnB1c2goY2xhc3NMaXN0W2ldLnRhYmxlSWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgdGVtcCA9IEFycmF5LmZyb20oY2xhc3NMaXN0W2ldLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCk7XG4gICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiB0ZW1wKSB7XG4gICAgICAgICAgdGFyZ2V0VGFibGVJZHMucHVzaCh0YWJsZUlkKTtcbiAgICAgICAgfVxuICAgICAgICB0YXJnZXRUYWJsZUlkcy5wdXNoKGNsYXNzTGlzdFtpXS50YWJsZUlkKTtcbiAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzTGlzdFtpXS50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnB1c2godGFibGVJZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgdGFibGVJZCA9IHRoaXMudGFibGUuY29ubmVjdChbXG4gICAgICB0aGlzLm1vZGVsLnRhYmxlc1t0YXJnZXRUYWJsZUlkc1swXV1cbiAgICBdKS50YWJsZUlkO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIHRoaXMuY29ubmVjdGVkQ2xhc3NlcygpKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBzb3VyY2VOb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkXS50YWJsZUlkO1xuICAgIGNvbnN0IHRhYmxlSWRzID0gdGhpcy5jbGFzc09iai5zb3VyY2VUYWJsZUlkcy5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIHRhcmdldE5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHRhcmdldFRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWRdLnRhYmxlSWQ7XG4gICAgY29uc3QgdGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmNvbmNhdChbIHRhcmdldFRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogbm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpLFxuICAgICAgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKVxuICAgIF0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHxcbiAgICAgICgodGhpcy5zb3VyY2VDbGFzcyAmJiB0aGlzLnNvdXJjZUNsYXNzLmNsYXNzTmFtZSkgfHwgJz8nKSArXG4gICAgICAnLScgK1xuICAgICAgKCh0aGlzLnRhcmdldENsYXNzICYmIHRoaXMudGFyZ2V0Q2xhc3MuY2xhc3NOYW1lKSB8fCAnPycpO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHJldHVybiBzdXBlci5wcm9tb3RlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgICB0eXBlOiAnTm9kZUNsYXNzJ1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgIG5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgICBzaWRlOiAhdGhpcy5zb3VyY2VDbGFzc0lkID8gJ3NvdXJjZScgOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogYXR0cmlidXRlXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gICAgfVxuICB9XG4gIGNvbm5lY3RGYWNldGVkQ2xhc3MgKG5ld0VkZ2VDbGFzcykge1xuICAgIC8vIFdoZW4gYW4gZWRnZSBjbGFzcyBpcyBmYWNldGVkLCB3ZSB3YW50IHRvIGtlZXAgdGhlIHNhbWUgY29ubmVjdGlvbnMuIFRoaXNcbiAgICAvLyBtZWFucyB3ZSBuZWVkIHRvIGNsb25lIGVhY2ggdGFibGUgY2hhaW4sIGFuZCBhZGQgb3VyIG93biB0YWJsZSB0byBpdFxuICAgIC8vIChiZWNhdXNlIG91ciB0YWJsZSBpcyB0aGUgcGFyZW50VGFibGUgb2YgdGhlIG5ldyBvbmUpXG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBuZXdFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMgPSBBcnJheS5mcm9tKHRoaXMuc291cmNlVGFibGVJZHMpO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGhpcy50YWJsZUlkKTtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgbmV3RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgICB0aGlzLnRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIGNvbnN0IG5ld0NsYXNzZXMgPSBzdXBlci5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcyk7XG4gICAgZm9yIChjb25zdCBuZXdDbGFzcyBvZiBuZXdDbGFzc2VzKSB7XG4gICAgICB0aGlzLmNvbm5lY3RGYWNldGVkQ2xhc3MobmV3Q2xhc3MpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3Q2xhc3NlcztcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdDbGFzcyBvZiBzdXBlci5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgdGhpcy5jb25uZWN0RmFjZXRlZENsYXNzKG5ld0NsYXNzKTtcbiAgICAgIHlpZWxkIG5ld0NsYXNzO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImNsYXNzIEZpbGVGb3JtYXQge1xuICBhc3luYyBidWlsZFJvdyAoaXRlbSkge1xuICAgIGNvbnN0IHJvdyA9IHt9O1xuICAgIGZvciAobGV0IGF0dHIgaW4gaXRlbS5yb3cpIHtcbiAgICAgIHJvd1thdHRyXSA9IGF3YWl0IGl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICByZXR1cm4gcm93O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGaWxlRm9ybWF0O1xuIiwiY2xhc3MgUGFyc2VGYWlsdXJlIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvciAoZmlsZUZvcm1hdCkge1xuICAgIHN1cGVyKGBGYWlsZWQgdG8gcGFyc2UgZm9ybWF0OiAke2ZpbGVGb3JtYXQuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUGFyc2VGYWlsdXJlO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcbmltcG9ydCBQYXJzZUZhaWx1cmUgZnJvbSAnLi9QYXJzZUZhaWx1cmUuanMnO1xuXG5jb25zdCBOT0RFX05BTUVTID0gWydub2RlcycsICdOb2RlcyddO1xuY29uc3QgRURHRV9OQU1FUyA9IFsnZWRnZXMnLCAnbGlua3MnLCAnRWRnZXMnLCAnTGlua3MnXTtcblxuY2xhc3MgRDNKc29uIGV4dGVuZHMgRmlsZUZvcm1hdCB7XG4gIGFzeW5jIGltcG9ydERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICB0ZXh0LFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNvdXJjZUF0dHJpYnV0ZSA9ICdzb3VyY2UnLFxuICAgIHRhcmdldEF0dHJpYnV0ZSA9ICd0YXJnZXQnLFxuICAgIGNsYXNzQXR0cmlidXRlID0gbnVsbFxuICB9KSB7XG4gICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgY29uc3Qgbm9kZU5hbWUgPSBOT0RFX05BTUVTLmZpbmQobmFtZSA9PiBkYXRhW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpO1xuICAgIGNvbnN0IGVkZ2VOYW1lID0gRURHRV9OQU1FUy5maW5kKG5hbWUgPT4gZGF0YVtuYW1lXSBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICBpZiAoIW5vZGVOYW1lIHx8ICFlZGdlTmFtZSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlRmFpbHVyZSh0aGlzKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb3JlVGFibGUgPSBtb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnU3RhdGljRGljdFRhYmxlJyxcbiAgICAgIG5hbWU6ICdjb3JlVGFibGUnLFxuICAgICAgZGF0YTogZGF0YVxuICAgIH0pO1xuICAgIGNvbnN0IGNvcmVDbGFzcyA9IG1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29yZVRhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgICBsZXQgW25vZGVzLCBlZGdlc10gPSBjb3JlQ2xhc3MuY2xvc2VkVHJhbnNwb3NlKFtub2RlTmFtZSwgZWRnZU5hbWVdKTtcblxuICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgaWYgKG5vZGVBdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBpbXBvcnQgY2xhc3NlcyBmcm9tIEQzLXN0eWxlIEpTT04gd2l0aG91dCBub2RlQXR0cmlidXRlYCk7XG4gICAgICB9XG4gICAgICBjb25zdCBub2RlQ2xhc3NlcyA9IFtdO1xuICAgICAgY29uc3Qgbm9kZUNsYXNzTG9va3VwID0ge307XG4gICAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlQ2xhc3Mgb2Ygbm9kZXMub3BlbkZhY2V0KGNsYXNzQXR0cmlidXRlKSkge1xuICAgICAgICBub2RlQ2xhc3NMb29rdXBbbm9kZUNsYXNzLmNsYXNzTmFtZV0gPSBub2RlQ2xhc3Nlcy5sZW5ndGg7XG4gICAgICAgIG5vZGVDbGFzc2VzLnB1c2gobm9kZUNsYXNzLmludGVycHJldEFzTm9kZXMoKSk7XG4gICAgICB9XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlcy5vcGVuRmFjZXQoY2xhc3NBdHRyaWJ1dGUpKSB7XG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goZWRnZUNsYXNzLmludGVycHJldEFzRWRnZXMoKSk7XG4gICAgICAgIGNvbnN0IHNhbXBsZSA9IGF3YWl0IGVkZ2VDbGFzcy50YWJsZS5nZXRJdGVtKCk7XG4gICAgICAgIGNvbnN0IHNvdXJjZUNsYXNzTmFtZSA9IHNhbXBsZS5yb3dbc291cmNlQXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdO1xuICAgICAgICBpZiAobm9kZUNsYXNzTG9va3VwW3NvdXJjZUNsYXNzTmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgICAgICAgbm9kZUNsYXNzOiBub2RlQ2xhc3Nlc1tub2RlQ2xhc3NMb29rdXBbc291cmNlQ2xhc3NOYW1lXV0sXG4gICAgICAgICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgICAgICBlZGdlQXR0cmlidXRlOiBzb3VyY2VBdHRyaWJ1dGVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0YXJnZXRDbGFzc05hbWUgPSBzYW1wbGUucm93W3RhcmdldEF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXTtcbiAgICAgICAgaWYgKG5vZGVDbGFzc0xvb2t1cFt0YXJnZXRDbGFzc05hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgICAgIG5vZGVDbGFzczogbm9kZUNsYXNzZXNbbm9kZUNsYXNzTG9va3VwW3RhcmdldENsYXNzTmFtZV1dLFxuICAgICAgICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICAgICAgZWRnZUF0dHJpYnV0ZTogdGFyZ2V0QXR0cmlidXRlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZXMgPSBub2Rlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgICBub2Rlcy5zZXRDbGFzc05hbWUobm9kZU5hbWUpO1xuICAgICAgZWRnZXMgPSBlZGdlcy5pbnRlcnByZXRBc0VkZ2VzKCk7XG4gICAgICBlZGdlcy5zZXRDbGFzc05hbWUoZWRnZU5hbWUpO1xuICAgICAgbm9kZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgICAgZWRnZUNsYXNzOiBlZGdlcyxcbiAgICAgICAgc2lkZTogJ3NvdXJjZScsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHNvdXJjZUF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgICBub2Rlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgICBlZGdlQ2xhc3M6IGVkZ2VzLFxuICAgICAgICBzaWRlOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZSxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogdGFyZ2V0QXR0cmlidXRlXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBwcmV0dHkgPSB0cnVlLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNvdXJjZUF0dHJpYnV0ZSA9ICdzb3VyY2UnLFxuICAgIHRhcmdldEF0dHJpYnV0ZSA9ICd0YXJnZXQnLFxuICAgIGNsYXNzQXR0cmlidXRlID0gbnVsbFxuICB9KSB7XG4gICAgaWYgKGNsYXNzQXR0cmlidXRlICYmICFub2RlQXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGV4cG9ydCBEMy1zdHlsZSBKU09OIHdpdGggY2xhc3Nlcywgd2l0aG91dCBhIG5vZGVBdHRyaWJ1dGVgKTtcbiAgICB9XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIGxpbmtzOiBbXVxuICAgIH07XG4gICAgY29uc3Qgbm9kZUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IG5vZGVDbGFzc2VzID0gW107XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGluY2x1ZGVDbGFzc2VzKSB7XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIG5vZGVDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQub3RoZXIgPSByZXN1bHQub3RoZXIgfHwgW107XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICByZXN1bHQub3RoZXIucHVzaChhd2FpdCB0aGlzLmJ1aWxkUm93KGl0ZW0pKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IG5vZGVDbGFzcyBvZiBub2RlQ2xhc3Nlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIG5vZGVDbGFzcy50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgbm9kZUxvb2t1cFtub2RlLmV4cG9ydElkXSA9IHJlc3VsdC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHRoaXMuYnVpbGRSb3cobm9kZSk7XG4gICAgICAgIGlmIChub2RlQXR0cmlidXRlKSB7XG4gICAgICAgICAgcm93W25vZGVBdHRyaWJ1dGVdID0gbm9kZS5leHBvcnRJZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICByb3dbY2xhc3NBdHRyaWJ1dGVdID0gbm9kZS5jbGFzc09iai5jbGFzc05hbWU7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0Lm5vZGVzLnB1c2gocm93KTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiBlZGdlQ2xhc3MudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHRoaXMuYnVpbGRSb3coZWRnZSk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIGVkZ2Uuc291cmNlTm9kZXMoeyBjbGFzc2VzOiBub2RlQ2xhc3NlcyB9KSkge1xuICAgICAgICAgIHJvd1tzb3VyY2VBdHRyaWJ1dGVdID0gbm9kZUF0dHJpYnV0ZSA/IHNvdXJjZS5leHBvcnRJZCA6IG5vZGVMb29rdXBbc291cmNlLmV4cG9ydElkXTtcbiAgICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIHJvd1tzb3VyY2VBdHRyaWJ1dGUgKyAnXycgKyBjbGFzc0F0dHJpYnV0ZV0gPSBzb3VyY2UuY2xhc3NPYmouY2xhc3NOYW1lO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlLnRhcmdldE5vZGVzKHsgY2xhc3Nlczogbm9kZUNsYXNzZXMgfSkpIHtcbiAgICAgICAgICAgIHJvd1t0YXJnZXRBdHRyaWJ1dGVdID0gbm9kZUF0dHJpYnV0ZSA/IHRhcmdldC5leHBvcnRJZCA6IG5vZGVMb29rdXBbdGFyZ2V0LmV4cG9ydElkXTtcbiAgICAgICAgICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICByb3dbdGFyZ2V0QXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdID0gdGFyZ2V0LmNsYXNzT2JqLmNsYXNzTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5saW5rcy5wdXNoKE9iamVjdC5hc3NpZ24oe30sIHJvdykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJldHR5KSB7XG4gICAgICByZXN1bHQubm9kZXMgPSAnICBcIm5vZGVzXCI6IFtcXG4gICAgJyArIHJlc3VsdC5ub2Rlcy5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgIC5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgXSc7XG4gICAgICByZXN1bHQubGlua3MgPSAnICBcImxpbmtzXCI6IFtcXG4gICAgJyArIHJlc3VsdC5saW5rcy5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgIC5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgXSc7XG4gICAgICBpZiAocmVzdWx0Lm90aGVyKSB7XG4gICAgICAgIHJlc3VsdC5vdGhlciA9ICcsXFxuICBcIm90aGVyXCI6IFtcXG4gICAgJyArIHJlc3VsdC5vdGhlci5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgICAgLmpvaW4oJyxcXG4gICAgJykgKyAnXFxuICBdJztcbiAgICAgIH1cbiAgICAgIHJlc3VsdCA9IGB7XFxuJHtyZXN1bHQubm9kZXN9LFxcbiR7cmVzdWx0LmxpbmtzfSR7cmVzdWx0Lm90aGVyIHx8ICcnfVxcbn1cXG5gO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBKU09OLnN0cmluZ2lmeShyZXN1bHQpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogJ2RhdGE6dGV4dC9qc29uO2Jhc2U2NCwnICsgQnVmZmVyLmZyb20ocmVzdWx0KS50b1N0cmluZygnYmFzZTY0JyksXG4gICAgICB0eXBlOiAndGV4dC9qc29uJyxcbiAgICAgIGV4dGVuc2lvbjogJ2pzb24nXG4gICAgfTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IEQzSnNvbigpO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIEZJTEVfRk9STUFUUyBmcm9tICcuLi9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0cy5qcyc7XG5cbmNvbnN0IERBVEFMSUJfRk9STUFUUyA9IHtcbiAgJ2pzb24nOiAnanNvbicsXG4gICdjc3YnOiAnY3N2JyxcbiAgJ3Rzdic6ICd0c3YnXG59O1xuXG5jbGFzcyBOZXR3b3JrTW9kZWwgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgb3JpZ3JhcGgsXG4gICAgbW9kZWxJZCxcbiAgICBuYW1lID0gbW9kZWxJZCxcbiAgICBhbm5vdGF0aW9ucyA9IHt9LFxuICAgIGNsYXNzZXMgPSB7fSxcbiAgICB0YWJsZXMgPSB7fVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9yaWdyYXBoO1xuICAgIHRoaXMubW9kZWxJZCA9IG1vZGVsSWQ7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmFubm90YXRpb25zID0gYW5ub3RhdGlvbnM7XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG4gICAgdGhpcy50YWJsZXMgPSB7fTtcblxuICAgIHRoaXMuX25leHRDbGFzc0lkID0gMTtcbiAgICB0aGlzLl9uZXh0VGFibGVJZCA9IDE7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXMoY2xhc3NlcykpIHtcbiAgICAgIHRoaXMuY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IHRoaXMuaHlkcmF0ZShjbGFzc09iaiwgQ0xBU1NFUyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgICB0aGlzLnRhYmxlc1t0YWJsZS50YWJsZUlkXSA9IHRoaXMuaHlkcmF0ZSh0YWJsZSwgVEFCTEVTKTtcbiAgICB9XG5cbiAgICB0aGlzLm9uKCd1cGRhdGUnLCAoKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc2F2ZVRpbWVvdXQpO1xuICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5fb3JpZ3JhcGguc2F2ZSgpO1xuICAgICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHVuZGVmaW5lZDtcbiAgICAgIH0sIDApO1xuICAgIH0pO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgY2xhc3NlcyA9IHt9O1xuICAgIGNvbnN0IHRhYmxlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpKSB7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0gPSB0YWJsZU9iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXS50eXBlID0gdGFibGVPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIG1vZGVsSWQ6IHRoaXMubW9kZWxJZCxcbiAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zLFxuICAgICAgY2xhc3NlcyxcbiAgICAgIHRhYmxlc1xuICAgIH07XG4gIH1cbiAgZ2V0IHVuc2F2ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9zYXZlVGltZW91dCAhPT0gdW5kZWZpbmVkO1xuICB9XG4gIGh5ZHJhdGUgKHJhd09iamVjdCwgVFlQRVMpIHtcbiAgICByYXdPYmplY3QubW9kZWwgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgVFlQRVNbcmF3T2JqZWN0LnR5cGVdKHJhd09iamVjdCk7XG4gIH1cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMudGFibGVJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0pKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke3RoaXMuX25leHRUYWJsZUlkfWA7XG4gICAgICB0aGlzLl9uZXh0VGFibGVJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFRBQkxFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMuY2xhc3NJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdKSkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHt0aGlzLl9uZXh0Q2xhc3NJZH1gO1xuICAgICAgdGhpcy5fbmV4dENsYXNzSWQgKz0gMTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0uY2xhc3NPYmogJiYgIW9wdGlvbnMub3ZlcndyaXRlKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdLmR1cGxpY2F0ZSgpLnRhYmxlSWQ7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IENMQVNTRVNbb3B0aW9ucy50eXBlXShvcHRpb25zKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuICBmaW5kQ2xhc3MgKGNsYXNzTmFtZSkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc05hbWUgPT09IGNsYXNzTmFtZSk7XG4gIH1cbiAgcmVuYW1lIChuZXdOYW1lKSB7XG4gICAgdGhpcy5uYW1lID0gbmV3TmFtZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFubm90YXRlIChrZXksIHZhbHVlKSB7XG4gICAgdGhpcy5hbm5vdGF0aW9uc1trZXldID0gdmFsdWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGVBbm5vdGF0aW9uIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5hbm5vdGF0aW9uc1trZXldO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLl9vcmlncmFwaC5kZWxldGVNb2RlbCh0aGlzLm1vZGVsSWQpO1xuICB9XG4gIGdldCBkZWxldGVkICgpIHtcbiAgICByZXR1cm4gdGhpcy5fb3JpZ3JhcGgubW9kZWxzW3RoaXMubW9kZWxJZF07XG4gIH1cbiAgYXN5bmMgYWRkVGV4dEZpbGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMuZm9ybWF0KSB7XG4gICAgICBvcHRpb25zLmZvcm1hdCA9IG1pbWUuZXh0ZW5zaW9uKG1pbWUubG9va3VwKG9wdGlvbnMubmFtZSkpO1xuICAgIH1cbiAgICBpZiAoRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgICByZXR1cm4gRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XS5pbXBvcnREYXRhKG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAoREFUQUxJQl9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgb3B0aW9ucy5kYXRhID0gZGF0YWxpYi5yZWFkKG9wdGlvbnMudGV4dCwgeyB0eXBlOiBvcHRpb25zLmZvcm1hdCB9KTtcbiAgICAgIGlmIChvcHRpb25zLmZvcm1hdCA9PT0gJ2NzdicgfHwgb3B0aW9ucy5mb3JtYXQgPT09ICd0c3YnKSB7XG4gICAgICAgIG9wdGlvbnMuYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2Ygb3B0aW9ucy5kYXRhLmNvbHVtbnMpIHtcbiAgICAgICAgICBvcHRpb25zLmF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBvcHRpb25zLmRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZm9ybWF0OiAke29wdGlvbnMuZm9ybWF0fWApO1xuICAgIH1cbiAgfVxuICBhc3luYyBmb3JtYXREYXRhIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgaWYgKEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIHJldHVybiBGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdLmZvcm1hdERhdGEob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChEQVRBTElCX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFJhdyAke29wdGlvbnMuZm9ybWF0fSBleHBvcnQgbm90IHlldCBzdXBwb3J0ZWRgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBleHBvcnQgdW5rbm93biBmb3JtYXQ6ICR7b3B0aW9ucy5mb3JtYXR9YCk7XG4gICAgfVxuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBvcHRpbWl6ZVRhYmxlcyAoKSB7XG4gICAgY29uc3QgdGFibGVzSW5Vc2UgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgdGFibGVzSW5Vc2VbY2xhc3NPYmoudGFibGVJZF0gPSB0cnVlO1xuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzIHx8IFtdKSB7XG4gICAgICAgIHRhYmxlc0luVXNlW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc09iai50YXJnZXRUYWJsZUlkcyB8fCBbXSkge1xuICAgICAgICB0YWJsZXNJblVzZVt0YWJsZUlkXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHBhcmVudHNWaXNpdGVkID0ge307XG4gICAgY29uc3QgcXVldWUgPSBPYmplY3Qua2V5cyh0YWJsZXNJblVzZSk7XG4gICAgd2hpbGUgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHRhYmxlSWQgPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgaWYgKCFwYXJlbnRzVmlzaXRlZFt0YWJsZUlkXSkge1xuICAgICAgICB0YWJsZXNJblVzZVt0YWJsZUlkXSA9IHRydWU7XG4gICAgICAgIHBhcmVudHNWaXNpdGVkW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgdGFibGUgPSB0aGlzLnRhYmxlc1t0YWJsZUlkXTtcbiAgICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0YWJsZS5wYXJlbnRUYWJsZXMpIHtcbiAgICAgICAgICBxdWV1ZS5wdXNoKHBhcmVudFRhYmxlLnRhYmxlSWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBPYmplY3Qua2V5cyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIGNvbnN0IHRhYmxlID0gdGhpcy50YWJsZXNbdGFibGVJZF07XG4gICAgICBpZiAoIXRhYmxlc0luVXNlW3RhYmxlSWRdICYmIHRhYmxlLnR5cGUgIT09ICdTdGF0aWMnICYmIHRhYmxlLnR5cGUgIT09ICdTdGF0aWNEaWN0Jykge1xuICAgICAgICB0YWJsZS5kZWxldGUodHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFRPRE86IElmIGFueSBEdXBsaWNhdGVkVGFibGUgaXMgaW4gdXNlLCBidXQgdGhlIG9yaWdpbmFsIGlzbid0LCBzd2FwIGZvciB0aGUgcmVhbCBvbmVcbiAgfVxuICBhc3luYyBnZXRJbnN0YW5jZUdyYXBoIChpbnN0YW5jZUlkTGlzdCkge1xuICAgIGlmICghaW5zdGFuY2VJZExpc3QpIHtcbiAgICAgIC8vIFdpdGhvdXQgc3BlY2lmaWVkIGluc3RhbmNlcywganVzdCBwaWNrIHRoZSBmaXJzdCA1IGZyb20gZWFjaCBub2RlXG4gICAgICAvLyBhbmQgZWRnZSBjbGFzc1xuICAgICAgaW5zdGFuY2VJZExpc3QgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgfHwgY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoNSkpIHtcbiAgICAgICAgICAgIGluc3RhbmNlSWRMaXN0LnB1c2goaXRlbS5pbnN0YW5jZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBHZXQgdGhlIHNwZWNpZmllZCBpdGVtc1xuICAgIGNvbnN0IG5vZGVJbnN0YW5jZXMgPSB7fTtcbiAgICBjb25zdCBlZGdlSW5zdGFuY2VzID0ge307XG4gICAgZm9yIChjb25zdCBpbnN0YW5jZUlkIG9mIGluc3RhbmNlSWRMaXN0KSB7XG4gICAgICBjb25zdCB7IGNsYXNzSWQsIGluZGV4IH0gPSBKU09OLnBhcnNlKGluc3RhbmNlSWQpO1xuICAgICAgY29uc3QgaW5zdGFuY2UgPSBhd2FpdCB0aGlzLmNsYXNzZXNbY2xhc3NJZF0udGFibGUuZ2V0SXRlbShpbmRleCk7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIG5vZGVJbnN0YW5jZXNbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIH0gZWxzZSBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIGVkZ2VJbnN0YW5jZXNbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQWRkIGFueSBub2RlcyBjb25uZWN0ZWQgdG8gb3VyIGVkZ2VzXG4gICAgY29uc3QgZXh0cmFOb2RlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgZWRnZUlkIGluIGVkZ2VJbnN0YW5jZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlSW5zdGFuY2VzW2VkZ2VJZF0ubm9kZXMoKSkge1xuICAgICAgICBpZiAoIW5vZGVJbnN0YW5jZXNbbm9kZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgIGV4dHJhTm9kZXNbbm9kZS5pbnN0YW5jZUlkXSA9IG5vZGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQWRkIGFueSBlZGdlcyB0aGF0IGNvbm5lY3Qgb3VyIG5vZGVzXG4gICAgY29uc3QgZXh0cmFFZGdlcyA9IHt9O1xuICAgIGZvciAoY29uc3Qgbm9kZUlkIGluIG5vZGVJbnN0YW5jZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiBub2RlSW5zdGFuY2VzW25vZGVJZF0uZWRnZXMoKSkge1xuICAgICAgICBpZiAoIWVkZ2VJbnN0YW5jZXNbZWRnZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgIC8vIENoZWNrIHRoYXQgYm90aCBlbmRzIG9mIHRoZSBlZGdlIGNvbm5lY3QgYXQgbGVhc3Qgb25lXG4gICAgICAgICAgLy8gb2Ygb3VyIG5vZGVzXG4gICAgICAgICAgbGV0IGNvbm5lY3RzU291cmNlID0gZmFsc2U7XG4gICAgICAgICAgbGV0IGNvbm5lY3RzVGFyZ2V0ID0gZmFsc2U7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKG5vZGVJbnN0YW5jZXNbbm9kZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgICAgICBjb25uZWN0c1NvdXJjZSA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgICAgICBpZiAobm9kZUluc3RhbmNlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzVGFyZ2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjb25uZWN0c1NvdXJjZSAmJiBjb25uZWN0c1RhcmdldCkge1xuICAgICAgICAgICAgZXh0cmFFZGdlc1tlZGdlLmluc3RhbmNlSWRdID0gZWRnZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPa2F5LCBub3cgd2UgaGF2ZSBhIGNvbXBsZXRlIHNldCBvZiBub2RlcyBhbmQgZWRnZXMgdGhhdCB3ZSB3YW50IHRvXG4gICAgLy8gaW5jbHVkZTsgY3JlYXRlIHBhaXJ3aXNlIGVkZ2UgZW50cmllcyBmb3IgZXZlcnkgY29ubmVjdGlvblxuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW11cbiAgICB9O1xuXG4gICAgLy8gQWRkIGFsbCB0aGUgbm9kZXMsIGFuZCBwb3B1bGF0ZSBhIGxvb2t1cCBmb3Igd2hlcmUgdGhleSBhcmUgaW4gdGhlIGxpc3RcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2YgT2JqZWN0LnZhbHVlcyhub2RlSW5zdGFuY2VzKS5jb25jYXQoT2JqZWN0LnZhbHVlcyhleHRyYU5vZGVzKSkpIHtcbiAgICAgIGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9IGdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICBub2RlSW5zdGFuY2U6IG5vZGUsXG4gICAgICAgIGR1bW15OiBmYWxzZVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGFsbCB0aGUgZWRnZXMuLi5cbiAgICBmb3IgKGNvbnN0IGVkZ2Ugb2YgT2JqZWN0LnZhbHVlcyhlZGdlSW5zdGFuY2VzKS5jb25jYXQoT2JqZWN0LnZhbHVlcyhleHRyYUVkZ2VzKSkpIHtcbiAgICAgIGlmICghZWRnZS5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgLy8gTWlzc2luZyBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXM7IGFkZCBkdW1teSBub2RlcyBmb3IgYm90aCBlbmRzXG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoICsgMVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQWRkIGR1bW15IHNvdXJjZSBub2Rlc1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWVkZ2UuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAvLyBBZGQgZHVtbXkgdGFyZ2V0IG5vZGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdLFxuICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGVyZSBzaG91bGQgYmUgYm90aCBzb3VyY2UgYW5kIHRhcmdldCBub2RlcyBmb3IgZWFjaCBlZGdlXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlTm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2VOb2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0Tm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Tm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVMb29rdXBbc291cmNlTm9kZS5pbnN0YW5jZUlkXSxcbiAgICAgICAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXROb2RlLmluc3RhbmNlSWRdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE5ldHdvcmtNb2RlbEdyYXBoICh7XG4gICAgcmF3ID0gdHJ1ZSxcbiAgICBpbmNsdWRlRHVtbWllcyA9IGZhbHNlLFxuICAgIGNsYXNzTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGxldCBncmFwaCA9IHtcbiAgICAgIGNsYXNzZXM6IFtdLFxuICAgICAgY2xhc3NMb29rdXA6IHt9LFxuICAgICAgY2xhc3NDb25uZWN0aW9uczogW11cbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIC8vIEFkZCBhbmQgaW5kZXggdGhlIGNsYXNzIGFzIGEgbm9kZVxuICAgICAgY29uc3QgY2xhc3NTcGVjID0gcmF3ID8gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCkgOiB7IGNsYXNzT2JqIH07XG4gICAgICBjbGFzc1NwZWMudHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC5jbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGdyYXBoLmNsYXNzZXMubGVuZ3RoO1xuICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKGNsYXNzU3BlYyk7XG5cbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgLy8gU3RvcmUgdGhlIGVkZ2UgY2xhc3Mgc28gd2UgY2FuIGNyZWF0ZSBjbGFzc0Nvbm5lY3Rpb25zIGxhdGVyXG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgJiYgaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgbm9kZVxuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtjbGFzc09iai5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCAtIDEsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZmFsc2UsXG4gICAgICAgICAgbG9jYXRpb246ICdub2RlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGV4aXN0aW5nIGNsYXNzQ29ubmVjdGlvbnNcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlQ2xhc3Nlcykge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIHNvdXJjZSBub2RlIGNsYXNzIHRvIHRoZSBlZGdlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkfT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZSdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHNvdXJjZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgZHVtbXk+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIGVkZ2UgY2xhc3MgdG8gdGhlIHRhcmdldCBub2RlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT4ke2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHRhcmdldCBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCcsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICB0YWJsZXM6IFtdLFxuICAgICAgdGFibGVMb29rdXA6IHt9LFxuICAgICAgdGFibGVMaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IHRhYmxlTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpO1xuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBjb25zdCB0YWJsZVNwZWMgPSB0YWJsZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlU3BlYy50eXBlID0gdGFibGUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gZ3JhcGgudGFibGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLnRhYmxlcy5wdXNoKHRhYmxlU3BlYyk7XG4gICAgfVxuICAgIC8vIEZpbGwgdGhlIGdyYXBoIHdpdGggbGlua3MgYmFzZWQgb24gcGFyZW50VGFibGVzLi4uXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgIGdyYXBoLnRhYmxlTGlua3MucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBncmFwaC50YWJsZUxvb2t1cFtwYXJlbnRUYWJsZS50YWJsZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TW9kZWxEdW1wICgpIHtcbiAgICAvLyBCZWNhdXNlIG9iamVjdCBrZXkgb3JkZXJzIGFyZW4ndCBkZXRlcm1pbmlzdGljLCBpdCBjYW4gYmUgcHJvYmxlbWF0aWNcbiAgICAvLyBmb3IgdGVzdGluZyAoYmVjYXVzZSBpZHMgY2FuIHJhbmRvbWx5IGNoYW5nZSBmcm9tIHRlc3QgcnVuIHRvIHRlc3QgcnVuKS5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHNvcnRzIGVhY2gga2V5LCBhbmQganVzdCByZXBsYWNlcyBJRHMgd2l0aCBpbmRleCBudW1iZXJzXG4gICAgY29uc3QgcmF3T2JqID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0aGlzLl90b1Jhd09iamVjdCgpKSk7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NlczogT2JqZWN0LnZhbHVlcyhyYXdPYmouY2xhc3Nlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMuY2xhc3Nlc1thLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy5jbGFzc2VzW2IuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3MgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICB0YWJsZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLnRhYmxlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMudGFibGVzW2EudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLnRhYmxlc1tiLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhYmxlIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfTtcbiAgICBjb25zdCBjbGFzc0xvb2t1cCA9IHt9O1xuICAgIGNvbnN0IHRhYmxlTG9va3VwID0ge307XG4gICAgcmVzdWx0LmNsYXNzZXMuZm9yRWFjaCgoY2xhc3NPYmosIGluZGV4KSA9PiB7XG4gICAgICBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGluZGV4O1xuICAgIH0pO1xuICAgIHJlc3VsdC50YWJsZXMuZm9yRWFjaCgodGFibGUsIGluZGV4KSA9PiB7XG4gICAgICB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGluZGV4O1xuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiByZXN1bHQudGFibGVzKSB7XG4gICAgICB0YWJsZS50YWJsZUlkID0gdGFibGVMb29rdXBbdGFibGUudGFibGVJZF07XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcykpIHtcbiAgICAgICAgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUxvb2t1cFt0YWJsZUlkXV0gPSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgICBkZWxldGUgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0YWJsZS5kYXRhOyAvLyBkb24ndCBpbmNsdWRlIGFueSBvZiB0aGUgZGF0YTsgd2UganVzdCB3YW50IHRoZSBtb2RlbCBzdHJ1Y3R1cmVcbiAgICB9XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiByZXN1bHQuY2xhc3Nlcykge1xuICAgICAgY2xhc3NPYmouY2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdO1xuICAgICAgY2xhc3NPYmoudGFibGVJZCA9IHRhYmxlTG9va3VwW2NsYXNzT2JqLnRhYmxlSWRdO1xuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzID0gY2xhc3NPYmouc291cmNlVGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnRhcmdldENsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzID0gY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBjbGFzc0lkIG9mIE9iamVjdC5rZXlzKGNsYXNzT2JqLmVkZ2VDbGFzc0lkcyB8fCB7fSkpIHtcbiAgICAgICAgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzTG9va3VwW2NsYXNzSWRdXSA9IGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgICAgZGVsZXRlIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBjcmVhdGVTY2hlbWFNb2RlbCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB0aGlzLmdldE1vZGVsRHVtcCgpO1xuXG4gICAgZ3JhcGgudGFibGVzLmZvckVhY2godGFibGUgPT4ge1xuICAgICAgdGFibGUuZGVyaXZlZFRhYmxlcyA9IE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbmV3TW9kZWwgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVNb2RlbCh7IG5hbWU6IHRoaXMubmFtZSArICdfc2NoZW1hJyB9KTtcbiAgICBjb25zdCByYXcgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaCxcbiAgICAgIG5hbWU6ICdSYXcgRHVtcCdcbiAgICB9KTtcbiAgICBsZXQgWyBjbGFzc2VzLCB0YWJsZXMgXSA9IHJhdy5jbG9zZWRUcmFuc3Bvc2UoWydjbGFzc2VzJywgJ3RhYmxlcyddKTtcbiAgICBjbGFzc2VzID0gY2xhc3Nlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgY2xhc3Nlcy5zZXRDbGFzc05hbWUoJ0NsYXNzZXMnKTtcbiAgICByYXcuZGVsZXRlKCk7XG5cbiAgICBjb25zdCBzb3VyY2VDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdzb3VyY2VDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgc291cmNlQ2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1NvdXJjZSBDbGFzcycpO1xuICAgIHNvdXJjZUNsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAndGFyZ2V0Q2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhcmdldENsYXNzZXMuc2V0Q2xhc3NOYW1lKCdUYXJnZXQgQ2xhc3MnKTtcbiAgICB0YXJnZXRDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgdGFibGVzID0gdGFibGVzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICB0YWJsZXMuc2V0Q2xhc3NOYW1lKCdUYWJsZXMnKTtcblxuICAgIGNvbnN0IHRhYmxlRGVwZW5kZW5jaWVzID0gdGFibGVzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAnZGVyaXZlZFRhYmxlcycsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnNldENsYXNzTmFtZSgnSXMgUGFyZW50IE9mJyk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICBjb25zdCBjb3JlVGFibGVzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhYmxlSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBjb3JlVGFibGVzLnNldENsYXNzTmFtZSgnQ29yZSBUYWJsZScpO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTmV0d29ya01vZGVsO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgTmV0d29ya01vZGVsIGZyb20gJy4vQ29tbW9uL05ldHdvcmtNb2RlbC5qcyc7XG5cbmxldCBORVhUX01PREVMX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBvbmx5IGRlZmluZWQgaW4gdGhlIGJyb3dzZXIgY29udGV4dFxuXG4gICAgdGhpcy5wbHVnaW5zID0ge307XG5cbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIGxldCBleGlzdGluZ01vZGVscyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ29yaWdyYXBoX21vZGVscycpO1xuICAgIGlmIChleGlzdGluZ01vZGVscykge1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKEpTT04ucGFyc2UoZXhpc3RpbmdNb2RlbHMpKSkge1xuICAgICAgICBtb2RlbC5vcmlncmFwaCA9IHRoaXM7XG4gICAgICAgIHRoaXMubW9kZWxzW21vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChtb2RlbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICB9XG4gIHJlZ2lzdGVyUGx1Z2luIChuYW1lLCBwbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbnNbbmFtZV0gPSBwbHVnaW47XG4gIH1cbiAgc2F2ZSAoKSB7XG4gICAgLypcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IG1vZGVscyA9IHt9O1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubW9kZWxzKSkge1xuICAgICAgICBtb2RlbHNbbW9kZWxJZF0gPSBtb2RlbC5fdG9SYXdPYmplY3QoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ29yaWdyYXBoX21vZGVscycsIEpTT04uc3RyaW5naWZ5KG1vZGVscykpO1xuICAgICAgdGhpcy50cmlnZ2VyKCdzYXZlJyk7XG4gICAgfVxuICAgICovXG4gIH1cbiAgY2xvc2VDdXJyZW50TW9kZWwgKCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGdldCBjdXJyZW50TW9kZWwgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1t0aGlzLl9jdXJyZW50TW9kZWxJZF0gfHwgbnVsbDtcbiAgfVxuICBzZXQgY3VycmVudE1vZGVsIChtb2RlbCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbW9kZWwgPyBtb2RlbC5tb2RlbElkIDogbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGFzeW5jIGxvYWRNb2RlbCAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld01vZGVsID0gdGhpcy5jcmVhdGVNb2RlbCh7IG1vZGVsSWQ6IG9wdGlvbnMubmFtZSB9KTtcbiAgICBhd2FpdCBuZXdNb2RlbC5hZGRUZXh0RmlsZShvcHRpb25zKTtcbiAgICByZXR1cm4gbmV3TW9kZWw7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBvcmlncmFwaCA9IG5ldyBPcmlncmFwaCh3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm9yaWdyYXBoLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgb3JpZ3JhcGg7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsIl9ldmVudEhhbmRsZXJzIiwiX3N0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImV2ZW50IiwibmFtZXNwYWNlIiwic3BsaXQiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJpbmRleE9mIiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJoYW5kbGVDYWxsYmFjayIsInNldFRpbWVvdXQiLCJhcHBseSIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJHZW5lcmljV3JhcHBlciIsIm9wdGlvbnMiLCJ0YWJsZSIsInVuZGVmaW5lZCIsIkVycm9yIiwiY2xhc3NPYmoiLCJyb3ciLCJjb25uZWN0ZWRJdGVtcyIsImR1cGxpY2F0ZUl0ZW1zIiwicmVnaXN0ZXJEdXBsaWNhdGUiLCJpdGVtIiwiY29ubmVjdEl0ZW0iLCJ0YWJsZUlkIiwiZHVwIiwiZGlzY29ubmVjdCIsIml0ZW1MaXN0IiwidmFsdWVzIiwiaW5zdGFuY2VJZCIsImNsYXNzSWQiLCJleHBvcnRJZCIsImVxdWFscyIsImhhbmRsZUxpbWl0IiwiaXRlcmF0b3JzIiwibGltaXQiLCJJbmZpbml0eSIsIml0ZXJhdG9yIiwiaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwidGFibGVJZHMiLCJQcm9taXNlIiwiYWxsIiwibWFwIiwibW9kZWwiLCJ0YWJsZXMiLCJidWlsZENhY2hlIiwiX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInJlc2V0IiwibmV4dFRhYmxlSWQiLCJsZW5ndGgiLCJyZW1haW5pbmdUYWJsZUlkcyIsInNsaWNlIiwiZXhlYyIsIm5hbWUiLCJUYWJsZSIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3N1cHByZXNzZWRBdHRyaWJ1dGVzIiwic3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJfc3VwcHJlc3NJbmRleCIsInN1cHByZXNzSW5kZXgiLCJfaW5kZXhGaWx0ZXIiLCJpbmRleEZpbHRlciIsIl9hdHRyaWJ1dGVGaWx0ZXJzIiwiYXR0cmlidXRlRmlsdGVycyIsIl9saW1pdFByb21pc2VzIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsImZ1bmMiLCJnZXRTb3J0SGFzaCIsIkZ1bmN0aW9uIiwidG9TdHJpbmciLCJpdGVyYXRlIiwiX2NhY2hlIiwiX3BhcnRpYWxDYWNoZSIsInJlc29sdmUiLCJyZWplY3QiLCJfaXRlcmF0ZSIsIl9idWlsZENhY2hlIiwiX3BhcnRpYWxDYWNoZUxvb2t1cCIsImRvbmUiLCJuZXh0IiwiaGFuZGxlUmVzZXQiLCJfZmluaXNoSXRlbSIsIk51bWJlciIsIl9jYWNoZUxvb2t1cCIsIl9jYWNoZVByb21pc2UiLCJpdGVtc1RvUmVzZXQiLCJjb25jYXQiLCJkZXJpdmVkVGFibGUiLCJjb3VudFJvd3MiLCJ3cmFwcGVkSXRlbSIsImRlbGF5ZWRSb3ciLCJrZWVwIiwiX3dyYXAiLCJvdGhlckl0ZW0iLCJpdGVtc1RvQ29ubmVjdCIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImxvb2t1cCIsImNvbXBsZXRlIiwiZ2V0SXRlbSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsInN1cHByZXNzQXR0cmlidXRlIiwiYWRkRmlsdGVyIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZSIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwicHJvbW90ZSIsImV4cGFuZCIsInVucm9sbCIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY2xvc2VkVHJhbnNwb3NlIiwiaW5kZXhlcyIsIm9wZW5UcmFuc3Bvc2UiLCJkdXBsaWNhdGUiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJvdGhlclRhYmxlIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJmb3JjZSIsImVyciIsInBhcmVudFRhYmxlIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQXR0clRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkF0dHJUYWJsZU1peGluIiwiX2F0dHJpYnV0ZSIsIlByb21vdGVkVGFibGUiLCJfdW5maW5pc2hlZENhY2hlIiwiX3VuZmluaXNoZWRDYWNoZUxvb2t1cCIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicFRhYmxlIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJEdXBsaWNhdGVkVGFibGUiLCJDaGlsZFRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpbiIsInBhcmVudEluZGV4IiwiRXhwYW5kZWRUYWJsZSIsIlVucm9sbGVkVGFibGUiLCJyb3dzIiwiUGFyZW50Q2hpbGRUYWJsZSIsImNoaWxkVGFibGUiLCJjaGlsZCIsInBhcmVudCIsIkdlbmVyaWNDbGFzcyIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJhbm5vdGF0aW9ucyIsInNldENsYXNzTmFtZSIsImhhc0N1c3RvbU5hbWUiLCJ2YXJpYWJsZU5hbWUiLCJmaWx0ZXIiLCJkIiwidG9Mb2NhbGVVcHBlckNhc2UiLCJkZWxldGVkIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm92ZXJ3cml0ZSIsImNyZWF0ZUNsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIl9kZXJpdmVOZXdDbGFzcyIsIm9wdGltaXplVGFibGVzIiwiTm9kZVdyYXBwZXIiLCJlZGdlcyIsImVkZ2VJZHMiLCJjbGFzc0lkcyIsImVkZ2VDbGFzc0lkcyIsImVkZ2VJZCIsImVkZ2VDbGFzcyIsInJvbGUiLCJnZXRFZGdlUm9sZSIsInJldmVyc2UiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NlcyIsImVkZ2VDbGFzc0lkIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJhdXRvY29ubmVjdCIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImlzU291cmNlIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJub2RlQ2xhc3MiLCJ0YWJsZUlkTGlzdCIsImRpcmVjdGVkIiwic291cmNlRWRnZUNsYXNzIiwidGFyZ2V0RWRnZUNsYXNzIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJuZXdOb2RlQ2xhc3MiLCJjb25uZWN0VG9DaGlsZE5vZGVDbGFzcyIsImNoaWxkQ2xhc3MiLCJwcm9qZWN0TmV3RWRnZSIsImNsYXNzSWRMaXN0IiwiY2xhc3NMaXN0IiwiQXJyYXkiLCJmcm9tIiwiY29ubmVjdGVkQ2xhc3NlcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlTm9kZXMiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXRUYWJsZUlkIiwibm9kZXMiLCJFZGdlQ2xhc3MiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwiX3NwbGl0VGFibGVJZExpc3QiLCJvdGhlckNsYXNzIiwibm9kZVRhYmxlSWRMaXN0IiwiZWRnZVRhYmxlSWQiLCJlZGdlVGFibGVJZExpc3QiLCJzdGF0aWNFeGlzdHMiLCJ0YWJsZURpc3RhbmNlcyIsInN0YXJ0c1dpdGgiLCJkaXN0IiwiTWF0aCIsImFicyIsInNvcnQiLCJhIiwiYiIsInNpZGUiLCJjb25uZWN0U291cmNlIiwiY29ubmVjdFRhcmdldCIsInRvZ2dsZURpcmVjdGlvbiIsInN3YXBwZWREaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImVkZ2VIYXNoIiwibm9kZUhhc2giLCJ1bnNoaWZ0IiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJjb25uZWN0RmFjZXRlZENsYXNzIiwibmV3Q2xhc3NlcyIsIm5ld0NsYXNzIiwiRmlsZUZvcm1hdCIsImJ1aWxkUm93IiwiUGFyc2VGYWlsdXJlIiwiZmlsZUZvcm1hdCIsIk5PREVfTkFNRVMiLCJFREdFX05BTUVTIiwiRDNKc29uIiwiaW1wb3J0RGF0YSIsInRleHQiLCJzb3VyY2VBdHRyaWJ1dGUiLCJ0YXJnZXRBdHRyaWJ1dGUiLCJjbGFzc0F0dHJpYnV0ZSIsIkpTT04iLCJwYXJzZSIsIm5vZGVOYW1lIiwiZWRnZU5hbWUiLCJjb3JlVGFibGUiLCJjb3JlQ2xhc3MiLCJub2RlQ2xhc3NlcyIsIm5vZGVDbGFzc0xvb2t1cCIsInNhbXBsZSIsInNvdXJjZUNsYXNzTmFtZSIsInRhcmdldENsYXNzTmFtZSIsImZvcm1hdERhdGEiLCJpbmNsdWRlQ2xhc3NlcyIsInByZXR0eSIsImxpbmtzIiwibm9kZUxvb2t1cCIsIm90aGVyIiwibm9kZSIsImVkZ2UiLCJzb3VyY2UiLCJ0YXJnZXQiLCJzdHJpbmdpZnkiLCJCdWZmZXIiLCJleHRlbnNpb24iLCJEQVRBTElCX0ZPUk1BVFMiLCJOZXR3b3JrTW9kZWwiLCJvcmlncmFwaCIsIm1vZGVsSWQiLCJfb3JpZ3JhcGgiLCJfbmV4dENsYXNzSWQiLCJfbmV4dFRhYmxlSWQiLCJoeWRyYXRlIiwiQ0xBU1NFUyIsIlRBQkxFUyIsIl9zYXZlVGltZW91dCIsInNhdmUiLCJ1bnNhdmVkIiwicmF3T2JqZWN0IiwiVFlQRVMiLCJzZWxlY3RvciIsImZpbmRDbGFzcyIsInJlbmFtZSIsIm5ld05hbWUiLCJhbm5vdGF0ZSIsImtleSIsImRlbGV0ZUFubm90YXRpb24iLCJkZWxldGVNb2RlbCIsIm1vZGVscyIsImFkZFRleHRGaWxlIiwiZm9ybWF0IiwibWltZSIsIkZJTEVfRk9STUFUUyIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwidGFibGVzSW5Vc2UiLCJwYXJlbnRzVmlzaXRlZCIsInF1ZXVlIiwic2hpZnQiLCJnZXRJbnN0YW5jZUdyYXBoIiwiaW5zdGFuY2VJZExpc3QiLCJub2RlSW5zdGFuY2VzIiwiZWRnZUluc3RhbmNlcyIsImluc3RhbmNlIiwiZXh0cmFOb2RlcyIsImV4dHJhRWRnZXMiLCJub2RlSWQiLCJjb25uZWN0c1NvdXJjZSIsImNvbm5lY3RzVGFyZ2V0IiwiZ3JhcGgiLCJub2RlSW5zdGFuY2UiLCJkdW1teSIsImVkZ2VJbnN0YW5jZSIsInNvdXJjZU5vZGUiLCJ0YXJnZXROb2RlIiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJyYXciLCJpbmNsdWRlRHVtbWllcyIsImNsYXNzTG9va3VwIiwiY2xhc3NDb25uZWN0aW9ucyIsImNsYXNzU3BlYyIsImlkIiwibG9jYXRpb24iLCJnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCIsInRhYmxlTG9va3VwIiwidGFibGVMaW5rcyIsInRhYmxlTGlzdCIsInRhYmxlU3BlYyIsImdldE1vZGVsRHVtcCIsInJhd09iaiIsImFIYXNoIiwiYkhhc2giLCJjcmVhdGVTY2hlbWFNb2RlbCIsIm5ld01vZGVsIiwiY3JlYXRlTW9kZWwiLCJzb3VyY2VDbGFzc2VzIiwidGFyZ2V0Q2xhc3NlcyIsInRhYmxlRGVwZW5kZW5jaWVzIiwiY29yZVRhYmxlcyIsIk5FWFRfTU9ERUxfSUQiLCJPcmlncmFwaCIsImxvY2FsU3RvcmFnZSIsInBsdWdpbnMiLCJleGlzdGluZ01vZGVscyIsIl9jdXJyZW50TW9kZWxJZCIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luIiwiY2xvc2VDdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWwiLCJsb2FkTW9kZWwiLCJjdXJyZW50TW9kZWxJZCIsImRlbGV0ZUFsbE1vZGVscyIsIndpbmRvdyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxjQUFMLEdBQXNCLEVBQXRCO1dBQ0tDLGVBQUwsR0FBdUIsRUFBdkI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNuQixDQUFDQyxLQUFELEVBQVFDLFNBQVIsSUFBcUJILFNBQVMsQ0FBQ0ksS0FBVixDQUFnQixHQUFoQixDQUF6QjtXQUNLUCxjQUFMLENBQW9CSyxLQUFwQixJQUE2QixLQUFLTCxjQUFMLENBQW9CSyxLQUFwQixLQUMzQjtZQUFNO09BRFI7O1VBRUksQ0FBQ0MsU0FBTCxFQUFnQjthQUNUTixjQUFMLENBQW9CSyxLQUFwQixFQUEyQixFQUEzQixFQUErQkcsSUFBL0IsQ0FBb0NKLFFBQXBDO09BREYsTUFFTzthQUNBSixjQUFMLENBQW9CSyxLQUFwQixFQUEyQkMsU0FBM0IsSUFBd0NGLFFBQXhDOzs7O0lBR0pLLEdBQUcsQ0FBRU4sU0FBRixFQUFhQyxRQUFiLEVBQXVCO1VBQ3BCLENBQUNDLEtBQUQsRUFBUUMsU0FBUixJQUFx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
