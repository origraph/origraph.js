import StringOption from './StringOption.js';

class ClassOption extends StringOption {
  async updateChoices ({ items, reset = false }) {
    let classes = {};
    if (!reset) {
      this.populateExistingChoiceStrings(classes);
    }
    Object.values(items).map(item => {
      return item.getClasses ? item.getClasses() : [];
    }).forEach(classList => {
      classList.forEach(className => {
        classes[className] = true;
      });
    });
    this.choices = Object.keys(classes);
  }
}
export default ClassOption;
