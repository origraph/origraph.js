import BaseConversion from './BaseConversion.js';

class NullConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.NullWrapper,
      standardTypes: [
        mure.WRAPPERS.BooleanWrapper,
        mure.WRAPPERS.NumberWrapper,
        mure.WRAPPERS.StringWrapper,
        mure.WRAPPERS.DateWrapper,
        mure.WRAPPERS.ReferenceWrapper,
        mure.WRAPPERS.ContainerWrapper,
        mure.WRAPPERS.NodeWrapper,
        mure.WRAPPERS.EdgeWrapper,
        mure.WRAPPERS.SetWrapper,
        mure.WRAPPERS.SupernodeWrapper
      ],
      specialTypes: []
    });
  }
}
export default NullConversion;
