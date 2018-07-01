import { singleMode, glompLists } from './utils.js';
import InputOption from './InputOption.js';

class ToggleInputOption extends InputOption {
  constructor ({ name, defaultValue, choices }) {
    super({ name, defaultValue });
    this.choices = choices;
  }
}
ToggleInputOption.glomp = optionList => {
  return new ToggleInputOption({
    name: singleMode(optionList.map(option => option.name)),
    defaultValue: singleMode(optionList.map(option => option.defaultValue)),
    choices: glompLists(optionList.map(option => option.choices))
  });
};

export default ToggleInputOption;
