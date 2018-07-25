class InputSpec {
  constructor () {
    this.options = {};
  }
  addOption (option) {
    this.options[option.parameterName] = option;
  }
  async updateChoices (params) {
    return Promise.all(Object.values(this.options).map(option => {
      if (option.specs) {
        return Promise.all(Object.values(option.specs)
          .map(spec => spec.updateChoices(params)));
      } else if (option.updateChoices) {
        return option.updateChoices(params);
      }
    }));
  }
}

export default InputSpec;
