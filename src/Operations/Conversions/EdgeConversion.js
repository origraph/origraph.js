import BaseConversion from './BaseConversion.js';

class EdgeConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.EdgeWrapper,
      standardTypes: [
        mure.WRAPPERS.ContainerWrapper
      ],
      specialTypes: []
    });
  }
}
export default EdgeConversion;
