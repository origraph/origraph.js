import BaseWrapper from './BaseWrapper.js';

class RootWrapper extends BaseWrapper {
  constructor ({ mure, docList }) {
    super({
      mure,
      path: [],
      value: {},
      parent: null,
      doc: null,
      label: null,
      uniqueSelector: '@'
    });
    docList.forEach(doc => {
      this.value[doc._id] = doc;
    });
  }
  remove () {
    throw new Error(`Can't remove the root item`);
  }
}
export default RootWrapper;
