import BaseConversion from './BaseConversion.js';

class NodeConversion extends BaseConversion {
  constructor ({ mure, TargetType, standardTypes = [], specialTypes = [] }) {
    super({
      mure,
      TargetType: mure.CONSTRUCTS.NullConstruct,
      standardTypes: [
        mure.CONSTRUCTS.ItemConstruct
      ],
      specialTypes: []
    });
  }
}
export default NodeConversion;
