import BaseConversion from './BaseConversion.js';

class NumberConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.NumberConstruct,
      standardTypes: [
        mure.CONSTRUCTS.NullConstruct,
        mure.CONSTRUCTS.BooleanConstruct,
        mure.CONSTRUCTS.StringConstruct
      ]
    });
  }
}
export default NumberConversion;
