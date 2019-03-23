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
  async getInstanceSample () {
    const seedLimit = 100;
    const clusterLimit = 5;
    const classCount = 5;
    // Try to get at most roughly seedCount nodes / edges, in clusters of about
    // clusterLimit, and try to include at least classCount instances per class
    // (may return null if caches are invalidated during iteration)
    let iterationReset = false;
    const instances = {};
    let totalCount = 0;
    const classCounts = {};

    const populateClassCounts = async (instance) => {
      if (instance.reset) {
        // Cache invalidated! Stop iterating and return null
        iterationReset = true;
        return false;
      }
      if (instances[instance.instanceId]) {
        // Don't add this instance if we already sampled it, but keep iterating
        return true;
      }
      // Add and count this instance to the sample
      instances[instance.instanceId] = instance;
      totalCount++;
      classCounts[instance.classObj.classId] = classCounts[instance.classObj.classId] || 0;
      classCounts[instance.classObj.classId]++;

      if (totalCount >= seedLimit) {
        // We have enough; stop iterating
        return false;
      }

      // Try to add the neighbors of this sample from classes where we don't have
      // enough samples yet
      const classIds = Object.keys(this.classes).filter(classId => {
        return (classCounts[classId] || 0) < classCount;
      });
      for await (const neighbor of instance.neighbors({ limit: clusterLimit, classIds })) {
        if (!await populateClassCounts(neighbor)) {
          // Pass along the signal to stop iterating
          return false;
        }
      }
      // Signal that we should keep iterating
      return true;
    };
    for (const [classId, classObj] of Object.entries(this.classes)) {
      const rowCount = await classObj.table.countRows();
      // Get at least classCount instances from this class (as long as we
      // haven't exhausted all the instances the class has to give)
      while ((classCounts[classId] || 0) < classCount && (classCounts[classId] || 0) < rowCount) {
        if (iterationReset) {
          // Cache invalidated; bail immediately
          return null;
        }
        // Add a random instance, and try to prioritize its neighbors in other classes
        if (!await populateClassCounts(await classObj.table.getRandomItem())) {
          break;
        }
      }
    }
    return instances;
  }
  validateInstanceSample (instances) {
    // Check if all the instances are still current; return null as a signal
    // that a cache was invalidated, and that a function needs to be called again
    for (const instance of Object.values(instances)) {
      if (instance.reset) {
        return null;
      }
    }
    return instances;
  }
  async updateInstanceSample (instances) {
    // Replace any out-of-date instances, and exclude instances that no longer exist
    const result = {};
    for (const [instanceId, instance] of Object.entries(instances)) {
      if (!instance.reset) {
        result[instanceId] = instance;
      } else {
        const { classId, index } = JSON.parse(instanceId);
        if (!this.classes[classId]) {
          delete instances[instanceId];
        } else {
          const newInstance = await this.classes[classId].getItem(index);
          if (newInstance) {
            result[instanceId] = newInstance;
          }
        }
      }
    }
    return this.validateInstanceSample(result);
  }
  partitionInstanceSample (instances) {
    // Separate samples by their type
    const result = {
      nodes: {},
      edges: {},
      generics: {}
    };
    for (const [instanceId, instance] of Object.entries(instances)) {
      if (instance.type === 'Node') {
        result.nodes[instanceId] = instance;
      } else if (instance.type === 'Edge') {
        result.edges[instanceId] = instance;
      } else {
        result.generics[instanceId] = instance;
      }
    }
    return result;
  }
  async fillInstanceSample (instances) {
    // Given a specific sample of the graph, add instances to ensure that:
    // 1. For every pair of nodes, any edges that exist between them should be added
    // 2. For every edge, ensure that at least one source and target node is added
    const { nodes, edges } = this.partitionInstanceSample(instances);
    const extraNodes = {};
    const extraEdges = {};

    // Make sure that each edge has at least one source and one target (assuming
    // that source and target classes are connected)
    const seedSide = async (edge, iterFunc) => {
      let aNode;
      let isSeeded = false;
      for await (const node of edge[iterFunc]()) {
        aNode = aNode || node;
        if (nodes[node.instanceId]) {
          isSeeded = true;
          break;
        }
      }
      if (!isSeeded && aNode) {
        extraNodes[aNode.instanceId] = aNode;
      }
    };
    for (const edge of Object.values(edges)) {
      await seedSide(edge, 'sourceNodes');
      await seedSide(edge, 'targetNodes');
    }

    // Add any edges that exist that connect any of the core nodes
    for (const node of Object.values(nodes)) {
      for await (const edge of node.edges()) {
        if (!edges[edge.instanceId]) {
          // Check that both ends of the edge connect at least one
          // of our nodes
          let connectsSource = false;
          let connectsTarget = false;
          for await (const node of edge.sourceNodes()) {
            if (nodes[node.instanceId]) {
              connectsSource = true;
              break;
            }
          }
          for await (const node of edge.targetNodes()) {
            if (nodes[node.instanceId]) {
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
    // include. We just need to merge and validate the samples:
    instances = Object.assign({}, nodes, edges, extraNodes, extraEdges);
    return this.validateInstanceSample(instances);
  }
  async instanceSampleToGraph (instances) {
    const graph = {
      nodes: [],
      nodeLookup: {},
      edges: []
    };

    const { nodes, edges } = this.partitionInstanceSample(instances);

    // Make a list of nodes, plus a lookup to each node's index
    for (const [instanceId, node] of Object.entries(nodes)) {
      graph.nodeLookup[instanceId] = graph.nodes.length;
      graph.nodes.push({
        nodeInstance: node,
        dummy: false
      });
    }

    // Add all the edges, including dummy nodes for dangling edges
    for (const edge of Object.values(edges)) {
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
        // (only create dummy nodes for edges that are actually disconnected)
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
