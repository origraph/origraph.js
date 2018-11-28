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
    options.tableIds = this.classObj.sourceTableIds
      .concat([ sourceTableId ]);
    yield * this.iterateAcrossConnections(options);
  }
  async * targetNodes (options = {}) {
    if (this.classObj.targetClassId === null ||
        (options.classes && !options.classes.find(d => this.classObj.targetClassId === d.classId)) ||
        (options.classIds && options.classIds.indexOf(this.classObj.targetClassId) === -1)) {
      return;
    }
    const targetTableId = this.classObj.model
      .classes[this.classObj.targetClassId].tableId;
    options.tableIds = this.classObj.targetTableIds
      .concat([ targetTableId ]);
    yield * this.iterateAcrossConnections(options);
  }
  async * nodes (options) {
    yield * this.sourceNodes(options);
    yield * this.targetNodes(options);
  }
  async * pairwiseEdges (options) {
    for await (const source of this.sourceNodes(options)) {
      for await (const target of this.targetNodes(options)) {
        yield { source, edge: this, target };
      }
    }
  }
  async hyperedge (options) {
    const result = {
      sources: [],
      targets: [],
      edge: this
    };
    for await (const source of this.sourceNodes(options)) {
      result.push(source);
    }
    for await (const target of this.targetNodes(options)) {
      result.push(target);
    }
  }
}

export default EdgeWrapper;
