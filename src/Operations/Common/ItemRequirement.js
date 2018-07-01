import { singleMode, glompObjs } from './utils.js';
import InputOption from './InputOption.js';

class ItemRequirement extends InputOption {
  constructor ({ name, defaultValue, ItemType, eligibleItems = {} }) {
    super({ name, defaultValue });
    this.ItemType = ItemType;
    this.eligibleItems = eligibleItems;
  }
}
ItemRequirement.glomp = optionList => {
  return new ItemRequirement({
    name: singleMode(optionList.map(option => option.name)),
    defaultValue: singleMode(optionList.map(option => option.defaultValue)),
    ItemType: singleMode(optionList.map(option => option.ItemType)),
    eligibleItems: glompObjs(optionList.map(option => option.eligibleItems))
  });
};

export default ItemRequirement;
