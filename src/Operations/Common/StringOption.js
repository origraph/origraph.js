import InputOption from './InputOption.js';

class StringOption extends InputOption {
  populateExistingChoiceStrings (choiceDict) {
    this.choices.forEach(choice => {
      if (choice !== null) {
        choiceDict[choice] = true;
      }
    });
  }
}
export default StringOption;
