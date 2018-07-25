import Selection from '../Selection.js';
import BaseOperation from './Common/BaseOperation.js';
import OutputSpec from './Common/OutputSpec.js';
import ContextualOption from './Common/ContextualOption.js';
import TypedOption from './Common/TypedOption.js';
import NestedAttributeOption from './Common/NestedAttributeOption.js';
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
      hiddenChoices: ['Target Container'],
      defaultValue: 'Within Selection'
    });
    result.addOption(context);

    // For some contexts, we need to specify source and/or target documents,
    // items, or sets (classes or groups)
    context.specs['Bipartite'].addOption(new TypedOption({
      parameterName: 'sources',
      validTypes: [
        this.mure.CONSTRUCTS.DocumentConstruct,
        this.mure.CONSTRUCTS.ContainerConstruct,
        this.mure.CONSTRUCTS.SetConstruct,
        this.mure.CONSTRUCTS.SupernodeConstruct,
        Selection
      ]
    }));
    const targets = new TypedOption({
      parameterName: 'targets',
      validTypes: [
        this.mure.CONSTRUCTS.DocumentConstruct,
        this.mure.CONSTRUCTS.ContainerConstruct,
        this.mure.CONSTRUCTS.SetConstruct,
        this.mure.CONSTRUCTS.SupernodeConstruct,
        Selection
      ]
    });
    context.specs['Bipartite'].addOption(targets);
    context.specs['Target Container'].addOption(targets);

    // Edge direction
    const direction = new InputOption({
      parameterName: 'directed',
      choices: ['Undirected', 'Directed'],
      defaultValue: 'Undirected'
    });
    context.specs['Bipartite'].addOption(direction);
    context.specs['Target Container'].addOption(direction);

    // All contexts can be executed by matching attributes or evaluating
    // a function
    const mode = new ContextualOption({
      parameterName: 'mode',
      choices: ['Attribute', 'Function'],
      defaultValue: 'Attribute'
    });
    result.addOption(mode);

    // Attribute mode needs source and target attributes
    mode.specs['Attribute'].addOption(new NestedAttributeOption({
      parameterName: 'sourceAttribute',
      defaultValue: null, // null indicates that the label should be used
      getItemChoiceRole: (item, inputOptions) => {
        if (item.equals(inputOptions.saveEdgesIn)) {
          return 'ignore';
        } else if (inputOptions.context === 'Bipartite') {
          if (inputOptions.sources && item.equals(inputOptions.sources)) {
            return 'deep';
          } else {
            return 'ignore';
          }
        } else if (inputOptions.targets && item.equals(inputOptions.targets)) {
          return 'ignore';
        } else {
          return 'standard';
        }
      }
    }));
    mode.specs['Attribute'].addOption(new NestedAttributeOption({
      parameterName: 'targetAttribute',
      defaultValue: null, // null indicates that the label should be used
      getItemChoiceRole: (item, inputOptions) => {
        if (item.equals(inputOptions.saveEdgesIn)) {
          return 'ignore';
        } else if (inputOptions.targets && item.equals(inputOptions.targets)) {
          return 'deep';
        } else if (inputOptions.context === 'Bipartite') {
          return 'ignore';
        } else {
          return 'standard';
        }
      }
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
      validTypes: [this.mure.CONSTRUCTS.ContainerConstruct],
      suggestOrphans: true
    }));

    return result;
  }
  async canExecuteOnInstance (item, inputOptions) {
    return false;
  }
  async executeOnInstance (item, inputOptions) {
    throw new Error(`Running the Connect operation on an instance is not supported.`);
  }
  async canExecuteOnSelection (selection, inputOptions) {
    if (inputOptions.ignoreErrors !== 'Stop on Error') {
      return true;
    }
    if (!(inputOptions.saveEdgesIn instanceof this.mure.CONSTRUCTS.ContainerConstruct)) {
      return false;
    }
    if (inputOptions.context === 'Bipartite') {
      if (!(
        (inputOptions.sources instanceof this.mure.CONSTRUCTS.DocumentConstruct ||
         inputOptions.sources instanceof this.mure.CONSTRUCTS.ContainerConstruct ||
         inputOptions.sources instanceof this.mure.CONSTRUCTS.SetConstruct) &&
        (inputOptions.targets instanceof this.mure.CONSTRUCTS.DocumentConstruct ||
         inputOptions.targets instanceof this.mure.CONSTRUCTS.ContainerConstruct ||
         inputOptions.targets instanceof this.mure.CONSTRUCTS.SetConstruct))) {
        return false;
      }
    } else if (inputOptions.context === 'Target Container') {
      if (!inputOptions.targets || !inputOptions.targets.items) {
        return false;
      }
      let items = await selection.items();
      let targetItems = await inputOptions.targets.items();
      return Object.values(items)
        .some(item => item instanceof this.mure.CONSTRUCTS.NodeConstruct) &&
        Object.values(targetItems)
          .some(item => item instanceof this.mure.CONSTRUCTS.NodeConstruct);
    } else { // inputOptions.context === 'Within Selection'
      const items = await selection.items();
      let count = 0;
      const atLeastTwoNodes = Object.values(items).some(item => {
        if (item instanceof this.mure.CONSTRUCTS.NodeConstruct) {
          count += 1;
          if (count >= 2) {
            return true;
          }
        }
      });
      if (!atLeastTwoNodes) {
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
        return true;
      } catch (err) {
        if (err instanceof SyntaxError) {
          return false;
        } else {
          throw err;
        }
      }
    } else {
      return inputOptions.sourceAttribute && inputOptions.targetAttribute;
    }
  }
  async executeWithinSelection (items, connectWhen, saveEdgesIn, output) {
    // We're only creating edges within the selection; we don't have to worry
    // about direction or the other set of nodes, but we do need to iterate in
    // a way that guarantees that we don't duplicate edges
    const sourceList = Object.values(items);
    for (let i = 0; i < sourceList.length; i++) {
      for (let j = i + 1; j < sourceList.length; j++) {
        if (connectWhen(sourceList[i], sourceList[j])) {
          const newEdge = sourceList[i].connectTo(sourceList[j], saveEdgesIn);
          output.addSelectors([newEdge.uniqueSelector]);
          output.flagPollutedDoc(sourceList[i].doc);
          output.flagPollutedDoc(sourceList[j].doc);
          output.flagPollutedDoc(newEdge.doc);
        }
      }
    }
    return output;
  }
  async executeOnSelection (selection, inputOptions) {
    const output = new OutputSpec();

    // Make sure we have a place to save the edges
    if (!(inputOptions.saveEdgesIn instanceof this.mure.CONSTRUCTS.ContainerConstruct)) {
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

    let sources;
    if (inputOptions.context === 'Bipartite') {
      if (inputOptions.sources instanceof Selection) {
        sources = await inputOptions.sources.items();
      } else if (inputOptions.sources instanceof this.mure.CONSTRUCTS.SetConstruct ||
          inputOptions.sources instanceof this.mure.CONSTRUCTS.SupernodeConstruct) {
        sources = await inputOptions.sources.getMembers();
      } else if (inputOptions.sources instanceof this.mure.CONSTRUCTS.DocumentConstruct ||
                 inputOptions.sources instanceof this.mure.CONSTRUCTS.ContainerConstruct) {
        sources = inputOptions.sources.getContents();
      } else {
        output.warn(`inputOptions.sources is of unexpected type ${inputOptions.sources && inputOptions.sources.type}`);
        return output;
      }
    } else {
      sources = await selection.items();
    }

    const sourceList = Object.values(sources);
    if (sourceList.length === 0) {
      output.warn(`No sources supplied to connect operation`);
      return output;
    }

    // At this point we know enough to deal with 'Within Selection' mode:
    if (inputOptions.context === 'Within Selection') {
      return this.executeWithinSelection(sources, connectWhen, inputOptions.saveEdgesIn, output);
    }

    // What role are the source nodes playing ('undirected' vs 'source')?
    const direction = inputOptions.directed === 'Directed' ? 'source' : 'undirected';

    let targets;
    if (inputOptions.targets instanceof Selection) {
      targets = await inputOptions.targets.items();
    } else if (inputOptions.targets instanceof this.mure.CONSTRUCTS.SetConstruct ||
               inputOptions.targets instanceof this.mure.CONSTRUCTS.SupernodeConstruct) {
      targets = await inputOptions.targets.getMembers();
    } else if (inputOptions.targets instanceof this.mure.CONSTRUCTS.ContainerConstruct ||
               inputOptions.targets instanceof this.mure.CONSTRUCTS.DocumentConstruct) {
      targets = inputOptions.targets.getContents();
    } else {
      output.warn(`inputOptions.targets is of unexpected type ${inputOptions.targets && inputOptions.targets.type}`);
      return output;
    }

    const targetList = Object.values(targets);
    if (targetList.length === 0) {
      output.warn('No targets supplied to connect operation');
    }

    // Create the edges!
    sourceList.forEach(source => {
      targetList.forEach(target => {
        if (source instanceof this.mure.CONSTRUCTS.NodeConstruct &&
            target instanceof this.mure.CONSTRUCTS.NodeConstruct &&
            connectWhen(source, target)) {
          const newEdge = source.connectTo(target, inputOptions.saveEdgesIn, direction);
          output.addSelectors([newEdge.uniqueSelector]);
          output.flagPollutedDoc(source.doc);
          output.flagPollutedDoc(target.doc);
          output.flagPollutedDoc(newEdge.doc);
        }
      });
    });
    return output;
  }
}

export default ConnectOperation;
