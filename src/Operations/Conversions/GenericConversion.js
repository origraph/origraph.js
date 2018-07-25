import BaseConversion from './BaseConversion.js';

class GenericConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.GenericWrapper,
      standardTypes: [
        mure.WRAPPERS.ContainerWrapper
      ],
      specialTypes: []
    });
  }
}
export default GenericConversion;
