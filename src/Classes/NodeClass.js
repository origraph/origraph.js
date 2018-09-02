import GenericClass from './GenericClass.js';

class NodeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.NodeWrapper;
    this.edgeClassIds = options.edgeClassIds || {};
  }
  toRawObject () {
    const result = super.toRawObject();
    result.edgeClassIds = this.edgeClassIds;
    return result;
  }
  interpretAsNodes () {
    return this;
  }
  interpretAsEdges () {
    const edgeIds = Object.keys(this.edgeClassIds);
    if (edgeIds.length > 2) {
      this.disconnectAllEdges();
    }
    const options = super.toRawObject();
    options.ClassType = this.mure.CLASSES.EdgeClass;
    const newEdgeClass = this.mure.createClass(options);
    const sourceEdgeClass = (edgeIds.length === 1 || edgeIds.length === 2) &&
      this.mure.classes[edgeIds[0]];
    const targetEdgeClass = edgeIds.length === 2 &&
      this.mure.classes[edgeIds[1]];

    if (sourceEdgeClass) {
      newEdgeClass.sourceClassId = sourceEdgeClass.sourceClassId;
      newEdgeClass.sourceNodeAttr = sourceEdgeClass.sourceNodeAttr;
      newEdgeClass.intermediateSources = sourceEdgeClass.intermediateSources
        .concat([{
          nodeAttr: sourceEdgeClass.sourceEdgeAttr,
          selector: sourceEdgeClass._selector,
          edgeAttr: sourceEdgeClass.targetEdgeAttr
        }]).concat(sourceEdgeClass.intermediateTargets);
      newEdgeClass.sourceEdgeAttr = sourceEdgeClass.targetNodeAttr;

      sourceEdgeClass.delete();
    }
    if (targetEdgeClass) {
      newEdgeClass.targetEdgeAttr = targetEdgeClass.sourceNodeAttr;
      newEdgeClass.intermediateTargets = targetEdgeClass.intermediateSources
        .concat([{
          nodeAttr: targetEdgeClass.sourceEdgeAttr,
          selector: targetEdgeClass._selector,
          edgeAttr: targetEdgeClass.targetEdgeAttr
        }]).concat(targetEdgeClass.intermediateTargets);
      newEdgeClass.targetNodeAttr = targetEdgeClass.targetNodeAttr;
      newEdgeClass.targetClassId = targetEdgeClass.targetClassId;

      targetEdgeClass.delete();
    }
    this.mure.saveClasses();
  }
  connectToNodeClass ({ otherNodeClass, directed, attribute, otherAttribute }) {
    const newEdge = this.mure.createClass({
      selector: null,
      ClassType: this.mure.CLASSES.EdgeClass,

      sourceClassId: this.classId,
      sourceNodeAttr: attribute,
      intermediateSources: [],
      sourceEdgeAttr: null,

      targetClassId: otherNodeClass.classId,
      targetNodeAttr: otherAttribute,
      intermediateTargets: [],
      targetEdgeAttr: null,

      directed
    });
    this.edgeClassIds[newEdge.classId] = true;
    otherNodeClass.edgeClassIds[newEdge.classId] = true;
    this.mure.saveClasses();
  }
  connectToEdgeClass (options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }
  disconnectAllEdges () {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      const edgeClass = this.mure.classes[edgeClassId];
      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSources();
      }
      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTargets();
      }
    }
  }
  delete () {
    this.disconnectAllEdges();
    super.delete();
  }
}

export default NodeClass;
