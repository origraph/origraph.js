'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var sha1 = _interopDefault(require('sha1'));
var FileReader = _interopDefault(require('filereader'));

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
      this.stickyTriggers[eventName] = this.stickyTriggers[eventName] || {
        argObj: {}
      };
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

class Table extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this._origraph = options.origraph;
    this.tableId = options.tableId;

    if (!this._origraph || !this.tableId) {
      throw new Error(`origraph and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};
    this._derivedTables = options.derivedTables || {};
    this._derivedAttributeFunctions = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions || {})) {
      this._derivedAttributeFunctions[attr] = this._origraph.hydrateFunction(stringifiedFunc);
    }

    this._suppressedAttributes = options.suppressedAttributes || {};
    this._suppressIndex = !!options.suppressIndex;
    this._indexSubFilter = options.indexSubFilter && this._origraph.hydrateFunction(options.indexSubFilter) || null;
    this._attributeSubFilters = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.attributeSubFilters || {})) {
      this._attributeSubFilters[attr] = this._origraph.hydrateFunction(stringifiedFunc);
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
      attributeSubFilters: {},
      indexSubFilter: this._indexSubFilter && this._origraph.dehydrateFunction(this._indexSubFilter) || null
    };

    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this._origraph.dehydrateFunction(func);
    }

    for (const [attr, func] of Object.entries(this._attributeSubFilters)) {
      result.attributeSubFilters[attr] = this._origraph.dehydrateFunction(func);
    }

    return result;
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

    if (this._indexSubFilter) {
      keep = this._indexSubFilter(wrappedItem.index);
    }

    for (const [attr, func] of Object.entries(this._attributeSubFilters)) {
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
    const wrappedItem = classObj ? classObj._wrap(options) : new this._origraph.WRAPPERS.GenericWrapper(options);

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

    if (this._indexSubFilter) {
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

    for (const attr in this._attributeSubFilters) {
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

  addSubFilter(attribute, func) {
    if (attribute === null) {
      this._indexSubFilter = func;
    } else {
      this._attributeSubFilters[attribute] = func;
    }

    this.reset();
  }

  _deriveTable(options) {
    const newTable = this._origraph.createTable(options);

    this._derivedTables[newTable.tableId] = true;

    this._origraph.saveTables();

    return newTable;
  }

  _getExistingTable(options) {
    // Check if the derived table has already been defined
    const existingTableId = this.derivedTables.find(tableObj => {
      return Object.entries(options).every(([optionName, optionValue]) => {
        if (optionName === 'type') {
          return tableObj.constructor.name === optionValue;
        } else {
          return tableObj['_' + optionName] === optionValue;
        }
      });
    });
    return existingTableId && this._origraph.tables[existingTableId] || null;
  }

  shortestPathToTable(otherTable) {
    // Dijkstra's algorithm...
    const visited = {};
    const distances = {};
    const prevTables = {};

    const visit = targetId => {
      const targetTable = this._origraph.tables[targetId]; // Only check the unvisited derived and parent tables

      const neighborList = Object.keys(targetTable._derivedTables).concat(targetTable.parentTables.map(parentTable => parentTable.tableId)).filter(tableId => !visited[tableId]); // Check and assign (or update) tentative distances to each neighbor

      for (const neighborId of neighborList) {
        if (distances[neighborId] === undefined) {
          distances[neighborId] = Infinity;
        }

        if (distances[targetId] + 1 < distances[neighborId]) {
          distances[neighborId] = distances[targetId] + 1;
          prevTables[neighborId] = targetId;
        }
      } // Okay, this table is officially visited; take it out of the running
      // for future visits / checks


      visited[targetId] = true;
      delete distances[targetId];
    }; // Start with this table


    prevTables[this.tableId] = null;
    distances[this.tableId] = 0;
    let toVisit = Object.keys(distances);

    while (toVisit.length > 0) {
      // Visit the next table that has the shortest distance
      toVisit.sort((a, b) => distances[a] - distances[b]);
      let nextId = toVisit.shift();

      if (nextId === otherTable.tableId) {
        // Found otherTable! Send back the chain of connected tables
        const chain = [];

        while (prevTables[nextId] !== null) {
          chain.unshift(this._origraph.tables[nextId]);
          nextId = prevTables[nextId];
        }

        return chain;
      } else {
        // Visit the table
        visit(nextId);
        toVisit = Object.keys(distances);
      }
    } // We didn't find it; there's no connection


    return null;
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
    const newTable = this._origraph.createTable({
      type: 'ConnectedTable'
    });

    this._derivedTables[newTable.tableId] = true;

    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this._origraph.saveTables();

    return newTable;
  }

  get classObj() {
    return Object.values(this._origraph.classes).find(classObj => {
      return classObj.table === this;
    });
  }

  get parentTables() {
    return Object.values(this._origraph.tables).reduce((agg, tableObj) => {
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }

      return agg;
    }, []);
  }

  get derivedTables() {
    return Object.keys(this._derivedTables).map(tableId => {
      return this._origraph.tables[tableId];
    });
  }

  get inUse() {
    if (Object.keys(this._derivedTables).length > 0) {
      return true;
    }

    return Object.values(this._origraph.classes).some(classObj => {
      return classObj.tableId === this.tableId || classObj.sourceTableIds.indexOf(this.tableId) !== -1 || classObj.targetTableIds.indexOf(this.tableId) !== -1;
    });
  }

  delete() {
    if (this.inUse) {
      throw new Error(`Can't delete in-use table ${this.tableId}`);
    }

    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTables[this.tableId];
    }

    delete this._origraph.tables[this.tableId];

    this._origraph.saveTables();
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
        throw new Error(`Parent table is requierd for table of type ${this.type}`);
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
      this._reduceAttributeFunctions[attr] = this._origraph.hydrateFunction(stringifiedFunc);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.reduceAttributeFunctions = {};

    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this._origraph._dehydrateFunction(func);
    }

    return obj;
  }

  get name() {
    return this.parentTable.name + '↦';
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

const DuplicatableAttributesMixin = function (superclass) {
  return class extends superclass {
    constructor(options) {
      super(options);
      this._instanceOfDuplicatableAttributesMixin = true;
      this._duplicatedAttributes = options.duplicatedAttributes || {};
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.duplicatedAttributes = this._duplicatedAttributes;
      return obj;
    }

    duplicateAttribute(parentId, attribute) {
      this._duplicatedAttributes[parentId] = this._duplicatedAttributes[parentId] || [];

      this._duplicatedAttributes[parentId].push(attribute);

      this.reset();
    }

    _duplicateAttributes(wrappedItem) {
      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const parentName = this._origraph.tables[parentId].name;
        wrappedItem.row[`${parentName}.${attr}`] = wrappedItem.connectedItems[parentId][0].row[attr];
      }
    }

    getAttributeDetails() {
      const allAttrs = super.getAttributeDetails();

      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const attrName = `${this._origraph.tables[parentId].name}.${attr}`;
        allAttrs[attrName] = allAttrs[attrName] || {
          name: attrName
        };
        allAttrs[attrName].copied = true;
      }

      return allAttrs;
    }

  };
};

Object.defineProperty(DuplicatableAttributesMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfDuplicatableAttributesMixin
});

class ExpandedTable extends DuplicatableAttributesMixin(SingleParentMixin(Table)) {
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

            _this._duplicateAttributes(newItem);

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

class ConnectedTable extends DuplicatableAttributesMixin(Table) {
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

        _this._duplicateAttributes(newItem);

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
    this._origraph = options.origraph;
    this.classId = options.classId;
    this.tableId = options.tableId;

    if (!this._origraph || !this.classId || !this.tableId) {
      throw new Error(`_origraph, classId, and tableId are required`);
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

    this._origraph.saveClasses();
  }

  get hasCustomName() {
    return this._className !== null;
  }

  get className() {
    return this._className || this.table.name;
  }

  getHashTable(attribute) {
    return attribute === null ? this.table : this.table.aggregate(attribute);
  }

  get table() {
    return this._origraph.tables[this.tableId];
  }

  _wrap(options) {
    options.classObj = this;
    return new this._origraph.WRAPPERS.GenericWrapper(options);
  }

  interpretAsNodes() {
    const options = this._toRawObject();

    options.type = 'NodeClass';
    this.table.reset();
    return this._origraph.newClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    this.table.reset();
    return this._origraph.newClass(options);
  }

  _deriveGenericClass(newTable) {
    return this._origraph.newClass({
      tableId: newTable.tableId,
      type: 'GenericClass'
    });
  }

  aggregate(attribute) {
    return this._deriveGenericClass(this.table.aggregate(attribute));
  }

  expand(attribute, delimiter) {
    return this._deriveGenericClass(this.table.expand(attribute, delimiter));
  }

  closedFacet(attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this._deriveGenericClass(newTable);
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
          yield _this._deriveGenericClass(newTable);
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
      return this._deriveGenericClass(newTable);
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
          yield _this2._deriveGenericClass(newTable);
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
    delete this._origraph.classes[this.classId];

    this._origraph.saveClasses();
  }

}

Object.defineProperty(GenericClass, 'type', {
  get() {
    return /(.*)Class/.exec(this.name)[1];
  }

});

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
    return new this._origraph.WRAPPERS.NodeWrapper(options);
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
      const edgeClass = this._origraph.classes[edgeClassIds[0]]; // Are we the source or target of the existing edge (internally, in terms
      // of sourceId / targetId, not edgeClass.direction)?

      const isSource = edgeClass.sourceClassId === this.classId; // As we're converted to an edge, our new resulting source AND target
      // should be whatever is at the other end of edgeClass (if anything)

      if (isSource) {
        options.sourceClassId = options.targetClassId = edgeClass.targetClassId;
      } else {
        options.sourceClassId = options.targetClassId = edgeClass.sourceClassId;
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
      let sourceEdgeClass = this._origraph.classes[edgeClassIds[0]];
      let targetEdgeClass = this._origraph.classes[edgeClassIds[1]]; // Figure out the direction, if there is one

      options.directed = false;

      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        if (sourceEdgeClass.targetClassId === this.classId && targetEdgeClass.sourceClassId === this.classId) {
          // We happened to get the edges in order; set directed to true
          options.directed = true;
        } else if (sourceEdgeClass.sourceClassId === this.classId && targetEdgeClass.targetClassId === this.classId) {
          // We got the edges backwards; swap them and set directed to true
          targetEdgeClass = this._origraph.classes[edgeClassIds[0]];
          sourceEdgeClass = this._origraph.classes[edgeClassIds[1]];
          options.directed = true;
        }
      } // Okay, now we know how to set source / target ids


      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId; // Concatenate the intermediate tableId lists, emanating out from the
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
    delete options.classId;
    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    this.table.reset();
    return this._origraph.newClass(options);
  }

  connectToNodeClass({
    otherNodeClass,
    attribute,
    otherAttribute
  }) {
    const thisHash = this.getHashTable(attribute);
    const otherHash = otherNodeClass.getHashTable(otherAttribute);
    const connectedTable = thisHash.connect([otherHash]);

    const newEdgeClass = this._origraph.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceTableIds: [thisHash.tableId],
      targetClassId: otherNodeClass.classId,
      targetTableIds: [otherHash.tableId]
    });

    this.edgeClassIds[newEdgeClass.classId] = true;
    otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;

    this._origraph.saveClasses();

    return newEdgeClass;
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    return edgeClass.connectToNodeClass(options);
  }

  disconnectAllEdges() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      const edgeClass = this._origraph.classes[edgeClassId];

      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSource();
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTarget();
      }
    }
  }

  delete() {
    this.disconnectAllEdges();
    super.delete();
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
    return new this._origraph.WRAPPERS.EdgeWrapper(options);
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
        staticExists = staticExists || this._origraph.tables[tableId].type.startsWith('Static');
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
          return this._origraph.tables[tableId].type.startsWith('Static');
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

    this.delete();
    temp.type = 'NodeClass';
    delete temp.classId;

    const newNodeClass = this._origraph.createClass(temp);

    if (temp.sourceClassId) {
      const sourceClass = this._origraph.classes[temp.sourceClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.sourceTableIds, sourceClass);

      const sourceEdgeClass = this._origraph.createClass({
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
      const targetClass = this._origraph.classes[temp.targetClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.targetTableIds, targetClass);

      const targetEdgeClass = this._origraph.createClass({
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

    this._origraph.saveClasses();

    return newNodeClass;
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass({
    nodeClass,
    side,
    nodeAttribute,
    edgeAttribute
  }) {
    if (side === 'source') {
      this.connectSource({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    } else if (side === 'target') {
      this.connectTarget({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    } else {
      throw new Error(`PoliticalOutsiderError: "${side}" is an invalid side`);
    }

    this._origraph.saveClasses();
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

    this._origraph.saveClasses();
  }

  connectSource({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null,
    skipSave = false
  } = {}) {
    if (this.sourceClassId) {
      this.disconnectSource({
        skipSave: true
      });
    }

    this.sourceClassId = nodeClass.classId;
    const sourceClass = this._origraph.classes[this.sourceClassId];
    sourceClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.getHashTable(nodeAttribute);
    this.sourceTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.sourceTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.sourceTableIds.push(nodeHash.tableId);
    }

    if (!skipSave) {
      this._origraph.saveClasses();
    }
  }

  connectTarget({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null,
    skipSave = false
  } = {}) {
    if (this.targetClassId) {
      this.disconnectTarget({
        skipSave: true
      });
    }

    this.targetClassId = nodeClass.classId;
    const targetClass = this._origraph.classes[this.targetClassId];
    targetClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.getHashTable(nodeAttribute);
    this.targetTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.targetTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.targetTableIds.push(nodeHash.tableId);
    }

    if (!skipSave) {
      this._origraph.saveClasses();
    }
  }

  disconnectSource({
    skipSave = false
  } = {}) {
    const existingSourceClass = this._origraph.classes[this.sourceClassId];

    if (existingSourceClass) {
      delete existingSourceClass.edgeClassIds[this.classId];
    }

    this.sourceTableIds = [];
    this.sourceClassId = null;

    if (!skipSave) {
      this._origraph.saveClasses();
    }
  }

  disconnectTarget({
    skipSave = false
  } = {}) {
    const existingTargetClass = this._origraph.classes[this.targetClassId];

    if (existingTargetClass) {
      delete existingTargetClass.edgeClassIds[this.classId];
    }

    this.targetTableIds = [];
    this.targetClassId = null;

    if (!skipSave) {
      this._origraph.saveClasses();
    }
  }

  delete() {
    this.disconnectSource({
      skipSave: true
    });
    this.disconnectTarget({
      skipSave: true
    });
    super.delete();
  }

}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
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

  iterateAcrossConnections({
    tableIds,
    limit = Infinity
  }) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // First make sure that all the table caches have been fully built and
      // connected
      yield _awaitAsyncGenerator(Promise.all(tableIds.map(tableId => {
        return _this.classObj._origraph.tables[tableId].buildCache();
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
        const edgeClass = _this.classObj._origraph.classes[edgeId];

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

      const sourceTableId = _this.classObj._origraph.classes[_this.classObj.sourceClassId].tableId;
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

      const targetTableId = _this2.classObj._origraph.classes[_this2.classObj.targetClassId].tableId;
      options.tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);
      yield* _asyncGeneratorDelegate(_asyncIterator(_this2.iterateAcrossConnections(options)), _awaitAsyncGenerator);
    })();
  }

}



var WRAPPERS = /*#__PURE__*/Object.freeze({
  GenericWrapper: GenericWrapper,
  NodeWrapper: NodeWrapper,
  EdgeWrapper: EdgeWrapper
});

class InMemoryIndex {
  constructor({
    entries = {},
    complete = false
  } = {}) {
    this.entries = entries;
    this.complete = complete;
  }

  async toRawObject() {
    return this.entries;
  }

  iterEntries() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (const [hash, valueList] of Object.entries(_this.entries)) {
        yield {
          hash,
          valueList
        };
      }
    })();
  }

  iterHashes() {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      for (const hash of Object.keys(_this2.entries)) {
        yield hash;
      }
    })();
  }

  iterValueLists() {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      for (const valueList of Object.values(_this3.entries)) {
        yield valueList;
      }
    })();
  }

  async getValueList(hash) {
    return this.entries[hash] || [];
  }

  async addValue(hash, value) {
    // TODO: add some kind of warning if this is getting big?
    this.entries[hash] = await this.getValueList(hash);

    if (this.entries[hash].indexOf(value) === -1) {
      this.entries[hash].push(value);
    }
  }

}



var INDEXES = /*#__PURE__*/Object.freeze({
  InMemoryIndex: InMemoryIndex
});

let NEXT_CLASS_ID = 1;
let NEXT_TABLE_ID = 1;

class Origraph extends TriggerableMixin(class {}) {
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set origraph.debug to true to debug streams

    this.plugins = {}; // extensions that we want datalib to handle

    this.DATALIB_FORMATS = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv',
      'topojson': 'topojson',
      'treejson': 'treejson'
    }; // Access to core classes via the main library helps avoid circular imports

    this.TABLES = TABLES;
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;
    this.INDEXES = INDEXES; // Default named functions

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
        yield {
          left: thisWrappedItem.rawItem,
          right: otherWrappedItem.rawItem
        };
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    }; // Object containing each of our data sources

    this.tables = this.hydrate('origraph_tables', this.TABLES);
    NEXT_TABLE_ID = Object.keys(this.tables).reduce((highestNum, tableId) => {
      return Math.max(highestNum, parseInt(tableId.match(/table(\d*)/)[1]));
    }, 0) + 1; // Object containing our class specifications

    this.classes = this.hydrate('origraph_classes', this.CLASSES);
    NEXT_CLASS_ID = Object.keys(this.classes).reduce((highestNum, classId) => {
      return Math.max(highestNum, parseInt(classId.match(/class(\d*)/)[1]));
    }, 0) + 1;
  }

  saveTables() {
    this.dehydrate('origraph_tables', this.tables);
    this.trigger('tableUpdate');
  }

  saveClasses() {
    this.dehydrate('origraph_classes', this.classes);
    this.trigger('classUpdate');
  }

  hydrate(storageKey, TYPES) {
    let container = this.localStorage && this.localStorage.getItem(storageKey);
    container = container ? JSON.parse(container) : {};

    for (const [key, value] of Object.entries(container)) {
      const type = value.type;
      delete value.type;
      value.origraph = this;
      container[key] = new TYPES[type](value);
    }

    return container;
  }

  dehydrate(storageKey, container) {
    if (this.localStorage) {
      const result = {};

      for (const [key, value] of Object.entries(container)) {
        result[key] = value._toRawObject();
        result[key].type = value.constructor.name;
      }

      this.localStorage.setItem(storageKey, JSON.stringify(result));
    }
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

  createTable(options) {
    if (!options.tableId) {
      options.tableId = `table${NEXT_TABLE_ID}`;
      NEXT_TABLE_ID += 1;
    }

    const Type = this.TABLES[options.type];
    delete options.type;
    options.origraph = this;
    this.tables[options.tableId] = new Type(options);
    return this.tables[options.tableId];
  }

  createClass(options = {
    selector: `empty`
  }) {
    if (!options.classId) {
      options.classId = `class${NEXT_CLASS_ID}`;
      NEXT_CLASS_ID += 1;
    }

    const Type = this.CLASSES[options.type];
    delete options.type;
    options.origraph = this;
    this.classes[options.classId] = new Type(options);
    return this.classes[options.classId];
  }

  newTable(options) {
    const newTableObj = this.createTable(options);
    this.saveTables();
    return newTableObj;
  }

  newClass(options) {
    const newClassObj = this.createClass(options);
    this.saveClasses();
    return newClassObj;
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
        throw new Error(`${fileMB}MB file is too large to load statically; try addDynamicTable() instead.`);
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

    if (this.DATALIB_FORMATS[extension]) {
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
    let newTable = this.newTable(options);
    return this.newClass({
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
        } catch (err) {}
      }
    }
  }

  deleteAllClasses() {
    for (const classObj of Object.values(this.classes)) {
      classObj.delete();
    }
  }

  getClassData() {
    const results = {};

    for (const classObj of Object.values(this.classes)) {
      results[classObj.classId] = classObj.currentData;
    }
  }

  registerPlugin(name, plugin) {
    this.plugins[name] = plugin;
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
	"@babel/core": "^7.1.2",
	"@babel/plugin-proposal-async-generator-functions": "^7.1.0",
	"@babel/preset-env": "^7.1.0",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.6.0",
	coveralls: "^3.0.2",
	jest: "^23.6.0",
	rollup: "^0.66.6",
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
	"mime-types": "^2.1.20",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguY2pzLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL09yaWdyYXBoLmpzIiwiLi4vc3JjL21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAoIXRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKSAhPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudE5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fb3JpZ3JhcGggPSBvcHRpb25zLm9yaWdyYXBoO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMuX29yaWdyYXBoIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgb3JpZ3JhcGggYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcyA9IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9vcmlncmFwaC5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhTdWJGaWx0ZXIgPSAob3B0aW9ucy5pbmRleFN1YkZpbHRlciAmJiB0aGlzLl9vcmlncmFwaC5oeWRyYXRlRnVuY3Rpb24ob3B0aW9ucy5pbmRleFN1YkZpbHRlcikpIHx8IG51bGw7XG4gICAgdGhpcy5fYXR0cmlidXRlU3ViRmlsdGVycyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5hdHRyaWJ1dGVTdWJGaWx0ZXJzIHx8IHt9KSkge1xuICAgICAgdGhpcy5fYXR0cmlidXRlU3ViRmlsdGVyc1thdHRyXSA9IHRoaXMuX29yaWdyYXBoLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuX2F0dHJpYnV0ZXMsXG4gICAgICBkZXJpdmVkVGFibGVzOiB0aGlzLl9kZXJpdmVkVGFibGVzLFxuICAgICAgdXNlZEJ5Q2xhc3NlczogdGhpcy5fdXNlZEJ5Q2xhc3NlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZVN1YkZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhTdWJGaWx0ZXI6ICh0aGlzLl9pbmRleFN1YkZpbHRlciAmJiB0aGlzLl9vcmlncmFwaC5kZWh5ZHJhdGVGdW5jdGlvbih0aGlzLl9pbmRleFN1YkZpbHRlcikpIHx8IG51bGxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX29yaWdyYXBoLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSkge1xuICAgICAgcmVzdWx0LmF0dHJpYnV0ZVN1YkZpbHRlcnNbYXR0cl0gPSB0aGlzLl9vcmlncmFwaC5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIEdlbmVyaWMgY2FjaGluZyBzdHVmZjsgdGhpcyBpc24ndCBqdXN0IGZvciBwZXJmb3JtYW5jZS4gQ29ubmVjdGVkVGFibGUnc1xuICAgIC8vIGFsZ29yaXRobSByZXF1aXJlcyB0aGF0IGl0cyBwYXJlbnQgdGFibGVzIGhhdmUgcHJlLWJ1aWx0IGluZGV4ZXMgKHdlXG4gICAgLy8gdGVjaG5pY2FsbHkgY291bGQgaW1wbGVtZW50IGl0IGRpZmZlcmVudGx5LCBidXQgaXQgd291bGQgYmUgZXhwZW5zaXZlLFxuICAgIC8vIHJlcXVpcmVzIHRyaWNreSBsb2dpYywgYW5kIHdlJ3JlIGFscmVhZHkgYnVpbGRpbmcgaW5kZXhlcyBmb3Igc29tZSB0YWJsZXNcbiAgICAvLyBsaWtlIEFnZ3JlZ2F0ZWRUYWJsZSBhbnl3YXkpXG4gICAgaWYgKG9wdGlvbnMucmVzZXQpIHtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgICAgeWllbGQgKiBPYmplY3QudmFsdWVzKHRoaXMuX2NhY2hlKS5zbGljZSgwLCBsaW1pdCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgeWllbGQgKiBhd2FpdCB0aGlzLl9idWlsZENhY2hlKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQgPT09IHVuZGVmaW5lZCA/IEluZmluaXR5IDogb3B0aW9ucy5saW1pdDtcbiAgICBkZWxldGUgb3B0aW9ucy5saW1pdDtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUob3B0aW9ucyk7XG4gICAgbGV0IGNvbXBsZXRlZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIGl0ZXJhdGlvbiB3YXMgY2FuY2VsbGVkOyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICBjb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSk7XG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt0ZW1wLnZhbHVlLmluZGV4XSA9IHRlbXAudmFsdWU7XG4gICAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjb21wbGV0ZWQpIHtcbiAgICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgZGVsZXRlIHdyYXBwZWRJdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgbGV0IGtlZXAgPSB0cnVlO1xuICAgIGlmICh0aGlzLl9pbmRleFN1YkZpbHRlcikge1xuICAgICAga2VlcCA9IHRoaXMuX2luZGV4U3ViRmlsdGVyKHdyYXBwZWRJdGVtLmluZGV4KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlU3ViRmlsdGVycykpIHtcbiAgICAgIGtlZXAgPSBrZWVwICYmIGZ1bmMod3JhcHBlZEl0ZW0ucm93W2F0dHJdKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgdGhpcy5fb3JpZ3JhcGguV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX2NhY2hlUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fY2FjaGVQcm9taXNlID0gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRlbXAgb2YgdGhpcy5fYnVpbGRDYWNoZSgpKSB7fSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIH1cbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhhd2FpdCB0aGlzLmJ1aWxkQ2FjaGUoKSkubGVuZ3RoO1xuICB9XG4gIGdldEluZGV4RGV0YWlscyAoKSB7XG4gICAgY29uc3QgZGV0YWlscyA9IHsgbmFtZTogbnVsbCB9O1xuICAgIGlmICh0aGlzLl9zdXBwcmVzc0luZGV4KSB7XG4gICAgICBkZXRhaWxzLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW5kZXhTdWJGaWx0ZXIpIHtcbiAgICAgIGRldGFpbHMuZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZGV0YWlscztcbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHt9O1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5leHBlY3RlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5vYnNlcnZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZGVyaXZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fYXR0cmlidXRlU3ViRmlsdGVycykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5nZXRBdHRyaWJ1dGVEZXRhaWxzKCkpO1xuICB9XG4gIGdldCBjdXJyZW50RGF0YSAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6IHRoaXMuX2NhY2hlIHx8IHRoaXMuX3BhcnRpYWxDYWNoZSB8fCB7fSxcbiAgICAgIGNvbXBsZXRlOiAhIXRoaXMuX2NhY2hlXG4gICAgfTtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIHN1cHByZXNzQXR0cmlidXRlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBhZGRTdWJGaWx0ZXIgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2luZGV4U3ViRmlsdGVyID0gZnVuYztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYXR0cmlidXRlU3ViRmlsdGVyc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIF9kZXJpdmVUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGVJZCA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZUlkICYmIHRoaXMuX29yaWdyYXBoLnRhYmxlc1tleGlzdGluZ1RhYmxlSWRdKSB8fCBudWxsO1xuICB9XG4gIHNob3J0ZXN0UGF0aFRvVGFibGUgKG90aGVyVGFibGUpIHtcbiAgICAvLyBEaWprc3RyYSdzIGFsZ29yaXRobS4uLlxuICAgIGNvbnN0IHZpc2l0ZWQgPSB7fTtcbiAgICBjb25zdCBkaXN0YW5jZXMgPSB7fTtcbiAgICBjb25zdCBwcmV2VGFibGVzID0ge307XG4gICAgY29uc3QgdmlzaXQgPSB0YXJnZXRJZCA9PiB7XG4gICAgICBjb25zdCB0YXJnZXRUYWJsZSA9IHRoaXMuX29yaWdyYXBoLnRhYmxlc1t0YXJnZXRJZF07XG4gICAgICAvLyBPbmx5IGNoZWNrIHRoZSB1bnZpc2l0ZWQgZGVyaXZlZCBhbmQgcGFyZW50IHRhYmxlc1xuICAgICAgY29uc3QgbmVpZ2hib3JMaXN0ID0gT2JqZWN0LmtleXModGFyZ2V0VGFibGUuX2Rlcml2ZWRUYWJsZXMpXG4gICAgICAgIC5jb25jYXQodGFyZ2V0VGFibGUucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS50YWJsZUlkKSlcbiAgICAgICAgLmZpbHRlcih0YWJsZUlkID0+ICF2aXNpdGVkW3RhYmxlSWRdKTtcbiAgICAgIC8vIENoZWNrIGFuZCBhc3NpZ24gKG9yIHVwZGF0ZSkgdGVudGF0aXZlIGRpc3RhbmNlcyB0byBlYWNoIG5laWdoYm9yXG4gICAgICBmb3IgKGNvbnN0IG5laWdoYm9ySWQgb2YgbmVpZ2hib3JMaXN0KSB7XG4gICAgICAgIGlmIChkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIGlmIChkaXN0YW5jZXNbdGFyZ2V0SWRdICsgMSA8IGRpc3RhbmNlc1tuZWlnaGJvcklkXSkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IGRpc3RhbmNlc1t0YXJnZXRJZF0gKyAxO1xuICAgICAgICAgIHByZXZUYWJsZXNbbmVpZ2hib3JJZF0gPSB0YXJnZXRJZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgdGhpcyB0YWJsZSBpcyBvZmZpY2lhbGx5IHZpc2l0ZWQ7IHRha2UgaXQgb3V0IG9mIHRoZSBydW5uaW5nXG4gICAgICAvLyBmb3IgZnV0dXJlIHZpc2l0cyAvIGNoZWNrc1xuICAgICAgdmlzaXRlZFt0YXJnZXRJZF0gPSB0cnVlO1xuICAgICAgZGVsZXRlIGRpc3RhbmNlc1t0YXJnZXRJZF07XG4gICAgfTtcblxuICAgIC8vIFN0YXJ0IHdpdGggdGhpcyB0YWJsZVxuICAgIHByZXZUYWJsZXNbdGhpcy50YWJsZUlkXSA9IG51bGw7XG4gICAgZGlzdGFuY2VzW3RoaXMudGFibGVJZF0gPSAwO1xuICAgIGxldCB0b1Zpc2l0ID0gT2JqZWN0LmtleXMoZGlzdGFuY2VzKTtcbiAgICB3aGlsZSAodG9WaXNpdC5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBWaXNpdCB0aGUgbmV4dCB0YWJsZSB0aGF0IGhhcyB0aGUgc2hvcnRlc3QgZGlzdGFuY2VcbiAgICAgIHRvVmlzaXQuc29ydCgoYSwgYikgPT4gZGlzdGFuY2VzW2FdIC0gZGlzdGFuY2VzW2JdKTtcbiAgICAgIGxldCBuZXh0SWQgPSB0b1Zpc2l0LnNoaWZ0KCk7XG4gICAgICBpZiAobmV4dElkID09PSBvdGhlclRhYmxlLnRhYmxlSWQpIHtcbiAgICAgICAgLy8gRm91bmQgb3RoZXJUYWJsZSEgU2VuZCBiYWNrIHRoZSBjaGFpbiBvZiBjb25uZWN0ZWQgdGFibGVzXG4gICAgICAgIGNvbnN0IGNoYWluID0gW107XG4gICAgICAgIHdoaWxlIChwcmV2VGFibGVzW25leHRJZF0gIT09IG51bGwpIHtcbiAgICAgICAgICBjaGFpbi51bnNoaWZ0KHRoaXMuX29yaWdyYXBoLnRhYmxlc1tuZXh0SWRdKTtcbiAgICAgICAgICBuZXh0SWQgPSBwcmV2VGFibGVzW25leHRJZF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoYWluO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVmlzaXQgdGhlIHRhYmxlXG4gICAgICAgIHZpc2l0KG5leHRJZCk7XG4gICAgICAgIHRvVmlzaXQgPSBPYmplY3Qua2V5cyhkaXN0YW5jZXMpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBXZSBkaWRuJ3QgZmluZCBpdDsgdGhlcmUncyBubyBjb25uZWN0aW9uXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9O1xuICAgICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gaW5kZXhlcy5tYXAoaW5kZXggPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdCB9KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVUYWJsZSh7IHR5cGU6ICdDb25uZWN0ZWRUYWJsZScgfSk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgZm9yIChjb25zdCBvdGhlclRhYmxlIG9mIG90aGVyVGFibGVMaXN0KSB7XG4gICAgICBvdGhlclRhYmxlLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX29yaWdyYXBoLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX29yaWdyYXBoLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKTtcbiAgfVxuICBnZXQgZGVyaXZlZFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX29yaWdyYXBoLmNsYXNzZXMpLnNvbWUoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlSWQgPT09IHRoaXMudGFibGVJZCB8fFxuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xIHx8XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTE7XG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBpZiAodGhpcy5pblVzZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fb3JpZ3JhcGgudGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZVRhYmxlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpZXJkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEFnZ3JlZ2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX29yaWdyYXBoLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9vcmlncmFwaC5fZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAn4oamJztcbiAgfVxuICBkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIChhdHRyLCBmdW5jKSB7XG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX3VwZGF0ZUl0ZW0gKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zKSB7XG4gICAgLy8gV2Ugb3ZlcnJpZGUgX2J1aWxkQ2FjaGUgYmVjYXVzZSBzbyB0aGF0IEFnZ3JlZ2F0ZWRUYWJsZSBjYW4gdGFrZSBhZHZhbnRhZ2VcbiAgICAvLyBvZiB0aGUgcGFydGlhbGx5LWJ1aWx0IGNhY2hlIGFzIGl0IGdvZXMsIGFuZCBwb3N0cG9uZSBmaW5pc2hpbmcgaXRlbXNcbiAgICAvLyB1bnRpbCBhZnRlciB0aGUgcGFyZW50IHRhYmxlIGhhcyBiZWVuIGZ1bGx5IGl0ZXJhdGVkXG5cbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbd3JhcHBlZEl0ZW0uaW5kZXhdID0gd3JhcHBlZEl0ZW07XG4gICAgICAvLyBHbyBhaGVhZCBhbmQgeWllbGQgdGhlIHVuZmluaXNoZWQgaXRlbTsgdGhpcyBtYWtlcyBpdCBwb3NzaWJsZSBmb3JcbiAgICAgIC8vIGNsaWVudCBhcHBzIHRvIGJlIG1vcmUgcmVzcG9uc2l2ZSBhbmQgcmVuZGVyIHBhcnRpYWwgcmVzdWx0cywgYnV0IGFsc29cbiAgICAgIC8vIG1lYW5zIHRoYXQgdGhleSBuZWVkIHRvIHdhdGNoIGZvciB3cmFwcGVkSXRlbS5vbigndXBkYXRlJykgZXZlbnRzXG4gICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICB9XG5cbiAgICAvLyBTZWNvbmQgcGFzczogbm93IHRoYXQgd2UndmUgY29tcGxldGVkIHRoZSBmdWxsIGl0ZXJhdGlvbiBvZiB0aGUgcGFyZW50XG4gICAgLy8gdGFibGUsIHdlIGNhbiBmaW5pc2ggZWFjaCBpdGVtXG4gICAgZm9yIChjb25zdCBpbmRleCBpbiB0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIGlmICghdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSkpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgaW5kZXggPSBTdHJpbmcod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKGV4aXN0aW5nSXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKG5ld0l0ZW0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ucmVkdWNlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQWdncmVnYXRlZFRhYmxlO1xuIiwiY29uc3QgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuZHVwbGljYXRlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5kdXBsaWNhdGVkQXR0cmlidXRlcyA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgZHVwbGljYXRlQXR0cmlidXRlIChwYXJlbnRJZCwgYXR0cmlidXRlKSB7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gfHwgW107XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0ucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBfZHVwbGljYXRlQXR0cmlidXRlcyAod3JhcHBlZEl0ZW0pIHtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgcGFyZW50TmFtZSA9IHRoaXMuX29yaWdyYXBoLnRhYmxlc1twYXJlbnRJZF0ubmFtZTtcbiAgICAgICAgd3JhcHBlZEl0ZW0ucm93W2Ake3BhcmVudE5hbWV9LiR7YXR0cn1gXSA9IHdyYXBwZWRJdGVtLmNvbm5lY3RlZEl0ZW1zW3BhcmVudElkXVswXS5yb3dbYXR0cl07XG4gICAgICB9XG4gICAgfVxuICAgIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgICAgY29uc3QgYWxsQXR0cnMgPSBzdXBlci5nZXRBdHRyaWJ1dGVEZXRhaWxzKCk7XG4gICAgICBmb3IgKGNvbnN0IFtwYXJlbnRJZCwgYXR0cl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXMpKSB7XG4gICAgICAgIGNvbnN0IGF0dHJOYW1lID0gYCR7dGhpcy5fb3JpZ3JhcGgudGFibGVzW3BhcmVudElkXS5uYW1lfS4ke2F0dHJ9YDtcbiAgICAgICAgYWxsQXR0cnNbYXR0ck5hbWVdID0gYWxsQXR0cnNbYXR0ck5hbWVdIHx8IHsgbmFtZTogYXR0ck5hbWUgfTtcbiAgICAgICAgYWxsQXR0cnNbYXR0ck5hbWVdLmNvcGllZCA9IHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWxsQXR0cnM7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuaW1wb3J0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiBmcm9tICcuL0R1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5kZWxpbWl0ZXIgPSBvcHRpb25zLmRlbGltaXRlciB8fCAnLCc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAn4oakJztcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IHZhbHVlcyA9ICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdIHx8ICcnKS5zcGxpdCh0aGlzLmRlbGltaXRlcik7XG4gICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuICAgICAgICBjb25zdCByb3cgPSB7fTtcbiAgICAgICAgcm93W3RoaXMuX2F0dHJpYnV0ZV0gPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdyxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2R1cGxpY2F0ZUF0dHJpYnV0ZXMobmV3SXRlbSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmFjZXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICB0aGlzLl92YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgWyR7dGhpcy5fdmFsdWV9XWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBpZiAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gTm9ybWFsIGZhY2V0aW5nIGp1c3QgZ2l2ZXMgYSBzdWJzZXQgb2YgdGhlIG9yaWdpbmFsIHRhYmxlXG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IE9iamVjdC5hc3NpZ24oe30sIHdyYXBwZWRQYXJlbnQucm93KSxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmFjZXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBUcmFuc3Bvc2VkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2luZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5faW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5pbmRleCA9IHRoaXMuX2luZGV4O1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBg4bWAJHt0aGlzLl9pbmRleH1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcblxuICAgIC8vIEl0ZXJhdGUgdGhlIHJvdydzIGF0dHJpYnV0ZXMgYXMgaW5kZXhlc1xuICAgIGNvbnN0IHdyYXBwZWRQYXJlbnQgPSBwYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5faW5kZXhdIHx8IHsgcm93OiB7fSB9O1xuICAgIGZvciAoY29uc3QgWyBpbmRleCwgdmFsdWUgXSBvZiBPYmplY3QuZW50cmllcyh3cmFwcGVkUGFyZW50LnJvdykpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gZnJvbSAnLi9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbihUYWJsZSkge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCfiqK8nKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgLy8gU3BpbiB0aHJvdWdoIGFsbCBvZiB0aGUgcGFyZW50VGFibGVzIHNvIHRoYXQgdGhlaXIgX2NhY2hlIGlzIHByZS1idWlsdFxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG4gICAgfVxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGUpKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pKSB7XG4gICAgICAgIC8vIE5vIG1hdGNoIGluIG9uZSBvZiB0aGUgb3RoZXIgdGFibGVzOyBvbWl0IHRoaXMgaXRlbVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IGFkZCBlYWNoIHBhcmVudCB0YWJsZXMnIGtleXMgYXMgYXR0cmlidXRlIHZhbHVlc1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IHBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSlcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlcyhuZXdJdGVtKTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9wdGlvbnMub3JpZ3JhcGg7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMuX29yaWdyYXBoIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBfb3JpZ3JhcGgsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIHRoaXMuX2NsYXNzTmFtZSA9IHZhbHVlO1xuICAgIHRoaXMuX29yaWdyYXBoLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgIT09IG51bGw7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fCB0aGlzLnRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0SGFzaFRhYmxlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5fb3JpZ3JhcGgudGFibGVzW3RoaXMudGFibGVJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IHRoaXMuX29yaWdyYXBoLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5fb3JpZ3JhcGgubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlR2VuZXJpY0NsYXNzIChuZXdUYWJsZSkge1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5uZXdDbGFzcyh7XG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcydcbiAgICB9KTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3ModGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKSk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3ModGhpcy50YWJsZS5leHBhbmQoYXR0cmlidXRlLCBkZWxpbWl0ZXIpKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlICgpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlblRyYW5zcG9zZSgpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkcyA9IG9wdGlvbnMuZWRnZUNsYXNzSWRzIHx8IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IHRoaXMuX29yaWdyYXBoLldSQVBQRVJTLk5vZGVXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIC8vIEFyZSB3ZSB0aGUgc291cmNlIG9yIHRhcmdldCBvZiB0aGUgZXhpc3RpbmcgZWRnZSAoaW50ZXJuYWxseSwgaW4gdGVybXNcbiAgICAgIC8vIG9mIHNvdXJjZUlkIC8gdGFyZ2V0SWQsIG5vdCBlZGdlQ2xhc3MuZGlyZWN0aW9uKT9cbiAgICAgIGNvbnN0IGlzU291cmNlID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZDtcblxuICAgICAgLy8gQXMgd2UncmUgY29udmVydGVkIHRvIGFuIGVkZ2UsIG91ciBuZXcgcmVzdWx0aW5nIHNvdXJjZSBBTkQgdGFyZ2V0XG4gICAgICAvLyBzaG91bGQgYmUgd2hhdGV2ZXIgaXMgYXQgdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MgKGlmIGFueXRoaW5nKVxuICAgICAgaWYgKGlzU291cmNlKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICB9XG5cbiAgICAgIC8vIHRhYmxlSWQgbGlzdHMgc2hvdWxkIGVtYW5hdGUgb3V0IGZyb20gdGhlIChuZXcpIGVkZ2UgdGFibGU7IGFzc3VtaW5nXG4gICAgICAvLyAoZm9yIGEgbW9tZW50KSB0aGF0IGlzU291cmNlID09PSB0cnVlLCB3ZSdkIGNvbnN0cnVjdCB0aGUgdGFibGVJZCBsaXN0XG4gICAgICAvLyBsaWtlIHRoaXM6XG4gICAgICBsZXQgdGFibGVJZExpc3QgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIGVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICghaXNTb3VyY2UpIHtcbiAgICAgICAgLy8gV2hvb3BzLCBnb3QgaXQgYmFja3dhcmRzIVxuICAgICAgICB0YWJsZUlkTGlzdC5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YWJsZUlkTGlzdDtcbiAgICAgIC8vIFRPRE86IGluc3RlYWQgb2YgZGVsZXRpbmcgdGhlIGV4aXN0aW5nIGVkZ2UgY2xhc3MsIHNob3VsZCB3ZSBsZWF2ZSBpdFxuICAgICAgLy8gaGFuZ2luZyArIHVuY29ubmVjdGVkP1xuICAgICAgZWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgLy8gT2theSwgd2UndmUgZ290IHR3byBlZGdlcywgc28gdGhpcyBpcyBhIGxpdHRsZSBtb3JlIHN0cmFpZ2h0Zm9yd2FyZFxuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIGxldCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBub3cgd2Uga25vdyBob3cgdG8gc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IHNvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEZWxldGUgZWFjaCBvZiB0aGUgZWRnZSBjbGFzc2VzXG4gICAgICBzb3VyY2VFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgICB0YXJnZXRFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgfVxuICAgIHRoaXMuZGVsZXRlKCk7XG4gICAgZGVsZXRlIG9wdGlvbnMuY2xhc3NJZDtcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGNvbnN0IHRoaXNIYXNoID0gdGhpcy5nZXRIYXNoVGFibGUoYXR0cmlidXRlKTtcbiAgICBjb25zdCBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy5nZXRIYXNoVGFibGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFsgdGhpc0hhc2gudGFibGVJZCBdLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzOiBbIG90aGVySGFzaC50YWJsZUlkIF1cbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMuX29yaWdyYXBoLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIHNvdXJjZVRhYmxlSWRzIGFuZCB0YXJnZXRUYWJsZUlkcyBhcmUgbGlzdHMgb2YgYW55IGludGVybWVkaWF0ZSB0YWJsZXMsXG4gICAgLy8gYmVnaW5uaW5nIHdpdGggdGhlIGVkZ2UgdGFibGUgKGJ1dCBub3QgaW5jbHVkaW5nIGl0KSwgdGhhdCBsZWFkIHRvIHRoZVxuICAgIC8vIHNvdXJjZSAvIHRhcmdldCBub2RlIHRhYmxlcyAoYnV0IG5vdCBpbmNsdWRpbmcpIHRob3NlXG5cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fb3JpZ3JhcGguV1JBUFBFUlMuRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLl9vcmlncmFwaC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgcmV0dXJuIHsgdGFibGVJZCwgaW5kZXgsIGRpc3Q6IE1hdGguYWJzKHRhYmxlSWRMaXN0IC8gMiAtIGluZGV4KSB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIHRhYmxlRGlzdGFuY2VzID0gdGFibGVEaXN0YW5jZXMuZmlsdGVyKCh7IHRhYmxlSWQgfSkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCB7IHRhYmxlSWQsIGluZGV4IH0gPSB0YWJsZURpc3RhbmNlcy5zb3J0KChhLCBiKSA9PiBhLmRpc3QgLSBiLmRpc3QpWzBdO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGFibGVJZDtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZSgwLCBpbmRleCkucmV2ZXJzZSgpO1xuICAgICAgcmVzdWx0Lm5vZGVUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKGluZGV4ICsgMSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICB0ZW1wLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBkZWxldGUgdGVtcC5jbGFzc0lkO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RlbXAuc291cmNlQ2xhc3NJZF07XG4gICAgICBjb25zdCB7XG4gICAgICAgIG5vZGVUYWJsZUlkTGlzdCxcbiAgICAgICAgZWRnZVRhYmxlSWQsXG4gICAgICAgIGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSA9IHRoaXMuX3NwbGl0VGFibGVJZExpc3QodGVtcC5zb3VyY2VUYWJsZUlkcywgc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0ZW1wLnNvdXJjZUNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGVtcC50YXJnZXRDbGFzc0lkICYmIHRlbXAuc291cmNlQ2xhc3NJZCAhPT0gdGVtcC50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiB0ZW1wLnRhcmdldENsYXNzSWQsXG4gICAgICAgIHRhcmdldFRhYmxlSWRzOiBub2RlVGFibGVJZExpc3RcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RhcmdldEVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICB0aGlzLl9vcmlncmFwaC5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgc2lkZSwgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KSB7XG4gICAgaWYgKHNpZGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2UoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfSBlbHNlIGlmIChzaWRlID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBvbGl0aWNhbE91dHNpZGVyRXJyb3I6IFwiJHtzaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgICB0aGlzLl9vcmlncmFwaC5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIHRvZ2dsZURpcmVjdGlvbiAoZGlyZWN0ZWQpIHtcbiAgICBpZiAoZGlyZWN0ZWQgPT09IGZhbHNlIHx8IHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgZGVsZXRlIHRoaXMuc3dhcHBlZERpcmVjdGlvbjtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmRpcmVjdGVkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEaXJlY3RlZCB3YXMgYWxyZWFkeSB0cnVlLCBqdXN0IHN3aXRjaCBzb3VyY2UgYW5kIHRhcmdldFxuICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgdGVtcCA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSB0ZW1wO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNraXBTYXZlID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5fb3JpZ3JhcGguY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLmdldEhhc2hUYWJsZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyBzb3VyY2VDbGFzcy50YWJsZSA6IHNvdXJjZUNsYXNzLmdldEhhc2hUYWJsZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cblxuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc2tpcFNhdmUgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMuZ2V0SGFzaFRhYmxlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRhcmdldENsYXNzLnRhYmxlIDogdGFyZ2V0Q2xhc3MuZ2V0SGFzaFRhYmxlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9vcmlncmFwaC5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZSAoeyBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLl9vcmlncmFwaC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX29yaWdyYXBoLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMuX29yaWdyYXBoLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fb3JpZ3JhcGguc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgZm9yIChjb25zdCBpdGVtTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuY29ubmVjdGVkSXRlbXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbUxpc3QpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSAoaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdIHx8IFtdKS5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IHt9O1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh7IHRhYmxlSWRzLCBsaW1pdCA9IEluZmluaXR5IH0pIHtcbiAgICAvLyBGaXJzdCBtYWtlIHN1cmUgdGhhdCBhbGwgdGhlIHRhYmxlIGNhY2hlcyBoYXZlIGJlZW4gZnVsbHkgYnVpbHQgYW5kXG4gICAgLy8gY29ubmVjdGVkXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwodGFibGVJZHMubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3NPYmouX29yaWdyYXBoLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSkge1xuICAgICAgeWllbGQgaXRlbTtcbiAgICAgIGkrKztcbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0geyBsaW1pdDogSW5maW5pdHkgfSkge1xuICAgIGNvbnN0IGVkZ2VJZHMgPSBvcHRpb25zLmVkZ2VJZHMgfHwgdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHM7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIE9iamVjdC5rZXlzKGVkZ2VJZHMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLl9vcmlncmFwaC5jbGFzc2VzW2VkZ2VJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NPYmouY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMudGFibGVJZHMgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgIGkrKztcbiAgICAgICAgaWYgKGkgPj0gb3B0aW9ucy5saW1pdCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogc291cmNlTm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlVGFibGVJZCA9IHRoaXMuY2xhc3NPYmouX29yaWdyYXBoXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgb3B0aW9ucy50YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmouc291cmNlVGFibGVJZHNcbiAgICAgIC5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkID0gdGhpcy5jbGFzc09iai5fb3JpZ3JhcGhcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBvcHRpb25zLnRhYmxlSWRzID0gdGhpcy5jbGFzc09iai50YXJnZXRUYWJsZUlkc1xuICAgICAgLmNvbmNhdChbIHRhcmdldFRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcbmxldCBORVhUX1RBQkxFX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBvcmlncmFwaC5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UQUJMRVMgPSBUQUJMRVM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIHtcbiAgICAgICAgICBsZWZ0OiB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICByaWdodDogb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMudGFibGVzID0gdGhpcy5oeWRyYXRlKCdvcmlncmFwaF90YWJsZXMnLCB0aGlzLlRBQkxFUyk7XG4gICAgTkVYVF9UQUJMRV9JRCA9IE9iamVjdC5rZXlzKHRoaXMudGFibGVzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgdGFibGVJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQodGFibGVJZC5tYXRjaCgvdGFibGUoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgb3VyIGNsYXNzIHNwZWNpZmljYXRpb25zXG4gICAgdGhpcy5jbGFzc2VzID0gdGhpcy5oeWRyYXRlKCdvcmlncmFwaF9jbGFzc2VzJywgdGhpcy5DTEFTU0VTKTtcbiAgICBORVhUX0NMQVNTX0lEID0gT2JqZWN0LmtleXModGhpcy5jbGFzc2VzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgY2xhc3NJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQoY2xhc3NJZC5tYXRjaCgvY2xhc3MoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuICB9XG5cbiAgc2F2ZVRhYmxlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ29yaWdyYXBoX3RhYmxlcycsIHRoaXMudGFibGVzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3RhYmxlVXBkYXRlJyk7XG4gIH1cbiAgc2F2ZUNsYXNzZXMgKCkge1xuICAgIHRoaXMuZGVoeWRyYXRlKCdvcmlncmFwaF9jbGFzc2VzJywgdGhpcy5jbGFzc2VzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NsYXNzVXBkYXRlJyk7XG4gIH1cblxuICBoeWRyYXRlIChzdG9yYWdlS2V5LCBUWVBFUykge1xuICAgIGxldCBjb250YWluZXIgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKHN0b3JhZ2VLZXkpO1xuICAgIGNvbnRhaW5lciA9IGNvbnRhaW5lciA/IEpTT04ucGFyc2UoY29udGFpbmVyKSA6IHt9O1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbnRhaW5lcikpIHtcbiAgICAgIGNvbnN0IHR5cGUgPSB2YWx1ZS50eXBlO1xuICAgICAgZGVsZXRlIHZhbHVlLnR5cGU7XG4gICAgICB2YWx1ZS5vcmlncmFwaCA9IHRoaXM7XG4gICAgICBjb250YWluZXJba2V5XSA9IG5ldyBUWVBFU1t0eXBlXSh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cbiAgZGVoeWRyYXRlIChzdG9yYWdlS2V5LCBjb250YWluZXIpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlLl90b1Jhd09iamVjdCgpO1xuICAgICAgICByZXN1bHRba2V5XS50eXBlID0gdmFsdWUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oc3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gICAgfVxuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG5cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMudGFibGVJZCkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHtORVhUX1RBQkxFX0lEfWA7XG4gICAgICBORVhUX1RBQkxFX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLlRBQkxFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5vcmlncmFwaCA9IHRoaXM7XG4gICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdO1xuICB9XG4gIGNyZWF0ZUNsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYGVtcHR5YCB9KSB7XG4gICAgaWYgKCFvcHRpb25zLmNsYXNzSWQpIHtcbiAgICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7TkVYVF9DTEFTU19JRH1gO1xuICAgICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIH1cbiAgICBjb25zdCBUeXBlID0gdGhpcy5DTEFTU0VTW29wdGlvbnMudHlwZV07XG4gICAgZGVsZXRlIG9wdGlvbnMudHlwZTtcbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIG5ld1RhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGVPYmogPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZU9iajtcbiAgfVxuICBuZXdDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld0NsYXNzT2JqID0gdGhpcy5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0NsYXNzT2JqO1xuICB9XG5cbiAgYXN5bmMgYWRkRmlsZUFzU3RhdGljVGFibGUgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY1RhYmxlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24gPSAndHh0JywgdGV4dCB9KSB7XG4gICAgbGV0IGRhdGEsIGF0dHJpYnV0ZXM7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5uZXdUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5uZXdDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBkZWxldGVBbGxVbnVzZWRUYWJsZXMgKCkge1xuICAgIGZvciAoY29uc3QgdGFibGVJZCBpbiB0aGlzLnRhYmxlcykge1xuICAgICAgaWYgKHRoaXMudGFibGVzW3RhYmxlSWRdKSB7XG4gICAgICAgIHRyeSB7IHRoaXMudGFibGVzW3RhYmxlSWRdLmRlbGV0ZSgpOyB9IGNhdGNoIChlcnIpIHt9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGRlbGV0ZUFsbENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc09iai5kZWxldGUoKTtcbiAgICB9XG4gIH1cbiAgZ2V0Q2xhc3NEYXRhICgpIHtcbiAgICBjb25zdCByZXN1bHRzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIHJlc3VsdHNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5jdXJyZW50RGF0YTtcbiAgICB9XG4gIH1cbiAgcmVnaXN0ZXJQbHVnaW4gKG5hbWUsIHBsdWdpbikge1xuICAgIHRoaXMucGx1Z2luc1tuYW1lXSA9IHBsdWdpbjtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBPcmlncmFwaDtcbiIsImltcG9ydCBPcmlncmFwaCBmcm9tICcuL09yaWdyYXBoLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCBGaWxlUmVhZGVyIGZyb20gJ2ZpbGVyZWFkZXInO1xuXG5sZXQgb3JpZ3JhcGggPSBuZXcgT3JpZ3JhcGgoRmlsZVJlYWRlciwgbnVsbCk7XG5vcmlncmFwaC52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG9yaWdyYXBoO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsIm9mZiIsImluZGV4Iiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5Iiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiT2JqZWN0IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJUYWJsZSIsIm9wdGlvbnMiLCJfb3JpZ3JhcGgiLCJvcmlncmFwaCIsInRhYmxlSWQiLCJFcnJvciIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3N1cHByZXNzZWRBdHRyaWJ1dGVzIiwic3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJfc3VwcHJlc3NJbmRleCIsInN1cHByZXNzSW5kZXgiLCJfaW5kZXhTdWJGaWx0ZXIiLCJpbmRleFN1YkZpbHRlciIsIl9hdHRyaWJ1dGVTdWJGaWx0ZXJzIiwiYXR0cmlidXRlU3ViRmlsdGVycyIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwidXNlZEJ5Q2xhc3NlcyIsIl91c2VkQnlDbGFzc2VzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiaXRlcmF0ZSIsInJlc2V0IiwiX2NhY2hlIiwibGltaXQiLCJ1bmRlZmluZWQiLCJJbmZpbml0eSIsInZhbHVlcyIsInNsaWNlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlIiwiaXRlcmF0b3IiLCJfaXRlcmF0ZSIsImNvbXBsZXRlZCIsIm5leHQiLCJkb25lIiwiX2ZpbmlzaEl0ZW0iLCJ3cmFwcGVkSXRlbSIsInJvdyIsImtlZXAiLCJkaXNjb25uZWN0IiwiX3dyYXAiLCJ0YWJsZSIsImNsYXNzT2JqIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiY29ubmVjdEl0ZW0iLCJkZXJpdmVkVGFibGUiLCJuYW1lIiwiYnVpbGRDYWNoZSIsIl9jYWNoZVByb21pc2UiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNvdW50Um93cyIsImtleXMiLCJsZW5ndGgiLCJnZXRJbmRleERldGFpbHMiLCJkZXRhaWxzIiwic3VwcHJlc3NlZCIsImZpbHRlcmVkIiwiZ2V0QXR0cmlidXRlRGV0YWlscyIsImFsbEF0dHJzIiwiZXhwZWN0ZWQiLCJvYnNlcnZlZCIsImRlcml2ZWQiLCJjdXJyZW50RGF0YSIsImRhdGEiLCJjb21wbGV0ZSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsInN1cHByZXNzQXR0cmlidXRlIiwiYWRkU3ViRmlsdGVyIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsInNhdmVUYWJsZXMiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGVJZCIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwidGFibGVzIiwic2hvcnRlc3RQYXRoVG9UYWJsZSIsIm90aGVyVGFibGUiLCJ2aXNpdGVkIiwiZGlzdGFuY2VzIiwicHJldlRhYmxlcyIsInZpc2l0IiwidGFyZ2V0SWQiLCJ0YXJnZXRUYWJsZSIsIm5laWdoYm9yTGlzdCIsImNvbmNhdCIsInBhcmVudFRhYmxlcyIsIm1hcCIsInBhcmVudFRhYmxlIiwiZmlsdGVyIiwibmVpZ2hib3JJZCIsInRvVmlzaXQiLCJzb3J0IiwiYSIsImIiLCJuZXh0SWQiLCJzaGlmdCIsImNoYWluIiwidW5zaGlmdCIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsImRlbGltaXRlciIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY2xvc2VkVHJhbnNwb3NlIiwiaW5kZXhlcyIsIm9wZW5UcmFuc3Bvc2UiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJjbGFzc2VzIiwicmVkdWNlIiwiYWdnIiwiaW5Vc2UiLCJzb21lIiwic291cmNlVGFibGVJZHMiLCJ0YXJnZXRUYWJsZUlkcyIsImRlbGV0ZSIsImV4ZWMiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJpdGVtIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQWdncmVnYXRlZFRhYmxlIiwiX2F0dHJpYnV0ZSIsIl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJyZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJfZGVoeWRyYXRlRnVuY3Rpb24iLCJkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIiwiX3VwZGF0ZUl0ZW0iLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwibmV3V3JhcHBlZEl0ZW0iLCJ3cmFwcGVkUGFyZW50IiwiU3RyaW5nIiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsInJlZHVjZWQiLCJEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfaW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9kdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlQXR0cmlidXRlIiwicGFyZW50SWQiLCJfZHVwbGljYXRlQXR0cmlidXRlcyIsInBhcmVudE5hbWUiLCJjb25uZWN0ZWRJdGVtcyIsImF0dHJOYW1lIiwiY29waWVkIiwiRXhwYW5kZWRUYWJsZSIsInNwbGl0IiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb25zIiwic2V0Q2xhc3NOYW1lIiwic2F2ZUNsYXNzZXMiLCJoYXNDdXN0b21OYW1lIiwiZ2V0SGFzaFRhYmxlIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm5ld0NsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIl9kZXJpdmVHZW5lcmljQ2xhc3MiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NJZHMiLCJOb2RlV3JhcHBlciIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImVkZ2VDbGFzcyIsImlzU291cmNlIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJ0YWJsZUlkTGlzdCIsInJldmVyc2UiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY3JlYXRlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJub2RlQ2xhc3MiLCJlZGdlQ2xhc3NJZCIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0IiwiRWRnZUNsYXNzIiwiRWRnZVdyYXBwZXIiLCJfc3BsaXRUYWJsZUlkTGlzdCIsIm90aGVyQ2xhc3MiLCJub2RlVGFibGVJZExpc3QiLCJlZGdlVGFibGVJZCIsImVkZ2VUYWJsZUlkTGlzdCIsInN0YXRpY0V4aXN0cyIsInRhYmxlRGlzdGFuY2VzIiwic3RhcnRzV2l0aCIsImRpc3QiLCJNYXRoIiwiYWJzIiwibmV3Tm9kZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsInNpZGUiLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImNvbm5lY3RTb3VyY2UiLCJjb25uZWN0VGFyZ2V0IiwidG9nZ2xlRGlyZWN0aW9uIiwic3dhcHBlZERpcmVjdGlvbiIsInNraXBTYXZlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiaXRlbUxpc3QiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsImFsbCIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwiZWRnZXMiLCJlZGdlSWRzIiwiZWRnZUlkIiwic291cmNlTm9kZXMiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXRUYWJsZUlkIiwiSW5NZW1vcnlJbmRleCIsInRvUmF3T2JqZWN0IiwiaXRlckVudHJpZXMiLCJoYXNoIiwidmFsdWVMaXN0IiwiaXRlckhhc2hlcyIsIml0ZXJWYWx1ZUxpc3RzIiwiZ2V0VmFsdWVMaXN0IiwiYWRkVmFsdWUiLCJORVhUX0NMQVNTX0lEIiwiTkVYVF9UQUJMRV9JRCIsIk9yaWdyYXBoIiwiRmlsZVJlYWRlciIsImxvY2FsU3RvcmFnZSIsIm1pbWUiLCJkZWJ1ZyIsInBsdWdpbnMiLCJEQVRBTElCX0ZPUk1BVFMiLCJUQUJMRVMiLCJDTEFTU0VTIiwiSU5ERVhFUyIsIk5BTUVEX0ZVTkNUSU9OUyIsImlkZW50aXR5IiwicmF3SXRlbSIsImtleSIsIlR5cGVFcnJvciIsInBhcmVudFR5cGUiLCJkZWZhdWx0RmluaXNoIiwidGhpc1dyYXBwZWRJdGVtIiwib3RoZXJXcmFwcGVkSXRlbSIsImxlZnQiLCJyaWdodCIsInNoYTEiLCJKU09OIiwic3RyaW5naWZ5Iiwibm9vcCIsImh5ZHJhdGUiLCJoaWdoZXN0TnVtIiwibWF4IiwicGFyc2VJbnQiLCJtYXRjaCIsImRlaHlkcmF0ZSIsInN0b3JhZ2VLZXkiLCJUWVBFUyIsImNvbnRhaW5lciIsImdldEl0ZW0iLCJwYXJzZSIsInNldEl0ZW0iLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiVHlwZSIsInNlbGVjdG9yIiwibmV3VGFibGVPYmoiLCJuZXdDbGFzc09iaiIsImFkZEZpbGVBc1N0YXRpY1RhYmxlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJjb25zb2xlIiwid2FybiIsInRleHQiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJlcnIiLCJkZWxldGVBbGxDbGFzc2VzIiwiZ2V0Q2xhc3NEYXRhIiwicmVzdWx0cyIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luIiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGFBQUwsR0FBcUIsRUFBckI7V0FDS0MsY0FBTCxHQUFzQixFQUF0Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFi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
