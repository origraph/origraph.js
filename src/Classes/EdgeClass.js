import GenericClass from './GenericClass.js';

class EdgeClass extends GenericClass {
  constructor (options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.EdgeWrapper;
    this._sourceSelector = null;
    this._targetSelector = null;
    this.directed = false;
  }
  connectToNodeClass ({ nodeClass, direction, nodeHash, edgeHash }) {
    if (direction === 'source') {
      if (this._sourceSelector) {
        delete this.mure.classes[this._sourceSelector]._connections[this.selector];
      }
      this._sourceSelector = nodeClass.selector;
    } else if (direction === 'target') {
      if (this._targetSelector) {
        delete this.mure.classes[this._targetSelector]._connections[this.selector];
      }
      this._targetSelector = nodeClass.selector;
    } else {
      if (!this._sourceSelector) {
        this._sourceSelector = nodeClass.selector;
      } else if (!this._targetSelector) {
        this._targetSelector = nodeClass.selector;
      } else {
        throw new Error(`Source and target are already defined; please specify a direction to override`);
      }
    }
    nodeClass._connections[this.selector] = { nodeHash, edgeHash };
  }
  getStream (options) {
    throw new Error(`unimplemented`);
  }
}

export default EdgeClass;
