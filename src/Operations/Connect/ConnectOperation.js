import ContextualOperation from '../Common/ContextualOperation.js';
import ConnectNodesMixin from './ConnectNodesMixin.js';
import ConnectSetsMixin from './ConnectSetsMixin.js';
import ConnectOnFunctionMixin from './ConnectOnFunctionMixin.js';
import ConnectOnAttributeMixin from './ConnectOnAttributeMixin.js';
import ConnectSubOp from './ConnectSubOp.js';

class ConnectNodesOnFunctionOperation extends ConnectNodesMixin(ConnectOnFunctionMixin(ConnectSubOp)) {}
class ConnectNodesOnAttributeOperation extends ConnectNodesMixin(ConnectOnAttributeMixin(ConnectSubOp)) {}
class ConnectSetsOnFunctionOperation extends ConnectSetsMixin(ConnectOnFunctionMixin(ConnectSubOp)) {}
class ConnectSetsOnAttributeOperation extends ConnectSetsMixin(ConnectOnAttributeMixin(ConnectSubOp)) {}

class ConnectOperation extends ContextualOperation {
  constructor (mure) {
    super(mure, [
      ConnectNodesOnFunctionOperation,
      ConnectNodesOnAttributeOperation,
      ConnectSetsOnFunctionOperation,
      ConnectSetsOnAttributeOperation
    ]);
  }
}

export default ConnectOperation;
