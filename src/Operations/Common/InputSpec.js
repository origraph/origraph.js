class InputSpec {
  constructor () {
    this.options = {};
  }
  addOption (option) {
    this.options[option.parameterName] = option;
  }
  getDefaultInputOptions () {
    let inputOptions = {};

    let defaultExists = Object.entries(this.options).every(([opName, option]) => {
      let value;
      if (option.specs) {
        value = option.getNestedDefaultValues(inputOptions);
      } else {
        value = option.defaultValue;
      }
      if (value !== null) {
        inputOptions[opName] = value;
        return true;
      } else {
        return false;
      }
    });

    if (!defaultExists) {
      return null;
    } else {
      return inputOptions;
    }
  }
  async populateChoicesFromItem (item) {
    return Promise.all(Object.values(this.options).map(option => {
      if (option.specs) {
        return Promise.all(Object.values(option.specs)
          .map(spec => spec.populateChoicesFromItem(item)));
      } else if (option.populateChoicesFromItem) {
        return option.populateChoicesFromItem(item);
      }
    }));
  }
  async populateChoicesFromSelection (selection) {
    return Promise.all(Object.values(this.options).map(option => {
      if (option.specs) {
        return Promise.all(Object.values(option.specs)
          .map(spec => spec.populateChoicesFromSelection(selection)));
      } else if (option.populateChoicesFromSelection) {
        return option.populateChoicesFromSelection(selection);
      }
    }));
  }
}

export default InputSpec;
