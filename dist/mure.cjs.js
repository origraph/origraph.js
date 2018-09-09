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
    this._mure = options.mure;
    this.tableId = options.tableId;

    if (!this._mure || !this.tableId) {
      throw new Error(`mure and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};
    this._derivedTables = options.derivedTables || {};
    this._derivedAttributeFunctions = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions || {})) {
      this._derivedAttributeFunctions[attr] = this._mure.hydrateFunction(stringifiedFunc);
    }

    this._suppressedAttributes = options.suppressedAttributes || {};
    this._suppressIndex = !!options.suppressIndex;
    this._indexSubFilter = options.indexSubFilter && this._mure.hydrateFunction(options.indexSubFilter) || null;
    this._attributeSubFilters = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.attributeSubFilters || {})) {
      this._attributeSubFilters[attr] = this._mure.hydrateFunction(stringifiedFunc);
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
      indexSubFilter: this._indexSubFilter && this._mure.dehydrateFunction(this._indexSubFilter) || null
    };

    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this._mure.dehydrateFunction(func);
    }

    for (const [attr, func] of Object.entries(this._attributeSubFilters)) {
      result.attributeSubFilters[attr] = this._mure.dehydrateFunction(func);
    }

    return result;
  }

  get name() {
    throw new Error(`this function should be overridden`);
  }

  async *iterate(options = {}) {
    // Generic caching stuff; this isn't just for performance. ConnectedTable's
    // algorithm requires that its parent tables have pre-built indexes (we
    // technically could implement it differently, but it would be expensive,
    // requires tricky logic, and we're already building indexes for some tables
    // like AggregatedTable anyway)
    if (options.reset) {
      this.reset();
    }

    if (this._cache) {
      const limit = options.limit === undefined ? Infinity : options.limit;
      yield* Object.values(this._cache).slice(0, limit);
      return;
    }

    yield* await this._buildCache(options);
  }

  reset() {
    delete this._partialCache;
    delete this._cache;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  async countRows() {
    if (this._cache) {
      return Object.keys(this._cache).length;
    } else {
      let count = 0;

      const iterator = this._buildCache();

      let temp = await iterator.next();

      while (!temp.done) {
        count++;
        temp = await iterator.next();
      }

      return count;
    }
  }

  async *_buildCache(options = {}) {
    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    this._partialCache = {};
    const limit = options.limit === undefined ? Infinity : options.limit;
    delete options.limit;

    const iterator = this._iterate(options);

    let completed = false;

    for (let i = 0; i < limit; i++) {
      const temp = await iterator.next();

      if (!this._partialCache) {
        // iteration was cancelled; return immediately
        return;
      }

      if (temp.done) {
        completed = true;
        break;
      } else {
        this._finishItem(temp.value);

        this._partialCache[temp.value.index] = temp.value;
        yield temp.value;
      }
    }

    if (completed) {
      this._cache = this._partialCache;
    }

    delete this._partialCache;
  }

  async *_iterate(options) {
    throw new Error(`this function should be overridden`);
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
    const wrappedItem = classObj ? classObj._wrap(options) : new this._mure.WRAPPERS.GenericWrapper(options);

    for (const otherItem of options.itemsToConnect || []) {
      wrappedItem.connectItem(otherItem);
      otherItem.connectItem(wrappedItem);
    }

    return wrappedItem;
  }

  getAttributeDetails() {
    const allAttrs = {};

    for (const attr in this._expectedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {};
      allAttrs[attr].expected = true;
    }

    for (const attr in this._observedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {};
      allAttrs[attr].observed = true;
    }

    for (const attr in this._derivedAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || {};
      allAttrs[attr].derived = true;
    }

    for (const attr in this._suppressedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {};
      allAttrs[attr].suppressed = true;
    }

    for (const attr in this._attributeSubFilters) {
      allAttrs[attr] = allAttrs[attr] || {};
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
    const newTable = this._mure.createTable(options);

    this._derivedTables[newTable.tableId] = true;

    this._mure.saveTables();

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
    return existingTableId && this._mure.tables[existingTableId] || null;
  }

  shortestPathToTable(otherTable) {
    // Dijkstra's algorithm...
    const visited = {};
    const distances = {};
    const prevTables = {};

    const visit = targetId => {
      const targetTable = this._mure.tables[targetId]; // Only check the unvisited derived and parent tables

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
          chain.unshift(this._mure.tables[nextId]);
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

  async *openFacet(attribute, limit = Infinity) {
    const values = {};

    for await (const wrappedItem of this.iterate({
      limit
    })) {
      const value = wrappedItem.row[attribute];

      if (!values[value]) {
        values[value] = true;
        const options = {
          type: 'FacetedTable',
          attribute,
          value
        };
        yield this._getExistingTable(options) || this._deriveTable(options);
      }
    }
  }

  connect(otherTableList) {
    const newTable = this._mure.createTable({
      type: 'ConnectedTable'
    });

    this._derivedTables[newTable.tableId] = true;

    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this._mure.saveTables();

    return newTable;
  }

  get classObj() {
    return Object.values(this._mure.classes).find(classObj => {
      return classObj.table === this;
    });
  }

  get parentTables() {
    return Object.values(this._mure.tables).reduce((agg, tableObj) => {
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }

      return agg;
    }, []);
  }

  get derivedTables() {
    return Object.keys(this._derivedTables).map(tableId => {
      return this._mure.tables[tableId];
    });
  }

  delete() {
    if (Object.keys(this._derivedTables).length > 0 || this.classObj) {
      throw new Error(`Can't delete in-use table ${this.tableId}`);
    }

    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTables[this.tableId];
    }

    delete this._mure.tables[this.tableId];

    this._mure.saveTables();
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

  async *_iterate(options) {
    for (let index = 0; index < this._data.length; index++) {
      const item = this._wrap({
        index,
        row: this._data[index]
      });

      this._finishItem(item);

      yield item;
    }
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

  async *_iterate(options) {
    for (const [index, row] of Object.entries(this._data)) {
      const item = this._wrap({
        index,
        row
      });

      this._finishItem(item);

      yield item;
    }
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
      this._reduceAttributeFunctions[attr] = this._mure.hydrateFunction(stringifiedFunc);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.reduceAttributeFunctions = {};

    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this._mure._dehydrateFunction(func);
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

  async *_buildCache(options) {
    // We override _buildCache because so that AggregatedTable can take advantage
    // of the partially-built cache as it goes, and postpone finishing items
    // until after the parent table has been fully iterated
    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    this._partialCache = {};

    for await (const wrappedItem of this._iterate(options)) {
      this._partialCache[wrappedItem.index] = wrappedItem; // Go ahead and yield the unfinished item; this makes it possible for
      // client apps to be more responsive and render partial results, but also
      // means that they need to watch for wrappedItem.on('update') events

      yield wrappedItem;
    } // Second pass: now that we've completed the full iteration of the parent
    // table, we can finish each item


    for (const index in this._partialCache) {
      const wrappedItem = this._partialCache[index];

      if (!this._finishItem(wrappedItem)) {
        delete this._partialCache[index];
      }
    }

    this._cache = this._partialCache;
    delete this._partialCache;
  }

  async *_iterate(options) {
    const parentTable = this.parentTable;

    for await (const wrappedParent of parentTable.iterate(options)) {
      const index = wrappedParent.row[this._attribute];

      if (!this._partialCache) {
        // We were reset; return immediately
        return;
      } else if (this._partialCache[index]) {
        const existingItem = this._partialCache[index];
        existingItem.connectItem(wrappedParent);
        wrappedParent.connectItem(existingItem);

        this._updateItem(existingItem, wrappedParent);
      } else {
        const newItem = this._wrap({
          index,
          itemsToConnect: [wrappedParent]
        });

        this._updateItem(newItem, newItem);

        yield newItem;
      }
    }
  }

  getAttributeDetails() {
    const allAttrs = super.getAttributeDetails();

    for (const attr in this._reduceAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || {};
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
        const parentName = this._mure.tables[parentId].name;
        wrappedItem.row[`${parentName}.${attr}`] = wrappedItem.connectedItems[parentId][0].row[attr];
      }
    }

    getAttributeDetails() {
      const allAttrs = super.getAttributeDetails();

      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const attrName = `${this._mure.tables[parentId].name}.${attr}`;
        allAttrs[attrName] = allAttrs[attrName] || {};
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

  async *_iterate(options) {
    let index = 0;
    const parentTable = this.parentTable;

    for await (const wrappedParent of parentTable.iterate(options)) {
      const values = (wrappedParent.row[this._attribute] || '').split(this.delimiter);

      for (const value of values) {
        const row = {};
        row[this._attribute] = value;

        const newItem = this._wrap({
          index,
          row,
          itemsToConnect: [wrappedParent]
        });

        this._duplicateAttributes(newItem);

        if (this._finishItem(newItem)) {
          yield newItem;
        }

        index++;
      }
    }
  }

}

class FacetedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;
    this._value = options.value;

    if (!this._attribute === undefined || !this._value === undefined) {
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
    return `${this.parentTable.name}[${this._value}]`;
  }

  async *_iterate(options) {
    let index = 0;
    const parentTable = this.parentTable;

    for await (const wrappedParent of parentTable.iterate(options)) {
      if (this._attribute === null && wrappedParent.index === this._value || this._attribute !== null && wrappedParent.row[this._attribute] === this._value) {
        const newItem = this._wrap({
          index,
          row: Object.assign({}, wrappedParent.row),
          itemsToConnect: [wrappedParent]
        });

        if (this._finishItem(newItem)) {
          yield newItem;
        }

        index++;
      }
    }
  }

}

class ConnectedTable extends DuplicatableAttributesMixin(Table) {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('⨯');
  }

  async *_iterate(options) {
    const parentTables = this.parentTables; // Spin through all of the parentTables so that their _cache is pre-built

    for (const parentTable of parentTables) {
      await parentTable.countRows();
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


      const newItem = this._wrap({
        index,
        itemsToConnect: parentTables.map(table => table._cache[index])
      });

      this._duplicateAttributes(newItem);

      if (this._finishItem(newItem)) {
        yield newItem;
      }
    }
  }

}



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  AggregatedTable: AggregatedTable,
  ExpandedTable: ExpandedTable,
  FacetedTable: FacetedTable,
  ConnectedTable: ConnectedTable
});

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this._mure = options.mure;
    this.classId = options.classId;
    this.tableId = options.tableId;

    if (!this._mure || !this.classId || !this.tableId) {
      throw new Error(`_mure, classId, and tableId are required`);
    }

    this._className = options.className || null;
    this.annotation = options.annotation || '';
  }

  _toRawObject() {
    return {
      classId: this.classId,
      tableId: this.tableId,
      className: this._className,
      annotation: this.annotation
    };
  }

  setClassName(value) {
    this._className = value;

    this._mure.saveClasses();
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
    return this._mure.tables[this.tableId];
  }

  _wrap(options) {
    options.classObj = this;
    return new this._mure.WRAPPERS.GenericWrapper(options);
  }

  interpretAsNodes() {
    const options = this._toRawObject();

    options.type = 'NodeClass';
    return this._mure.newClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    return this._mure.newClass(options);
  }

  _deriveGenericClass(newTable) {
    return this._mure.newClass({
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

  async *openFacet(attribute) {
    for await (const newTable of this.table.openFacet(attribute)) {
      yield this._deriveGenericClass(newTable);
    }
  }

  delete() {
    delete this._mure.classes[this.classId];

    this._mure.saveClasses();
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
    this._cachedShortestEdgePaths = {};
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.edgeClassIds = this.edgeClassIds;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new this._mure.WRAPPERS.NodeWrapper(options);
  }

  async prepShortestEdgePath(edgeClassId) {
    if (this._cachedShortestEdgePaths[edgeClassId] !== undefined) {
      return this._cachedShortestEdgePaths[edgeClassId];
    } else {
      const edgeTable = this._mure.classes[edgeClassId].table;
      const idList = [];

      for (const table of this.table.shortestPathToTable(edgeTable)) {
        idList.push(table.tableId); // Spin through the table to make sure all its rows are wrapped and connected

        await table.countRows();
      }

      this._cachedShortestEdgePaths[edgeClassId] = idList;
      return this._cachedShortestEdgePaths[edgeClassId];
    }
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
      // (or a floating edge if edgeClass.sourceClassId is null)
      const edgeClass = this._mure.classes[edgeClassIds[0]];
      options.sourceClassId = edgeClass.sourceClassId;
      options.targetClassId = edgeClass.sourceClassId;
      options.directed = edgeClass.directed;
      edgeClass.delete();
    } else if (edgeClassIds.length === 2) {
      let sourceEdgeClass = this._mure.classes[edgeClassIds[0]];
      let targetEdgeClass = this._mure.classes[edgeClassIds[1]]; // Figure out the direction, if there is one

      options.directed = false;

      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        if (sourceEdgeClass.targetClassId === this.classId && targetEdgeClass.sourceClassId === this.classId) {
          // We happened to get the edges in order; set directed to true
          options.directed = true;
        } else if (sourceEdgeClass.sourceClassId === this.classId && targetEdgeClass.targetClassId === this.classId) {
          // We got the edges backwards; swap them and set directed to true
          targetEdgeClass = this._mure.classes[edgeClassIds[0]];
          sourceEdgeClass = this._mure.classes[edgeClassIds[1]];
          options.directed = true;
        }
      } // Okay, now we know how to set source / target ids


      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId; // Delete each of the edge classes

      sourceEdgeClass.delete();
      targetEdgeClass.delete();
    }

    this.delete();
    delete options.classId;
    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    return this._mure.newClass(options);
  }

  connectToNodeClass({
    otherNodeClass,
    directed,
    attribute,
    otherAttribute
  }) {
    const thisHash = this.getHashTable(attribute);
    const otherHash = otherNodeClass.getHashTable(otherAttribute);
    const connectedTable = thisHash.connect([otherHash]);

    const newEdgeClass = this._mure.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      directed,
      sourceClassId: this.classId,
      targetClassId: otherNodeClass.classId
    });

    this.edgeClassIds[newEdgeClass.classId] = true;
    otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;

    this._mure.saveClasses();

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
      const edgeClass = this._mure.classes[edgeClassId];

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
    super(options);
    this.sourceClassId = options.sourceClassId || null;
    this.targetClassId = options.targetClassId || null;
    this.directed = options.directed || false;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.targetClassId = this.targetClassId;
    result.directed = this.directed;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new this._mure.WRAPPERS.EdgeWrapper(options);
  }

  _pickEdgeTable(otherClass) {
    let edgeTable;
    let chain = this.table.shortestPathToTable(otherClass.table);

    if (chain === null) {
      throw new Error(`Underlying table chain between edge and node classes is broken`);
    } else if (chain.length <= 2) {
      // Weird corner case where we're trying to create an edge between
      // adjacent or identical tables... create a ConnectedTable
      edgeTable = this.table.connect(otherClass.table);
    } else {
      // Use a table in the middle; prioritize StaticTable and StaticDictTable
      let staticExists = false;
      chain = chain.slice(1, chain.length - 1).map((table, dist) => {
        staticExists = staticExists || table.type.startsWith('Static');
        return {
          table,
          dist
        };
      });

      if (staticExists) {
        chain = chain.filter(({
          table
        }) => {
          return table.type.startsWith('Static');
        });
      }

      edgeTable = chain[0].table;
    }

    return edgeTable;
  }

  async prepShortestSourcePath() {
    if (this._cachedShortestSourcePath !== undefined) {
      return this._cachedShortestSourcePath;
    } else if (this._sourceClassId === null) {
      return null;
    } else {
      const sourceTable = this._mure.classes[this.sourceClassId].table;
      const idList = [];

      for (const table of this.table.shortestPathToTable(sourceTable)) {
        idList.push(table.tableId); // Spin through the table to make sure all its rows are wrapped and connected

        await table.countRows();
      }

      this._cachedShortestSourcePath = idList;
      return this._cachedShortestSourcePath;
    }
  }

  async prepShortestTargetPath() {
    if (this._cachedShortestTargetPath !== undefined) {
      return this._cachedShortestTargetPath;
    } else if (this._targetClassId === null) {
      return null;
    } else {
      const targetTable = this._mure.classes[this.targetClassId].table;
      const idList = [];

      for (const table of this.table.shortestPathToTable(targetTable)) {
        idList.push(table.tableId); // Spin through the table to make sure all its rows are wrapped and connected

        await table.countRows();
      }

      this._cachedShortestTargetPath = idList;
      return this._cachedShortestTargetPath;
    }
  }

  interpretAsNodes() {
    const temp = this._toRawObject();

    this.delete();
    temp.type = 'NodeClass';
    delete temp.classId;

    const newNodeClass = this._mure.createClass(temp);

    if (temp.sourceClassId) {
      const sourceClass = this._mure.classes[this.sourceClassId];

      const edgeTable = this._pickEdgeTable(sourceClass);

      const sourceEdgeClass = this._mure.createClass({
        type: 'EdgeClass',
        tableId: edgeTable.tableId,
        directed: temp.directed,
        sourceClassId: temp.sourceClassId,
        targetClassId: newNodeClass.classId
      });

      sourceClass.edgeClassIds[sourceEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[sourceEdgeClass.classId] = true;
    }

    if (temp.targetClassId && temp.sourceClassId !== temp.targetClassId) {
      const targetClass = this._mure.classes[this.targetClassId];

      const edgeTable = this._pickEdgeTable(targetClass);

      const targetEdgeClass = this._mure.createClass({
        type: 'EdgeClass',
        tableId: edgeTable.tableId,
        directed: temp.directed,
        sourceClassId: newNodeClass.classId,
        targetClassId: temp.targetClassId
      });

      targetClass.edgeClassIds[targetEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[targetEdgeClass.classId] = true;
    }

    this._mure.saveClasses();

    return newNodeClass;
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass({
    nodeClass,
    direction,
    nodeAttribute,
    edgeAttribute
  }) {
    if (direction) {
      this.directed = true;
    }

    if (direction !== 'source' && direction !== 'target') {
      direction = this.targetClassId === null ? 'target' : 'source';
    }

    if (direction === 'target') {
      this.connectTarget({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    } else {
      this.connectSource({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    }

    this._mure.saveClasses();
  }

  toggleNodeDirection(sourceClassId) {
    if (!sourceClassId) {
      this.directed = false;
    } else {
      this.directed = true;

      if (sourceClassId !== this.sourceClassId) {
        if (sourceClassId !== this.targetClassId) {
          throw new Error(`Can't swap to unconnected class id: ${sourceClassId}`);
        }

        let temp = this.sourceClassId;
        this.sourceClassId = this.targetClassId;
        this.targetClassId = temp;
      }
    }

    this._mure.saveClasses();
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
    const sourceClass = this._mure.classes[this.sourceClassId];
    sourceClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.getHashTable(nodeAttribute);
    edgeHash.connect([nodeHash]);

    if (!skipSave) {
      this._mure.saveClasses();
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
    const targetClass = this._mure.classes[this.targetClassId];
    targetClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.getHashTable(nodeAttribute);
    edgeHash.connect([nodeHash]);

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  disconnectSource({
    skipSave = false
  } = {}) {
    const existingSourceClass = this._mure.classes[this.sourceClassId];

    if (existingSourceClass) {
      delete existingSourceClass.edgeClassIds[this.classId];
      delete existingSourceClass._cachedShortestEdgePaths[this.classId];
    }

    delete this._cachedShortestSourcePath;

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  disconnectTarget({
    skipSave = false
  } = {}) {
    const existingTargetClass = this._mure.classes[this.targetClassId];

    if (existingTargetClass) {
      delete existingTargetClass.edgeClassIds[this.classId];
      delete existingTargetClass._cachedShortestEdgePaths[this.classId];
    }

    delete this._cachedShortestTargetPath;

    if (!skipSave) {
      this._mure.saveClasses();
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

  *iterateAcrossConnections(tableIds) {
    if (tableIds.length === 1) {
      yield* this.connectedItems[tableIds[0]] || [];
    } else {
      const thisTableId = tableIds[0];
      const remainingTableIds = tableIds.slice(1);

      for (const item of this.connectedItems[thisTableId] || []) {
        yield* item.iterateAcrossConnections(remainingTableIds);
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

  async *edges({
    limit = Infinity
  } = {}) {
    let i = 0;

    for (const edgeClassId of Object.keys(this.classObj.edgeClassIds)) {
      const tableIdChain = await this.classObj.prepShortestEdgePath(edgeClassId);
      const iterator = this.iterateAcrossConnections(tableIdChain);
      let temp = iterator.next();

      while (!temp.done && i < limit) {
        yield temp.value;
        i++;
        temp = iterator.next();
      }

      if (i >= limit) {
        return;
      }
    }
  }

}

class EdgeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  async *sourceNodes({
    limit = Infinity
  } = {}) {
    const tableIdChain = await this.classObj.prepShortestSourcePath();
    const iterator = this.iterateAcrossConnections(tableIdChain);
    let temp = iterator.next();
    let i = 0;

    while (!temp.done && i < limit) {
      yield temp.value;
      i++;
      temp = iterator.next();
    }
  }

  async *targetNodes({
    limit = Infinity
  } = {}) {
    const tableIdChain = await this.classObj.prepShortestTargetPath();
    const iterator = this.iterateAcrossConnections(tableIdChain);
    let temp = iterator.next();
    let i = 0;

    while (!temp.done && i < limit) {
      yield temp.value;
      i++;
      temp = iterator.next();
    }
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

  async *iterEntries() {
    for (const [hash, valueList] of Object.entries(this.entries)) {
      yield {
        hash,
        valueList
      };
    }
  }

  async *iterHashes() {
    for (const hash of Object.keys(this.entries)) {
      yield hash;
    }
  }

  async *iterValueLists() {
    for (const valueList of Object.values(this.entries)) {
      yield valueList;
    }
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

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set mure.debug to true to debug streams
    // extensions that we want datalib to handle

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

    this.tables = this.hydrate('mure_tables', this.TABLES);
    NEXT_TABLE_ID = Object.keys(this.tables).reduce((highestNum, tableId) => {
      return Math.max(highestNum, parseInt(tableId.match(/table(\d*)/)[1]));
    }, 0) + 1; // Object containing our class specifications

    this.classes = this.hydrate('mure_classes', this.CLASSES);
    NEXT_CLASS_ID = Object.keys(this.classes).reduce((highestNum, classId) => {
      return Math.max(highestNum, parseInt(classId.match(/class(\d*)/)[1]));
    }, 0) + 1;
  }

  saveTables() {
    this.dehydrate('mure_tables', this.tables);
    this.trigger('tableUpdate');
  }

  saveClasses() {
    this.dehydrate('mure_classes', this.classes);
    this.trigger('classUpdate');
  }

  hydrate(storageKey, TYPES) {
    let container = this.localStorage && this.localStorage.getItem(storageKey);
    container = container ? JSON.parse(container) : {};

    for (const [key, value] of Object.entries(container)) {
      const type = value.type;
      delete value.type;
      value.mure = this;
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
    options.mure = this;
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
    options.mure = this;
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

}

var name = "mure";
var version = "0.5.6";
var description = "A library for flexible graph reshaping";
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
var files = [
	"dist"
];
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
	"@babel/core": "^7.0.0",
	"@babel/preset-env": "^7.0.0",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.4.2",
	coveralls: "^3.0.2",
	filereader: "^0.10.3",
	jest: "^23.5.0",
	rollup: "^0.65.0",
	"rollup-plugin-babel": "^4.0.2",
	"rollup-plugin-commonjs": "^9.1.6",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.2.1",
	"rollup-plugin-node-resolve": "^3.3.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
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

let mure = new Mure(FileReader, null);
mure.version = pkg.version;

module.exports = mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TaW5nbGVQYXJlbnRNaXhpbi5qcyIsIi4uL3NyYy9UYWJsZXMvQWdncmVnYXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0V4cGFuZGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZhY2V0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcblxuY2xhc3MgVGFibGUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMuX211cmUgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtdXJlIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5fbXVyZS5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhTdWJGaWx0ZXIgPSAob3B0aW9ucy5pbmRleFN1YkZpbHRlciAmJiB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4U3ViRmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZVN1YkZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzW2F0dHJdID0gdGhpcy5fbXVyZS5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIHVzZWRCeUNsYXNzZXM6IHRoaXMuX3VzZWRCeUNsYXNzZXMsXG4gICAgICBkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zOiB7fSxcbiAgICAgIHN1cHByZXNzZWRBdHRyaWJ1dGVzOiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyxcbiAgICAgIHN1cHByZXNzSW5kZXg6IHRoaXMuX3N1cHByZXNzSW5kZXgsXG4gICAgICBhdHRyaWJ1dGVTdWJGaWx0ZXJzOiB7fSxcbiAgICAgIGluZGV4U3ViRmlsdGVyOiAodGhpcy5faW5kZXhTdWJGaWx0ZXIgJiYgdGhpcy5fbXVyZS5kZWh5ZHJhdGVGdW5jdGlvbih0aGlzLl9pbmRleFN1YkZpbHRlcikpIHx8IG51bGxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnMpKSB7XG4gICAgICByZXN1bHQuYXR0cmlidXRlU3ViRmlsdGVyc1thdHRyXSA9IHRoaXMuX211cmUuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gR2VuZXJpYyBjYWNoaW5nIHN0dWZmOyB0aGlzIGlzbid0IGp1c3QgZm9yIHBlcmZvcm1hbmNlLiBDb25uZWN0ZWRUYWJsZSdzXG4gICAgLy8gYWxnb3JpdGhtIHJlcXVpcmVzIHRoYXQgaXRzIHBhcmVudCB0YWJsZXMgaGF2ZSBwcmUtYnVpbHQgaW5kZXhlcyAod2VcbiAgICAvLyB0ZWNobmljYWxseSBjb3VsZCBpbXBsZW1lbnQgaXQgZGlmZmVyZW50bHksIGJ1dCBpdCB3b3VsZCBiZSBleHBlbnNpdmUsXG4gICAgLy8gcmVxdWlyZXMgdHJpY2t5IGxvZ2ljLCBhbmQgd2UncmUgYWxyZWFkeSBidWlsZGluZyBpbmRleGVzIGZvciBzb21lIHRhYmxlc1xuICAgIC8vIGxpa2UgQWdncmVnYXRlZFRhYmxlIGFueXdheSlcbiAgICBpZiAob3B0aW9ucy5yZXNldCkge1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgICB5aWVsZCAqIE9iamVjdC52YWx1ZXModGhpcy5fY2FjaGUpLnNsaWNlKDAsIGxpbWl0KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB5aWVsZCAqIGF3YWl0IHRoaXMuX2J1aWxkQ2FjaGUob3B0aW9ucyk7XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2NhY2hlKS5sZW5ndGg7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBjb3VudCA9IDA7XG4gICAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2J1aWxkQ2FjaGUoKTtcbiAgICAgIGxldCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgY291bnQrKztcbiAgICAgICAgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb3VudDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZShvcHRpb25zKTtcbiAgICBsZXQgY29tcGxldGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gaXRlcmF0aW9uIHdhcyBjYW5jZWxsZWQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKTtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3RlbXAudmFsdWUuaW5kZXhdID0gdGVtcC52YWx1ZTtcbiAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbXBsZXRlZCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4U3ViRmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhTdWJGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVTdWJGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgZnVuYyh3cmFwcGVkSXRlbS5yb3dbYXR0cl0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHt9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHt9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7fTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwge307XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwge307XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBzdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZV0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgYWRkU3ViRmlsdGVyIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pbmRleFN1YkZpbHRlciA9IGZ1bmM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZVN1YkZpbHRlcnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMuX211cmUuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZUlkID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlSWQgJiYgdGhpcy5fbXVyZS50YWJsZXNbZXhpc3RpbmdUYWJsZUlkXSkgfHwgbnVsbDtcbiAgfVxuICBzaG9ydGVzdFBhdGhUb1RhYmxlIChvdGhlclRhYmxlKSB7XG4gICAgLy8gRGlqa3N0cmEncyBhbGdvcml0aG0uLi5cbiAgICBjb25zdCB2aXNpdGVkID0ge307XG4gICAgY29uc3QgZGlzdGFuY2VzID0ge307XG4gICAgY29uc3QgcHJldlRhYmxlcyA9IHt9O1xuICAgIGNvbnN0IHZpc2l0ID0gdGFyZ2V0SWQgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0VGFibGUgPSB0aGlzLl9tdXJlLnRhYmxlc1t0YXJnZXRJZF07XG4gICAgICAvLyBPbmx5IGNoZWNrIHRoZSB1bnZpc2l0ZWQgZGVyaXZlZCBhbmQgcGFyZW50IHRhYmxlc1xuICAgICAgY29uc3QgbmVpZ2hib3JMaXN0ID0gT2JqZWN0LmtleXModGFyZ2V0VGFibGUuX2Rlcml2ZWRUYWJsZXMpXG4gICAgICAgIC5jb25jYXQodGFyZ2V0VGFibGUucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS50YWJsZUlkKSlcbiAgICAgICAgLmZpbHRlcih0YWJsZUlkID0+ICF2aXNpdGVkW3RhYmxlSWRdKTtcbiAgICAgIC8vIENoZWNrIGFuZCBhc3NpZ24gKG9yIHVwZGF0ZSkgdGVudGF0aXZlIGRpc3RhbmNlcyB0byBlYWNoIG5laWdoYm9yXG4gICAgICBmb3IgKGNvbnN0IG5laWdoYm9ySWQgb2YgbmVpZ2hib3JMaXN0KSB7XG4gICAgICAgIGlmIChkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIGlmIChkaXN0YW5jZXNbdGFyZ2V0SWRdICsgMSA8IGRpc3RhbmNlc1tuZWlnaGJvcklkXSkge1xuICAgICAgICAgIGRpc3RhbmNlc1tuZWlnaGJvcklkXSA9IGRpc3RhbmNlc1t0YXJnZXRJZF0gKyAxO1xuICAgICAgICAgIHByZXZUYWJsZXNbbmVpZ2hib3JJZF0gPSB0YXJnZXRJZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgdGhpcyB0YWJsZSBpcyBvZmZpY2lhbGx5IHZpc2l0ZWQ7IHRha2UgaXQgb3V0IG9mIHRoZSBydW5uaW5nXG4gICAgICAvLyBmb3IgZnV0dXJlIHZpc2l0cyAvIGNoZWNrc1xuICAgICAgdmlzaXRlZFt0YXJnZXRJZF0gPSB0cnVlO1xuICAgICAgZGVsZXRlIGRpc3RhbmNlc1t0YXJnZXRJZF07XG4gICAgfTtcblxuICAgIC8vIFN0YXJ0IHdpdGggdGhpcyB0YWJsZVxuICAgIHByZXZUYWJsZXNbdGhpcy50YWJsZUlkXSA9IG51bGw7XG4gICAgZGlzdGFuY2VzW3RoaXMudGFibGVJZF0gPSAwO1xuICAgIGxldCB0b1Zpc2l0ID0gT2JqZWN0LmtleXMoZGlzdGFuY2VzKTtcbiAgICB3aGlsZSAodG9WaXNpdC5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBWaXNpdCB0aGUgbmV4dCB0YWJsZSB0aGF0IGhhcyB0aGUgc2hvcnRlc3QgZGlzdGFuY2VcbiAgICAgIHRvVmlzaXQuc29ydCgoYSwgYikgPT4gZGlzdGFuY2VzW2FdIC0gZGlzdGFuY2VzW2JdKTtcbiAgICAgIGxldCBuZXh0SWQgPSB0b1Zpc2l0LnNoaWZ0KCk7XG4gICAgICBpZiAobmV4dElkID09PSBvdGhlclRhYmxlLnRhYmxlSWQpIHtcbiAgICAgICAgLy8gRm91bmQgb3RoZXJUYWJsZSEgU2VuZCBiYWNrIHRoZSBjaGFpbiBvZiBjb25uZWN0ZWQgdGFibGVzXG4gICAgICAgIGNvbnN0IGNoYWluID0gW107XG4gICAgICAgIHdoaWxlIChwcmV2VGFibGVzW25leHRJZF0gIT09IG51bGwpIHtcbiAgICAgICAgICBjaGFpbi51bnNoaWZ0KHRoaXMuX211cmUudGFibGVzW25leHRJZF0pO1xuICAgICAgICAgIG5leHRJZCA9IHByZXZUYWJsZXNbbmV4dElkXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2hhaW47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBWaXNpdCB0aGUgdGFibGVcbiAgICAgICAgdmlzaXQobmV4dElkKTtcbiAgICAgICAgdG9WaXNpdCA9IE9iamVjdC5rZXlzKGRpc3RhbmNlcyk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFdlIGRpZG4ndCBmaW5kIGl0OyB0aGVyZSdzIG5vIGNvbm5lY3Rpb25cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnQWdncmVnYXRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnRXhwYW5kZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBkZWxpbWl0ZXJcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKHsgbGltaXQgfSkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKHsgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJyB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9tdXJlLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDAgfHwgdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbShpdGVtKTtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljRGljdFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB7fTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbShpdGVtKTtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpZXJkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEFnZ3JlZ2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuX2RlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpic7XG4gIH1cbiAgZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSAoYXR0ciwgZnVuYykge1xuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIF91cGRhdGVJdGVtIChvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyhvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0udHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucykge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugc28gdGhhdCBBZ2dyZWdhdGVkVGFibGUgY2FuIHRha2UgYWR2YW50YWdlXG4gICAgLy8gb2YgdGhlIHBhcnRpYWxseS1idWlsdCBjYWNoZSBhcyBpdCBnb2VzLCBhbmQgcG9zdHBvbmUgZmluaXNoaW5nIGl0ZW1zXG4gICAgLy8gdW50aWwgYWZ0ZXIgdGhlIHBhcmVudCB0YWJsZSBoYXMgYmVlbiBmdWxseSBpdGVyYXRlZFxuXG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5faXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3dyYXBwZWRJdGVtLmluZGV4XSA9IHdyYXBwZWRJdGVtO1xuICAgICAgLy8gR28gYWhlYWQgYW5kIHlpZWxkIHRoZSB1bmZpbmlzaGVkIGl0ZW07IHRoaXMgbWFrZXMgaXQgcG9zc2libGUgZm9yXG4gICAgICAvLyBjbGllbnQgYXBwcyB0byBiZSBtb3JlIHJlc3BvbnNpdmUgYW5kIHJlbmRlciBwYXJ0aWFsIHJlc3VsdHMsIGJ1dCBhbHNvXG4gICAgICAvLyBtZWFucyB0aGF0IHRoZXkgbmVlZCB0byB3YXRjaCBmb3Igd3JhcHBlZEl0ZW0ub24oJ3VwZGF0ZScpIGV2ZW50c1xuICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgfVxuXG4gICAgLy8gU2Vjb25kIHBhc3M6IG5vdyB0aGF0IHdlJ3ZlIGNvbXBsZXRlZCB0aGUgZnVsbCBpdGVyYXRpb24gb2YgdGhlIHBhcmVudFxuICAgIC8vIHRhYmxlLCB3ZSBjYW4gZmluaXNoIGVhY2ggaXRlbVxuICAgIGZvciAoY29uc3QgaW5kZXggaW4gdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICBpZiAoIXRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0pIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgICAgZXhpc3RpbmdJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB3cmFwcGVkUGFyZW50LmNvbm5lY3RJdGVtKGV4aXN0aW5nSXRlbSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0oZXhpc3RpbmdJdGVtLCB3cmFwcGVkUGFyZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0obmV3SXRlbSwgbmV3SXRlbSk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0gc3VwZXIuZ2V0QXR0cmlidXRlRGV0YWlscygpO1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwge307XG4gICAgICBhbGxBdHRyc1thdHRyXS5yZWR1Y2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBBZ2dyZWdhdGVkVGFibGU7XG4iLCJjb25zdCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5kdXBsaWNhdGVkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB9XG4gICAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgICAgb2JqLmR1cGxpY2F0ZWRBdHRyaWJ1dGVzID0gdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXM7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBkdXBsaWNhdGVBdHRyaWJ1dGUgKHBhcmVudElkLCBhdHRyaWJ1dGUpIHtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzW3BhcmVudElkXSA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzW3BhcmVudElkXSB8fCBbXTtcbiAgICAgIHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzW3BhcmVudElkXS5wdXNoKGF0dHJpYnV0ZSk7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuICAgIF9kdXBsaWNhdGVBdHRyaWJ1dGVzICh3cmFwcGVkSXRlbSkge1xuICAgICAgZm9yIChjb25zdCBbcGFyZW50SWQsIGF0dHJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICBjb25zdCBwYXJlbnROYW1lID0gdGhpcy5fbXVyZS50YWJsZXNbcGFyZW50SWRdLm5hbWU7XG4gICAgICAgIHdyYXBwZWRJdGVtLnJvd1tgJHtwYXJlbnROYW1lfS4ke2F0dHJ9YF0gPSB3cmFwcGVkSXRlbS5jb25uZWN0ZWRJdGVtc1twYXJlbnRJZF1bMF0ucm93W2F0dHJdO1xuICAgICAgfVxuICAgIH1cbiAgICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICAgIGNvbnN0IGFsbEF0dHJzID0gc3VwZXIuZ2V0QXR0cmlidXRlRGV0YWlscygpO1xuICAgICAgZm9yIChjb25zdCBbcGFyZW50SWQsIGF0dHJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICBjb25zdCBhdHRyTmFtZSA9IGAke3RoaXMuX211cmUudGFibGVzW3BhcmVudElkXS5uYW1lfS4ke2F0dHJ9YDtcbiAgICAgICAgYWxsQXR0cnNbYXR0ck5hbWVdID0gYWxsQXR0cnNbYXR0ck5hbWVdIHx8IHt9O1xuICAgICAgICBhbGxBdHRyc1thdHRyTmFtZV0uY29waWVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhbGxBdHRycztcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgRXhwYW5kZWRUYWJsZSBleHRlbmRzIER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbihTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLmRlbGltaXRlciA9IG9wdGlvbnMuZGVsaW1pdGVyIHx8ICcsJztcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqQnO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgdmFsdWVzID0gKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gfHwgJycpLnNwbGl0KHRoaXMuZGVsaW1pdGVyKTtcbiAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdmFsdWVzKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IHt9O1xuICAgICAgICByb3dbdGhpcy5fYXR0cmlidXRlXSA9IHZhbHVlO1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlcyhuZXdJdGVtKTtcbiAgICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFeHBhbmRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBGYWNldGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5wYXJlbnRUYWJsZS5uYW1lfVske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgaWYgKCh0aGlzLl9hdHRyaWJ1dGUgPT09IG51bGwgJiYgd3JhcHBlZFBhcmVudC5pbmRleCA9PT0gdGhpcy5fdmFsdWUpIHx8XG4gICAgICAgICAgKHRoaXMuX2F0dHJpYnV0ZSAhPT0gbnVsbCAmJiB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkpIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogT2JqZWN0LmFzc2lnbih7fSwgd3JhcHBlZFBhcmVudC5yb3cpLFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIFNwaW4gdGhyb3VnaCBhbGwgb2YgdGhlIHBhcmVudFRhYmxlcyBzbyB0aGF0IHRoZWlyIF9jYWNoZSBpcyBwcmUtYnVpbHRcbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgYXdhaXQgcGFyZW50VGFibGUuY291bnRSb3dzKCk7XG4gICAgfVxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGUpKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pKSB7XG4gICAgICAgIC8vIE5vIG1hdGNoIGluIG9uZSBvZiB0aGUgb3RoZXIgdGFibGVzOyBvbWl0IHRoaXMgaXRlbVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IGFkZCBlYWNoIHBhcmVudCB0YWJsZXMnIGtleXMgYXMgYXR0cmlidXRlIHZhbHVlc1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IHBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSlcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlcyhuZXdJdGVtKTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLl9tdXJlIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBfbXVyZSwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb24gPSBvcHRpb25zLmFubm90YXRpb24gfHwgJyc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uOiB0aGlzLmFubm90YXRpb25cbiAgICB9O1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgIT09IG51bGw7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fCB0aGlzLnRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0SGFzaFRhYmxlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gYXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgdGhpcy5fbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlR2VuZXJpY0NsYXNzIChuZXdUYWJsZSkge1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJ1xuICAgIH0pO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyh0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUsIGRlbGltaXRlcikpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZUdlbmVyaWNDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gICAgdGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHMgPSB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jIHByZXBTaG9ydGVzdEVkZ2VQYXRoIChlZGdlQ2xhc3NJZCkge1xuICAgIGlmICh0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1tlZGdlQ2xhc3NJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW2VkZ2VDbGFzc0lkXTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZWRnZVRhYmxlID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkXS50YWJsZTtcbiAgICAgIGNvbnN0IGlkTGlzdCA9IFtdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZSBvZiB0aGlzLnRhYmxlLnNob3J0ZXN0UGF0aFRvVGFibGUoZWRnZVRhYmxlKSkge1xuICAgICAgICBpZExpc3QucHVzaCh0YWJsZS50YWJsZUlkKTtcbiAgICAgICAgLy8gU3BpbiB0aHJvdWdoIHRoZSB0YWJsZSB0byBtYWtlIHN1cmUgYWxsIGl0cyByb3dzIGFyZSB3cmFwcGVkIGFuZCBjb25uZWN0ZWRcbiAgICAgICAgYXdhaXQgdGFibGUuY291bnRSb3dzKCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1tlZGdlQ2xhc3NJZF0gPSBpZExpc3Q7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RFZGdlUGF0aHNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICAvLyAob3IgYSBmbG9hdGluZyBlZGdlIGlmIGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkIGlzIG51bGwpXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgZWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIC8vIERlbGV0ZSBlYWNoIG9mIHRoZSBlZGdlIGNsYXNzZXNcbiAgICAgIHNvdXJjZUVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICAgIHRhcmdldEVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICB9XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICBkZWxldGUgb3B0aW9ucy5jbGFzc0lkO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICByZXR1cm4gdGhpcy5fbXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGRpcmVjdGVkLCBhdHRyaWJ1dGUsIG90aGVyQXR0cmlidXRlIH0pIHtcbiAgICBjb25zdCB0aGlzSGFzaCA9IHRoaXMuZ2V0SGFzaFRhYmxlKGF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MuZ2V0SGFzaFRhYmxlKG90aGVyQXR0cmlidXRlKTtcbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgZGlyZWN0ZWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3BpY2tFZGdlVGFibGUgKG90aGVyQ2xhc3MpIHtcbiAgICBsZXQgZWRnZVRhYmxlO1xuICAgIGxldCBjaGFpbiA9IHRoaXMudGFibGUuc2hvcnRlc3RQYXRoVG9UYWJsZShvdGhlckNsYXNzLnRhYmxlKTtcbiAgICBpZiAoY2hhaW4gPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5kZXJseWluZyB0YWJsZSBjaGFpbiBiZXR3ZWVuIGVkZ2UgYW5kIG5vZGUgY2xhc3NlcyBpcyBicm9rZW5gKTtcbiAgICB9IGVsc2UgaWYgKGNoYWluLmxlbmd0aCA8PSAyKSB7XG4gICAgICAvLyBXZWlyZCBjb3JuZXIgY2FzZSB3aGVyZSB3ZSdyZSB0cnlpbmcgdG8gY3JlYXRlIGFuIGVkZ2UgYmV0d2VlblxuICAgICAgLy8gYWRqYWNlbnQgb3IgaWRlbnRpY2FsIHRhYmxlcy4uLiBjcmVhdGUgYSBDb25uZWN0ZWRUYWJsZVxuICAgICAgZWRnZVRhYmxlID0gdGhpcy50YWJsZS5jb25uZWN0KG90aGVyQ2xhc3MudGFibGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgYSB0YWJsZSBpbiB0aGUgbWlkZGxlOyBwcmlvcml0aXplIFN0YXRpY1RhYmxlIGFuZCBTdGF0aWNEaWN0VGFibGVcbiAgICAgIGxldCBzdGF0aWNFeGlzdHMgPSBmYWxzZTtcbiAgICAgIGNoYWluID0gY2hhaW4uc2xpY2UoMSwgY2hhaW4ubGVuZ3RoIC0gMSkubWFwKCh0YWJsZSwgZGlzdCkgPT4ge1xuICAgICAgICBzdGF0aWNFeGlzdHMgPSBzdGF0aWNFeGlzdHMgfHwgdGFibGUudHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgcmV0dXJuIHsgdGFibGUsIGRpc3QgfTtcbiAgICAgIH0pO1xuICAgICAgaWYgKHN0YXRpY0V4aXN0cykge1xuICAgICAgICBjaGFpbiA9IGNoYWluLmZpbHRlcigoeyB0YWJsZSB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWRnZVRhYmxlID0gY2hhaW5bMF0udGFibGU7XG4gICAgfVxuICAgIHJldHVybiBlZGdlVGFibGU7XG4gIH1cbiAgYXN5bmMgcHJlcFNob3J0ZXN0U291cmNlUGF0aCAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlZFNob3J0ZXN0U291cmNlUGF0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fc291cmNlQ2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHNvdXJjZVRhYmxlID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0udGFibGU7XG4gICAgICBjb25zdCBpZExpc3QgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGhpcy50YWJsZS5zaG9ydGVzdFBhdGhUb1RhYmxlKHNvdXJjZVRhYmxlKSkge1xuICAgICAgICBpZExpc3QucHVzaCh0YWJsZS50YWJsZUlkKTtcbiAgICAgICAgLy8gU3BpbiB0aHJvdWdoIHRoZSB0YWJsZSB0byBtYWtlIHN1cmUgYWxsIGl0cyByb3dzIGFyZSB3cmFwcGVkIGFuZCBjb25uZWN0ZWRcbiAgICAgICAgYXdhaXQgdGFibGUuY291bnRSb3dzKCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGggPSBpZExpc3Q7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkU2hvcnRlc3RTb3VyY2VQYXRoO1xuICAgIH1cbiAgfVxuICBhc3luYyBwcmVwU2hvcnRlc3RUYXJnZXRQYXRoICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVkU2hvcnRlc3RUYXJnZXRQYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGg7XG4gICAgfSBlbHNlIGlmICh0aGlzLl90YXJnZXRDbGFzc0lkID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGFyZ2V0VGFibGUgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXS50YWJsZTtcbiAgICAgIGNvbnN0IGlkTGlzdCA9IFtdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZSBvZiB0aGlzLnRhYmxlLnNob3J0ZXN0UGF0aFRvVGFibGUodGFyZ2V0VGFibGUpKSB7XG4gICAgICAgIGlkTGlzdC5wdXNoKHRhYmxlLnRhYmxlSWQpO1xuICAgICAgICAvLyBTcGluIHRocm91Z2ggdGhlIHRhYmxlIHRvIG1ha2Ugc3VyZSBhbGwgaXRzIHJvd3MgYXJlIHdyYXBwZWQgYW5kIGNvbm5lY3RlZFxuICAgICAgICBhd2FpdCB0YWJsZS5jb3VudFJvd3MoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NhY2hlZFNob3J0ZXN0VGFyZ2V0UGF0aCA9IGlkTGlzdDtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGg7XG4gICAgfVxuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGVsZXRlKCk7XG4gICAgdGVtcC50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgZGVsZXRlIHRlbXAuY2xhc3NJZDtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IGVkZ2VUYWJsZSA9IHRoaXMuX3BpY2tFZGdlVGFibGUoc291cmNlQ2xhc3MpO1xuICAgICAgY29uc3Qgc291cmNlRWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgICB0YWJsZUlkOiBlZGdlVGFibGUudGFibGVJZCxcbiAgICAgICAgZGlyZWN0ZWQ6IHRlbXAuZGlyZWN0ZWQsXG4gICAgICAgIHNvdXJjZUNsYXNzSWQ6IHRlbXAuc291cmNlQ2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWRcbiAgICAgIH0pO1xuICAgICAgc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICBuZXdOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3NvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0ZW1wLnRhcmdldENsYXNzSWQgJiYgdGVtcC5zb3VyY2VDbGFzc0lkICE9PSB0ZW1wLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgICBjb25zdCBlZGdlVGFibGUgPSB0aGlzLl9waWNrRWRnZVRhYmxlKHRhcmdldENsYXNzKTtcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlLnRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogdGVtcC50YXJnZXRDbGFzc0lkXG4gICAgICB9KTtcbiAgICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbikge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmIChkaXJlY3Rpb24gIT09ICdzb3VyY2UnICYmIGRpcmVjdGlvbiAhPT0gJ3RhcmdldCcpIHtcbiAgICAgIGRpcmVjdGlvbiA9IHRoaXMudGFyZ2V0Q2xhc3NJZCA9PT0gbnVsbCA/ICd0YXJnZXQnIDogJ3NvdXJjZSc7XG4gICAgfVxuICAgIGlmIChkaXJlY3Rpb24gPT09ICd0YXJnZXQnKSB7XG4gICAgICB0aGlzLmNvbm5lY3RUYXJnZXQoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZSh7IG5vZGVDbGFzcywgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KTtcbiAgICB9XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIHRvZ2dsZU5vZGVEaXJlY3Rpb24gKHNvdXJjZUNsYXNzSWQpIHtcbiAgICBpZiAoIXNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IHN3YXAgdG8gdW5jb25uZWN0ZWQgY2xhc3MgaWQ6ICR7c291cmNlQ2xhc3NJZH1gKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgdGVtcCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbCxcbiAgICBza2lwU2F2ZSA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLmdldEhhc2hUYWJsZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyBzb3VyY2VDbGFzcy50YWJsZSA6IHNvdXJjZUNsYXNzLmdldEhhc2hUYWJsZShub2RlQXR0cmlidXRlKTtcbiAgICBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pO1xuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNraXBTYXZlID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMuZ2V0SGFzaFRhYmxlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRhcmdldENsYXNzLnRhYmxlIDogdGFyZ2V0Q2xhc3MuZ2V0SGFzaFRhYmxlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSk7XG5cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKHsgc2tpcFNhdmUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuX2NhY2hlZFNob3J0ZXN0RWRnZVBhdGhzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGg7XG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1RhcmdldENsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1RhcmdldENsYXNzLl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRoc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVkU2hvcnRlc3RUYXJnZXRQYXRoO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLnRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGFuZCB0YWJsZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc09iaiA9IG9wdGlvbnMuY2xhc3NPYmogfHwgbnVsbDtcbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSBvcHRpb25zLmNvbm5lY3RlZEl0ZW1zIHx8IHt9O1xuICB9XG4gIGNvbm5lY3RJdGVtIChpdGVtKSB7XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdIHx8IFtdO1xuICAgIGlmICh0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0uaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgKiBpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgaWYgKHRhYmxlSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgeWllbGQgKiAodGhpcy5jb25uZWN0ZWRJdGVtc1t0YWJsZUlkc1swXV0gfHwgW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0aGlzVGFibGVJZCA9IHRhYmxlSWRzWzBdO1xuICAgICAgY29uc3QgcmVtYWluaW5nVGFibGVJZHMgPSB0YWJsZUlkcy5zbGljZSgxKTtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmNvbm5lY3RlZEl0ZW1zW3RoaXNUYWJsZUlkXSB8fCBbXSkge1xuICAgICAgICB5aWVsZCAqIGl0ZW0uaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHJlbWFpbmluZ1RhYmxlSWRzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAoeyBsaW1pdCA9IEluZmluaXR5IH0gPSB7fSkge1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzKSkge1xuICAgICAgY29uc3QgdGFibGVJZENoYWluID0gYXdhaXQgdGhpcy5jbGFzc09iai5wcmVwU2hvcnRlc3RFZGdlUGF0aChlZGdlQ2xhc3NJZCk7XG4gICAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRDaGFpbik7XG4gICAgICBsZXQgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIHdoaWxlICghdGVtcC5kb25lICYmIGkgPCBsaW1pdCkge1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgICBpKys7XG4gICAgICAgIHRlbXAgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgICB9XG4gICAgICBpZiAoaSA+PSBsaW1pdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBzb3VyY2VOb2RlcyAoeyBsaW1pdCA9IEluZmluaXR5IH0gPSB7fSkge1xuICAgIGNvbnN0IHRhYmxlSWRDaGFpbiA9IGF3YWl0IHRoaXMuY2xhc3NPYmoucHJlcFNob3J0ZXN0U291cmNlUGF0aCgpO1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZENoYWluKTtcbiAgICBsZXQgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUgJiYgaSA8IGxpbWl0KSB7XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgaSsrO1xuICAgICAgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiB0YXJnZXROb2RlcyAoeyBsaW1pdCA9IEluZmluaXR5IH0gPSB7fSkge1xuICAgIGNvbnN0IHRhYmxlSWRDaGFpbiA9IGF3YWl0IHRoaXMuY2xhc3NPYmoucHJlcFNob3J0ZXN0VGFyZ2V0UGF0aCgpO1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZENoYWluKTtcbiAgICBsZXQgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUgJiYgaSA8IGxpbWl0KSB7XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgaSsrO1xuICAgICAgdGVtcCA9IGl0ZXJhdG9yLm5leHQoKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJjbGFzcyBJbk1lbW9yeUluZGV4IHtcbiAgY29uc3RydWN0b3IgKHsgZW50cmllcyA9IHt9LCBjb21wbGV0ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXM7XG4gICAgdGhpcy5jb21wbGV0ZSA9IGNvbXBsZXRlO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzO1xuICB9XG4gIGFzeW5jICogaXRlckVudHJpZXMgKCkge1xuICAgIGZvciAoY29uc3QgW2hhc2gsIHZhbHVlTGlzdF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgeyBoYXNoLCB2YWx1ZUxpc3QgfTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVySGFzaGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IGhhc2ggb2YgT2JqZWN0LmtleXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgaGFzaDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyVmFsdWVMaXN0cyAoKSB7XG4gICAgZm9yIChjb25zdCB2YWx1ZUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB2YWx1ZUxpc3Q7XG4gICAgfVxuICB9XG4gIGFzeW5jIGdldFZhbHVlTGlzdCAoaGFzaCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXNbaGFzaF0gfHwgW107XG4gIH1cbiAgYXN5bmMgYWRkVmFsdWUgKGhhc2gsIHZhbHVlKSB7XG4gICAgLy8gVE9ETzogYWRkIHNvbWUga2luZCBvZiB3YXJuaW5nIGlmIHRoaXMgaXMgZ2V0dGluZyBiaWc/XG4gICAgdGhpcy5lbnRyaWVzW2hhc2hdID0gYXdhaXQgdGhpcy5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgaWYgKHRoaXMuZW50cmllc1toYXNoXS5pbmRleE9mKHZhbHVlKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuZW50cmllc1toYXNoXS5wdXNoKHZhbHVlKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluTWVtb3J5SW5kZXg7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IHNoYTEgZnJvbSAnc2hhMSc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuL1RhYmxlcy9UYWJsZXMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcbmltcG9ydCAqIGFzIElOREVYRVMgZnJvbSAnLi9JbmRleGVzL0luZGV4ZXMuanMnO1xuXG5sZXQgTkVYVF9DTEFTU19JRCA9IDE7XG5sZXQgTkVYVF9UQUJMRV9JRCA9IDE7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIGVpdGhlciB3aW5kb3cubG9jYWxTdG9yYWdlIG9yIG51bGxcbiAgICB0aGlzLm1pbWUgPSBtaW1lOyAvLyBleHBvc2UgYWNjZXNzIHRvIG1pbWUgbGlicmFyeSwgc2luY2Ugd2UncmUgYnVuZGxpbmcgaXQgYW55d2F5XG5cbiAgICB0aGlzLmRlYnVnID0gZmFsc2U7IC8vIFNldCBtdXJlLmRlYnVnIHRvIHRydWUgdG8gZGVidWcgc3RyZWFtc1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UQUJMRVMgPSBUQUJMRVM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHsgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbTsgfSxcbiAgICAgIGtleTogZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKCF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICAhd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50IHx8XG4gICAgICAgICAgICB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR3JhbmRwYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIHtcbiAgICAgICAgICBsZWZ0OiB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICByaWdodDogb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMudGFibGVzID0gdGhpcy5oeWRyYXRlKCdtdXJlX3RhYmxlcycsIHRoaXMuVEFCTEVTKTtcbiAgICBORVhUX1RBQkxFX0lEID0gT2JqZWN0LmtleXModGhpcy50YWJsZXMpXG4gICAgICAucmVkdWNlKChoaWdoZXN0TnVtLCB0YWJsZUlkKSA9PiB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heChoaWdoZXN0TnVtLCBwYXJzZUludCh0YWJsZUlkLm1hdGNoKC90YWJsZShcXGQqKS8pWzFdKSk7XG4gICAgICB9LCAwKSArIDE7XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBvdXIgY2xhc3Mgc3BlY2lmaWNhdGlvbnNcbiAgICB0aGlzLmNsYXNzZXMgPSB0aGlzLmh5ZHJhdGUoJ211cmVfY2xhc3NlcycsIHRoaXMuQ0xBU1NFUyk7XG4gICAgTkVYVF9DTEFTU19JRCA9IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NlcylcbiAgICAgIC5yZWR1Y2UoKGhpZ2hlc3ROdW0sIGNsYXNzSWQpID0+IHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KGhpZ2hlc3ROdW0sIHBhcnNlSW50KGNsYXNzSWQubWF0Y2goL2NsYXNzKFxcZCopLylbMV0pKTtcbiAgICAgIH0sIDApICsgMTtcbiAgfVxuXG4gIHNhdmVUYWJsZXMgKCkge1xuICAgIHRoaXMuZGVoeWRyYXRlKCdtdXJlX3RhYmxlcycsIHRoaXMudGFibGVzKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3RhYmxlVXBkYXRlJyk7XG4gIH1cbiAgc2F2ZUNsYXNzZXMgKCkge1xuICAgIHRoaXMuZGVoeWRyYXRlKCdtdXJlX2NsYXNzZXMnLCB0aGlzLmNsYXNzZXMpO1xuICAgIHRoaXMudHJpZ2dlcignY2xhc3NVcGRhdGUnKTtcbiAgfVxuXG4gIGh5ZHJhdGUgKHN0b3JhZ2VLZXksIFRZUEVTKSB7XG4gICAgbGV0IGNvbnRhaW5lciA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oc3RvcmFnZUtleSk7XG4gICAgY29udGFpbmVyID0gY29udGFpbmVyID8gSlNPTi5wYXJzZShjb250YWluZXIpIDoge307XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgY29uc3QgdHlwZSA9IHZhbHVlLnR5cGU7XG4gICAgICBkZWxldGUgdmFsdWUudHlwZTtcbiAgICAgIHZhbHVlLm11cmUgPSB0aGlzO1xuICAgICAgY29udGFpbmVyW2tleV0gPSBuZXcgVFlQRVNbdHlwZV0odmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9XG4gIGRlaHlkcmF0ZSAoc3RvcmFnZUtleSwgY29udGFpbmVyKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNvbnRhaW5lcikpIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgICAgcmVzdWx0W2tleV0udHlwZSA9IHZhbHVlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKHN0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KHJlc3VsdCkpO1xuICAgIH1cbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIG5ldyBGdW5jdGlvbihgcmV0dXJuICR7c3RyaW5naWZpZWRGdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgfVxuICBkZWh5ZHJhdGVGdW5jdGlvbiAoZnVuYykge1xuICAgIGxldCBzdHJpbmdpZmllZEZ1bmMgPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgLy8gSXN0YW5idWwgYWRkcyBzb21lIGNvZGUgdG8gZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgY292ZXJhZ2UsIHRoYXQgZ2V0c1xuICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3R3YXJsb3N0L2lzdGFuYnVsL2lzc3Vlcy8zMTAjaXNzdWVjb21tZW50LTI3NDg4OTAyMlxuICAgIHN0cmluZ2lmaWVkRnVuYyA9IHN0cmluZ2lmaWVkRnVuYy5yZXBsYWNlKC9jb3ZfKC4rPylcXCtcXCtbLDtdPy9nLCAnJyk7XG4gICAgcmV0dXJuIHN0cmluZ2lmaWVkRnVuYztcbiAgfVxuXG4gIGNyZWF0ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zLnRhYmxlSWQpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7TkVYVF9UQUJMRV9JRH1gO1xuICAgICAgTkVYVF9UQUJMRV9JRCArPSAxO1xuICAgIH1cbiAgICBjb25zdCBUeXBlID0gdGhpcy5UQUJMRVNbb3B0aW9ucy50eXBlXTtcbiAgICBkZWxldGUgb3B0aW9ucy50eXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSA9IG5ldyBUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdO1xuICB9XG4gIGNyZWF0ZUNsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYGVtcHR5YCB9KSB7XG4gICAgaWYgKCFvcHRpb25zLmNsYXNzSWQpIHtcbiAgICAgIG9wdGlvbnMuY2xhc3NJZCA9IGBjbGFzcyR7TkVYVF9DTEFTU19JRH1gO1xuICAgICAgTkVYVF9DTEFTU19JRCArPSAxO1xuICAgIH1cbiAgICBjb25zdCBUeXBlID0gdGhpcy5DTEFTU0VTW29wdGlvbnMudHlwZV07XG4gICAgZGVsZXRlIG9wdGlvbnMudHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IFR5cGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG5cbiAgbmV3VGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZU9iaiA9IHRoaXMuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5zYXZlVGFibGVzKCk7XG4gICAgcmV0dXJuIG5ld1RhYmxlT2JqO1xuICB9XG4gIG5ld0NsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3Q2xhc3NPYmogPSB0aGlzLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3Q2xhc3NPYmo7XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNUYWJsZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHk7IHRyeSBhZGREeW5hbWljVGFibGUoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY1RhYmxlKHtcbiAgICAgIG5hbWU6IGZpbGVPYmoubmFtZSxcbiAgICAgIGV4dGVuc2lvbjogZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24oZmlsZU9iai50eXBlKSxcbiAgICAgIHRleHRcbiAgICB9KTtcbiAgfVxuICBhZGRTdHJpbmdBc1N0YXRpY1RhYmxlICh7IG5hbWUsIGV4dGVuc2lvbiA9ICd0eHQnLCB0ZXh0IH0pIHtcbiAgICBsZXQgZGF0YSwgYXR0cmlidXRlcztcbiAgICBpZiAodGhpcy5EQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgZGF0YSA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZSh7IG5hbWUsIGRhdGEsIGF0dHJpYnV0ZXMgfSk7XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLm5ld1RhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHsgdGhpcy50YWJsZXNbdGFibGVJZF0uZGVsZXRlKCk7IH0gY2F0Y2ggKGVycikge31cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZGVsZXRlQWxsQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzT2JqLmRlbGV0ZSgpO1xuICAgIH1cbiAgfVxuICBnZXRDbGFzc0RhdGEgKCkge1xuICAgIGNvbnN0IHJlc3VsdHMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgcmVzdWx0c1tjbGFzc09iai5jbGFzc0lkXSA9IGNsYXNzT2JqLmN1cnJlbnREYXRhO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCBGaWxlUmVhZGVyIGZyb20gJ2ZpbGVyZWFkZXInO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKEZpbGVSZWFkZXIsIG51bGwpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImZvckVhY2giLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJPYmplY3QiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIlRhYmxlIiwib3B0aW9ucyIsIl9tdXJlIiwibXVyZSIsInRhYmxlSWQiLCJFcnJvciIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3N1cHByZXNzZWRBdHRyaWJ1dGVzIiwic3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJfc3VwcHJlc3NJbmRleCIsInN1cHByZXNzSW5kZXgiLCJfaW5kZXhTdWJGaWx0ZXIiLCJpbmRleFN1YkZpbHRlciIsIl9hdHRyaWJ1dGVTdWJGaWx0ZXJzIiwiYXR0cmlidXRlU3ViRmlsdGVycyIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwidXNlZEJ5Q2xhc3NlcyIsIl91c2VkQnlDbGFzc2VzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwibmFtZSIsIml0ZXJhdGUiLCJyZXNldCIsIl9jYWNoZSIsImxpbWl0IiwidW5kZWZpbmVkIiwiSW5maW5pdHkiLCJ2YWx1ZXMiLCJzbGljZSIsIl9idWlsZENhY2hlIiwiX3BhcnRpYWxDYWNoZSIsImRlcml2ZWRUYWJsZSIsImNvdW50Um93cyIsImtleXMiLCJsZW5ndGgiLCJjb3VudCIsIml0ZXJhdG9yIiwibmV4dCIsImRvbmUiLCJfaXRlcmF0ZSIsImNvbXBsZXRlZCIsIl9maW5pc2hJdGVtIiwid3JhcHBlZEl0ZW0iLCJyb3ciLCJrZWVwIiwiZGlzY29ubmVjdCIsIl93cmFwIiwidGFibGUiLCJjbGFzc09iaiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJvdGhlckl0ZW0iLCJpdGVtc1RvQ29ubmVjdCIsImNvbm5lY3RJdGVtIiwiZ2V0QXR0cmlidXRlRGV0YWlscyIsImFsbEF0dHJzIiwiZXhwZWN0ZWQiLCJvYnNlcnZlZCIsImRlcml2ZWQiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJjdXJyZW50RGF0YSIsImRhdGEiLCJjb21wbGV0ZSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsInN1cHByZXNzQXR0cmlidXRlIiwiYWRkU3ViRmlsdGVyIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsInNhdmVUYWJsZXMiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGVJZCIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwidGFibGVzIiwic2hvcnRlc3RQYXRoVG9UYWJsZSIsIm90aGVyVGFibGUiLCJ2aXNpdGVkIiwiZGlzdGFuY2VzIiwicHJldlRhYmxlcyIsInZpc2l0IiwidGFyZ2V0SWQiLCJ0YXJnZXRUYWJsZSIsIm5laWdoYm9yTGlzdCIsImNvbmNhdCIsInBhcmVudFRhYmxlcyIsIm1hcCIsInBhcmVudFRhYmxlIiwiZmlsdGVyIiwibmVpZ2hib3JJZCIsInRvVmlzaXQiLCJzb3J0IiwiYSIsImIiLCJuZXh0SWQiLCJzaGlmdCIsImNoYWluIiwidW5zaGlmdCIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsImRlbGltaXRlciIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0IiwiY2xhc3NlcyIsInJlZHVjZSIsImFnZyIsImRlbGV0ZSIsImV4ZWMiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJpdGVtIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQWdncmVnYXRlZFRhYmxlIiwiX2F0dHJpYnV0ZSIsIl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJyZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJfZGVoeWRyYXRlRnVuY3Rpb24iLCJkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIiwiX3VwZGF0ZUl0ZW0iLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwibmV3V3JhcHBlZEl0ZW0iLCJ3cmFwcGVkUGFyZW50IiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsInJlZHVjZWQiLCJEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfaW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9kdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlQXR0cmlidXRlIiwicGFyZW50SWQiLCJfZHVwbGljYXRlQXR0cmlidXRlcyIsInBhcmVudE5hbWUiLCJjb25uZWN0ZWRJdGVtcyIsImF0dHJOYW1lIiwiY29waWVkIiwiRXhwYW5kZWRUYWJsZSIsInNwbGl0IiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb24iLCJzZXRDbGFzc05hbWUiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJnZXRIYXNoVGFibGUiLCJpbnRlcnByZXRBc05vZGVzIiwibmV3Q2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiX2Rlcml2ZUdlbmVyaWNDbGFzcyIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc0lkcyIsIl9jYWNoZWRTaG9ydGVzdEVkZ2VQYXRocyIsIk5vZGVXcmFwcGVyIiwicHJlcFNob3J0ZXN0RWRnZVBhdGgiLCJlZGdlQ2xhc3NJZCIsImVkZ2VUYWJsZSIsImlkTGlzdCIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNyZWF0ZUNsYXNzIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibm9kZUNsYXNzIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJFZGdlQ2xhc3MiLCJFZGdlV3JhcHBlciIsIl9waWNrRWRnZVRhYmxlIiwib3RoZXJDbGFzcyIsInN0YXRpY0V4aXN0cyIsImRpc3QiLCJzdGFydHNXaXRoIiwicHJlcFNob3J0ZXN0U291cmNlUGF0aCIsIl9jYWNoZWRTaG9ydGVzdFNvdXJjZVBhdGgiLCJfc291cmNlQ2xhc3NJZCIsInNvdXJjZVRhYmxlIiwicHJlcFNob3J0ZXN0VGFyZ2V0UGF0aCIsIl9jYWNoZWRTaG9ydGVzdFRhcmdldFBhdGgiLCJfdGFyZ2V0Q2xhc3NJZCIsIm5ld05vZGVDbGFzcyIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJkaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImNvbm5lY3RUYXJnZXQiLCJjb25uZWN0U291cmNlIiwidG9nZ2xlTm9kZURpcmVjdGlvbiIsInNraXBTYXZlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiaXRlbUxpc3QiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsInRoaXNUYWJsZUlkIiwicmVtYWluaW5nVGFibGVJZHMiLCJlZGdlcyIsInRhYmxlSWRDaGFpbiIsInNvdXJjZU5vZGVzIiwidGFyZ2V0Tm9kZXMiLCJJbk1lbW9yeUluZGV4IiwidG9SYXdPYmplY3QiLCJpdGVyRW50cmllcyIsImhhc2giLCJ2YWx1ZUxpc3QiLCJpdGVySGFzaGVzIiwiaXRlclZhbHVlTGlzdHMiLCJnZXRWYWx1ZUxpc3QiLCJhZGRWYWx1ZSIsIk5FWFRfQ0xBU1NfSUQiLCJORVhUX1RBQkxFX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiZGVidWciLCJEQVRBTElCX0ZPUk1BVFMiLCJUQUJMRVMiLCJDTEFTU0VTIiwiSU5ERVhFUyIsIk5BTUVEX0ZVTkNUSU9OUyIsImlkZW50aXR5IiwicmF3SXRlbSIsImtleSIsIlR5cGVFcnJvciIsInBhcmVudFR5cGUiLCJkZWZhdWx0RmluaXNoIiwidGhpc1dyYXBwZWRJdGVtIiwib3RoZXJXcmFwcGVkSXRlbSIsImxlZnQiLCJyaWdodCIsInNoYTEiLCJKU09OIiwic3RyaW5naWZ5Iiwibm9vcCIsImh5ZHJhdGUiLCJoaWdoZXN0TnVtIiwiTWF0aCIsIm1heCIsInBhcnNlSW50IiwibWF0Y2giLCJkZWh5ZHJhdGUiLCJzdG9yYWdlS2V5IiwiVFlQRVMiLCJjb250YWluZXIiLCJnZXRJdGVtIiwicGFyc2UiLCJzZXRJdGVtIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIlR5cGUiLCJzZWxlY3RvciIsIm5ld1RhYmxlT2JqIiwibmV3Q2xhc3NPYmoiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJlcnIiLCJkZWxldGVBbGxDbGFzc2VzIiwiZ2V0Q2xhc3NEYXRhIiwicmVzdWx0cyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QkMsdUJBQXZCLEVBQWdEO1VBQzVDLENBQUMsS0FBS0wsYUFBTCxDQUFtQkcsU0FBbkIsQ0FBTCxFQUFvQzthQUM3QkgsYUFBTCxDQUFtQkcsU0FBbkIsSUFBZ0MsRUFBaEM7OztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtMLGFBQUwsQ0FBbUJHLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsTUFBb0QsQ0FBQyxDQUF6RCxFQUE0RDs7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
