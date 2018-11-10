import mime from 'mime-types';
import datalib from 'datalib';
import sha1 from 'sha1';
import TriggerableMixin from './Common/TriggerableMixin.js';
import * as TABLES from './Tables/Tables.js';
import * as CLASSES from './Classes/Classes.js';
import * as WRAPPERS from './Wrappers/Wrappers.js';
import * as INDEXES from './Indexes/Indexes.js';

let NEXT_CLASS_ID = 1;
let NEXT_TABLE_ID = 1;

class Origraph extends TriggerableMixin(class {}) {
  constructor (FileReader, localStorage) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node
    this.localStorage = localStorage; // either window.localStorage or null
    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set origraph.debug to true to debug streams

    this.plugins = {};

    // extensions that we want datalib to handle
    this.DATALIB_FORMATS = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv',
      'topojson': 'topojson',
      'treejson': 'treejson'
    };

    // Access to core classes via the main library helps avoid circular imports
    this.TABLES = TABLES;
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;
    this.INDEXES = INDEXES;

    // Default named functions
    this.NAMED_FUNCTIONS = {
      identity: function * (wrappedItem) { yield wrappedItem.rawItem; },
      key: function * (wrappedItem) {
        if (!wrappedItem.wrappedParent ||
            !wrappedItem.wrappedParent.wrappedParent ||
            typeof wrappedItem.wrappedParent.wrappedParent.rawItem !== 'object') {
          throw new TypeError(`Grandparent is not an object / array`);
        }
        const parentType = typeof wrappedItem.wrappedParent.rawItem;
        if (!(parentType === 'number' || parentType === 'string')) {
          throw new TypeError(`Parent isn't a key / index`);
        } else {
          yield wrappedItem.wrappedParent.rawItem;
        }
      },
      defaultFinish: function * (thisWrappedItem, otherWrappedItem) {
        yield {
          left: thisWrappedItem.rawItem,
          right: otherWrappedItem.rawItem
        };
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    };

    // Object containing each of our data sources
    this.tables = this.hydrate('origraph_tables', this.TABLES);
    NEXT_TABLE_ID = Object.keys(this.tables)
      .reduce((highestNum, tableId) => {
        return Math.max(highestNum, parseInt(tableId.match(/table(\d*)/)[1]));
      }, 0) + 1;

    // Object containing our class specifications
    this.classes = this.hydrate('origraph_classes', this.CLASSES);
    NEXT_CLASS_ID = Object.keys(this.classes)
      .reduce((highestNum, classId) => {
        return Math.max(highestNum, parseInt(classId.match(/class(\d*)/)[1]));
      }, 0) + 1;
  }

  saveTables () {
    this.dehydrate('origraph_tables', this.tables);
    this.trigger('tableUpdate');
  }
  saveClasses () {
    this.dehydrate('origraph_classes', this.classes);
    this.trigger('classUpdate');
  }

  hydrate (storageKey, TYPES) {
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
  dehydrate (storageKey, container) {
    if (this.localStorage) {
      const result = {};
      for (const [key, value] of Object.entries(container)) {
        result[key] = value._toRawObject();
        result[key].type = value.constructor.name;
      }
      this.localStorage.setItem(storageKey, JSON.stringify(result));
    }
  }
  hydrateFunction (stringifiedFunc) {
    new Function(`return ${stringifiedFunc}`)(); // eslint-disable-line no-new-func
  }
  dehydrateFunction (func) {
    let stringifiedFunc = func.toString();
    // Istanbul adds some code to functions for computing coverage, that gets
    // included in the stringification process during testing. See:
    // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022
    stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
    return stringifiedFunc;
  }

  createTable (options) {
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
  createClass (options = { selector: `empty` }) {
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

  newTable (options) {
    const newTableObj = this.createTable(options);
    this.saveTables();
    return newTableObj;
  }
  newClass (options) {
    const newClassObj = this.createClass(options);
    this.saveClasses();
    return newClassObj;
  }

  async addFileAsStaticTable ({
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
    }
    // extensionOverride allows things like topojson or treejson (that don't
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
  addStringAsStaticTable ({ name, extension = 'txt', text }) {
    let data, attributes;
    if (this.DATALIB_FORMATS[extension]) {
      data = datalib.read(text, { type: extension });
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
    return this.addStaticTable({ name, data, attributes });
  }
  addStaticTable (options) {
    options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDictTable';
    let newTable = this.newTable(options);
    return this.newClass({
      type: 'GenericClass',
      name: options.name,
      tableId: newTable.tableId
    });
  }
  deleteAllUnusedTables () {
    for (const tableId in this.tables) {
      if (this.tables[tableId]) {
        try { this.tables[tableId].delete(); } catch (err) {}
      }
    }
  }
  deleteAllClasses () {
    for (const classObj of Object.values(this.classes)) {
      classObj.delete();
    }
  }
  getClassData () {
    const results = {};
    for (const classObj of Object.values(this.classes)) {
      results[classObj.classId] = classObj.currentData;
    }
  }
  registerPlugin (name, plugin) {
    this.plugins[name] = plugin;
  }
  getNetworkModelGraph (includeDummies = false) {
    const edgeClasses = [];
    let graph = {
      classes: [],
      classLookup: {},
      connections: [],
      connectionLookup: {}
    };

    const classList = Object.values(this.classes);

    for (const classObj of classList) {
      // Add and index the class as a node
      graph.classLookup[classObj.classId] = graph.classes.length;
      const classSpec = classObj._toRawObject();
      classSpec.type = classObj.constructor.name;
      graph.classes.push(classSpec);

      if (classObj.type === 'Edge') {
        // Store the edge class so we can create connections later
        edgeClasses.push(classObj);
      } else if (classObj.type === 'Node' && includeDummies) {
        // Create a "potential" connection + dummy node
        graph.connections.push({
          id: `${classObj.classID}>dummy`,
          source: graph.classes.length,
          target: graph.classes.length,
          directed: false,
          location: 'node',
          dummy: true
        });
        graph.nodes.push({ dummy: true });
      }

      // Create existing connections
      edgeClasses.forEach(edgeClass => {
        if (edgeClass.sourceClassId !== null) {
          // Connect the source node class to the edge class
          graph.connections.push({
            id: `${edgeClass.sourceClassId}>${edgeClass.classId}`,
            source: graph.classLookup[edgeClass.sourceClassId],
            target: graph.classLookup[edgeClass.classId],
            directed: edgeClass.directed,
            location: 'source'
          });
        } else if (includeDummies) {
          // Create a "potential" connection + dummy source class
          graph.connections.push({
            id: `dummy>${edgeClass.classId}`,
            source: graph.classes.length,
            target: graph.classLookup[edgeClass.classId],
            directed: edgeClass.directed,
            location: 'source',
            dummy: true
          });
          graph.classes.push({ dummy: true });
        }
        if (edgeClass.targetClassId !== null) {
          // Connect the edge class to the target node class
          graph.connections.push({
            id: `${edgeClass.classId}>${edgeClass.targetClassId}`,
            source: graph.classLookup[edgeClass.classId],
            target: graph.classLookup[edgeClass.targetClassId],
            directed: edgeClass.directed,
            location: 'target'
          });
        } else if (includeDummies) {
          // Create a "potential" connection + dummy target class
          graph.connections.push({
            id: `${edgeClass.classId}>dummy`,
            source: graph.classLookup[edgeClass.classId],
            target: graph.classes.length,
            directed: edgeClass.directed,
            location: 'target',
            dummy: true
          });
          graph.classes.push({ dummy: true });
        }
      });
    }

    Object.entries(this.classes).forEach(([selector, classObj]) => {
      // Add and index the class as a node
      graph.classLookup[classObj.classId] = graph.nodes.length;
      graph.nodes.push({ classObj });
      if (classObj.type === 'Edge') {
        // Store the edge class so we can create connections later
        edgeClasses.push(classObj);
      } else if (classObj.type === 'Node') {
        // Create a "potential" connection + dummy node
        graph.edges.push({
          id: `${classObj.classId}>dummy`,
          source: graph.nodes.length - 1,
          target: graph.nodes.length,
          directed: false,
          location: 'node',
          dummy: true
        });
        graph.nodes.push({ dummy: true });
      }
    });

    return graph;
  }
  getTableDependencyGraph () {
    const graph = {
      tables: [],
      tableLookup: {},
      tableLinks: [],
      tableLinkLookup: {}
    };
    const tableList = Object.values(this.tables);
    for (const table of tableList) {
      const tableSpec = table._toRawObject();
      tableSpec.type = table.constructor.name;
      graph.tableLookup[table.tableId] = graph.tables.length;
      graph.tables.push(tableSpec);
    }
    // Fill the graph with links based on parentTables...
    for (const table of tableList) {
      for (const parentTable of table.parentTables) {
        graph.tableLinkLookup[parentTable.tableId + table.tableId] =
          graph.tableLinks.length;
        graph.tableLinks.push({
          source: graph.tableLookup[parentTable.tableId],
          target: graph.tableLookup[table.tableId]
        });
      }
    }
    // Validate that all of the derivedTables links are represented
    for (const table of tableList) {
      for (const derivedTable of table.derivedTables) {
        if (graph.tableLinkLookup[table.tableId + derivedTable.tableId] === undefined) {
          throw new Error(`Missing derived table link: ${table.tableId} => ${derivedTable.tableId}`);
        }
      }
    }
    return graph;
  }
  createFullSchemaGraph () {
    // TODO: when we have support for multiple network models, enable generating
    // a new model based on the current one's class and table structure (connect
    // getNetworkModelGraph() and getTableDependencyGraph() together)
    throw new Error(`unimplemented`);
  }
}

export default Origraph;
