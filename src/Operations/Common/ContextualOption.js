import InputSpec from './InputSpec.js';
import InputOption from './InputOption.js';

class ContextualOption extends InputOption {
  constructor ({ parameterName, defaultValue, choices = [], hiddenChoices = [] }) {
    if (choices.length < 2) {
      throw new Error('Contextual options must specify at least two choices a priori');
    }
    super({ parameterName, defaultValue, choices, openEnded: false });
    this.specs = {};
    choices.concat(hiddenChoices).forEach(choice => {
      this.specs[choice] = new InputSpec();
    });
  }
  getNestedDefaultValues (inputOptions) {
    let choice = this.defaultValue;
    let nestedDefaults = this.specs[choice].getDefaultInputOptions();
    if (nestedDefaults === null) {
      choice = this.choices.some(choice => {
        nestedDefaults = this.specs[choice].getDefaultInputOptions();
        return nestedDefaults && choice;
      });
    }
    if (nestedDefaults) {
      Object.assign(inputOptions, nestedDefaults);
      return choice;
    } else {
      return null;
    }
  }
}
export default ContextualOption;
