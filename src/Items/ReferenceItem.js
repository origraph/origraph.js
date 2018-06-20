import BaseItem from './BaseItem.js';
import StringItem from './StringItem.js';

class ReferenceItem extends StringItem {
  canConvertTo (ItemType) {
    return BaseItem.prototype.canConvertTo.call(this, ItemType);
  }
  convertTo (ItemType) {
    return BaseItem.prototype.convertTo.call(this, ItemType);
  }
}
ReferenceItem.getBoilerplateValue = () => '@$';

export default ReferenceItem;
