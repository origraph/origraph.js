import ContextualOperation from '../Common/ContextualOperation.js';
import ConnectNodesOnFunction from './ConnectNodesOnFunction.js';
import ConnectSetsOnAttribute from './ConnectSetsOnAttribute.js';

class ConnectOperation extends ContextualOperation {
  constructor (mure) {
    super(mure, [
      ConnectNodesOnFunction,
      ConnectSetsOnAttribute
    ]);
  }
}

export default ConnectOperation;
