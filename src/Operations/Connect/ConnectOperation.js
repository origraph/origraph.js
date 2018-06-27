import ContextualOperation from '../ContextualOperation.js';
import ConnectNodesOnFunction from './ConnectNodesOnFunction.js';

class ConnectOperation extends ContextualOperation {
  constructor (mure) {
    super(mure, [
      ConnectNodesOnFunction
    ]);
  }
}

export default ConnectOperation;
