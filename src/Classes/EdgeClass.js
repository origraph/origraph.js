import GenericClass from './GenericClass.js';

class EdgeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.EdgeWrapper;

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
  toRawObject () {
    const result = super.toRawObject();

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
  get selector () {
    // TODO!
    return this._selector;
    /*
    const sourceClass = this.mure.classes[this.sourceClassId];
    const targetClass = this.mure.classes[this.targetClassId];

    if (!this._selector) {
      if (!sourceClass || !targetClass) {
        throw new Error(`Partial connections without an edge table should never happen`);
      } else {
        // No edge table (simple join between two nodes)
        const sourceHash = sourceClass.edgeClassIds[this.classId].nodeHashName;
        const targetHash = targetClass.edgeClassIds[this.classId].nodeHashName;
        return sourceClass.selector + `.join(target, ${sourceHash}, ${targetHash}, defaultFinish, sourceTarget)`;
      }
    } else {
      let result = this._selector;
      if (!sourceClass) {
        if (!targetClass) {
          // No connections yet; just yield the raw edge table
          return result;
        } else {
          // Partial edge-target connections
          const { edgeHashName, nodeHashName } = targetClass.edgeClassIds[this.classId];
          return result + `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, edgeTarget)`;
        }
      } else if (!targetClass) {
        // Partial source-edge connections
        const { nodeHashName, edgeHashName } = sourceClass.edgeClassIds[this.classId];
        return result + `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish, sourceEdge)`;
      } else {
        // Full connections
        let { nodeHashName, edgeHashName } = sourceClass.edgeClassIds[this.classId];
        result += `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        ({ edgeHashName, nodeHashName } = targetClass.edgeClassIds[this.classId]);
        result += `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, full)`;
        return result;
      }
    }
    */
  }
  populateStreamOptions (options = {}) {
    const sourceClass = this.mure.classes[this.sourceClassId];
    const targetClass = this.mure.classes[this.targetClassId];
    options.namedStreams = {};
    if (!this._selector) {
      // Use the options from the source stream instead of our class
      options = sourceClass.populateStreamOptions(options);
      options.namedStreams.target = targetClass.getStream();
    } else {
      options = super.populateStreamOptions(options);
      if (sourceClass) {
        options.namedStreams.source = sourceClass.getStream();
      }
      if (targetClass) {
        options.namedStreams.target = targetClass.getStream();
      }
    }
    return options;
  }
  interpretAsNodes () {
    const options = super.toRawObject();
    options.ClassType = this.mure.CLASSES.NodeClass;
    const newNodeClass = this.mure.createClass(options);
    const newSourceEdgeClass = this.sourceClassId ? this.mure.createClass({
      ClassType: this.mure.CLASSES.EdgeClass
    }) : null;
    const newTargetEdgeClass = this.targetClassId ? this.mure.createClass({
      ClassType: this.mure.CLASSES.EdgeClass
    }) : null;

    if (newSourceEdgeClass) {
      newSourceEdgeClass.sourceClassId = this.sourceClassId;
      newSourceEdgeClass.sourceNodeAttr = this.sourceNodeAttr;
      newSourceEdgeClass.intermediateSources
    }

    if (this.sourceClassId) {
      const sourceNodeClass = this.mure.classes[this.sourceClassId];
      let [ targetChain, sourceChain ] = this.sourceChain.split();
      const newSourceEdgeClass = this.mure.createClass({
        ClassType: this.mure.CLASSES.EdgeClass,
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
      const targetNodeClass = this.mure.classes[this.targetClassId];
      let [ sourceChain, targetChain ] = this.targetChain.split();
      const newTargetEdgeClass = this.mure.createClass({
        ClassType: this.mure.CLASSES.EdgeClass,
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

    this.mure.saveClasses();
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
    this.mure.saveClasses();
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
    this.mure.saveClasses();
  }
  connectSources ({ nodeClass, nodeAttribute, edgeAttribute }) {
    if (this.sourceClassId) {
      this.disconnectSources();
    }
    this.sourceClassId = nodeClass.classId;
    this.sourceNodeAttr = nodeAttribute;
    this.intermediateSources = [];
    this.sourceEdgeAttr = edgeAttribute;
  }
  connectTargets ({ nodeClass, nodeAttribute, edgeAttribute }) {
    if (this.targetClassId) {
      this.disconnectTargets();
    }
    this.targetClassId = nodeClass.classId;
    this.targetNodeAttr = nodeAttribute;
    this.intermediateTargets = [];
    this.targetEdgeAttr = edgeAttribute;
  }
  disconnectSources () {
    if (this.mure.classes[this.sourceClassId]) {
      delete this.mure.classes[this.sourceClassId].edgeClassIds[this.classId];
    }
    this.sourceClassId = null;
    this.sourceNodeAttr = null;
    this.intermediateSources = [];
    this.sourceEdgeAttr = null;
  }
  disconnectTargets () {
    if (this.mure.classes[this.targetClassId]) {
      delete this.mure.classes[this.targetClassId].edgeClassIds[this.classId];
    }
    this.targetClassId = null;
    this.targetNodeAttr = null;
    this.intermediateTargets = [];
    this.targetEdgeAttr = null;
  }
  delete () {
    this.disconnectSources();
    this.disconnectTargets();
    super.delete();
  }
}

export default EdgeClass;
