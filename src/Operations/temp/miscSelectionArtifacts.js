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
