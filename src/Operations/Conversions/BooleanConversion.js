import BaseConversion from './BaseConversion.js';

class BooleanConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.BooleanWrapper,
      standardTypes: [
        mure.WRAPPERS.NullWrapper,
        mure.WRAPPERS.NumberWrapper,
        mure.WRAPPERS.DateWrapper,
        mure.WRAPPERS.ReferenceWrapper,
        mure.WRAPPERS.ContainerWrapper,
        mure.WRAPPERS.NodeWrapper,
        mure.WRAPPERS.EdgeWrapper,
        mure.WRAPPERS.SetWrapper,
        mure.WRAPPERS.SupernodeWrapper
      ],
      specialTypes: [
        mure.WRAPPERS.StringWrapper
      ]
    });
  }
  specialConversion (item, inputOptions, outputSpec) {
    // TODO: smarter conversion from strings than javascript's default
    item.value = !!item.value;
  }
}
export default BooleanConversion;
