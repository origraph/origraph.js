import BaseConversion from './BaseConversion.js';

class NumberConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.NumberWrapper,
      standardTypes: [
        mure.WRAPPERS.NullWrapper,
        mure.WRAPPERS.BooleanWrapper,
        mure.WRAPPERS.StringWrapper
      ]
    });
  }
}
export default NumberConversion;
