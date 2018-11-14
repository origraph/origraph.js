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

    on(eventName, callback, allowDuplicateListeners) {
      if (!this._eventHandlers[eventName]) {
        this._eventHandlers[eventName] = [];
      }

      if (!allowDuplicateListeners) {
        if (this._eventHandlers[eventName].indexOf(callback) !== -1) {
          return;
        }
      }

      this._eventHandlers[eventName].push(callback);
    }

    off(eventName, callback) {
      if (this._eventHandlers[eventName]) {
        if (!callback) {
          delete this._eventHandlers[eventName];
        } else {
          let index = this._eventHandlers[eventName].indexOf(callback);

          if (index >= 0) {
            this._eventHandlers[eventName].splice(index, 1);
          }
        }
      }
    }

    trigger(eventName, ...args) {
      if (this._eventHandlers[eventName]) {
        this._eventHandlers[eventName].forEach(callback => {
          setTimeout(() => {
            // Add timeout to prevent blocking
            callback.apply(this, args);
          }, 0);
        });
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
      usedByClasses: this._usedByClasses,
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

  hydrateFunction(stringifiedFunc) {
    new Function(`return ${stringifiedFunc}`)(); // eslint-disable-line no-new-func
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
          _this2._finishItem(temp.value);

          _this2._partialCache[temp.value.index] = temp.value;
          yield temp.value;
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

  _finishItem(wrappedItem) {
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
    return Object.keys((await this.buildCache())).length;
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
  }

  suppressAttribute(attribute) {
    if (attribute === null) {
      this._suppressIndex = true;
    } else {
      this._suppressedAttributes[attribute] = true;
    }

    this.reset();
  }

  addFilter(attribute, func) {
    if (attribute === null) {
      this._indexFilter = func;
    } else {
      this._attributeFilters[attribute] = func;
    }

    this.reset();
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

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (let index = 0; index < _this._data.length; index++) {
        const item = _this._wrap({
          index,
          row: _this._data[index]
        });

        if (_this._finishItem(item)) {
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

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (const [index, row] of Object.entries(_this._data)) {
        const item = _this._wrap({
          index,
          row
        });

        if (_this._finishItem(item)) {
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

        if (!_this._finishItem(wrappedItem)) {
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

            if (_this._finishItem(newItem)) {
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

            if (_this._finishItem(newItem)) {
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

        if (_this._finishItem(newItem)) {
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

        if (_this._finishItem(newItem)) {
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
      const edgeIds = options.edgeIds || _this.classObj.edgeClassIds;
      let i = 0;

      for (const edgeId of Object.keys(edgeIds)) {
        const edgeClass = _this.classObj.model.classes[edgeId];

        if (edgeClass.sourceClassId === _this.classObj.classId) {
          options.tableIds = edgeClass.sourceTableIds.slice().reverse().concat([edgeClass.tableId]);
        } else {
          options.tableIds = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]);
        }

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
    })();
  }

  pairwiseNeighborhood(options) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this2.edges(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const edge = _value2;
          yield* _asyncGeneratorDelegate(_asyncIterator(edge.pairwiseEdges(options)), _awaitAsyncGenerator);
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

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.edgeClassIds = options.edgeClassIds || {};
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

  interpretAsEdges() {
    const edgeClassIds = Object.keys(this.edgeClassIds);

    const options = super._toRawObject();

    if (edgeClassIds.length > 2) {
      // If there are more than two edges, break all connections and make
      // this a floating edge (for now, we're not dealing in hyperedges)
      this.disconnectAllEdges();
    } else if (edgeClassIds.length === 1) {
      // With only one connection, this node should become a self-edge
      const edgeClass = this.model.classes[edgeClassIds[0]]; // Are we the source or target of the existing edge (internally, in terms
      // of sourceId / targetId, not edgeClass.direction)?

      const isSource = edgeClass.sourceClassId === this.classId; // As we're converted to an edge, our new resulting source AND target
      // should be whatever is at the other end of edgeClass (if anything)

      if (isSource) {
        options.sourceClassId = options.targetClassId = edgeClass.targetClassId;
      } else {
        options.sourceClassId = options.targetClassId = edgeClass.sourceClassId;
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
      options.sourceTableIds = options.targetTableIds = tableIdList; // TODO: instead of deleting the existing edge class, should we leave it
      // hanging + unconnected?

      edgeClass.delete();
    } else if (edgeClassIds.length === 2) {
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
      options.targetClassId = targetEdgeClass.classId; // If node classes exist on the other end of those edges, add this class
      // to their edgeClassIds

      if (this.model.classes[options.sourceClassId]) {
        this.model.classes[options.sourceClassId].edgeClassIds[this.classId] = true;
      }

      if (this.model.classes[options.targetClassId]) {
        this.model.classes[options.targetClassId].edgeClassIds[this.classId] = true;
      } // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table


      options.sourceTableIds = sourceEdgeClass.targetTableIds.slice().reverse().concat([sourceEdgeClass.tableId]).concat(sourceEdgeClass.sourceTableIds);

      if (sourceEdgeClass.targetClassId === this.classId) {
        options.sourceTableIds.reverse();
      }

      options.targetTableIds = targetEdgeClass.targetTableIds.slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.sourceTableIds);

      if (targetEdgeClass.targetClassId === this.classId) {
        options.targetTableIds.reverse();
      } // Delete each of the edge classes


      sourceEdgeClass.delete();
      targetEdgeClass.delete();
    }

    this.delete();
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
      if (_this.classObj.sourceClassId === null) {
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
      if (_this2.classObj.targetClassId === null) {
        return;
      }

      const targetTableId = _this2.classObj.model.classes[_this2.classObj.targetClassId].tableId;
      options.tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);
      yield* _asyncGeneratorDelegate(_asyncIterator(_this2.iterateAcrossConnections(options)), _awaitAsyncGenerator);
    })();
  }

  pairwiseEdges(options) {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this3.sourceNodes(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const source = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator(_this3.targetNodes(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const target = _value2;
              yield {
                source,
                edge: _this3,
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

    this.disconnectAllEdges();
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
      classes[classObj.classId].type = classObj.type;
    }

    for (const tableObj of Object.values(this.tables)) {
      tables[tableObj.tableId] = tableObj._toRawObject();
      tables[tableObj.tableId].type = tableObj.type;
    }

    return {
      modelId: this.modelId,
      name: this.name,
      annotations: this.annotations,
      classes: this.classes,
      tables: this.tables
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
      let reader = new this.FileReader();

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
    extension = 'txt',
    text
  }) {
    let data, attributes;

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
      edgeLookup: {}
    };
    let numTriples = 0;
    let numEdgeInstances = 0;

    const addNode = node => {
      if (!sampleGraph.nodeLookup[node.instanceId]) {
        sampleGraph.nodeLookup[node.instanceId] = sampleGraph.nodes.length;
        sampleGraph.nodes.push(node);
      }

      return sampleGraph.nodes.length <= nodeLimit;
    };

    const addEdge = edge => {
      if (!sampleGraph.edgeLookup[edge.instanceId]) {
        sampleGraph.edgeLookup[edge.instanceId] = {
          instance: edge,
          pairwiseInstances: []
        };
        numEdgeInstances++;
      }

      return numEdgeInstances <= edgeLimit;
    };

    const addTriple = (source, edge, target) => {
      if (addNode(source) && addNode(target) && addEdge(edge)) {
        sampleGraph.edgeLookup[edge.instanceId].pairwiseInstances.push(sampleGraph.edges.length);
        sampleGraph.edges.push({
          source: sampleGraph.nodeLookup[source.instanceId],
          target: sampleGraph.nodeLookup[target.instanceId],
          edgeInstance: edge
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

  getNetworkModelGraph(includeDummies = false) {
    const edgeClasses = [];
    let graph = {
      classes: [],
      classLookup: {},
      classConnections: []
    };
    const classList = Object.values(this.classes);

    for (const classObj of classList) {
      // Add and index the class as a node
      graph.classLookup[classObj.classId] = graph.classes.length;

      const classSpec = classObj._toRawObject();

      classSpec.type = classObj.constructor.name;
      graph.classes.push(classSpec);

      if (classObj.type === 'Edge') {
        // Store the edge class so we can create classConnections later
        edgeClasses.push(classObj);
      } else if (classObj.type === 'Node' && includeDummies) {
        // Create a "potential" connection + dummy node
        graph.classConnections.push({
          id: `${classObj.classID}>dummy`,
          source: graph.classes.length,
          target: graph.classes.length,
          directed: false,
          location: 'node',
          dummy: true
        });
        graph.nodes.push({
          dummy: true
        });
      } // Create existing classConnections


      edgeClasses.forEach(edgeClass => {
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
      });
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

  getFullSchemaGraph() {
    return Object.assign(this.getNetworkModelGraph(), this.getTableDependencyGraph());
  }

  createSchemaModel() {
    const graph = this.getFullSchemaGraph();

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
    return this.models[this._currentModelId] || this.createModel();
  }

  set currentModel(model) {
    this._currentModelId = model.modelId;
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
var version = "0.1.4";
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
	"@babel/core": "^7.1.5",
	"@babel/plugin-proposal-async-generator-functions": "^7.1.0",
	"@babel/preset-env": "^7.1.5",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.6.0",
	coveralls: "^3.0.2",
	jest: "^23.6.0",
	rollup: "^0.67.1",
	"rollup-plugin-babel": "^4.0.3",
	"rollup-plugin-commonjs": "^9.2.0",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.4.0",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguY2pzLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRXhwYW5kZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRmFjZXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UcmFuc3Bvc2VkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudE5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgZm9yIChjb25zdCBpdGVtTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuY29ubmVjdGVkSXRlbXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbUxpc3QpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSAoaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdIHx8IFtdKS5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IHt9O1xuICB9XG4gIGdldCBpbnN0YW5jZUlkICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jbGFzc09iai5jbGFzc0lkfV8ke3RoaXMuaW5kZXh9YDtcbiAgfVxuICBlcXVhbHMgKGl0ZW0pIHtcbiAgICByZXR1cm4gdGhpcy5pbnN0YW5jZUlkID09PSBpdGVtLmluc3RhbmNlSWQ7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHsgdGFibGVJZHMsIGxpbWl0ID0gSW5maW5pdHkgfSkge1xuICAgIC8vIEZpcnN0IG1ha2Ugc3VyZSB0aGF0IGFsbCB0aGUgdGFibGUgY2FjaGVzIGhhdmUgYmVlbiBmdWxseSBidWlsdCBhbmRcbiAgICAvLyBjb25uZWN0ZWRcbiAgICBhd2FpdCBQcm9taXNlLmFsbCh0YWJsZUlkcy5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5jbGFzc09iai5tb2RlbC50YWJsZXNbdGFibGVJZF0uYnVpbGRDYWNoZSgpO1xuICAgIH0pKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpIHtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgICBpKys7XG4gICAgICBpZiAoaSA+PSBsaW1pdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW3RhYmxlSWRzWzBdXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRoaXNUYWJsZUlkID0gdGFibGVJZHNbMF07XG4gICAgICBjb25zdCByZW1haW5pbmdUYWJsZUlkcyA9IHRhYmxlSWRzLnNsaWNlKDEpO1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuY29ubmVjdGVkSXRlbXNbdGhpc1RhYmxlSWRdIHx8IFtdKSB7XG4gICAgICAgIHlpZWxkICogaXRlbS5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHJlbWFpbmluZ1RhYmxlSWRzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMubW9kZWwgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG5cbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzID0gb3B0aW9ucy5kZXJpdmVkVGFibGVzIHx8IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIHx8IHt9KSkge1xuICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLnN1cHByZXNzZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSAhIW9wdGlvbnMuc3VwcHJlc3NJbmRleDtcblxuICAgIHRoaXMuX2luZGV4RmlsdGVyID0gKG9wdGlvbnMuaW5kZXhGaWx0ZXIgJiYgdGhpcy5oeWRyYXRlRnVuY3Rpb24ob3B0aW9ucy5pbmRleEZpbHRlcikpIHx8IG51bGw7XG4gICAgdGhpcy5fYXR0cmlidXRlRmlsdGVycyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5hdHRyaWJ1dGVGaWx0ZXJzIHx8IHt9KSkge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICB1c2VkQnlDbGFzc2VzOiB0aGlzLl91c2VkQnlDbGFzc2VzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge30sXG4gICAgICBzdXBwcmVzc2VkQXR0cmlidXRlczogdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMsXG4gICAgICBzdXBwcmVzc0luZGV4OiB0aGlzLl9zdXBwcmVzc0luZGV4LFxuICAgICAgYXR0cmlidXRlRmlsdGVyczoge30sXG4gICAgICBpbmRleEZpbHRlcjogKHRoaXMuX2luZGV4RmlsdGVyICYmIHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24odGhpcy5faW5kZXhGaWx0ZXIpKSB8fCBudWxsXG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgcmVzdWx0LmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAgcmVzdWx0LmF0dHJpYnV0ZUZpbHRlcnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gR2VuZXJpYyBjYWNoaW5nIHN0dWZmOyB0aGlzIGlzbid0IGp1c3QgZm9yIHBlcmZvcm1hbmNlLiBDb25uZWN0ZWRUYWJsZSdzXG4gICAgLy8gYWxnb3JpdGhtIHJlcXVpcmVzIHRoYXQgaXRzIHBhcmVudCB0YWJsZXMgaGF2ZSBwcmUtYnVpbHQgaW5kZXhlcyAod2VcbiAgICAvLyB0ZWNobmljYWxseSBjb3VsZCBpbXBsZW1lbnQgaXQgZGlmZmVyZW50bHksIGJ1dCBpdCB3b3VsZCBiZSBleHBlbnNpdmUsXG4gICAgLy8gcmVxdWlyZXMgdHJpY2t5IGxvZ2ljLCBhbmQgd2UncmUgYWxyZWFkeSBidWlsZGluZyBpbmRleGVzIGZvciBzb21lIHRhYmxlc1xuICAgIC8vIGxpa2UgQWdncmVnYXRlZFRhYmxlIGFueXdheSlcbiAgICBpZiAob3B0aW9ucy5yZXNldCkge1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgICB5aWVsZCAqIE9iamVjdC52YWx1ZXModGhpcy5fY2FjaGUpLnNsaWNlKDAsIGxpbWl0KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB5aWVsZCAqIGF3YWl0IHRoaXMuX2J1aWxkQ2FjaGUob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZShvcHRpb25zKTtcbiAgICBsZXQgY29tcGxldGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gaXRlcmF0aW9uIHdhcyBjYW5jZWxsZWQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKTtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3RlbXAudmFsdWUuaW5kZXhdID0gdGVtcC52YWx1ZTtcbiAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbXBsZXRlZCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgZnVuYyh3cmFwcGVkSXRlbS5yb3dbYXR0cl0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IG90aGVySXRlbSBvZiBvcHRpb25zLml0ZW1zVG9Db25uZWN0IHx8IFtdKSB7XG4gICAgICB3cmFwcGVkSXRlbS5jb25uZWN0SXRlbShvdGhlckl0ZW0pO1xuICAgICAgb3RoZXJJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBmb3IgKGNvbnN0IGRlcml2ZWRUYWJsZSBvZiB0aGlzLmRlcml2ZWRUYWJsZXMpIHtcbiAgICAgIGRlcml2ZWRUYWJsZS5yZXNldCgpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0Jyk7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jIGJ1aWxkQ2FjaGUgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fY2FjaGVQcm9taXNlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9jYWNoZVByb21pc2UgPSBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGVtcCBvZiB0aGlzLl9idWlsZENhY2hlKCkpIHt9IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbiAgICAgICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfVxuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpKS5sZW5ndGg7XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIGFkZEZpbHRlciAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZSA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZSAmJiB0aGlzLm1vZGVsLnRhYmxlc1tleGlzdGluZ1RhYmxlLnRhYmxlSWRdKSB8fCBudWxsO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdBZ2dyZWdhdGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdFeHBhbmRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZSxcbiAgICAgIGRlbGltaXRlclxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHZhbHVlcy5tYXAodmFsdWUgPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgdmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlLCBsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgY29uc3QgdmFsdWVzID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdCB9KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKHsgbGltaXQgfSkpIHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleDogd3JhcHBlZEl0ZW0uaW5kZXhcbiAgICAgIH07XG4gICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuICBjb25uZWN0IChvdGhlclRhYmxlTGlzdCkge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnQ29ubmVjdGVkVGFibGUnXG4gICAgfSk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgZm9yIChjb25zdCBvdGhlclRhYmxlIG9mIG90aGVyVGFibGVMaXN0KSB7XG4gICAgICBvdGhlclRhYmxlLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGdldCBpblVzZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLmNsYXNzZXMpLnNvbWUoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlSWQgPT09IHRoaXMudGFibGVJZCB8fFxuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xIHx8XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTE7XG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBpZiAodGhpcy5pblVzZSkge1xuICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgICAgZXJyLmluVXNlID0gdHJ1ZTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0aGlzLnBhcmVudFRhYmxlcykge1xuICAgICAgZGVsZXRlIHBhcmVudFRhYmxlLmRlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aXJlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBBZ2dyZWdhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLm1vZGVsLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLm1vZGVsLl9kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuICfihqYnICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUgKGF0dHIsIGZ1bmMpIHtcbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfdXBkYXRlSXRlbSAob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHNvIHRoYXQgQWdncmVnYXRlZFRhYmxlIGNhbiB0YWtlIGFkdmFudGFnZVxuICAgIC8vIG9mIHRoZSBwYXJ0aWFsbHktYnVpbHQgY2FjaGUgYXMgaXQgZ29lcywgYW5kIHBvc3Rwb25lIGZpbmlzaGluZyBpdGVtc1xuICAgIC8vIHVudGlsIGFmdGVyIHRoZSBwYXJlbnQgdGFibGUgaGFzIGJlZW4gZnVsbHkgaXRlcmF0ZWRcblxuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuX2l0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt3cmFwcGVkSXRlbS5pbmRleF0gPSB3cmFwcGVkSXRlbTtcbiAgICAgIC8vIEdvIGFoZWFkIGFuZCB5aWVsZCB0aGUgdW5maW5pc2hlZCBpdGVtOyB0aGlzIG1ha2VzIGl0IHBvc3NpYmxlIGZvclxuICAgICAgLy8gY2xpZW50IGFwcHMgdG8gYmUgbW9yZSByZXNwb25zaXZlIGFuZCByZW5kZXIgcGFydGlhbCByZXN1bHRzLCBidXQgYWxzb1xuICAgICAgLy8gbWVhbnMgdGhhdCB0aGV5IG5lZWQgdG8gd2F0Y2ggZm9yIHdyYXBwZWRJdGVtLm9uKCd1cGRhdGUnKSBldmVudHNcbiAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgIH1cblxuICAgIC8vIFNlY29uZCBwYXNzOiBub3cgdGhhdCB3ZSd2ZSBjb21wbGV0ZWQgdGhlIGZ1bGwgaXRlcmF0aW9uIG9mIHRoZSBwYXJlbnRcbiAgICAvLyB0YWJsZSwgd2UgY2FuIGZpbmlzaCBlYWNoIGl0ZW1cbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgaWYgKCF0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IFN0cmluZyh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0pIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgICAgZXhpc3RpbmdJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB3cmFwcGVkUGFyZW50LmNvbm5lY3RJdGVtKGV4aXN0aW5nSXRlbSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0oZXhpc3RpbmdJdGVtLCB3cmFwcGVkUGFyZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0obmV3SXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0gc3VwZXIuZ2V0QXR0cmlidXRlRGV0YWlscygpO1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5yZWR1Y2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBBZ2dyZWdhdGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuZGVsaW1pdGVyID0gb3B0aW9ucy5kZWxpbWl0ZXIgfHwgJywnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpCc7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSB8fCAnJykuc3BsaXQodGhpcy5kZWxpbWl0ZXIpO1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0ge307XG4gICAgICAgIHJvd1t0aGlzLl9hdHRyaWJ1dGVdID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3csXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYFske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVHJhbnNwb3NlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuX2luZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9pbmRleDtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYOG1gCR7dGhpcy5faW5kZXh9YDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gcGFyZW50VGFibGUuX2NhY2hlW3RoaXMuX2luZGV4XSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGNvbnN0IFsgaW5kZXgsIHZhbHVlIF0gb2YgT2JqZWN0LmVudHJpZXMod3JhcHBlZFBhcmVudC5yb3cpKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICByb3c6IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgPyB2YWx1ZSA6IHsgdmFsdWUgfSxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBUcmFuc3Bvc2VkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIENvbm5lY3RlZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCfiqK8nKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgLy8gU3BpbiB0aHJvdWdoIGFsbCBvZiB0aGUgcGFyZW50VGFibGVzIHNvIHRoYXQgdGhlaXIgX2NhY2hlIGlzIHByZS1idWlsdFxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG4gICAgfVxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGUpKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pKSB7XG4gICAgICAgIC8vIE5vIG1hdGNoIGluIG9uZSBvZiB0aGUgb3RoZXIgdGFibGVzOyBvbWl0IHRoaXMgaXRlbVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IGFkZCBlYWNoIHBhcmVudCB0YWJsZXMnIGtleXMgYXMgYXR0cmlidXRlIHZhbHVlc1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IHBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSlcbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIHRoaXMuX2NsYXNzTmFtZSA9IHZhbHVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgIT09IG51bGw7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fCB0aGlzLnRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIF9kZXJpdmVOZXdDbGFzcyAobmV3VGFibGUsIHR5cGUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgdHlwZVxuICAgIH0pO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5leHBhbmQoYXR0cmlidXRlLCBkZWxpbWl0ZXIpKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRUcmFuc3Bvc2UoaW5kZXhlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlICgpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlblRyYW5zcG9zZSgpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAob3B0aW9ucyA9IHsgbGltaXQ6IEluZmluaXR5IH0pIHtcbiAgICBjb25zdCBlZGdlSWRzID0gb3B0aW9ucy5lZGdlSWRzIHx8IHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBvZiBPYmplY3Qua2V5cyhlZGdlSWRzKSkge1xuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5jbGFzc09iai5tb2RlbC5jbGFzc2VzW2VkZ2VJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NPYmouY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMudGFibGVJZHMgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgIGkrKztcbiAgICAgICAgaWYgKGkgPj0gb3B0aW9ucy5saW1pdCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlTmVpZ2hib3Job29kIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIHRoaXMuZWRnZXMob3B0aW9ucykpIHtcbiAgICAgIHlpZWxkICogZWRnZS5wYWlyd2lzZUVkZ2VzKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuaW1wb3J0IE5vZGVXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkcyA9IG9wdGlvbnMuZWRnZUNsYXNzSWRzIHx8IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IE5vZGVXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgLy8gQXJlIHdlIHRoZSBzb3VyY2Ugb3IgdGFyZ2V0IG9mIHRoZSBleGlzdGluZyBlZGdlIChpbnRlcm5hbGx5LCBpbiB0ZXJtc1xuICAgICAgLy8gb2Ygc291cmNlSWQgLyB0YXJnZXRJZCwgbm90IGVkZ2VDbGFzcy5kaXJlY3Rpb24pP1xuICAgICAgY29uc3QgaXNTb3VyY2UgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkO1xuXG4gICAgICAvLyBBcyB3ZSdyZSBjb252ZXJ0ZWQgdG8gYW4gZWRnZSwgb3VyIG5ldyByZXN1bHRpbmcgc291cmNlIEFORCB0YXJnZXRcbiAgICAgIC8vIHNob3VsZCBiZSB3aGF0ZXZlciBpcyBhdCB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcyAoaWYgYW55dGhpbmcpXG4gICAgICBpZiAoaXNTb3VyY2UpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgICAvLyBUT0RPOiBpbnN0ZWFkIG9mIGRlbGV0aW5nIHRoZSBleGlzdGluZyBlZGdlIGNsYXNzLCBzaG91bGQgd2UgbGVhdmUgaXRcbiAgICAgIC8vIGhhbmdpbmcgKyB1bmNvbm5lY3RlZD9cbiAgICAgIGVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIC8vIE9rYXksIHdlJ3ZlIGdvdCB0d28gZWRnZXMsIHNvIHRoaXMgaXMgYSBsaXR0bGUgbW9yZSBzdHJhaWdodGZvcndhcmRcbiAgICAgIGxldCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIGxldCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGRpcmVjdGlvbiwgaWYgdGhlcmUgaXMgb25lXG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLmRpcmVjdGVkICYmIHRhcmdldEVkZ2VDbGFzcy5kaXJlY3RlZCkge1xuICAgICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGhhcHBlbmVkIHRvIGdldCB0aGUgZWRnZXMgaW4gb3JkZXI7IHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBnb3QgdGhlIGVkZ2VzIGJhY2t3YXJkczsgc3dhcCB0aGVtIGFuZCBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICAgIHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBub3cgd2Uga25vdyBob3cgdG8gc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IHNvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICAvLyBJZiBub2RlIGNsYXNzZXMgZXhpc3Qgb24gdGhlIG90aGVyIGVuZCBvZiB0aG9zZSBlZGdlcywgYWRkIHRoaXMgY2xhc3NcbiAgICAgIC8vIHRvIHRoZWlyIGVkZ2VDbGFzc0lkc1xuICAgICAgaWYgKHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdKSB7XG4gICAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXSkge1xuICAgICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB9XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEZWxldGUgZWFjaCBvZiB0aGUgZWRnZSBjbGFzc2VzXG4gICAgICBzb3VyY2VFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgICB0YXJnZXRFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgfVxuICAgIHRoaXMuZGVsZXRlKCk7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzSWRzO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBhdHRyaWJ1dGUsIG90aGVyQXR0cmlidXRlIH0pIHtcbiAgICBsZXQgdGhpc0hhc2gsIG90aGVySGFzaCwgc291cmNlVGFibGVJZHMsIHRhcmdldFRhYmxlSWRzO1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXNIYXNoID0gdGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gWyB0aGlzSGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGlmIChvdGhlckF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGU7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZS5hZ2dyZWdhdGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbIG90aGVySGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIC8vIElmIHdlIGhhdmUgYSBzZWxmIGVkZ2UgY29ubmVjdGluZyB0aGUgc2FtZSBhdHRyaWJ1dGUsIHdlIGNhbiBqdXN0IHVzZVxuICAgIC8vIHRoZSBBZ2dyZWdhdGVkVGFibGUgYXMgdGhlIGVkZ2UgdGFibGU7IG90aGVyd2lzZSB3ZSBuZWVkIHRvIGNyZWF0ZSBhXG4gICAgLy8gQ29ubmVjdGVkVGFibGVcbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXMgPT09IG90aGVyTm9kZUNsYXNzICYmIGF0dHJpYnV0ZSA9PT0gb3RoZXJBdHRyaWJ1dGVcbiAgICAgID8gdGhpc0hhc2ggOiB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdFZGdlQ2xhc3M7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHN1cGVyLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICAgIHRoaXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBuZXdOb2RlQ2xhc3MsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgdGhpcy5jb25uZWN0ZWRDbGFzc2VzKCkpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgb3B0aW9ucy50YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHNcbiAgICAgIC5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkXS50YWJsZUlkO1xuICAgIG9wdGlvbnMudGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnRhcmdldFRhYmxlSWRzXG4gICAgICAuY29uY2F0KFsgdGFyZ2V0VGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogcGFpcndpc2VFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucykpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucykpIHtcbiAgICAgICAgeWllbGQgeyBzb3VyY2UsIGVkZ2U6IHRoaXMsIHRhcmdldCB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyBoeXBlcmVkZ2UgKG9wdGlvbnMpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBzb3VyY2VzOiBbXSxcbiAgICAgIHRhcmdldHM6IFtdLFxuICAgICAgZWRnZTogdGhpc1xuICAgIH07XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgcmVzdWx0LnB1c2goc291cmNlKTtcbiAgICB9XG4gICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgcmVzdWx0LnB1c2godGFyZ2V0KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBFZGdlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAvLyBzb3VyY2VUYWJsZUlkcyBhbmQgdGFyZ2V0VGFibGVJZHMgYXJlIGxpc3RzIG9mIGFueSBpbnRlcm1lZGlhdGUgdGFibGVzLFxuICAgIC8vIGJlZ2lubmluZyB3aXRoIHRoZSBlZGdlIHRhYmxlIChidXQgbm90IGluY2x1ZGluZyBpdCksIHRoYXQgbGVhZCB0byB0aGVcbiAgICAvLyBzb3VyY2UgLyB0YXJnZXQgbm9kZSB0YWJsZXMgKGJ1dCBub3QgaW5jbHVkaW5nKSB0aG9zZVxuXG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMuc291cmNlVGFibGVJZHMgfHwgW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgfHwgW107XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC5zb3VyY2VUYWJsZUlkcyA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldFRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEVkZ2VXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIF9zcGxpdFRhYmxlSWRMaXN0ICh0YWJsZUlkTGlzdCwgb3RoZXJDbGFzcykge1xuICAgIGxldCByZXN1bHQgPSB7XG4gICAgICBub2RlVGFibGVJZExpc3Q6IFtdLFxuICAgICAgZWRnZVRhYmxlSWQ6IG51bGwsXG4gICAgICBlZGdlVGFibGVJZExpc3Q6IFtdXG4gICAgfTtcbiAgICBpZiAodGFibGVJZExpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBXZWlyZCBjb3JuZXIgY2FzZSB3aGVyZSB3ZSdyZSB0cnlpbmcgdG8gY3JlYXRlIGFuIGVkZ2UgYmV0d2VlblxuICAgICAgLy8gYWRqYWNlbnQgb3IgaWRlbnRpY2FsIHRhYmxlcy4uLiBjcmVhdGUgYSBDb25uZWN0ZWRUYWJsZVxuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGhpcy50YWJsZS5jb25uZWN0KG90aGVyQ2xhc3MudGFibGUpLnRhYmxlSWQ7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgYSB0YWJsZSBpbiB0aGUgbWlkZGxlIGFzIHRoZSBuZXcgZWRnZSB0YWJsZTsgcHJpb3JpdGl6ZVxuICAgICAgLy8gU3RhdGljVGFibGUgYW5kIFN0YXRpY0RpY3RUYWJsZVxuICAgICAgbGV0IHN0YXRpY0V4aXN0cyA9IGZhbHNlO1xuICAgICAgbGV0IHRhYmxlRGlzdGFuY2VzID0gdGFibGVJZExpc3QubWFwKCh0YWJsZUlkLCBpbmRleCkgPT4ge1xuICAgICAgICBzdGF0aWNFeGlzdHMgPSBzdGF0aWNFeGlzdHMgfHwgdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgcmV0dXJuIHsgdGFibGVJZCwgaW5kZXgsIGRpc3Q6IE1hdGguYWJzKHRhYmxlSWRMaXN0IC8gMiAtIGluZGV4KSB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIHRhYmxlRGlzdGFuY2VzID0gdGFibGVEaXN0YW5jZXMuZmlsdGVyKCh7IHRhYmxlSWQgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHsgdGFibGVJZCwgaW5kZXggfSA9IHRhYmxlRGlzdGFuY2VzLnNvcnQoKGEsIGIpID0+IGEuZGlzdCAtIGIuZGlzdClbMF07XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0YWJsZUlkO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKDAsIGluZGV4KS5yZXZlcnNlKCk7XG4gICAgICByZXN1bHQubm9kZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoaW5kZXggKyAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy50YWJsZS5hZ2dyZWdhdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLmFnZ3JlZ2F0ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1RhcmdldENsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcblxuY29uc3QgREFUQUxJQl9GT1JNQVRTID0ge1xuICAnanNvbic6ICdqc29uJyxcbiAgJ2Nzdic6ICdjc3YnLFxuICAndHN2JzogJ3RzdicsXG4gICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICd0cmVlanNvbic6ICd0cmVlanNvbidcbn07XG5cbmNsYXNzIE5ldHdvcmtNb2RlbCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBvcmlncmFwaCxcbiAgICBtb2RlbElkLFxuICAgIG5hbWUgPSBtb2RlbElkLFxuICAgIGFubm90YXRpb25zID0ge30sXG4gICAgY2xhc3NlcyA9IHt9LFxuICAgIHRhYmxlcyA9IHt9XG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX29yaWdyYXBoID0gb3JpZ3JhcGg7XG4gICAgdGhpcy5tb2RlbElkID0gbW9kZWxJZDtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9ucztcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcbiAgICB0aGlzLnRhYmxlcyA9IHt9O1xuXG4gICAgdGhpcy5fbmV4dENsYXNzSWQgPSAxO1xuICAgIHRoaXMuX25leHRUYWJsZUlkID0gMTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhjbGFzc2VzKSkge1xuICAgICAgdGhpcy5jbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gdGhpcy5oeWRyYXRlKGNsYXNzT2JqLCBDTEFTU0VTKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICAgIHRoaXMudGFibGVzW3RhYmxlLnRhYmxlSWRdID0gdGhpcy5oeWRyYXRlKHRhYmxlLCBUQUJMRVMpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ3VwZGF0ZScsICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zYXZlVGltZW91dCk7XG4gICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vcmlncmFwaC5zYXZlKCk7XG4gICAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuICAgICAgfSwgMCk7XG4gICAgfSk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBjbGFzc2VzID0ge307XG4gICAgY29uc3QgdGFibGVzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0udHlwZSA9IGNsYXNzT2JqLnR5cGU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXSA9IHRhYmxlT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdLnR5cGUgPSB0YWJsZU9iai50eXBlO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWxJZDogdGhpcy5tb2RlbElkLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnMsXG4gICAgICBjbGFzc2VzOiB0aGlzLmNsYXNzZXMsXG4gICAgICB0YWJsZXM6IHRoaXMudGFibGVzXG4gICAgfTtcbiAgfVxuICBnZXQgdW5zYXZlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NhdmVUaW1lb3V0ICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgaHlkcmF0ZSAocmF3T2JqZWN0LCBUWVBFUykge1xuICAgIHJhd09iamVjdC5tb2RlbCA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBUWVBFU1tyYXdPYmplY3QudHlwZV0ocmF3T2JqZWN0KTtcbiAgfVxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIHdoaWxlICghb3B0aW9ucy50YWJsZUlkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSkpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7dGhpcy5fbmV4dFRhYmxlSWR9YDtcbiAgICAgIHRoaXMuX25leHRUYWJsZUlkICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVEFCTEVTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljVGFibGUgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5YCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uID0gJ3R4dCcsIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmIChEQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgZGF0YSA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZSh7IG5hbWUsIGRhdGEsIGF0dHJpYnV0ZXMgfSk7XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKCFlcnIuaW5Vc2UpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyBnZXRTYW1wbGVHcmFwaCAoe1xuICAgIHJvb3RDbGFzcyA9IG51bGwsXG4gICAgYnJhbmNoTGltaXQgPSBJbmZpbml0eSxcbiAgICBub2RlTGltaXQgPSBJbmZpbml0eSxcbiAgICBlZGdlTGltaXQgPSBJbmZpbml0eSxcbiAgICB0cmlwbGVMaW1pdCA9IEluZmluaXR5XG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IHNhbXBsZUdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW10sXG4gICAgICBlZGdlTG9va3VwOiB7fVxuICAgIH07XG5cbiAgICBsZXQgbnVtVHJpcGxlcyA9IDA7XG4gICAgbGV0IG51bUVkZ2VJbnN0YW5jZXMgPSAwO1xuICAgIGNvbnN0IGFkZE5vZGUgPSBub2RlID0+IHtcbiAgICAgIGlmICghc2FtcGxlR3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGgubm9kZXMucHVzaChub2RlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGggPD0gbm9kZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkRWRnZSA9IGVkZ2UgPT4ge1xuICAgICAgaWYgKCFzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgc2FtcGxlR3JhcGguZWRnZUxvb2t1cFtlZGdlLmluc3RhbmNlSWRdID0ge1xuICAgICAgICAgIGluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgIHBhaXJ3aXNlSW5zdGFuY2VzOiBbXVxuICAgICAgICB9O1xuICAgICAgICBudW1FZGdlSW5zdGFuY2VzKys7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVtRWRnZUluc3RhbmNlcyA8PSBlZGdlTGltaXQ7XG4gICAgfTtcbiAgICBjb25zdCBhZGRUcmlwbGUgPSAoc291cmNlLCBlZGdlLCB0YXJnZXQpID0+IHtcbiAgICAgIGlmIChhZGROb2RlKHNvdXJjZSkgJiYgYWRkTm9kZSh0YXJnZXQpICYmIGFkZEVkZ2UoZWRnZSkpIHtcbiAgICAgICAgc2FtcGxlR3JhcGguZWRnZUxvb2t1cFtlZGdlLmluc3RhbmNlSWRdLnBhaXJ3aXNlSW5zdGFuY2VzXG4gICAgICAgICAgLnB1c2goc2FtcGxlR3JhcGguZWRnZXMubGVuZ3RoKTtcbiAgICAgICAgc2FtcGxlR3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW3NvdXJjZS5pbnN0YW5jZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Lmluc3RhbmNlSWRdLFxuICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZVxuICAgICAgICB9KTtcbiAgICAgICAgbnVtVHJpcGxlcysrO1xuICAgICAgICByZXR1cm4gbnVtVHJpcGxlcyA8PSB0cmlwbGVMaW1pdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgbGV0IGNsYXNzTGlzdCA9IHJvb3RDbGFzcyA/IFtyb290Q2xhc3NdIDogT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpO1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgY2xhc3NMaXN0KSB7XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBpZiAoIWFkZE5vZGUobm9kZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IHNvdXJjZSwgZWRnZSwgdGFyZ2V0IH0gb2Ygbm9kZS5wYWlyd2lzZU5laWdoYm9yaG9vZCh7IGxpbWl0OiBicmFuY2hMaW1pdCB9KSkge1xuICAgICAgICAgICAgaWYgKCFhZGRUcmlwbGUoc291cmNlLCBlZGdlLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBpZiAoIWFkZEVkZ2UoZWRnZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IHNvdXJjZSwgdGFyZ2V0IH0gb2YgZWRnZS5wYWlyd2lzZUVkZ2VzKHsgbGltaXQ6IGJyYW5jaExpbWl0IH0pKSB7XG4gICAgICAgICAgICBpZiAoIWFkZFRyaXBsZShzb3VyY2UsIGVkZ2UsIHRhcmdldCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gIH1cbiAgZ2V0TmV0d29ya01vZGVsR3JhcGggKGluY2x1ZGVEdW1taWVzID0gZmFsc2UpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGxldCBncmFwaCA9IHtcbiAgICAgIGNsYXNzZXM6IFtdLFxuICAgICAgY2xhc3NMb29rdXA6IHt9LFxuICAgICAgY2xhc3NDb25uZWN0aW9uczogW11cbiAgICB9O1xuXG4gICAgY29uc3QgY2xhc3NMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIC8vIEFkZCBhbmQgaW5kZXggdGhlIGNsYXNzIGFzIGEgbm9kZVxuICAgICAgZ3JhcGguY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBncmFwaC5jbGFzc2VzLmxlbmd0aDtcbiAgICAgIGNvbnN0IGNsYXNzU3BlYyA9IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgY2xhc3NTcGVjLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKGNsYXNzU3BlYyk7XG5cbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgLy8gU3RvcmUgdGhlIGVkZ2UgY2xhc3Mgc28gd2UgY2FuIGNyZWF0ZSBjbGFzc0Nvbm5lY3Rpb25zIGxhdGVyXG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgJiYgaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgbm9kZVxuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtjbGFzc09iai5jbGFzc0lEfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBmYWxzZSxcbiAgICAgICAgICBsb2NhdGlvbjogJ25vZGUnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBleGlzdGluZyBjbGFzc0Nvbm5lY3Rpb25zXG4gICAgICBlZGdlQ2xhc3Nlcy5mb3JFYWNoKGVkZ2VDbGFzcyA9PiB7XG4gICAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAgIC8vIENvbm5lY3QgdGhlIHNvdXJjZSBub2RlIGNsYXNzIHRvIHRoZSBlZGdlIGNsYXNzXG4gICAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZH0+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZF0sXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZSdcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHNvdXJjZSBjbGFzc1xuICAgICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBpZDogYGR1bW15PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZScsXG4gICAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAgIC8vIENvbm5lY3QgdGhlIGVkZ2UgY2xhc3MgdG8gdGhlIHRhcmdldCBub2RlIGNsYXNzXG4gICAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+JHtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZH1gLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkXSxcbiAgICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCdcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHRhcmdldCBjbGFzc1xuICAgICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCcsXG4gICAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGggKCkge1xuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgdGFibGVzOiBbXSxcbiAgICAgIHRhYmxlTG9va3VwOiB7fSxcbiAgICAgIHRhYmxlTGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCB0YWJsZUxpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKTtcbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgY29uc3QgdGFibGVTcGVjID0gdGFibGUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZVNwZWMudHlwZSA9IHRhYmxlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGdyYXBoLnRhYmxlcy5sZW5ndGg7XG4gICAgICBncmFwaC50YWJsZXMucHVzaCh0YWJsZVNwZWMpO1xuICAgIH1cbiAgICAvLyBGaWxsIHRoZSBncmFwaCB3aXRoIGxpbmtzIGJhc2VkIG9uIHBhcmVudFRhYmxlcy4uLlxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICBncmFwaC50YWJsZUxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogZ3JhcGgudGFibGVMb29rdXBbcGFyZW50VGFibGUudGFibGVJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldEZ1bGxTY2hlbWFHcmFwaCAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24odGhpcy5nZXROZXR3b3JrTW9kZWxHcmFwaCgpLCB0aGlzLmdldFRhYmxlRGVwZW5kZW5jeUdyYXBoKCkpO1xuICB9XG4gIGNyZWF0ZVNjaGVtYU1vZGVsICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHRoaXMuZ2V0RnVsbFNjaGVtYUdyYXBoKCk7XG4gICAgY29uc3QgbmV3TW9kZWwgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVNb2RlbCh7IG5hbWU6IHRoaXMubmFtZSArICdfc2NoZW1hJyB9KTtcbiAgICBsZXQgY2xhc3NlcyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLmNsYXNzZXMsXG4gICAgICBuYW1lOiAnQ2xhc3NlcydcbiAgICB9KS5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgbGV0IGNsYXNzQ29ubmVjdGlvbnMgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLFxuICAgICAgbmFtZTogJ0NsYXNzIENvbm5lY3Rpb25zJ1xuICAgIH0pLmludGVycHJldEFzRWRnZXMoKTtcbiAgICBsZXQgdGFibGVzID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGgudGFibGVzLFxuICAgICAgbmFtZTogJ1RhYmxlcydcbiAgICB9KS5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgbGV0IHRhYmxlTGlua3MgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaC50YWJsZUxpbmtzLFxuICAgICAgbmFtZTogJ1RhYmxlIExpbmtzJ1xuICAgIH0pLmludGVycHJldEFzRWRnZXMoKTtcbiAgICBjbGFzc2VzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICBlZGdlQ2xhc3M6IGNsYXNzQ29ubmVjdGlvbnMsXG4gICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICBlZGdlQXR0cmlidXRlOiAnc291cmNlJ1xuICAgIH0pO1xuICAgIGNsYXNzZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogY2xhc3NDb25uZWN0aW9ucyxcbiAgICAgIHNpZGU6ICd0YXJnZXQnLFxuICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIGVkZ2VBdHRyaWJ1dGU6ICd0YXJnZXQnXG4gICAgfSk7XG4gICAgdGFibGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICBlZGdlQ2xhc3M6IHRhYmxlTGlua3MsXG4gICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICBlZGdlQXR0cmlidXRlOiAnc291cmNlJ1xuICAgIH0pO1xuICAgIHRhYmxlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgZWRnZUNsYXNzOiB0YWJsZUxpbmtzLFxuICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICBub2RlQXR0cmlidXRlOiBudWxsLFxuICAgICAgZWRnZUF0dHJpYnV0ZTogJ3RhcmdldCdcbiAgICB9KTtcbiAgICBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAndGFibGVJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogJ3RhYmxlSWQnXG4gICAgfSkuc2V0Q2xhc3NOYW1lKCdDb3JlIFRhYmxlcycpO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTmV0d29ya01vZGVsO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgTmV0d29ya01vZGVsIGZyb20gJy4vQ29tbW9uL05ldHdvcmtNb2RlbC5qcyc7XG5cbmxldCBORVhUX01PREVMX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgbW9kZWxzID0ge307XG4gICAgICBmb3IgKGNvbnN0IFttb2RlbElkLCBtb2RlbF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5tb2RlbHMpKSB7XG4gICAgICAgIG1vZGVsc1ttb2RlbElkXSA9IG1vZGVsLl90b1Jhd09iamVjdCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnb3JpZ3JhcGhfbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG4gICAgICB0aGlzLnRyaWdnZXIoJ3NhdmUnKTtcbiAgICB9XG4gIH1cbiAgY2xvc2VDdXJyZW50TW9kZWwgKCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGdldCBjdXJyZW50TW9kZWwgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1t0aGlzLl9jdXJyZW50TW9kZWxJZF0gfHwgdGhpcy5jcmVhdGVNb2RlbCgpO1xuICB9XG4gIHNldCBjdXJyZW50TW9kZWwgKG1vZGVsKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBtb2RlbC5tb2RlbElkO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5pbXBvcnQgRmlsZVJlYWRlciBmcm9tICdmaWxlcmVhZGVyJztcblxubGV0IG9yaWdyYXBoID0gbmV3IE9yaWdyYXBoKEZpbGVSZWFkZXIsIG51bGwpO1xub3JpZ3JhcGgudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBvcmlncmFwaDtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiX2V2ZW50SGFuZGxlcnMiLCJfc3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsIm9mZiIsImluZGV4Iiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5Iiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiT2JqZWN0IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJHZW5lcmljV3JhcHBlciIsIm9wdGlvbnMiLCJ0YWJsZSIsInVuZGVmaW5lZCIsIkVycm9yIiwiY2xhc3NPYmoiLCJyb3ciLCJjb25uZWN0ZWRJdGVtcyIsImNvbm5lY3RJdGVtIiwiaXRlbSIsInRhYmxlSWQiLCJkaXNjb25uZWN0IiwiaXRlbUxpc3QiLCJ2YWx1ZXMiLCJpbnN0YW5jZUlkIiwiY2xhc3NJZCIsImVxdWFscyIsIml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInRhYmxlSWRzIiwibGltaXQiLCJJbmZpbml0eSIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJtb2RlbCIsInRhYmxlcyIsImJ1aWxkQ2FjaGUiLCJfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwibGVuZ3RoIiwidGhpc1RhYmxlSWQiLCJyZW1haW5pbmdUYWJsZUlkcyIsInNsaWNlIiwiZXhlYyIsIm5hbWUiLCJUYWJsZSIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3N1cHByZXNzZWRBdHRyaWJ1dGVzIiwic3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJfc3VwcHJlc3NJbmRleCIsInN1cHByZXNzSW5kZXgiLCJfaW5kZXhGaWx0ZXIiLCJpbmRleEZpbHRlciIsIl9hdHRyaWJ1dGVGaWx0ZXJzIiwiYXR0cmlidXRlRmlsdGVycyIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwidXNlZEJ5Q2xhc3NlcyIsIl91c2VkQnlDbGFzc2VzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIml0ZXJhdGUiLCJyZXNldCIsIl9jYWNoZSIsIl9idWlsZENhY2hlIiwiX3BhcnRpYWxDYWNoZSIsIml0ZXJhdG9yIiwiX2l0ZXJhdGUiLCJjb21wbGV0ZWQiLCJuZXh0IiwiZG9uZSIsIl9maW5pc2hJdGVtIiwid3JhcHBlZEl0ZW0iLCJrZWVwIiwiX3dyYXAiLCJvdGhlckl0ZW0iLCJpdGVtc1RvQ29ubmVjdCIsImRlcml2ZWRUYWJsZSIsIl9jYWNoZVByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY291bnRSb3dzIiwia2V5cyIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJkZWxpbWl0ZXIiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNsb3NlZFRyYW5zcG9zZSIsImluZGV4ZXMiLCJvcGVuVHJhbnNwb3NlIiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0Iiwib3RoZXJUYWJsZSIsImNsYXNzZXMiLCJwYXJlbnRUYWJsZXMiLCJyZWR1Y2UiLCJhZ2ciLCJpblVzZSIsInNvbWUiLCJzb3VyY2VUYWJsZUlkcyIsInRhcmdldFRhYmxlSWRzIiwiZGVsZXRlIiwiZXJyIiwicGFyZW50VGFibGUiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJTdGF0aWNEaWN0VGFibGUiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBZ2dyZWdhdGVkVGFibGUiLCJfYXR0cmlidXRlIiwiX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsInJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsIl9kZWh5ZHJhdGVGdW5jdGlvbiIsImRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUiLCJfdXBkYXRlSXRlbSIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJuZXdXcmFwcGVkSXRlbSIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwicmVkdWNlZCIsIkV4cGFuZGVkVGFibGUiLCJzcGxpdCIsIkZhY2V0ZWRUYWJsZSIsIl92YWx1ZSIsIlRyYW5zcG9zZWRUYWJsZSIsIl9pbmRleCIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsImJhc2VQYXJlbnRUYWJsZSIsIm90aGVyUGFyZW50VGFibGVzIiwiR2VuZXJpY0NsYXNzIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb25zIiwic2V0Q2xhc3NOYW1lIiwiaGFzQ3VzdG9tTmFtZSIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJfZGVyaXZlTmV3Q2xhc3MiLCJOb2RlV3JhcHBlciIsImVkZ2VzIiwiZWRnZUlkcyIsImVkZ2VDbGFzc0lkcyIsImVkZ2VJZCIsImVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzSWQiLCJyZXZlcnNlIiwiY29uY2F0IiwicGFpcndpc2VOZWlnaGJvcmhvb2QiLCJlZGdlIiwicGFpcndpc2VFZGdlcyIsIk5vZGVDbGFzcyIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImlzU291cmNlIiwidGFyZ2V0Q2xhc3NJZCIsIm5vZGVDbGFzcyIsInRhYmxlSWRMaXN0IiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5ld05vZGVDbGFzcyIsImNvbm5lY3RlZENsYXNzZXMiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsImVkZ2VDbGFzc0lkIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VOb2RlcyIsInNvdXJjZVRhYmxlSWQiLCJ0YXJnZXROb2RlcyIsInRhcmdldFRhYmxlSWQiLCJzb3VyY2UiLCJ0YXJnZXQiLCJoeXBlcmVkZ2UiLCJzb3VyY2VzIiwidGFyZ2V0cyIsIkVkZ2VDbGFzcyIsIl9zcGxpdFRhYmxlSWRMaXN0Iiwib3RoZXJDbGFzcyIsIm5vZGVUYWJsZUlkTGlzdCIsImVkZ2VUYWJsZUlkIiwiZWRnZVRhYmxlSWRMaXN0Iiwic3RhdGljRXhpc3RzIiwidGFibGVEaXN0YW5jZXMiLCJzdGFydHNXaXRoIiwiZGlzdCIsIk1hdGgiLCJhYnMiLCJmaWx0ZXIiLCJzb3J0IiwiYSIsImIiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwic2lkZSIsImNvbm5lY3RTb3VyY2UiLCJjb25uZWN0VGFyZ2V0IiwidG9nZ2xlRGlyZWN0aW9uIiwic3dhcHBlZERpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsInVuc2hpZnQiLCJleGlzdGluZ1NvdXJjZUNsYXNzIiwiZXhpc3RpbmdUYXJnZXRDbGFzcyIsIkRBVEFMSUJfRk9STUFUUyIsIk5ldHdvcmtNb2RlbCIsIm9yaWdyYXBoIiwibW9kZWxJZCIsIl9vcmlncmFwaCIsIl9uZXh0Q2xhc3NJZCIsIl9uZXh0VGFibGVJZCIsImh5ZHJhdGUiLCJDTEFTU0VTIiwiVEFCTEVTIiwiX3NhdmVUaW1lb3V0Iiwic2F2ZSIsInVuc2F2ZWQiLCJyYXdPYmplY3QiLCJUWVBFUyIsInNlbGVjdG9yIiwiYWRkRmlsZUFzU3RhdGljVGFibGUiLCJmaWxlT2JqIiwiZW5jb2RpbmciLCJtaW1lIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJjb25zb2xlIiwid2FybiIsInRleHQiLCJyZWFkZXIiLCJGaWxlUmVhZGVyIiwib25sb2FkIiwicmVhZEFzVGV4dCIsImFkZFN0cmluZ0FzU3RhdGljVGFibGUiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNUYWJsZSIsIkFycmF5IiwiZGVsZXRlQWxsVW51c2VkVGFibGVzIiwiZ2V0U2FtcGxlR3JhcGgiLCJyb290Q2xhc3MiLCJicmFuY2hMaW1pdCIsIm5vZGVMaW1pdCIsImVkZ2VMaW1pdCIsInRyaXBsZUxpbWl0Iiwic2FtcGxlR3JhcGgiLCJub2RlcyIsIm5vZGVMb29rdXAiLCJlZGdlTG9va3VwIiwibnVtVHJpcGxlcyIsIm51bUVkZ2VJbnN0YW5jZXMiLCJhZGROb2RlIiwibm9kZSIsImFkZEVkZ2UiLCJpbnN0YW5jZSIsInBhaXJ3aXNlSW5zdGFuY2VzIiwiYWRkVHJpcGxlIiwiZWRnZUluc3RhbmNlIiwiY2xhc3NMaXN0IiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJpbmNsdWRlRHVtbWllcyIsImVkZ2VDbGFzc2VzIiwiZ3JhcGgiLCJjbGFzc0xvb2t1cCIsImNsYXNzQ29ubmVjdGlvbnMiLCJjbGFzc1NwZWMiLCJpZCIsImNsYXNzSUQiLCJsb2NhdGlvbiIsImR1bW15IiwiZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgiLCJ0YWJsZUxvb2t1cCIsInRhYmxlTGlua3MiLCJ0YWJsZUxpc3QiLCJ0YWJsZVNwZWMiLCJnZXRGdWxsU2NoZW1hR3JhcGgiLCJjcmVhdGVTY2hlbWFNb2RlbCIsIm5ld01vZGVsIiwiY3JlYXRlTW9kZWwiLCJORVhUX01PREVMX0lEIiwiT3JpZ3JhcGgiLCJsb2NhbFN0b3JhZ2UiLCJwbHVnaW5zIiwibW9kZWxzIiwiZXhpc3RpbmdNb2RlbHMiLCJnZXRJdGVtIiwiSlNPTiIsInBhcnNlIiwiX2N1cnJlbnRNb2RlbElkIiwicmVnaXN0ZXJQbHVnaW4iLCJwbHVnaW4iLCJzZXRJdGVtIiwic3RyaW5naWZ5IiwiY2xvc2VDdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWwiLCJkZWxldGVNb2RlbCIsImN1cnJlbnRNb2RlbElkIiwiZGVsZXRlQWxsTW9kZWxzIiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsY0FB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
