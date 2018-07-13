import BaseConstruct from './BaseConstruct.js';

class RootConstruct extends BaseConstruct {
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
export default RootConstruct;
