import BaseConversion from './BaseConversion.js';

class NodeConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.NodeConstruct,
      standardTypes: [
        mure.CONSTRUCTS.ItemConstruct
      ],
      specialTypes: []
    });
  }
}
export default NodeConversion;
