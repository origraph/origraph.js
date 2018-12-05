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

            if (i >= limit) {
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
    if (tableIds.length === 1) {
      yield* this.connectedItems[tableIds[0]] || [];
    } else {
      const thisTableId = tableIds[0];
      const remainingTableIds = tableIds.slice(1);

      for (const item of this.connectedItems[thisTableId] || []) {
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
    this.iterationReset = new Error('Iteration reset');
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
      try {
        temp = await iterator.next();
      } catch (err) {
        // Something went wrong upstream (something that this._iterate
        // depends on was reset or threw a real error)
        if (err === this.iterationReset) {
          this.handleReset(reject);
        } else {
          throw err;
        }
      }

      if (!this._partialCache) {
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
      this._limitPromises[limit].reject(this.iterationReset);

      delete this._limitPromises;
    }

    reject(this.iterationReset);
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

    for (const [attr, func] of Object.entries(this._attributeFilters)) {
      keep = keep && (await func((await wrappedItem.row[attr])));

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

  async getItem(index) {
    if (this._cacheLookup) {
      return this._cache[this._cacheLookup[index]];
    } else if (this._partialCacheLookup && this._partialCacheLookup[index] !== undefined) {
      return this._partialCache[this._partialCacheLookup[index]];
    } // Stupid approach when the cache isn't built: interate until we see the
    // index. Subclasses should override this


    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;

    var _iteratorError;

    try {
      for (var _iterator = _asyncIterator(this.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
        const item = _value;

        if (item.index === index) {
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

  addFilter(attribute, func) {
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

  delete() {
    if (this.inUse) {
      const err = new Error(`Can't delete in-use table ${this.tableId}`);
      err.inUse = true;
      throw err;
    }

    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTables[this.tableId];
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
      try {
        temp = await iterator.next();
      } catch (err) {
        // Something went wrong upstream (something that this._iterate
        // depends on was reset or threw a real error)
        if (err === this.iterationReset) {
          this.handleReset(reject);
        } else {
          throw err;
        }
      }

      if (!this._partialCache) {
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
            throw _this.iterationReset;
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
    return `[${this._value}]`;
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
          // One of the parent tables was reset, meaning we need to reset as well
          throw _this.iterationReset;
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
    this.model.trigger('update');
  }

  getSampleGraph(options) {
    options.rootClass = this;
    return this.model.getSampleGraph(options);
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

  pairwiseNeighborhood(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this2.edges(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const edge = _value;
          yield* _asyncGeneratorDelegate(_asyncIterator(edge.pairwiseEdges(options)), _awaitAsyncGenerator);
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
    let tableId;
    const middleIndex = Math.floor((classList.length - 1) / 2);

    for (let i = 0; i < classList.length - 1; i++) {
      if (i < middleIndex) {
        if (classList[i].type === 'Node') {
          sourceTableIds.unshift(classList[i].tableId);
        } else {
          const temp = Array.from(classList[i].sourceTableIds).reverse();

          for (const tableId of temp) {
            sourceTableIds.unshift(tableId);
          }

          sourceTableIds.unshift(classList[i].tableId);

          for (const tableId of classList[i].targetTableIds) {
            sourceTableIds.unshift(tableId);
          }
        }
      } else if (i === middleIndex) {
        tableId = classList[i].table.duplicate().tableId;

        if (classList[i].type === 'Edge') {
          const temp = Array.from(classList[i].sourceTableIds).reverse();

          for (const tableId of temp) {
            sourceTableIds.unshift(tableId);
          }

          for (const tableId of classList[i].targetTableIds) {
            targetTableIds.unshift(tableId);
          }
        }
      } else {
        if (classList[i].type === 'Node') {
          targetTableIds.unshift(classList[i].tableId);
        } else {
          const temp = Array.from(classList[i].sourceTableIds).reverse();

          for (const tableId of temp) {
            targetTableIds.unshift(tableId);
          }

          targetTableIds.unshift(classList[i].tableId);

          for (const tableId of classList[i].targetTableIds) {
            targetTableIds.unshift(tableId);
          }
        }
      }
    }

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

  pairwiseEdges(options = {}) {
    var _this4 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this4.sourceNodes(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const source = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator(_this4.targetNodes(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const target = _value2;
              yield {
                source,
                edge: _this4,
                target
              };
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

const DATALIB_FORMATS = {
  'json': 'json',
  'csv': 'csv',
  'tsv': 'tsv',
  'topojson': 'topojson',
  'treejson': 'treejson'
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

  async addFileAsStaticTable({
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
        throw new Error(`${fileMB}MB file is too large to load statically`);
      }
    } // extensionOverride allows things like topojson or treejson (that don't
    // have standardized mimeTypes) to be parsed correctly


    let text = await new Promise((resolve, reject) => {
      let reader = new this._origraph.FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.readAsText(fileObj, encoding);
    });
    return this.addStringAsStaticTable({
      name: fileObj.name,
      extension: extensionOverride || mime.extension(fileObj.type),
      text
    });
  }

  addStringAsStaticTable({
    name,
    extension,
    text
  }) {
    let data, attributes;

    if (!extension) {
      extension = mime.extension(mime.lookup(name));
    }

    if (DATALIB_FORMATS[extension]) {
      data = datalib.read(text, {
        type: extension
      });

      if (extension === 'csv' || extension === 'tsv') {
        attributes = {};

        for (const attr of data.columns) {
          attributes[attr] = true;
        }

        delete data.columns;
      }
    } else if (extension === 'xml') {
      throw new Error('unimplemented');
    } else if (extension === 'txt') {
      throw new Error('unimplemented');
    } else {
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    return this.addStaticTable({
      name,
      data,
      attributes
    });
  }

  addStaticTable(options) {
    options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDictTable';
    let newTable = this.createTable(options);
    return this.createClass({
      type: 'GenericClass',
      name: options.name,
      tableId: newTable.tableId
    });
  }

  deleteAllUnusedTables() {
    for (const tableId in this.tables) {
      if (this.tables[tableId]) {
        try {
          this.tables[tableId].delete();
        } catch (err) {
          if (!err.inUse) {
            throw err;
          }
        }
      }
    }

    this.trigger('update');
  }

  async getSampleGraph({
    rootClass = null,
    branchLimit = Infinity,
    nodeLimit = Infinity,
    edgeLimit = Infinity,
    tripleLimit = Infinity
  } = {}) {
    const sampleGraph = {
      nodes: [],
      nodeLookup: {},
      edges: [],
      edgeLookup: {},
      links: []
    };
    let numTriples = 0;

    const addNode = node => {
      if (sampleGraph.nodeLookup[node.instanceId] === undefined) {
        sampleGraph.nodeLookup[node.instanceId] = sampleGraph.nodes.length;
        sampleGraph.nodes.push(node);
      }

      return sampleGraph.nodes.length <= nodeLimit;
    };

    const addEdge = edge => {
      if (sampleGraph.edgeLookup[edge.instanceId] === undefined) {
        sampleGraph.edgeLookup[edge.instanceId] = sampleGraph.edges.length;
        sampleGraph.edges.push(edge);
      }

      return sampleGraph.edges.length <= edgeLimit;
    };

    const addTriple = (source, edge, target) => {
      if (addNode(source) && addNode(target) && addEdge(edge)) {
        sampleGraph.links.push({
          source: sampleGraph.nodeLookup[source.instanceId],
          target: sampleGraph.nodeLookup[target.instanceId],
          edge: sampleGraph.edgeLookup[edge.instanceId]
        });
        numTriples++;
        return numTriples <= tripleLimit;
      } else {
        return false;
      }
    };

    let classList = rootClass ? [rootClass] : Object.values(this.classes);

    for (const classObj of classList) {
      if (classObj.type === 'Node') {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(classObj.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const node = _value;

            if (!addNode(node)) {
              return sampleGraph;
            }

            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;

            var _iteratorError2;

            try {
              for (var _iterator2 = _asyncIterator(node.pairwiseNeighborhood({
                limit: branchLimit
              })), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                const {
                  source,
                  edge,
                  target
                } = _value2;

                if (!addTriple(source, edge, target)) {
                  return sampleGraph;
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
      } else if (classObj.type === 'Edge') {
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;

        var _iteratorError3;

        try {
          for (var _iterator3 = _asyncIterator(classObj.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
            const edge = _value3;

            if (!addEdge(edge)) {
              return sampleGraph;
            }

            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;

            var _iteratorError4;

            try {
              for (var _iterator4 = _asyncIterator(edge.pairwiseEdges({
                limit: branchLimit
              })), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                const {
                  source,
                  target
                } = _value4;

                if (!addTriple(source, edge, target)) {
                  return sampleGraph;
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

    return sampleGraph;
  }

  async getInstanceGraph(instanceIdList) {
    if (!instanceIdList) {
      // Without specified instances, just pick the first 5 from each node
      // and edge class
      instanceIdList = [];

      for (const classObj of Object.values(this.classes)) {
        if (classObj.type === 'Node' || classObj.type === 'Edge') {
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;

          var _iteratorError5;

          try {
            for (var _iterator5 = _asyncIterator(classObj.table.iterate(5)), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
              const item = _value5;
              instanceIdList.push(item.instanceId);
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
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;

      var _iteratorError6;

      try {
        for (var _iterator6 = _asyncIterator(edgeInstances[edgeId].nodes()), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
          const node = _value6;

          if (!nodeInstances[node.instanceId]) {
            extraNodes[node.instanceId] = node;
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
    } // Add any edges that connect our nodes


    const extraEdges = {};

    for (const nodeId in nodeInstances) {
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;

      var _iteratorError7;

      try {
        for (var _iterator7 = _asyncIterator(nodeInstances[nodeId].edges()), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
          const edge = _value7;

          if (!edgeInstances[edge.instanceId]) {
            // Check that both ends of the edge connect at least one
            // of our nodes
            let connectsSource = false;
            let connectsTarget = false;
            var _iteratorNormalCompletion8 = true;
            var _didIteratorError8 = false;

            var _iteratorError8;

            try {
              for (var _iterator8 = _asyncIterator(edge.sourceNodes()), _step8, _value8; _step8 = await _iterator8.next(), _iteratorNormalCompletion8 = _step8.done, _value8 = await _step8.value, !_iteratorNormalCompletion8; _iteratorNormalCompletion8 = true) {
                const node = _value8;

                if (nodeInstances[node.instanceId]) {
                  connectsSource = true;
                  break;
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

            var _iteratorNormalCompletion9 = true;
            var _didIteratorError9 = false;

            var _iteratorError9;

            try {
              for (var _iterator9 = _asyncIterator(edge.targetNodes()), _step9, _value9; _step9 = await _iterator9.next(), _iteratorNormalCompletion9 = _step9.done, _value9 = await _step9.value, !_iteratorNormalCompletion9; _iteratorNormalCompletion9 = true) {
                const node = _value9;

                if (nodeInstances[node.instanceId]) {
                  connectsTarget = true;
                  break;
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

            if (connectsSource && connectsTarget) {
              extraEdges[edge.instanceId] = edge;
            }
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
          var _iteratorNormalCompletion10 = true;
          var _didIteratorError10 = false;

          var _iteratorError10;

          try {
            for (var _iterator10 = _asyncIterator(edge.targetNodes()), _step10, _value10; _step10 = await _iterator10.next(), _iteratorNormalCompletion10 = _step10.done, _value10 = await _step10.value, !_iteratorNormalCompletion10; _iteratorNormalCompletion10 = true) {
              const node = _value10;

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
            _didIteratorError10 = true;
            _iteratorError10 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion10 && _iterator10.return != null) {
                await _iterator10.return();
              }
            } finally {
              if (_didIteratorError10) {
                throw _iteratorError10;
              }
            }
          }
        }
      } else if (!edge.classObj.targetClassId) {
        // Add dummy target nodes
        var _iteratorNormalCompletion11 = true;
        var _didIteratorError11 = false;

        var _iteratorError11;

        try {
          for (var _iterator11 = _asyncIterator(edge.sourceNodes()), _step11, _value11; _step11 = await _iterator11.next(), _iteratorNormalCompletion11 = _step11.done, _value11 = await _step11.value, !_iteratorNormalCompletion11; _iteratorNormalCompletion11 = true) {
            const node = _value11;

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
          _didIteratorError11 = true;
          _iteratorError11 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion11 && _iterator11.return != null) {
              await _iterator11.return();
            }
          } finally {
            if (_didIteratorError11) {
              throw _iteratorError11;
            }
          }
        }
      } else {
        // There should be both source and target nodes for each edge
        var _iteratorNormalCompletion12 = true;
        var _didIteratorError12 = false;

        var _iteratorError12;

        try {
          for (var _iterator12 = _asyncIterator(edge.sourceNodes()), _step12, _value12; _step12 = await _iterator12.next(), _iteratorNormalCompletion12 = _step12.done, _value12 = await _step12.value, !_iteratorNormalCompletion12; _iteratorNormalCompletion12 = true) {
            const sourceNode = _value12;

            if (graph.nodeLookup[sourceNode.instanceId] !== undefined) {
              var _iteratorNormalCompletion13 = true;
              var _didIteratorError13 = false;

              var _iteratorError13;

              try {
                for (var _iterator13 = _asyncIterator(edge.targetNodes()), _step13, _value13; _step13 = await _iterator13.next(), _iteratorNormalCompletion13 = _step13.done, _value13 = await _step13.value, !_iteratorNormalCompletion13; _iteratorNormalCompletion13 = true) {
                  const targetNode = _value13;

                  if (graph.nodeLookup[targetNode.instanceId] !== undefined) {
                    graph.edges.push({
                      edgeInstance: edge,
                      source: graph.nodeLookup[sourceNode.instanceId],
                      target: graph.nodeLookup[targetNode.instanceId]
                    });
                  }
                }
              } catch (err) {
                _didIteratorError13 = true;
                _iteratorError13 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion13 && _iterator13.return != null) {
                    await _iterator13.return();
                  }
                } finally {
                  if (_didIteratorError13) {
                    throw _iteratorError13;
                  }
                }
              }
            }
          }
        } catch (err) {
          _didIteratorError12 = true;
          _iteratorError12 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion12 && _iterator12.return != null) {
              await _iterator12.return();
            }
          } finally {
            if (_didIteratorError12) {
              throw _iteratorError12;
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
  constructor(FileReader, PouchDB) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

    this.PouchDB = PouchDB; // either pouchdb-browser or pouchdb-node

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
    /*if (this.localStorage) {
      const models = {};
      for (const [modelId, model] of Object.entries(this.models)) {
        models[modelId] = model._toRawObject();
      }
      this.localStorage.setItem('origraph_models', JSON.stringify(models));
      this.trigger('save');
    }*/
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
var version = "0.2.2";
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
	"rollup-plugin-string": "^2.0.2"
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

let origraph = new Origraph(window.FileReader, window.localStorage);
origraph.version = pkg.version;

export default origraph;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gfHxcbiAgICAgICAgeyAnJzogW10gfTtcbiAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0gPSBjYWxsYmFjaztcbiAgICAgIH1cbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10gPSBbXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICBjb25zdCBoYW5kbGVDYWxsYmFjayA9IGNhbGxiYWNrID0+IHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9O1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGZvciAoY29uc3QgbmFtZXNwYWNlIG9mIE9iamVjdC5rZXlzKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSkge1xuICAgICAgICAgIGlmIChuYW1lc3BhY2UgPT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uZm9yRWFjaChoYW5kbGVDYWxsYmFjayk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbmRsZUNhbGxiYWNrKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIHRoaXMudGFibGUgPSBvcHRpb25zLnRhYmxlO1xuICAgIGlmICh0aGlzLmluZGV4ID09PSB1bmRlZmluZWQgfHwgIXRoaXMudGFibGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggYW5kIHRhYmxlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLmNsYXNzT2JqID0gb3B0aW9ucy5jbGFzc09iaiB8fCBudWxsO1xuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IG9wdGlvbnMuY29ubmVjdGVkSXRlbXMgfHwge307XG4gICAgdGhpcy5kdXBsaWNhdGVJdGVtcyA9IG9wdGlvbnMuZHVwbGljYXRlSXRlbXMgfHwgW107XG4gIH1cbiAgcmVnaXN0ZXJEdXBsaWNhdGUgKGl0ZW0pIHtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zLnB1c2goaXRlbSk7XG4gIH1cbiAgY29ubmVjdEl0ZW0gKGl0ZW0pIHtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gPSB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gfHwgW107XG4gICAgaWYgKHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5pbmRleE9mKGl0ZW0pID09PSAtMSkge1xuICAgICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLnB1c2goaXRlbSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZHVwIG9mIHRoaXMuZHVwbGljYXRlSXRlbXMpIHtcbiAgICAgIGl0ZW0uY29ubmVjdEl0ZW0oZHVwKTtcbiAgICAgIGR1cC5jb25uZWN0SXRlbShpdGVtKTtcbiAgICB9XG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgZm9yIChjb25zdCBpdGVtTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuY29ubmVjdGVkSXRlbXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbUxpc3QpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSAoaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdIHx8IFtdKS5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IHt9O1xuICB9XG4gIGdldCBpbnN0YW5jZUlkICgpIHtcbiAgICByZXR1cm4gYHtcImNsYXNzSWRcIjpcIiR7dGhpcy5jbGFzc09iai5jbGFzc0lkfVwiLFwiaW5kZXhcIjpcIiR7dGhpcy5pbmRleH1cIn1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGhhbmRsZUxpbWl0IChvcHRpb25zLCBpdGVyYXRvcnMpIHtcbiAgICBsZXQgbGltaXQgPSBJbmZpbml0eTtcbiAgICBpZiAob3B0aW9ucy5saW1pdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsaW1pdCA9IG9wdGlvbnMubGltaXQ7XG4gICAgICBkZWxldGUgb3B0aW9ucy5saW1pdDtcbiAgICB9XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgaXRlcmF0b3Igb2YgaXRlcmF0b3JzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgaXRlcmF0b3IpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgaSsrO1xuICAgICAgICBpZiAoaSA+PSBsaW1pdCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICAvLyBGaXJzdCBtYWtlIHN1cmUgdGhhdCBhbGwgdGhlIHRhYmxlIGNhY2hlcyBoYXZlIGJlZW4gZnVsbHkgYnVpbHQgYW5kXG4gICAgLy8gY29ubmVjdGVkXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwodGFibGVJZHMubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3NPYmoubW9kZWwudGFibGVzW3RhYmxlSWRdLmJ1aWxkQ2FjaGUoKTtcbiAgICB9KSk7XG4gICAgeWllbGQgKiB0aGlzLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpO1xuICB9XG4gICogX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW3RhYmxlSWRzWzBdXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRoaXNUYWJsZUlkID0gdGFibGVJZHNbMF07XG4gICAgICBjb25zdCByZW1haW5pbmdUYWJsZUlkcyA9IHRhYmxlSWRzLnNsaWNlKDEpO1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuY29ubmVjdGVkSXRlbXNbdGhpc1RhYmxlSWRdIHx8IFtdKSB7XG4gICAgICAgIHlpZWxkICogaXRlbS5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHJlbWFpbmluZ1RhYmxlSWRzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMubW9kZWwgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG5cbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzID0gb3B0aW9ucy5kZXJpdmVkVGFibGVzIHx8IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIHx8IHt9KSkge1xuICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLnN1cHByZXNzZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSAhIW9wdGlvbnMuc3VwcHJlc3NJbmRleDtcblxuICAgIHRoaXMuX2luZGV4RmlsdGVyID0gKG9wdGlvbnMuaW5kZXhGaWx0ZXIgJiYgdGhpcy5oeWRyYXRlRnVuY3Rpb24ob3B0aW9ucy5pbmRleEZpbHRlcikpIHx8IG51bGw7XG4gICAgdGhpcy5fYXR0cmlidXRlRmlsdGVycyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5hdHRyaWJ1dGVGaWx0ZXJzIHx8IHt9KSkge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fbGltaXRQcm9taXNlcyA9IHt9O1xuXG4gICAgdGhpcy5pdGVyYXRpb25SZXNldCA9IG5ldyBFcnJvcignSXRlcmF0aW9uIHJlc2V0Jyk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaGFzIGFscmVhZHkgYmVlbiBidWlsdDsganVzdCBncmFiIGRhdGEgZnJvbSBpdCBkaXJlY3RseVxuICAgICAgeWllbGQgKiB0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGUgJiYgdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkLCBidXQgaXQncyBhbHJlYWR5IGxvbmcgZW5vdWdoIHRvIHNhdGlzZnkgdGhpc1xuICAgICAgLy8gcmVxdWVzdFxuICAgICAgeWllbGQgKiB0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQgYnVpbGRpbmcgKGFuZCBtYXliZSBkaWRuJ3QgZXZlbiBzdGFydCB5ZXQpO1xuICAgICAgLy8ga2ljayBpdCBvZmYsIGFuZCB0aGVuIHdhaXQgZm9yIGVub3VnaCBpdGVtcyB0byBiZSBwcm9jZXNzZWQgdG8gc2F0aXNmeVxuICAgICAgLy8gdGhlIGxpbWl0XG4gICAgICB0aGlzLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHlpZWxkICogYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSA9IHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdIHx8IFtdO1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIFNvbWV0aGluZyB3ZW50IHdyb25nIHVwc3RyZWFtIChzb21ldGhpbmcgdGhhdCB0aGlzLl9pdGVyYXRlXG4gICAgICAgIC8vIGRlcGVuZHMgb24gd2FzIHJlc2V0IG9yIHRocmV3IGEgcmVhbCBlcnJvcilcbiAgICAgICAgaWYgKGVyciA9PT0gdGhpcy5pdGVyYXRpb25SZXNldCkge1xuICAgICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKSkge1xuICAgICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGRhdGEgbm93IHRvIHNhdGlzZnkgYW55IHdhaXRpbmcgcmVxdWVzdHNcbiAgICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRG9uZSBpdGVyYXRpbmchIFdlIGNhbiBncmFkdWF0ZSB0aGUgcGFydGlhbCBjYWNoZSAvIGxvb2t1cHMgaW50b1xuICAgIC8vIGZpbmlzaGVkIG9uZXMsIGFuZCBzYXRpc2Z5IGFsbCB0aGUgcmVxdWVzdHNcbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIHRoaXMuX2NhY2hlTG9va3VwID0gdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICB9XG4gIGJ1aWxkQ2FjaGUgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuX2NhY2hlUHJvbWlzZSkge1xuICAgICAgdGhpcy5fY2FjaGVQcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyBUaGUgc2V0VGltZW91dCBoZXJlIGlzIGFic29sdXRlbHkgbmVjZXNzYXJ5LCBvciB0aGlzLl9jYWNoZVByb21pc2VcbiAgICAgICAgLy8gd29uJ3QgYmUgc3RvcmVkIGluIHRpbWUgZm9yIHRoZSBuZXh0IGJ1aWxkQ2FjaGUoKSBjYWxsIHRoYXQgY29tZXNcbiAgICAgICAgLy8gdGhyb3VnaFxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICB0aGlzLl9idWlsZENhY2hlKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGhhbmRsZVJlc2V0IChyZWplY3QpIHtcbiAgICBmb3IgKGNvbnN0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5yZWplY3QodGhpcy5pdGVyYXRpb25SZXNldCk7XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlcztcbiAgICB9XG4gICAgcmVqZWN0KHRoaXMuaXRlcmF0aW9uUmVzZXQpO1xuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLmJ1aWxkQ2FjaGUoKSkubGVuZ3RoO1xuICB9XG4gIGFzeW5jIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICAgIGlmICh3cmFwcGVkSXRlbS5yb3dbYXR0cl0gaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgd3JhcHBlZEl0ZW0uZGVsYXllZFJvdyA9IHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3cgfHwge307XG4gICAgICAgICAgd3JhcHBlZEl0ZW0uZGVsYXllZFJvd1thdHRyXSA9IGF3YWl0IHdyYXBwZWRJdGVtLnJvd1thdHRyXTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgYXdhaXQgZnVuYyhhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cl0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IG90aGVySXRlbSBvZiBvcHRpb25zLml0ZW1zVG9Db25uZWN0IHx8IFtdKSB7XG4gICAgICB3cmFwcGVkSXRlbS5jb25uZWN0SXRlbShvdGhlckl0ZW0pO1xuICAgICAgb3RoZXJJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBnZXRJbmRleERldGFpbHMgKCkge1xuICAgIGNvbnN0IGRldGFpbHMgPSB7IG5hbWU6IG51bGwgfTtcbiAgICBpZiAodGhpcy5fc3VwcHJlc3NJbmRleCkge1xuICAgICAgZGV0YWlscy5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBkZXRhaWxzLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRldGFpbHM7XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIC8vIEFsbG93IHByb2JpbmcgdG8gc2VlIHdoYXRldmVyIGRhdGEgaGFwcGVucyB0byBiZSBhdmFpbGFibGVcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IFtdLFxuICAgICAgbG9va3VwOiB0aGlzLl9jYWNoZUxvb2t1cCB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgYXN5bmMgZ2V0SXRlbSAoaW5kZXgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVMb29rdXApIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVt0aGlzLl9jYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlTG9va3VwICYmIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3BhcnRpYWxDYWNoZVt0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdXTtcbiAgICB9XG4gICAgLy8gU3R1cGlkIGFwcHJvYWNoIHdoZW4gdGhlIGNhY2hlIGlzbid0IGJ1aWx0OiBpbnRlcmF0ZSB1bnRpbCB3ZSBzZWUgdGhlXG4gICAgLy8gaW5kZXguIFN1YmNsYXNzZXMgc2hvdWxkIG92ZXJyaWRlIHRoaXNcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChpdGVtLmluZGV4ID09PSBpbmRleCkge1xuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHN1cHByZXNzQXR0cmlidXRlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFkZEZpbHRlciAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdQcm9tb3RlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnVW5yb2xsZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGR1cGxpY2F0ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdEdXBsaWNhdGVkVGFibGUnXG4gICAgfSk7XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QsIHR5cGUgPSAnQ29ubmVjdGVkVGFibGUnKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHsgdHlwZSB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGlmICh0aGlzLmluVXNlKSB7XG4gICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBpbi11c2UgdGFibGUgJHt0aGlzLnRhYmxlSWR9YCk7XG4gICAgICBlcnIuaW5Vc2UgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX25hbWU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY0RpY3RUYWJsZTtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWlyZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY29uc3QgQXR0clRhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihzdXBlcmNsYXNzKSB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkF0dHJUYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGdldFNvcnRIYXNoICgpIHtcbiAgICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgICBnZXQgbmFtZSAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQXR0clRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBBdHRyVGFibGVNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBBdHRyVGFibGVNaXhpbiBmcm9tICcuL0F0dHJUYWJsZU1peGluLmpzJztcblxuY2xhc3MgUHJvbW90ZWRUYWJsZSBleHRlbmRzIEF0dHJUYWJsZU1peGluKFRhYmxlKSB7XG4gIGFzeW5jIF9idWlsZENhY2hlIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHdlIGRvbid0IGFjdHVhbGx5IHdhbnQgdG8gY2FsbCBfZmluaXNoSXRlbVxuICAgIC8vIHVudGlsIGFsbCB1bmlxdWUgdmFsdWVzIGhhdmUgYmVlbiBzZWVuXG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlID0gW107XG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwID0ge307XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gU29tZXRoaW5nIHdlbnQgd3JvbmcgdXBzdHJlYW0gKHNvbWV0aGluZyB0aGF0IHRoaXMuX2l0ZXJhdGVcbiAgICAgICAgLy8gZGVwZW5kcyBvbiB3YXMgcmVzZXQgb3IgdGhyZXcgYSByZWFsIGVycm9yKVxuICAgICAgICBpZiAoZXJyID09PSB0aGlzLml0ZXJhdGlvblJlc2V0KSB7XG4gICAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gcmVzZXQoKSB3YXMgY2FsbGVkIGJlZm9yZSB3ZSBjb3VsZCBmaW5pc2g7IHdlIG5lZWQgdG8gbGV0IGV2ZXJ5b25lXG4gICAgICAgIC8vIHRoYXQgd2FzIHdhaXRpbmcgb24gdXMga25vdyB0aGF0IHdlIGNhbid0IGNvbXBseVxuICAgICAgICB0aGlzLmhhbmRsZVJlc2V0KHJlamVjdCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghdGVtcC5kb25lKSB7XG4gICAgICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFt0ZW1wLnZhbHVlLmluZGV4XSA9IHRoaXMuX3VuZmluaXNoZWRDYWNoZS5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZS5wdXNoKHRlbXAudmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBPa2F5LCBub3cgd2UndmUgc2VlbiBldmVyeXRoaW5nOyB3ZSBjYW4gY2FsbCBfZmluaXNoSXRlbSBvbiBlYWNoIG9mIHRoZVxuICAgIC8vIHVuaXF1ZSB2YWx1ZXNcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCB2YWx1ZSBvZiB0aGlzLl91bmZpbmlzaGVkQ2FjaGUpIHtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKHZhbHVlKSkge1xuICAgICAgICAvLyBPa2F5LCB0aGlzIGl0ZW0gcGFzc2VkIGFsbCBmaWx0ZXJzLCBhbmQgaXMgcmVhZHkgdG8gYmUgc2VudCBvdXRcbiAgICAgICAgLy8gaW50byB0aGUgd29ybGRcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW3ZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZS5wdXNoKHZhbHVlKTtcbiAgICAgICAgaSsrO1xuICAgICAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgaWYgKGxpbWl0IDw9IGkpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRG9uZSBpdGVyYXRpbmchIFdlIGNhbiBncmFkdWF0ZSB0aGUgcGFydGlhbCBjYWNoZSAvIGxvb2t1cHMgaW50b1xuICAgIC8vIGZpbmlzaGVkIG9uZXMsIGFuZCBzYXRpc2Z5IGFsbCB0aGUgcmVxdWVzdHNcbiAgICBkZWxldGUgdGhpcy5fdW5maW5pc2hlZENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXA7XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgaW5kZXggPSBTdHJpbmcoYXdhaXQgd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0IVxuICAgICAgICB0aHJvdyB0aGlzLml0ZXJhdGlvblJlc2V0O1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fdW5maW5pc2hlZENhY2hlW3RoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0oZXhpc3RpbmdJdGVtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBGYWNldGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSB8fCAhdGhpcy5fdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGUgKyB0aGlzLl92YWx1ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGBbJHt0aGlzLl92YWx1ZX1dYDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBpZiAoYXdhaXQgd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gTm9ybWFsIGZhY2V0aW5nIGp1c3QgZ2l2ZXMgYSBzdWJzZXQgb2YgdGhlIG9yaWdpbmFsIHRhYmxlXG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IE9iamVjdC5hc3NpZ24oe30sIHdyYXBwZWRQYXJlbnQucm93KSxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmFjZXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBUcmFuc3Bvc2VkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2luZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5faW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5pbmRleCA9IHRoaXMuX2luZGV4O1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5faW5kZXg7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLl9pbmRleH1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIC8vIFByZS1idWlsZCB0aGUgcGFyZW50IHRhYmxlJ3MgY2FjaGVcbiAgICBhd2FpdCB0aGlzLnBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcblxuICAgIC8vIEl0ZXJhdGUgdGhlIHJvdydzIGF0dHJpYnV0ZXMgYXMgaW5kZXhlc1xuICAgIGNvbnN0IHdyYXBwZWRQYXJlbnQgPSB0aGlzLnBhcmVudFRhYmxlLl9jYWNoZVt0aGlzLnBhcmVudFRhYmxlLl9jYWNoZUxvb2t1cFt0aGlzLl9pbmRleF1dIHx8IHsgcm93OiB7fSB9O1xuICAgIGZvciAoY29uc3QgWyBpbmRleCwgdmFsdWUgXSBvZiBPYmplY3QuZW50cmllcyh3cmFwcGVkUGFyZW50LnJvdykpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5nZXRTb3J0SGFzaCgpKS5qb2luKCcsJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgLy8gRG9uJ3QgdHJ5IHRvIGNvbm5lY3QgdmFsdWVzIHVudGlsIGFsbCBvZiB0aGUgcGFyZW50IHRhYmxlcycgY2FjaGVzIGFyZVxuICAgIC8vIGJ1aWx0OyBUT0RPOiBtaWdodCBiZSBhYmxlIHRvIGRvIHNvbWV0aGluZyBtb3JlIHJlc3BvbnNpdmUgaGVyZT9cbiAgICBhd2FpdCBQcm9taXNlLmFsbChwYXJlbnRUYWJsZXMubWFwKHBUYWJsZSA9PiBwVGFibGUuYnVpbGRDYWNoZSgpKSk7XG5cbiAgICAvLyBOb3cgdGhhdCB0aGUgY2FjaGVzIGFyZSBidWlsdCwganVzdCBpdGVyYXRlIHRoZWlyIGtleXMgZGlyZWN0bHkuIFdlIG9ubHlcbiAgICAvLyBjYXJlIGFib3V0IGluY2x1ZGluZyByb3dzIHRoYXQgaGF2ZSBleGFjdCBtYXRjaGVzIGFjcm9zcyBhbGwgdGFibGVzLCBzb1xuICAgIC8vIHdlIGNhbiBqdXN0IHBpY2sgb25lIHBhcmVudCB0YWJsZSB0byBpdGVyYXRlXG4gICAgY29uc3QgYmFzZVBhcmVudFRhYmxlID0gcGFyZW50VGFibGVzWzBdO1xuICAgIGNvbnN0IG90aGVyUGFyZW50VGFibGVzID0gcGFyZW50VGFibGVzLnNsaWNlKDEpO1xuICAgIGZvciAoY29uc3QgaW5kZXggaW4gYmFzZVBhcmVudFRhYmxlLl9jYWNoZUxvb2t1cCkge1xuICAgICAgaWYgKCFwYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlTG9va3VwKSkge1xuICAgICAgICAvLyBPbmUgb2YgdGhlIHBhcmVudCB0YWJsZXMgd2FzIHJlc2V0LCBtZWFuaW5nIHdlIG5lZWQgdG8gcmVzZXQgYXMgd2VsbFxuICAgICAgICB0aHJvdyB0aGlzLml0ZXJhdGlvblJlc2V0O1xuICAgICAgfVxuICAgICAgaWYgKCFvdGhlclBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICAgIC8vIE5vIG1hdGNoIGluIG9uZSBvZiB0aGUgb3RoZXIgdGFibGVzOyBvbWl0IHRoaXMgaXRlbVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IGFkZCBlYWNoIHBhcmVudCB0YWJsZXMnIGtleXMgYXMgYXR0cmlidXRlIHZhbHVlc1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IHBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuX2NhY2hlW3RhYmxlLl9jYWNoZUxvb2t1cFtpbmRleF1dKVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIER1cGxpY2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICAvLyBZaWVsZCB0aGUgc2FtZSBpdGVtcyB3aXRoIHRoZSBzYW1lIGNvbm5lY3Rpb25zLCBidXQgd3JhcHBlZCBhbmQgZmluaXNoZWRcbiAgICAvLyBieSB0aGlzIHRhYmxlXG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4OiBpdGVtLmluZGV4LFxuICAgICAgICByb3c6IGl0ZW0ucm93LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogT2JqZWN0LnZhbHVlcyhpdGVtLmNvbm5lY3RlZEl0ZW1zKS5yZWR1Y2UoKGFnZywgaXRlbUxpc3QpID0+IHtcbiAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChpdGVtTGlzdCk7XG4gICAgICAgIH0sIFtdKVxuICAgICAgfSk7XG4gICAgICBpdGVtLnJlZ2lzdGVyRHVwbGljYXRlKG5ld0l0ZW0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IER1cGxpY2F0ZWRUYWJsZTtcbiIsImltcG9ydCBBdHRyVGFibGVNaXhpbiBmcm9tICcuL0F0dHJUYWJsZU1peGluLmpzJztcblxuY29uc3QgQ2hpbGRUYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgQXR0clRhYmxlTWl4aW4oc3VwZXJjbGFzcykge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBfd3JhcCAob3B0aW9ucykge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHN1cGVyLl93cmFwKG9wdGlvbnMpO1xuICAgICAgbmV3SXRlbS5wYXJlbnRJbmRleCA9IG9wdGlvbnMucGFyZW50SW5kZXg7XG4gICAgICByZXR1cm4gbmV3SXRlbTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KENoaWxkVGFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBDaGlsZFRhYmxlTWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgQ2hpbGRUYWJsZU1peGluIGZyb20gJy4vQ2hpbGRUYWJsZU1peGluLmpzJztcblxuY2xhc3MgRXhwYW5kZWRUYWJsZSBleHRlbmRzIENoaWxkVGFibGVNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3Qgcm93ID0gd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXTtcbiAgICAgIGlmIChyb3cgIT09IHVuZGVmaW5lZCAmJiByb3cgIT09IG51bGwgJiYgT2JqZWN0LmtleXMocm93KS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3csXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdLFxuICAgICAgICAgIHBhcmVudEluZGV4OiB3cmFwcGVkUGFyZW50LmluZGV4XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBDaGlsZFRhYmxlTWl4aW4gZnJvbSAnLi9DaGlsZFRhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBVbnJvbGxlZFRhYmxlIGV4dGVuZHMgQ2hpbGRUYWJsZU1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCByb3dzID0gd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXTtcbiAgICAgIGlmIChyb3dzICE9PSB1bmRlZmluZWQgJiYgcm93cyAhPT0gbnVsbCAmJlxuICAgICAgICAgIHR5cGVvZiByb3dzW1N5bWJvbC5pdGVyYXRvcl0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZm9yIChjb25zdCByb3cgb2Ygcm93cykge1xuICAgICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICAgIGluZGV4LFxuICAgICAgICAgICAgcm93LFxuICAgICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdLFxuICAgICAgICAgICAgcGFyZW50SW5kZXg6IHdyYXBwZWRQYXJlbnQuaW5kZXhcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBVbnJvbGxlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBQYXJlbnRDaGlsZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCcvJyk7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLmdldFNvcnRIYXNoKCkpLmpvaW4oJywnKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBsZXQgcGFyZW50VGFibGUsIGNoaWxkVGFibGU7XG4gICAgaWYgKHRoaXMucGFyZW50VGFibGVzWzBdLnBhcmVudFRhYmxlID09PSB0aGlzLnBhcmVudFRhYmxlc1sxXSkge1xuICAgICAgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlc1sxXTtcbiAgICAgIGNoaWxkVGFibGUgPSB0aGlzLnBhcmVudFRhYmxlc1swXTtcbiAgICB9IGVsc2UgaWYgKHRoaXMucGFyZW50VGFibGVzWzFdLnBhcmVudFRhYmxlID09PSB0aGlzLnBhcmVudFRhYmxlc1swXSkge1xuICAgICAgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlc1swXTtcbiAgICAgIGNoaWxkVGFibGUgPSB0aGlzLnBhcmVudFRhYmxlc1sxXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnRDaGlsZFRhYmxlIG5vdCBzZXQgdXAgcHJvcGVybHlgKTtcbiAgICB9XG5cbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2hpbGQgb2YgY2hpbGRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHBhcmVudCA9IGF3YWl0IHBhcmVudFRhYmxlLmdldEl0ZW0oY2hpbGQucGFyZW50SW5kZXgpO1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFtwYXJlbnQsIGNoaWxkXVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUGFyZW50Q2hpbGRUYWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMubW9kZWwgfHwgIXRoaXMuY2xhc3NJZCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsLCBjbGFzc0lkLCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBvcHRpb25zLmFubm90YXRpb25zIHx8IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGNsYXNzTmFtZTogdGhpcy5fY2xhc3NOYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnNcbiAgICB9O1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlICsgdGhpcy5jbGFzc05hbWU7XG4gIH1cbiAgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIHRoaXMuX2NsYXNzTmFtZSA9IHZhbHVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgIT09IG51bGw7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fCB0aGlzLnRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0IHZhcmlhYmxlTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZS50b0xvY2FsZUxvd2VyQ2FzZSgpICsgJ18nICtcbiAgICAgIHRoaXMuY2xhc3NOYW1lXG4gICAgICAgIC5zcGxpdCgvXFxXKy9nKVxuICAgICAgICAuZmlsdGVyKGQgPT4gZC5sZW5ndGggPiAwKVxuICAgICAgICAubWFwKGQgPT4gZFswXS50b0xvY2FsZVVwcGVyQ2FzZSgpICsgZC5zbGljZSgxKSlcbiAgICAgICAgLmpvaW4oJycpO1xuICB9XG4gIGdldCB0YWJsZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVJZF07XG4gIH1cbiAgZ2V0IGRlbGV0ZWQgKCkge1xuICAgIHJldHVybiAhdGhpcy5tb2RlbC5kZWxldGVkICYmIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgX2Rlcml2ZU5ld0NsYXNzIChuZXdUYWJsZSwgdHlwZSA9IHRoaXMuY29uc3RydWN0b3IubmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlXG4gICAgfSk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpLnRhYmxlSWQsICdHZW5lcmljQ2xhc3MnKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUpKTtcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLnVucm9sbChhdHRyaWJ1dGUpKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRUcmFuc3Bvc2UoaW5kZXhlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlICgpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlblRyYW5zcG9zZSgpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0U2FtcGxlR3JhcGggKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnJvb3RDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuZ2V0U2FtcGxlR3JhcGgob3B0aW9ucyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IGVkZ2VJZHMgPSBvcHRpb25zLmNsYXNzZXNcbiAgICAgID8gb3B0aW9ucy5jbGFzc2VzLm1hcChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc0lkKVxuICAgICAgOiBvcHRpb25zLmNsYXNzSWRzIHx8IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBpdGVyYXRvcnMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBvZiBlZGdlSWRzKSB7XG4gICAgICBpZiAoIXRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzW2VkZ2VJZF0pIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLm1vZGVsLmNsYXNzZXNbZWRnZUlkXTtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmNsYXNzT2JqLmdldEVkZ2VSb2xlKGVkZ2VDbGFzcyk7XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICAgIGNvbnN0IHRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgaXRlcmF0b3JzLnB1c2godGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpKTtcbiAgICAgIH1cbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgaXRlcmF0b3JzKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlTmVpZ2hib3Job29kIChvcHRpb25zID0ge30pIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgdGhpcy5lZGdlcyhvcHRpb25zKSkge1xuICAgICAgeWllbGQgKiBlZGdlLnBhaXJ3aXNlRWRnZXMob3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgKiBlZGdlQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGdldEVkZ2VSb2xlIChlZGdlQ2xhc3MpIHtcbiAgICBpZiAoIXRoaXMuZWRnZUNsYXNzSWRzW2VkZ2VDbGFzcy5jbGFzc0lkXSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICByZXR1cm4gJ2JvdGgnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdzb3VyY2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgcmV0dXJuICd0YXJnZXQnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIG1pc21hdGNoIGJldHdlZW4gbm9kZSBhbmQgZWRnZSBjbGFzc0lkc2ApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBOb2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICh7IGF1dG9jb25uZWN0ID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmICghYXV0b2Nvbm5lY3QgfHwgZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgLy8gQXJlIHdlIHRoZSBzb3VyY2Ugb3IgdGFyZ2V0IG9mIHRoZSBleGlzdGluZyBlZGdlIChpbnRlcm5hbGx5LCBpbiB0ZXJtc1xuICAgICAgLy8gb2Ygc291cmNlSWQgLyB0YXJnZXRJZCwgbm90IGVkZ2VDbGFzcy5kaXJlY3Rpb24pP1xuICAgICAgY29uc3QgaXNTb3VyY2UgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkO1xuXG4gICAgICAvLyBBcyB3ZSdyZSBjb252ZXJ0ZWQgdG8gYW4gZWRnZSwgb3VyIG5ldyByZXN1bHRpbmcgc291cmNlIEFORCB0YXJnZXRcbiAgICAgIC8vIHNob3VsZCBiZSB3aGF0ZXZlciBpcyBhdCB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcyAoaWYgYW55dGhpbmcpXG4gICAgICBpZiAoaXNTb3VyY2UpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAvLyBPa2F5LCB3ZSd2ZSBnb3QgdHdvIGVkZ2VzLCBzbyB0aGlzIGlzIGEgbGl0dGxlIG1vcmUgc3RyYWlnaHRmb3J3YXJkXG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgLy8gQWRkIHRoaXMgY2xhc3MgdG8gdGhlIHNvdXJjZSdzIC8gdGFyZ2V0J3MgZWRnZUNsYXNzSWRzXG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBleGlzdGluZyBlZGdlIGNsYXNzZXMgZnJvbSB0aGUgbmV3IChub3cgZWRnZSkgY2xhc3NcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfVxuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgbGV0IHRoaXNIYXNoLCBvdGhlckhhc2gsIHNvdXJjZVRhYmxlSWRzLCB0YXJnZXRUYWJsZUlkcztcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGU7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbIHRoaXNIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgaWYgKG90aGVyQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlLnByb21vdGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbIG90aGVySGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSksICdOb2RlQ2xhc3MnKTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIChjaGlsZENsYXNzKSB7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3QoW2NoaWxkQ2xhc3MudGFibGVdLCAnUGFyZW50Q2hpbGRUYWJsZScpO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogY2hpbGRDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBjaGlsZENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgdW5yb2xsIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLnVucm9sbChhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgcHJvamVjdE5ld0VkZ2UgKGNsYXNzSWRMaXN0KSB7XG4gICAgY29uc3QgY2xhc3NMaXN0ID0gY2xhc3NJZExpc3QubWFwKGNsYXNzSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY2xhc3Nlc1tjbGFzc0lkXTtcbiAgICB9KTtcbiAgICBpZiAoY2xhc3NMaXN0Lmxlbmd0aCA8IDIgfHwgY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS50eXBlICE9PSAnTm9kZScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjbGFzc0lkTGlzdGApO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VDbGFzc0lkID0gdGhpcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzSWQgPSBjbGFzc0xpc3RbY2xhc3NMaXN0Lmxlbmd0aCAtIDFdLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIGxldCB0YWJsZUlkO1xuICAgIGNvbnN0IG1pZGRsZUluZGV4ID0gTWF0aC5mbG9vcigoY2xhc3NMaXN0Lmxlbmd0aCAtIDEpIC8gMik7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbGFzc0xpc3QubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICBpZiAoaSA8IG1pZGRsZUluZGV4KSB7XG4gICAgICAgIGlmIChjbGFzc0xpc3RbaV0udHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdChjbGFzc0xpc3RbaV0udGFibGVJZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdGVtcCA9IEFycmF5LmZyb20oY2xhc3NMaXN0W2ldLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIHRlbXApIHtcbiAgICAgICAgICAgIHNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNvdXJjZVRhYmxlSWRzLnVuc2hpZnQoY2xhc3NMaXN0W2ldLnRhYmxlSWQpO1xuICAgICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc0xpc3RbaV0udGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgICAgIHNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGkgPT09IG1pZGRsZUluZGV4KSB7XG4gICAgICAgIHRhYmxlSWQgPSBjbGFzc0xpc3RbaV0udGFibGUuZHVwbGljYXRlKCkudGFibGVJZDtcbiAgICAgICAgaWYgKGNsYXNzTGlzdFtpXS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgICBjb25zdCB0ZW1wID0gQXJyYXkuZnJvbShjbGFzc0xpc3RbaV0uc291cmNlVGFibGVJZHMpLnJldmVyc2UoKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgdGVtcCkge1xuICAgICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzTGlzdFtpXS50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChjbGFzc0xpc3RbaV0udHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdChjbGFzc0xpc3RbaV0udGFibGVJZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdGVtcCA9IEFycmF5LmZyb20oY2xhc3NMaXN0W2ldLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIHRlbXApIHtcbiAgICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnVuc2hpZnQoY2xhc3NMaXN0W2ldLnRhYmxlSWQpO1xuICAgICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc0xpc3RbaV0udGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIHRoaXMuY29ubmVjdGVkQ2xhc3NlcygpKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBzb3VyY2VOb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkXS50YWJsZUlkO1xuICAgIGNvbnN0IHRhYmxlSWRzID0gdGhpcy5jbGFzc09iai5zb3VyY2VUYWJsZUlkcy5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIHRhcmdldE5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHRhcmdldFRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWRdLnRhYmxlSWQ7XG4gICAgY29uc3QgdGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmNvbmNhdChbIHRhcmdldFRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogbm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpLFxuICAgICAgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogcGFpcndpc2VFZGdlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgICB5aWVsZCB7IHNvdXJjZSwgZWRnZTogdGhpcywgdGFyZ2V0IH07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHxcbiAgICAgICgodGhpcy5zb3VyY2VDbGFzcyAmJiB0aGlzLnNvdXJjZUNsYXNzLmNsYXNzTmFtZSkgfHwgJz8nKSArXG4gICAgICAnLScgK1xuICAgICAgKCh0aGlzLnRhcmdldENsYXNzICYmIHRoaXMudGFyZ2V0Q2xhc3MuY2xhc3NOYW1lKSB8fCAnPycpO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHJldHVybiBzdXBlci5wcm9tb3RlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgICB0eXBlOiAnTm9kZUNsYXNzJ1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgIG5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgICBzaWRlOiAhdGhpcy5zb3VyY2VDbGFzc0lkID8gJ3NvdXJjZScgOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogYXR0cmlidXRlXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gICAgfVxuICB9XG4gIGNvbm5lY3RGYWNldGVkQ2xhc3MgKG5ld0VkZ2VDbGFzcykge1xuICAgIC8vIFdoZW4gYW4gZWRnZSBjbGFzcyBpcyBmYWNldGVkLCB3ZSB3YW50IHRvIGtlZXAgdGhlIHNhbWUgY29ubmVjdGlvbnMuIFRoaXNcbiAgICAvLyBtZWFucyB3ZSBuZWVkIHRvIGNsb25lIGVhY2ggdGFibGUgY2hhaW4sIGFuZCBhZGQgb3VyIG93biB0YWJsZSB0byBpdFxuICAgIC8vIChiZWNhdXNlIG91ciB0YWJsZSBpcyB0aGUgcGFyZW50VGFibGUgb2YgdGhlIG5ldyBvbmUpXG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBuZXdFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMgPSBBcnJheS5mcm9tKHRoaXMuc291cmNlVGFibGVJZHMpO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGhpcy50YWJsZUlkKTtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgbmV3RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgICB0aGlzLnRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIGNvbnN0IG5ld0NsYXNzZXMgPSBzdXBlci5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcyk7XG4gICAgZm9yIChjb25zdCBuZXdDbGFzcyBvZiBuZXdDbGFzc2VzKSB7XG4gICAgICB0aGlzLmNvbm5lY3RGYWNldGVkQ2xhc3MobmV3Q2xhc3MpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3Q2xhc3NlcztcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdDbGFzcyBvZiBzdXBlci5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgdGhpcy5jb25uZWN0RmFjZXRlZENsYXNzKG5ld0NsYXNzKTtcbiAgICAgIHlpZWxkIG5ld0NsYXNzO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcblxuY29uc3QgREFUQUxJQl9GT1JNQVRTID0ge1xuICAnanNvbic6ICdqc29uJyxcbiAgJ2Nzdic6ICdjc3YnLFxuICAndHN2JzogJ3RzdicsXG4gICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICd0cmVlanNvbic6ICd0cmVlanNvbidcbn07XG5cbmNsYXNzIE5ldHdvcmtNb2RlbCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBvcmlncmFwaCxcbiAgICBtb2RlbElkLFxuICAgIG5hbWUgPSBtb2RlbElkLFxuICAgIGFubm90YXRpb25zID0ge30sXG4gICAgY2xhc3NlcyA9IHt9LFxuICAgIHRhYmxlcyA9IHt9XG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX29yaWdyYXBoID0gb3JpZ3JhcGg7XG4gICAgdGhpcy5tb2RlbElkID0gbW9kZWxJZDtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9ucztcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcbiAgICB0aGlzLnRhYmxlcyA9IHt9O1xuXG4gICAgdGhpcy5fbmV4dENsYXNzSWQgPSAxO1xuICAgIHRoaXMuX25leHRUYWJsZUlkID0gMTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhjbGFzc2VzKSkge1xuICAgICAgdGhpcy5jbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gdGhpcy5oeWRyYXRlKGNsYXNzT2JqLCBDTEFTU0VTKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICAgIHRoaXMudGFibGVzW3RhYmxlLnRhYmxlSWRdID0gdGhpcy5oeWRyYXRlKHRhYmxlLCBUQUJMRVMpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ3VwZGF0ZScsICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zYXZlVGltZW91dCk7XG4gICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vcmlncmFwaC5zYXZlKCk7XG4gICAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuICAgICAgfSwgMCk7XG4gICAgfSk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBjbGFzc2VzID0ge307XG4gICAgY29uc3QgdGFibGVzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0udHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXSA9IHRhYmxlT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdLnR5cGUgPSB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWxJZDogdGhpcy5tb2RlbElkLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnMsXG4gICAgICBjbGFzc2VzLFxuICAgICAgdGFibGVzXG4gICAgfTtcbiAgfVxuICBnZXQgdW5zYXZlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NhdmVUaW1lb3V0ICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgaHlkcmF0ZSAocmF3T2JqZWN0LCBUWVBFUykge1xuICAgIHJhd09iamVjdC5tb2RlbCA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBUWVBFU1tyYXdPYmplY3QudHlwZV0ocmF3T2JqZWN0KTtcbiAgfVxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIHdoaWxlICghb3B0aW9ucy50YWJsZUlkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSkpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7dGhpcy5fbmV4dFRhYmxlSWR9YDtcbiAgICAgIHRoaXMuX25leHRUYWJsZUlkICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVEFCTEVTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgZmluZENsYXNzIChjbGFzc05hbWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NOYW1lID09PSBjbGFzc05hbWUpO1xuICB9XG4gIHJlbmFtZSAobmV3TmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhbm5vdGF0ZSAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5fb3JpZ3JhcGguZGVsZXRlTW9kZWwodGhpcy5tb2RlbElkKTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX29yaWdyYXBoLm1vZGVsc1t0aGlzLm1vZGVsSWRdO1xuICB9XG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseWApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5fb3JpZ3JhcGguRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24sIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICghZXh0ZW5zaW9uKSB7XG4gICAgICBleHRlbnNpb24gPSBtaW1lLmV4dGVuc2lvbihtaW1lLmxvb2t1cChuYW1lKSk7XG4gICAgfVxuICAgIGlmIChEQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgZGF0YSA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZSh7IG5hbWUsIGRhdGEsIGF0dHJpYnV0ZXMgfSk7XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKCFlcnIuaW5Vc2UpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyBnZXRTYW1wbGVHcmFwaCAoe1xuICAgIHJvb3RDbGFzcyA9IG51bGwsXG4gICAgYnJhbmNoTGltaXQgPSBJbmZpbml0eSxcbiAgICBub2RlTGltaXQgPSBJbmZpbml0eSxcbiAgICBlZGdlTGltaXQgPSBJbmZpbml0eSxcbiAgICB0cmlwbGVMaW1pdCA9IEluZmluaXR5XG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IHNhbXBsZUdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW10sXG4gICAgICBlZGdlTG9va3VwOiB7fSxcbiAgICAgIGxpbmtzOiBbXVxuICAgIH07XG5cbiAgICBsZXQgbnVtVHJpcGxlcyA9IDA7XG4gICAgY29uc3QgYWRkTm9kZSA9IG5vZGUgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGgubm9kZXMucHVzaChub2RlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGggPD0gbm9kZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkRWRnZSA9IGVkZ2UgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLmVkZ2VzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGguZWRnZXMucHVzaChlZGdlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5lZGdlcy5sZW5ndGggPD0gZWRnZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkVHJpcGxlID0gKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSA9PiB7XG4gICAgICBpZiAoYWRkTm9kZShzb3VyY2UpICYmIGFkZE5vZGUodGFyZ2V0KSAmJiBhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogc2FtcGxlR3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSxcbiAgICAgICAgICBlZGdlOiBzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF1cbiAgICAgICAgfSk7XG4gICAgICAgIG51bVRyaXBsZXMrKztcbiAgICAgICAgcmV0dXJuIG51bVRyaXBsZXMgPD0gdHJpcGxlTGltaXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxldCBjbGFzc0xpc3QgPSByb290Q2xhc3MgPyBbcm9vdENsYXNzXSA6IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGROb2RlKG5vZGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIGVkZ2UsIHRhcmdldCB9IG9mIG5vZGUucGFpcndpc2VOZWlnaGJvcmhvb2QoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmICghYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIHRhcmdldCB9IG9mIGVkZ2UucGFpcndpc2VFZGdlcyh7IGxpbWl0OiBicmFuY2hMaW1pdCB9KSkge1xuICAgICAgICAgICAgaWYgKCFhZGRUcmlwbGUoc291cmNlLCBlZGdlLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICB9XG4gIGFzeW5jIGdldEluc3RhbmNlR3JhcGggKGluc3RhbmNlSWRMaXN0KSB7XG4gICAgaWYgKCFpbnN0YW5jZUlkTGlzdCkge1xuICAgICAgLy8gV2l0aG91dCBzcGVjaWZpZWQgaW5zdGFuY2VzLCBqdXN0IHBpY2sgdGhlIGZpcnN0IDUgZnJvbSBlYWNoIG5vZGVcbiAgICAgIC8vIGFuZCBlZGdlIGNsYXNzXG4gICAgICBpbnN0YW5jZUlkTGlzdCA9IFtdO1xuICAgICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyB8fCBjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSg1KSkge1xuICAgICAgICAgICAgaW5zdGFuY2VJZExpc3QucHVzaChpdGVtLmluc3RhbmNlSWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEdldCB0aGUgc3BlY2lmaWVkIGl0ZW1zXG4gICAgY29uc3Qgbm9kZUluc3RhbmNlcyA9IHt9O1xuICAgIGNvbnN0IGVkZ2VJbnN0YW5jZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlSWQgb2YgaW5zdGFuY2VJZExpc3QpIHtcbiAgICAgIGNvbnN0IHsgY2xhc3NJZCwgaW5kZXggfSA9IEpTT04ucGFyc2UoaW5zdGFuY2VJZCk7XG4gICAgICBjb25zdCBpbnN0YW5jZSA9IGF3YWl0IHRoaXMuY2xhc3Nlc1tjbGFzc0lkXS50YWJsZS5nZXRJdGVtKGluZGV4KTtcbiAgICAgIGlmIChpbnN0YW5jZS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgbm9kZUluc3RhbmNlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZUluc3RhbmNlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBBZGQgYW55IG5vZGVzIGNvbm5lY3RlZCB0byBvdXIgZWRnZXNcbiAgICBjb25zdCBleHRyYU5vZGVzID0ge307XG4gICAgZm9yIChjb25zdCBlZGdlSWQgaW4gZWRnZUluc3RhbmNlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2VJbnN0YW5jZXNbZWRnZUlkXS5ub2RlcygpKSB7XG4gICAgICAgIGlmICghbm9kZUluc3RhbmNlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgZXh0cmFOb2Rlc1tub2RlLmluc3RhbmNlSWRdID0gbm9kZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBBZGQgYW55IGVkZ2VzIHRoYXQgY29ubmVjdCBvdXIgbm9kZXNcbiAgICBjb25zdCBleHRyYUVkZ2VzID0ge307XG4gICAgZm9yIChjb25zdCBub2RlSWQgaW4gbm9kZUluc3RhbmNlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIG5vZGVJbnN0YW5jZXNbbm9kZUlkXS5lZGdlcygpKSB7XG4gICAgICAgIGlmICghZWRnZUluc3RhbmNlc1tlZGdlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgLy8gQ2hlY2sgdGhhdCBib3RoIGVuZHMgb2YgdGhlIGVkZ2UgY29ubmVjdCBhdCBsZWFzdCBvbmVcbiAgICAgICAgICAvLyBvZiBvdXIgbm9kZXNcbiAgICAgICAgICBsZXQgY29ubmVjdHNTb3VyY2UgPSBmYWxzZTtcbiAgICAgICAgICBsZXQgY29ubmVjdHNUYXJnZXQgPSBmYWxzZTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgICAgICBpZiAobm9kZUluc3RhbmNlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzU291cmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2RlSW5zdGFuY2VzW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAgICAgY29ubmVjdHNUYXJnZXQgPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNvbm5lY3RzU291cmNlICYmIGNvbm5lY3RzVGFyZ2V0KSB7XG4gICAgICAgICAgICBleHRyYUVkZ2VzW2VkZ2UuaW5zdGFuY2VJZF0gPSBlZGdlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE9rYXksIG5vdyB3ZSBoYXZlIGEgY29tcGxldGUgc2V0IG9mIG5vZGVzIGFuZCBlZGdlcyB0aGF0IHdlIHdhbnQgdG9cbiAgICAvLyBpbmNsdWRlOyBjcmVhdGUgcGFpcndpc2UgZWRnZSBlbnRyaWVzIGZvciBldmVyeSBjb25uZWN0aW9uXG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBub2RlTG9va3VwOiB7fSxcbiAgICAgIGVkZ2VzOiBbXVxuICAgIH07XG5cbiAgICAvLyBBZGQgYWxsIHRoZSBub2RlcywgYW5kIHBvcHVsYXRlIGEgbG9va3VwIGZvciB3aGVyZSB0aGV5IGFyZSBpbiB0aGUgbGlzdFxuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBPYmplY3QudmFsdWVzKG5vZGVJbnN0YW5jZXMpLmNvbmNhdChPYmplY3QudmFsdWVzKGV4dHJhTm9kZXMpKSkge1xuICAgICAgZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdID0gZ3JhcGgubm9kZXMubGVuZ3RoO1xuICAgICAgZ3JhcGgubm9kZXMucHVzaCh7XG4gICAgICAgIG5vZGVJbnN0YW5jZTogbm9kZSxcbiAgICAgICAgZHVtbXk6IGZhbHNlXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBZGQgYWxsIHRoZSBlZGdlcy4uLlxuICAgIGZvciAoY29uc3QgZWRnZSBvZiBPYmplY3QudmFsdWVzKGVkZ2VJbnN0YW5jZXMpLmNvbmNhdChPYmplY3QudmFsdWVzKGV4dHJhRWRnZXMpKSkge1xuICAgICAgaWYgKCFlZGdlLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKCFlZGdlLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgICAvLyBNaXNzaW5nIGJvdGggc291cmNlIGFuZCB0YXJnZXQgY2xhc3NlczsgYWRkIGR1bW15IG5vZGVzIGZvciBib3RoIGVuZHNcbiAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGggKyAxXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBBZGQgZHVtbXkgc291cmNlIG5vZGVzXG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIC8vIEFkZCBkdW1teSB0YXJnZXQgbm9kZXNcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoZXJlIHNob3VsZCBiZSBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IG5vZGVzIGZvciBlYWNoIGVkZ2VcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2VOb2RlIG9mIGVkZ2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3NvdXJjZU5vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXROb2RlIG9mIGVkZ2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXROb2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2VOb2RlLmluc3RhbmNlSWRdLFxuICAgICAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2RlTG9va3VwW3RhcmdldE5vZGUuaW5zdGFuY2VJZF1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TmV0d29ya01vZGVsR3JhcGggKHtcbiAgICByYXcgPSB0cnVlLFxuICAgIGluY2x1ZGVEdW1taWVzID0gZmFsc2UsXG4gICAgY2xhc3NMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc2VzID0gW107XG4gICAgbGV0IGdyYXBoID0ge1xuICAgICAgY2xhc3NlczogW10sXG4gICAgICBjbGFzc0xvb2t1cDoge30sXG4gICAgICBjbGFzc0Nvbm5lY3Rpb25zOiBbXVxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgLy8gQWRkIGFuZCBpbmRleCB0aGUgY2xhc3MgYXMgYSBub2RlXG4gICAgICBjb25zdCBjbGFzc1NwZWMgPSByYXcgPyBjbGFzc09iai5fdG9SYXdPYmplY3QoKSA6IHsgY2xhc3NPYmogfTtcbiAgICAgIGNsYXNzU3BlYy50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLmNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gZ3JhcGguY2xhc3Nlcy5sZW5ndGg7XG4gICAgICBncmFwaC5jbGFzc2VzLnB1c2goY2xhc3NTcGVjKTtcblxuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAvLyBTdG9yZSB0aGUgZWRnZSBjbGFzcyBzbyB3ZSBjYW4gY3JlYXRlIGNsYXNzQ29ubmVjdGlvbnMgbGF0ZXJcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyAmJiBpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBub2RlXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2NsYXNzT2JqLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoIC0gMSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBmYWxzZSxcbiAgICAgICAgICBsb2NhdGlvbjogJ25vZGUnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgZXhpc3RpbmcgY2xhc3NDb25uZWN0aW9uc1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIGVkZ2VDbGFzc2VzKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgc291cmNlIG5vZGUgY2xhc3MgdG8gdGhlIGVkZ2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWR9PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJ1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgc291cmNlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGBkdW1teT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgZWRnZSBjbGFzcyB0byB0aGUgdGFyZ2V0IG5vZGUgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PiR7ZWRnZUNsYXNzLnRhcmdldENsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0J1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgdGFyZ2V0IGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0JyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldFRhYmxlRGVwZW5kZW5jeUdyYXBoICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIHRhYmxlczogW10sXG4gICAgICB0YWJsZUxvb2t1cDoge30sXG4gICAgICB0YWJsZUxpbmtzOiBbXVxuICAgIH07XG4gICAgY29uc3QgdGFibGVMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcyk7XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGNvbnN0IHRhYmxlU3BlYyA9IHRhYmxlLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVTcGVjLnR5cGUgPSB0YWJsZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBncmFwaC50YWJsZXMubGVuZ3RoO1xuICAgICAgZ3JhcGgudGFibGVzLnB1c2godGFibGVTcGVjKTtcbiAgICB9XG4gICAgLy8gRmlsbCB0aGUgZ3JhcGggd2l0aCBsaW5rcyBiYXNlZCBvbiBwYXJlbnRUYWJsZXMuLi5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0YWJsZS5wYXJlbnRUYWJsZXMpIHtcbiAgICAgICAgZ3JhcGgudGFibGVMaW5rcy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLnRhYmxlTG9va3VwW3BhcmVudFRhYmxlLnRhYmxlSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRNb2RlbER1bXAgKCkge1xuICAgIC8vIEJlY2F1c2Ugb2JqZWN0IGtleSBvcmRlcnMgYXJlbid0IGRldGVybWluaXN0aWMsIGl0IGNhbiBiZSBwcm9ibGVtYXRpY1xuICAgIC8vIGZvciB0ZXN0aW5nIChiZWNhdXNlIGlkcyBjYW4gcmFuZG9tbHkgY2hhbmdlIGZyb20gdGVzdCBydW4gdG8gdGVzdCBydW4pLlxuICAgIC8vIFRoaXMgZnVuY3Rpb24gc29ydHMgZWFjaCBrZXksIGFuZCBqdXN0IHJlcGxhY2VzIElEcyB3aXRoIGluZGV4IG51bWJlcnNcbiAgICBjb25zdCByYXdPYmogPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHRoaXMuX3RvUmF3T2JqZWN0KCkpKTtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBjbGFzc2VzOiBPYmplY3QudmFsdWVzKHJhd09iai5jbGFzc2VzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy5jbGFzc2VzW2EuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLmNsYXNzZXNbYi5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzcyBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHRhYmxlczogT2JqZWN0LnZhbHVlcyhyYXdPYmoudGFibGVzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy50YWJsZXNbYS50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMudGFibGVzW2IudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgdGFibGUgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9O1xuICAgIGNvbnN0IGNsYXNzTG9va3VwID0ge307XG4gICAgY29uc3QgdGFibGVMb29rdXAgPSB7fTtcbiAgICByZXN1bHQuY2xhc3Nlcy5mb3JFYWNoKChjbGFzc09iaiwgaW5kZXgpID0+IHtcbiAgICAgIGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gaW5kZXg7XG4gICAgfSk7XG4gICAgcmVzdWx0LnRhYmxlcy5mb3JFYWNoKCh0YWJsZSwgaW5kZXgpID0+IHtcbiAgICAgIHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gaW5kZXg7XG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHJlc3VsdC50YWJsZXMpIHtcbiAgICAgIHRhYmxlLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXTtcbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKSkge1xuICAgICAgICB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlTG9va3VwW3RhYmxlSWRdXSA9IHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICAgIGRlbGV0ZSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRhYmxlLmRhdGE7IC8vIGRvbid0IGluY2x1ZGUgYW55IG9mIHRoZSBkYXRhOyB3ZSBqdXN0IHdhbnQgdGhlIG1vZGVsIHN0cnVjdHVyZVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIHJlc3VsdC5jbGFzc2VzKSB7XG4gICAgICBjbGFzc09iai5jbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF07XG4gICAgICBjbGFzc09iai50YWJsZUlkID0gdGFibGVMb29rdXBbY2xhc3NPYmoudGFibGVJZF07XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouc291cmNlQ2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlVGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMgPSBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai50YXJnZXRDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMgPSBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGNsYXNzSWQgb2YgT2JqZWN0LmtleXMoY2xhc3NPYmouZWRnZUNsYXNzSWRzIHx8IHt9KSkge1xuICAgICAgICBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NMb29rdXBbY2xhc3NJZF1dID0gY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgICBkZWxldGUgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGNyZWF0ZVNjaGVtYU1vZGVsICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHRoaXMuZ2V0TW9kZWxEdW1wKCk7XG5cbiAgICBncmFwaC50YWJsZXMuZm9yRWFjaCh0YWJsZSA9PiB7XG4gICAgICB0YWJsZS5kZXJpdmVkVGFibGVzID0gT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcyk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZU1vZGVsKHsgbmFtZTogdGhpcy5uYW1lICsgJ19zY2hlbWEnIH0pO1xuICAgIGNvbnN0IHJhdyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLFxuICAgICAgbmFtZTogJ1JhdyBEdW1wJ1xuICAgIH0pO1xuICAgIGxldCBbIGNsYXNzZXMsIHRhYmxlcyBdID0gcmF3LmNsb3NlZFRyYW5zcG9zZShbJ2NsYXNzZXMnLCAndGFibGVzJ10pO1xuICAgIGNsYXNzZXMgPSBjbGFzc2VzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBjbGFzc2VzLnNldENsYXNzTmFtZSgnQ2xhc3NlcycpO1xuICAgIHJhdy5kZWxldGUoKTtcblxuICAgIGNvbnN0IHNvdXJjZUNsYXNzZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogY2xhc3NlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3NvdXJjZUNsYXNzSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBzb3VyY2VDbGFzc2VzLnNldENsYXNzTmFtZSgnU291cmNlIENsYXNzJyk7XG4gICAgc291cmNlQ2xhc3Nlcy50b2dnbGVEaXJlY3Rpb24oKTtcbiAgICBjb25zdCB0YXJnZXRDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YXJnZXRDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgdGFyZ2V0Q2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1RhcmdldCBDbGFzcycpO1xuICAgIHRhcmdldENsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICB0YWJsZXMgPSB0YWJsZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgIHRhYmxlcy5zZXRDbGFzc05hbWUoJ1RhYmxlcycpO1xuXG4gICAgY29uc3QgdGFibGVEZXBlbmRlbmNpZXMgPSB0YWJsZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdkZXJpdmVkVGFibGVzJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMuc2V0Q2xhc3NOYW1lKCdJcyBQYXJlbnQgT2YnKTtcbiAgICB0YWJsZURlcGVuZGVuY2llcy50b2dnbGVEaXJlY3Rpb24oKTtcblxuICAgIGNvbnN0IGNvcmVUYWJsZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAndGFibGVJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIGNvcmVUYWJsZXMuc2V0Q2xhc3NOYW1lKCdDb3JlIFRhYmxlJyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOZXR3b3JrTW9kZWw7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBOZXR3b3JrTW9kZWwgZnJvbSAnLi9Db21tb24vTmV0d29ya01vZGVsLmpzJztcblxubGV0IE5FWFRfTU9ERUxfSUQgPSAxO1xuXG5jbGFzcyBPcmlncmFwaCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIFBvdWNoREIpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5Qb3VjaERCID0gUG91Y2hEQjsgLy8gZWl0aGVyIHBvdWNoZGItYnJvd3NlciBvciBwb3VjaGRiLW5vZGVcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIC8qaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH0qL1xuICB9XG4gIGNsb3NlQ3VycmVudE1vZGVsICgpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBnZXQgY3VycmVudE1vZGVsICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbdGhpcy5fY3VycmVudE1vZGVsSWRdIHx8IG51bGw7XG4gIH1cbiAgc2V0IGN1cnJlbnRNb2RlbCAobW9kZWwpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG1vZGVsID8gbW9kZWwubW9kZWxJZCA6IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBjcmVhdGVNb2RlbCAob3B0aW9ucyA9IHt9KSB7XG4gICAgd2hpbGUgKCFvcHRpb25zLm1vZGVsSWQgfHwgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSkge1xuICAgICAgb3B0aW9ucy5tb2RlbElkID0gYG1vZGVsJHtORVhUX01PREVMX0lEfWA7XG4gICAgICBORVhUX01PREVMX0lEICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMub3JpZ3JhcGggPSB0aGlzO1xuICAgIHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0gPSBuZXcgTmV0d29ya01vZGVsKG9wdGlvbnMpO1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gb3B0aW9ucy5tb2RlbElkO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF07XG4gIH1cbiAgZGVsZXRlTW9kZWwgKG1vZGVsSWQgPSB0aGlzLmN1cnJlbnRNb2RlbElkKSB7XG4gICAgaWYgKCF0aGlzLm1vZGVsc1ttb2RlbElkXSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgbm9uLWV4aXN0ZW50IG1vZGVsOiAke21vZGVsSWR9YCk7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsc1ttb2RlbElkXTtcbiAgICBpZiAodGhpcy5fY3VycmVudE1vZGVsSWQgPT09IG1vZGVsSWQpIHtcbiAgICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gICAgfVxuICAgIHRoaXMuc2F2ZSgpO1xuICB9XG4gIGRlbGV0ZUFsbE1vZGVscyAoKSB7XG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBPcmlncmFwaDtcbiIsImltcG9ydCBPcmlncmFwaCBmcm9tICcuL09yaWdyYXBoLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG9yaWdyYXBoID0gbmV3IE9yaWdyYXBoKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm9yaWdyYXBoLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgb3JpZ3JhcGg7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsIl9ldmVudEhhbmRsZXJzIiwiX3N0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImV2ZW50IiwibmFtZXNwYWNlIiwic3BsaXQiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJpbmRleE9mIiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJoYW5kbGVDYWxsYmFjayIsInNldFRpbWVvdXQiLCJhcHBseSIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJHZW5lcmljV3JhcHBlciIsIm9wdGlvbnMiLCJ0YWJsZSIsInVuZGVmaW5lZCIsIkVycm9yIiwiY2xhc3NPYmoiLCJyb3ciLCJjb25uZWN0ZWRJdGVtcyIsImR1cGxpY2F0ZUl0ZW1zIiwicmVnaXN0ZXJEdXBsaWNhdGUiLCJpdGVtIiwiY29ubmVjdEl0ZW0iLCJ0YWJsZUlkIiwiZHVwIiwiZGlzY29ubmVjdCIsIml0ZW1MaXN0IiwidmFsdWVzIiwiaW5zdGFuY2VJZCIsImNsYXNzSWQiLCJlcXVhbHMiLCJoYW5kbGVMaW1pdCIsIml0ZXJhdG9ycyIsImxpbWl0IiwiSW5maW5pdHkiLCJpdGVyYXRvciIsIml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInRhYmxlSWRzIiwiUHJvbWlzZSIsImFsbCIsIm1hcCIsIm1vZGVsIiwidGFibGVzIiwiYnVpbGRDYWNoZSIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJsZW5ndGgiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX2xpbWl0UHJvbWlzZXMiLCJpdGVyYXRpb25SZXNldCIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiZ2V0U29ydEhhc2giLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiaXRlcmF0ZSIsIl9jYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJyZXNvbHZlIiwicmVqZWN0IiwiX2l0ZXJhdGUiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGVMb29rdXAiLCJkb25lIiwibmV4dCIsImVyciIsImhhbmRsZVJlc2V0IiwiX2ZpbmlzaEl0ZW0iLCJOdW1iZXIiLCJfY2FjaGVMb29rdXAiLCJfY2FjaGVQcm9taXNlIiwicmVzZXQiLCJkZXJpdmVkVGFibGUiLCJjb3VudFJvd3MiLCJ3cmFwcGVkSXRlbSIsImRlbGF5ZWRSb3ciLCJrZWVwIiwiX3dyYXAiLCJvdGhlckl0ZW0iLCJpdGVtc1RvQ29ubmVjdCIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImxvb2t1cCIsImNvbXBsZXRlIiwiZ2V0SXRlbSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsInN1cHByZXNzQXR0cmlidXRlIiwiYWRkRmlsdGVyIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZSIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwicHJvbW90ZSIsImV4cGFuZCIsInVucm9sbCIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY2xvc2VkVHJhbnNwb3NlIiwiaW5kZXhlcyIsIm9wZW5UcmFuc3Bvc2UiLCJkdXBsaWNhdGUiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJvdGhlclRhYmxlIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJwYXJlbnRUYWJsZSIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkF0dHJUYWJsZU1peGluIiwiX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpbiIsIl9hdHRyaWJ1dGUiLCJQcm9tb3RlZFRhYmxlIiwiX3VuZmluaXNoZWRDYWNoZSIsIl91bmZpbmlzaGVkQ2FjaGVMb29rdXAiLCJ3cmFwcGVkUGFyZW50IiwiU3RyaW5nIiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsIkZhY2V0ZWRUYWJsZSIsIl92YWx1ZSIsIlRyYW5zcG9zZWRUYWJsZSIsIl9pbmRleCIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsInBUYWJsZSIsImJhc2VQYXJlbnRUYWJsZSIsIm90aGVyUGFyZW50VGFibGVzIiwiRHVwbGljYXRlZFRhYmxlIiwiY29uY2F0IiwiQ2hpbGRUYWJsZU1peGluIiwiX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW4iLCJwYXJlbnRJbmRleCIsIkV4cGFuZGVkVGFibGUiLCJVbnJvbGxlZFRhYmxlIiwicm93cyIsIlBhcmVudENoaWxkVGFibGUiLCJjaGlsZFRhYmxlIiwiY2hpbGQiLCJwYXJlbnQiLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbnMiLCJzZXRDbGFzc05hbWUiLCJoYXNDdXN0b21OYW1lIiwidmFyaWFibGVOYW1lIiwiZmlsdGVyIiwiZCIsInRvTG9jYWxlVXBwZXJDYXNlIiwiZGVsZXRlZCIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJfZGVyaXZlTmV3Q2xhc3MiLCJnZXRTYW1wbGVHcmFwaCIsInJvb3RDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZXMiLCJlZGdlSWRzIiwiY2xhc3NJZHMiLCJlZGdlQ2xhc3NJZHMiLCJlZGdlSWQiLCJlZGdlQ2xhc3MiLCJyb2xlIiwiZ2V0RWRnZVJvbGUiLCJyZXZlcnNlIiwicGFpcndpc2VOZWlnaGJvcmhvb2QiLCJlZGdlIiwicGFpcndpc2VFZGdlcyIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc2VzIiwiZWRnZUNsYXNzSWQiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImF1dG9jb25uZWN0IiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiaXNTb3VyY2UiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIm5vZGVDbGFzcyIsInRhYmxlSWRMaXN0IiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5ld05vZGVDbGFzcyIsImNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIiwiY2hpbGRDbGFzcyIsInByb2plY3ROZXdFZGdlIiwiY2xhc3NJZExpc3QiLCJjbGFzc0xpc3QiLCJtaWRkbGVJbmRleCIsIk1hdGgiLCJmbG9vciIsInVuc2hpZnQiLCJBcnJheSIsImZyb20iLCJjb25uZWN0ZWRDbGFzc2VzIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VOb2RlcyIsInNvdXJjZVRhYmxlSWQiLCJ0YXJnZXROb2RlcyIsInRhcmdldFRhYmxlSWQiLCJub2RlcyIsInNvdXJjZSIsInRhcmdldCIsIkVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJfc3BsaXRUYWJsZUlkTGlzdCIsIm90aGVyQ2xhc3MiLCJub2RlVGFibGVJZExpc3QiLCJlZGdlVGFibGVJZCIsImVkZ2VUYWJsZUlkTGlzdCIsInN0YXRpY0V4aXN0cyIsInRhYmxlRGlzdGFuY2VzIiwic3RhcnRzV2l0aCIsImRpc3QiLCJhYnMiLCJzb3J0IiwiYSIsImIiLCJzaWRlIiwiY29ubmVjdFNvdXJjZSIsImNvbm5lY3RUYXJnZXQiLCJ0b2dnbGVEaXJlY3Rpb24iLCJzd2FwcGVkRGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJjb25uZWN0RmFjZXRlZENsYXNzIiwibmV3Q2xhc3NlcyIsIm5ld0NsYXNzIiwiREFUQUxJQl9GT1JNQVRTIiwiTmV0d29ya01vZGVsIiwib3JpZ3JhcGgiLCJtb2RlbElkIiwiX29yaWdyYXBoIiwiX25leHRDbGFzc0lkIiwiX25leHRUYWJsZUlkIiwiaHlkcmF0ZSIsIkNMQVNTRVMiLCJUQUJMRVMiLCJfc2F2ZVRpbWVvdXQiLCJzYXZlIiwidW5zYXZlZCIsInJhd09iamVjdCIsIlRZUEVTIiwic2VsZWN0b3IiLCJmaW5kQ2xhc3MiLCJyZW5hbWUiLCJuZXdOYW1lIiwiYW5ub3RhdGUiLCJrZXkiLCJkZWxldGVBbm5vdGF0aW9uIiwiZGVsZXRlTW9kZWwiLCJtb2RlbHMiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsIm1pbWUiLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsImNvbnNvbGUiLCJ3YXJuIiwidGV4dCIsInJlYWRlciIsIkZpbGVSZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiZGVsZXRlQWxsVW51c2VkVGFibGVzIiwiYnJhbmNoTGltaXQiLCJub2RlTGltaXQiLCJlZGdlTGltaXQiLCJ0cmlwbGVMaW1pdCIsInNhbXBsZUdyYXBoIiwibm9kZUxvb2t1cCIsImVkZ2VMb29rdXAiLCJsaW5rcyIsIm51bVRyaXBsZXMiLCJhZGROb2RlIiwibm9kZSIsImFkZEVkZ2UiLCJhZGRUcmlwbGUiLCJnZXRJbnN0YW5jZUdyYXBoIiwiaW5zdGFuY2VJZExpc3QiLCJub2RlSW5zdGFuY2VzIiwiZWRnZUluc3RhbmNlcyIsIkpTT04iLCJwYXJzZSIsImluc3RhbmNlIiwiZXh0cmFOb2RlcyIsImV4dHJhRWRnZXMiLCJub2RlSWQiLCJjb25uZWN0c1NvdXJjZSIsImNvbm5lY3RzVGFyZ2V0IiwiZ3JhcGgiLCJub2RlSW5zdGFuY2UiLCJkdW1teSIsImVkZ2VJbnN0YW5jZSIsInNvdXJjZU5vZGUiLCJ0YXJnZXROb2RlIiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJyYXciLCJpbmNsdWRlRHVtbWllcyIsImNsYXNzTG9va3VwIiwiY2xhc3NDb25uZWN0aW9ucyIsImNsYXNzU3BlYyIsImlkIiwibG9jYXRpb24iLCJnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCIsInRhYmxlTG9va3VwIiwidGFibGVMaW5rcyIsInRhYmxlTGlzdCIsInRhYmxlU3BlYyIsImdldE1vZGVsRHVtcCIsInJhd09iaiIsInN0cmluZ2lmeSIsImFIYXNoIiwiYkhhc2giLCJjcmVhdGVTY2hlbWFNb2RlbCIsIm5ld01vZGVsIiwiY3JlYXRlTW9kZWwiLCJzb3VyY2VDbGFzc2VzIiwidGFyZ2V0Q2xhc3NlcyIsInRhYmxlRGVwZW5kZW5jaWVzIiwiY29yZVRhYmxlcyIsIk5FWFRfTU9ERUxfSUQiLCJPcmlncmFwaCIsIlBvdWNoREIiLCJwbHVnaW5zIiwiZXhpc3RpbmdNb2RlbHMiLCJsb2NhbFN0b3JhZ2UiLCJfY3VycmVudE1vZGVsSWQiLCJyZWdpc3RlclBsdWdpbiIsInBsdWdpbiIsImNsb3NlQ3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsSWQiLCJkZWxldGVBbGxNb2RlbHMiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsY0FBTCxHQUFzQixFQUF0QjtXQUNLQyxlQUFMLEdBQXVCLEVBQXZCOzs7SUFFRkMsRUFBRSxDQUFFQyxTQUFGLEVBQWFDLFFBQWIsRUFBdUI7VUFDbkIsQ0FBQ0MsS0FBRCxFQUFRQyxTQUFSLElBQXFCSCxTQUFTLENBQUNJLEtBQVYsQ0FBZ0IsR0FBaEIsQ0FBekI7V0FDS1AsY0FBTCxDQUFvQkssS0FBcEIsSUFBNkIsS0FBS0wsY0FBTCxDQUFvQkssS0FBcEIsS0FDM0I7WUFBTTtPQURSOztVQUVJLENBQUNDLFNBQUwsRUFBZ0I7YUFDVE4sY0FBTCxDQUFvQkssS0FBcEIsRUFBMkIsRUFBM0IsRUFBK0JHLElBQS9CLENBQW9DSixRQUFwQztPQURGLE1BRU87YUFDQUosY0FBTCxDQUFvQkssS0FBcEIsRUFBMkJDLFNBQTNCLElBQXdDRixRQUF4Qzs7OztJQUdKSyxHQUFHLENBQUVOLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNwQixDQUFDQyxLQUFELEVBQVFDLFNBQVIsSUFBcUJILFNBQVMsQ0FBQ0ksS0FBVixDQUFnQixHQUFoQixDQUF6Qjs7VUFDSSxLQUFLUCxjQUFMLENBQW9CSyxLQUFwQixDQUFKLEVBQWdDO1lBQzFCLENBQUNDLFNBQUwsRUFBZ0I7Y0FDVixDQUFDRixRQUFMLEVBQWU7aUJBQ1JKLGNBQUwsQ0FBb0JLLEtBQXBCLEVBQTJCLEVBQTNCLElBQWlDLEVBQWpDO1dBREYsTUFFTztnQkFD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
