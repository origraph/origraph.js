import BaseItem from './BaseItem.js';
import TaggableItem from './TaggableItem.js';

class EdgeItem extends TaggableItem {
  constructor ({ mure, value, path, doc }) {
    super(mure, value, path, doc);
    if (!value.$nodes) {
      throw new TypeError(`EdgeItem requires a $nodes object`);
    }
  }
  canConvertTo (ItemType) {
    return BaseItem.prototype.canConvertTo.call(this, ItemType);
  }
  convertTo (ItemType) {
    return BaseItem.prototype.convertTo.call(this, ItemType);
  }
  async nodeItems () {

  }
}
EdgeItem.getBoilerplateValue = () => {
  return { $tags: {}, $nodes: {} };
};
EdgeItem.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular TaggableItem standardization
  value = TaggableItem.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of a $nodes object
  value.$nodes = value.$nodes || {};
  return value;
};

export default EdgeItem;
