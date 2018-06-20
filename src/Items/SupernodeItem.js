import BaseItem from './BaseItem.js';
import SetItem from './SetItem.js';
import NodeItem from './NodeItem.js';
import SetItemMixin from './SetItemMixin.js';

class SupernodeItem extends SetItemMixin(NodeItem) {
  canConvertTo (ItemType) {
    return BaseItem.prototype.canConvertTo.call(this, ItemType);
  }
  convertTo (ItemType) {
    return BaseItem.prototype.convertTo.call(this, ItemType);
  }
}
SupernodeItem.getBoilerplateValue = () => {
  return { $tags: {}, $members: {}, $edges: {} };
};
SupernodeItem.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular NodeItem standardization
  value = NodeItem.standardize({ mure, value, path, doc, aggressive });
  // ... and the SetItem standardization
  value = SetItem.standardize({ value });
  return value;
};

export default SupernodeItem;
