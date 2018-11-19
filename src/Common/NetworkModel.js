import TriggerableMixin from '../Common/TriggerableMixin.js';
import mime from 'mime-types';
import datalib from 'datalib';

import * as TABLES from '../Tables/Tables.js';
import * as CLASSES from '../Classes/Classes.js';

const DATALIB_FORMATS = {
  'json': 'json',
  'csv': 'csv',
  'tsv': 'tsv',
  'topojson': 'topojson',
  'treejson': 'treejson'
};

class NetworkModel extends TriggerableMixin(class {}) {
  constructor ({
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
  _toRawObject () {
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
  get unsaved () {
    return this._saveTimeout !== undefined;
  }
  hydrate (rawObject, TYPES) {
    rawObject.model = this;
    return new TYPES[rawObject.type](rawObject);
  }
  createTable (options) {
    while (!options.tableId || (!options.overwrite && this.tables[options.tableId])) {
      options.tableId = `table${this._nextTableId}`;
      this._nextTableId += 1;
    }
    options.model = this;
    this.tables[options.tableId] = new TABLES[options.type](options);
    this.trigger('update');
    return this.tables[options.tableId];
  }
  createClass (options = { selector: `empty` }) {
    while (!options.classId || (!options.overwrite && this.classes[options.classId])) {
      options.classId = `class${this._nextClassId}`;
      this._nextClassId += 1;
    }
    options.model = this;
    this.classes[options.classId] = new CLASSES[options.type](options);
    this.trigger('update');
    return this.classes[options.classId];
  }
  rename (newName) {
    this.name = newName;
    this.trigger('update');
  }
  annotate (key, value) {
    this.annotations[key] = value;
    this.trigger('update');
  }
  deleteAnnotation (key) {
    delete this.annotations[key];
    this.trigger('update');
  }
  delete () {
    this._origraph.deleteModel(this.modelId);
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
        throw new Error(`${fileMB}MB file is too large to load statically`);
      }
    }
    // extensionOverride allows things like topojson or treejson (that don't
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
  addStringAsStaticTable ({ name, extension, text }) {
    let data, attributes;
    if (!extension) {
      extension = mime.extension(mime.lookup(name));
    }
    if (DATALIB_FORMATS[extension]) {
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
    let newTable = this.createTable(options);
    return this.createClass({
      type: 'GenericClass',
      name: options.name,
      tableId: newTable.tableId
    });
  }
  deleteAllUnusedTables () {
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
  async getSampleGraph ({
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
        for await (const node of classObj.table.iterate()) {
          if (!addNode(node)) {
            return sampleGraph;
          }
          for await (const { source, edge, target } of node.pairwiseNeighborhood({ limit: branchLimit })) {
            if (!addTriple(source, edge, target)) {
              return sampleGraph;
            }
          }
        }
      } else if (classObj.type === 'Edge') {
        for await (const edge of classObj.table.iterate()) {
          if (!addEdge(edge)) {
            return sampleGraph;
          }
          for await (const { source, target } of edge.pairwiseEdges({ limit: branchLimit })) {
            if (!addTriple(source, edge, target)) {
              return sampleGraph;
            }
          }
        }
      }
    }
    return sampleGraph;
  }
  async getInstanceGraph (instances) {
    if (!instances) {
      // Without specified instances, just pick the first 5 from each node
      // and edge class
      instances = [];
      for (const classObj of Object.values(this.classes)) {
        if (classObj.type === 'Node' || classObj.type === 'Edge') {
          for await (const item of classObj.table.iterate({ limit: 5 })) {
            instances.push(item);
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
      for await (const source of edgeInstance.sourceNodes()) {
        if (graph.nodeLookup[source.instanceId] !== undefined) {
          sources.push(graph.nodeLookup[source.instanceId]);
        }
      }
      const targets = [];
      for await (const target of edgeInstance.targetNodes()) {
        if (graph.nodeLookup[target.instanceId] !== undefined) {
          targets.push(graph.nodeLookup[target.instanceId]);
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
          graph.nodes.push({ dummy: true });
          graph.nodes.push({ dummy: true });
        } else {
          // The sources are hanging, but we have targets
          for (const target of targets) {
            graph.edges.push({
              edgeInstance,
              source: graph.nodes.length,
              target
            });
            graph.nodes.push({ dummy: true });
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
          graph.nodes.push({ dummy: true });
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
  getNetworkModelGraph ({
    raw = true,
    includeDummies = false
  } = {}) {
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
      const classSpec = raw ? classObj._toRawObject() : { classObj };
      classSpec.type = classObj.constructor.name;
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
        graph.classes.push({ dummy: true });
      }

      // Create existing classConnections
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
          graph.classes.push({ dummy: true });
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
          graph.classes.push({ dummy: true });
        }
      }
    }

    return graph;
  }
  getTableDependencyGraph () {
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
    }
    // Fill the graph with links based on parentTables...
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
  getFullSchemaGraph () {
    return Object.assign(this.getNetworkModelGraph(), this.getTableDependencyGraph());
  }
  createSchemaModel () {
    const graph = this.getFullSchemaGraph();
    const newModel = this._origraph.createModel({ name: this.name + '_schema' });
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
export default NetworkModel;