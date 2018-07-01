import InputOption from './InputOption.js';
import ValueInputOption from './ValueInputOption.js';
import ToggleInputOption from './ToggleInputOption.js';
import ItemRequirement from './ItemRequirement.js';

class InputSpec {
  constructor () {
    this.options = {};
  }
  addValueOption (optionDetails) {
    this.options[optionDetails.name] = new ValueInputOption(optionDetails);
  }
  addToggleOption (optionDetails) {
    this.options[optionDetails.name] = new ToggleInputOption(optionDetails);
  }
  addItemRequirement (optionDetails) {
    this.options[optionDetails.name] = new ItemRequirement(optionDetails);
  }
  addMiscOption (optionDetails) {
    this.options[optionDetails.name] = new InputOption(optionDetails);
  }
}
InputSpec.glomp = specList => {
  if (specList.length === 0 || specList.indexOf(null) !== -1) {
    return null;
  }
  let result = new InputSpec();

  specList.reduce((agg, spec) => {
    return agg.concat(Object.keys(spec.options));
  }, []).forEach(optionName => {
    const inputSpecWOption = specList.find(spec => spec.options[optionName]);
    const glompFunc = inputSpecWOption.options[optionName].constructor.glomp;
    const glompedOption = glompFunc(specList.map(spec => spec.options[optionName]));
    result.options[optionName] = glompedOption;
  });

  return result;
};

export default InputSpec;
