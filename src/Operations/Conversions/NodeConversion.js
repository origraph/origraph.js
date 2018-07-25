import BaseConversion from './BaseConversion.js';

class NodeConversion extends BaseConversion {
  constructor (mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.NodeWrapper,
      standardTypes: [
        mure.WRAPPERS.ContainerWrapper
      ],
      specialTypes: []
    });
  }
}
export default NodeConversion;
