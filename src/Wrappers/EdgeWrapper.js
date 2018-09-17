import GenericWrapper from './GenericWrapper.js';

class EdgeWrapper extends GenericWrapper {
  constructor (options) {
    super(options);
    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }
  async * sourceNodes (options = {}) {
    const sourceTableId = this.classObj._mure
      .classes[this.classObj.sourceClassId].tableId;
    options.tableIds = this.classObj.sourceTableIds
      .concat([ sourceTableId ]);
    yield * this.iterateAcrossConnections(options);
  }
  async * targetNodes (options = {}) {
    const targetTableId = this.classObj._mure
      .classes[this.classObj.targetClassId].tableId;
    options.tableIds = this.classObj.targetTableIds
      .concat([ targetTableId ]);
    yield * this.iterateAcrossConnections(options);
  }
}

export default EdgeWrapper;
