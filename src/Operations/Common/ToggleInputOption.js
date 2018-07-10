import { glompLists } from './utils.js';
import InputOption from './InputOption.js';

class ToggleInputOption extends InputOption {
  constructor ({ name, defaultValue, choices }) {
    super({ name, defaultValue });
    this.choices = choices;
  }
}
ToggleInputOption.glomp = optionList => {
  const choices = glompLists(optionList.map(option => option.choices));
  return new ToggleInputOption({
    name: optionList.some(option => option.name),
    defaultValue: choices[0],
    choices
  });
};

export default ToggleInputOption;
