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
  }

  connectItem(item) {
    this.connectedItems[item.table.tableId] = this.connectedItems[item.table.tableId] || [];

    if (this.connectedItems[item.table.tableId].indexOf(item) === -1) {
      this.connectedItems[item.table.tableId].push(item);
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

  aggregate(attribute) {
    const options = {
      type: 'AggregatedTable',
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
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this2.iterate(limit)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedItem = _value;
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
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this3.iterate(limit)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedItem = _value2;
          const options = {
            type: 'TransposedTable',
            index: wrappedItem.index
          };
          yield _this3._getExistingTable(options) || _this3._deriveTable(options);
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

  connect(otherTableList) {
    const newTable = this.model.createTable({
      type: 'ConnectedTable'
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

class AggregatedTable extends SingleParentMixin(Table) {
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
    return '↦' + this._attribute;
  }

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
    return `ᵀ${this._index}`;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Pre-build the parent table's cache
      const parentTable = _this.parentTable;
      yield _awaitAsyncGenerator(parentTable.buildCache()); // Iterate the row's attributes as indexes

      const wrappedParent = parentTable._cache[parentTable._cacheLookup[_this._index]] || {
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



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  AggregatedTable: AggregatedTable,
  FacetedTable: FacetedTable,
  ConnectedTable: ConnectedTable,
  TransposedTable: TransposedTable
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

  aggregate(attribute) {
    return this._deriveNewClass(this.table.aggregate(attribute));
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

  edges(options) {
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

  pairwiseNeighborhood(options) {
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
  }) {
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


      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId; // Add this class to the source's / target's edgeClassIds

      this.model.classes[options.sourceClassId].edgeClassIds[this.classId] = true;
      this.model.classes[options.targetClassId].edgeClassIds[this.classId] = true; // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table

      options.sourceTableIds = sourceEdgeClass.targetTableIds.slice().reverse().concat([sourceEdgeClass.tableId]).concat(sourceEdgeClass.sourceTableIds);

      if (sourceEdgeClass.targetClassId === this.classId) {
        options.sourceTableIds.reverse();
      }

      options.targetTableIds = targetEdgeClass.targetTableIds.slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.sourceTableIds);

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
      thisHash = this.table.aggregate(attribute);
      sourceTableIds = [thisHash.tableId];
    }

    if (otherAttribute === null) {
      otherHash = otherNodeClass.table;
      targetTableIds = [];
    } else {
      otherHash = otherNodeClass.table.aggregate(otherAttribute);
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

  aggregate(attribute) {
    const newNodeClass = super.aggregate(attribute);
    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
    return newNodeClass;
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

  nodes(options) {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      yield* _asyncGeneratorDelegate(_asyncIterator(_this3.handleLimit(options, [_this3.sourceNodes(options), _this3.targetNodes(options)])), _awaitAsyncGenerator);
    })();
  }

  pairwiseEdges(options) {
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
    const edgeHash = edgeAttribute === null ? this.table : this.table.aggregate(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.table.aggregate(nodeAttribute);
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
    const edgeHash = edgeAttribute === null ? this.table : this.table.aggregate(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.table.aggregate(nodeAttribute);
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

  async getInstanceGraph(instances) {
    if (!instances) {
      // Without specified instances, just pick the first 5 from each node
      // and edge class
      instances = [];

      for (const classObj of Object.values(this.classes)) {
        if (classObj.type === 'Node' || classObj.type === 'Edge') {
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;

          var _iteratorError5;

          try {
            for (var _iterator5 = _asyncIterator(classObj.table.iterate(5)), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
              const item = _value5;
              instances.push(item);
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
    }

    const graph = {
      nodes: [],
      nodeLookup: {},
      edges: []
    };
    const edgeTableEntries = [];

    for (const instance of instances) {
      if (instance.type === 'Node') {
        graph.nodeLookup[instance.instanceId] = graph.nodes.length;
        graph.nodes.push({
          nodeInstance: instance,
          dummy: false
        });
      } else if (instance.type === 'Edge') {
        edgeTableEntries.push(instance);
      }
    }

    for (const edgeInstance of edgeTableEntries) {
      const sources = [];
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;

      var _iteratorError6;

      try {
        for (var _iterator6 = _asyncIterator(edgeInstance.sourceNodes()), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
          const source = _value6;

          if (graph.nodeLookup[source.instanceId] !== undefined) {
            sources.push(graph.nodeLookup[source.instanceId]);
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

      const targets = [];
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;

      var _iteratorError7;

      try {
        for (var _iterator7 = _asyncIterator(edgeInstance.targetNodes()), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
          const target = _value7;

          if (graph.nodeLookup[target.instanceId] !== undefined) {
            targets.push(graph.nodeLookup[target.instanceId]);
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

      if (sources.length === 0) {
        if (targets.length === 0) {
          // We have completely hanging edges, make dummy nodes for the
          // source and target
          graph.edges.push({
            edgeInstance,
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
          // The sources are hanging, but we have targets
          for (const target of targets) {
            graph.edges.push({
              edgeInstance,
              source: graph.nodes.length,
              target
            });
            graph.nodes.push({
              dummy: true
            });
          }
        }
      } else if (targets.length === 0) {
        // The targets are hanging, but we have sources
        for (const source of sources) {
          graph.edges.push({
            edgeInstance,
            source,
            target: graph.nodes.length
          });
          graph.nodes.push({
            dummy: true
          });
        }
      } else {
        // Neither the source, nor the target are hanging
        for (const source of sources) {
          for (const target of targets) {
            graph.edges.push({
              edgeInstance,
              source,
              target
            });
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
  constructor(FileReader, localStorage) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

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
    if (this.localStorage) {
      const models = {};

      for (const [modelId, model] of Object.entries(this.models)) {
        models[modelId] = model._toRawObject();
      }

      this.localStorage.setItem('origraph_models', JSON.stringify(models));
      this.trigger('save');
    }
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
var version = "0.2.1";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRmFjZXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UcmFuc3Bvc2VkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gfHxcbiAgICAgICAgeyAnJzogW10gfTtcbiAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0gPSBjYWxsYmFjaztcbiAgICAgIH1cbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10gPSBbXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICBjb25zdCBoYW5kbGVDYWxsYmFjayA9IGNhbGxiYWNrID0+IHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9O1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGZvciAoY29uc3QgbmFtZXNwYWNlIG9mIE9iamVjdC5rZXlzKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSkge1xuICAgICAgICAgIGlmIChuYW1lc3BhY2UgPT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uZm9yRWFjaChoYW5kbGVDYWxsYmFjayk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbmRsZUNhbGxiYWNrKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIHRoaXMudGFibGUgPSBvcHRpb25zLnRhYmxlO1xuICAgIGlmICh0aGlzLmluZGV4ID09PSB1bmRlZmluZWQgfHwgIXRoaXMudGFibGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggYW5kIHRhYmxlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLmNsYXNzT2JqID0gb3B0aW9ucy5jbGFzc09iaiB8fCBudWxsO1xuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IG9wdGlvbnMuY29ubmVjdGVkSXRlbXMgfHwge307XG4gIH1cbiAgY29ubmVjdEl0ZW0gKGl0ZW0pIHtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gPSB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gfHwgW107XG4gICAgaWYgKHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5pbmRleE9mKGl0ZW0pID09PSAtMSkge1xuICAgICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLnB1c2goaXRlbSk7XG4gICAgfVxuICB9XG4gIGRpc2Nvbm5lY3QgKCkge1xuICAgIGZvciAoY29uc3QgaXRlbUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNvbm5lY3RlZEl0ZW1zKSkge1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1MaXN0KSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gKGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXSB8fCBbXSkuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgIGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSB7fTtcbiAgfVxuICBnZXQgaW5zdGFuY2VJZCAoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMuY2xhc3NPYmouY2xhc3NJZH1fJHt0aGlzLmluZGV4fWA7XG4gIH1cbiAgZXF1YWxzIChpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zdGFuY2VJZCA9PT0gaXRlbS5pbnN0YW5jZUlkO1xuICB9XG4gIGFzeW5jICogaGFuZGxlTGltaXQgKG9wdGlvbnMsIGl0ZXJhdG9ycykge1xuICAgIGxldCBsaW1pdCA9IEluZmluaXR5O1xuICAgIGlmIChvcHRpb25zLmxpbWl0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIH1cbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBpdGVyYXRvciBvZiBpdGVyYXRvcnMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpdGVyYXRvcikge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICBpKys7XG4gICAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIC8vIEZpcnN0IG1ha2Ugc3VyZSB0aGF0IGFsbCB0aGUgdGFibGUgY2FjaGVzIGhhdmUgYmVlbiBmdWxseSBidWlsdCBhbmRcbiAgICAvLyBjb25uZWN0ZWRcbiAgICBhd2FpdCBQcm9taXNlLmFsbCh0YWJsZUlkcy5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5jbGFzc09iai5tb2RlbC50YWJsZXNbdGFibGVJZF0uYnVpbGRDYWNoZSgpO1xuICAgIH0pKTtcbiAgICB5aWVsZCAqIHRoaXMuX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcyk7XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9saW1pdFByb21pc2VzID0ge307XG5cbiAgICB0aGlzLml0ZXJhdGlvblJlc2V0ID0gbmV3IEVycm9yKCdJdGVyYXRpb24gcmVzZXQnKTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuX2F0dHJpYnV0ZXMsXG4gICAgICBkZXJpdmVkVGFibGVzOiB0aGlzLl9kZXJpdmVkVGFibGVzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge30sXG4gICAgICBzdXBwcmVzc2VkQXR0cmlidXRlczogdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMsXG4gICAgICBzdXBwcmVzc0luZGV4OiB0aGlzLl9zdXBwcmVzc0luZGV4LFxuICAgICAgYXR0cmlidXRlRmlsdGVyczoge30sXG4gICAgICBpbmRleEZpbHRlcjogKHRoaXMuX2luZGV4RmlsdGVyICYmIHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24odGhpcy5faW5kZXhGaWx0ZXIpKSB8fCBudWxsXG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgcmVzdWx0LmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAgcmVzdWx0LmF0dHJpYnV0ZUZpbHRlcnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlO1xuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbihgcmV0dXJuICR7c3RyaW5naWZpZWRGdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgfVxuICBkZWh5ZHJhdGVGdW5jdGlvbiAoZnVuYykge1xuICAgIGxldCBzdHJpbmdpZmllZEZ1bmMgPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgLy8gSXN0YW5idWwgYWRkcyBzb21lIGNvZGUgdG8gZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgY292ZXJhZ2UsIHRoYXQgZ2V0c1xuICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3R3YXJsb3N0L2lzdGFuYnVsL2lzc3Vlcy8zMTAjaXNzdWVjb21tZW50LTI3NDg4OTAyMlxuICAgIHN0cmluZ2lmaWVkRnVuYyA9IHN0cmluZ2lmaWVkRnVuYy5yZXBsYWNlKC9jb3ZfKC4rPylcXCtcXCtbLDtdPy9nLCAnJyk7XG4gICAgcmV0dXJuIHN0cmluZ2lmaWVkRnVuYztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIC8vIFRoZSBjYWNoZSBoYXMgYWxyZWFkeSBiZWVuIGJ1aWx0OyBqdXN0IGdyYWIgZGF0YSBmcm9tIGl0IGRpcmVjdGx5XG4gICAgICB5aWVsZCAqIHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZSAmJiB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoID49IGxpbWl0KSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQsIGJ1dCBpdCdzIGFscmVhZHkgbG9uZyBlbm91Z2ggdG8gc2F0aXNmeSB0aGlzXG4gICAgICAvLyByZXF1ZXN0XG4gICAgICB5aWVsZCAqIHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBjYWNoZSBpc24ndCBmaW5pc2hlZCBidWlsZGluZyAoYW5kIG1heWJlIGRpZG4ndCBldmVuIHN0YXJ0IHlldCk7XG4gICAgICAvLyBraWNrIGl0IG9mZiwgYW5kIHRoZW4gd2FpdCBmb3IgZW5vdWdoIGl0ZW1zIHRvIGJlIHByb2Nlc3NlZCB0byBzYXRpc2Z5XG4gICAgICAvLyB0aGUgbGltaXRcbiAgICAgIHRoaXMuYnVpbGRDYWNoZSgpO1xuICAgICAgeWllbGQgKiBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdID0gdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0gfHwgW107XG4gICAgICAgIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdLnB1c2goeyByZXNvbHZlLCByZWplY3QgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jIF9idWlsZENhY2hlIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgPSB7fTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUoKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgLy8gU29tZXRoaW5nIHdlbnQgd3JvbmcgdXBzdHJlYW0gKHNvbWV0aGluZyB0aGF0IHRoaXMuX2l0ZXJhdGVcbiAgICAgICAgLy8gZGVwZW5kcyBvbiB3YXMgcmVzZXQgb3IgdGhyZXcgYSByZWFsIGVycm9yKVxuICAgICAgICBpZiAoZXJyID09PSB0aGlzLml0ZXJhdGlvblJlc2V0KSB7XG4gICAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gcmVzZXQoKSB3YXMgY2FsbGVkIGJlZm9yZSB3ZSBjb3VsZCBmaW5pc2g7IHdlIG5lZWQgdG8gbGV0IGV2ZXJ5b25lXG4gICAgICAgIC8vIHRoYXQgd2FzIHdhaXRpbmcgb24gdXMga25vdyB0aGF0IHdlIGNhbid0IGNvbXBseVxuICAgICAgICB0aGlzLmhhbmRsZVJlc2V0KHJlamVjdCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghdGVtcC5kb25lKSB7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKHRlbXAudmFsdWUpKSB7XG4gICAgICAgICAgLy8gT2theSwgdGhpcyBpdGVtIHBhc3NlZCBhbGwgZmlsdGVycywgYW5kIGlzIHJlYWR5IHRvIGJlIHNlbnQgb3V0XG4gICAgICAgICAgLy8gaW50byB0aGUgd29ybGRcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbdGVtcC52YWx1ZS5pbmRleF0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoO1xuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZS5wdXNoKHRlbXAudmFsdWUpO1xuICAgICAgICAgIGkrKztcbiAgICAgICAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggZGF0YSBub3cgdG8gc2F0aXNmeSBhbnkgd2FpdGluZyByZXF1ZXN0c1xuICAgICAgICAgICAgaWYgKGxpbWl0IDw9IGkpIHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBEb25lIGl0ZXJhdGluZyEgV2UgY2FuIGdyYWR1YXRlIHRoZSBwYXJ0aWFsIGNhY2hlIC8gbG9va3VwcyBpbnRvXG4gICAgLy8gZmluaXNoZWQgb25lcywgYW5kIHNhdGlzZnkgYWxsIHRoZSByZXF1ZXN0c1xuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgdGhpcy5fY2FjaGVMb29rdXAgPSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdjYWNoZUJ1aWx0Jyk7XG4gICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gIH1cbiAgYnVpbGRDYWNoZSAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGU7XG4gICAgfSBlbHNlIGlmICghdGhpcy5fY2FjaGVQcm9taXNlKSB7XG4gICAgICB0aGlzLl9jYWNoZVByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vIFRoZSBzZXRUaW1lb3V0IGhlcmUgaXMgYWJzb2x1dGVseSBuZWNlc3NhcnksIG9yIHRoaXMuX2NhY2hlUHJvbWlzZVxuICAgICAgICAvLyB3b24ndCBiZSBzdG9yZWQgaW4gdGltZSBmb3IgdGhlIG5leHQgYnVpbGRDYWNoZSgpIGNhbGwgdGhhdCBjb21lc1xuICAgICAgICAvLyB0aHJvdWdoXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIHRoaXMuX2J1aWxkQ2FjaGUocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICBmb3IgKGNvbnN0IGRlcml2ZWRUYWJsZSBvZiB0aGlzLmRlcml2ZWRUYWJsZXMpIHtcbiAgICAgIGRlcml2ZWRUYWJsZS5yZXNldCgpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0Jyk7XG4gIH1cbiAgaGFuZGxlUmVzZXQgKHJlamVjdCkge1xuICAgIGZvciAoY29uc3QgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdLnJlamVjdCh0aGlzLml0ZXJhdGlvblJlc2V0KTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzO1xuICAgIH1cbiAgICByZWplY3QodGhpcy5pdGVyYXRpb25SZXNldCk7XG4gIH1cbiAgYXN5bmMgY291bnRSb3dzICgpIHtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpKS5sZW5ndGg7XG4gIH1cbiAgYXN5bmMgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gd3JhcHBlZEl0ZW0ucm93KSB7XG4gICAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGRlbGV0ZSB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBhd2FpdCBmdW5jKGF3YWl0IHdyYXBwZWRJdGVtLnJvd1thdHRyXSk7XG4gICAgICBpZiAoIWtlZXApIHsgYnJlYWs7IH1cbiAgICB9XG4gICAgaWYgKGtlZXApIHtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3cmFwcGVkSXRlbS5kaXNjb25uZWN0KCk7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaWx0ZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIGtlZXA7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGdldEluZGV4RGV0YWlscyAoKSB7XG4gICAgY29uc3QgZGV0YWlscyA9IHsgbmFtZTogbnVsbCB9O1xuICAgIGlmICh0aGlzLl9zdXBwcmVzc0luZGV4KSB7XG4gICAgICBkZXRhaWxzLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGRldGFpbHMuZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZGV0YWlscztcbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHt9O1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5leHBlY3RlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5vYnNlcnZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZGVyaXZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fYXR0cmlidXRlRmlsdGVycykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5nZXRBdHRyaWJ1dGVEZXRhaWxzKCkpO1xuICB9XG4gIGdldCBjdXJyZW50RGF0YSAoKSB7XG4gICAgLy8gQWxsb3cgcHJvYmluZyB0byBzZWUgd2hhdGV2ZXIgZGF0YSBoYXBwZW5zIHRvIGJlIGF2YWlsYWJsZVxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgW10sXG4gICAgICBsb29rdXA6IHRoaXMuX2NhY2hlTG9va3VwIHx8IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCB8fCB7fSxcbiAgICAgIGNvbXBsZXRlOiAhIXRoaXMuX2NhY2hlXG4gICAgfTtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYWRkRmlsdGVyIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pbmRleEZpbHRlciA9IGZ1bmM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIF9kZXJpdmVUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGUgPSB0aGlzLmRlcml2ZWRUYWJsZXMuZmluZCh0YWJsZU9iaiA9PiB7XG4gICAgICByZXR1cm4gT2JqZWN0LmVudHJpZXMob3B0aW9ucykuZXZlcnkoKFtvcHRpb25OYW1lLCBvcHRpb25WYWx1ZV0pID0+IHtcbiAgICAgICAgaWYgKG9wdGlvbk5hbWUgPT09ICd0eXBlJykge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmpbJ18nICsgb3B0aW9uTmFtZV0gPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gKGV4aXN0aW5nVGFibGUgJiYgdGhpcy5tb2RlbC50YWJsZXNbZXhpc3RpbmdUYWJsZS50YWJsZUlkXSkgfHwgbnVsbDtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnQWdncmVnYXRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHZhbHVlcy5tYXAodmFsdWUgPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgdmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlLCBsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgY29uc3QgdmFsdWVzID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUobGltaXQpKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9O1xuICAgICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gaW5kZXhlcy5tYXAoaW5kZXggPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUobGltaXQpKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXg6IHdyYXBwZWRJdGVtLmluZGV4XG4gICAgICB9O1xuICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJ1xuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIGdldCBjbGFzc09iaiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZSA9PT0gdGhpcztcbiAgICB9KTtcbiAgfVxuICBnZXQgcGFyZW50VGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKTtcbiAgfVxuICBnZXQgZGVyaXZlZFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXTtcbiAgICB9KTtcbiAgfVxuICBnZXQgaW5Vc2UgKCkge1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5zb21lKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZUlkID09PSB0aGlzLnRhYmxlSWQgfHxcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMSB8fFxuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUYWJsZSwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVGFibGUvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IFtdO1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9uYW1lO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aXJlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBBZ2dyZWdhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiAn4oamJyArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgLy8gV2Ugb3ZlcnJpZGUgX2J1aWxkQ2FjaGUgYmVjYXVzZSB3ZSBkb24ndCBhY3R1YWxseSB3YW50IHRvIGNhbGwgX2ZpbmlzaEl0ZW1cbiAgICAvLyB1bnRpbCBhbGwgdW5pcXVlIHZhbHVlcyBoYXZlIGJlZW4gc2VlblxuICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZSA9IFtdO1xuICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cCA9IHt9O1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IFtdO1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZSgpO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIFNvbWV0aGluZyB3ZW50IHdyb25nIHVwc3RyZWFtIChzb21ldGhpbmcgdGhhdCB0aGlzLl9pdGVyYXRlXG4gICAgICAgIC8vIGRlcGVuZHMgb24gd2FzIHJlc2V0IG9yIHRocmV3IGEgcmVhbCBlcnJvcilcbiAgICAgICAgaWYgKGVyciA9PT0gdGhpcy5pdGVyYXRpb25SZXNldCkge1xuICAgICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbdGVtcC52YWx1ZS5pbmRleF0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gT2theSwgbm93IHdlJ3ZlIHNlZW4gZXZlcnl0aGluZzsgd2UgY2FuIGNhbGwgX2ZpbmlzaEl0ZW0gb24gZWFjaCBvZiB0aGVcbiAgICAvLyB1bmlxdWUgdmFsdWVzXG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdGhpcy5fdW5maW5pc2hlZENhY2hlKSB7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh2YWx1ZSkpIHtcbiAgICAgICAgLy8gT2theSwgdGhpcyBpdGVtIHBhc3NlZCBhbGwgZmlsdGVycywgYW5kIGlzIHJlYWR5IHRvIGJlIHNlbnQgb3V0XG4gICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt2YWx1ZS5pbmRleF0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh2YWx1ZSk7XG4gICAgICAgIGkrKztcbiAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggZGF0YSBub3cgdG8gc2F0aXNmeSBhbnkgd2FpdGluZyByZXF1ZXN0c1xuICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUodGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwO1xuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgdGhpcy5fY2FjaGVMb29rdXAgPSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdjYWNoZUJ1aWx0Jyk7XG4gICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gU3RyaW5nKGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0pO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldCFcbiAgICAgICAgdGhyb3cgdGhpcy5pdGVyYXRpb25SZXNldDtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3VuZmluaXNoZWRDYWNoZVt0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbaW5kZXhdXTtcbiAgICAgICAgZXhpc3RpbmdJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB3cmFwcGVkUGFyZW50LmNvbm5lY3RJdGVtKGV4aXN0aW5nSXRlbSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQWdncmVnYXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBGYWNldGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSB8fCAhdGhpcy5fdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGUgKyB0aGlzLl92YWx1ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGBbJHt0aGlzLl92YWx1ZX1dYDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBpZiAoYXdhaXQgd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gTm9ybWFsIGZhY2V0aW5nIGp1c3QgZ2l2ZXMgYSBzdWJzZXQgb2YgdGhlIG9yaWdpbmFsIHRhYmxlXG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IE9iamVjdC5hc3NpZ24oe30sIHdyYXBwZWRQYXJlbnQucm93KSxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmFjZXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBUcmFuc3Bvc2VkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2luZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5faW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5pbmRleCA9IHRoaXMuX2luZGV4O1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5faW5kZXg7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBg4bWAJHt0aGlzLl9pbmRleH1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIC8vIFByZS1idWlsZCB0aGUgcGFyZW50IHRhYmxlJ3MgY2FjaGVcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgYXdhaXQgcGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuXG4gICAgLy8gSXRlcmF0ZSB0aGUgcm93J3MgYXR0cmlidXRlcyBhcyBpbmRleGVzXG4gICAgY29uc3Qgd3JhcHBlZFBhcmVudCA9IHBhcmVudFRhYmxlLl9jYWNoZVtwYXJlbnRUYWJsZS5fY2FjaGVMb29rdXBbdGhpcy5faW5kZXhdXSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGNvbnN0IFsgaW5kZXgsIHZhbHVlIF0gb2YgT2JqZWN0LmVudHJpZXMod3JhcHBlZFBhcmVudC5yb3cpKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICByb3c6IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgPyB2YWx1ZSA6IHsgdmFsdWUgfSxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBUcmFuc3Bvc2VkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIENvbm5lY3RlZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCfiqK8nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignLCcpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIERvbid0IHRyeSB0byBjb25uZWN0IHZhbHVlcyB1bnRpbCBhbGwgb2YgdGhlIHBhcmVudCB0YWJsZXMnIGNhY2hlcyBhcmVcbiAgICAvLyBidWlsdDsgVE9ETzogbWlnaHQgYmUgYWJsZSB0byBkbyBzb21ldGhpbmcgbW9yZSByZXNwb25zaXZlIGhlcmU/XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwocGFyZW50VGFibGVzLm1hcChwVGFibGUgPT4gcFRhYmxlLmJ1aWxkQ2FjaGUoKSkpO1xuXG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGVMb29rdXApIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cCkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldCwgbWVhbmluZyB3ZSBuZWVkIHRvIHJlc2V0IGFzIHdlbGxcbiAgICAgICAgdGhyb3cgdGhpcy5pdGVyYXRpb25SZXNldDtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAvLyBObyBtYXRjaCBpbiBvbmUgb2YgdGhlIG90aGVyIHRhYmxlczsgb21pdCB0aGlzIGl0ZW1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBhZGQgZWFjaCBwYXJlbnQgdGFibGVzJyBrZXlzIGFzIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBwYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLl9jYWNoZVt0YWJsZS5fY2FjaGVMb29rdXBbaW5kZXhdXSlcbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgKyB0aGlzLmNsYXNzTmFtZTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlTmV3Q2xhc3MgKG5ld1RhYmxlLCB0eXBlID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGVcbiAgICB9KTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRUcmFuc3Bvc2UoaW5kZXhlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlICgpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlblRyYW5zcG9zZSgpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0U2FtcGxlR3JhcGggKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnJvb3RDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuZ2V0U2FtcGxlR3JhcGgob3B0aW9ucyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAob3B0aW9ucykge1xuICAgIGxldCBlZGdlSWRzID0gb3B0aW9ucy5jbGFzc2VzXG4gICAgICA/IG9wdGlvbnMuY2xhc3Nlcy5tYXAoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NJZClcbiAgICAgIDogb3B0aW9ucy5jbGFzc0lkcyB8fCBPYmplY3Qua2V5cyh0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3QgaXRlcmF0b3JzID0gW107XG4gICAgZm9yIChjb25zdCBlZGdlSWQgb2YgZWRnZUlkcykge1xuICAgICAgaWYgKCF0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tlZGdlSWRdKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5jbGFzc09iai5tb2RlbC5jbGFzc2VzW2VkZ2VJZF07XG4gICAgICBjb25zdCByb2xlID0gdGhpcy5jbGFzc09iai5nZXRFZGdlUm9sZShlZGdlQ2xhc3MpO1xuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAnc291cmNlJykge1xuICAgICAgICBjb25zdCB0YWJsZUlkcyA9IGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGl0ZXJhdG9ycy5wdXNoKHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSk7XG4gICAgICB9XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICd0YXJnZXQnKSB7XG4gICAgICAgIGNvbnN0IHRhYmxlSWRzID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgaXRlcmF0b3JzLnB1c2godGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIGl0ZXJhdG9ycyk7XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZU5laWdoYm9yaG9vZCAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiB0aGlzLmVkZ2VzKG9wdGlvbnMpKSB7XG4gICAgICB5aWVsZCAqIGVkZ2UucGFpcndpc2VFZGdlcyhvcHRpb25zKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBOb2RlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgfVxuICAqIGVkZ2VDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZ2V0RWRnZVJvbGUgKGVkZ2VDbGFzcykge1xuICAgIGlmICghdGhpcy5lZGdlQ2xhc3NJZHNbZWRnZUNsYXNzLmNsYXNzSWRdKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIHJldHVybiAnYm90aCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3NvdXJjZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICByZXR1cm4gJ3RhcmdldCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW50ZXJuYWwgbWlzbWF0Y2ggYmV0d2VlbiBub2RlIGFuZCBlZGdlIGNsYXNzSWRzYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IE5vZGVXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKHsgYXV0b2Nvbm5lY3QgPSBmYWxzZSB9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmICghYXV0b2Nvbm5lY3QgfHwgZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgLy8gQXJlIHdlIHRoZSBzb3VyY2Ugb3IgdGFyZ2V0IG9mIHRoZSBleGlzdGluZyBlZGdlIChpbnRlcm5hbGx5LCBpbiB0ZXJtc1xuICAgICAgLy8gb2Ygc291cmNlSWQgLyB0YXJnZXRJZCwgbm90IGVkZ2VDbGFzcy5kaXJlY3Rpb24pP1xuICAgICAgY29uc3QgaXNTb3VyY2UgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkO1xuXG4gICAgICAvLyBBcyB3ZSdyZSBjb252ZXJ0ZWQgdG8gYW4gZWRnZSwgb3VyIG5ldyByZXN1bHRpbmcgc291cmNlIEFORCB0YXJnZXRcbiAgICAgIC8vIHNob3VsZCBiZSB3aGF0ZXZlciBpcyBhdCB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcyAoaWYgYW55dGhpbmcpXG4gICAgICBpZiAoaXNTb3VyY2UpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAvLyBPa2F5LCB3ZSd2ZSBnb3QgdHdvIGVkZ2VzLCBzbyB0aGlzIGlzIGEgbGl0dGxlIG1vcmUgc3RyYWlnaHRmb3J3YXJkXG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgLy8gQWRkIHRoaXMgY2xhc3MgdG8gdGhlIHNvdXJjZSdzIC8gdGFyZ2V0J3MgZWRnZUNsYXNzSWRzXG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBleGlzdGluZyBlZGdlIGNsYXNzZXMgZnJvbSB0aGUgbmV3IChub3cgZWRnZSkgY2xhc3NcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfVxuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgbGV0IHRoaXNIYXNoLCBvdGhlckhhc2gsIHNvdXJjZVRhYmxlSWRzLCB0YXJnZXRUYWJsZUlkcztcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGU7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFsgdGhpc0hhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBpZiAob3RoZXJBdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGUuYWdncmVnYXRlKG90aGVyQXR0cmlidXRlKTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gWyBvdGhlckhhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHNcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gc3VwZXIuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gICAgdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgIGF0dHJpYnV0ZSxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBkaXNjb25uZWN0QWxsRWRnZXMgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiB0aGlzLmNvbm5lY3RlZENsYXNzZXMoKSkge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2Uob3B0aW9ucyk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogc291cmNlTm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlVGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZF0udGFibGVJZDtcbiAgICBjb25zdCB0YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHMuY29uY2F0KFsgc291cmNlVGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkXS50YWJsZUlkO1xuICAgIGNvbnN0IHRhYmxlSWRzID0gdGhpcy5jbGFzc09iai50YXJnZXRUYWJsZUlkcy5jb25jYXQoWyB0YXJnZXRUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIG5vZGVzIChvcHRpb25zKSB7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucyksXG4gICAgICB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZUVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgICB5aWVsZCB7IHNvdXJjZSwgZWRnZTogdGhpcywgdGFyZ2V0IH07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHxcbiAgICAgICgodGhpcy5zb3VyY2VDbGFzcyAmJiB0aGlzLnNvdXJjZUNsYXNzLmNsYXNzTmFtZSkgfHwgJz8nKSArXG4gICAgICAnLScgK1xuICAgICAgKCh0aGlzLnRhcmdldENsYXNzICYmIHRoaXMudGFyZ2V0Q2xhc3MuY2xhc3NOYW1lKSB8fCAnPycpO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy50YWJsZS5hZ2dyZWdhdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLmFnZ3JlZ2F0ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1RhcmdldENsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcblxuY29uc3QgREFUQUxJQl9GT1JNQVRTID0ge1xuICAnanNvbic6ICdqc29uJyxcbiAgJ2Nzdic6ICdjc3YnLFxuICAndHN2JzogJ3RzdicsXG4gICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICd0cmVlanNvbic6ICd0cmVlanNvbidcbn07XG5cbmNsYXNzIE5ldHdvcmtNb2RlbCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBvcmlncmFwaCxcbiAgICBtb2RlbElkLFxuICAgIG5hbWUgPSBtb2RlbElkLFxuICAgIGFubm90YXRpb25zID0ge30sXG4gICAgY2xhc3NlcyA9IHt9LFxuICAgIHRhYmxlcyA9IHt9XG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX29yaWdyYXBoID0gb3JpZ3JhcGg7XG4gICAgdGhpcy5tb2RlbElkID0gbW9kZWxJZDtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9ucztcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcbiAgICB0aGlzLnRhYmxlcyA9IHt9O1xuXG4gICAgdGhpcy5fbmV4dENsYXNzSWQgPSAxO1xuICAgIHRoaXMuX25leHRUYWJsZUlkID0gMTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhjbGFzc2VzKSkge1xuICAgICAgdGhpcy5jbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gdGhpcy5oeWRyYXRlKGNsYXNzT2JqLCBDTEFTU0VTKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICAgIHRoaXMudGFibGVzW3RhYmxlLnRhYmxlSWRdID0gdGhpcy5oeWRyYXRlKHRhYmxlLCBUQUJMRVMpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ3VwZGF0ZScsICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zYXZlVGltZW91dCk7XG4gICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vcmlncmFwaC5zYXZlKCk7XG4gICAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuICAgICAgfSwgMCk7XG4gICAgfSk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBjbGFzc2VzID0ge307XG4gICAgY29uc3QgdGFibGVzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0udHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXSA9IHRhYmxlT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdLnR5cGUgPSB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWxJZDogdGhpcy5tb2RlbElkLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnMsXG4gICAgICBjbGFzc2VzLFxuICAgICAgdGFibGVzXG4gICAgfTtcbiAgfVxuICBnZXQgdW5zYXZlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NhdmVUaW1lb3V0ICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgaHlkcmF0ZSAocmF3T2JqZWN0LCBUWVBFUykge1xuICAgIHJhd09iamVjdC5tb2RlbCA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBUWVBFU1tyYXdPYmplY3QudHlwZV0ocmF3T2JqZWN0KTtcbiAgfVxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIHdoaWxlICghb3B0aW9ucy50YWJsZUlkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSkpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7dGhpcy5fbmV4dFRhYmxlSWR9YDtcbiAgICAgIHRoaXMuX25leHRUYWJsZUlkICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVEFCTEVTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgZmluZENsYXNzIChjbGFzc05hbWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NOYW1lID09PSBjbGFzc05hbWUpO1xuICB9XG4gIHJlbmFtZSAobmV3TmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhbm5vdGF0ZSAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5fb3JpZ3JhcGguZGVsZXRlTW9kZWwodGhpcy5tb2RlbElkKTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX29yaWdyYXBoLm1vZGVsc1t0aGlzLm1vZGVsSWRdO1xuICB9XG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseWApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5fb3JpZ3JhcGguRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24sIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICghZXh0ZW5zaW9uKSB7XG4gICAgICBleHRlbnNpb24gPSBtaW1lLmV4dGVuc2lvbihtaW1lLmxvb2t1cChuYW1lKSk7XG4gICAgfVxuICAgIGlmIChEQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgZGF0YSA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZSh7IG5hbWUsIGRhdGEsIGF0dHJpYnV0ZXMgfSk7XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKCFlcnIuaW5Vc2UpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyBnZXRTYW1wbGVHcmFwaCAoe1xuICAgIHJvb3RDbGFzcyA9IG51bGwsXG4gICAgYnJhbmNoTGltaXQgPSBJbmZpbml0eSxcbiAgICBub2RlTGltaXQgPSBJbmZpbml0eSxcbiAgICBlZGdlTGltaXQgPSBJbmZpbml0eSxcbiAgICB0cmlwbGVMaW1pdCA9IEluZmluaXR5XG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IHNhbXBsZUdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW10sXG4gICAgICBlZGdlTG9va3VwOiB7fSxcbiAgICAgIGxpbmtzOiBbXVxuICAgIH07XG5cbiAgICBsZXQgbnVtVHJpcGxlcyA9IDA7XG4gICAgY29uc3QgYWRkTm9kZSA9IG5vZGUgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGgubm9kZXMucHVzaChub2RlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGggPD0gbm9kZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkRWRnZSA9IGVkZ2UgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLmVkZ2VzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGguZWRnZXMucHVzaChlZGdlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5lZGdlcy5sZW5ndGggPD0gZWRnZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkVHJpcGxlID0gKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSA9PiB7XG4gICAgICBpZiAoYWRkTm9kZShzb3VyY2UpICYmIGFkZE5vZGUodGFyZ2V0KSAmJiBhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogc2FtcGxlR3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSxcbiAgICAgICAgICBlZGdlOiBzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF1cbiAgICAgICAgfSk7XG4gICAgICAgIG51bVRyaXBsZXMrKztcbiAgICAgICAgcmV0dXJuIG51bVRyaXBsZXMgPD0gdHJpcGxlTGltaXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxldCBjbGFzc0xpc3QgPSByb290Q2xhc3MgPyBbcm9vdENsYXNzXSA6IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGROb2RlKG5vZGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIGVkZ2UsIHRhcmdldCB9IG9mIG5vZGUucGFpcndpc2VOZWlnaGJvcmhvb2QoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmICghYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIHRhcmdldCB9IG9mIGVkZ2UucGFpcndpc2VFZGdlcyh7IGxpbWl0OiBicmFuY2hMaW1pdCB9KSkge1xuICAgICAgICAgICAgaWYgKCFhZGRUcmlwbGUoc291cmNlLCBlZGdlLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICB9XG4gIGFzeW5jIGdldEluc3RhbmNlR3JhcGggKGluc3RhbmNlcykge1xuICAgIGlmICghaW5zdGFuY2VzKSB7XG4gICAgICAvLyBXaXRob3V0IHNwZWNpZmllZCBpbnN0YW5jZXMsIGp1c3QgcGljayB0aGUgZmlyc3QgNSBmcm9tIGVhY2ggbm9kZVxuICAgICAgLy8gYW5kIGVkZ2UgY2xhc3NcbiAgICAgIGluc3RhbmNlcyA9IFtdO1xuICAgICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyB8fCBjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSg1KSkge1xuICAgICAgICAgICAgaW5zdGFuY2VzLnB1c2goaXRlbSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBub2RlTG9va3VwOiB7fSxcbiAgICAgIGVkZ2VzOiBbXVxuICAgIH07XG4gICAgY29uc3QgZWRnZVRhYmxlRW50cmllcyA9IFtdO1xuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgaW5zdGFuY2VzKSB7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGdyYXBoLm5vZGVMb29rdXBbaW5zdGFuY2UuaW5zdGFuY2VJZF0gPSBncmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICAgIG5vZGVJbnN0YW5jZTogaW5zdGFuY2UsXG4gICAgICAgICAgZHVtbXk6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZVRhYmxlRW50cmllcy5wdXNoKGluc3RhbmNlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBlZGdlSW5zdGFuY2Ugb2YgZWRnZVRhYmxlRW50cmllcykge1xuICAgICAgY29uc3Qgc291cmNlcyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZUluc3RhbmNlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBzb3VyY2VzLnB1c2goZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCB0YXJnZXRzID0gW107XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlSW5zdGFuY2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRhcmdldHMucHVzaChncmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzb3VyY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBpZiAodGFyZ2V0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAvLyBXZSBoYXZlIGNvbXBsZXRlbHkgaGFuZ2luZyBlZGdlcywgbWFrZSBkdW1teSBub2RlcyBmb3IgdGhlXG4gICAgICAgICAgLy8gc291cmNlIGFuZCB0YXJnZXRcbiAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGggKyAxXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUaGUgc291cmNlcyBhcmUgaGFuZ2luZywgYnV0IHdlIGhhdmUgdGFyZ2V0c1xuICAgICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgICB0YXJnZXRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0YXJnZXRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBUaGUgdGFyZ2V0cyBhcmUgaGFuZ2luZywgYnV0IHdlIGhhdmUgc291cmNlc1xuICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVpdGhlciB0aGUgc291cmNlLCBub3IgdGhlIHRhcmdldCBhcmUgaGFuZ2luZ1xuICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgICAgc291cmNlLFxuICAgICAgICAgICAgICB0YXJnZXRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TmV0d29ya01vZGVsR3JhcGggKHtcbiAgICByYXcgPSB0cnVlLFxuICAgIGluY2x1ZGVEdW1taWVzID0gZmFsc2UsXG4gICAgY2xhc3NMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc2VzID0gW107XG4gICAgbGV0IGdyYXBoID0ge1xuICAgICAgY2xhc3NlczogW10sXG4gICAgICBjbGFzc0xvb2t1cDoge30sXG4gICAgICBjbGFzc0Nvbm5lY3Rpb25zOiBbXVxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgLy8gQWRkIGFuZCBpbmRleCB0aGUgY2xhc3MgYXMgYSBub2RlXG4gICAgICBjb25zdCBjbGFzc1NwZWMgPSByYXcgPyBjbGFzc09iai5fdG9SYXdPYmplY3QoKSA6IHsgY2xhc3NPYmogfTtcbiAgICAgIGNsYXNzU3BlYy50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLmNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gZ3JhcGguY2xhc3Nlcy5sZW5ndGg7XG4gICAgICBncmFwaC5jbGFzc2VzLnB1c2goY2xhc3NTcGVjKTtcblxuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAvLyBTdG9yZSB0aGUgZWRnZSBjbGFzcyBzbyB3ZSBjYW4gY3JlYXRlIGNsYXNzQ29ubmVjdGlvbnMgbGF0ZXJcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyAmJiBpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBub2RlXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2NsYXNzT2JqLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoIC0gMSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBmYWxzZSxcbiAgICAgICAgICBsb2NhdGlvbjogJ25vZGUnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgZXhpc3RpbmcgY2xhc3NDb25uZWN0aW9uc1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIGVkZ2VDbGFzc2VzKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgc291cmNlIG5vZGUgY2xhc3MgdG8gdGhlIGVkZ2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWR9PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJ1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgc291cmNlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGBkdW1teT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgZWRnZSBjbGFzcyB0byB0aGUgdGFyZ2V0IG5vZGUgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PiR7ZWRnZUNsYXNzLnRhcmdldENsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0J1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgdGFyZ2V0IGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0JyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldFRhYmxlRGVwZW5kZW5jeUdyYXBoICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIHRhYmxlczogW10sXG4gICAgICB0YWJsZUxvb2t1cDoge30sXG4gICAgICB0YWJsZUxpbmtzOiBbXVxuICAgIH07XG4gICAgY29uc3QgdGFibGVMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcyk7XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGNvbnN0IHRhYmxlU3BlYyA9IHRhYmxlLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVTcGVjLnR5cGUgPSB0YWJsZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBncmFwaC50YWJsZXMubGVuZ3RoO1xuICAgICAgZ3JhcGgudGFibGVzLnB1c2godGFibGVTcGVjKTtcbiAgICB9XG4gICAgLy8gRmlsbCB0aGUgZ3JhcGggd2l0aCBsaW5rcyBiYXNlZCBvbiBwYXJlbnRUYWJsZXMuLi5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0YWJsZS5wYXJlbnRUYWJsZXMpIHtcbiAgICAgICAgZ3JhcGgudGFibGVMaW5rcy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLnRhYmxlTG9va3VwW3BhcmVudFRhYmxlLnRhYmxlSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRNb2RlbER1bXAgKCkge1xuICAgIC8vIEJlY2F1c2Ugb2JqZWN0IGtleSBvcmRlcnMgYXJlbid0IGRldGVybWluaXN0aWMsIGl0IGNhbiBiZSBwcm9ibGVtYXRpY1xuICAgIC8vIGZvciB0ZXN0aW5nIChiZWNhdXNlIGlkcyBjYW4gcmFuZG9tbHkgY2hhbmdlIGZyb20gdGVzdCBydW4gdG8gdGVzdCBydW4pLlxuICAgIC8vIFRoaXMgZnVuY3Rpb24gc29ydHMgZWFjaCBrZXksIGFuZCBqdXN0IHJlcGxhY2VzIElEcyB3aXRoIGluZGV4IG51bWJlcnNcbiAgICBjb25zdCByYXdPYmogPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHRoaXMuX3RvUmF3T2JqZWN0KCkpKTtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBjbGFzc2VzOiBPYmplY3QudmFsdWVzKHJhd09iai5jbGFzc2VzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy5jbGFzc2VzW2EuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLmNsYXNzZXNbYi5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzcyBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHRhYmxlczogT2JqZWN0LnZhbHVlcyhyYXdPYmoudGFibGVzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy50YWJsZXNbYS50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMudGFibGVzW2IudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgdGFibGUgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9O1xuICAgIGNvbnN0IGNsYXNzTG9va3VwID0ge307XG4gICAgY29uc3QgdGFibGVMb29rdXAgPSB7fTtcbiAgICByZXN1bHQuY2xhc3Nlcy5mb3JFYWNoKChjbGFzc09iaiwgaW5kZXgpID0+IHtcbiAgICAgIGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gaW5kZXg7XG4gICAgfSk7XG4gICAgcmVzdWx0LnRhYmxlcy5mb3JFYWNoKCh0YWJsZSwgaW5kZXgpID0+IHtcbiAgICAgIHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gaW5kZXg7XG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHJlc3VsdC50YWJsZXMpIHtcbiAgICAgIHRhYmxlLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXTtcbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKSkge1xuICAgICAgICB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlTG9va3VwW3RhYmxlSWRdXSA9IHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICAgIGRlbGV0ZSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRhYmxlLmRhdGE7IC8vIGRvbid0IGluY2x1ZGUgYW55IG9mIHRoZSBkYXRhOyB3ZSBqdXN0IHdhbnQgdGhlIG1vZGVsIHN0cnVjdHVyZVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIHJlc3VsdC5jbGFzc2VzKSB7XG4gICAgICBjbGFzc09iai5jbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF07XG4gICAgICBjbGFzc09iai50YWJsZUlkID0gdGFibGVMb29rdXBbY2xhc3NPYmoudGFibGVJZF07XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouc291cmNlQ2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlVGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMgPSBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai50YXJnZXRDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMgPSBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGNsYXNzSWQgb2YgT2JqZWN0LmtleXMoY2xhc3NPYmouZWRnZUNsYXNzSWRzIHx8IHt9KSkge1xuICAgICAgICBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NMb29rdXBbY2xhc3NJZF1dID0gY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgICBkZWxldGUgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGNyZWF0ZVNjaGVtYU1vZGVsICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHRoaXMuZ2V0TW9kZWxEdW1wKCk7XG5cbiAgICBncmFwaC50YWJsZXMuZm9yRWFjaCh0YWJsZSA9PiB7XG4gICAgICB0YWJsZS5kZXJpdmVkVGFibGVzID0gT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcyk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZU1vZGVsKHsgbmFtZTogdGhpcy5uYW1lICsgJ19zY2hlbWEnIH0pO1xuICAgIGNvbnN0IHJhdyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLFxuICAgICAgbmFtZTogJ1JhdyBEdW1wJ1xuICAgIH0pO1xuICAgIGxldCBbIGNsYXNzZXMsIHRhYmxlcyBdID0gcmF3LmNsb3NlZFRyYW5zcG9zZShbJ2NsYXNzZXMnLCAndGFibGVzJ10pO1xuICAgIGNsYXNzZXMgPSBjbGFzc2VzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBjbGFzc2VzLnNldENsYXNzTmFtZSgnQ2xhc3NlcycpO1xuICAgIHJhdy5kZWxldGUoKTtcblxuICAgIGNvbnN0IHNvdXJjZUNsYXNzZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogY2xhc3NlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3NvdXJjZUNsYXNzSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBzb3VyY2VDbGFzc2VzLnNldENsYXNzTmFtZSgnU291cmNlIENsYXNzJyk7XG4gICAgc291cmNlQ2xhc3Nlcy50b2dnbGVEaXJlY3Rpb24oKTtcbiAgICBjb25zdCB0YXJnZXRDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YXJnZXRDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgdGFyZ2V0Q2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1RhcmdldCBDbGFzcycpO1xuICAgIHRhcmdldENsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICB0YWJsZXMgPSB0YWJsZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgIHRhYmxlcy5zZXRDbGFzc05hbWUoJ1RhYmxlcycpO1xuXG4gICAgY29uc3QgdGFibGVEZXBlbmRlbmNpZXMgPSB0YWJsZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdkZXJpdmVkVGFibGVzJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMuc2V0Q2xhc3NOYW1lKCdJcyBQYXJlbnQgT2YnKTtcbiAgICB0YWJsZURlcGVuZGVuY2llcy50b2dnbGVEaXJlY3Rpb24oKTtcblxuICAgIGNvbnN0IGNvcmVUYWJsZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAndGFibGVJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIGNvcmVUYWJsZXMuc2V0Q2xhc3NOYW1lKCdDb3JlIFRhYmxlJyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOZXR3b3JrTW9kZWw7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBOZXR3b3JrTW9kZWwgZnJvbSAnLi9Db21tb24vTmV0d29ya01vZGVsLmpzJztcblxubGV0IE5FWFRfTU9ERUxfSUQgPSAxO1xuXG5jbGFzcyBPcmlncmFwaCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuXG4gICAgdGhpcy5wbHVnaW5zID0ge307XG5cbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIGxldCBleGlzdGluZ01vZGVscyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ29yaWdyYXBoX21vZGVscycpO1xuICAgIGlmIChleGlzdGluZ01vZGVscykge1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKEpTT04ucGFyc2UoZXhpc3RpbmdNb2RlbHMpKSkge1xuICAgICAgICBtb2RlbC5vcmlncmFwaCA9IHRoaXM7XG4gICAgICAgIHRoaXMubW9kZWxzW21vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChtb2RlbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICB9XG4gIHJlZ2lzdGVyUGx1Z2luIChuYW1lLCBwbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbnNbbmFtZV0gPSBwbHVnaW47XG4gIH1cbiAgc2F2ZSAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgfVxuICBjbG9zZUN1cnJlbnRNb2RlbCAoKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgZ2V0IGN1cnJlbnRNb2RlbCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW3RoaXMuX2N1cnJlbnRNb2RlbElkXSB8fCBudWxsO1xuICB9XG4gIHNldCBjdXJyZW50TW9kZWwgKG1vZGVsKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBtb2RlbCA/IG1vZGVsLm1vZGVsSWQgOiBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBvcmlncmFwaCA9IG5ldyBPcmlncmFwaCh3aW5kb3cuRmlsZVJlYWRlciwgd2luZG93LmxvY2FsU3RvcmFnZSk7XG5vcmlncmFwaC52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG9yaWdyYXBoO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJfZXZlbnRIYW5kbGVycyIsIl9zdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJldmVudCIsIm5hbWVzcGFjZSIsInNwbGl0IiwicHVzaCIsIm9mZiIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiaGFuZGxlQ2FsbGJhY2siLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiR2VuZXJpY1dyYXBwZXIiLCJvcHRpb25zIiwidGFibGUiLCJ1bmRlZmluZWQiLCJFcnJvciIsImNsYXNzT2JqIiwicm93IiwiY29ubmVjdGVkSXRlbXMiLCJjb25uZWN0SXRlbSIsIml0ZW0iLCJ0YWJsZUlkIiwiZGlzY29ubmVjdCIsIml0ZW1MaXN0IiwidmFsdWVzIiwiaW5zdGFuY2VJZCIsImNsYXNzSWQiLCJlcXVhbHMiLCJoYW5kbGVMaW1pdCIsIml0ZXJhdG9ycyIsImxpbWl0IiwiSW5maW5pdHkiLCJpdGVyYXRvciIsIml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInRhYmxlSWRzIiwiUHJvbWlzZSIsImFsbCIsIm1hcCIsIm1vZGVsIiwidGFibGVzIiwiYnVpbGRDYWNoZSIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJsZW5ndGgiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX2xpbWl0UHJvbWlzZXMiLCJpdGVyYXRpb25SZXNldCIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiZ2V0U29ydEhhc2giLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiaXRlcmF0ZSIsIl9jYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJyZXNvbHZlIiwicmVqZWN0IiwiX2l0ZXJhdGUiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGVMb29rdXAiLCJkb25lIiwibmV4dCIsImVyciIsImhhbmRsZVJlc2V0IiwiX2ZpbmlzaEl0ZW0iLCJOdW1iZXIiLCJfY2FjaGVMb29rdXAiLCJfY2FjaGVQcm9taXNlIiwicmVzZXQiLCJkZXJpdmVkVGFibGUiLCJjb3VudFJvd3MiLCJ3cmFwcGVkSXRlbSIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZ2V0SW5kZXhEZXRhaWxzIiwiZGV0YWlscyIsInN1cHByZXNzZWQiLCJmaWx0ZXJlZCIsImdldEF0dHJpYnV0ZURldGFpbHMiLCJhbGxBdHRycyIsImV4cGVjdGVkIiwib2JzZXJ2ZWQiLCJkZXJpdmVkIiwiY3VycmVudERhdGEiLCJkYXRhIiwibG9va3VwIiwiY29tcGxldGUiLCJkZXJpdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJzdXBwcmVzc0F0dHJpYnV0ZSIsImFkZEZpbHRlciIsIl9kZXJpdmVUYWJsZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGUiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsImFnZ3JlZ2F0ZSIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY2xvc2VkVHJhbnNwb3NlIiwiaW5kZXhlcyIsIm9wZW5UcmFuc3Bvc2UiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJvdGhlclRhYmxlIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJwYXJlbnRUYWJsZSIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkFnZ3JlZ2F0ZWRUYWJsZSIsIl9hdHRyaWJ1dGUiLCJfdW5maW5pc2hlZENhY2hlIiwiX3VuZmluaXNoZWRDYWNoZUxvb2t1cCIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicFRhYmxlIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbnMiLCJzZXRDbGFzc05hbWUiLCJoYXNDdXN0b21OYW1lIiwidmFyaWFibGVOYW1lIiwiZmlsdGVyIiwiZCIsInRvTG9jYWxlVXBwZXJDYXNlIiwiZGVsZXRlZCIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJfZGVyaXZlTmV3Q2xhc3MiLCJnZXRTYW1wbGVHcmFwaCIsInJvb3RDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZXMiLCJlZGdlSWRzIiwiY2xhc3NJZHMiLCJlZGdlQ2xhc3NJZHMiLCJlZGdlSWQiLCJlZGdlQ2xhc3MiLCJyb2xlIiwiZ2V0RWRnZVJvbGUiLCJyZXZlcnNlIiwiY29uY2F0IiwicGFpcndpc2VOZWlnaGJvcmhvb2QiLCJlZGdlIiwicGFpcndpc2VFZGdlcyIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc2VzIiwiZWRnZUNsYXNzSWQiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImF1dG9jb25uZWN0IiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiaXNTb3VyY2UiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIm5vZGVDbGFzcyIsInRhYmxlSWRMaXN0IiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5ld05vZGVDbGFzcyIsImNvbm5lY3RlZENsYXNzZXMiLCJFZGdlV3JhcHBlciIsInNvdXJjZU5vZGVzIiwic291cmNlVGFibGVJZCIsInRhcmdldE5vZGVzIiwidGFyZ2V0VGFibGVJZCIsIm5vZGVzIiwic291cmNlIiwidGFyZ2V0IiwiRWRnZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsIl9zcGxpdFRhYmxlSWRMaXN0Iiwib3RoZXJDbGFzcyIsIm5vZGVUYWJsZUlkTGlzdCIsImVkZ2VUYWJsZUlkIiwiZWRnZVRhYmxlSWRMaXN0Iiwic3RhdGljRXhpc3RzIiwidGFibGVEaXN0YW5jZXMiLCJzdGFydHNXaXRoIiwiZGlzdCIsIk1hdGgiLCJhYnMiLCJzb3J0IiwiYSIsImIiLCJzaWRlIiwiY29ubmVjdFNvdXJjZSIsImNvbm5lY3RUYXJnZXQiLCJ0b2dnbGVEaXJlY3Rpb24iLCJzd2FwcGVkRGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwidW5zaGlmdCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiREFUQUxJQl9GT1JNQVRTIiwiTmV0d29ya01vZGVsIiwib3JpZ3JhcGgiLCJtb2RlbElkIiwiX29yaWdyYXBoIiwiX25leHRDbGFzc0lkIiwiX25leHRUYWJsZUlkIiwiaHlkcmF0ZSIsIkNMQVNTRVMiLCJUQUJMRVMiLCJfc2F2ZVRpbWVvdXQiLCJzYXZlIiwidW5zYXZlZCIsInJhd09iamVjdCIsIlRZUEVTIiwic2VsZWN0b3IiLCJmaW5kQ2xhc3MiLCJyZW5hbWUiLCJuZXdOYW1lIiwiYW5ub3RhdGUiLCJrZXkiLCJkZWxldGVBbm5vdGF0aW9uIiwiZGVsZXRlTW9kZWwiLCJtb2RlbHMiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsIm1pbWUiLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsImNvbnNvbGUiLCJ3YXJuIiwidGV4dCIsInJlYWRlciIsIkZpbGVSZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJicmFuY2hMaW1pdCIsIm5vZGVMaW1pdCIsImVkZ2VMaW1pdCIsInRyaXBsZUxpbWl0Iiwic2FtcGxlR3JhcGgiLCJub2RlTG9va3VwIiwiZWRnZUxvb2t1cCIsImxpbmtzIiwibnVtVHJpcGxlcyIsImFkZE5vZGUiLCJub2RlIiwiYWRkRWRnZSIsImFkZFRyaXBsZSIsImNsYXNzTGlzdCIsImdldEluc3RhbmNlR3JhcGgiLCJpbnN0YW5jZXMiLCJncmFwaCIsImVkZ2VUYWJsZUVudHJpZXMiLCJpbnN0YW5jZSIsIm5vZGVJbnN0YW5jZSIsImR1bW15IiwiZWRnZUluc3RhbmNlIiwic291cmNlcyIsInRhcmdldHMiLCJnZXROZXR3b3JrTW9kZWxHcmFwaCIsInJhdyIsImluY2x1ZGVEdW1taWVzIiwiY2xhc3NMb29rdXAiLCJjbGFzc0Nvbm5lY3Rpb25zIiwiY2xhc3NTcGVjIiwiaWQiLCJsb2NhdGlvbiIsImdldFRhYmxlRGVwZW5kZW5jeUdyYXBoIiwidGFibGVMb29rdXAiLCJ0YWJsZUxpbmtzIiwidGFibGVMaXN0IiwidGFibGVTcGVjIiwiZ2V0TW9kZWxEdW1wIiwicmF3T2JqIiwiSlNPTiIsInBhcnNlIiwic3RyaW5naWZ5IiwiYUhhc2giLCJiSGFzaCIsImNyZWF0ZVNjaGVtYU1vZGVsIiwibmV3TW9kZWwiLCJjcmVhdGVNb2RlbCIsInNvdXJjZUNsYXNzZXMiLCJ0YXJnZXRDbGFzc2VzIiwidGFibGVEZXBlbmRlbmNpZXMiLCJjb3JlVGFibGVzIiwiTkVYVF9NT0RFTF9JRCIsIk9yaWdyYXBoIiwibG9jYWxTdG9yYWdlIiwicGx1Z2lucyIsImV4aXN0aW5nTW9kZWxzIiwiZ2V0SXRlbSIsIl9jdXJyZW50TW9kZWxJZCIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luIiwic2V0SXRlbSIsImNsb3NlQ3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsSWQiLCJkZWxldGVBbGxNb2RlbHMiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsY0FBTCxHQUFzQixFQUF0QjtXQUNLQyxlQUFMLEdBQXVCLEVBQXZCOzs7SUFFRkMsRUFBRSxDQUFFQyxTQUFGLEVBQWFDLFFBQWIsRUFBdUI7VUFDbkIsQ0FBQ0MsS0FBRCxFQUFRQyxTQUFSLElBQXFCSCxTQUFTLENBQUNJLEtBQVYsQ0FBZ0IsR0FBaEIsQ0FBekI7V0FDS1AsY0FBTCxDQUFvQkssS0FBcEIsSUFBNkIsS0FBS0wsY0FBTCxDQUFvQkssS0FBcEIsS0FDM0I7WUFBTTtPQURSOztVQUVJLENBQUNDLFNBQUwsRUFBZ0I7YUFDVE4sY0FBTCxDQUFvQkssS0FBcEIsRUFBMkIsRUFBM0IsRUFBK0JHLElBQS9CLENBQW9DSixRQUFwQztPQURGLE1BRU87YUFDQUosY0FBTCxDQUFvQkssS0FBcEIsRUFBMkJD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
