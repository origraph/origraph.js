import BaseConversion from './BaseConversion.js';

class StringConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.StringWrapper,
      standardTypes: [
        mure.WRAPPERS.NullWrapper,
        mure.WRAPPERS.BooleanWrapper,
        mure.WRAPPERS.NumberWrapper,
        mure.WRAPPERS.DateWrapper
      ]
    });
  }
}
export default StringConversion;
