import BaseConversion from './BaseConversion.js';

class GenericConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.GenericConstruct,
      standardTypes: [
        mure.CONSTRUCTS.ContainerConstruct
      ],
      specialTypes: []
    });
  }
}
export default GenericConversion;
