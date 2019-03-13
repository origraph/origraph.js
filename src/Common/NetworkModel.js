import TriggerableMixin from './TriggerableMixin.js';
import mime from 'mime-types';
import datalib from 'datalib';

import * as TABLES from '../Tables/Tables.js';
import * as CLASSES from '../Classes/Classes.js';
import * as FILE_FORMATS from '../FileFormats/FileFormats.js';

const DATALIB_FORMATS = {
  'json': 'json',
  'csv': 'csv',
  'tsv': 'tsv'
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
    if (this.tables[options.tableId].classObj && !options.overwrite) {
      options.tableId = this.tables[options.tableId].duplicate().tableId;
    }
    options.model = this;
    this.classes[options.classId] = new CLASSES[options.type](options);
    this.trigger('update');
    return this.classes[options.classId];
  }
  findClass (className) {
    return Object.values(this.classes).find(classObj => classObj.className === className);
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
  get deleted () {
    return this._origraph.models[this.modelId];
  }
  async addTextFile (options) {
    if (!options.format) {
      options.format = mime.extension(mime.lookup(options.name));
    }
    if (FILE_FORMATS[options.format]) {
      options.model = this;
      return FILE_FORMATS[options.format].importData(options);
    } else if (DATALIB_FORMATS[options.format]) {
      options.data = datalib.read(options.text, { type: options.format });
      if (options.format === 'csv' || options.format === 'tsv') {
        options.attributes = {};
        for (const attr of options.data.columns) {
          options.attributes[attr] = true;
        }
        delete options.data.columns;
      }
      return this.addStaticTable(options);
    } else {
      throw new Error(`Unsupported file format: ${options.format}`);
    }
  }
  async formatData (options) {
    options.model = this;
    if (FILE_FORMATS[options.format]) {
      return FILE_FORMATS[options.format].formatData(options);
    } else if (DATALIB_FORMATS[options.format]) {
      throw new Error(`Raw ${options.format} export not yet supported`);
    } else {
      throw new Error(`Can't export unknown format: ${options.format}`);
    }
  }
  addStaticTable (options) {
    options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDictTable';
    let newTable = this.createTable(options);
    return this.createClass({
      type: 'GenericClass',
      tableId: newTable.tableId
    });
  }
  optimizeTables () {
    const tablesInUse = {};
    for (const classObj of Object.values(this.classes)) {
      tablesInUse[classObj.tableId] = true;
      for (const tableId of classObj.sourceTableIds || []) {
        tablesInUse[tableId] = true;
      }
      for (const tableId of classObj.targetTableIds || []) {
        tablesInUse[tableId] = true;
      }
    }
    const parentsVisited = {};
    const queue = Object.keys(tablesInUse);
    while (queue.length > 0) {
      const tableId = queue.shift();
      if (!parentsVisited[tableId]) {
        tablesInUse[tableId] = true;
        parentsVisited[tableId] = true;
        const table = this.tables[tableId];
        for (const parentTable of table.parentTables) {
          queue.push(parentTable.tableId);
        }
      }
    }
    for (const tableId of Object.keys(this.tables)) {
      const table = this.tables[tableId];
      if (!tablesInUse[tableId] && table.type !== 'Static' && table.type !== 'StaticDict') {
        table.delete(true);
      }
    }
    // TODO: If any DuplicatedTable is in use, but the original isn't, swap for the real one
  }
  async getArbitraryInstanceList (seedCount = 2, nodeCount = 5, edgeCount = 10) {
    // Try to get instancesPerClass instances from each class, starting with the
    // class that was passed in as an argument
    let iterationReset = false;
    const nodeInstances = {};
    const edgeInstances = {};
    const nodeCounts = {};
    const edgeCounts = {};
    const unSeenClassIds = {};
    for (const classId of Object.keys(this.classes)) {
      unSeenClassIds[classId] = true;
    }

    const populateClassCounts = async (instance) => {
      if (!instance || !instance.classObj) {
        iterationReset = true;
        return false;
      }
      const classId = instance.classObj.classId;
      const instanceId = instance.instanceId;
      if (instance.type === 'Node') {
        nodeCounts[classId] = nodeCounts[classId] || 0;
        if (nodeCounts[classId] >= nodeCount || nodeInstances[instanceId]) {
          return false;
        }
        delete unSeenClassIds[classId];
        nodeCounts[classId]++;
        nodeInstances[instanceId] = instance;
        for await (const edge of instance.edges({ limit: seedCount, classIds: Object.keys(unSeenClassIds) })) {
          if (!await populateClassCounts(edge)) {
            break;
          }
        }
      } else if (instance.type === 'Edge') {
        edgeCounts[classId] = edgeCounts[classId] || 0;
        if (edgeCounts[classId] >= edgeCount || edgeInstances[instanceId]) {
          return false;
        }
        delete unSeenClassIds[classId];
        edgeCounts[classId]++;
        edgeInstances[instanceId] = instance;
        for await (const node of instance.nodes({ limit: seedCount, classIds: Object.keys(unSeenClassIds) })) {
          if (!await populateClassCounts(node)) {
            break;
          }
        }
      } else {
        return false;
      }
      return true;
    };
    for (const classObj of Object.values(this.classes)) {
      await classObj.table.buildCache();
      for (let i = 0; i < seedCount; i++) {
        if (iterationReset) {
          return null;
        }
        const randIndex = Math.floor(Math.random() * classObj.table._cache.length);
        const instance = classObj.table._cache[randIndex];
        if (!await populateClassCounts(instance)) {
          break;
        }
      }
    }
    return Object.keys(nodeInstances).concat(Object.keys(edgeInstances));
  }
  async getInstanceGraph (instanceIdList) {
    const nodeInstances = {};
    const edgeInstances = {};
    const extraNodes = {};
    const extraEdges = {};
    const graph = {
      nodes: [],
      nodeLookup: {},
      edges: []
    };

    if (!instanceIdList) {
      return graph;
    } else {
      // Get the specified items
      for (const instanceId of instanceIdList) {
        const { classId, index } = JSON.parse(instanceId);
        const instance = await this.classes[classId].table.getItem(index);
        if (instance) {
          if (instance.type === 'Node') {
            nodeInstances[instanceId] = instance;
          } else if (instance.type === 'Edge') {
            edgeInstances[instanceId] = instance;
          }
        }
      }
    }

    // At this point, we have all the nodes that we NEED, but for a cleaner
    // graph, we want to make sure to only show dangling edges that are actually
    // dangling in the network model (need to make sure each edge has at least
    // one source and one target node)
    const seedSide = async (edgeId, iterFunc) => {
      let aNode;
      let isSeeded = false;
      for await (const source of edgeInstances[edgeId][iterFunc]()) {
        aNode = aNode || source;
        if (nodeInstances[source.instanceId]) {
          isSeeded = true;
          break;
        }
      }
      if (!isSeeded && aNode) {
        extraNodes[aNode.instanceId] = aNode;
      }
    };
    for (const edgeId in edgeInstances) {
      seedSide(edgeId, 'sourceNodes');
      seedSide(edgeId, 'targetNodes');
    }
    // We also want to add any edges that exist that connect any of the nodes
    // that we've included
    for (const nodeId in nodeInstances) {
      for await (const edge of nodeInstances[nodeId].edges()) {
        if (!edgeInstances[edge.instanceId]) {
          // Check that both ends of the edge connect at least one
          // of our nodes
          let connectsSource = false;
          let connectsTarget = false;
          for await (const node of edge.sourceNodes()) {
            if (nodeInstances[node.instanceId]) {
              connectsSource = true;
              break;
            }
          }
          for await (const node of edge.targetNodes()) {
            if (nodeInstances[node.instanceId]) {
              connectsTarget = true;
              break;
            }
          }
          if (connectsSource && connectsTarget) {
            extraEdges[edge.instanceId] = edge;
          }
        }
      }
    }

    // At this point we have a complete set of nodes and edges that we want to
    // include. Now we need to populate the graph:

    // Add all the nodes to the graph, and populate a lookup for where they are in the list
    for (const node of Object.values(nodeInstances).concat(Object.values(extraNodes))) {
      graph.nodeLookup[node.instanceId] = graph.nodes.length;
      graph.nodes.push({
        nodeInstance: node,
        dummy: false
      });
    }

    // Add all the edges, including dummy nodes for dangling edges
    for (const edge of Object.values(edgeInstances).concat(Object.values(extraEdges))) {
      if (!edge.classObj.sourceClassId) {
        if (!edge.classObj.targetClassId) {
          // Missing both source and target classes; add dummy nodes for both ends
          graph.edges.push({
            edgeInstance: edge,
            source: graph.nodes.length,
            target: graph.nodes.length + 1
          });
          graph.nodes.push({ dummy: true });
          graph.nodes.push({ dummy: true });
        } else {
          // Add dummy source nodes
          for await (const node of edge.targetNodes()) {
            if (graph.nodeLookup[node.instanceId] !== undefined) {
              graph.edges.push({
                edgeInstance: edge,
                source: graph.nodes.length,
                target: graph.nodeLookup[node.instanceId]
              });
              graph.nodes.push({ dummy: true });
            }
          }
        }
      } else if (!edge.classObj.targetClassId) {
        // Add dummy target nodes
        for await (const node of edge.sourceNodes()) {
          if (graph.nodeLookup[node.instanceId] !== undefined) {
            graph.edges.push({
              edgeInstance: edge,
              source: graph.nodeLookup[node.instanceId],
              target: graph.nodes.length
            });
            graph.nodes.push({ dummy: true });
          }
        }
      } else {
        // There should be both source and target nodes for each edge
        for await (const sourceNode of edge.sourceNodes()) {
          if (graph.nodeLookup[sourceNode.instanceId] !== undefined) {
            for await (const targetNode of edge.targetNodes()) {
              if (graph.nodeLookup[targetNode.instanceId] !== undefined) {
                graph.edges.push({
                  edgeInstance: edge,
                  source: graph.nodeLookup[sourceNode.instanceId],
                  target: graph.nodeLookup[targetNode.instanceId]
                });
              }
            }
          }
        }
      }
    }
    return graph;
  }
  getNetworkModelGraph ({
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
      const classSpec = raw ? classObj._toRawObject() : { classObj };
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
        graph.classes.push({ dummy: true });
      }
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
  getModelDump () {
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
  createSchemaModel () {
    const graph = this.getModelDump();

    graph.tables.forEach(table => {
      table.derivedTables = Object.keys(table.derivedTables);
    });

    const newModel = this._origraph.createModel({ name: this.name + '_schema' });
    const raw = newModel.addStaticTable({
      data: graph,
      name: 'Raw Dump'
    });
    let [ classes, tables ] = raw.closedTranspose(['classes', 'tables']);
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
export default NetworkModel;
