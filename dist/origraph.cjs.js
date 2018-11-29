'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var FileReader = _interopDefault(require('filereader'));

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

  iterateAcrossConnections({
    tableIds,
    limit = Infinity
  }) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // First make sure that all the table caches have been fully built and
      // connected
      yield _awaitAsyncGenerator(Promise.all(tableIds.map(tableId => {
        const cachePromise = _this.classObj.model.tables[tableId].buildCache();

        return cachePromise;
      })));
      let i = 0;

      for (const item of _this._iterateAcrossConnections(tableIds)) {
        yield item;
        i++;

        if (i >= limit) {
          return;
        }
      }
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
        try {
          _this.buildCache();
        } catch (err) {
          throw err;
        }

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

  async buildCache() {
    if (this._cache) {
      return this._cache;
    } else if (this._cachePromise) {
      return this._cachePromise;
    }

    this._cachePromise = new Promise(async (resolve, reject) => {
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
    });
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

  async buildCache() {
    // We override buildCache because we don't actually want to call _finishItem
    // until all unique values have been seen
    if (this._cache) {
      return this._cache;
    } else if (this._cachePromise) {
      return this._cachePromise;
    }

    this._cachePromise = new Promise(async (resolve, reject) => {
      const tempCache = [];
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
          tempCache.push(temp.value);
        }
      } // Okay, now we've seen everything; we can call _finishItem on each of the
      // unique values


      let i = 0;

      for (const value of tempCache) {
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
    });
    return this._cachePromise;
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
            // We were reset; return immediately
            return;
          } else if (_this._partialCache[index]) {
            const existingItem = _this._partialCache[index];
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

      for (const parentTable of parentTables) {
        yield _awaitAsyncGenerator(parentTable.buildCache());
      } // Now that the caches are built, just iterate their keys directly. We only
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

  edges(options = {
    limit: Infinity
  }) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let edgeIds = options.classes ? options.classes.map(classObj => classObj.classId) : options.classIds || Object.keys(_this.classObj.edgeClassIds);
      let i = 0;

      for (const edgeId of edgeIds) {
        if (!_this.classObj.edgeClassIds[edgeId]) {
          continue;
        }

        const edgeClass = _this.classObj.model.classes[edgeId];

        const role = _this.classObj.getEdgeRole(edgeClass);

        options.tableIds = [];

        if (role === 'both' || role === 'source') {
          options.tableIds = edgeClass.sourceTableIds.slice().reverse().concat([edgeClass.tableId]);
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;

          var _iteratorError;

          try {
            for (var _iterator = _asyncIterator(_this.iterateAcrossConnections(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
              const item = _value;
              yield item;
              i++;

              if (i >= options.limit) {
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

        if (role === 'both' || role === 'target') {
          options.tableIds = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]);
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator(_this.iterateAcrossConnections(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const item = _value2;
              yield item;
              i++;

              if (i >= options.limit) {
                return;
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
      }
    })();
  }

  pairwiseNeighborhood(options) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator(_this2.edges(options)), _step3, _value3; _step3 = yield _awaitAsyncGenerator(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
          const edge = _value3;
          yield* _asyncGeneratorDelegate(_asyncIterator(edge.pairwiseEdges(options)), _awaitAsyncGenerator);
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
    } // If we have a self edge connecting the same attribute, we can just use
    // the AggregatedTable as the edge table; otherwise we need to create a
    // ConnectedTable


    const connectedTable = this === otherNodeClass && attribute === otherAttribute ? thisHash : thisHash.connect([otherHash]);
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
      options.tableIds = _this.classObj.sourceTableIds.concat([sourceTableId]);
      yield* _asyncGeneratorDelegate(_asyncIterator(_this.iterateAcrossConnections(options)), _awaitAsyncGenerator);
    })();
  }

  targetNodes(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      if (_this2.classObj.targetClassId === null || options.classes && !options.classes.find(d => _this2.classObj.targetClassId === d.classId) || options.classIds && options.classIds.indexOf(_this2.classObj.targetClassId) === -1) {
        return;
      }

      const targetTableId = _this2.classObj.model.classes[_this2.classObj.targetClassId].tableId;
      options.tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);
      yield* _asyncGeneratorDelegate(_asyncIterator(_this2.iterateAcrossConnections(options)), _awaitAsyncGenerator);
    })();
  }

  nodes(options) {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      yield* _asyncGeneratorDelegate(_asyncIterator(_this3.sourceNodes(options)), _awaitAsyncGenerator);
      yield* _asyncGeneratorDelegate(_asyncIterator(_this3.targetNodes(options)), _awaitAsyncGenerator);
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

  async hyperedge(options) {
    const result = {
      sources: [],
      targets: [],
      edge: this
    };
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;

    var _iteratorError3;

    try {
      for (var _iterator3 = _asyncIterator(this.sourceNodes(options)), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
        const source = _value3;
        result.push(source);
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

    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;

    var _iteratorError4;

    try {
      for (var _iterator4 = _asyncIterator(this.targetNodes(options)), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
        const target = _value4;
        result.push(target);
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
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node

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
var version = "0.2.0";
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
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t",
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

let origraph = new Origraph(FileReader, null);
origraph.version = pkg.version;

module.exports = origraph;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguY2pzLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRmFjZXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UcmFuc3Bvc2VkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdIHx8XG4gICAgICAgIHsgJyc6IFtdIH07XG4gICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10ucHVzaChjYWxsYmFjayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdID0gY2FsbGJhY2s7XG4gICAgICB9XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddID0gW107XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudCwgLi4uYXJncykge1xuICAgICAgY29uc3QgaGFuZGxlQ2FsbGJhY2sgPSBjYWxsYmFjayA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWVzcGFjZSBvZiBPYmplY3Qua2V5cyh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkpIHtcbiAgICAgICAgICBpZiAobmFtZXNwYWNlID09PSAnJykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmZvckVhY2goaGFuZGxlQ2FsbGJhY2spO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoYW5kbGVDYWxsYmFjayh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLnRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGFuZCB0YWJsZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc09iaiA9IG9wdGlvbnMuY2xhc3NPYmogfHwgbnVsbDtcbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSBvcHRpb25zLmNvbm5lY3RlZEl0ZW1zIHx8IHt9O1xuICB9XG4gIGNvbm5lY3RJdGVtIChpdGVtKSB7XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdIHx8IFtdO1xuICAgIGlmICh0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0uaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XyR7dGhpcy5pbmRleH1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAoeyB0YWJsZUlkcywgbGltaXQgPSBJbmZpbml0eSB9KSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIGNvbnN0IGNhY2hlUHJvbWlzZSA9IHRoaXMuY2xhc3NPYmoubW9kZWwudGFibGVzW3RhYmxlSWRdLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHJldHVybiBjYWNoZVByb21pc2U7XG4gICAgfSkpO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSkge1xuICAgICAgeWllbGQgaXRlbTtcbiAgICAgIGkrKztcbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9saW1pdFByb21pc2VzID0ge307XG5cbiAgICB0aGlzLml0ZXJhdGlvblJlc2V0ID0gbmV3IEVycm9yKCdJdGVyYXRpb24gcmVzZXQnKTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuX2F0dHJpYnV0ZXMsXG4gICAgICBkZXJpdmVkVGFibGVzOiB0aGlzLl9kZXJpdmVkVGFibGVzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge30sXG4gICAgICBzdXBwcmVzc2VkQXR0cmlidXRlczogdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMsXG4gICAgICBzdXBwcmVzc0luZGV4OiB0aGlzLl9zdXBwcmVzc0luZGV4LFxuICAgICAgYXR0cmlidXRlRmlsdGVyczoge30sXG4gICAgICBpbmRleEZpbHRlcjogKHRoaXMuX2luZGV4RmlsdGVyICYmIHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24odGhpcy5faW5kZXhGaWx0ZXIpKSB8fCBudWxsXG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgcmVzdWx0LmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAgcmVzdWx0LmF0dHJpYnV0ZUZpbHRlcnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlO1xuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbihgcmV0dXJuICR7c3RyaW5naWZpZWRGdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgfVxuICBkZWh5ZHJhdGVGdW5jdGlvbiAoZnVuYykge1xuICAgIGxldCBzdHJpbmdpZmllZEZ1bmMgPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgLy8gSXN0YW5idWwgYWRkcyBzb21lIGNvZGUgdG8gZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgY292ZXJhZ2UsIHRoYXQgZ2V0c1xuICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3R3YXJsb3N0L2lzdGFuYnVsL2lzc3Vlcy8zMTAjaXNzdWVjb21tZW50LTI3NDg4OTAyMlxuICAgIHN0cmluZ2lmaWVkRnVuYyA9IHN0cmluZ2lmaWVkRnVuYy5yZXBsYWNlKC9jb3ZfKC4rPylcXCtcXCtbLDtdPy9nLCAnJyk7XG4gICAgcmV0dXJuIHN0cmluZ2lmaWVkRnVuYztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIC8vIFRoZSBjYWNoZSBoYXMgYWxyZWFkeSBiZWVuIGJ1aWx0OyBqdXN0IGdyYWIgZGF0YSBmcm9tIGl0IGRpcmVjdGx5XG4gICAgICB5aWVsZCAqIHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZSAmJiB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoID49IGxpbWl0KSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQsIGJ1dCBpdCdzIGFscmVhZHkgbG9uZyBlbm91Z2ggdG8gc2F0aXNmeSB0aGlzXG4gICAgICAvLyByZXF1ZXN0XG4gICAgICB5aWVsZCAqIHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBjYWNoZSBpc24ndCBmaW5pc2hlZCBidWlsZGluZyAoYW5kIG1heWJlIGRpZG4ndCBldmVuIHN0YXJ0IHlldCk7XG4gICAgICAvLyBraWNrIGl0IG9mZiwgYW5kIHRoZW4gd2FpdCBmb3IgZW5vdWdoIGl0ZW1zIHRvIGJlIHByb2Nlc3NlZCB0byBzYXRpc2Z5XG4gICAgICAvLyB0aGUgbGltaXRcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMuYnVpbGRDYWNoZSgpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICAgIHlpZWxkICogYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSA9IHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdIHx8IFtdO1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX2NhY2hlUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB9XG4gICAgdGhpcy5fY2FjaGVQcm9taXNlID0gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgPSB7fTtcbiAgICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZSgpO1xuICAgICAgbGV0IGkgPSAwO1xuICAgICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgICB3aGlsZSAoIXRlbXAuZG9uZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIC8vIFNvbWV0aGluZyB3ZW50IHdyb25nIHVwc3RyZWFtIChzb21ldGhpbmcgdGhhdCB0aGlzLl9pdGVyYXRlXG4gICAgICAgICAgLy8gZGVwZW5kcyBvbiB3YXMgcmVzZXQgb3IgdGhyZXcgYSByZWFsIGVycm9yKVxuICAgICAgICAgIGlmIChlcnIgPT09IHRoaXMuaXRlcmF0aW9uUmVzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAgIC8vIHRoYXQgd2FzIHdhaXRpbmcgb24gdXMga25vdyB0aGF0IHdlIGNhbid0IGNvbXBseVxuICAgICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKSkge1xuICAgICAgICAgICAgLy8gT2theSwgdGhpcyBpdGVtIHBhc3NlZCBhbGwgZmlsdGVycywgYW5kIGlzIHJlYWR5IHRvIGJlIHNlbnQgb3V0XG4gICAgICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZS5wdXNoKHRlbXAudmFsdWUpO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBEb25lIGl0ZXJhdGluZyEgV2UgY2FuIGdyYWR1YXRlIHRoZSBwYXJ0aWFsIGNhY2hlIC8gbG9va3VwcyBpbnRvXG4gICAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICBmb3IgKGNvbnN0IGRlcml2ZWRUYWJsZSBvZiB0aGlzLmRlcml2ZWRUYWJsZXMpIHtcbiAgICAgIGRlcml2ZWRUYWJsZS5yZXNldCgpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0Jyk7XG4gIH1cbiAgaGFuZGxlUmVzZXQgKHJlamVjdCkge1xuICAgIGZvciAoY29uc3QgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdLnJlamVjdCh0aGlzLml0ZXJhdGlvblJlc2V0KTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzO1xuICAgIH1cbiAgICByZWplY3QodGhpcy5pdGVyYXRpb25SZXNldCk7XG4gIH1cbiAgYXN5bmMgY291bnRSb3dzICgpIHtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpKS5sZW5ndGg7XG4gIH1cbiAgYXN5bmMgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gd3JhcHBlZEl0ZW0ucm93KSB7XG4gICAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGRlbGV0ZSB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBhd2FpdCBmdW5jKGF3YWl0IHdyYXBwZWRJdGVtLnJvd1thdHRyXSk7XG4gICAgICBpZiAoIWtlZXApIHsgYnJlYWs7IH1cbiAgICB9XG4gICAgaWYgKGtlZXApIHtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3cmFwcGVkSXRlbS5kaXNjb25uZWN0KCk7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaWx0ZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIGtlZXA7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGdldEluZGV4RGV0YWlscyAoKSB7XG4gICAgY29uc3QgZGV0YWlscyA9IHsgbmFtZTogbnVsbCB9O1xuICAgIGlmICh0aGlzLl9zdXBwcmVzc0luZGV4KSB7XG4gICAgICBkZXRhaWxzLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGRldGFpbHMuZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZGV0YWlscztcbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHt9O1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5leHBlY3RlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5vYnNlcnZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZGVyaXZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fYXR0cmlidXRlRmlsdGVycykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5nZXRBdHRyaWJ1dGVEZXRhaWxzKCkpO1xuICB9XG4gIGdldCBjdXJyZW50RGF0YSAoKSB7XG4gICAgLy8gQWxsb3cgcHJvYmluZyB0byBzZWUgd2hhdGV2ZXIgZGF0YSBoYXBwZW5zIHRvIGJlIGF2YWlsYWJsZVxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgW10sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHN1cHByZXNzQXR0cmlidXRlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFkZEZpbHRlciAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdDb25uZWN0ZWRUYWJsZSdcbiAgICB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGlmICh0aGlzLmluVXNlKSB7XG4gICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBpbi11c2UgdGFibGUgJHt0aGlzLnRhYmxlSWR9YCk7XG4gICAgICBlcnIuaW5Vc2UgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX25hbWU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY0RpY3RUYWJsZTtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWlyZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgQWdncmVnYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gJ+KGpicgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgYnVpbGRDYWNoZSAoKSB7XG4gICAgLy8gV2Ugb3ZlcnJpZGUgYnVpbGRDYWNoZSBiZWNhdXNlIHdlIGRvbid0IGFjdHVhbGx5IHdhbnQgdG8gY2FsbCBfZmluaXNoSXRlbVxuICAgIC8vIHVudGlsIGFsbCB1bmlxdWUgdmFsdWVzIGhhdmUgYmVlbiBzZWVuXG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGU7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfVxuICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHRlbXBDYWNoZSA9IFtdO1xuICAgICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgPSB7fTtcbiAgICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZSgpO1xuICAgICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgICB3aGlsZSAoIXRlbXAuZG9uZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIC8vIFNvbWV0aGluZyB3ZW50IHdyb25nIHVwc3RyZWFtIChzb21ldGhpbmcgdGhhdCB0aGlzLl9pdGVyYXRlXG4gICAgICAgICAgLy8gZGVwZW5kcyBvbiB3YXMgcmVzZXQgb3IgdGhyZXcgYSByZWFsIGVycm9yKVxuICAgICAgICAgIGlmIChlcnIgPT09IHRoaXMuaXRlcmF0aW9uUmVzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAgIC8vIHRoYXQgd2FzIHdhaXRpbmcgb24gdXMga25vdyB0aGF0IHdlIGNhbid0IGNvbXBseVxuICAgICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgICB0ZW1wQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlJ3ZlIHNlZW4gZXZlcnl0aGluZzsgd2UgY2FuIGNhbGwgX2ZpbmlzaEl0ZW0gb24gZWFjaCBvZiB0aGVcbiAgICAgIC8vIHVuaXF1ZSB2YWx1ZXNcbiAgICAgIGxldCBpID0gMDtcbiAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdGVtcENhY2hlKSB7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKHZhbHVlKSkge1xuICAgICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW3ZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godmFsdWUpO1xuICAgICAgICAgIGkrKztcbiAgICAgICAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggZGF0YSBub3cgdG8gc2F0aXNmeSBhbnkgd2FpdGluZyByZXF1ZXN0c1xuICAgICAgICAgICAgaWYgKGxpbWl0IDw9IGkpIHtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gRG9uZSBpdGVyYXRpbmchIFdlIGNhbiBncmFkdWF0ZSB0aGUgcGFydGlhbCBjYWNoZSAvIGxvb2t1cHMgaW50b1xuICAgICAgLy8gZmluaXNoZWQgb25lcywgYW5kIHNhdGlzZnkgYWxsIHRoZSByZXF1ZXN0c1xuICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgICAgdGhpcy5fY2FjaGVMb29rdXAgPSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gU3RyaW5nKGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0pO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlW2luZGV4XSkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0l0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0oZXhpc3RpbmdJdGVtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBBZ2dyZWdhdGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZSArIHRoaXMuX3ZhbHVlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYFske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAvLyBOb3JtYWwgZmFjZXRpbmcganVzdCBnaXZlcyBhIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgdGFibGVcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogT2JqZWN0LmFzc2lnbih7fSwgd3JhcHBlZFBhcmVudC5yb3cpLFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIFRyYW5zcG9zZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5faW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIGlmICh0aGlzLl9pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmluZGV4ID0gdGhpcy5faW5kZXg7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9pbmRleDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGDhtYAke3RoaXMuX2luZGV4fWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gcGFyZW50VGFibGUuX2NhY2hlW3BhcmVudFRhYmxlLl9jYWNoZUxvb2t1cFt0aGlzLl9pbmRleF1dIHx8IHsgcm93OiB7fSB9O1xuICAgIGZvciAoY29uc3QgWyBpbmRleCwgdmFsdWUgXSBvZiBPYmplY3QuZW50cmllcyh3cmFwcGVkUGFyZW50LnJvdykpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5nZXRTb3J0SGFzaCgpKS5qb2luKCcsJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgLy8gRG9uJ3QgdHJ5IHRvIGNvbm5lY3QgdmFsdWVzIHVudGlsIGFsbCBvZiB0aGUgcGFyZW50IHRhYmxlcycgY2FjaGVzIGFyZVxuICAgIC8vIGJ1aWx0OyBUT0RPOiBtaWdodCBiZSBhYmxlIHRvIGRvIHNvbWV0aGluZyBtb3JlIHJlc3BvbnNpdmUgaGVyZT9cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgYXdhaXQgcGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuICAgIH1cbiAgICAvLyBOb3cgdGhhdCB0aGUgY2FjaGVzIGFyZSBidWlsdCwganVzdCBpdGVyYXRlIHRoZWlyIGtleXMgZGlyZWN0bHkuIFdlIG9ubHlcbiAgICAvLyBjYXJlIGFib3V0IGluY2x1ZGluZyByb3dzIHRoYXQgaGF2ZSBleGFjdCBtYXRjaGVzIGFjcm9zcyBhbGwgdGFibGVzLCBzb1xuICAgIC8vIHdlIGNhbiBqdXN0IHBpY2sgb25lIHBhcmVudCB0YWJsZSB0byBpdGVyYXRlXG4gICAgY29uc3QgYmFzZVBhcmVudFRhYmxlID0gcGFyZW50VGFibGVzWzBdO1xuICAgIGNvbnN0IG90aGVyUGFyZW50VGFibGVzID0gcGFyZW50VGFibGVzLnNsaWNlKDEpO1xuICAgIGZvciAoY29uc3QgaW5kZXggaW4gYmFzZVBhcmVudFRhYmxlLl9jYWNoZUxvb2t1cCkge1xuICAgICAgaWYgKCFwYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlTG9va3VwKSkge1xuICAgICAgICAvLyBPbmUgb2YgdGhlIHBhcmVudCB0YWJsZXMgd2FzIHJlc2V0LCBtZWFuaW5nIHdlIG5lZWQgdG8gcmVzZXQgYXMgd2VsbFxuICAgICAgICB0aHJvdyB0aGlzLml0ZXJhdGlvblJlc2V0O1xuICAgICAgfVxuICAgICAgaWYgKCFvdGhlclBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICAgIC8vIE5vIG1hdGNoIGluIG9uZSBvZiB0aGUgb3RoZXIgdGFibGVzOyBvbWl0IHRoaXMgaXRlbVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IGFkZCBlYWNoIHBhcmVudCB0YWJsZXMnIGtleXMgYXMgYXR0cmlidXRlIHZhbHVlc1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IHBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuX2NhY2hlW3RhYmxlLl9jYWNoZUxvb2t1cFtpbmRleF1dKVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSArIHRoaXMuY2xhc3NOYW1lO1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lICE9PSBudWxsO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHwgdGhpcy50YWJsZS5uYW1lO1xuICB9XG4gIGdldCB2YXJpYWJsZU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUudG9Mb2NhbGVMb3dlckNhc2UoKSArICdfJyArXG4gICAgICB0aGlzLmNsYXNzTmFtZVxuICAgICAgICAuc3BsaXQoL1xcVysvZylcbiAgICAgICAgLmZpbHRlcihkID0+IGQubGVuZ3RoID4gMClcbiAgICAgICAgLm1hcChkID0+IGRbMF0udG9Mb2NhbGVVcHBlckNhc2UoKSArIGQuc2xpY2UoMSkpXG4gICAgICAgIC5qb2luKCcnKTtcbiAgfVxuICBnZXQgdGFibGUgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICB9XG4gIGdldCBkZWxldGVkICgpIHtcbiAgICByZXR1cm4gIXRoaXMubW9kZWwuZGVsZXRlZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIF9kZXJpdmVOZXdDbGFzcyAobmV3VGFibGUsIHR5cGUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgdHlwZVxuICAgIH0pO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXRTYW1wbGVHcmFwaCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMucm9vdENsYXNzID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5nZXRTYW1wbGVHcmFwaChvcHRpb25zKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0geyBsaW1pdDogSW5maW5pdHkgfSkge1xuICAgIGxldCBlZGdlSWRzID0gb3B0aW9ucy5jbGFzc2VzXG4gICAgICA/IG9wdGlvbnMuY2xhc3Nlcy5tYXAoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NJZClcbiAgICAgIDogb3B0aW9ucy5jbGFzc0lkcyB8fCBPYmplY3Qua2V5cyh0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkcyk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIGVkZ2VJZHMpIHtcbiAgICAgIGlmICghdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHNbZWRnZUlkXSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuY2xhc3NPYmoubW9kZWwuY2xhc3Nlc1tlZGdlSWRdO1xuICAgICAgY29uc3Qgcm9sZSA9IHRoaXMuY2xhc3NPYmouZ2V0RWRnZVJvbGUoZWRnZUNsYXNzKTtcbiAgICAgIG9wdGlvbnMudGFibGVJZHMgPSBbXTtcbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgb3B0aW9ucy50YWJsZUlkcyA9IGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKSkge1xuICAgICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGlmIChpID49IG9wdGlvbnMubGltaXQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgb3B0aW9ucy50YWJsZUlkcyA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKSkge1xuICAgICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGlmIChpID49IG9wdGlvbnMubGltaXQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZU5laWdoYm9yaG9vZCAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiB0aGlzLmVkZ2VzKG9wdGlvbnMpKSB7XG4gICAgICB5aWVsZCAqIGVkZ2UucGFpcndpc2VFZGdlcyhvcHRpb25zKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBOb2RlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgfVxuICAqIGVkZ2VDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZ2V0RWRnZVJvbGUgKGVkZ2VDbGFzcykge1xuICAgIGlmICghdGhpcy5lZGdlQ2xhc3NJZHNbZWRnZUNsYXNzLmNsYXNzSWRdKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIHJldHVybiAnYm90aCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3NvdXJjZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICByZXR1cm4gJ3RhcmdldCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW50ZXJuYWwgbWlzbWF0Y2ggYmV0d2VlbiBub2RlIGFuZCBlZGdlIGNsYXNzSWRzYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IE5vZGVXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKHsgYXV0b2Nvbm5lY3QgPSBmYWxzZSB9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmICghYXV0b2Nvbm5lY3QgfHwgZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgLy8gQXJlIHdlIHRoZSBzb3VyY2Ugb3IgdGFyZ2V0IG9mIHRoZSBleGlzdGluZyBlZGdlIChpbnRlcm5hbGx5LCBpbiB0ZXJtc1xuICAgICAgLy8gb2Ygc291cmNlSWQgLyB0YXJnZXRJZCwgbm90IGVkZ2VDbGFzcy5kaXJlY3Rpb24pP1xuICAgICAgY29uc3QgaXNTb3VyY2UgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkO1xuXG4gICAgICAvLyBBcyB3ZSdyZSBjb252ZXJ0ZWQgdG8gYW4gZWRnZSwgb3VyIG5ldyByZXN1bHRpbmcgc291cmNlIEFORCB0YXJnZXRcbiAgICAgIC8vIHNob3VsZCBiZSB3aGF0ZXZlciBpcyBhdCB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcyAoaWYgYW55dGhpbmcpXG4gICAgICBpZiAoaXNTb3VyY2UpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAvLyBPa2F5LCB3ZSd2ZSBnb3QgdHdvIGVkZ2VzLCBzbyB0aGlzIGlzIGEgbGl0dGxlIG1vcmUgc3RyYWlnaHRmb3J3YXJkXG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgLy8gQWRkIHRoaXMgY2xhc3MgdG8gdGhlIHNvdXJjZSdzIC8gdGFyZ2V0J3MgZWRnZUNsYXNzSWRzXG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBleGlzdGluZyBlZGdlIGNsYXNzZXMgZnJvbSB0aGUgbmV3IChub3cgZWRnZSkgY2xhc3NcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfVxuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgbGV0IHRoaXNIYXNoLCBvdGhlckhhc2gsIHNvdXJjZVRhYmxlSWRzLCB0YXJnZXRUYWJsZUlkcztcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGU7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFsgdGhpc0hhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBpZiAob3RoZXJBdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGUuYWdncmVnYXRlKG90aGVyQXR0cmlidXRlKTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gWyBvdGhlckhhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICAvLyBJZiB3ZSBoYXZlIGEgc2VsZiBlZGdlIGNvbm5lY3RpbmcgdGhlIHNhbWUgYXR0cmlidXRlLCB3ZSBjYW4ganVzdCB1c2VcbiAgICAvLyB0aGUgQWdncmVnYXRlZFRhYmxlIGFzIHRoZSBlZGdlIHRhYmxlOyBvdGhlcndpc2Ugd2UgbmVlZCB0byBjcmVhdGUgYVxuICAgIC8vIENvbm5lY3RlZFRhYmxlXG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzID09PSBvdGhlck5vZGVDbGFzcyAmJiBhdHRyaWJ1dGUgPT09IG90aGVyQXR0cmlidXRlXG4gICAgICA/IHRoaXNIYXNoIDogdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSBzdXBlci5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIHRoaXMuY29ubmVjdGVkQ2xhc3NlcygpKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBzb3VyY2VOb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkXS50YWJsZUlkO1xuICAgIG9wdGlvbnMudGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzXG4gICAgICAuY29uY2F0KFsgc291cmNlVGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogdGFyZ2V0Tm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBvcHRpb25zLnRhYmxlSWRzID0gdGhpcy5jbGFzc09iai50YXJnZXRUYWJsZUlkc1xuICAgICAgLmNvbmNhdChbIHRhcmdldFRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIG5vZGVzIChvcHRpb25zKSB7XG4gICAgeWllbGQgKiB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpO1xuICAgIHlpZWxkICogdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlRWRnZXMgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICAgIHlpZWxkIHsgc291cmNlLCBlZGdlOiB0aGlzLCB0YXJnZXQgfTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgaHlwZXJlZGdlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgc291cmNlczogW10sXG4gICAgICB0YXJnZXRzOiBbXSxcbiAgICAgIGVkZ2U6IHRoaXNcbiAgICB9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHNvdXJjZSk7XG4gICAgfVxuICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHRhcmdldCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHxcbiAgICAgICgodGhpcy5zb3VyY2VDbGFzcyAmJiB0aGlzLnNvdXJjZUNsYXNzLmNsYXNzTmFtZSkgfHwgJz8nKSArXG4gICAgICAnLScgK1xuICAgICAgKCh0aGlzLnRhcmdldENsYXNzICYmIHRoaXMudGFyZ2V0Q2xhc3MuY2xhc3NOYW1lKSB8fCAnPycpO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy50YWJsZS5hZ2dyZWdhdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLmFnZ3JlZ2F0ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1RhcmdldENsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcblxuY29uc3QgREFUQUxJQl9GT1JNQVRTID0ge1xuICAnanNvbic6ICdqc29uJyxcbiAgJ2Nzdic6ICdjc3YnLFxuICAndHN2JzogJ3RzdicsXG4gICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICd0cmVlanNvbic6ICd0cmVlanNvbidcbn07XG5cbmNsYXNzIE5ldHdvcmtNb2RlbCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBvcmlncmFwaCxcbiAgICBtb2RlbElkLFxuICAgIG5hbWUgPSBtb2RlbElkLFxuICAgIGFubm90YXRpb25zID0ge30sXG4gICAgY2xhc3NlcyA9IHt9LFxuICAgIHRhYmxlcyA9IHt9XG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX29yaWdyYXBoID0gb3JpZ3JhcGg7XG4gICAgdGhpcy5tb2RlbElkID0gbW9kZWxJZDtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9ucztcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcbiAgICB0aGlzLnRhYmxlcyA9IHt9O1xuXG4gICAgdGhpcy5fbmV4dENsYXNzSWQgPSAxO1xuICAgIHRoaXMuX25leHRUYWJsZUlkID0gMTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhjbGFzc2VzKSkge1xuICAgICAgdGhpcy5jbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gdGhpcy5oeWRyYXRlKGNsYXNzT2JqLCBDTEFTU0VTKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICAgIHRoaXMudGFibGVzW3RhYmxlLnRhYmxlSWRdID0gdGhpcy5oeWRyYXRlKHRhYmxlLCBUQUJMRVMpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ3VwZGF0ZScsICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zYXZlVGltZW91dCk7XG4gICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vcmlncmFwaC5zYXZlKCk7XG4gICAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuICAgICAgfSwgMCk7XG4gICAgfSk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBjbGFzc2VzID0ge307XG4gICAgY29uc3QgdGFibGVzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0udHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXSA9IHRhYmxlT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdLnR5cGUgPSB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWxJZDogdGhpcy5tb2RlbElkLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnMsXG4gICAgICBjbGFzc2VzLFxuICAgICAgdGFibGVzXG4gICAgfTtcbiAgfVxuICBnZXQgdW5zYXZlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NhdmVUaW1lb3V0ICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgaHlkcmF0ZSAocmF3T2JqZWN0LCBUWVBFUykge1xuICAgIHJhd09iamVjdC5tb2RlbCA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBUWVBFU1tyYXdPYmplY3QudHlwZV0ocmF3T2JqZWN0KTtcbiAgfVxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIHdoaWxlICghb3B0aW9ucy50YWJsZUlkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSkpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7dGhpcy5fbmV4dFRhYmxlSWR9YDtcbiAgICAgIHRoaXMuX25leHRUYWJsZUlkICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVEFCTEVTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgZmluZENsYXNzIChjbGFzc05hbWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NOYW1lID09PSBjbGFzc05hbWUpO1xuICB9XG4gIHJlbmFtZSAobmV3TmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhbm5vdGF0ZSAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5fb3JpZ3JhcGguZGVsZXRlTW9kZWwodGhpcy5tb2RlbElkKTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX29yaWdyYXBoLm1vZGVsc1t0aGlzLm1vZGVsSWRdO1xuICB9XG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseWApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5fb3JpZ3JhcGguRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24sIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICghZXh0ZW5zaW9uKSB7XG4gICAgICBleHRlbnNpb24gPSBtaW1lLmV4dGVuc2lvbihtaW1lLmxvb2t1cChuYW1lKSk7XG4gICAgfVxuICAgIGlmIChEQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgZGF0YSA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZSh7IG5hbWUsIGRhdGEsIGF0dHJpYnV0ZXMgfSk7XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKCFlcnIuaW5Vc2UpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyBnZXRTYW1wbGVHcmFwaCAoe1xuICAgIHJvb3RDbGFzcyA9IG51bGwsXG4gICAgYnJhbmNoTGltaXQgPSBJbmZpbml0eSxcbiAgICBub2RlTGltaXQgPSBJbmZpbml0eSxcbiAgICBlZGdlTGltaXQgPSBJbmZpbml0eSxcbiAgICB0cmlwbGVMaW1pdCA9IEluZmluaXR5XG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IHNhbXBsZUdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW10sXG4gICAgICBlZGdlTG9va3VwOiB7fSxcbiAgICAgIGxpbmtzOiBbXVxuICAgIH07XG5cbiAgICBsZXQgbnVtVHJpcGxlcyA9IDA7XG4gICAgY29uc3QgYWRkTm9kZSA9IG5vZGUgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGgubm9kZXMucHVzaChub2RlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGggPD0gbm9kZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkRWRnZSA9IGVkZ2UgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLmVkZ2VzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGguZWRnZXMucHVzaChlZGdlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5lZGdlcy5sZW5ndGggPD0gZWRnZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkVHJpcGxlID0gKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSA9PiB7XG4gICAgICBpZiAoYWRkTm9kZShzb3VyY2UpICYmIGFkZE5vZGUodGFyZ2V0KSAmJiBhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogc2FtcGxlR3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSxcbiAgICAgICAgICBlZGdlOiBzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF1cbiAgICAgICAgfSk7XG4gICAgICAgIG51bVRyaXBsZXMrKztcbiAgICAgICAgcmV0dXJuIG51bVRyaXBsZXMgPD0gdHJpcGxlTGltaXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxldCBjbGFzc0xpc3QgPSByb290Q2xhc3MgPyBbcm9vdENsYXNzXSA6IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGROb2RlKG5vZGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIGVkZ2UsIHRhcmdldCB9IG9mIG5vZGUucGFpcndpc2VOZWlnaGJvcmhvb2QoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmICghYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIHRhcmdldCB9IG9mIGVkZ2UucGFpcndpc2VFZGdlcyh7IGxpbWl0OiBicmFuY2hMaW1pdCB9KSkge1xuICAgICAgICAgICAgaWYgKCFhZGRUcmlwbGUoc291cmNlLCBlZGdlLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICB9XG4gIGFzeW5jIGdldEluc3RhbmNlR3JhcGggKGluc3RhbmNlcykge1xuICAgIGlmICghaW5zdGFuY2VzKSB7XG4gICAgICAvLyBXaXRob3V0IHNwZWNpZmllZCBpbnN0YW5jZXMsIGp1c3QgcGljayB0aGUgZmlyc3QgNSBmcm9tIGVhY2ggbm9kZVxuICAgICAgLy8gYW5kIGVkZ2UgY2xhc3NcbiAgICAgIGluc3RhbmNlcyA9IFtdO1xuICAgICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyB8fCBjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSg1KSkge1xuICAgICAgICAgICAgaW5zdGFuY2VzLnB1c2goaXRlbSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBub2RlTG9va3VwOiB7fSxcbiAgICAgIGVkZ2VzOiBbXVxuICAgIH07XG4gICAgY29uc3QgZWRnZVRhYmxlRW50cmllcyA9IFtdO1xuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgaW5zdGFuY2VzKSB7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGdyYXBoLm5vZGVMb29rdXBbaW5zdGFuY2UuaW5zdGFuY2VJZF0gPSBncmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICAgIG5vZGVJbnN0YW5jZTogaW5zdGFuY2UsXG4gICAgICAgICAgZHVtbXk6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZVRhYmxlRW50cmllcy5wdXNoKGluc3RhbmNlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBlZGdlSW5zdGFuY2Ugb2YgZWRnZVRhYmxlRW50cmllcykge1xuICAgICAgY29uc3Qgc291cmNlcyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZUluc3RhbmNlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBzb3VyY2VzLnB1c2goZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCB0YXJnZXRzID0gW107XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlSW5zdGFuY2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRhcmdldHMucHVzaChncmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzb3VyY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBpZiAodGFyZ2V0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAvLyBXZSBoYXZlIGNvbXBsZXRlbHkgaGFuZ2luZyBlZGdlcywgbWFrZSBkdW1teSBub2RlcyBmb3IgdGhlXG4gICAgICAgICAgLy8gc291cmNlIGFuZCB0YXJnZXRcbiAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGggKyAxXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUaGUgc291cmNlcyBhcmUgaGFuZ2luZywgYnV0IHdlIGhhdmUgdGFyZ2V0c1xuICAgICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgICB0YXJnZXRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0YXJnZXRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBUaGUgdGFyZ2V0cyBhcmUgaGFuZ2luZywgYnV0IHdlIGhhdmUgc291cmNlc1xuICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVpdGhlciB0aGUgc291cmNlLCBub3IgdGhlIHRhcmdldCBhcmUgaGFuZ2luZ1xuICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgICAgc291cmNlLFxuICAgICAgICAgICAgICB0YXJnZXRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TmV0d29ya01vZGVsR3JhcGggKHtcbiAgICByYXcgPSB0cnVlLFxuICAgIGluY2x1ZGVEdW1taWVzID0gZmFsc2UsXG4gICAgY2xhc3NMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc2VzID0gW107XG4gICAgbGV0IGdyYXBoID0ge1xuICAgICAgY2xhc3NlczogW10sXG4gICAgICBjbGFzc0xvb2t1cDoge30sXG4gICAgICBjbGFzc0Nvbm5lY3Rpb25zOiBbXVxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgLy8gQWRkIGFuZCBpbmRleCB0aGUgY2xhc3MgYXMgYSBub2RlXG4gICAgICBjb25zdCBjbGFzc1NwZWMgPSByYXcgPyBjbGFzc09iai5fdG9SYXdPYmplY3QoKSA6IHsgY2xhc3NPYmogfTtcbiAgICAgIGNsYXNzU3BlYy50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLmNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gZ3JhcGguY2xhc3Nlcy5sZW5ndGg7XG4gICAgICBncmFwaC5jbGFzc2VzLnB1c2goY2xhc3NTcGVjKTtcblxuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAvLyBTdG9yZSB0aGUgZWRnZSBjbGFzcyBzbyB3ZSBjYW4gY3JlYXRlIGNsYXNzQ29ubmVjdGlvbnMgbGF0ZXJcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyAmJiBpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBub2RlXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2NsYXNzT2JqLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoIC0gMSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBmYWxzZSxcbiAgICAgICAgICBsb2NhdGlvbjogJ25vZGUnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgZXhpc3RpbmcgY2xhc3NDb25uZWN0aW9uc1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIGVkZ2VDbGFzc2VzKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgc291cmNlIG5vZGUgY2xhc3MgdG8gdGhlIGVkZ2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWR9PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJ1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgc291cmNlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGBkdW1teT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgZWRnZSBjbGFzcyB0byB0aGUgdGFyZ2V0IG5vZGUgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PiR7ZWRnZUNsYXNzLnRhcmdldENsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0J1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgdGFyZ2V0IGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0JyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldFRhYmxlRGVwZW5kZW5jeUdyYXBoICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIHRhYmxlczogW10sXG4gICAgICB0YWJsZUxvb2t1cDoge30sXG4gICAgICB0YWJsZUxpbmtzOiBbXVxuICAgIH07XG4gICAgY29uc3QgdGFibGVMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcyk7XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGNvbnN0IHRhYmxlU3BlYyA9IHRhYmxlLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVTcGVjLnR5cGUgPSB0YWJsZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBncmFwaC50YWJsZXMubGVuZ3RoO1xuICAgICAgZ3JhcGgudGFibGVzLnB1c2godGFibGVTcGVjKTtcbiAgICB9XG4gICAgLy8gRmlsbCB0aGUgZ3JhcGggd2l0aCBsaW5rcyBiYXNlZCBvbiBwYXJlbnRUYWJsZXMuLi5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0YWJsZS5wYXJlbnRUYWJsZXMpIHtcbiAgICAgICAgZ3JhcGgudGFibGVMaW5rcy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLnRhYmxlTG9va3VwW3BhcmVudFRhYmxlLnRhYmxlSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRNb2RlbER1bXAgKCkge1xuICAgIC8vIEJlY2F1c2Ugb2JqZWN0IGtleSBvcmRlcnMgYXJlbid0IGRldGVybWluaXN0aWMsIGl0IGNhbiBiZSBwcm9ibGVtYXRpY1xuICAgIC8vIGZvciB0ZXN0aW5nIChiZWNhdXNlIGlkcyBjYW4gcmFuZG9tbHkgY2hhbmdlIGZyb20gdGVzdCBydW4gdG8gdGVzdCBydW4pLlxuICAgIC8vIFRoaXMgZnVuY3Rpb24gc29ydHMgZWFjaCBrZXksIGFuZCBqdXN0IHJlcGxhY2VzIElEcyB3aXRoIGluZGV4IG51bWJlcnNcbiAgICBjb25zdCByYXdPYmogPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHRoaXMuX3RvUmF3T2JqZWN0KCkpKTtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBjbGFzc2VzOiBPYmplY3QudmFsdWVzKHJhd09iai5jbGFzc2VzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy5jbGFzc2VzW2EuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLmNsYXNzZXNbYi5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzcyBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHRhYmxlczogT2JqZWN0LnZhbHVlcyhyYXdPYmoudGFibGVzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy50YWJsZXNbYS50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMudGFibGVzW2IudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgdGFibGUgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9O1xuICAgIGNvbnN0IGNsYXNzTG9va3VwID0ge307XG4gICAgY29uc3QgdGFibGVMb29rdXAgPSB7fTtcbiAgICByZXN1bHQuY2xhc3Nlcy5mb3JFYWNoKChjbGFzc09iaiwgaW5kZXgpID0+IHtcbiAgICAgIGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gaW5kZXg7XG4gICAgfSk7XG4gICAgcmVzdWx0LnRhYmxlcy5mb3JFYWNoKCh0YWJsZSwgaW5kZXgpID0+IHtcbiAgICAgIHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gaW5kZXg7XG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHJlc3VsdC50YWJsZXMpIHtcbiAgICAgIHRhYmxlLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXTtcbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKSkge1xuICAgICAgICB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlTG9va3VwW3RhYmxlSWRdXSA9IHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICAgIGRlbGV0ZSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRhYmxlLmRhdGE7IC8vIGRvbid0IGluY2x1ZGUgYW55IG9mIHRoZSBkYXRhOyB3ZSBqdXN0IHdhbnQgdGhlIG1vZGVsIHN0cnVjdHVyZVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIHJlc3VsdC5jbGFzc2VzKSB7XG4gICAgICBjbGFzc09iai5jbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF07XG4gICAgICBjbGFzc09iai50YWJsZUlkID0gdGFibGVMb29rdXBbY2xhc3NPYmoudGFibGVJZF07XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouc291cmNlQ2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlVGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMgPSBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai50YXJnZXRDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMgPSBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGNsYXNzSWQgb2YgT2JqZWN0LmtleXMoY2xhc3NPYmouZWRnZUNsYXNzSWRzIHx8IHt9KSkge1xuICAgICAgICBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NMb29rdXBbY2xhc3NJZF1dID0gY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgICBkZWxldGUgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGNyZWF0ZVNjaGVtYU1vZGVsICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHRoaXMuZ2V0TW9kZWxEdW1wKCk7XG5cbiAgICBncmFwaC50YWJsZXMuZm9yRWFjaCh0YWJsZSA9PiB7XG4gICAgICB0YWJsZS5kZXJpdmVkVGFibGVzID0gT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcyk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZU1vZGVsKHsgbmFtZTogdGhpcy5uYW1lICsgJ19zY2hlbWEnIH0pO1xuICAgIGNvbnN0IHJhdyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLFxuICAgICAgbmFtZTogJ1JhdyBEdW1wJ1xuICAgIH0pO1xuICAgIGxldCBbIGNsYXNzZXMsIHRhYmxlcyBdID0gcmF3LmNsb3NlZFRyYW5zcG9zZShbJ2NsYXNzZXMnLCAndGFibGVzJ10pO1xuICAgIGNsYXNzZXMgPSBjbGFzc2VzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBjbGFzc2VzLnNldENsYXNzTmFtZSgnQ2xhc3NlcycpO1xuICAgIHJhdy5kZWxldGUoKTtcblxuICAgIGNvbnN0IHNvdXJjZUNsYXNzZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogY2xhc3NlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3NvdXJjZUNsYXNzSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBzb3VyY2VDbGFzc2VzLnNldENsYXNzTmFtZSgnU291cmNlIENsYXNzJyk7XG4gICAgc291cmNlQ2xhc3Nlcy50b2dnbGVEaXJlY3Rpb24oKTtcbiAgICBjb25zdCB0YXJnZXRDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YXJnZXRDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgdGFyZ2V0Q2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1RhcmdldCBDbGFzcycpO1xuICAgIHRhcmdldENsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICB0YWJsZXMgPSB0YWJsZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgIHRhYmxlcy5zZXRDbGFzc05hbWUoJ1RhYmxlcycpO1xuXG4gICAgY29uc3QgdGFibGVEZXBlbmRlbmNpZXMgPSB0YWJsZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdkZXJpdmVkVGFibGVzJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMuc2V0Q2xhc3NOYW1lKCdJcyBQYXJlbnQgT2YnKTtcbiAgICB0YWJsZURlcGVuZGVuY2llcy50b2dnbGVEaXJlY3Rpb24oKTtcblxuICAgIGNvbnN0IGNvcmVUYWJsZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAndGFibGVJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIGNvcmVUYWJsZXMuc2V0Q2xhc3NOYW1lKCdDb3JlIFRhYmxlJyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOZXR3b3JrTW9kZWw7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBOZXR3b3JrTW9kZWwgZnJvbSAnLi9Db21tb24vTmV0d29ya01vZGVsLmpzJztcblxubGV0IE5FWFRfTU9ERUxfSUQgPSAxO1xuXG5jbGFzcyBPcmlncmFwaCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuXG4gICAgdGhpcy5wbHVnaW5zID0ge307XG5cbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIGxldCBleGlzdGluZ01vZGVscyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ29yaWdyYXBoX21vZGVscycpO1xuICAgIGlmIChleGlzdGluZ01vZGVscykge1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKEpTT04ucGFyc2UoZXhpc3RpbmdNb2RlbHMpKSkge1xuICAgICAgICBtb2RlbC5vcmlncmFwaCA9IHRoaXM7XG4gICAgICAgIHRoaXMubW9kZWxzW21vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChtb2RlbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICB9XG4gIHJlZ2lzdGVyUGx1Z2luIChuYW1lLCBwbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbnNbbmFtZV0gPSBwbHVnaW47XG4gIH1cbiAgc2F2ZSAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgfVxuICBjbG9zZUN1cnJlbnRNb2RlbCAoKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgZ2V0IGN1cnJlbnRNb2RlbCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW3RoaXMuX2N1cnJlbnRNb2RlbElkXSB8fCBudWxsO1xuICB9XG4gIHNldCBjdXJyZW50TW9kZWwgKG1vZGVsKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBtb2RlbCA/IG1vZGVsLm1vZGVsSWQgOiBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5pbXBvcnQgRmlsZVJlYWRlciBmcm9tICdmaWxlcmVhZGVyJztcblxubGV0IG9yaWdyYXBoID0gbmV3IE9yaWdyYXBoKEZpbGVSZWFkZXIsIG51bGwpO1xub3JpZ3JhcGgudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBvcmlncmFwaDtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiX2V2ZW50SGFuZGxlcnMiLCJfc3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiZXZlbnQiLCJuYW1lc3BhY2UiLCJzcGxpdCIsInB1c2giLCJvZmYiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImhhbmRsZUNhbGxiYWNrIiwic2V0VGltZW91dCIsImFwcGx5IiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkdlbmVyaWNXcmFwcGVyIiwib3B0aW9ucyIsInRhYmxlIiwidW5kZWZpbmVkIiwiRXJyb3IiLCJjbGFzc09iaiIsInJvdyIsImNvbm5lY3RlZEl0ZW1zIiwiY29ubmVjdEl0ZW0iLCJpdGVtIiwidGFibGVJZCIsImRpc2Nvbm5lY3QiLCJpdGVtTGlzdCIsInZhbHVlcyIsImluc3RhbmNlSWQiLCJjbGFzc0lkIiwiZXF1YWxzIiwiaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwidGFibGVJZHMiLCJsaW1pdCIsIkluZmluaXR5IiwiUHJvbWlzZSIsImFsbCIsIm1hcCIsImNhY2hlUHJvbWlzZSIsIm1vZGVsIiwidGFibGVzIiwiYnVpbGRDYWNoZSIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJsZW5ndGgiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX2xpbWl0UHJvbWlzZXMiLCJpdGVyYXRpb25SZXNldCIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiZ2V0U29ydEhhc2giLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiaXRlcmF0ZSIsIl9jYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJlcnIiLCJyZXNvbHZlIiwicmVqZWN0IiwiX2l0ZXJhdGUiLCJfY2FjaGVQcm9taXNlIiwiX3BhcnRpYWxDYWNoZUxvb2t1cCIsIml0ZXJhdG9yIiwiZG9uZSIsIm5leHQiLCJoYW5kbGVSZXNldCIsIl9maW5pc2hJdGVtIiwiTnVtYmVyIiwiX2NhY2hlTG9va3VwIiwicmVzZXQiLCJkZXJpdmVkVGFibGUiLCJjb3VudFJvd3MiLCJ3cmFwcGVkSXRlbSIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZ2V0SW5kZXhEZXRhaWxzIiwiZGV0YWlscyIsInN1cHByZXNzZWQiLCJmaWx0ZXJlZCIsImdldEF0dHJpYnV0ZURldGFpbHMiLCJhbGxBdHRycyIsImV4cGVjdGVkIiwib2JzZXJ2ZWQiLCJkZXJpdmVkIiwiY3VycmVudERhdGEiLCJkYXRhIiwiY29tcGxldGUiLCJkZXJpdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJzdXBwcmVzc0F0dHJpYnV0ZSIsImFkZEZpbHRlciIsIl9kZXJpdmVUYWJsZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGUiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsImFnZ3JlZ2F0ZSIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY2xvc2VkVHJhbnNwb3NlIiwiaW5kZXhlcyIsIm9wZW5UcmFuc3Bvc2UiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJvdGhlclRhYmxlIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJwYXJlbnRUYWJsZSIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkFnZ3JlZ2F0ZWRUYWJsZSIsIl9hdHRyaWJ1dGUiLCJ0ZW1wQ2FjaGUiLCJ3cmFwcGVkUGFyZW50IiwiU3RyaW5nIiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsIkZhY2V0ZWRUYWJsZSIsIl92YWx1ZSIsIlRyYW5zcG9zZWRUYWJsZSIsIl9pbmRleCIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsImJhc2VQYXJlbnRUYWJsZSIsIm90aGVyUGFyZW50VGFibGVzIiwiR2VuZXJpY0NsYXNzIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb25zIiwic2V0Q2xhc3NOYW1lIiwiaGFzQ3VzdG9tTmFtZSIsInZhcmlhYmxlTmFtZSIsImZpbHRlciIsImQiLCJ0b0xvY2FsZVVwcGVyQ2FzZSIsImRlbGV0ZWQiLCJpbnRlcnByZXRBc05vZGVzIiwib3ZlcndyaXRlIiwiY3JlYXRlQ2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiX2Rlcml2ZU5ld0NsYXNzIiwiZ2V0U2FtcGxlR3JhcGgiLCJyb290Q2xhc3MiLCJOb2RlV3JhcHBlciIsImVkZ2VzIiwiZWRnZUlkcyIsImNsYXNzSWRzIiwiZWRnZUNsYXNzSWRzIiwiZWRnZUlkIiwiZWRnZUNsYXNzIiwicm9sZSIsImdldEVkZ2VSb2xlIiwicmV2ZXJzZSIsImNvbmNhdCIsInBhaXJ3aXNlTmVpZ2hib3Job29kIiwiZWRnZSIsInBhaXJ3aXNlRWRnZXMiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NlcyIsImVkZ2VDbGFzc0lkIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJhdXRvY29ubmVjdCIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImlzU291cmNlIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJub2RlQ2xhc3MiLCJ0YWJsZUlkTGlzdCIsImRpcmVjdGVkIiwic291cmNlRWRnZUNsYXNzIiwidGFyZ2V0RWRnZUNsYXNzIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJuZXdOb2RlQ2xhc3MiLCJjb25uZWN0ZWRDbGFzc2VzIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VOb2RlcyIsInNvdXJjZVRhYmxlSWQiLCJ0YXJnZXROb2RlcyIsInRhcmdldFRhYmxlSWQiLCJub2RlcyIsInNvdXJjZSIsInRhcmdldCIsImh5cGVyZWRnZSIsInNvdXJjZXMiLCJ0YXJnZXRzIiwiRWRnZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsIl9zcGxpdFRhYmxlSWRMaXN0Iiwib3RoZXJDbGFzcyIsIm5vZGVUYWJsZUlkTGlzdCIsImVkZ2VUYWJsZUlkIiwiZWRnZVRhYmxlSWRMaXN0Iiwic3RhdGljRXhpc3RzIiwidGFibGVEaXN0YW5jZXMiLCJzdGFydHNXaXRoIiwiZGlzdCIsIk1hdGgiLCJhYnMiLCJzb3J0IiwiYSIsImIiLCJzaWRlIiwiY29ubmVjdFNvdXJjZSIsImNvbm5lY3RUYXJnZXQiLCJ0b2dnbGVEaXJlY3Rpb24iLCJzd2FwcGVkRGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwidW5zaGlmdCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiREFUQUxJQl9GT1JNQVRTIiwiTmV0d29ya01vZGVsIiwib3JpZ3JhcGgiLCJtb2RlbElkIiwiX29yaWdyYXBoIiwiX25leHRDbGFzc0lkIiwiX25leHRUYWJsZUlkIiwiaHlkcmF0ZSIsIkNMQVNTRVMiLCJUQUJMRVMiLCJfc2F2ZVRpbWVvdXQiLCJzYXZlIiwidW5zYXZlZCIsInJhd09iamVjdCIsIlRZUEVTIiwic2VsZWN0b3IiLCJmaW5kQ2xhc3MiLCJyZW5hbWUiLCJuZXdOYW1lIiwiYW5ub3RhdGUiLCJrZXkiLCJkZWxldGVBbm5vdGF0aW9uIiwiZGVsZXRlTW9kZWwiLCJtb2RlbHMiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsIm1pbWUiLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsImNvbnNvbGUiLCJ3YXJuIiwidGV4dCIsInJlYWRlciIsIkZpbGVSZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImxvb2t1cCIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJicmFuY2hMaW1pdCIsIm5vZGVMaW1pdCIsImVkZ2VMaW1pdCIsInRyaXBsZUxpbWl0Iiwic2FtcGxlR3JhcGgiLCJub2RlTG9va3VwIiwiZWRnZUxvb2t1cCIsImxpbmtzIiwibnVtVHJpcGxlcyIsImFkZE5vZGUiLCJub2RlIiwiYWRkRWRnZSIsImFkZFRyaXBsZSIsImNsYXNzTGlzdCIsImdldEluc3RhbmNlR3JhcGgiLCJpbnN0YW5jZXMiLCJncmFwaCIsImVkZ2VUYWJsZUVudHJpZXMiLCJpbnN0YW5jZSIsIm5vZGVJbnN0YW5jZSIsImR1bW15IiwiZWRnZUluc3RhbmNlIiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJyYXciLCJpbmNsdWRlRHVtbWllcyIsImNsYXNzTG9va3VwIiwiY2xhc3NDb25uZWN0aW9ucyIsImNsYXNzU3BlYyIsImlkIiwibG9jYXRpb24iLCJnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCIsInRhYmxlTG9va3VwIiwidGFibGVMaW5rcyIsInRhYmxlTGlzdCIsInRhYmxlU3BlYyIsImdldE1vZGVsRHVtcCIsInJhd09iaiIsIkpTT04iLCJwYXJzZSIsInN0cmluZ2lmeSIsImFIYXNoIiwiYkhhc2giLCJjcmVhdGVTY2hlbWFNb2RlbCIsIm5ld01vZGVsIiwiY3JlYXRlTW9kZWwiLCJzb3VyY2VDbGFzc2VzIiwidGFyZ2V0Q2xhc3NlcyIsInRhYmxlRGVwZW5kZW5jaWVzIiwiY29yZVRhYmxlcyIsIk5FWFRfTU9ERUxfSUQiLCJPcmlncmFwaCIsImxvY2FsU3RvcmFnZSIsInBsdWdpbnMiLCJleGlzdGluZ01vZGVscyIsImdldEl0ZW0iLCJfY3VycmVudE1vZGVsSWQiLCJyZWdpc3RlclBsdWdpbiIsInBsdWdpbiIsInNldEl0ZW0iLCJjbG9zZUN1cnJlbnRNb2RlbCIsImN1cnJlbnRNb2RlbCIsImN1cnJlbnRNb2RlbElkIiwiZGVsZXRlQWxsTW9kZWxzIiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FB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
