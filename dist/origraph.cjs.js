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
        return _this.classObj.model.tables[tableId].buildCache();
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
      const derivedResult = await func(wrappedItem);
      wrappedItem.row[attr] = derivedResult;
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
      keep = keep && func(wrappedItem.row[attr]);

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

  expand(attribute, delimiter) {
    const options = {
      type: 'ExpandedTable',
      attribute,
      delimiter
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
          const value = wrappedItem.row[attribute];

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

    this._reduceAttributeFunctions = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.reduceAttributeFunctions || {})) {
      this._reduceAttributeFunctions[attr] = this.model.hydrateFunction(stringifiedFunc);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.reduceAttributeFunctions = {};

    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this.model._dehydrateFunction(func);
    }

    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
  }

  get name() {
    return '↦' + this._attribute;
  }

  deriveReducedAttribute(attr, func) {
    this._reduceAttributeFunctions[attr] = func;
    this.reset();
  }

  _updateItem(originalWrappedItem, newWrappedItem) {
    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      originalWrappedItem.row[attr] = func(originalWrappedItem, newWrappedItem);
    }

    originalWrappedItem.trigger('update');
  }

  _buildCache(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // We override _buildCache because so that AggregatedTable can take advantage
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
          // means that they need to watch for wrappedItem.on('update') events

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
          const index = String(wrappedParent.row[_this2._attribute]);

          if (!_this2._partialCache) {
            // We were reset; return immediately
            return;
          } else if (_this2._partialCache[index]) {
            const existingItem = _this2._partialCache[index];
            existingItem.connectItem(wrappedParent);
            wrappedParent.connectItem(existingItem);

            _this2._updateItem(existingItem, wrappedParent);
          } else {
            const newItem = _this2._wrap({
              index,
              itemsToConnect: [wrappedParent]
            });

            _this2._updateItem(newItem, wrappedParent);

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

  getAttributeDetails() {
    const allAttrs = super.getAttributeDetails();

    for (const attr in this._reduceAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].reduced = true;
    }

    return allAttrs;
  }

}

class ExpandedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }

    this.delimiter = options.delimiter || ',';
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this.delimiter + this._attribute;
  }

  get name() {
    return this.parentTable.name + '↤';
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
          const values = (wrappedParent.row[_this._attribute] || '').split(_this.delimiter);

          for (const value of values) {
            const row = {};
            row[_this._attribute] = value;

            const newItem = _this._wrap({
              index,
              row,
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

          if (wrappedParent.row[_this._attribute] === _this._value) {
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
  ExpandedTable: ExpandedTable,
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

  expand(attribute, delimiter) {
    return this._deriveNewClass(this.table.expand(attribute, delimiter));
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
    const graph = this.getRawSchemaGraph();

    const newModel = this._origraph.createModel({
      name: this.name + '_schema'
    });

    let classes = newModel.addStaticTable({
      data: graph.classes,
      name: 'Classes'
    }).interpretAsNodes();
    let classConnections = newModel.addStaticTable({
      data: graph.classConnections,
      name: 'Class Connections'
    }).interpretAsEdges();
    let tables = newModel.addStaticTable({
      data: graph.tables,
      name: 'Tables'
    }).interpretAsNodes();
    let tableLinks = newModel.addStaticTable({
      data: graph.tableLinks,
      name: 'Table Links'
    }).interpretAsEdges();
    classes.connectToEdgeClass({
      edgeClass: classConnections,
      side: 'source',
      nodeAttribute: null,
      edgeAttribute: 'source'
    });
    classes.connectToEdgeClass({
      edgeClass: classConnections,
      side: 'target',
      nodeAttribute: null,
      edgeAttribute: 'target'
    });
    tables.connectToEdgeClass({
      edgeClass: tableLinks,
      side: 'source',
      nodeAttribute: null,
      edgeAttribute: 'source'
    });
    tables.connectToEdgeClass({
      edgeClass: tableLinks,
      side: 'target',
      nodeAttribute: null,
      edgeAttribute: 'target'
    });
    classes.connectToNodeClass({
      otherNodeClass: tables,
      attribute: 'tableId',
      otherAttribute: 'tableId'
    }).setClassName('Core Tables');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguY2pzLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRXhwYW5kZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRmFjZXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UcmFuc3Bvc2VkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdIHx8XG4gICAgICAgIHsgJyc6IFtdIH07XG4gICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10ucHVzaChjYWxsYmFjayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdID0gY2FsbGJhY2s7XG4gICAgICB9XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddID0gW107XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudCwgLi4uYXJncykge1xuICAgICAgY29uc3QgaGFuZGxlQ2FsbGJhY2sgPSBjYWxsYmFjayA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWVzcGFjZSBvZiBPYmplY3Qua2V5cyh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkpIHtcbiAgICAgICAgICBpZiAobmFtZXNwYWNlID09PSAnJykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmZvckVhY2goaGFuZGxlQ2FsbGJhY2spO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoYW5kbGVDYWxsYmFjayh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLnRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGFuZCB0YWJsZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc09iaiA9IG9wdGlvbnMuY2xhc3NPYmogfHwgbnVsbDtcbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSBvcHRpb25zLmNvbm5lY3RlZEl0ZW1zIHx8IHt9O1xuICB9XG4gIGNvbm5lY3RJdGVtIChpdGVtKSB7XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdIHx8IFtdO1xuICAgIGlmICh0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0uaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XyR7dGhpcy5pbmRleH1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAoeyB0YWJsZUlkcywgbGltaXQgPSBJbmZpbml0eSB9KSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSkge1xuICAgICAgeWllbGQgaXRlbTtcbiAgICAgIGkrKztcbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBHZW5lcmljIGNhY2hpbmcgc3R1ZmY7IHRoaXMgaXNuJ3QganVzdCBmb3IgcGVyZm9ybWFuY2UuIENvbm5lY3RlZFRhYmxlJ3NcbiAgICAvLyBhbGdvcml0aG0gcmVxdWlyZXMgdGhhdCBpdHMgcGFyZW50IHRhYmxlcyBoYXZlIHByZS1idWlsdCBpbmRleGVzICh3ZVxuICAgIC8vIHRlY2huaWNhbGx5IGNvdWxkIGltcGxlbWVudCBpdCBkaWZmZXJlbnRseSwgYnV0IGl0IHdvdWxkIGJlIGV4cGVuc2l2ZSxcbiAgICAvLyByZXF1aXJlcyB0cmlja3kgbG9naWMsIGFuZCB3ZSdyZSBhbHJlYWR5IGJ1aWxkaW5nIGluZGV4ZXMgZm9yIHNvbWUgdGFibGVzXG4gICAgLy8gbGlrZSBBZ2dyZWdhdGVkVGFibGUgYW55d2F5KVxuICAgIGlmIChvcHRpb25zLnJlc2V0KSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQgPT09IHVuZGVmaW5lZCA/IEluZmluaXR5IDogb3B0aW9ucy5saW1pdDtcbiAgICAgIHlpZWxkICogT2JqZWN0LnZhbHVlcyh0aGlzLl9jYWNoZSkuc2xpY2UoMCwgbGltaXQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHlpZWxkICogYXdhaXQgdGhpcy5fYnVpbGRDYWNoZShvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpO1xuICAgIGxldCBjb21wbGV0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBpdGVyYXRpb24gd2FzIGNhbmNlbGxlZDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgY29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKSkge1xuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt0ZW1wLnZhbHVlLmluZGV4XSA9IHRlbXAudmFsdWU7XG4gICAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIGNvbnN0IGRlcml2ZWRSZXN1bHQgPSBhd2FpdCBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGRlcml2ZWRSZXN1bHQ7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgZGVsZXRlIHdyYXBwZWRJdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgbGV0IGtlZXAgPSB0cnVlO1xuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAga2VlcCA9IHRoaXMuX2luZGV4RmlsdGVyKHdyYXBwZWRJdGVtLmluZGV4KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIGtlZXAgPSBrZWVwICYmIGZ1bmMod3JhcHBlZEl0ZW0ucm93W2F0dHJdKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX2NhY2hlUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fY2FjaGVQcm9taXNlID0gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRlbXAgb2YgdGhpcy5fYnVpbGRDYWNoZSgpKSB7fSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIH1cbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIGNvbnN0IGNhY2hlID0gYXdhaXQgdGhpcy5idWlsZENhY2hlKCk7XG4gICAgcmV0dXJuIGNhY2hlID8gT2JqZWN0LmtleXMoY2FjaGUpLmxlbmd0aCA6IC0xO1xuICB9XG4gIGdldEluZGV4RGV0YWlscyAoKSB7XG4gICAgY29uc3QgZGV0YWlscyA9IHsgbmFtZTogbnVsbCB9O1xuICAgIGlmICh0aGlzLl9zdXBwcmVzc0luZGV4KSB7XG4gICAgICBkZXRhaWxzLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGRldGFpbHMuZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZGV0YWlscztcbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHt9O1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5leHBlY3RlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5vYnNlcnZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZGVyaXZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fYXR0cmlidXRlRmlsdGVycykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5nZXRBdHRyaWJ1dGVEZXRhaWxzKCkpO1xuICB9XG4gIGdldCBjdXJyZW50RGF0YSAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6IHRoaXMuX2NhY2hlIHx8IHRoaXMuX3BhcnRpYWxDYWNoZSB8fCB7fSxcbiAgICAgIGNvbXBsZXRlOiAhIXRoaXMuX2NhY2hlXG4gICAgfTtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYWRkRmlsdGVyIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pbmRleEZpbHRlciA9IGZ1bmM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIF9kZXJpdmVUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGUgPSB0aGlzLmRlcml2ZWRUYWJsZXMuZmluZCh0YWJsZU9iaiA9PiB7XG4gICAgICByZXR1cm4gT2JqZWN0LmVudHJpZXMob3B0aW9ucykuZXZlcnkoKFtvcHRpb25OYW1lLCBvcHRpb25WYWx1ZV0pID0+IHtcbiAgICAgICAgaWYgKG9wdGlvbk5hbWUgPT09ICd0eXBlJykge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmpbJ18nICsgb3B0aW9uTmFtZV0gPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gKGV4aXN0aW5nVGFibGUgJiYgdGhpcy5tb2RlbC50YWJsZXNbZXhpc3RpbmdUYWJsZS50YWJsZUlkXSkgfHwgbnVsbDtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnQWdncmVnYXRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnRXhwYW5kZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBkZWxpbWl0ZXJcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKHsgbGltaXQgfSkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiBpbmRleGVzLm1hcChpbmRleCA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXhcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXg6IHdyYXBwZWRJdGVtLmluZGV4XG4gICAgICB9O1xuICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJ1xuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIGdldCBjbGFzc09iaiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZSA9PT0gdGhpcztcbiAgICB9KTtcbiAgfVxuICBnZXQgcGFyZW50VGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKTtcbiAgfVxuICBnZXQgZGVyaXZlZFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXTtcbiAgICB9KTtcbiAgfVxuICBnZXQgaW5Vc2UgKCkge1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5zb21lKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZUlkID09PSB0aGlzLnRhYmxlSWQgfHxcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMSB8fFxuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUYWJsZSwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVGFibGUvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IFtdO1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpcmVkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEFnZ3JlZ2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMubW9kZWwuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMubW9kZWwuX2RlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuICfihqYnICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUgKGF0dHIsIGZ1bmMpIHtcbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfdXBkYXRlSXRlbSAob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHNvIHRoYXQgQWdncmVnYXRlZFRhYmxlIGNhbiB0YWtlIGFkdmFudGFnZVxuICAgIC8vIG9mIHRoZSBwYXJ0aWFsbHktYnVpbHQgY2FjaGUgYXMgaXQgZ29lcywgYW5kIHBvc3Rwb25lIGZpbmlzaGluZyBpdGVtc1xuICAgIC8vIHVudGlsIGFmdGVyIHRoZSBwYXJlbnQgdGFibGUgaGFzIGJlZW4gZnVsbHkgaXRlcmF0ZWRcblxuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuX2l0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt3cmFwcGVkSXRlbS5pbmRleF0gPSB3cmFwcGVkSXRlbTtcbiAgICAgIC8vIEdvIGFoZWFkIGFuZCB5aWVsZCB0aGUgdW5maW5pc2hlZCBpdGVtOyB0aGlzIG1ha2VzIGl0IHBvc3NpYmxlIGZvclxuICAgICAgLy8gY2xpZW50IGFwcHMgdG8gYmUgbW9yZSByZXNwb25zaXZlIGFuZCByZW5kZXIgcGFydGlhbCByZXN1bHRzLCBidXQgYWxzb1xuICAgICAgLy8gbWVhbnMgdGhhdCB0aGV5IG5lZWQgdG8gd2F0Y2ggZm9yIHdyYXBwZWRJdGVtLm9uKCd1cGRhdGUnKSBldmVudHNcbiAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgIH1cblxuICAgIC8vIFNlY29uZCBwYXNzOiBub3cgdGhhdCB3ZSd2ZSBjb21wbGV0ZWQgdGhlIGZ1bGwgaXRlcmF0aW9uIG9mIHRoZSBwYXJlbnRcbiAgICAvLyB0YWJsZSwgd2UgY2FuIGZpbmlzaCBlYWNoIGl0ZW1cbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgaWYgKCFhd2FpdCB0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IFN0cmluZyh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0pIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgICAgZXhpc3RpbmdJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB3cmFwcGVkUGFyZW50LmNvbm5lY3RJdGVtKGV4aXN0aW5nSXRlbSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0oZXhpc3RpbmdJdGVtLCB3cmFwcGVkUGFyZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0obmV3SXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0gc3VwZXIuZ2V0QXR0cmlidXRlRGV0YWlscygpO1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5yZWR1Y2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBBZ2dyZWdhdGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuZGVsaW1pdGVyID0gb3B0aW9ucy5kZWxpbWl0ZXIgfHwgJywnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuZGVsaW1pdGVyICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpCc7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSB8fCAnJykuc3BsaXQodGhpcy5kZWxpbWl0ZXIpO1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0ge307XG4gICAgICAgIHJvd1t0aGlzLl9hdHRyaWJ1dGVdID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3csXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZSArIHRoaXMuX3ZhbHVlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYFske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVHJhbnNwb3NlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuX2luZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9pbmRleDtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2luZGV4O1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYOG1gCR7dGhpcy5faW5kZXh9YDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gcGFyZW50VGFibGUuX2NhY2hlW3RoaXMuX2luZGV4XSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGNvbnN0IFsgaW5kZXgsIHZhbHVlIF0gb2YgT2JqZWN0LmVudHJpZXMod3JhcHBlZFBhcmVudC5yb3cpKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICByb3c6IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgPyB2YWx1ZSA6IHsgdmFsdWUgfSxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBUcmFuc3Bvc2VkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIENvbm5lY3RlZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCfiqK8nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignLCcpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBTcGluIHRocm91Z2ggYWxsIG9mIHRoZSBwYXJlbnRUYWJsZXMgc28gdGhhdCB0aGVpciBfY2FjaGUgaXMgcHJlLWJ1aWx0XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcbiAgICB9XG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZSkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbaW5kZXhdKVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSArIHRoaXMuY2xhc3NOYW1lO1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lICE9PSBudWxsO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHwgdGhpcy50YWJsZS5uYW1lO1xuICB9XG4gIGdldCB2YXJpYWJsZU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUudG9Mb2NhbGVMb3dlckNhc2UoKSArICdfJyArXG4gICAgICB0aGlzLmNsYXNzTmFtZVxuICAgICAgICAuc3BsaXQoL1xcVysvZylcbiAgICAgICAgLmZpbHRlcihkID0+IGQubGVuZ3RoID4gMClcbiAgICAgICAgLm1hcChkID0+IGRbMF0udG9Mb2NhbGVVcHBlckNhc2UoKSArIGQuc2xpY2UoMSkpXG4gICAgICAgIC5qb2luKCcnKTtcbiAgfVxuICBnZXQgdGFibGUgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgX2Rlcml2ZU5ld0NsYXNzIChuZXdUYWJsZSwgdHlwZSA9IHRoaXMuY29uc3RydWN0b3IubmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlXG4gICAgfSk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKSk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUsIGRlbGltaXRlcikpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXRTYW1wbGVHcmFwaCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMucm9vdENsYXNzID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5nZXRTYW1wbGVHcmFwaChvcHRpb25zKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0geyBsaW1pdDogSW5maW5pdHkgfSkge1xuICAgIGxldCBlZGdlSWRzID0gb3B0aW9ucy5jbGFzc2VzXG4gICAgICA/IG9wdGlvbnMuY2xhc3Nlcy5tYXAoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NJZClcbiAgICAgIDogb3B0aW9ucy5jbGFzc0lkcyB8fCBPYmplY3Qua2V5cyh0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkcyk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIGVkZ2VJZHMpIHtcbiAgICAgIGlmICghdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHNbZWRnZUlkXSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuY2xhc3NPYmoubW9kZWwuY2xhc3Nlc1tlZGdlSWRdO1xuICAgICAgY29uc3Qgcm9sZSA9IHRoaXMuY2xhc3NPYmouZ2V0RWRnZVJvbGUoZWRnZUNsYXNzKTtcbiAgICAgIG9wdGlvbnMudGFibGVJZHMgPSBbXTtcbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgb3B0aW9ucy50YWJsZUlkcyA9IGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKSkge1xuICAgICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGlmIChpID49IG9wdGlvbnMubGltaXQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgb3B0aW9ucy50YWJsZUlkcyA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKSkge1xuICAgICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGlmIChpID49IG9wdGlvbnMubGltaXQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZU5laWdoYm9yaG9vZCAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiB0aGlzLmVkZ2VzKG9wdGlvbnMpKSB7XG4gICAgICB5aWVsZCAqIGVkZ2UucGFpcndpc2VFZGdlcyhvcHRpb25zKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBOb2RlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgfVxuICAqIGVkZ2VDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZ2V0RWRnZVJvbGUgKGVkZ2VDbGFzcykge1xuICAgIGlmICghdGhpcy5lZGdlQ2xhc3NJZHNbZWRnZUNsYXNzLmNsYXNzSWRdKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIHJldHVybiAnYm90aCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3NvdXJjZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICByZXR1cm4gJ3RhcmdldCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW50ZXJuYWwgbWlzbWF0Y2ggYmV0d2VlbiBub2RlIGFuZCBlZGdlIGNsYXNzSWRzYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IE5vZGVXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKHsgYXV0b2Nvbm5lY3QgPSBmYWxzZSB9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmICghYXV0b2Nvbm5lY3QgfHwgZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgLy8gQXJlIHdlIHRoZSBzb3VyY2Ugb3IgdGFyZ2V0IG9mIHRoZSBleGlzdGluZyBlZGdlIChpbnRlcm5hbGx5LCBpbiB0ZXJtc1xuICAgICAgLy8gb2Ygc291cmNlSWQgLyB0YXJnZXRJZCwgbm90IGVkZ2VDbGFzcy5kaXJlY3Rpb24pP1xuICAgICAgY29uc3QgaXNTb3VyY2UgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkO1xuXG4gICAgICAvLyBBcyB3ZSdyZSBjb252ZXJ0ZWQgdG8gYW4gZWRnZSwgb3VyIG5ldyByZXN1bHRpbmcgc291cmNlIEFORCB0YXJnZXRcbiAgICAgIC8vIHNob3VsZCBiZSB3aGF0ZXZlciBpcyBhdCB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcyAoaWYgYW55dGhpbmcpXG4gICAgICBpZiAoaXNTb3VyY2UpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAvLyBPa2F5LCB3ZSd2ZSBnb3QgdHdvIGVkZ2VzLCBzbyB0aGlzIGlzIGEgbGl0dGxlIG1vcmUgc3RyYWlnaHRmb3J3YXJkXG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgLy8gQWRkIHRoaXMgY2xhc3MgdG8gdGhlIHNvdXJjZSdzIC8gdGFyZ2V0J3MgZWRnZUNsYXNzSWRzXG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBleGlzdGluZyBlZGdlIGNsYXNzZXMgZnJvbSB0aGUgbmV3IChub3cgZWRnZSkgY2xhc3NcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfVxuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgbGV0IHRoaXNIYXNoLCBvdGhlckhhc2gsIHNvdXJjZVRhYmxlSWRzLCB0YXJnZXRUYWJsZUlkcztcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGU7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFsgdGhpc0hhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBpZiAob3RoZXJBdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGUuYWdncmVnYXRlKG90aGVyQXR0cmlidXRlKTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gWyBvdGhlckhhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICAvLyBJZiB3ZSBoYXZlIGEgc2VsZiBlZGdlIGNvbm5lY3RpbmcgdGhlIHNhbWUgYXR0cmlidXRlLCB3ZSBjYW4ganVzdCB1c2VcbiAgICAvLyB0aGUgQWdncmVnYXRlZFRhYmxlIGFzIHRoZSBlZGdlIHRhYmxlOyBvdGhlcndpc2Ugd2UgbmVlZCB0byBjcmVhdGUgYVxuICAgIC8vIENvbm5lY3RlZFRhYmxlXG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzID09PSBvdGhlck5vZGVDbGFzcyAmJiBhdHRyaWJ1dGUgPT09IG90aGVyQXR0cmlidXRlXG4gICAgICA/IHRoaXNIYXNoIDogdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSBzdXBlci5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIHRoaXMuY29ubmVjdGVkQ2xhc3NlcygpKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBzb3VyY2VOb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkXS50YWJsZUlkO1xuICAgIG9wdGlvbnMudGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzXG4gICAgICAuY29uY2F0KFsgc291cmNlVGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogdGFyZ2V0Tm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBvcHRpb25zLnRhYmxlSWRzID0gdGhpcy5jbGFzc09iai50YXJnZXRUYWJsZUlkc1xuICAgICAgLmNvbmNhdChbIHRhcmdldFRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIG5vZGVzIChvcHRpb25zKSB7XG4gICAgeWllbGQgKiB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpO1xuICAgIHlpZWxkICogdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlRWRnZXMgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICAgIHlpZWxkIHsgc291cmNlLCBlZGdlOiB0aGlzLCB0YXJnZXQgfTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgaHlwZXJlZGdlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgc291cmNlczogW10sXG4gICAgICB0YXJnZXRzOiBbXSxcbiAgICAgIGVkZ2U6IHRoaXNcbiAgICB9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHNvdXJjZSk7XG4gICAgfVxuICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHRhcmdldCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy50YWJsZS5hZ2dyZWdhdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLmFnZ3JlZ2F0ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1RhcmdldENsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcblxuY29uc3QgREFUQUxJQl9GT1JNQVRTID0ge1xuICAnanNvbic6ICdqc29uJyxcbiAgJ2Nzdic6ICdjc3YnLFxuICAndHN2JzogJ3RzdicsXG4gICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICd0cmVlanNvbic6ICd0cmVlanNvbidcbn07XG5cbmNsYXNzIE5ldHdvcmtNb2RlbCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBvcmlncmFwaCxcbiAgICBtb2RlbElkLFxuICAgIG5hbWUgPSBtb2RlbElkLFxuICAgIGFubm90YXRpb25zID0ge30sXG4gICAgY2xhc3NlcyA9IHt9LFxuICAgIHRhYmxlcyA9IHt9XG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX29yaWdyYXBoID0gb3JpZ3JhcGg7XG4gICAgdGhpcy5tb2RlbElkID0gbW9kZWxJZDtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9ucztcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcbiAgICB0aGlzLnRhYmxlcyA9IHt9O1xuXG4gICAgdGhpcy5fbmV4dENsYXNzSWQgPSAxO1xuICAgIHRoaXMuX25leHRUYWJsZUlkID0gMTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhjbGFzc2VzKSkge1xuICAgICAgdGhpcy5jbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gdGhpcy5oeWRyYXRlKGNsYXNzT2JqLCBDTEFTU0VTKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICAgIHRoaXMudGFibGVzW3RhYmxlLnRhYmxlSWRdID0gdGhpcy5oeWRyYXRlKHRhYmxlLCBUQUJMRVMpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ3VwZGF0ZScsICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zYXZlVGltZW91dCk7XG4gICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vcmlncmFwaC5zYXZlKCk7XG4gICAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuICAgICAgfSwgMCk7XG4gICAgfSk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBjbGFzc2VzID0ge307XG4gICAgY29uc3QgdGFibGVzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0udHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXSA9IHRhYmxlT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdLnR5cGUgPSB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWxJZDogdGhpcy5tb2RlbElkLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnMsXG4gICAgICBjbGFzc2VzLFxuICAgICAgdGFibGVzXG4gICAgfTtcbiAgfVxuICBnZXQgdW5zYXZlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NhdmVUaW1lb3V0ICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgaHlkcmF0ZSAocmF3T2JqZWN0LCBUWVBFUykge1xuICAgIHJhd09iamVjdC5tb2RlbCA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBUWVBFU1tyYXdPYmplY3QudHlwZV0ocmF3T2JqZWN0KTtcbiAgfVxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIHdoaWxlICghb3B0aW9ucy50YWJsZUlkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSkpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7dGhpcy5fbmV4dFRhYmxlSWR9YDtcbiAgICAgIHRoaXMuX25leHRUYWJsZUlkICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVEFCTEVTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgZmluZENsYXNzIChjbGFzc05hbWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NOYW1lID09PSBjbGFzc05hbWUpO1xuICB9XG4gIHJlbmFtZSAobmV3TmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhbm5vdGF0ZSAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5fb3JpZ3JhcGguZGVsZXRlTW9kZWwodGhpcy5tb2RlbElkKTtcbiAgfVxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNUYWJsZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHlgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuX29yaWdyYXBoLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uLCB0ZXh0IH0pIHtcbiAgICBsZXQgZGF0YSwgYXR0cmlidXRlcztcbiAgICBpZiAoIWV4dGVuc2lvbikge1xuICAgICAgZXh0ZW5zaW9uID0gbWltZS5leHRlbnNpb24obWltZS5sb29rdXAobmFtZSkpO1xuICAgIH1cbiAgICBpZiAoREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBkZWxldGVBbGxVbnVzZWRUYWJsZXMgKCkge1xuICAgIGZvciAoY29uc3QgdGFibGVJZCBpbiB0aGlzLnRhYmxlcykge1xuICAgICAgaWYgKHRoaXMudGFibGVzW3RhYmxlSWRdKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy50YWJsZXNbdGFibGVJZF0uZGVsZXRlKCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmICghZXJyLmluVXNlKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgZ2V0U2FtcGxlR3JhcGggKHtcbiAgICByb290Q2xhc3MgPSBudWxsLFxuICAgIGJyYW5jaExpbWl0ID0gSW5maW5pdHksXG4gICAgbm9kZUxpbWl0ID0gSW5maW5pdHksXG4gICAgZWRnZUxpbWl0ID0gSW5maW5pdHksXG4gICAgdHJpcGxlTGltaXQgPSBJbmZpbml0eVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBzYW1wbGVHcmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdLFxuICAgICAgZWRnZUxvb2t1cDoge30sXG4gICAgICBsaW5rczogW11cbiAgICB9O1xuXG4gICAgbGV0IG51bVRyaXBsZXMgPSAwO1xuICAgIGNvbnN0IGFkZE5vZGUgPSBub2RlID0+IHtcbiAgICAgIGlmIChzYW1wbGVHcmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPSBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVzLnB1c2gobm9kZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2FtcGxlR3JhcGgubm9kZXMubGVuZ3RoIDw9IG5vZGVMaW1pdDtcbiAgICB9O1xuICAgIGNvbnN0IGFkZEVkZ2UgPSBlZGdlID0+IHtcbiAgICAgIGlmIChzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF0gPSBzYW1wbGVHcmFwaC5lZGdlcy5sZW5ndGg7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VzLnB1c2goZWRnZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2FtcGxlR3JhcGguZWRnZXMubGVuZ3RoIDw9IGVkZ2VMaW1pdDtcbiAgICB9O1xuICAgIGNvbnN0IGFkZFRyaXBsZSA9IChzb3VyY2UsIGVkZ2UsIHRhcmdldCkgPT4ge1xuICAgICAgaWYgKGFkZE5vZGUoc291cmNlKSAmJiBhZGROb2RlKHRhcmdldCkgJiYgYWRkRWRnZShlZGdlKSkge1xuICAgICAgICBzYW1wbGVHcmFwaC5saW5rcy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2U6IHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdLFxuICAgICAgICAgIHRhcmdldDogc2FtcGxlR3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgZWRnZTogc2FtcGxlR3JhcGguZWRnZUxvb2t1cFtlZGdlLmluc3RhbmNlSWRdXG4gICAgICAgIH0pO1xuICAgICAgICBudW1UcmlwbGVzKys7XG4gICAgICAgIHJldHVybiBudW1UcmlwbGVzIDw9IHRyaXBsZUxpbWl0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsZXQgY2xhc3NMaXN0ID0gcm9vdENsYXNzID8gW3Jvb3RDbGFzc10gOiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3Nlcyk7XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGlmICghYWRkTm9kZShub2RlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgc291cmNlLCBlZGdlLCB0YXJnZXQgfSBvZiBub2RlLnBhaXJ3aXNlTmVpZ2hib3Job29kKHsgbGltaXQ6IGJyYW5jaExpbWl0IH0pKSB7XG4gICAgICAgICAgICBpZiAoIWFkZFRyaXBsZShzb3VyY2UsIGVkZ2UsIHRhcmdldCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGlmICghYWRkRWRnZShlZGdlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgc291cmNlLCB0YXJnZXQgfSBvZiBlZGdlLnBhaXJ3aXNlRWRnZXMoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmICghYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgfVxuICBhc3luYyBnZXRJbnN0YW5jZUdyYXBoIChpbnN0YW5jZXMpIHtcbiAgICBpZiAoIWluc3RhbmNlcykge1xuICAgICAgLy8gV2l0aG91dCBzcGVjaWZpZWQgaW5zdGFuY2VzLCBqdXN0IHBpY2sgdGhlIGZpcnN0IDUgZnJvbSBlYWNoIG5vZGVcbiAgICAgIC8vIGFuZCBlZGdlIGNsYXNzXG4gICAgICBpbnN0YW5jZXMgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgfHwgY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoeyBsaW1pdDogNSB9KSkge1xuICAgICAgICAgICAgaW5zdGFuY2VzLnB1c2goaXRlbSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBub2RlTG9va3VwOiB7fSxcbiAgICAgIGVkZ2VzOiBbXVxuICAgIH07XG4gICAgY29uc3QgZWRnZVRhYmxlRW50cmllcyA9IFtdO1xuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgaW5zdGFuY2VzKSB7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGdyYXBoLm5vZGVMb29rdXBbaW5zdGFuY2UuaW5zdGFuY2VJZF0gPSBncmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICAgIG5vZGVJbnN0YW5jZTogaW5zdGFuY2UsXG4gICAgICAgICAgZHVtbXk6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZVRhYmxlRW50cmllcy5wdXNoKGluc3RhbmNlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBlZGdlSW5zdGFuY2Ugb2YgZWRnZVRhYmxlRW50cmllcykge1xuICAgICAgY29uc3Qgc291cmNlcyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZUluc3RhbmNlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBzb3VyY2VzLnB1c2goZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCB0YXJnZXRzID0gW107XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlSW5zdGFuY2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRhcmdldHMucHVzaChncmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzb3VyY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBpZiAodGFyZ2V0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAvLyBXZSBoYXZlIGNvbXBsZXRlbHkgaGFuZ2luZyBlZGdlcywgbWFrZSBkdW1teSBub2RlcyBmb3IgdGhlXG4gICAgICAgICAgLy8gc291cmNlIGFuZCB0YXJnZXRcbiAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGggKyAxXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUaGUgc291cmNlcyBhcmUgaGFuZ2luZywgYnV0IHdlIGhhdmUgdGFyZ2V0c1xuICAgICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgICB0YXJnZXRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0YXJnZXRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBUaGUgdGFyZ2V0cyBhcmUgaGFuZ2luZywgYnV0IHdlIGhhdmUgc291cmNlc1xuICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVpdGhlciB0aGUgc291cmNlLCBub3IgdGhlIHRhcmdldCBhcmUgaGFuZ2luZ1xuICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgICAgc291cmNlLFxuICAgICAgICAgICAgICB0YXJnZXRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TmV0d29ya01vZGVsR3JhcGggKHtcbiAgICByYXcgPSB0cnVlLFxuICAgIGluY2x1ZGVEdW1taWVzID0gZmFsc2UsXG4gICAgY2xhc3NMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc2VzID0gW107XG4gICAgbGV0IGdyYXBoID0ge1xuICAgICAgY2xhc3NlczogW10sXG4gICAgICBjbGFzc0xvb2t1cDoge30sXG4gICAgICBjbGFzc0Nvbm5lY3Rpb25zOiBbXVxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgLy8gQWRkIGFuZCBpbmRleCB0aGUgY2xhc3MgYXMgYSBub2RlXG4gICAgICBjb25zdCBjbGFzc1NwZWMgPSByYXcgPyBjbGFzc09iai5fdG9SYXdPYmplY3QoKSA6IHsgY2xhc3NPYmogfTtcbiAgICAgIGNsYXNzU3BlYy50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLmNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gZ3JhcGguY2xhc3Nlcy5sZW5ndGg7XG4gICAgICBncmFwaC5jbGFzc2VzLnB1c2goY2xhc3NTcGVjKTtcblxuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAvLyBTdG9yZSB0aGUgZWRnZSBjbGFzcyBzbyB3ZSBjYW4gY3JlYXRlIGNsYXNzQ29ubmVjdGlvbnMgbGF0ZXJcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyAmJiBpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBub2RlXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2NsYXNzT2JqLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoIC0gMSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBmYWxzZSxcbiAgICAgICAgICBsb2NhdGlvbjogJ25vZGUnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgZXhpc3RpbmcgY2xhc3NDb25uZWN0aW9uc1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIGVkZ2VDbGFzc2VzKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgc291cmNlIG5vZGUgY2xhc3MgdG8gdGhlIGVkZ2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWR9PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJ1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgc291cmNlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGBkdW1teT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgZWRnZSBjbGFzcyB0byB0aGUgdGFyZ2V0IG5vZGUgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PiR7ZWRnZUNsYXNzLnRhcmdldENsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0J1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgdGFyZ2V0IGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0JyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldFRhYmxlRGVwZW5kZW5jeUdyYXBoICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIHRhYmxlczogW10sXG4gICAgICB0YWJsZUxvb2t1cDoge30sXG4gICAgICB0YWJsZUxpbmtzOiBbXVxuICAgIH07XG4gICAgY29uc3QgdGFibGVMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcyk7XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGNvbnN0IHRhYmxlU3BlYyA9IHRhYmxlLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVTcGVjLnR5cGUgPSB0YWJsZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBncmFwaC50YWJsZXMubGVuZ3RoO1xuICAgICAgZ3JhcGgudGFibGVzLnB1c2godGFibGVTcGVjKTtcbiAgICB9XG4gICAgLy8gRmlsbCB0aGUgZ3JhcGggd2l0aCBsaW5rcyBiYXNlZCBvbiBwYXJlbnRUYWJsZXMuLi5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0YWJsZS5wYXJlbnRUYWJsZXMpIHtcbiAgICAgICAgZ3JhcGgudGFibGVMaW5rcy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLnRhYmxlTG9va3VwW3BhcmVudFRhYmxlLnRhYmxlSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRNb2RlbER1bXAgKCkge1xuICAgIC8vIEJlY2F1c2Ugb2JqZWN0IGtleSBvcmRlcnMgYXJlbid0IGRldGVybWluaXN0aWMsIGl0IGNhbiBiZSBwcm9ibGVtYXRpY1xuICAgIC8vIGZvciB0ZXN0aW5nIChiZWNhdXNlIGlkcyBjYW4gcmFuZG9tbHkgY2hhbmdlIGZyb20gdGVzdCBydW4gdG8gdGVzdCBydW4pLlxuICAgIC8vIFRoaXMgZnVuY3Rpb24gc29ydHMgZWFjaCBrZXksIGFuZCBqdXN0IHJlcGxhY2VzIElEcyB3aXRoIGluZGV4IG51bWJlcnNcbiAgICBjb25zdCByYXdPYmogPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHRoaXMuX3RvUmF3T2JqZWN0KCkpKTtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBjbGFzc2VzOiBPYmplY3QudmFsdWVzKHJhd09iai5jbGFzc2VzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy5jbGFzc2VzW2EuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLmNsYXNzZXNbYi5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzcyBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHRhYmxlczogT2JqZWN0LnZhbHVlcyhyYXdPYmoudGFibGVzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy50YWJsZXNbYS50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMudGFibGVzW2IudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgdGFibGUgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9O1xuICAgIGNvbnN0IGNsYXNzTG9va3VwID0ge307XG4gICAgY29uc3QgdGFibGVMb29rdXAgPSB7fTtcbiAgICByZXN1bHQuY2xhc3Nlcy5mb3JFYWNoKChjbGFzc09iaiwgaW5kZXgpID0+IHtcbiAgICAgIGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gaW5kZXg7XG4gICAgfSk7XG4gICAgcmVzdWx0LnRhYmxlcy5mb3JFYWNoKCh0YWJsZSwgaW5kZXgpID0+IHtcbiAgICAgIHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gaW5kZXg7XG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHJlc3VsdC50YWJsZXMpIHtcbiAgICAgIHRhYmxlLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXTtcbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKSkge1xuICAgICAgICB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlTG9va3VwW3RhYmxlSWRdXSA9IHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICAgIGRlbGV0ZSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRhYmxlLmRhdGE7IC8vIGRvbid0IGluY2x1ZGUgYW55IG9mIHRoZSBkYXRhOyB3ZSBqdXN0IHdhbnQgdGhlIG1vZGVsIHN0cnVjdHVyZVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIHJlc3VsdC5jbGFzc2VzKSB7XG4gICAgICBjbGFzc09iai5jbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF07XG4gICAgICBjbGFzc09iai50YWJsZUlkID0gdGFibGVMb29rdXBbY2xhc3NPYmoudGFibGVJZF07XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouc291cmNlQ2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlVGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMgPSBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai50YXJnZXRDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMgPSBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGNsYXNzSWQgb2YgT2JqZWN0LmtleXMoY2xhc3NPYmouZWRnZUNsYXNzSWRzIHx8IHt9KSkge1xuICAgICAgICBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NMb29rdXBbY2xhc3NJZF1dID0gY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgICBkZWxldGUgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGNyZWF0ZVNjaGVtYU1vZGVsICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHRoaXMuZ2V0UmF3U2NoZW1hR3JhcGgoKTtcbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZU1vZGVsKHsgbmFtZTogdGhpcy5uYW1lICsgJ19zY2hlbWEnIH0pO1xuICAgIGxldCBjbGFzc2VzID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGguY2xhc3NlcyxcbiAgICAgIG5hbWU6ICdDbGFzc2VzJ1xuICAgIH0pLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBsZXQgY2xhc3NDb25uZWN0aW9ucyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMsXG4gICAgICBuYW1lOiAnQ2xhc3MgQ29ubmVjdGlvbnMnXG4gICAgfSkuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgIGxldCB0YWJsZXMgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaC50YWJsZXMsXG4gICAgICBuYW1lOiAnVGFibGVzJ1xuICAgIH0pLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBsZXQgdGFibGVMaW5rcyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLnRhYmxlTGlua3MsXG4gICAgICBuYW1lOiAnVGFibGUgTGlua3MnXG4gICAgfSkuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgIGNsYXNzZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogY2xhc3NDb25uZWN0aW9ucyxcbiAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIGVkZ2VBdHRyaWJ1dGU6ICdzb3VyY2UnXG4gICAgfSk7XG4gICAgY2xhc3Nlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgZWRnZUNsYXNzOiBjbGFzc0Nvbm5lY3Rpb25zLFxuICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICBub2RlQXR0cmlidXRlOiBudWxsLFxuICAgICAgZWRnZUF0dHJpYnV0ZTogJ3RhcmdldCdcbiAgICB9KTtcbiAgICB0YWJsZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogdGFibGVMaW5rcyxcbiAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIGVkZ2VBdHRyaWJ1dGU6ICdzb3VyY2UnXG4gICAgfSk7XG4gICAgdGFibGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICBlZGdlQ2xhc3M6IHRhYmxlTGlua3MsXG4gICAgICBzaWRlOiAndGFyZ2V0JyxcbiAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICBlZGdlQXR0cmlidXRlOiAndGFyZ2V0J1xuICAgIH0pO1xuICAgIGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YWJsZUlkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiAndGFibGVJZCdcbiAgICB9KS5zZXRDbGFzc05hbWUoJ0NvcmUgVGFibGVzJyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOZXR3b3JrTW9kZWw7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBOZXR3b3JrTW9kZWwgZnJvbSAnLi9Db21tb24vTmV0d29ya01vZGVsLmpzJztcblxubGV0IE5FWFRfTU9ERUxfSUQgPSAxO1xuXG5jbGFzcyBPcmlncmFwaCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuXG4gICAgdGhpcy5wbHVnaW5zID0ge307XG5cbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIGxldCBleGlzdGluZ01vZGVscyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ29yaWdyYXBoX21vZGVscycpO1xuICAgIGlmIChleGlzdGluZ01vZGVscykge1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKEpTT04ucGFyc2UoZXhpc3RpbmdNb2RlbHMpKSkge1xuICAgICAgICBtb2RlbC5vcmlncmFwaCA9IHRoaXM7XG4gICAgICAgIHRoaXMubW9kZWxzW21vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChtb2RlbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICB9XG4gIHJlZ2lzdGVyUGx1Z2luIChuYW1lLCBwbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbnNbbmFtZV0gPSBwbHVnaW47XG4gIH1cbiAgc2F2ZSAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgfVxuICBjbG9zZUN1cnJlbnRNb2RlbCAoKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgZ2V0IGN1cnJlbnRNb2RlbCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW3RoaXMuX2N1cnJlbnRNb2RlbElkXSB8fCBudWxsO1xuICB9XG4gIHNldCBjdXJyZW50TW9kZWwgKG1vZGVsKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBtb2RlbCA/IG1vZGVsLm1vZGVsSWQgOiBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5pbXBvcnQgRmlsZVJlYWRlciBmcm9tICdmaWxlcmVhZGVyJztcblxubGV0IG9yaWdyYXBoID0gbmV3IE9yaWdyYXBoKEZpbGVSZWFkZXIsIG51bGwpO1xub3JpZ3JhcGgudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBvcmlncmFwaDtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiX2V2ZW50SGFuZGxlcnMiLCJfc3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiZXZlbnQiLCJuYW1lc3BhY2UiLCJzcGxpdCIsInB1c2giLCJvZmYiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImhhbmRsZUNhbGxiYWNrIiwic2V0VGltZW91dCIsImFwcGx5IiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkdlbmVyaWNXcmFwcGVyIiwib3B0aW9ucyIsInRhYmxlIiwidW5kZWZpbmVkIiwiRXJyb3IiLCJjbGFzc09iaiIsInJvdyIsImNvbm5lY3RlZEl0ZW1zIiwiY29ubmVjdEl0ZW0iLCJpdGVtIiwidGFibGVJZCIsImRpc2Nvbm5lY3QiLCJpdGVtTGlzdCIsInZhbHVlcyIsImluc3RhbmNlSWQiLCJjbGFzc0lkIiwiZXF1YWxzIiwiaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwidGFibGVJZHMiLCJsaW1pdCIsIkluZmluaXR5IiwiUHJvbWlzZSIsImFsbCIsIm1hcCIsIm1vZGVsIiwidGFibGVzIiwiYnVpbGRDYWNoZSIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJsZW5ndGgiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsImZ1bmMiLCJnZXRTb3J0SGFzaCIsIkZ1bmN0aW9uIiwidG9TdHJpbmciLCJpdGVyYXRlIiwicmVzZXQiLCJfY2FjaGUiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJpdGVyYXRvciIsIl9pdGVyYXRlIiwiY29tcGxldGVkIiwibmV4dCIsImRvbmUiLCJfZmluaXNoSXRlbSIsIndyYXBwZWRJdGVtIiwiZGVyaXZlZFJlc3VsdCIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZGVyaXZlZFRhYmxlIiwiX2NhY2hlUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJjb3VudFJvd3MiLCJjYWNoZSIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJkZWxpbWl0ZXIiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNsb3NlZFRyYW5zcG9zZSIsImluZGV4ZXMiLCJvcGVuVHJhbnNwb3NlIiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0Iiwib3RoZXJUYWJsZSIsImNsYXNzZXMiLCJwYXJlbnRUYWJsZXMiLCJyZWR1Y2UiLCJhZ2ciLCJpblVzZSIsInNvbWUiLCJzb3VyY2VUYWJsZUlkcyIsInRhcmdldFRhYmxlSWRzIiwiZGVsZXRlIiwiZXJyIiwicGFyZW50VGFibGUiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJTdGF0aWNEaWN0VGFibGUiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBZ2dyZWdhdGVkVGFibGUiLCJfYXR0cmlidXRlIiwiX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsInJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsIl9kZWh5ZHJhdGVGdW5jdGlvbiIsImRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUiLCJfdXBkYXRlSXRlbSIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJuZXdXcmFwcGVkSXRlbSIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwicmVkdWNlZCIsIkV4cGFuZGVkVGFibGUiLCJGYWNldGVkVGFibGUiLCJfdmFsdWUiLCJUcmFuc3Bvc2VkVGFibGUiLCJfaW5kZXgiLCJDb25uZWN0ZWRUYWJsZSIsImpvaW4iLCJiYXNlUGFyZW50VGFibGUiLCJvdGhlclBhcmVudFRhYmxlcyIsIkdlbmVyaWNDbGFzcyIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJhbm5vdGF0aW9ucyIsInNldENsYXNzTmFtZSIsImhhc0N1c3RvbU5hbWUiLCJ2YXJpYWJsZU5hbWUiLCJmaWx0ZXIiLCJkIiwidG9Mb2NhbGVVcHBlckNhc2UiLCJpbnRlcnByZXRBc05vZGVzIiwib3ZlcndyaXRlIiwiY3JlYXRlQ2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiX2Rlcml2ZU5ld0NsYXNzIiwiZ2V0U2FtcGxlR3JhcGgiLCJyb290Q2xhc3MiLCJOb2RlV3JhcHBlciIsImVkZ2VzIiwiZWRnZUlkcyIsImNsYXNzSWRzIiwiZWRnZUNsYXNzSWRzIiwiZWRnZUlkIiwiZWRnZUNsYXNzIiwicm9sZSIsImdldEVkZ2VSb2xlIiwicmV2ZXJzZSIsImNvbmNhdCIsInBhaXJ3aXNlTmVpZ2hib3Job29kIiwiZWRnZSIsInBhaXJ3aXNlRWRnZXMiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NlcyIsImVkZ2VDbGFzc0lkIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJhdXRvY29ubmVjdCIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImlzU291cmNlIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJub2RlQ2xhc3MiLCJ0YWJsZUlkTGlzdCIsImRpcmVjdGVkIiwic291cmNlRWRnZUNsYXNzIiwidGFyZ2V0RWRnZUNsYXNzIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJuZXdOb2RlQ2xhc3MiLCJjb25uZWN0ZWRDbGFzc2VzIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VOb2RlcyIsInNvdXJjZVRhYmxlSWQiLCJ0YXJnZXROb2RlcyIsInRhcmdldFRhYmxlSWQiLCJub2RlcyIsInNvdXJjZSIsInRhcmdldCIsImh5cGVyZWRnZSIsInNvdXJjZXMiLCJ0YXJnZXRzIiwiRWRnZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsIl9zcGxpdFRhYmxlSWRMaXN0Iiwib3RoZXJDbGFzcyIsIm5vZGVUYWJsZUlkTGlzdCIsImVkZ2VUYWJsZUlkIiwiZWRnZVRhYmxlSWRMaXN0Iiwic3RhdGljRXhpc3RzIiwidGFibGVEaXN0YW5jZXMiLCJzdGFydHNXaXRoIiwiZGlzdCIsIk1hdGgiLCJhYnMiLCJzb3J0IiwiYSIsImIiLCJzaWRlIiwiY29ubmVjdFNvdXJjZSIsImNvbm5lY3RUYXJnZXQiLCJ0b2dnbGVEaXJlY3Rpb24iLCJzd2FwcGVkRGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwidW5zaGlmdCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiREFUQUxJQl9GT1JNQVRTIiwiTmV0d29ya01vZGVsIiwib3JpZ3JhcGgiLCJtb2RlbElkIiwiX29yaWdyYXBoIiwiX25leHRDbGFzc0lkIiwiX25leHRUYWJsZUlkIiwiaHlkcmF0ZSIsIkNMQVNTRVMiLCJUQUJMRVMiLCJfc2F2ZVRpbWVvdXQiLCJzYXZlIiwidW5zYXZlZCIsInJhd09iamVjdCIsIlRZUEVTIiwic2VsZWN0b3IiLCJmaW5kQ2xhc3MiLCJyZW5hbWUiLCJuZXdOYW1lIiwiYW5ub3RhdGUiLCJrZXkiLCJkZWxldGVBbm5vdGF0aW9uIiwiZGVsZXRlTW9kZWwiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsIm1pbWUiLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsImNvbnNvbGUiLCJ3YXJuIiwidGV4dCIsInJlYWRlciIsIkZpbGVSZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImxvb2t1cCIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJicmFuY2hMaW1pdCIsIm5vZGVMaW1pdCIsImVkZ2VMaW1pdCIsInRyaXBsZUxpbWl0Iiwic2FtcGxlR3JhcGgiLCJub2RlTG9va3VwIiwiZWRnZUxvb2t1cCIsImxpbmtzIiwibnVtVHJpcGxlcyIsImFkZE5vZGUiLCJub2RlIiwiYWRkRWRnZSIsImFkZFRyaXBsZSIsImNsYXNzTGlzdCIsImdldEluc3RhbmNlR3JhcGgiLCJpbnN0YW5jZXMiLCJncmFwaCIsImVkZ2VUYWJsZUVudHJpZXMiLCJpbnN0YW5jZSIsIm5vZGVJbnN0YW5jZSIsImR1bW15IiwiZWRnZUluc3RhbmNlIiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJyYXciLCJpbmNsdWRlRHVtbWllcyIsImNsYXNzTG9va3VwIiwiY2xhc3NDb25uZWN0aW9ucyIsImNsYXNzU3BlYyIsImlkIiwibG9jYXRpb24iLCJnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCIsInRhYmxlTG9va3VwIiwidGFibGVMaW5rcyIsInRhYmxlTGlzdCIsInRhYmxlU3BlYyIsImdldE1vZGVsRHVtcCIsInJhd09iaiIsIkpTT04iLCJwYXJzZSIsInN0cmluZ2lmeSIsImFIYXNoIiwiYkhhc2giLCJjcmVhdGVTY2hlbWFNb2RlbCIsImdldFJhd1NjaGVtYUdyYXBoIiwibmV3TW9kZWwiLCJjcmVhdGVNb2RlbCIsIk5FWFRfTU9ERUxfSUQiLCJPcmlncmFwaCIsImxvY2FsU3RvcmFnZSIsInBsdWdpbnMiLCJtb2RlbHMiLCJleGlzdGluZ01vZGVscyIsImdldEl0ZW0iLCJfY3VycmVudE1vZGVsSWQiLCJyZWdpc3RlclBsdWdpbiIsInBsdWdpbiIsInNldEl0ZW0iLCJjbG9zZUN1cnJlbnRNb2RlbCIsImN1cnJlbnRNb2RlbCIsImN1cnJlbnRNb2RlbElkIiwiZGVsZXRlQWxsTW9kZWxzIiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsY0FBTCxHQUFzQixFQUF0QjtXQUNLQyxlQUFMLEdBQXVCLEVBQXZCOzs7SUFFRkMsRUFBRSxDQUFFQyxTQUFGLEVBQWFDLFFBQWIsRUFBdUI7VUFDbkIsQ0FBQ0MsS0FBRCxFQUFRQyxTQUFSLElBQXFCSCxTQUFTLENBQUNJLEtBQVYsQ0FBZ0IsR0FBaEIsQ0FBekI7V0FDS1AsY0FBTCxDQUFvQkssS0FBcEIsSUFBNkIsS0FBS0wsY0FBTCxDQUFvQkssS0FBcEIsS0FDM0I7WUFBTTtPQURSOztVQUVJLENBQUNDLFNBQUwsRUFBZ0I7YUFDVE4sY0FBTCxDQUFvQkssS0FBcEIsRUFBMkIs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
