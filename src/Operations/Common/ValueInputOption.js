import { singleMode, glompLists } from './utils.js';
import InputOption from './InputOption.js';

class ValueInputOption extends InputOption {
  constructor ({ name, defaultValue, suggestions = [] }) {
    super({ name, defaultValue });
    this.suggestions = suggestions;
  }
}
ValueInputOption.glomp = optionList => {
  return new ValueInputOption({
    name: singleMode(optionList.map(option => option.name)),
    defaultValue: singleMode(optionList.map(option => option.defaultValue)),
    suggestions: glompLists(optionList.map(option => option.suggestions))
  });
};

export default ValueInputOption;
