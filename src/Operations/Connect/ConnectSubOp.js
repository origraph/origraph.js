import InputSpec from '../Common/InputSpec.js';
import OutputSpec from '../Common/OutputSpec.js';
import { glompLists } from '../Common/utils.js';
import BaseOperation from '../Common/BaseOperation.js';
import ChainTerminatingMixin from '../Common/ChainTerminatingMixin.js';

class ConnectSubOp extends ChainTerminatingMixin(BaseOperation) {
  inferItemInputs (item) {
    const inputs = new InputSpec();
    inputs.addToggleOption({
      name: 'direction',
      choices: ['undirected', 'source', 'target'],
      defaultValue: 'undirected'
    });
    inputs.addValueOption({
      name: 'connectWhen',
      defaultValue: ConnectSubOp.DEFAULT_CONNECT_WHEN
    });
    inputs.addItemRequirement({
      name: 'otherItem',
      itemTypes: [this.mure.ITEM_TYPES.NodeItem]
    });
    inputs.addItemRequirement({
      name: 'saveEdgesIn',
      itemTypes: [this.mure.ITEM_TYPES.ContainerItem]
    });
    return inputs;
  }
  async executeOnItem (item, inputOptions) {
    const match = inputOptions.connectWhen || ConnectSubOp.DEFAULT_CONNECT_WHEN;
    if (match(item, inputOptions.otherItem)) {
      const newEdge = item.linkTo(inputOptions.otherItem,
        inputOptions.saveEdgesIn, inputOptions.direction);

      return new OutputSpec({
        newSelectors: [ newEdge.uniqueSelector ],
        pollutedDocs: glompLists([
          [item.doc, inputOptions.otherItem.doc, newEdge.doc]
        ])
      });
    } else {
      return new OutputSpec();
    }
  }
  async pollSelection (selection, callback = () => {}) {
    const items = await selection.items();
    let containers = [];
    const docs = {};
    Object.values(items).forEach(item => {
      if (item.constructor.name === 'ContainerItem') {
        containers.push(item);
      }
      docs[item.doc._id] = item.doc;

      callback(item);
    });
    containers = containers.concat(Object.values(docs).map(doc => {
      return new this.mure.ITEM_TYPES.ContainerItem({
        mure: this.mure,
        value: doc.orphans,
        path: [`{"_id":"${doc._id}"}`, 'orphans'],
        doc: doc
      });
    }));
    return containers;
  }
}
ConnectSubOp.DEFAULT_CONNECT_WHEN = (a, b) => { return a.label === b.label; };

export default ConnectSubOp;
