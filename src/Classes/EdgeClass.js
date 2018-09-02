import GenericClass from './GenericClass.js';

class EdgeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this._mure.WRAPPERS.EdgeWrapper;

    this.sourceClassId = options.sourceClassId || null;
    this.sourceNodeAttr = options.sourceNodeAttr || null;
    this.intermediateSources = options.intermediateSources || [];
    this.sourceEdgeAttr = options.sourceEdgeAttr || null;

    this.targetClassId = options.targetClassId || null;
    this.targetNodeAttr = options.targetNodeAttr || null;
    this.intermediateTargets = options.intermediateTargets || [];
    this.targetEdgeAttr = options.targetEdgeAttr || null;

    this.directed = options.directed || false;
  }
  _toRawObject () {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.sourceNodeAttr = this.sourceNodeAttr;
    result.intermediateSources = this.intermediateSources;
    result.sourceEdgeAttr = this.sourceEdgeAttr;

    result.targetClassId = this.targetClassId;
    result.targetNodeAttr = this.targetNodeAttr;
    result.intermediateTargets = this.intermediateTargets;
    result.targetEdgeAttr = this.targetEdgeAttr;

    result.directed = this.directed;
    return result;
  }
  interpretAsNodes () {
    const options = super.toRawObject();
    options.ClassType = this._mure.CLASSES.NodeClass;
    const newNodeClass = this._mure.createClass(options);
    const newSourceEdgeClass = this.sourceClassId ? this._mure.createClass({
      ClassType: this._mure.CLASSES.EdgeClass
    }) : null;
    const newTargetEdgeClass = this.targetClassId ? this._mure.createClass({
      ClassType: this._mure.CLASSES.EdgeClass
    }) : null;

    if (newSourceEdgeClass) {
      newSourceEdgeClass.sourceClassId = this.sourceClassId;
      newSourceEdgeClass.sourceNodeAttr = this.sourceNodeAttr;
      newSourceEdgeClass.intermediateSources
    }

    if (this.sourceClassId) {
      const sourceNodeClass = this._mure.classes[this.sourceClassId];
      let [ targetChain, sourceChain ] = this.sourceChain.split();
      const newSourceEdgeClass = this._mure.createClass({
        ClassType: this._mure.CLASSES.EdgeClass,
        sourceClassId: sourceNodeClass.classId,
        sourceChain: sourceChain.toRawObject(),
        targetClassId: newNodeClass.classId,
        targetChain: targetChain.toRawObject(),
        directed: this.directed
      });
      delete sourceNodeClass.edgeClassIds[newNodeClass.classId];
      sourceNodeClass.edgeClassIds[newSourceEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[newSourceEdgeClass.classId] = true;
    }

    if (this.targetClassId) {
      const targetNodeClass = this._mure.classes[this.targetClassId];
      let [ sourceChain, targetChain ] = this.targetChain.split();
      const newTargetEdgeClass = this._mure.createClass({
        ClassType: this._mure.CLASSES.EdgeClass,
        sourceClassId: targetNodeClass.classId,
        sourceChain: sourceChain.toRawObject(),
        targetClassId: newNodeClass.classId,
        targetChain: targetChain.toRawObject(),
        directed: this.directed
      });
      delete targetNodeClass.edgeClassIds[newNodeClass.classId];
      targetNodeClass.edgeClassIds[newTargetEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[newTargetEdgeClass.classId] = true;
    }

    this._mure.saveClasses();
  }
  interpretAsEdges () {
    return this;
  }
  connectToNodeClass ({ nodeClass, direction, nodeAttribute, edgeAttribute }) {
    if (direction === 'source') {
      this.connectSources({ nodeClass, nodeAttribute, edgeAttribute });
    } else if (direction === 'target') {
      this.connectSources({ nodeClass, nodeAttribute, edgeAttribute });
    } else {
      if (!this.sourceClassId) {
        this.connectSources({ nodeClass, nodeAttribute, edgeAttribute });
      } else if (!this.targetClassId) {
        this.connectSources({ nodeClass, nodeAttribute, edgeAttribute });
      } else {
        throw new Error(`Source and target are already defined; please specify a direction to override`);
      }
    }
    this._mure.saveClasses();
  }
  toggleNodeDirection (sourceClassId) {
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
        temp = this.sourceNodeAttr;
        this.sourceNodeAttr = this.targetNodeAttr;
        this.targetNodeAttr = temp;
        temp = this.intermediateSources;
        this.intermediateSources = this.intermediateTargets;
        this.intermediateTargets = temp;
        temp = this.sourceEdgeAttr;
        this.sourceEdgeAttr = this.targetEdgeAttr;
        this.targetEdgeAttr = temp;
      }
    }
    this._mure.saveClasses();
  }
  connectSource ({ nodeClass, nodeAttribute, edgeAttribute, skipSave = false }) {
    if (this.sourceClassId) {
      this.disconnectSources();
    }
    this.sourceClassId = nodeClass.classId;
    this._mure.classes[this.sourceClassId].edgeClassIds[this.classId] = true;
    if (!skipSave) { this._mure.saveClasses(); }
  }
  connectTarget ({ nodeClass, nodeAttribute, edgeAttribute, skipSave = false }) {
    if (this.targetClassId) {
      this.disconnectTargets();
    }
    this.targetClassId = nodeClass.classId;
    this._mure.classes[this.targetClassId].edgeClassIds[this.classId] = true;
    if (!skipSave) { this._mure.saveClasses(); }
  }
  disconnectSource ({ skipSave = false }) {
    if (this._mure.classes[this.sourceClassId]) {
      delete this._mure.classes[this.sourceClassId].edgeClassIds[this.classId];
    }
    if (!skipSave) { this._mure.saveClasses(); }
  }
  disconnectTarget ({ skipSave = false }) {
    if (this._mure.classes[this.targetClassId]) {
      delete this._mure.classes[this.targetClassId].edgeClassIds[this.classId];
    }
    if (!skipSave) { this._mure.saveClasses(); }
  }
  delete () {
    this.disconnectSource({ skipSave: true });
    this.disconnectTarget({ skipSave: true });
    super.delete();
  }
}

export default EdgeClass;
