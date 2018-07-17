import AttributeOption from './AttributeOption.js';

class NestedAttributeOption extends AttributeOption {
  constructor ({ parameterName, defaultValue, choices, openEnded, getItemChoiceRole }) {
    super({ parameterName, defaultValue, choices, openEnded });
    this.getItemChoiceRole = getItemChoiceRole;
  }
  async updateChoices ({ items, inputOptions, reset = false }) {
    let attributes = {};
    if (!reset) {
      this.populateExistingChoiceStrings(attributes);
    }
    const itemList = Object.values(items);
    for (let i = 0; i < itemList.length; i++) {
      const item = itemList[i];
      const itemRole = this.getItemChoiceRole(item, inputOptions);
      if (itemRole === 'standard') {
        await this.populateFromItem(item, attributes);
      } else if (itemRole === 'deep') {
        const children = item.getMembers ? await item.getMembers()
          : item.getContents ? await item.getContents() : {};
        await this.populateFromItems(children);
      } // else if (itemRole === 'ignore')
    }
    this.choices = Object.keys(attributes);
    this.choices.unshift(null); // null indicates that the item's label should be used
  }
}
export default NestedAttributeOption;
