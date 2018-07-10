import ContextualOperation from '../Common/ContextualOperation.js';
import ConnectNodesMixin from './ConnectNodesMixin.js';
import ConnectSetsMixin from './ConnectSetsMixin.js';
import ConnectOnFunctionMixin from './ConnectOnFunctionMixin.js';
import ConnectOnAttributeMixin from './ConnectOnAttributeMixin.js';
import ConnectSubOp from './ConnectSubOp.js';

class ConnectNodesOnFunction extends ConnectNodesMixin(ConnectOnFunctionMixin(ConnectSubOp)) {}
class ConnectNodesOnAttribute extends ConnectNodesMixin(ConnectOnAttributeMixin(ConnectSubOp)) {}
class ConnectSetsOnFunction extends ConnectSetsMixin(ConnectOnFunctionMixin(ConnectSubOp)) {}
class ConnectSetsOnAttribute extends ConnectSetsMixin(ConnectOnAttributeMixin(ConnectSubOp)) {}

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
