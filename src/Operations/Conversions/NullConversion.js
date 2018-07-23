import BaseConversion from './BaseConversion.js';

class NullConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.NullConstruct,
      standardTypes: [
        mure.CONSTRUCTS.BooleanConstruct,
        mure.CONSTRUCTS.NumberConstruct,
        mure.CONSTRUCTS.StringConstruct,
        mure.CONSTRUCTS.DateConstruct,
        mure.CONSTRUCTS.ReferenceConstruct,
        mure.CONSTRUCTS.ItemConstruct,
        mure.CONSTRUCTS.NodeConstruct,
        mure.CONSTRUCTS.EdgeConstruct,
        mure.CONSTRUCTS.SetConstruct,
        mure.CONSTRUCTS.SupernodeConstruct
      ],
      specialTypes: []
    });
  }
}
export default NullConversion;
