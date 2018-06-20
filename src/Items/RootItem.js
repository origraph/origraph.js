import BaseItem from './BaseItem.js';

class RootItem extends BaseItem {
  constructor ({ mure, docList, selectSingle }) {
    super({
      mure,
      path: [],
      value: {},
      parent: null,
      doc: null,
      label: null,
      uniqueSelector: '@',
      classes: []
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
export default RootItem;
