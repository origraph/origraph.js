import BaseConversion from './BaseConversion.js';

class StringConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.StringConstruct,
      standardTypes: [
        mure.CONSTRUCTS.NullConstruct,
        mure.CONSTRUCTS.BooleanConstruct,
        mure.CONSTRUCTS.NumberConstruct,
        mure.CONSTRUCTS.DateConstruct
      ]
    });
  }
}
export default StringConversion;
