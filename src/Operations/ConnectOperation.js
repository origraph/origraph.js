import Selection from '../Selection.js';
import BaseOperation from './Common/BaseOperation.js';
import OutputSpec from './Common/OutputSpec.js';
import ContextualOption from './Common/ContextualOption.js';
import TypedOption from './Common/TypedOption.js';
import AttributeOption from './Common/AttributeOption.js';
import InputOption from './Common/InputOption.js';

const DEFAULT_CONNECT_WHEN = 'return source.label === target.label;';

class ConnectOperation extends BaseOperation {
  getInputSpec () {
    const result = super.getInputSpec();

    // Do we connect nodes in the current selection, or to the nodes inside some
    // set-like construct?
    const context = new ContextualOption({
      parameterName: 'context',
      choices: ['Within Selection', 'Bipartite'],
      defaultValue: 'Within Selection'
    });
    result.addOption(context);

    // For bipartite connection, we need to specify a target document, item, or
    // set (class or group) to connect nodes to
    context.specs['Bipartite'].addOption(new TypedOption({
      parameterName: 'target',
      validTypes: [
        this.mure.CONSTRUCTS.DocumentConstruct,
        this.mure.CONSTRUCTS.ItemConstruct,
        this.mure.CONSTRUCTS.SetConstruct,
        Selection
      ]
    }));
    // The bipartite approach also allows us to specify edge direction
    context.specs['Bipartite'].addOption(new InputOption({
      parameterName: 'directed',
      choices: ['Undirected', 'Directed'],
      defaultValue: 'Undirected'
    }));

    // Either context can be executed by matching attributes or evaluating
    // a function
    const mode = new ContextualOption({
      parameterName: 'mode',
      choices: ['Attribute', 'Function'],
      defaultValue: 'Attribute'
    });
    result.addOption(mode);

    // Attribute mode needs source and target attribute suggestions
    mode.specs['Attribute'].addOption(new AttributeOption({
      parameterName: 'sourceAttribute',
      defaultValue: null // null indicates that the label should be used
    }));
    mode.specs['Attribute'].addOption(new AttributeOption({
      parameterName: 'targetAttribute',
      defaultValue: null // null indicates that the label should be used
    }));

    // Function mode needs the function
    mode.specs['Function'].addOption(new InputOption({
      parameterName: 'connectWhen',
      defaultValue: DEFAULT_CONNECT_WHEN,
      openEnded: true
    }));

    // Final option added to all context / modes: where to store the created
    // edges?
    result.addOption(new TypedOption({
      parameterName: 'saveEdgesIn',
      validTypes: [this.mure.CONSTRUCTS.ItemConstruct]
    }));
  }
  async canExecuteOnInstance (item, inputOptions) {
    return false;
  }
  async executeOnInstance (item, inputOptions) {
    throw new Error(`Running the Connect operation on an instance level is not yet supported.`);
  }
  async canExecuteOnSelection (selection, inputOptions) {
    if (inputOptions.skipErrors !== 'Stop') {
      return true;
    }
    if (!(inputOptions.saveEdgesIn instanceof this.mure.CONSTRUCTS.ItemConstruct)) {
      return false;
    }
    if (inputOptions.context === 'Bipartite') {
      if (!(inputOptions.target instanceof this.mure.CONSTRUCTS.DocumentConstruct ||
            inputOptions.target instanceof this.mure.CONSTRUCTS.ItemConstruct ||
            inputOptions.target instanceof this.mure.CONSTRUCTS.SetConstruct ||
            inputOptions.target instanceof Selection)) {
        return false;
      }
    }
    if (inputOptions.mode === 'Function') {
      if (typeof inputOptions.connectWhen === 'function') {
        return true;
      }
      try {
        Function('source', 'target', // eslint-disable-line no-new-func
          inputOptions.connectWhen || DEFAULT_CONNECT_WHEN);
      } catch (err) {
        if (err instanceof SyntaxError) {
          return false;
        } else {
          throw err;
        }
      }
    }
    return true;
  }
  async executeOnSelection (selection, inputOptions) {
    const output = new OutputSpec();

    // Make sure we have a place to save the edges
    if (!(inputOptions.saveEdgesIn instanceof this.mure.CONSTRUCTS.ItemConstruct)) {
      output.warn(`saveEdgesIn is not an Item`);
      return output;
    }

    // Figure out the criteria for matching nodes
    let connectWhen;
    if (inputOptions.mode === 'Function') {
      connectWhen = inputOptions.connectWhen;
      if (typeof connectWhen !== 'function') {
        try {
          connectWhen = new Function('source', 'target', // eslint-disable-line no-new-func
            inputOptions.connectWhen || DEFAULT_CONNECT_WHEN);
        } catch (err) {
          if (err instanceof SyntaxError) {
            output.warn(`connectWhen SyntaxError: ${err.message}`);
            return output;
          } else {
            throw err;
          }
        }
      }
    } else { // if (inputOptions.mode === 'Attribute')
      const getSourceValue = inputOptions.sourceAttribute === null
        ? source => source.label
        : source => source.value[inputOptions.sourceAttribute];
      const getTargetValue = inputOptions.targetAttribute === null
        ? target => target.label
        : target => target.value[inputOptions.targetAttribute];
      connectWhen = (source, target) => getSourceValue(source) === getTargetValue(target);
    }

    const items = await selection.items();

    if (inputOptions.context === 'Bipartite') {
      // What role are the source nodes playing ('undirected' vs 'source')?
      const direction = inputOptions.directed === 'Directed' ? 'source' : 'undirected';

      // Figure out what nodes we're connecting to...
      let targetList;
      if (inputOptions.target instanceof this.mure.CONSTRUCTS.DocumentConstruct ||
          inputOptions.target instanceof this.mure.CONSTRUCTS.ItemConstruct) {
        targetList = (await inputOptions.target.getContents());
      } else if (inputOptions.target instanceof this.mure.CONSTRUCTS.SetConstruct) {
        targetList = await inputOptions.target.getMembers();
      } else if (inputOptions.target instanceof Selection) {
        targetList = Object.values(await inputOptions.target.items());
      } else {
        output.warn(`Target is not a valid Document, Item, or Set`);
        return output;
      }
      targetList = targetList
        .filter(target => target instanceof this.mure.CONSTRUCTS.NodeConstruct);
      if (targetList.length === 0) {
        output.warn(`Target does not contain any Nodes`);
        return output;
      }

      // Create the edges!
      Object.values(items).forEach(source => {
        targetList.forEach(target => {
          if (connectWhen(source, target)) {
            const newEdge = source.linkTo(target, inputOptions.saveEdgesIn, direction);
            output.addSelectors([newEdge.uniqueSelector]);
            output.flagPollutedDoc(source.doc);
            output.flagPollutedDoc(target.doc);
            output.flagPollutedDoc(newEdge.doc);
          }
        });
      });
    } else { // if (context === 'Within Selection') {
      // We're only creating edges within the selection; we don't have to worry
      // about direction or the other set of nodes, but we do need to iterate in
      // a way that guarantees that we don't duplicate edges
      const sourceList = Object.values(items);
      for (let i = 0; i < sourceList.length; i++) {
        for (let j = i + 1; j < sourceList.length; j++) {
          if (connectWhen(sourceList[i], sourceList[j])) {
            const newEdge = sourceList[i].linkTo(sourceList[j], inputOptions.saveEdgesIn);
            output.addSelectors([newEdge.uniqueSelector]);
            output.flagPollutedDoc(sourceList[i].doc);
            output.flagPollutedDoc(sourceList[j].doc);
            output.flagPollutedDoc(newEdge.doc);
          }
        }
      }
    }
    return output;
  }
}

export default ConnectOperation;
