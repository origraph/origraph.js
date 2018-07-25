import StringOption from './StringOption.js';

class AttributeOption extends StringOption {
  async populateFromItem (item, attributes) {
    if (item.getAttributes) {
      (await item.getAttributes()).forEach(attr => {
        attributes[attr] = true;
      });
    }
  }
  async populateFromItems (items, attributes) {
    return Promise.all(Object.values(items).map(item => {
      return this.populateFromItem(item, attributes);
    }));
  }
  async updateChoices ({ items, inputOptions, reset = false }) {
    let attributes = {};
    if (!reset) {
      this.populateExistingChoiceStrings(attributes);
    }
    await this.populateFromItems(items, attributes);
    this.choices = Object.keys(attributes);
    this.choices.unshift(null); // null indicates that the item's label should be used
  }
}
export default AttributeOption;
