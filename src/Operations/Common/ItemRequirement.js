import { singleMode, glompLists } from './utils.js';
import InputOption from './InputOption.js';

class ItemRequirement extends InputOption {
  constructor ({ name, defaultValue, itemTypes, suggestions = [] }) {
    super({ name, defaultValue });
    this.itemTypes = itemTypes;
    this.suggestions = suggestions;
  }
}
ItemRequirement.glomp = optionList => {
  return new ItemRequirement({
    name: singleMode(optionList.map(option => option.name)),
    defaultValue: singleMode(optionList.map(option => option.defaultValue)),
    itemTypes: glompLists(optionList.map(option => option.itemTypes)),
    suggestions: glompLists(optionList.map(option => option.suggestions))
  });
};

export default ItemRequirement;
