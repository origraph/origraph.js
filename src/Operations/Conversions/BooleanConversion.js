import BaseConversion from './BaseConversion.js';

class BooleanConversion extends BaseConversion {
  constructor ({ mure, TargetType, standardTypes = [], specialTypes = [] }) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.NullConstruct,
      standardTypes: [
        mure.CONSTRUCTS.NullConstruct,
        mure.CONSTRUCTS.BooleanConstruct,
        mure.CONSTRUCTS.NumberConstruct,
        mure.CONSTRUCTS.DateConstruct,
        mure.CONSTRUCTS.ReferenceConstruct,
        mure.CONSTRUCTS.NodeConstruct,
        mure.CONSTRUCTS.EdgeConstruct,
        mure.CONSTRUCTS.SetConstruct,
        mure.CONSTRUCTS.SupernodeConstruct
      ],
      specialTypes: [
        mure.CONSTRUCTS.StringConstruct
      ]
    });
  }
  specialConversion (item, inputOptions, outputSpec) {
    // TODO: smarter conversion from strings than javascript's default
    item.value = !!item.value;
  }
}
export default BooleanConversion;
