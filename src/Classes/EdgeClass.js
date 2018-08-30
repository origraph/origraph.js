import Chain from './Chain.js';
import GenericClass from './GenericClass.js';

class EdgeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.EdgeWrapper;
    this.sourceClassId = options.sourceClassId || null;
    this.sourceChain = new Chain(options.sourceChain);
    this.targetClassId = options.targetClassId || null;
    this.targetChain = new Chain(options.targetChain);
    this.directed = options.directed || false;
  }
  toRawObject () {
    const result = super.toRawObject();
    result.sourceClassId = this.sourceClassId;
    result.sourceChain = this.sourceChain.toRawObject;
    result.targetClassId = this.targetClassId;
    result.targetChain = this.targetChain.toRawObject;
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
        const sourceHash = sourceClass.edgeConnections[this.classId].nodeHashName;
        const targetHash = targetClass.edgeConnections[this.classId].nodeHashName;
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
          const { edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId];
          return result + `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, edgeTarget)`;
        }
      } else if (!targetClass) {
        // Partial source-edge connections
        const { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        return result + `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish, sourceEdge)`;
      } else {
        // Full connections
        let { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        result += `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        ({ edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId]);
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
      delete sourceNodeClass.edgeConnections[newNodeClass.classId];
      sourceNodeClass.edgeConnections[newSourceEdgeClass.classId] = true;
      newNodeClass.edgeConnections[newSourceEdgeClass.classId] = true;
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
      delete targetNodeClass.edgeConnections[newNodeClass.classId];
      targetNodeClass.edgeConnections[newTargetEdgeClass.classId] = true;
      newNodeClass.edgeConnections[newTargetEdgeClass.classId] = true;
    }

    this.mure.saveClasses();
  }
  interpretAsEdges () {
    return this;
  }
  connectToNodeClass ({ nodeClass, direction, nodeHashName, edgeHashName }) {
    if (direction === 'source') {
      if (this.sourceClassId) {
        delete this.mure.classes[this.sourceClassId].edgeConnections[this.classId];
      }
      this.sourceClassId = nodeClass.classId;
      this.sourceChain = new Chain({ nodeHash: nodeHashName, edgeHash: edgeHashName });
    } else if (direction === 'target') {
      if (this.targetClassId) {
        delete this.mure.classes[this.targetClassId].edgeConnections[this.classId];
      }
      this.targetClassId = nodeClass.classId;
      this.targetChain = new Chain({ nodeHash: nodeHashName, edgeHash: edgeHashName });
    } else {
      if (!this.sourceClassId) {
        this.sourceClassId = nodeClass.classId;
        this.sourceChain = new Chain({ nodeHash: nodeHashName, edgeHash: edgeHashName });
      } else if (!this.targetClassId) {
        this.targetClassId = nodeClass.classId;
        this.targetChain = new Chain({ nodeHash: nodeHashName, edgeHash: edgeHashName });
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
        this.sourceClassId = this.targetClassId;
        this.targetClassId = sourceClassId;
        const temp = this.sourceChain;
        this.sourceChain = this.targetChain;
        this.targetChain = temp;
      }
    }
    this.mure.saveClasses();
  }
  disconnectSources () {
    this.sourceClassId = null;
    this.sourceChain = new Chain();
  }
  disconnectTargets () {
    this.targetClassId = null;
    this.targetChain = new Chain();
  }
  delete () {
    if (this.sourceClassId) {
      delete this.mure.classes[this.sourceClassId].edgeConnections[this.classId];
    }
    if (this.targetClassId) {
      delete this.mure.classes[this.targetClassId].edgeConnections[this.classId];
    }
    super.delete();
  }
}

export default EdgeClass;
