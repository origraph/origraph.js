import BaseConversion from './BaseConversion.js';

class StringConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.BooleanConstruct,
      standardTypes: [
        mure.CONSTRUCTS.NullConstruct,
        mure.CONSTRUCTS.BooleanConstruct,
        mure.CONSTRUCTS.NumberConstruct,
        mure.CONSTRUCTS.StringConstruct,
        mure.CONSTRUCTS.DateConstruct
      ]
    });
  }
}
export default StringConversion;
