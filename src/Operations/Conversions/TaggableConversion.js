import BaseConversion from './BaseConversion.js';

class TaggableConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.TaggableConstruct,
      standardTypes: [
        mure.CONSTRUCTS.ItemConstruct
      ],
      specialTypes: []
    });
  }
}
export default TaggableConversion;
