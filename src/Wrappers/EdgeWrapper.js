import GenericWrapper from './GenericWrapper.js';

class EdgeWrapper extends GenericWrapper {
  constructor (options) {
    super(options);
    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }
  async * sourceNodes (options = {}) {
    if (this.classObj.sourceClassId === null ||
        (options.classes && !options.classes.find(d => this.classObj.sourceClassId === d.classId)) ||
        (options.classIds && options.classIds.indexOf(this.classObj.sourceClassId) === -1)) {
      return;
    }
    const sourceTableId = this.classObj.model
      .classes[this.classObj.sourceClassId].tableId;
    const tableIds = this.classObj.sourceTableIds.concat([ sourceTableId ]);
    yield * this.handleLimit(options, [
      this.iterateAcrossConnections(tableIds)
    ]);
  }
  async * targetNodes (options = {}) {
    if (this.classObj.targetClassId === null ||
        (options.classes && !options.classes.find(d => this.classObj.targetClassId === d.classId)) ||
        (options.classIds && options.classIds.indexOf(this.classObj.targetClassId) === -1)) {
      return;
    }
    const targetTableId = this.classObj.model
      .classes[this.classObj.targetClassId].tableId;
    const tableIds = this.classObj.targetTableIds.concat([ targetTableId ]);
    yield * this.handleLimit(options, [
      this.iterateAcrossConnections(tableIds)
    ]);
  }
  async * nodes (options = {}) {
    yield * this.handleLimit(options, [
      this.sourceNodes(options),
      this.targetNodes(options)
    ]);
  }
  async * pairwiseNeighborhood (options) {
    for await (const source of this.sourceNodes(options)) {
      for await (const target of this.targetNodes(options)) {
        yield {
          source,
          target,
          edge: this
        };
      }
    }
  }
}

export default EdgeWrapper;
