import TypedItem from './TypedItem.js';
import SetItemMixin from './SetItemMixin.js';

class SetItem extends SetItemMixin(TypedItem) {
  memberSelectors () {
    return Object.keys(this.value.$members);
  }
  async memberItems () {
    return this.mure.selectAll(this.memberSelectors()).items();
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
