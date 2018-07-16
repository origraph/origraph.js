import InputOption from './InputOption.js';

class AttributeOption extends InputOption {
  async populateChoicesFromItem (item) {
    // null indicates that the item's label should be used
    return item.getAttributes ? item.getAttributes().unshift(null) : [null];
  }
  async populateChoicesFromSelection (selection) {
    let attributes = {};
    (await Promise.all(Object.values(await selection.items()).map(item => {
      return item.getAttributes ? item.getAttributes() : [];
    }))).forEach(attrList => {
      attrList.forEach(attr => {
        attributes[attr] = true;
      });
    });
    this.choices = Object.keys(attributes);
    this.choices.unshift(null); // null indicates that the item's label should be used
  }
}
export default AttributeOption;
