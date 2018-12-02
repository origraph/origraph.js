import GenericClass from './GenericClass.js';
import NodeWrapper from '../Wrappers/NodeWrapper.js';

class NodeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.edgeClassIds = options.edgeClassIds || {};
  }
  * edgeClasses () {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      yield this.model.classes[edgeClassId];
    }
  }
  getEdgeRole (edgeClass) {
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
  _toRawObject () {
    const result = super._toRawObject();
    result.edgeClassIds = this.edgeClassIds;
    return result;
  }
  _wrap (options) {
    options.classObj = this;
    return new NodeWrapper(options);
  }
  interpretAsNodes () {
    return this;
  }
  interpretAsEdges ({ autoconnect = false }) {
    const edgeClassIds = Object.keys(this.edgeClassIds);
    const options = super._toRawObject();

    if (!autoconnect || edgeClassIds.length > 2) {
      // If there are more than two edges, break all connections and make
      // this a floating edge (for now, we're not dealing in hyperedges)
      this.disconnectAllEdges();
    } else if (autoconnect && edgeClassIds.length === 1) {
      // With only one connection, this node should become a self-edge
      const edgeClass = this.model.classes[edgeClassIds[0]];
      // Are we the source or target of the existing edge (internally, in terms
      // of sourceId / targetId, not edgeClass.direction)?
      const isSource = edgeClass.sourceClassId === this.classId;

      // As we're converted to an edge, our new resulting source AND target
      // should be whatever is at the other end of edgeClass (if anything)
      if (isSource) {
        options.sourceClassId = options.targetClassId = edgeClass.targetClassId;
        edgeClass.disconnectSource();
      } else {
        options.sourceClassId = options.targetClassId = edgeClass.sourceClassId;
        edgeClass.disconnectTarget();
      }
      // If there is a node class on the other end of edgeClass, add our
      // id to its list of connections
      const nodeClass = this.model.classes[options.sourceClassId];
      if (nodeClass) {
        nodeClass.edgeClassIds[this.classId] = true;
      }

      // tableId lists should emanate out from the (new) edge table; assuming
      // (for a moment) that isSource === true, we'd construct the tableId list
      // like this:
      let tableIdList = edgeClass.targetTableIds.slice().reverse()
        .concat([ edgeClass.tableId ])
        .concat(edgeClass.sourceTableIds);
      if (!isSource) {
        // Whoops, got it backwards!
        tableIdList.reverse();
      }
      options.directed = edgeClass.directed;
      options.sourceTableIds = options.targetTableIds = tableIdList;
    } else if (autoconnect && edgeClassIds.length === 2) {
      // Okay, we've got two edges, so this is a little more straightforward
      let sourceEdgeClass = this.model.classes[edgeClassIds[0]];
      let targetEdgeClass = this.model.classes[edgeClassIds[1]];
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
          targetEdgeClass = this.model.classes[edgeClassIds[0]];
          sourceEdgeClass = this.model.classes[edgeClassIds[1]];
          options.directed = true;
        }
      }
      // Okay, now we know how to set source / target ids
      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId;
      // Add this class to the source's / target's edgeClassIds
      this.model.classes[options.sourceClassId].edgeClassIds[this.classId] = true;
      this.model.classes[options.targetClassId].edgeClassIds[this.classId] = true;
      // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table
      options.sourceTableIds = sourceEdgeClass.targetTableIds.slice().reverse()
        .concat([ sourceEdgeClass.tableId ])
        .concat(sourceEdgeClass.sourceTableIds);
      if (sourceEdgeClass.targetClassId === this.classId) {
        options.sourceTableIds.reverse();
      }
      options.targetTableIds = targetEdgeClass.targetTableIds.slice().reverse()
        .concat([ targetEdgeClass.tableId ])
        .concat(targetEdgeClass.sourceTableIds);
      if (targetEdgeClass.targetClassId === this.classId) {
        options.targetTableIds.reverse();
      }
      // Disconnect the existing edge classes from the new (now edge) class
      this.disconnectAllEdges();
    }
    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }
  connectToNodeClass ({ otherNodeClass, attribute, otherAttribute }) {
    let thisHash, otherHash, sourceTableIds, targetTableIds;
    if (attribute === null) {
      thisHash = this.table;
      sourceTableIds = [];
    } else {
      thisHash = this.table.promote(attribute);
      sourceTableIds = [ thisHash.tableId ];
    }
    if (otherAttribute === null) {
      otherHash = otherNodeClass.table;
      targetTableIds = [];
    } else {
      otherHash = otherNodeClass.table.promote(otherAttribute);
      targetTableIds = [ otherHash.tableId ];
    }
    const connectedTable = thisHash.connect([otherHash]);
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
  connectToEdgeClass (options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    return edgeClass.connectToNodeClass(options);
  }
  promote (attribute) {
    const newNodeClass = this.model.createClass({
      tableId: this.table.promote(attribute).tableId,
      type: 'NodeClass'
    });
    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
    return newNodeClass;
  }
  projectNewEdge (classIdList) {
    const classList = classIdList.map(classId => {
      return this.model.classes[classId];
    });
    if (classList.length < 2 || classList[classList.length - 1].type !== 'Node') {
      throw new Error(`Invalid classIdList`);
    }
    const sourceClassId = this.classId;
    const targetClassId = classList[classList.length - 1].classId;
    const sourceTableIds = [];
    const targetTableIds = [];
    let tableId;
    const middleIndex = Math.floor((classList.length - 1) / 2);
    for (let i = 0; i < classList.length - 1; i++) {
      if (i < middleIndex) {
        if (classList[i].type === 'Node') {
          sourceTableIds.unshift(classList[i].tableId);
        } else {
          const temp = Array.from(classList[i].sourceTableIds).reverse();
          for (const tableId of temp) {
            sourceTableIds.unshift(tableId);
          }
          sourceTableIds.unshift(classList[i].tableId);
          for (const tableId of classList[i].targetTableIds) {
            sourceTableIds.unshift(tableId);
          }
        }
      } else if (i === middleIndex) {
        tableId = classList[i].table.duplicate().tableId;
        if (classList[i].type === 'Edge') {
          const temp = Array.from(classList[i].sourceTableIds).reverse();
          for (const tableId of temp) {
            sourceTableIds.unshift(tableId);
          }
          for (const tableId of classList[i].targetTableIds) {
            targetTableIds.unshift(tableId);
          }
        }
      } else {
        if (classList[i].type === 'Node') {
          targetTableIds.unshift(classList[i].tableId);
        } else {
          const temp = Array.from(classList[i].sourceTableIds).reverse();
          for (const tableId of temp) {
            targetTableIds.unshift(tableId);
          }
          targetTableIds.unshift(classList[i].tableId);
          for (const tableId of classList[i].targetTableIds) {
            targetTableIds.unshift(tableId);
          }
        }
      }
    }
    return this.model.createClass({
      type: 'EdgeClass',
      tableId,
      sourceClassId,
      targetClassId,
      sourceTableIds,
      targetTableIds
    });
  }
  disconnectAllEdges (options) {
    for (const edgeClass of this.connectedClasses()) {
      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSource(options);
      }
      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTarget(options);
      }
    }
  }
  * connectedClasses () {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      yield this.model.classes[edgeClassId];
    }
  }
  delete () {
    this.disconnectAllEdges();
    super.delete();
  }
}

export default NodeClass;
