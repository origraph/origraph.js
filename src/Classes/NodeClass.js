import GenericClass from './GenericClass.js';

class NodeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.edgeClassIds = options.edgeClassIds || {};
    this._cachedShortestEdgePaths = {};
  }
  _toRawObject () {
    const result = super._toRawObject();
    result.edgeClassIds = this.edgeClassIds;
    return result;
  }
  _wrap (options) {
    options.classObj = this;
    return new this._mure.WRAPPERS.NodeWrapper(options);
  }
  async prepShortestEdgePath (edgeClassId) {
    if (this._cachedShortestEdgePaths[edgeClassId] !== undefined) {
      return this._cachedShortestEdgePaths[edgeClassId];
    } else {
      const edgeTable = this._mure.classes[edgeClassId].table;
      const idList = [];
      for (const table of this.table.shortestPathToTable(edgeTable)) {
        idList.push(table.tableId);
        // Spin through the table to make sure all its rows are wrapped and connected
        await table.countRows();
      }
      this._cachedShortestEdgePaths[edgeClassId] = idList;
      return this._cachedShortestEdgePaths[edgeClassId];
    }
  }
  interpretAsNodes () {
    return this;
  }
  interpretAsEdges () {
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
      let targetEdgeClass = this._mure.classes[edgeClassIds[1]];
      // Figure out the direction, if there is one
      options.directed = false;
      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        if (sourceEdgeClass.targetClassId === this.classId &&
            targetEdgeClass.sourceClassId === this.classId) {
          // We happened to get the edges in order; set directed to true
          options.directed = true;
        } else if (sourceEdgeClass.sourceClassId === this.classId &&
                   targetEdgeClass.targetClassId === this.classId) {
          // We got the edges backwards; swap them and set directed to true
          targetEdgeClass = this._mure.classes[edgeClassIds[0]];
          sourceEdgeClass = this._mure.classes[edgeClassIds[1]];
          options.directed = true;
        }
      }
      // Okay, now we know how to set source / target ids
      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId;
      // Delete each of the edge classes
      sourceEdgeClass.delete();
      targetEdgeClass.delete();
    }
    this.delete();
    delete options.classId;
    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    this.table.reset();
    return this._mure.newClass(options);
  }
  connectToNodeClass ({ otherNodeClass, directed, attribute, otherAttribute }) {
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
  connectToEdgeClass (options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    return edgeClass.connectToNodeClass(options);
  }
  disconnectAllEdges () {
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
  delete () {
    this.disconnectAllEdges();
    super.delete();
  }
}

export default NodeClass;
