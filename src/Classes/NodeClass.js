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
  get canAutoConnect () {
    const allRoles = Object.keys(this.edgeClassIds).map(id => this.getEdgeRole(this.model.classes[id]));
    return allRoles.length > 0 && allRoles.length <= 2 && allRoles.indexOf('both') === -1;
  }
  interpretAsEdges ({ autoconnect = false } = {}) {
    const edgeClassIds = Object.keys(this.edgeClassIds);
    const roles = edgeClassIds.map(id => this.getEdgeRole(this.model.classes[id]));
    const options = super._toRawObject();

    if (!autoconnect || edgeClassIds.length > 2 || roles.indexOf('both') !== -1) {
      // If there are more than two connections, break all connections and make
      // this a floating edge (for now, we're not dealing in hyperedges)
      this.disconnectAllEdges();
    } else if (autoconnect && edgeClassIds.length === 1) {
      // With only one connection, this node should become a self-edge
      const edgeClass = this.model.classes[edgeClassIds[0]];

      // As we're converted to an edge, our new resulting source AND target
      // should be whatever is at the other end of edgeClass (if anything)
      if (roles[0] === 'source') {
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
      if (roles[0] === 'target') {
        // Whoops, got it backwards!
        tableIdList.reverse();
      }
      options.directed = edgeClass.directed;
      options.sourceTableIds = options.targetTableIds = tableIdList;
    } else if (autoconnect && edgeClassIds.length === 2) {
      // Okay, we've got two edges, so this is a little more straightforward
      let sourceEdgeClass = this.model.classes[edgeClassIds[0]];
      let mySourceRole = roles[0];
      let targetEdgeClass = this.model.classes[edgeClassIds[1]];
      let myTargetRole = roles[1];
      if (mySourceRole === 'source' && myTargetRole === 'target') {
        // Swap if the source points away and the target points at me
        sourceEdgeClass = this.model.classes[edgeClassIds[1]];
        mySourceRole = roles[1];
        targetEdgeClass = this.model.classes[edgeClassIds[0]];
        myTargetRole = roles[0];
      }

      // Figure out the direction, if there is one
      options.directed = false;
      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        // Only stay directed if both edges are pointing in the same direction
        // (if both are pointing at, or away from this node class, then the
        // resulting edge shouldn't be directed)
        options.directed = mySourceRole !== myTargetRole;
      } else if (sourceEdgeClass.directed) {
        // Only the source edge is directed; keep the direction, and swap
        // classes if it's actually pointing inward (then we'd want it to
        // be on the target side)
        options.directed = true;
        if (mySourceRole === 'target') {
          let temp = sourceEdgeClass;
          sourceEdgeClass = targetEdgeClass;
          targetEdgeClass = temp;
          temp = mySourceRole;
          mySourceRole = myTargetRole;
          myTargetRole = temp;
        }
      } else if (targetEdgeClass.directed) {
        // Only the target edge is directed; keep the direction, and swap
        // classes if it's actually pointing inward (then we'd want it to
        // be on the source side)
        options.directed = true;
        if (myTargetRole === 'target') {
          let temp = sourceEdgeClass;
          sourceEdgeClass = targetEdgeClass;
          targetEdgeClass = temp;
          temp = mySourceRole;
          mySourceRole = myTargetRole;
          myTargetRole = temp;
        }
      }
      // Okay, set source / target ids
      options.sourceClassId = mySourceRole === 'target'
        ? sourceEdgeClass.sourceClassId : sourceEdgeClass.targetClassId;
      options.targetClassId = myTargetRole === 'source'
        ? targetEdgeClass.targetClassId : targetEdgeClass.sourceClassId;

      // Connect this class to the node classes on the other end of source /
      // target (if they're connected)
      if (this.model.classes[options.sourceClassId]) {
        this.model.classes[options.sourceClassId].edgeClassIds[this.classId] = true;
      }
      if (this.model.classes[options.targetClassId]) {
        this.model.classes[options.targetClassId].edgeClassIds[this.classId] = true;
      }

      // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table
      options.sourceTableIds = (sourceEdgeClass.targetTableIds || []).slice().reverse()
        .concat([ sourceEdgeClass.tableId ])
        .concat(sourceEdgeClass.sourceTableIds || []);
      if (mySourceRole === 'source') {
        options.sourceTableIds.reverse();
      }
      options.targetTableIds = (targetEdgeClass.sourceTableIds || []).slice().reverse()
        .concat([ targetEdgeClass.tableId ])
        .concat(targetEdgeClass.targetTableIds || []);
      if (myTargetRole === 'target') {
        options.targetTableIds.reverse();
      }
      // Disconnect the existing edge classes from the new (now edge) class
      this.disconnectAllEdges();
    }
    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    options.overwrite = true;
    return this.model.createClass(options);
  }
  interpretAsGeneric () {
    this.disconnectAllEdges();
    return super.interpretAsGeneric();
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
    const newNodeClass = super.promote(attribute);
    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
    return newNodeClass;
  }
  createSupernodes (attribute) {
    const existingEdgeClassIds = Object.keys(this.edgeClassIds);
    const newNodeClass = super.promote(attribute);
    const newEdgeClass = this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
    for (const edgeClassId of existingEdgeClassIds) {
      const edgeClass = this.model.classes[edgeClassId];
      const role = this.getEdgeRole(edgeClass);
      if (role === 'both') {
        newNodeClass.projectNewEdge([
          newEdgeClass.classId,
          this.classId,
          edgeClass.classId,
          this.classId,
          newEdgeClass.classId,
          newNodeClass.classId
        ]).setClassName(edgeClass.className);
      } else {
        newNodeClass.projectNewEdge([
          newEdgeClass.classId,
          this.classId,
          edgeClass.classId,
          role === 'source' ? edgeClass.targetClassId : edgeClass.sourceClassId
        ]).setClassName(edgeClass.className);
      }
    }
    return newNodeClass;
  }
  connectToChildNodeClass (childClass) {
    const connectedTable = this.table.connect([childClass.table], 'ParentChildTable');
    const newEdgeClass = this.model.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceTableIds: [],
      targetClassId: childClass.classId,
      targetTableIds: []
    });
    this.edgeClassIds[newEdgeClass.classId] = true;
    childClass.edgeClassIds[newEdgeClass.classId] = true;
    this.model.trigger('update');
  }
  expand (attribute) {
    const newNodeClass = super.expand(attribute);
    this.connectToChildNodeClass(newNodeClass);
    return newNodeClass;
  }
  unroll (attribute) {
    const newNodeClass = super.unroll(attribute);
    this.connectToChildNodeClass(newNodeClass);
    return newNodeClass;
  }
  projectNewEdge (classIdList) {
    const classList = [this].concat(classIdList.map(classId => {
      return this.model.classes[classId];
    }));
    if (classList.length < 3 || classList[classList.length - 1].type !== 'Node') {
      throw new Error(`Invalid classIdList`);
    }
    const sourceClassId = this.classId;
    const targetClassId = classList[classList.length - 1].classId;
    let tableOrder = [];
    for (let i = 1; i < classList.length; i++) {
      const classObj = classList[i];
      if (classObj.type === 'Node') {
        tableOrder.push(classObj.tableId);
      } else {
        const edgeRole = classList[i - 1].getEdgeRole(classObj);
        if (edgeRole === 'source' || edgeRole === 'both') {
          tableOrder = tableOrder.concat(
            Array.from(classObj.sourceTableIds).reverse());
          tableOrder.push(classObj.tableId);
          tableOrder = tableOrder.concat(classObj.targetTableIds);
        } else {
          tableOrder = tableOrder.concat(
            Array.from(classObj.targetTableIds).reverse());
          tableOrder.push(classObj.tableId);
          tableOrder = tableOrder.concat(classObj.sourceTableIds);
        }
      }
    }
    const newTable = this.table.project(tableOrder);
    const newClass = this.model.createClass({
      type: 'EdgeClass',
      tableId: newTable.tableId,
      sourceClassId,
      targetClassId,
      sourceTableIds: [],
      targetTableIds: []
    });
    this.edgeClassIds[newClass.classId] = true;
    classList[classList.length - 1].edgeClassIds[newClass.classId] = true;
    return newClass;
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
