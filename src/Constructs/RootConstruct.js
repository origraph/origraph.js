import BaseConstruct from './BaseConstruct.js';

class RootConstruct extends BaseConstruct {
  constructor ({ mure, docList, selectSingle }) {
    super({
      mure,
      path: [],
      value: {},
      parent: null,
      doc: null,
      label: null,
      uniqueSelector: '@'
    });
    docList.some(doc => {
      this.value[doc._id] = doc;
      return selectSingle;
    });
  }
  remove () {
    throw new Error(`Can't remove the root item`);
  }
}
export default RootConstruct;
