import InputOption from './InputOption.js';

class ClassOption extends InputOption {
  async populateChoicesFromItem (item) {
    return item.getClasses ? item.getClasses() : [];
  }
  async populateChoicesFromSelection (selection) {
    let classes = {};
    (await Promise.all(Object.values(await selection.items()).map(item => {
      return item.getClasses ? item.getClasses() : [];
    }))).forEach(attrList => {
      attrList.forEach(className => {
        classes[className] = true;
      });
    });
    this.choices = Object.keys(classes);
  }
}
export default ClassOption;
