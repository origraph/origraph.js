import { glompLists } from './utils.js';
import InputOption from './InputOption.js';

class ValueInputOption extends InputOption {
  constructor ({ name, defaultValue, suggestions = [] }) {
    super({ name, defaultValue });
    this.suggestions = suggestions;
  }
}
ValueInputOption.glomp = optionList => {
  const suggestions = glompLists(optionList.map(option => option.suggestions));
  return new ValueInputOption({
    name: optionList.some(option => option.name),
    defaultValue: suggestions[0],
    suggestions
  });
};

export default ValueInputOption;
