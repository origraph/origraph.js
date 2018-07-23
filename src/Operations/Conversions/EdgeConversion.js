import BaseConversion from './BaseConversion.js';

class EdgeConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.EdgeConstruct,
      standardTypes: [
        mure.CONSTRUCTS.ItemConstruct
      ],
      specialTypes: []
    });
  }
}
export default EdgeConversion;
