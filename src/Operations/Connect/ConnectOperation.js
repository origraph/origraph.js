import ContextualOperation from '../Common/ContextualOperation.js';
import ConnectNodesMixin from './ConnectNodesMixin.js';
import ConnectSetsMixin from './ConnectSetsMixin.js';
import ConnectOnFunctionMixin from './ConnectOnFunctionMixin.js';
import ConnectOnAttributeMixin from './ConnectOnAttributeMixin.js';
import ConnectSubOp from './ConnectSubOp.js';

class ConnectNodesOnFunction extends ConnectOnFunctionMixin(ConnectNodesMixin(ConnectSubOp)) {}
class ConnectNodesOnAttribute extends ConnectOnAttributeMixin(ConnectNodesMixin(ConnectSubOp)) {}
class ConnectSetsOnFunction extends ConnectOnFunctionMixin(ConnectSetsMixin(ConnectSubOp)) {}
class ConnectSetsOnAttribute extends ConnectOnAttributeMixin(ConnectSetsMixin(ConnectSubOp)) {}

class ConnectOperation extends ContextualOperation {
  constructor (mure) {
    super(mure, [
      ConnectNodesOnFunction,
      ConnectNodesOnAttribute,
      ConnectSetsOnFunction,
      ConnectSetsOnAttribute
    ]);
  }
}

export default ConnectOperation;
