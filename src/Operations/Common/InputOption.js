import Introspectable from '../../Common/Introspectable.js';

class InputOption extends Introspectable {
  constructor ({
    parameterName,
    defaultValue = null,
    choices = [],
    openEnded = false
  }) {
    super();
    this.parameterName = parameterName;
    this._defaultValue = defaultValue;
    this.choices = choices;
    this.openEnded = openEnded;
  }
  get humanReadableParameterName () {
    return this.parameterName
      .replace(/./, this.parameterName[0].toLocaleUpperCase())
      .replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  get defaultValue () {
    if (this._defaultValue !== null) {
      return this._defaultValue;
    } else if (this.choices.length > 0) {
      return this.choices[0];
    } else {
      return null;
    }
  }
  set defaultValue (value) {
    this._defaultValue = value;
  }
}
Object.defineProperty(InputOption, 'type', {
  get () {
    return /(.*)Option/.exec(this.name)[1];
  }
});
export default InputOption;
