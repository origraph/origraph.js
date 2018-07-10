import { glompLists } from './utils.js';
import InputOption from './InputOption.js';

class ConstructRequirement extends InputOption {
  constructor ({ name, defaultValue, itemTypes, suggestions = [] }) {
    super({ name, defaultValue });
    this.itemTypes = itemTypes;
    this.suggestions = suggestions;
  }
}
ConstructRequirement.glomp = optionList => {
  const suggestions = glompLists(optionList.map(option => option.suggestions));
  return new ConstructRequirement({
    name: optionList.some(option => option.name),
    defaultValue: suggestions[0],
    itemTypes: glompLists(optionList.map(option => option.itemTypes)),
    suggestions
  });
};

export default ConstructRequirement;
