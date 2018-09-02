import GenericClass from './GenericClass.js';

class EdgeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this._mure.WRAPPERS.EdgeWrapper;

    this.sourceClassId = options.sourceClassId || null;
    this.sourceNodeAttr = options.sourceNodeAttr || null;
    this.sourceEdgeAttr = options.sourceEdgeAttr || null;

    this.targetClassId = options.targetClassId || null;
    this.targetNodeAttr = options.targetNodeAttr || null;
    this.targetEdgeAttr = options.targetEdgeAttr || null;

    this.directed = options.directed || false;
  }
  _toRawObject () {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.sourceNodeAttr = this.sourceNodeAttr;
    result.sourceEdgeAttr = this.sourceEdgeAttr;

    result.targetClassId = this.targetClassId;
    result.targetNodeAttr = this.targetNodeAttr;
    result.targetEdgeAttr = this.targetEdgeAttr;

    result.directed = this.directed;
    return result;
  }
  interpretAsNodes () {
    throw new Error(`unimplemented`);
  }
  interpretAsEdges () {
    return this;
  }
  connectToNodeClass ({ nodeClass, direction, nodeAttribute, edgeAttribute }) {
    if (direction !== 'source' && direction !== 'target') {
      direction = this.targetClassId === null ? 'target' : 'source';
    }
    if (direction === 'target') {
      this.connectTarget({ nodeClass, nodeAttribute, edgeAttribute });
    } else {
      this.connectSource({ nodeClass, nodeAttribute, edgeAttribute });
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
        this.sourceEdgeAttr = this.targetEdgeAttr;
        this.targetEdgeAttr = temp;
      }
    }
    this._mure.saveClasses();
  }
  connectSource ({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null,
    skipSave = false
  }) {
    if (this.sourceClassId) {
      this.disconnectSource({ skipSave: true });
    }
    this.sourceClassId = nodeClass.classId;
    this._mure.classes[this.sourceClassId].edgeClassIds[this.classId] = true;
    this.sourceNodeAttr = nodeAttribute;
    this.sourceEdgeAttr = edgeAttribute;

    if (!skipSave) { this._mure.saveClasses(); }
  }
  connectTarget ({ nodeClass, nodeAttribute, edgeAttribute, skipSave = false }) {
    if (this.targetClassId) {
      this.disconnectTarget({ skipSave: true });
    }
    this.targetClassId = nodeClass.classId;
    this._mure.classes[this.targetClassId].edgeClassIds[this.classId] = true;
    this.targetNodeAttr = nodeAttribute;
    this.targetEdgeAttr = edgeAttribute;

    if (!skipSave) { this._mure.saveClasses(); }
  }
  disconnectSource ({ skipSave = false }) {
    if (this._mure.classes[this.sourceClassId]) {
      delete this._mure.classes[this.sourceClassId].edgeClassIds[this.classId];
    }
    this.sourceNodeAttr = null;
    this.sourceEdgeAttr = null;
    if (!skipSave) { this._mure.saveClasses(); }
  }
  disconnectTarget ({ skipSave = false }) {
    if (this._mure.classes[this.targetClassId]) {
      delete this._mure.classes[this.targetClassId].edgeClassIds[this.classId];
    }
    this.targetNodeAttr = null;
    this.targetEdgeAttr = null;
    if (!skipSave) { this._mure.saveClasses(); }
  }
  delete () {
    this.disconnectSource({ skipSave: true });
    this.disconnectTarget({ skipSave: true });
    super.delete();
  }
}

export default EdgeClass;
