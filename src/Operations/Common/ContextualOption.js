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
}
export default ContextualOption;
