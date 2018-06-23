attr (key, value) {
  let isFunction = typeof value === 'function';
  return this.each(item => {
    if (item instanceof this.mure.ITEM_TYPES.RootItem) {
      throw new Error(`Renaming files with .attr() is not yet supported`);
    } else if (item instanceof this.mure.ITEM_TYPES.ContainerItem ||
        item instanceof this.mure.ITEM_TYPES.DocumentItem) {
      let temp = isFunction ? value.apply(this, item) : value;
      // item.value is just a pointer to the object in the document, so
      // we can just change it directly and it will still be saved
      item.value[key] = this.mure.ItemHandler
        .standardize(temp, item.path.slice(1), item.doc.classes);
    } else {
      throw new Error(`Can't set .attr(${key}) on value of type ${item.type}`);
    }
  });
}

remove () {
  return this.each((item, items) => {
    item.remove();
    delete items[item.uniqueSelector];
  });
}
group () {
  throw new Error('unimplemented');
}
addClass (className) {
  return this.each(item => {
    item.addClass(className);
  });
}
removeClass (className) {
  throw new Error('unimplemented');
}
convertToType (ItemType) {
  return this.each(async (item, items) => {
    items[item.uniqueSelector] = item.convertTo(ItemType);
  });
}
toggleDirection () {
  throw new Error('unimplemented');
}
copy (newParentId) {
  throw new Error('unimplemented');
}
move (newParentId) {
  throw new Error('unimplemented');
}
dissolve () {
  throw new Error('unimplemented');
}

/*
 These functions provide statistics / summaries of the selection:
 */
async histograms (numBins = 10) {
  if (this._cachedHistograms) {
    return this._cachedHistograms;
  }

  const items = await this.items();

  let result = {
    raw: {
      typeBins: {},
      categoricalBins: {},
      quantitativeBins: []
    },
    attributes: {}
  };

  const countPrimitive = (counters, item) => {
    // Attempt to count the value categorically
    if (counters.categoricalBins !== null) {
      counters.categoricalBins[item.value] = (counters.categoricalBins[item.value] || 0) + 1;
      if (Object.keys(counters.categoricalBins).length > numBins) {
        // We've encountered too many categorical bins; this likely isn't a categorical attribute
        counters.categoricalBins = null;
      }
    }
    // Attempt to bin the value quantitatively
    if (counters.quantitativeBins !== null) {
      if (counters.quantitativeBins.length === 0) {
        // Init the counters with some temporary placeholders
        counters.quantitativeItems = [];
        counters.quantitativeType = item.type;
        if (item instanceof this.mure.ITEM_TYPES.NumberItem) {
          counters.quantitativeScale = this.mure.d3.scaleLinear()
            .domain([item.value, item.value]);
        } else if (item instanceof this.mure.ITEM_TYPES.DateItem) {
          counters.quantitativeScale = this.mure.d3.scaleTime()
            .domain([item.value, item.value]);
        } else {
          // The first value is non-quantitative; this likely isn't a quantitative attribute
          counters.quantitativeBins = null;
          delete counters.quantitativeItems;
          delete counters.quantitativeType;
          delete counters.quantitativeScale;
        }
      } else if (counters.quantitativeType !== item.type) {
        // Encountered an item of a different type; this likely isn't a quantitative attribute
        counters.quantitativeBins = null;
        delete counters.quantitativeItems;
        delete counters.quantitativeType;
        delete counters.quantitativeScale;
      } else {
        // Update the scale's domain (we'll determine bins later)
        let domain = counters.quantitativeScale.domain();
        if (item.value < domain[0]) {
          domain[0] = item.value;
        }
        if (item.value > domain[1]) {
          domain[1] = item.value;
        }
        counters.quantitativeScale.domain(domain);
      }
    }
  };

  Object.values(items).forEach(item => {
    result.raw.typeBins[item.type] = (result.raw.typeBins[item.type] || 0) + 1;
    if (item instanceof this.mure.ITEM_TYPES.PrimitiveItem) {
      countPrimitive(result.raw, item);
    } else {
      if (item.contentItems) {
        item.contentItems().forEach(childItem => {
          const counters = result.attributes[childItem.label] = result.attributes[childItem.label] || {
            typeBins: {},
            categoricalBins: {},
            quantitativeBins: []
          };
          counters.typeBins[childItem.type] = (counters.typeBins[childItem.type] || 0) + 1;
          if (childItem instanceof this.mure.ITEM_TYPES.PrimitiveItem) {
            countPrimitive(counters, childItem);
          }
        });
      }
      // TODO: collect more statistics, such as node degree, set size
      // (and a set's members' attributes, similar to contentItems?)
    }
  });

  const finalizeBins = counters => {
    // Clear out anything that didn't see any values
    if (counters.typeBins && Object.keys(counters.typeBins).length === 0) {
      counters.typeBins = null;
    }
    if (counters.categoricalBins &&
        Object.keys(counters.categoricalBins).length === 0) {
      counters.categoricalBins = null;
    }
    if (counters.quantitativeBins) {
      if (!counters.quantitativeItems ||
           counters.quantitativeItems.length === 0) {
        counters.quantitativeBins = null;
        delete counters.quantitativeItems;
        delete counters.quantitativeType;
        delete counters.quantitativeScale;
      } else {
        // Calculate quantitative bin sizes and their counts
        // Clean up the scale a bit
        counters.quantitativeScale.nice();
        // Histogram generator
        const histogramGenerator = this.mure.d3.histogram()
          .domain(counters.quantitativeScale.domain())
          .thresholds(counters.quantitativeScale.ticks(numBins))
          .value(d => d.value);
        counters.quantitativeBins = histogramGenerator(counters.quantitativeItems);
        // Clean up some of the temporary placeholders
        delete counters.quantitativeItems;
        delete counters.quantitativeType;
      }
    }
  };
  finalizeBins(result.raw);
  Object.values(result.attributes).forEach(finalizeBins);

  this._cachedHistograms = result;
  return result;
}
async inferOperationInputs () {
  const inputInferences = {};
  const promises = Object.entries(this.mure.OPERATIONS)
    .map(([opKey, Operation]) => {
      return (async () => {
        inputInferences[opKey] = await Operation.inferSelectionInputs(this);
      })();
    });
  await Promise.all(promises);
  return inputInferences;
}
async getFlatGraphSchema () {
  const items = await this.items();
  let result = {
    nodeClasses: [],
    nodeClassLookup: {},
    edgeSets: [],
    edgeSetLookup: {}
  };

  // First pass: collect and count which node classes exist, and create a
  // temporary edge sublist for the second pass
  const edges = {};
  Object.entries(items).forEach(([uniqueSelector, item]) => {
    if (item.value.$edges) {
      item.classes.forEach(className => {
        if (result.nodeClassLookup[className] === undefined) {
          result.nodeClassLookup[className] = result.nodeClasses.length;
          result.nodeClasses.push({
            name: className,
            count: 0
          });
        }
        result.nodeClasses[result.nodeClassLookup[className]].count += 1;
      });
    } else if (item.value.$nodes) {
      edges[uniqueSelector] = item;
    }
  });

  // Second pass: find and count which distinct
  // node class -> edge class -> node class
  // sets exist
  Object.values(edges).forEach(edgeItem => {
    let temp = {
      edgeClasses: Array.from(edgeItem.classes),
      sourceClasses: [],
      targetClasses: [],
      undirectedClasses: [],
      count: 0
    };
    Object.entries(edgeItem.value.$nodes).forEach(([nodeId, relativeNodeDirection]) => {
      let nodeItem = items[nodeId] ||
        items[this.mure.ItemHandler.idToUniqueSelector(nodeId, edgeItem.doc._id)];
      if (!nodeItem) {
        this.mure.warn('Edge refers to Node that is outside the selection; skipping...');
        return;
      }
      // todo: in the intersected schema, use nodeItem.classes.join(',') instead of concat
      if (relativeNodeDirection === 'source') {
        temp.sourceClasses = temp.sourceClasses.concat(nodeItem.classes);
      } else if (relativeNodeDirection === 'target') {
        temp.targetClasses = temp.targetClasses.concat(nodeItem.classes);
      } else {
        temp.undirectedClasses = temp.undirectedClasses.concat(nodeItem.classes);
      }
    });
    const edgeKey = md5(JSON.stringify(temp));
    if (result.edgeSetLookup[edgeKey] === undefined) {
      result.edgeSetLookup[edgeKey] = result.edgeSets.length;
      result.edgeSets.push(temp);
    }
    result.edgeSets[result.edgeSetLookup[edgeKey]].count += 1;
  });

  return result;
}
async getIntersectedGraphSchema () {
  // const items = await this.items();
  throw new Error('unimplemented');
}
async getContainerSchema () {
  // const items = await this.items();
  throw new Error('unimplemented');
}
async allMetaObjIntersections (metaObjs) {
  const items = await this.items();
  let linkedIds = {};
  items.forEach(item => {
    metaObjs.forEach(metaObj => {
      if (item.value[metaObj]) {
        Object.keys(item.value[metaObj]).forEach(linkedId => {
          linkedId = this.mure.ItemHandler.idToUniqueSelector(linkedId, item.doc._id);
          linkedIds[linkedId] = linkedIds[linkedId] || {};
          linkedIds[linkedId][item.uniqueSelector] = true;
        });
      }
    });
  });
  let sets = [];
  let setLookup = {};
  Object.keys(linkedIds).forEach(linkedId => {
    let itemIds = Object.keys(linkedIds[linkedId]).sort();
    let setKey = itemIds.join(',');
    if (setLookup[setKey] === undefined) {
      setLookup[setKey] = sets.length;
      sets.push({ itemIds, linkedIds: {} });
    }
    setLookup[setKey].linkedIds[linkedId] = true;
  });
  return sets;
}
async metaObjUnion (metaObjs) {
  const items = await this.items();
  let linkedIds = {};
  Object.values(items).forEach(item => {
    metaObjs.forEach(metaObj => {
      if (item.value[metaObj]) {
        Object.keys(item.value[metaObj]).forEach(linkedId => {
          linkedIds[this.mure.ItemHandler.idToUniqueSelector(linkedId, item.doc._id)] = true;
        });
      }
    });
  });
  return Object.keys(linkedIds);
}

/*
 These functions are useful for deriving additional selections
 */
deriveSelection (selectorList, options = { mode: this.mure.DERIVE_MODES.REPLACE }) {
  if (options.mode === this.mure.DERIVE_MODES.UNION) {
    selectorList = selectorList.concat(this.selectorList);
  } else if (options.mode === this.mure.DERIVE_MODES.XOR) {
    selectorList = selectorList.filter(selector => this.selectorList.indexOf(selector) === -1)
      .concat(this.selectorList.filter(selector => selectorList.indexOf(selector) === -1));
  } // else if (options.mode === DERIVE_MODES.REPLACE) { // do nothing }
  return new Selection(this.mure, selectorList, options);
}
merge (otherSelection, options = {}) {
  Object.assign(options, { mode: this.mure.DERIVE_MODES.UNION });
  return this.deriveSelection(otherSelection.selectorList, options);
}
select (selectorList, options = {}) {
  Object.assign(options, { selectSingle: true, parentSelection: this });
  return this.deriveSelection(selectorList, options);
}
selectAll (selectorList, options = {}) {
  Object.assign(options, { parentSelection: this });
  return this.deriveSelection(selectorList, options);
}
async selectAllSetMembers (options) {
  return this.deriveSelection(await this.metaObjUnion(['$members']), options);
}
async selectAllContainingSets (options) {
  return this.deriveSelection(await this.metaObjUnion(['$tags']), options);
}
async selectAllEdges (options) {
  return this.deriveSelection(await this.metaObjUnion(['$edges']), options);
}
async selectAllNodes (options = false) {
  return this.deriveSelection(await this.metaObjUnion(['$nodes']), options);
}
