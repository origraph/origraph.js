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

  iterate(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Generic caching stuff; this isn't just for performance. ConnectedTable's
      // algorithm requires that its parent tables have pre-built indexes (we
      // technically could implement it differently, but it would be expensive,
      // requires tricky logic, and we're already building indexes for some tables
      // like AggregatedTable anyway)
      if (options.reset) {
        _this.reset();
      }

      if (_this._cache) {
        const limit = options.limit === undefined ? Infinity : options.limit;
        yield* _asyncGeneratorDelegate(_asyncIterator(Object.values(_this._cache).slice(0, limit)), _awaitAsyncGenerator);
        return;
      }

      yield* _asyncGeneratorDelegate(_asyncIterator((yield _awaitAsyncGenerator(_this._buildCache(options)))), _awaitAsyncGenerator);
    })();
  }

  _buildCache(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      // TODO: in large data scenarios, we should build the cache / index
      // externally on disk
      _this2._partialCache = {};
      const limit = options.limit === undefined ? Infinity : options.limit;
      delete options.limit;

      const iterator = _this2._iterate(options);

      let completed = false;

      for (let i = 0; i < limit; i++) {
        const temp = yield _awaitAsyncGenerator(iterator.next());

        if (!_this2._partialCache) {
          // iteration was cancelled; return immediately
          return;
        }

        if (temp.done) {
          completed = true;
          break;
        } else {
          if (yield _awaitAsyncGenerator(_this2._finishItem(temp.value))) {
            _this2._partialCache[temp.value.index] = temp.value;
            yield temp.value;
          }
        }
      }

      if (completed) {
        _this2._cache = _this2._partialCache;
      }

      delete _this2._partialCache;
    })();
  }

  _iterate(options) {
    return _wrapAsyncGenerator(function* () {
      throw new Error(`this function should be overridden`);
    })();
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

  reset() {
    delete this._partialCache;
    delete this._cache;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  get name() {
    throw new Error(`this function should be overridden`);
  }

  async buildCache() {
    if (this._cache) {
      return this._cache;
    } else if (this._cachePromise) {
      return this._cachePromise;
    } else {
      this._cachePromise = new Promise(async (resolve, reject) => {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(this._buildCache()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          } // eslint-disable-line no-unused-vars

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

        delete this._cachePromise;
        resolve(this._cache);
      });
      return this._cachePromise;
    }
  }

  async countRows() {
    const cache = await this.buildCache();
    return cache ? Object.keys(cache).length : -1;
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
    return {
      data: this._cache || this._partialCache || {},
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
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      const values = {};
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this3.iterate({
          limit
        })), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedItem = _value2;
          const value = yield _awaitAsyncGenerator(wrappedItem.row[attribute]);

          if (!values[value]) {
            values[value] = true;
            const options = {
              type: 'FacetedTable',
              attribute,
              value
            };
            yield _this3._getExistingTable(options) || _this3._deriveTable(options);
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
    var _this4 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator(_this4.iterate({
          limit
        })), _step3, _value3; _step3 = yield _awaitAsyncGenerator(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
          const wrappedItem = _value3;
          const options = {
            type: 'TransposedTable',
            index: wrappedItem.index
          };
          yield _this4._getExistingTable(options) || _this4._deriveTable(options);
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

  _iterate(options) {
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

  _iterate(options) {
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

  _buildCache(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // We override _buildCache so that AggregatedTable can take advantage
      // of the partially-built cache as it goes, and postpone finishing items
      // until after the parent table has been fully iterated
      // TODO: in large data scenarios, we should build the cache / index
      // externally on disk
      _this._partialCache = {};
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this._iterate(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedItem = _value;
          _this._partialCache[wrappedItem.index] = wrappedItem; // Go ahead and yield the unfinished item; this makes it possible for
          // client apps to be more responsive and render partial results, but also
          // means that they need to watch for wrappedItem.on('finish') events

          yield wrappedItem;
        } // Second pass: now that we've completed the full iteration of the parent
        // table, we can finish each item

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

      for (const index in _this._partialCache) {
        const wrappedItem = _this._partialCache[index];

        if (!(yield _awaitAsyncGenerator(_this._finishItem(wrappedItem)))) {
          delete _this._partialCache[index];
        }
      }

      _this._cache = _this._partialCache;
      delete _this._partialCache;
    })();
  }

  _iterate(options) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this2.parentTable;
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(parentTable.iterate(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedParent = _value2;
          const index = String((yield _awaitAsyncGenerator(wrappedParent.row[_this2._attribute])));

          if (!_this2._partialCache) {
            // We were reset; return immediately
            return;
          } else if (_this2._partialCache[index]) {
            const existingItem = _this2._partialCache[index];
            existingItem.connectItem(wrappedParent);
            wrappedParent.connectItem(existingItem);
          } else {
            const newItem = _this2._wrap({
              index,
              itemsToConnect: [wrappedParent]
            });

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

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let index = 0;
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
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

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Pre-build the parent table's cache
      const parentTable = _this.parentTable;
      yield _awaitAsyncGenerator(parentTable.buildCache()); // Iterate the row's attributes as indexes

      const wrappedParent = parentTable._cache[_this._index] || {
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

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTables = _this.parentTables; // Spin through all of the parentTables so that their _cache is pre-built

      for (const parentTable of parentTables) {
        yield _awaitAsyncGenerator(parentTable.buildCache());
      } // Now that the caches are built, just iterate their keys directly. We only
      // care about including rows that have exact matches across all tables, so
      // we can just pick one parent table to iterate


      const baseParentTable = parentTables[0];
      const otherParentTables = parentTables.slice(1);

      for (const index in baseParentTable._cache) {
        if (!parentTables.every(table => table._cache)) {
          // One of the parent tables was reset; return immediately
          return;
        }

        if (!otherParentTables.every(table => table._cache[index])) {
          // No match in one of the other tables; omit this item
          continue;
        } // TODO: add each parent tables' keys as attribute values


        const newItem = _this._wrap({
          index,
          itemsToConnect: parentTables.map(table => table._cache[index])
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
            for (var _iterator5 = _asyncIterator(classObj.table.iterate({
              limit: 5
            })), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguY2pzLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRmFjZXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UcmFuc3Bvc2VkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdIHx8XG4gICAgICAgIHsgJyc6IFtdIH07XG4gICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10ucHVzaChjYWxsYmFjayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdID0gY2FsbGJhY2s7XG4gICAgICB9XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddID0gW107XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudCwgLi4uYXJncykge1xuICAgICAgY29uc3QgaGFuZGxlQ2FsbGJhY2sgPSBjYWxsYmFjayA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWVzcGFjZSBvZiBPYmplY3Qua2V5cyh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkpIHtcbiAgICAgICAgICBpZiAobmFtZXNwYWNlID09PSAnJykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmZvckVhY2goaGFuZGxlQ2FsbGJhY2spO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoYW5kbGVDYWxsYmFjayh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLnRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGFuZCB0YWJsZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc09iaiA9IG9wdGlvbnMuY2xhc3NPYmogfHwgbnVsbDtcbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSBvcHRpb25zLmNvbm5lY3RlZEl0ZW1zIHx8IHt9O1xuICB9XG4gIGNvbm5lY3RJdGVtIChpdGVtKSB7XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdIHx8IFtdO1xuICAgIGlmICh0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0uaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XyR7dGhpcy5pbmRleH1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAoeyB0YWJsZUlkcywgbGltaXQgPSBJbmZpbml0eSB9KSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIGNvbnN0IGNhY2hlUHJvbWlzZSA9IHRoaXMuY2xhc3NPYmoubW9kZWwudGFibGVzW3RhYmxlSWRdLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHJldHVybiBjYWNoZVByb21pc2U7XG4gICAgfSkpO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSkge1xuICAgICAgeWllbGQgaXRlbTtcbiAgICAgIGkrKztcbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBHZW5lcmljIGNhY2hpbmcgc3R1ZmY7IHRoaXMgaXNuJ3QganVzdCBmb3IgcGVyZm9ybWFuY2UuIENvbm5lY3RlZFRhYmxlJ3NcbiAgICAvLyBhbGdvcml0aG0gcmVxdWlyZXMgdGhhdCBpdHMgcGFyZW50IHRhYmxlcyBoYXZlIHByZS1idWlsdCBpbmRleGVzICh3ZVxuICAgIC8vIHRlY2huaWNhbGx5IGNvdWxkIGltcGxlbWVudCBpdCBkaWZmZXJlbnRseSwgYnV0IGl0IHdvdWxkIGJlIGV4cGVuc2l2ZSxcbiAgICAvLyByZXF1aXJlcyB0cmlja3kgbG9naWMsIGFuZCB3ZSdyZSBhbHJlYWR5IGJ1aWxkaW5nIGluZGV4ZXMgZm9yIHNvbWUgdGFibGVzXG4gICAgLy8gbGlrZSBBZ2dyZWdhdGVkVGFibGUgYW55d2F5KVxuICAgIGlmIChvcHRpb25zLnJlc2V0KSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQgPT09IHVuZGVmaW5lZCA/IEluZmluaXR5IDogb3B0aW9ucy5saW1pdDtcbiAgICAgIHlpZWxkICogT2JqZWN0LnZhbHVlcyh0aGlzLl9jYWNoZSkuc2xpY2UoMCwgbGltaXQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHlpZWxkICogYXdhaXQgdGhpcy5fYnVpbGRDYWNoZShvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpO1xuICAgIGxldCBjb21wbGV0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBpdGVyYXRpb24gd2FzIGNhbmNlbGxlZDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgY29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKSkge1xuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt0ZW1wLnZhbHVlLmluZGV4XSA9IHRlbXAudmFsdWU7XG4gICAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gd3JhcHBlZEl0ZW0ucm93KSB7XG4gICAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGRlbGV0ZSB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBhd2FpdCBmdW5jKGF3YWl0IHdyYXBwZWRJdGVtLnJvd1thdHRyXSk7XG4gICAgICBpZiAoIWtlZXApIHsgYnJlYWs7IH1cbiAgICB9XG4gICAgaWYgKGtlZXApIHtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3cmFwcGVkSXRlbS5kaXNjb25uZWN0KCk7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaWx0ZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIGtlZXA7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgYnVpbGRDYWNoZSAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGU7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0ZW1wIG9mIHRoaXMuX2J1aWxkQ2FjaGUoKSkge30gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgICAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgY291bnRSb3dzICgpIHtcbiAgICBjb25zdCBjYWNoZSA9IGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpO1xuICAgIHJldHVybiBjYWNoZSA/IE9iamVjdC5rZXlzKGNhY2hlKS5sZW5ndGggOiAtMTtcbiAgfVxuICBnZXRJbmRleERldGFpbHMgKCkge1xuICAgIGNvbnN0IGRldGFpbHMgPSB7IG5hbWU6IG51bGwgfTtcbiAgICBpZiAodGhpcy5fc3VwcHJlc3NJbmRleCkge1xuICAgICAgZGV0YWlscy5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBkZXRhaWxzLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRldGFpbHM7XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHN1cHByZXNzQXR0cmlidXRlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFkZEZpbHRlciAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKHsgbGltaXQgfSkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiBpbmRleGVzLm1hcChpbmRleCA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXhcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXg6IHdyYXBwZWRJdGVtLmluZGV4XG4gICAgICB9O1xuICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJ1xuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIGdldCBjbGFzc09iaiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZSA9PT0gdGhpcztcbiAgICB9KTtcbiAgfVxuICBnZXQgcGFyZW50VGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKTtcbiAgfVxuICBnZXQgZGVyaXZlZFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXTtcbiAgICB9KTtcbiAgfVxuICBnZXQgaW5Vc2UgKCkge1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5zb21lKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZUlkID09PSB0aGlzLnRhYmxlSWQgfHxcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMSB8fFxuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUYWJsZSwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVGFibGUvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IFtdO1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpcmVkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEFnZ3JlZ2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuICfihqYnICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBzbyB0aGF0IEFnZ3JlZ2F0ZWRUYWJsZSBjYW4gdGFrZSBhZHZhbnRhZ2VcbiAgICAvLyBvZiB0aGUgcGFydGlhbGx5LWJ1aWx0IGNhY2hlIGFzIGl0IGdvZXMsIGFuZCBwb3N0cG9uZSBmaW5pc2hpbmcgaXRlbXNcbiAgICAvLyB1bnRpbCBhZnRlciB0aGUgcGFyZW50IHRhYmxlIGhhcyBiZWVuIGZ1bGx5IGl0ZXJhdGVkXG5cbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbd3JhcHBlZEl0ZW0uaW5kZXhdID0gd3JhcHBlZEl0ZW07XG4gICAgICAvLyBHbyBhaGVhZCBhbmQgeWllbGQgdGhlIHVuZmluaXNoZWQgaXRlbTsgdGhpcyBtYWtlcyBpdCBwb3NzaWJsZSBmb3JcbiAgICAgIC8vIGNsaWVudCBhcHBzIHRvIGJlIG1vcmUgcmVzcG9uc2l2ZSBhbmQgcmVuZGVyIHBhcnRpYWwgcmVzdWx0cywgYnV0IGFsc29cbiAgICAgIC8vIG1lYW5zIHRoYXQgdGhleSBuZWVkIHRvIHdhdGNoIGZvciB3cmFwcGVkSXRlbS5vbignZmluaXNoJykgZXZlbnRzXG4gICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICB9XG5cbiAgICAvLyBTZWNvbmQgcGFzczogbm93IHRoYXQgd2UndmUgY29tcGxldGVkIHRoZSBmdWxsIGl0ZXJhdGlvbiBvZiB0aGUgcGFyZW50XG4gICAgLy8gdGFibGUsIHdlIGNhbiBmaW5pc2ggZWFjaCBpdGVtXG4gICAgZm9yIChjb25zdCBpbmRleCBpbiB0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIGlmICghYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSkpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgaW5kZXggPSBTdHJpbmcoYXdhaXQgd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEFnZ3JlZ2F0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmFjZXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICB0aGlzLl92YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlICsgdGhpcy5fdmFsdWU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgWyR7dGhpcy5fdmFsdWV9XWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBpZiAoYXdhaXQgd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gTm9ybWFsIGZhY2V0aW5nIGp1c3QgZ2l2ZXMgYSBzdWJzZXQgb2YgdGhlIG9yaWdpbmFsIHRhYmxlXG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IE9iamVjdC5hc3NpZ24oe30sIHdyYXBwZWRQYXJlbnQucm93KSxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmFjZXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBUcmFuc3Bvc2VkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2luZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5faW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5pbmRleCA9IHRoaXMuX2luZGV4O1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5faW5kZXg7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBg4bWAJHt0aGlzLl9pbmRleH1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcblxuICAgIC8vIEl0ZXJhdGUgdGhlIHJvdydzIGF0dHJpYnV0ZXMgYXMgaW5kZXhlc1xuICAgIGNvbnN0IHdyYXBwZWRQYXJlbnQgPSBwYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5faW5kZXhdIHx8IHsgcm93OiB7fSB9O1xuICAgIGZvciAoY29uc3QgWyBpbmRleCwgdmFsdWUgXSBvZiBPYmplY3QuZW50cmllcyh3cmFwcGVkUGFyZW50LnJvdykpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5nZXRTb3J0SGFzaCgpKS5qb2luKCcsJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIFNwaW4gdGhyb3VnaCBhbGwgb2YgdGhlIHBhcmVudFRhYmxlcyBzbyB0aGF0IHRoZWlyIF9jYWNoZSBpcyBwcmUtYnVpbHRcbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgYXdhaXQgcGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuICAgIH1cbiAgICAvLyBOb3cgdGhhdCB0aGUgY2FjaGVzIGFyZSBidWlsdCwganVzdCBpdGVyYXRlIHRoZWlyIGtleXMgZGlyZWN0bHkuIFdlIG9ubHlcbiAgICAvLyBjYXJlIGFib3V0IGluY2x1ZGluZyByb3dzIHRoYXQgaGF2ZSBleGFjdCBtYXRjaGVzIGFjcm9zcyBhbGwgdGFibGVzLCBzb1xuICAgIC8vIHdlIGNhbiBqdXN0IHBpY2sgb25lIHBhcmVudCB0YWJsZSB0byBpdGVyYXRlXG4gICAgY29uc3QgYmFzZVBhcmVudFRhYmxlID0gcGFyZW50VGFibGVzWzBdO1xuICAgIGNvbnN0IG90aGVyUGFyZW50VGFibGVzID0gcGFyZW50VGFibGVzLnNsaWNlKDEpO1xuICAgIGZvciAoY29uc3QgaW5kZXggaW4gYmFzZVBhcmVudFRhYmxlLl9jYWNoZSkge1xuICAgICAgaWYgKCFwYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlKSkge1xuICAgICAgICAvLyBPbmUgb2YgdGhlIHBhcmVudCB0YWJsZXMgd2FzIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCFvdGhlclBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbaW5kZXhdKSkge1xuICAgICAgICAvLyBObyBtYXRjaCBpbiBvbmUgb2YgdGhlIG90aGVyIHRhYmxlczsgb21pdCB0aGlzIGl0ZW1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBhZGQgZWFjaCBwYXJlbnQgdGFibGVzJyBrZXlzIGFzIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBwYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMubW9kZWwgfHwgIXRoaXMuY2xhc3NJZCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsLCBjbGFzc0lkLCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBvcHRpb25zLmFubm90YXRpb25zIHx8IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGNsYXNzTmFtZTogdGhpcy5fY2xhc3NOYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnNcbiAgICB9O1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlICsgdGhpcy5jbGFzc05hbWU7XG4gIH1cbiAgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIHRoaXMuX2NsYXNzTmFtZSA9IHZhbHVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgIT09IG51bGw7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fCB0aGlzLnRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0IHZhcmlhYmxlTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZS50b0xvY2FsZUxvd2VyQ2FzZSgpICsgJ18nICtcbiAgICAgIHRoaXMuY2xhc3NOYW1lXG4gICAgICAgIC5zcGxpdCgvXFxXKy9nKVxuICAgICAgICAuZmlsdGVyKGQgPT4gZC5sZW5ndGggPiAwKVxuICAgICAgICAubWFwKGQgPT4gZFswXS50b0xvY2FsZVVwcGVyQ2FzZSgpICsgZC5zbGljZSgxKSlcbiAgICAgICAgLmpvaW4oJycpO1xuICB9XG4gIGdldCB0YWJsZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVJZF07XG4gIH1cbiAgZ2V0IGRlbGV0ZWQgKCkge1xuICAgIHJldHVybiAhdGhpcy5tb2RlbC5kZWxldGVkICYmIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgX2Rlcml2ZU5ld0NsYXNzIChuZXdUYWJsZSwgdHlwZSA9IHRoaXMuY29uc3RydWN0b3IubmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlXG4gICAgfSk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKSk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkVHJhbnNwb3NlKGluZGV4ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAoKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5UcmFuc3Bvc2UoKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGdldFNhbXBsZUdyYXBoIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5yb290Q2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmdldFNhbXBsZUdyYXBoKG9wdGlvbnMpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogZWRnZXMgKG9wdGlvbnMgPSB7IGxpbWl0OiBJbmZpbml0eSB9KSB7XG4gICAgbGV0IGVkZ2VJZHMgPSBvcHRpb25zLmNsYXNzZXNcbiAgICAgID8gb3B0aW9ucy5jbGFzc2VzLm1hcChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc0lkKVxuICAgICAgOiBvcHRpb25zLmNsYXNzSWRzIHx8IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBlZGdlSWQgb2YgZWRnZUlkcykge1xuICAgICAgaWYgKCF0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tlZGdlSWRdKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5jbGFzc09iai5tb2RlbC5jbGFzc2VzW2VkZ2VJZF07XG4gICAgICBjb25zdCByb2xlID0gdGhpcy5jbGFzc09iai5nZXRFZGdlUm9sZShlZGdlQ2xhc3MpO1xuICAgICAgb3B0aW9ucy50YWJsZUlkcyA9IFtdO1xuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAnc291cmNlJykge1xuICAgICAgICBvcHRpb25zLnRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpKSB7XG4gICAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgaWYgKGkgPj0gb3B0aW9ucy5saW1pdCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAndGFyZ2V0Jykge1xuICAgICAgICBvcHRpb25zLnRhYmxlSWRzID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpKSB7XG4gICAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgaWYgKGkgPj0gb3B0aW9ucy5saW1pdCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlTmVpZ2hib3Job29kIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIHRoaXMuZWRnZXMob3B0aW9ucykpIHtcbiAgICAgIHlpZWxkICogZWRnZS5wYWlyd2lzZUVkZ2VzKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuaW1wb3J0IE5vZGVXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkcyA9IG9wdGlvbnMuZWRnZUNsYXNzSWRzIHx8IHt9O1xuICB9XG4gICogZWRnZUNsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBnZXRFZGdlUm9sZSAoZWRnZUNsYXNzKSB7XG4gICAgaWYgKCF0aGlzLmVkZ2VDbGFzc0lkc1tlZGdlQ2xhc3MuY2xhc3NJZF0pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgcmV0dXJuICdib3RoJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnc291cmNlJztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgIHJldHVybiAndGFyZ2V0JztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnRlcm5hbCBtaXNtYXRjaCBiZXR3ZWVuIG5vZGUgYW5kIGVkZ2UgY2xhc3NJZHNgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuZWRnZUNsYXNzSWRzID0gdGhpcy5lZGdlQ2xhc3NJZHM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgTm9kZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoeyBhdXRvY29ubmVjdCA9IGZhbHNlIH0pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgaWYgKCFhdXRvY29ubmVjdCB8fCBlZGdlQ2xhc3NJZHMubGVuZ3RoID4gMikge1xuICAgICAgLy8gSWYgdGhlcmUgYXJlIG1vcmUgdGhhbiB0d28gZWRnZXMsIGJyZWFrIGFsbCBjb25uZWN0aW9ucyBhbmQgbWFrZVxuICAgICAgLy8gdGhpcyBhIGZsb2F0aW5nIGVkZ2UgKGZvciBub3csIHdlJ3JlIG5vdCBkZWFsaW5nIGluIGh5cGVyZWRnZXMpXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gV2l0aCBvbmx5IG9uZSBjb25uZWN0aW9uLCB0aGlzIG5vZGUgc2hvdWxkIGJlY29tZSBhIHNlbGYtZWRnZVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAvLyBBcmUgd2UgdGhlIHNvdXJjZSBvciB0YXJnZXQgb2YgdGhlIGV4aXN0aW5nIGVkZ2UgKGludGVybmFsbHksIGluIHRlcm1zXG4gICAgICAvLyBvZiBzb3VyY2VJZCAvIHRhcmdldElkLCBub3QgZWRnZUNsYXNzLmRpcmVjdGlvbik/XG4gICAgICBjb25zdCBpc1NvdXJjZSA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQ7XG5cbiAgICAgIC8vIEFzIHdlJ3JlIGNvbnZlcnRlZCB0byBhbiBlZGdlLCBvdXIgbmV3IHJlc3VsdGluZyBzb3VyY2UgQU5EIHRhcmdldFxuICAgICAgLy8gc2hvdWxkIGJlIHdoYXRldmVyIGlzIGF0IHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzIChpZiBhbnl0aGluZylcbiAgICAgIGlmIChpc1NvdXJjZSkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgICAgfVxuICAgICAgLy8gSWYgdGhlcmUgaXMgYSBub2RlIGNsYXNzIG9uIHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzLCBhZGQgb3VyXG4gICAgICAvLyBpZCB0byBpdHMgbGlzdCBvZiBjb25uZWN0aW9uc1xuICAgICAgY29uc3Qgbm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF07XG4gICAgICBpZiAobm9kZUNsYXNzKSB7XG4gICAgICAgIG5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIHRhYmxlSWQgbGlzdHMgc2hvdWxkIGVtYW5hdGUgb3V0IGZyb20gdGhlIChuZXcpIGVkZ2UgdGFibGU7IGFzc3VtaW5nXG4gICAgICAvLyAoZm9yIGEgbW9tZW50KSB0aGF0IGlzU291cmNlID09PSB0cnVlLCB3ZSdkIGNvbnN0cnVjdCB0aGUgdGFibGVJZCBsaXN0XG4gICAgICAvLyBsaWtlIHRoaXM6XG4gICAgICBsZXQgdGFibGVJZExpc3QgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIGVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICghaXNTb3VyY2UpIHtcbiAgICAgICAgLy8gV2hvb3BzLCBnb3QgaXQgYmFja3dhcmRzIVxuICAgICAgICB0YWJsZUlkTGlzdC5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YWJsZUlkTGlzdDtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIC8vIE9rYXksIHdlJ3ZlIGdvdCB0d28gZWRnZXMsIHNvIHRoaXMgaXMgYSBsaXR0bGUgbW9yZSBzdHJhaWdodGZvcndhcmRcbiAgICAgIGxldCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIGxldCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGRpcmVjdGlvbiwgaWYgdGhlcmUgaXMgb25lXG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLmRpcmVjdGVkICYmIHRhcmdldEVkZ2VDbGFzcy5kaXJlY3RlZCkge1xuICAgICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGhhcHBlbmVkIHRvIGdldCB0aGUgZWRnZXMgaW4gb3JkZXI7IHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBnb3QgdGhlIGVkZ2VzIGJhY2t3YXJkczsgc3dhcCB0aGVtIGFuZCBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICAgIHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBub3cgd2Uga25vdyBob3cgdG8gc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IHNvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICAvLyBBZGQgdGhpcyBjbGFzcyB0byB0aGUgc291cmNlJ3MgLyB0YXJnZXQncyBlZGdlQ2xhc3NJZHNcbiAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnRhcmdldENsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIC8vIENvbmNhdGVuYXRlIHRoZSBpbnRlcm1lZGlhdGUgdGFibGVJZCBsaXN0cywgZW1hbmF0aW5nIG91dCBmcm9tIHRoZVxuICAgICAgLy8gKG5ldykgZWRnZSB0YWJsZVxuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgc291cmNlRWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChzb3VyY2VFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFyZ2V0RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyB0YXJnZXRFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAodGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIC8vIERpc2Nvbm5lY3QgdGhlIGV4aXN0aW5nIGVkZ2UgY2xhc3NlcyBmcm9tIHRoZSBuZXcgKG5vdyBlZGdlKSBjbGFzc1xuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzSWRzO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBhdHRyaWJ1dGUsIG90aGVyQXR0cmlidXRlIH0pIHtcbiAgICBsZXQgdGhpc0hhc2gsIG90aGVySGFzaCwgc291cmNlVGFibGVJZHMsIHRhcmdldFRhYmxlSWRzO1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gWyB0aGlzSGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGlmIChvdGhlckF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGU7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZS5hZ2dyZWdhdGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbIG90aGVySGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIC8vIElmIHdlIGhhdmUgYSBzZWxmIGVkZ2UgY29ubmVjdGluZyB0aGUgc2FtZSBhdHRyaWJ1dGUsIHdlIGNhbiBqdXN0IHVzZVxuICAgIC8vIHRoZSBBZ2dyZWdhdGVkVGFibGUgYXMgdGhlIGVkZ2UgdGFibGU7IG90aGVyd2lzZSB3ZSBuZWVkIHRvIGNyZWF0ZSBhXG4gICAgLy8gQ29ubmVjdGVkVGFibGVcbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXMgPT09IG90aGVyTm9kZUNsYXNzICYmIGF0dHJpYnV0ZSA9PT0gb3RoZXJBdHRyaWJ1dGVcbiAgICAgID8gdGhpc0hhc2ggOiB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdFZGdlQ2xhc3M7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHN1cGVyLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICAgIHRoaXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBuZXdOb2RlQ2xhc3MsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgdGhpcy5jb25uZWN0ZWRDbGFzc2VzKCkpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgb3B0aW9ucy50YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHNcbiAgICAgIC5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkXS50YWJsZUlkO1xuICAgIG9wdGlvbnMudGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnRhcmdldFRhYmxlSWRzXG4gICAgICAuY29uY2F0KFsgdGFyZ2V0VGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogbm9kZXMgKG9wdGlvbnMpIHtcbiAgICB5aWVsZCAqIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucyk7XG4gICAgeWllbGQgKiB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogcGFpcndpc2VFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucykpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucykpIHtcbiAgICAgICAgeWllbGQgeyBzb3VyY2UsIGVkZ2U6IHRoaXMsIHRhcmdldCB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyBoeXBlcmVkZ2UgKG9wdGlvbnMpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBzb3VyY2VzOiBbXSxcbiAgICAgIHRhcmdldHM6IFtdLFxuICAgICAgZWRnZTogdGhpc1xuICAgIH07XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgcmVzdWx0LnB1c2goc291cmNlKTtcbiAgICB9XG4gICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgcmVzdWx0LnB1c2godGFyZ2V0KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBFZGdlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAvLyBzb3VyY2VUYWJsZUlkcyBhbmQgdGFyZ2V0VGFibGVJZHMgYXJlIGxpc3RzIG9mIGFueSBpbnRlcm1lZGlhdGUgdGFibGVzLFxuICAgIC8vIGJlZ2lubmluZyB3aXRoIHRoZSBlZGdlIHRhYmxlIChidXQgbm90IGluY2x1ZGluZyBpdCksIHRoYXQgbGVhZCB0byB0aGVcbiAgICAvLyBzb3VyY2UgLyB0YXJnZXQgbm9kZSB0YWJsZXMgKGJ1dCBub3QgaW5jbHVkaW5nKSB0aG9zZVxuXG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMuc291cmNlVGFibGVJZHMgfHwgW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgfHwgW107XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fFxuICAgICAgKCh0aGlzLnNvdXJjZUNsYXNzICYmIHRoaXMuc291cmNlQ2xhc3MuY2xhc3NOYW1lKSB8fCAnPycpICtcbiAgICAgICctJyArXG4gICAgICAoKHRoaXMudGFyZ2V0Q2xhc3MgJiYgdGhpcy50YXJnZXRDbGFzcy5jbGFzc05hbWUpIHx8ICc/Jyk7XG4gIH1cbiAgZ2V0IHNvdXJjZUNsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBnZXQgdGFyZ2V0Q2xhc3MgKCkge1xuICAgIHJldHVybiAodGhpcy50YXJnZXRDbGFzc0lkICYmIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdKSB8fCBudWxsO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQuc291cmNlVGFibGVJZHMgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBFZGdlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfc3BsaXRUYWJsZUlkTGlzdCAodGFibGVJZExpc3QsIG90aGVyQ2xhc3MpIHtcbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgbm9kZVRhYmxlSWRMaXN0OiBbXSxcbiAgICAgIGVkZ2VUYWJsZUlkOiBudWxsLFxuICAgICAgZWRnZVRhYmxlSWRMaXN0OiBbXVxuICAgIH07XG4gICAgaWYgKHRhYmxlSWRMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gV2VpcmQgY29ybmVyIGNhc2Ugd2hlcmUgd2UncmUgdHJ5aW5nIHRvIGNyZWF0ZSBhbiBlZGdlIGJldHdlZW5cbiAgICAgIC8vIGFkamFjZW50IG9yIGlkZW50aWNhbCB0YWJsZXMuLi4gY3JlYXRlIGEgQ29ubmVjdGVkVGFibGVcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRoaXMudGFibGUuY29ubmVjdChvdGhlckNsYXNzLnRhYmxlKS50YWJsZUlkO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIGEgdGFibGUgaW4gdGhlIG1pZGRsZSBhcyB0aGUgbmV3IGVkZ2UgdGFibGU7IHByaW9yaXRpemVcbiAgICAgIC8vIFN0YXRpY1RhYmxlIGFuZCBTdGF0aWNEaWN0VGFibGVcbiAgICAgIGxldCBzdGF0aWNFeGlzdHMgPSBmYWxzZTtcbiAgICAgIGxldCB0YWJsZURpc3RhbmNlcyA9IHRhYmxlSWRMaXN0Lm1hcCgodGFibGVJZCwgaW5kZXgpID0+IHtcbiAgICAgICAgc3RhdGljRXhpc3RzID0gc3RhdGljRXhpc3RzIHx8IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIHJldHVybiB7IHRhYmxlSWQsIGluZGV4LCBkaXN0OiBNYXRoLmFicyh0YWJsZUlkTGlzdCAvIDIgLSBpbmRleCkgfTtcbiAgICAgIH0pO1xuICAgICAgaWYgKHN0YXRpY0V4aXN0cykge1xuICAgICAgICB0YWJsZURpc3RhbmNlcyA9IHRhYmxlRGlzdGFuY2VzLmZpbHRlcigoeyB0YWJsZUlkIH0pID0+IHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCB7IHRhYmxlSWQsIGluZGV4IH0gPSB0YWJsZURpc3RhbmNlcy5zb3J0KChhLCBiKSA9PiBhLmRpc3QgLSBiLmRpc3QpWzBdO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGFibGVJZDtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZSgwLCBpbmRleCkucmV2ZXJzZSgpO1xuICAgICAgcmVzdWx0Lm5vZGVUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKGluZGV4ICsgMSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgdGVtcC50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgdGVtcC5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3ModGVtcCk7XG5cbiAgICBpZiAodGVtcC5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAuc291cmNlVGFibGVJZHMsIHNvdXJjZUNsYXNzKTtcbiAgICAgIGNvbnN0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0ZW1wLnNvdXJjZUNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGVtcC50YXJnZXRDbGFzc0lkICYmIHRlbXAuc291cmNlQ2xhc3NJZCAhPT0gdGVtcC50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnRhcmdldENsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAudGFyZ2V0VGFibGVJZHMsIHRhcmdldENsYXNzKTtcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgc291cmNlVGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogdGVtcC50YXJnZXRDbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5zaWRlID09PSAnc291cmNlJykge1xuICAgICAgdGhpcy5jb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5zaWRlID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBvbGl0aWNhbE91dHNpZGVyRXJyb3I6IFwiJHtvcHRpb25zLnNpZGV9XCIgaXMgYW4gaW52YWxpZCBzaWRlYCk7XG4gICAgfVxuICB9XG4gIHRvZ2dsZURpcmVjdGlvbiAoZGlyZWN0ZWQpIHtcbiAgICBpZiAoZGlyZWN0ZWQgPT09IGZhbHNlIHx8IHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgZGVsZXRlIHRoaXMuc3dhcHBlZERpcmVjdGlvbjtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmRpcmVjdGVkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEaXJlY3RlZCB3YXMgYWxyZWFkeSB0cnVlLCBqdXN0IHN3aXRjaCBzb3VyY2UgYW5kIHRhcmdldFxuICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgdGVtcCA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSB0ZW1wO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyBzb3VyY2VDbGFzcy50YWJsZSA6IHNvdXJjZUNsYXNzLnRhYmxlLmFnZ3JlZ2F0ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUuYWdncmVnYXRlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRhcmdldENsYXNzLnRhYmxlIDogdGFyZ2V0Q2xhc3MudGFibGUuYWdncmVnYXRlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZSAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdTb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1NvdXJjZUNsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdTb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1RhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nVGFyZ2V0Q2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1RhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcblxuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4uL1RhYmxlcy9UYWJsZXMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuXG5jb25zdCBEQVRBTElCX0ZPUk1BVFMgPSB7XG4gICdqc29uJzogJ2pzb24nLFxuICAnY3N2JzogJ2NzdicsXG4gICd0c3YnOiAndHN2JyxcbiAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xufTtcblxuY2xhc3MgTmV0d29ya01vZGVsIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoe1xuICAgIG9yaWdyYXBoLFxuICAgIG1vZGVsSWQsXG4gICAgbmFtZSA9IG1vZGVsSWQsXG4gICAgYW5ub3RhdGlvbnMgPSB7fSxcbiAgICBjbGFzc2VzID0ge30sXG4gICAgdGFibGVzID0ge31cbiAgfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fb3JpZ3JhcGggPSBvcmlncmFwaDtcbiAgICB0aGlzLm1vZGVsSWQgPSBtb2RlbElkO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IGFubm90YXRpb25zO1xuICAgIHRoaXMuY2xhc3NlcyA9IHt9O1xuICAgIHRoaXMudGFibGVzID0ge307XG5cbiAgICB0aGlzLl9uZXh0Q2xhc3NJZCA9IDE7XG4gICAgdGhpcy5fbmV4dFRhYmxlSWQgPSAxO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKGNsYXNzZXMpKSB7XG4gICAgICB0aGlzLmNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSB0aGlzLmh5ZHJhdGUoY2xhc3NPYmosIENMQVNTRVMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIE9iamVjdC52YWx1ZXModGFibGVzKSkge1xuICAgICAgdGhpcy50YWJsZXNbdGFibGUudGFibGVJZF0gPSB0aGlzLmh5ZHJhdGUodGFibGUsIFRBQkxFUyk7XG4gICAgfVxuXG4gICAgdGhpcy5vbigndXBkYXRlJywgKCkgPT4ge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3NhdmVUaW1lb3V0KTtcbiAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuX29yaWdyYXBoLnNhdmUoKTtcbiAgICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSB1bmRlZmluZWQ7XG4gICAgICB9LCAwKTtcbiAgICB9KTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IGNsYXNzZXMgPSB7fTtcbiAgICBjb25zdCB0YWJsZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXS50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZU9iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKSkge1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdID0gdGFibGVPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0udHlwZSA9IHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBtb2RlbElkOiB0aGlzLm1vZGVsSWQsXG4gICAgICBuYW1lOiB0aGlzLm5hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9ucyxcbiAgICAgIGNsYXNzZXMsXG4gICAgICB0YWJsZXNcbiAgICB9O1xuICB9XG4gIGdldCB1bnNhdmVkICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc2F2ZVRpbWVvdXQgIT09IHVuZGVmaW5lZDtcbiAgfVxuICBoeWRyYXRlIChyYXdPYmplY3QsIFRZUEVTKSB7XG4gICAgcmF3T2JqZWN0Lm1vZGVsID0gdGhpcztcbiAgICByZXR1cm4gbmV3IFRZUEVTW3Jhd09iamVjdC50eXBlXShyYXdPYmplY3QpO1xuICB9XG4gIGNyZWF0ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgd2hpbGUgKCFvcHRpb25zLnRhYmxlSWQgfHwgKCFvcHRpb25zLm92ZXJ3cml0ZSAmJiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdKSkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHt0aGlzLl9uZXh0VGFibGVJZH1gO1xuICAgICAgdGhpcy5fbmV4dFRhYmxlSWQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSA9IG5ldyBUQUJMRVNbb3B0aW9ucy50eXBlXShvcHRpb25zKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdO1xuICB9XG4gIGNyZWF0ZUNsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYGVtcHR5YCB9KSB7XG4gICAgd2hpbGUgKCFvcHRpb25zLmNsYXNzSWQgfHwgKCFvcHRpb25zLm92ZXJ3cml0ZSAmJiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSkpIHtcbiAgICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7dGhpcy5fbmV4dENsYXNzSWR9YDtcbiAgICAgIHRoaXMuX25leHRDbGFzc0lkICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IENMQVNTRVNbb3B0aW9ucy50eXBlXShvcHRpb25zKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuICBmaW5kQ2xhc3MgKGNsYXNzTmFtZSkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc05hbWUgPT09IGNsYXNzTmFtZSk7XG4gIH1cbiAgcmVuYW1lIChuZXdOYW1lKSB7XG4gICAgdGhpcy5uYW1lID0gbmV3TmFtZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFubm90YXRlIChrZXksIHZhbHVlKSB7XG4gICAgdGhpcy5hbm5vdGF0aW9uc1trZXldID0gdmFsdWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGVBbm5vdGF0aW9uIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5hbm5vdGF0aW9uc1trZXldO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLl9vcmlncmFwaC5kZWxldGVNb2RlbCh0aGlzLm1vZGVsSWQpO1xuICB9XG4gIGdldCBkZWxldGVkICgpIHtcbiAgICByZXR1cm4gdGhpcy5fb3JpZ3JhcGgubW9kZWxzW3RoaXMubW9kZWxJZF07XG4gIH1cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljVGFibGUgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5YCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLl9vcmlncmFwaC5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY1RhYmxlKHtcbiAgICAgIG5hbWU6IGZpbGVPYmoubmFtZSxcbiAgICAgIGV4dGVuc2lvbjogZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24oZmlsZU9iai50eXBlKSxcbiAgICAgIHRleHRcbiAgICB9KTtcbiAgfVxuICBhZGRTdHJpbmdBc1N0YXRpY1RhYmxlICh7IG5hbWUsIGV4dGVuc2lvbiwgdGV4dCB9KSB7XG4gICAgbGV0IGRhdGEsIGF0dHJpYnV0ZXM7XG4gICAgaWYgKCFleHRlbnNpb24pIHtcbiAgICAgIGV4dGVuc2lvbiA9IG1pbWUuZXh0ZW5zaW9uKG1pbWUubG9va3VwKG5hbWUpKTtcbiAgICB9XG4gICAgaWYgKERBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBkYXRhID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBhdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBkYXRhLmNvbHVtbnMpIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKHsgbmFtZSwgZGF0YSwgYXR0cmlidXRlcyB9KTtcbiAgfVxuICBhZGRTdGF0aWNUYWJsZSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudHlwZSA9IG9wdGlvbnMuZGF0YSBpbnN0YW5jZW9mIEFycmF5ID8gJ1N0YXRpY1RhYmxlJyA6ICdTdGF0aWNEaWN0VGFibGUnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlQWxsVW51c2VkVGFibGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgaW4gdGhpcy50YWJsZXMpIHtcbiAgICAgIGlmICh0aGlzLnRhYmxlc1t0YWJsZUlkXSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMudGFibGVzW3RhYmxlSWRdLmRlbGV0ZSgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoIWVyci5pblVzZSkge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jIGdldFNhbXBsZUdyYXBoICh7XG4gICAgcm9vdENsYXNzID0gbnVsbCxcbiAgICBicmFuY2hMaW1pdCA9IEluZmluaXR5LFxuICAgIG5vZGVMaW1pdCA9IEluZmluaXR5LFxuICAgIGVkZ2VMaW1pdCA9IEluZmluaXR5LFxuICAgIHRyaXBsZUxpbWl0ID0gSW5maW5pdHlcbiAgfSA9IHt9KSB7XG4gICAgY29uc3Qgc2FtcGxlR3JhcGggPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBub2RlTG9va3VwOiB7fSxcbiAgICAgIGVkZ2VzOiBbXSxcbiAgICAgIGVkZ2VMb29rdXA6IHt9LFxuICAgICAgbGlua3M6IFtdXG4gICAgfTtcblxuICAgIGxldCBudW1UcmlwbGVzID0gMDtcbiAgICBjb25zdCBhZGROb2RlID0gbm9kZSA9PiB7XG4gICAgICBpZiAoc2FtcGxlR3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc2FtcGxlR3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdID0gc2FtcGxlR3JhcGgubm9kZXMubGVuZ3RoO1xuICAgICAgICBzYW1wbGVHcmFwaC5ub2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoLm5vZGVzLmxlbmd0aCA8PSBub2RlTGltaXQ7XG4gICAgfTtcbiAgICBjb25zdCBhZGRFZGdlID0gZWRnZSA9PiB7XG4gICAgICBpZiAoc2FtcGxlR3JhcGguZWRnZUxvb2t1cFtlZGdlLmluc3RhbmNlSWRdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc2FtcGxlR3JhcGguZWRnZUxvb2t1cFtlZGdlLmluc3RhbmNlSWRdID0gc2FtcGxlR3JhcGguZWRnZXMubGVuZ3RoO1xuICAgICAgICBzYW1wbGVHcmFwaC5lZGdlcy5wdXNoKGVkZ2UpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoLmVkZ2VzLmxlbmd0aCA8PSBlZGdlTGltaXQ7XG4gICAgfTtcbiAgICBjb25zdCBhZGRUcmlwbGUgPSAoc291cmNlLCBlZGdlLCB0YXJnZXQpID0+IHtcbiAgICAgIGlmIChhZGROb2RlKHNvdXJjZSkgJiYgYWRkTm9kZSh0YXJnZXQpICYmIGFkZEVkZ2UoZWRnZSkpIHtcbiAgICAgICAgc2FtcGxlR3JhcGgubGlua3MucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW3NvdXJjZS5pbnN0YW5jZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Lmluc3RhbmNlSWRdLFxuICAgICAgICAgIGVkZ2U6IHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXVxuICAgICAgICB9KTtcbiAgICAgICAgbnVtVHJpcGxlcysrO1xuICAgICAgICByZXR1cm4gbnVtVHJpcGxlcyA8PSB0cmlwbGVMaW1pdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbGV0IGNsYXNzTGlzdCA9IHJvb3RDbGFzcyA/IFtyb290Q2xhc3NdIDogT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpO1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgY2xhc3NMaXN0KSB7XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBpZiAoIWFkZE5vZGUobm9kZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IHNvdXJjZSwgZWRnZSwgdGFyZ2V0IH0gb2Ygbm9kZS5wYWlyd2lzZU5laWdoYm9yaG9vZCh7IGxpbWl0OiBicmFuY2hMaW1pdCB9KSkge1xuICAgICAgICAgICAgaWYgKCFhZGRUcmlwbGUoc291cmNlLCBlZGdlLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBpZiAoIWFkZEVkZ2UoZWRnZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IHNvdXJjZSwgdGFyZ2V0IH0gb2YgZWRnZS5wYWlyd2lzZUVkZ2VzKHsgbGltaXQ6IGJyYW5jaExpbWl0IH0pKSB7XG4gICAgICAgICAgICBpZiAoIWFkZFRyaXBsZShzb3VyY2UsIGVkZ2UsIHRhcmdldCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gIH1cbiAgYXN5bmMgZ2V0SW5zdGFuY2VHcmFwaCAoaW5zdGFuY2VzKSB7XG4gICAgaWYgKCFpbnN0YW5jZXMpIHtcbiAgICAgIC8vIFdpdGhvdXQgc3BlY2lmaWVkIGluc3RhbmNlcywganVzdCBwaWNrIHRoZSBmaXJzdCA1IGZyb20gZWFjaCBub2RlXG4gICAgICAvLyBhbmQgZWRnZSBjbGFzc1xuICAgICAgaW5zdGFuY2VzID0gW107XG4gICAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnIHx8IGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKHsgbGltaXQ6IDUgfSkpIHtcbiAgICAgICAgICAgIGluc3RhbmNlcy5wdXNoKGl0ZW0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW11cbiAgICB9O1xuICAgIGNvbnN0IGVkZ2VUYWJsZUVudHJpZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlIG9mIGluc3RhbmNlcykge1xuICAgICAgaWYgKGluc3RhbmNlLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBncmFwaC5ub2RlTG9va3VwW2luc3RhbmNlLmluc3RhbmNlSWRdID0gZ3JhcGgubm9kZXMubGVuZ3RoO1xuICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHtcbiAgICAgICAgICBub2RlSW5zdGFuY2U6IGluc3RhbmNlLFxuICAgICAgICAgIGR1bW15OiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIGVkZ2VUYWJsZUVudHJpZXMucHVzaChpbnN0YW5jZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgZWRnZUluc3RhbmNlIG9mIGVkZ2VUYWJsZUVudHJpZXMpIHtcbiAgICAgIGNvbnN0IHNvdXJjZXMgPSBbXTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIGVkZ2VJbnN0YW5jZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3NvdXJjZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc291cmNlcy5wdXNoKGdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgdGFyZ2V0cyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgZWRnZUluc3RhbmNlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Lmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0YXJnZXRzLnB1c2goZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc291cmNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgaWYgKHRhcmdldHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgLy8gV2UgaGF2ZSBjb21wbGV0ZWx5IGhhbmdpbmcgZWRnZXMsIG1ha2UgZHVtbXkgbm9kZXMgZm9yIHRoZVxuICAgICAgICAgIC8vIHNvdXJjZSBhbmQgdGFyZ2V0XG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoICsgMVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gVGhlIHNvdXJjZXMgYXJlIGhhbmdpbmcsIGJ1dCB3ZSBoYXZlIHRhcmdldHNcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0YXJnZXRzKSB7XG4gICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgZWRnZUluc3RhbmNlLFxuICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgdGFyZ2V0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodGFyZ2V0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gVGhlIHRhcmdldHMgYXJlIGhhbmdpbmcsIGJ1dCB3ZSBoYXZlIHNvdXJjZXNcbiAgICAgICAgZm9yIChjb25zdCBzb3VyY2Ugb2Ygc291cmNlcykge1xuICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgZWRnZUluc3RhbmNlLFxuICAgICAgICAgICAgc291cmNlLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGhcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5laXRoZXIgdGhlIHNvdXJjZSwgbm9yIHRoZSB0YXJnZXQgYXJlIGhhbmdpbmdcbiAgICAgICAgZm9yIChjb25zdCBzb3VyY2Ugb2Ygc291cmNlcykge1xuICAgICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICAgIHNvdXJjZSxcbiAgICAgICAgICAgICAgdGFyZ2V0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE5ldHdvcmtNb2RlbEdyYXBoICh7XG4gICAgcmF3ID0gdHJ1ZSxcbiAgICBpbmNsdWRlRHVtbWllcyA9IGZhbHNlLFxuICAgIGNsYXNzTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGxldCBncmFwaCA9IHtcbiAgICAgIGNsYXNzZXM6IFtdLFxuICAgICAgY2xhc3NMb29rdXA6IHt9LFxuICAgICAgY2xhc3NDb25uZWN0aW9uczogW11cbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIC8vIEFkZCBhbmQgaW5kZXggdGhlIGNsYXNzIGFzIGEgbm9kZVxuICAgICAgY29uc3QgY2xhc3NTcGVjID0gcmF3ID8gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCkgOiB7IGNsYXNzT2JqIH07XG4gICAgICBjbGFzc1NwZWMudHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC5jbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGdyYXBoLmNsYXNzZXMubGVuZ3RoO1xuICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKGNsYXNzU3BlYyk7XG5cbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgLy8gU3RvcmUgdGhlIGVkZ2UgY2xhc3Mgc28gd2UgY2FuIGNyZWF0ZSBjbGFzc0Nvbm5lY3Rpb25zIGxhdGVyXG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgJiYgaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgbm9kZVxuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtjbGFzc09iai5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCAtIDEsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZmFsc2UsXG4gICAgICAgICAgbG9jYXRpb246ICdub2RlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGV4aXN0aW5nIGNsYXNzQ29ubmVjdGlvbnNcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlQ2xhc3Nlcykge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIHNvdXJjZSBub2RlIGNsYXNzIHRvIHRoZSBlZGdlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkfT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZSdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHNvdXJjZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgZHVtbXk+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIGVkZ2UgY2xhc3MgdG8gdGhlIHRhcmdldCBub2RlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT4ke2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHRhcmdldCBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCcsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICB0YWJsZXM6IFtdLFxuICAgICAgdGFibGVMb29rdXA6IHt9LFxuICAgICAgdGFibGVMaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IHRhYmxlTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpO1xuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBjb25zdCB0YWJsZVNwZWMgPSB0YWJsZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlU3BlYy50eXBlID0gdGFibGUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gZ3JhcGgudGFibGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLnRhYmxlcy5wdXNoKHRhYmxlU3BlYyk7XG4gICAgfVxuICAgIC8vIEZpbGwgdGhlIGdyYXBoIHdpdGggbGlua3MgYmFzZWQgb24gcGFyZW50VGFibGVzLi4uXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgIGdyYXBoLnRhYmxlTGlua3MucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBncmFwaC50YWJsZUxvb2t1cFtwYXJlbnRUYWJsZS50YWJsZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TW9kZWxEdW1wICgpIHtcbiAgICAvLyBCZWNhdXNlIG9iamVjdCBrZXkgb3JkZXJzIGFyZW4ndCBkZXRlcm1pbmlzdGljLCBpdCBjYW4gYmUgcHJvYmxlbWF0aWNcbiAgICAvLyBmb3IgdGVzdGluZyAoYmVjYXVzZSBpZHMgY2FuIHJhbmRvbWx5IGNoYW5nZSBmcm9tIHRlc3QgcnVuIHRvIHRlc3QgcnVuKS5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHNvcnRzIGVhY2gga2V5LCBhbmQganVzdCByZXBsYWNlcyBJRHMgd2l0aCBpbmRleCBudW1iZXJzXG4gICAgY29uc3QgcmF3T2JqID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0aGlzLl90b1Jhd09iamVjdCgpKSk7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NlczogT2JqZWN0LnZhbHVlcyhyYXdPYmouY2xhc3Nlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMuY2xhc3Nlc1thLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy5jbGFzc2VzW2IuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3MgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICB0YWJsZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLnRhYmxlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMudGFibGVzW2EudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLnRhYmxlc1tiLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhYmxlIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfTtcbiAgICBjb25zdCBjbGFzc0xvb2t1cCA9IHt9O1xuICAgIGNvbnN0IHRhYmxlTG9va3VwID0ge307XG4gICAgcmVzdWx0LmNsYXNzZXMuZm9yRWFjaCgoY2xhc3NPYmosIGluZGV4KSA9PiB7XG4gICAgICBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGluZGV4O1xuICAgIH0pO1xuICAgIHJlc3VsdC50YWJsZXMuZm9yRWFjaCgodGFibGUsIGluZGV4KSA9PiB7XG4gICAgICB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGluZGV4O1xuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiByZXN1bHQudGFibGVzKSB7XG4gICAgICB0YWJsZS50YWJsZUlkID0gdGFibGVMb29rdXBbdGFibGUudGFibGVJZF07XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcykpIHtcbiAgICAgICAgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUxvb2t1cFt0YWJsZUlkXV0gPSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgICBkZWxldGUgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0YWJsZS5kYXRhOyAvLyBkb24ndCBpbmNsdWRlIGFueSBvZiB0aGUgZGF0YTsgd2UganVzdCB3YW50IHRoZSBtb2RlbCBzdHJ1Y3R1cmVcbiAgICB9XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiByZXN1bHQuY2xhc3Nlcykge1xuICAgICAgY2xhc3NPYmouY2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdO1xuICAgICAgY2xhc3NPYmoudGFibGVJZCA9IHRhYmxlTG9va3VwW2NsYXNzT2JqLnRhYmxlSWRdO1xuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzID0gY2xhc3NPYmouc291cmNlVGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnRhcmdldENsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzID0gY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBjbGFzc0lkIG9mIE9iamVjdC5rZXlzKGNsYXNzT2JqLmVkZ2VDbGFzc0lkcyB8fCB7fSkpIHtcbiAgICAgICAgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzTG9va3VwW2NsYXNzSWRdXSA9IGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgICAgZGVsZXRlIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBjcmVhdGVTY2hlbWFNb2RlbCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB0aGlzLmdldE1vZGVsRHVtcCgpO1xuXG4gICAgZ3JhcGgudGFibGVzLmZvckVhY2godGFibGUgPT4ge1xuICAgICAgdGFibGUuZGVyaXZlZFRhYmxlcyA9IE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbmV3TW9kZWwgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVNb2RlbCh7IG5hbWU6IHRoaXMubmFtZSArICdfc2NoZW1hJyB9KTtcbiAgICBjb25zdCByYXcgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaCxcbiAgICAgIG5hbWU6ICdSYXcgRHVtcCdcbiAgICB9KTtcbiAgICBsZXQgWyBjbGFzc2VzLCB0YWJsZXMgXSA9IHJhdy5jbG9zZWRUcmFuc3Bvc2UoWydjbGFzc2VzJywgJ3RhYmxlcyddKTtcbiAgICBjbGFzc2VzID0gY2xhc3Nlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgY2xhc3Nlcy5zZXRDbGFzc05hbWUoJ0NsYXNzZXMnKTtcbiAgICByYXcuZGVsZXRlKCk7XG5cbiAgICBjb25zdCBzb3VyY2VDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdzb3VyY2VDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgc291cmNlQ2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1NvdXJjZSBDbGFzcycpO1xuICAgIHNvdXJjZUNsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAndGFyZ2V0Q2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhcmdldENsYXNzZXMuc2V0Q2xhc3NOYW1lKCdUYXJnZXQgQ2xhc3MnKTtcbiAgICB0YXJnZXRDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgdGFibGVzID0gdGFibGVzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICB0YWJsZXMuc2V0Q2xhc3NOYW1lKCdUYWJsZXMnKTtcblxuICAgIGNvbnN0IHRhYmxlRGVwZW5kZW5jaWVzID0gdGFibGVzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAnZGVyaXZlZFRhYmxlcycsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnNldENsYXNzTmFtZSgnSXMgUGFyZW50IE9mJyk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICBjb25zdCBjb3JlVGFibGVzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhYmxlSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBjb3JlVGFibGVzLnNldENsYXNzTmFtZSgnQ29yZSBUYWJsZScpO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTmV0d29ya01vZGVsO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgTmV0d29ya01vZGVsIGZyb20gJy4vQ29tbW9uL05ldHdvcmtNb2RlbC5qcyc7XG5cbmxldCBORVhUX01PREVMX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgbW9kZWxzID0ge307XG4gICAgICBmb3IgKGNvbnN0IFttb2RlbElkLCBtb2RlbF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5tb2RlbHMpKSB7XG4gICAgICAgIG1vZGVsc1ttb2RlbElkXSA9IG1vZGVsLl90b1Jhd09iamVjdCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnb3JpZ3JhcGhfbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG4gICAgICB0aGlzLnRyaWdnZXIoJ3NhdmUnKTtcbiAgICB9XG4gIH1cbiAgY2xvc2VDdXJyZW50TW9kZWwgKCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGdldCBjdXJyZW50TW9kZWwgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1t0aGlzLl9jdXJyZW50TW9kZWxJZF0gfHwgbnVsbDtcbiAgfVxuICBzZXQgY3VycmVudE1vZGVsIChtb2RlbCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbW9kZWwgPyBtb2RlbC5tb2RlbElkIDogbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGNyZWF0ZU1vZGVsIChvcHRpb25zID0ge30pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMubW9kZWxJZCB8fCB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsSWQgPSBgbW9kZWwke05FWFRfTU9ERUxfSUR9YDtcbiAgICAgIE5FWFRfTU9ERUxfSUQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5vcmlncmFwaCA9IHRoaXM7XG4gICAgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwob3B0aW9ucyk7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBvcHRpb25zLm1vZGVsSWQ7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXTtcbiAgfVxuICBkZWxldGVNb2RlbCAobW9kZWxJZCA9IHRoaXMuY3VycmVudE1vZGVsSWQpIHtcbiAgICBpZiAoIXRoaXMubW9kZWxzW21vZGVsSWRdKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBub24tZXhpc3RlbnQgbW9kZWw6ICR7bW9kZWxJZH1gKTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWxzW21vZGVsSWRdO1xuICAgIGlmICh0aGlzLl9jdXJyZW50TW9kZWxJZCA9PT0gbW9kZWxJZCkge1xuICAgICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICB9XG4gICAgdGhpcy5zYXZlKCk7XG4gIH1cbiAgZGVsZXRlQWxsTW9kZWxzICgpIHtcbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE9yaWdyYXBoO1xuIiwiaW1wb3J0IE9yaWdyYXBoIGZyb20gJy4vT3JpZ3JhcGguanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IEZpbGVSZWFkZXIgZnJvbSAnZmlsZXJlYWRlcic7XG5cbmxldCBvcmlncmFwaCA9IG5ldyBPcmlncmFwaChGaWxlUmVhZGVyLCBudWxsKTtcbm9yaWdyYXBoLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgb3JpZ3JhcGg7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsIl9ldmVudEhhbmRsZXJzIiwiX3N0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImV2ZW50IiwibmFtZXNwYWNlIiwic3BsaXQiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJpbmRleE9mIiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJoYW5kbGVDYWxsYmFjayIsInNldFRpbWVvdXQiLCJhcHBseSIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJHZW5lcmljV3JhcHBlciIsIm9wdGlvbnMiLCJ0YWJsZSIsInVuZGVmaW5lZCIsIkVycm9yIiwiY2xhc3NPYmoiLCJyb3ciLCJjb25uZWN0ZWRJdGVtcyIsImNvbm5lY3RJdGVtIiwiaXRlbSIsInRhYmxlSWQiLCJkaXNjb25uZWN0IiwiaXRlbUxpc3QiLCJ2YWx1ZXMiLCJpbnN0YW5jZUlkIiwiY2xhc3NJZCIsImVxdWFscyIsIml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInRhYmxlSWRzIiwibGltaXQiLCJJbmZpbml0eSIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJjYWNoZVByb21pc2UiLCJtb2RlbCIsInRhYmxlcyIsImJ1aWxkQ2FjaGUiLCJfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwibGVuZ3RoIiwidGhpc1RhYmxlSWQiLCJyZW1haW5pbmdUYWJsZUlkcyIsInNsaWNlIiwiZXhlYyIsIm5hbWUiLCJUYWJsZSIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3N1cHByZXNzZWRBdHRyaWJ1dGVzIiwic3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJfc3VwcHJlc3NJbmRleCIsInN1cHByZXNzSW5kZXgiLCJfaW5kZXhGaWx0ZXIiLCJpbmRleEZpbHRlciIsIl9hdHRyaWJ1dGVGaWx0ZXJzIiwiYXR0cmlidXRlRmlsdGVycyIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiZ2V0U29ydEhhc2giLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiaXRlcmF0ZSIsInJlc2V0IiwiX2NhY2hlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlIiwiaXRlcmF0b3IiLCJfaXRlcmF0ZSIsImNvbXBsZXRlZCIsIm5leHQiLCJkb25lIiwiX2ZpbmlzaEl0ZW0iLCJ3cmFwcGVkSXRlbSIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZGVyaXZlZFRhYmxlIiwiX2NhY2hlUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJjb3VudFJvd3MiLCJjYWNoZSIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJhZ2dyZWdhdGUiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNsb3NlZFRyYW5zcG9zZSIsImluZGV4ZXMiLCJvcGVuVHJhbnNwb3NlIiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0Iiwib3RoZXJUYWJsZSIsImNsYXNzZXMiLCJwYXJlbnRUYWJsZXMiLCJyZWR1Y2UiLCJhZ2ciLCJpblVzZSIsInNvbWUiLCJzb3VyY2VUYWJsZUlkcyIsInRhcmdldFRhYmxlSWRzIiwiZGVsZXRlIiwiZXJyIiwicGFyZW50VGFibGUiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJTdGF0aWNEaWN0VGFibGUiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBZ2dyZWdhdGVkVGFibGUiLCJfYXR0cmlidXRlIiwid3JhcHBlZFBhcmVudCIsIlN0cmluZyIsImV4aXN0aW5nSXRlbSIsIm5ld0l0ZW0iLCJGYWNldGVkVGFibGUiLCJfdmFsdWUiLCJUcmFuc3Bvc2VkVGFibGUiLCJfaW5kZXgiLCJDb25uZWN0ZWRUYWJsZSIsImpvaW4iLCJiYXNlUGFyZW50VGFibGUiLCJvdGhlclBhcmVudFRhYmxlcyIsIkdlbmVyaWNDbGFzcyIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJhbm5vdGF0aW9ucyIsInNldENsYXNzTmFtZSIsImhhc0N1c3RvbU5hbWUiLCJ2YXJpYWJsZU5hbWUiLCJmaWx0ZXIiLCJkIiwidG9Mb2NhbGVVcHBlckNhc2UiLCJkZWxldGVkIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm92ZXJ3cml0ZSIsImNyZWF0ZUNsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIl9kZXJpdmVOZXdDbGFzcyIsImdldFNhbXBsZUdyYXBoIiwicm9vdENsYXNzIiwiTm9kZVdyYXBwZXIiLCJlZGdlcyIsImVkZ2VJZHMiLCJjbGFzc0lkcyIsImVkZ2VDbGFzc0lkcyIsImVkZ2VJZCIsImVkZ2VDbGFzcyIsInJvbGUiLCJnZXRFZGdlUm9sZSIsInJldmVyc2UiLCJjb25jYXQiLCJwYWlyd2lzZU5laWdoYm9yaG9vZCIsImVkZ2UiLCJwYWlyd2lzZUVkZ2VzIiwiTm9kZUNsYXNzIiwiZWRnZUNsYXNzZXMiLCJlZGdlQ2xhc3NJZCIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiYXV0b2Nvbm5lY3QiLCJkaXNjb25uZWN0QWxsRWRnZXMiLCJpc1NvdXJjZSIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0Iiwibm9kZUNsYXNzIiwidGFibGVJZExpc3QiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibmV3Tm9kZUNsYXNzIiwiY29ubmVjdGVkQ2xhc3NlcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlTm9kZXMiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXRUYWJsZUlkIiwibm9kZXMiLCJzb3VyY2UiLCJ0YXJnZXQiLCJoeXBlcmVkZ2UiLCJzb3VyY2VzIiwidGFyZ2V0cyIsIkVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJfc3BsaXRUYWJsZUlkTGlzdCIsIm90aGVyQ2xhc3MiLCJub2RlVGFibGVJZExpc3QiLCJlZGdlVGFibGVJZCIsImVkZ2VUYWJsZUlkTGlzdCIsInN0YXRpY0V4aXN0cyIsInRhYmxlRGlzdGFuY2VzIiwic3RhcnRzV2l0aCIsImRpc3QiLCJNYXRoIiwiYWJzIiwic29ydCIsImEiLCJiIiwic2lkZSIsImNvbm5lY3RTb3VyY2UiLCJjb25uZWN0VGFyZ2V0IiwidG9nZ2xlRGlyZWN0aW9uIiwic3dhcHBlZERpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsInVuc2hpZnQiLCJleGlzdGluZ1NvdXJjZUNsYXNzIiwiZXhpc3RpbmdUYXJnZXRDbGFzcyIsIkRBVEFMSUJfRk9STUFUUyIsIk5ldHdvcmtNb2RlbCIsIm9yaWdyYXBoIiwibW9kZWxJZCIsIl9vcmlncmFwaCIsIl9uZXh0Q2xhc3NJZCIsIl9uZXh0VGFibGVJZCIsImh5ZHJhdGUiLCJDTEFTU0VTIiwiVEFCTEVTIiwiX3NhdmVUaW1lb3V0Iiwic2F2ZSIsInVuc2F2ZWQiLCJyYXdPYmplY3QiLCJUWVBFUyIsInNlbGVjdG9yIiwiZmluZENsYXNzIiwicmVuYW1lIiwibmV3TmFtZSIsImFubm90YXRlIiwia2V5IiwiZGVsZXRlQW5ub3RhdGlvbiIsImRlbGV0ZU1vZGVsIiwibW9kZWxzIiwiYWRkRmlsZUFzU3RhdGljVGFibGUiLCJmaWxlT2JqIiwiZW5jb2RpbmciLCJtaW1lIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJjb25zb2xlIiwid2FybiIsInRleHQiLCJyZWFkZXIiLCJGaWxlUmVhZGVyIiwib25sb2FkIiwicmVhZEFzVGV4dCIsImFkZFN0cmluZ0FzU3RhdGljVGFibGUiLCJleHRlbnNpb24iLCJsb29rdXAiLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNUYWJsZSIsIkFycmF5IiwiZGVsZXRlQWxsVW51c2VkVGFibGVzIiwiYnJhbmNoTGltaXQiLCJub2RlTGltaXQiLCJlZGdlTGltaXQiLCJ0cmlwbGVMaW1pdCIsInNhbXBsZUdyYXBoIiwibm9kZUxvb2t1cCIsImVkZ2VMb29rdXAiLCJsaW5rcyIsIm51bVRyaXBsZXMiLCJhZGROb2RlIiwibm9kZSIsImFkZEVkZ2UiLCJhZGRUcmlwbGUiLCJjbGFzc0xpc3QiLCJnZXRJbnN0YW5jZUdyYXBoIiwiaW5zdGFuY2VzIiwiZ3JhcGgiLCJlZGdlVGFibGVFbnRyaWVzIiwiaW5zdGFuY2UiLCJub2RlSW5zdGFuY2UiLCJkdW1teSIsImVkZ2VJbnN0YW5jZSIsImdldE5ldHdvcmtNb2RlbEdyYXBoIiwicmF3IiwiaW5jbHVkZUR1bW1pZXMiLCJjbGFzc0xvb2t1cCIsImNsYXNzQ29ubmVjdGlvbnMiLCJjbGFzc1NwZWMiLCJpZCIsImxvY2F0aW9uIiwiZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgiLCJ0YWJsZUxvb2t1cCIsInRhYmxlTGlua3MiLCJ0YWJsZUxpc3QiLCJ0YWJsZVNwZWMiLCJnZXRNb2RlbER1bXAiLCJyYXdPYmoiLCJKU09OIiwicGFyc2UiLCJzdHJpbmdpZnkiLCJhSGFzaCIsImJIYXNoIiwiY3JlYXRlU2NoZW1hTW9kZWwiLCJuZXdNb2RlbCIsImNyZWF0ZU1vZGVsIiwic291cmNlQ2xhc3NlcyIsInRhcmdldENsYXNzZXMiLCJ0YWJsZURlcGVuZGVuY2llcyIsImNvcmVUYWJsZXMiLCJORVhUX01PREVMX0lEIiwiT3JpZ3JhcGgiLCJsb2NhbFN0b3JhZ2UiLCJwbHVnaW5zIiwiZXhpc3RpbmdNb2RlbHMiLCJnZXRJdGVtIiwiX2N1cnJlbnRNb2RlbElkIiwicmVnaXN0ZXJQbHVnaW4iLCJwbHVnaW4iLCJzZXRJdGVtIiwiY2xvc2VDdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWxJZCIsImRlbGV0ZUFsbE1vZGVscyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7V0FDS0MsZUFBTCxHQUF1QixFQUF2Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFiLEVBQXVCO1VBQ25CLENBQUNDLEtBQUQsRUFBUUMsU0FBUixJQUFxQkgsU0FBUyxDQUFDSSxL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
