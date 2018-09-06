import GenericWrapper from './GenericWrapper.js';

class EdgeWrapper extends GenericWrapper {
  constructor (options) {
    super(options);
    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }
  async * sourceNodes ({ limit = Infinity } = {}) {
    const iterator = this.iterateAcrossConnections(
      await this.classObj.prepShortestSourcePath());
    for (let i = 0; i < limit; i++) {
      const temp = iterator.next();
      if (!temp.done) {
        yield temp.value;
      }
    }
  }
  async * targetNodes ({ limit = Infinity } = {}) {
    const iterator = this.iterateAcrossConnections(
      await this.classObj.prepShortestTargetPath());
    for (let i = 0; i < limit; i++) {
      const temp = iterator.next();
      if (!temp.done) {
        yield temp.value;
      }
    }
  }
}

export default EdgeWrapper;
