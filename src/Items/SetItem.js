import BaseItem from './BaseItem.js';
import TypedItem from './TypedItem.js';
import SetItemMixin from './SetItemMixin.js';

class SetItem extends SetItemMixin(TypedItem) {
  canConvertTo (ItemType) {
    return BaseItem.prototype.canConvertTo.call(this, ItemType);
  }
  convertTo (ItemType) {
    return BaseItem.prototype.convertTo.call(this, ItemType);
  }
}
SetItem.getBoilerplateValue = () => {
  return { $members: {} };
};
SetItem.standardize = ({ value }) => {
  // Ensure the existence of a $members object
  value.$members = value.$members || {};
  return value;
};

export default SetItem;
