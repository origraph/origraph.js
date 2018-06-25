import { InputSpec, OutputSpec, glompLists, singleMode } from '../common.js';
import BaseOperation from '../BaseOperation.js';
import ChainTerminatingMixin from '../ChainTerminatingMixin.js';

class ConnectNodesOnFunction extends ChainTerminatingMixin(BaseOperation) {
  checkItemInputs (item, inputOptions) {
    return item instanceof this.mure.ITEM_TYPES.NodeItem &&
      inputOptions.otherItem instanceof this.mure.ITEM_TYPES.NodeItem &&
      inputOptions.saveEdgesIn instanceof this.mure.ITEM_TYPES.ContainerItem &&
      typeof inputOptions.connectWhen === 'string';
  }
  inferItemInputs (item) {
    const inputs = new InputSpec();
    inputs.addToggleOption({
      name: 'direction',
      optionList: ['Undirected', 'Directed'],
      defaultValue: 'Undirected'
    });
    inputs.addValueOption({
      name: 'connectWhen',
      defaultValue: '(a, b) => { return a.label === b.label; }'
    });
    inputs.addItemRequirement({
      name: 'otherItem',
      ItemType: this.mure.ITEM_TYPES.NodeItem
    });
    inputs.addItemRequirement({
      name: 'saveEdgesIn',
      ItemType: this.mure.ITEM_TYPES.ContainerItem,
      defaultValue: new this.mure.ITEM_TYPES.ContainerItem(
        this.mure,
        item.doc.$orphanEdges,
        [`{"_id":"${item.doc._id}"}`, '$orphanEdges'],
        item.doc
      )
    });
    return inputs;
  }
  async executeOnItem (item, inputOptions, matchFunc) {
    if (!this.checkItemInputs(item, inputOptions)) {
      throw new Error(`Item and options.otherItem must be NodeItems, and \
options.saveEdgesIn must be a ContainerItem in order to ConnectViaFunction`);
    }
    matchFunc = matchFunc || new Function('a', 'b', inputOptions.connectWhen); // eslint-disable-line no-new-func
    if (matchFunc(item, inputOptions.otherItem)) {
      const newEdge = item.linkTo(inputOptions.otherItem,
        inputOptions.saveEdgesIn, inputOptions.directed === 'Directed');

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
  extractNodeList (items) {
    let saveEdgesIn;
    let nodeList = Object.values(items).reduce((agg, item) => {
      if (item instanceof this.mure.ITEM_TYPES.ContainerItem) {
        if (saveEdgesIn === undefined) {
          saveEdgesIn = item;
        }
      } else if (item instanceof this.mure.ITEM_TYPES.NodeItem) {
        return agg.concat([ item ]);
      }
      return agg;
    }, []);
    if (!saveEdgesIn) {
      const mostFrequentDoc = singleMode(nodeList.map(item => item.doc));
      if (mostFrequentDoc) {
        saveEdgesIn = new this.mure.ITEM_TYPES.ContainerItem({
          mure: this.mure,
          value: mostFrequentDoc.$orphanEdges,
          path: [`{"_id":"${mostFrequentDoc._id}"}`, '$orphanEdges'],
          doc: mostFrequentDoc
        });
      }
    }
    return { nodeList, saveEdgesIn };
  }
  async inferSelectionInputs (selection) {
    const inputs = new InputSpec();
    inputs.addValueOption({
      name: 'connectWhen',
      defaultValue: '(a, b) => { return a.label === b.label; }'
    });
    let { nodeList, saveEdgesIn } = this.extractNodeList(await selection.items());
    if (nodeList.length === 0) {
      return null;
    }
    inputs.addItemRequirement({
      name: 'saveEdgesIn',
      ItemType: this.mure.ITEM_TYPES.ContainerItem,
      defaultValue: saveEdgesIn
    });
    return inputs;
  }
  async executeOnSelection (selection, inputOptions) {
    let { nodeList, saveEdgesIn } = this.extractNodeList(await selection.items());
    const matchFunc = new Function('a', 'b', inputOptions.connectWhen || '(a, b) => { return a.label === b.label; }'); // eslint-disable-line no-new-func
    const outputPromises = [];
    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i; j < nodeList.length; j++) {
        outputPromises.push(this.executeOnItem(
          nodeList[i], {
            otherItem: nodeList[j],
            saveEdgesIn
          },
          matchFunc
        ));
      }
    }
    return OutputSpec.glomp(await Promise.all(outputPromises));
  }
}

export default ConnectNodesOnFunction;
