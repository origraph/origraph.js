import BaseConversion from './BaseConversion.js';

class NullConversion extends BaseConversion {
  constructor ({ mure, TargetType, standardTypes = [], specialTypes = [] }) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.NullConstruct,
      standardTypes: [
        mure.CONSTRUCTS.NullConstruct,
        mure.CONSTRUCTS.BooleanConstruct,
        mure.CONSTRUCTS.NumberConstruct,
        mure.CONSTRUCTS.StringConstruct,
        mure.CONSTRUCTS.DateConstruct,
        mure.CONSTRUCTS.ReferenceConstruct,
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
