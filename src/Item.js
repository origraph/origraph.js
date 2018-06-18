import mime from 'mime-types';
import datalib from 'datalib';
import jsonPath from 'jsonpath';
import { Selection } from './Selection.js';

const DATALIB_FORMATS = [
  'json',
  'csv',
  'tsv',
  'topojson',
  'treejson'
];

const RESERVED_OBJ_KEYS = {
  '_id': true,
  '_rev': true,
  '$wasArray': true,
  '$tags': true,
  '$members': true,
  '$edges': true,
  '$nodes': true,
  '$nextLabel': true,
  '$isDate': true
};

class BaseItem {
  constructor ({ path, value, parent, doc, label, uniqueSelector, classes }) {
    this.path = path;
    this._value = value;
    this.parent = parent;
    this.doc = doc;
    this.label = label;
    this.uniqueSelector = uniqueSelector;
    this.classes = classes;
  }
  get type () {
    return /(.*)Item/.exec(this.constructor.name)[1];
  }
  get value () { return this._value; }
  set value (newValue) {
    if (this.parent) {
      // In the event that this is a primitive boolean, number, string, etc,
      // setting the value on the Item wrapper object *won't* naturally update
      // it in its containing document...
      this.parent[this.label] = newValue;
    }
    this._value = newValue;
  }
  remove () {
    // this.parent is a pointer to the raw element, so we want to delete its
    // reference to this item
    delete this.parent[this.label];
  }
  canConvertTo (ItemType) {
    return ItemType === this.constructor;
  }
  convertTo (ItemType) {
    if (ItemType === this.constructor) {
      return this;
    } else {
      throw new Error(`Conversion from ${this.constructor.name} to ${ItemType.name} not yet implemented.`);
    }
  }
}
BaseItem.getHumanReadableType = function () {
  return /(.*)Item/.exec(this.name)[1];
};
BaseItem.getBoilerplateValue = () => {
  throw new Error('unimplemented');
};
BaseItem.standardize = (value) => {
  // Default action: do nothing
  return value;
};

const ContainerItemMixin = (superclass) => class extends superclass {
  getValueContents () {
    return Object.entries(this.value)
      .reduce((agg, [label, value]) => {
        if (!RESERVED_OBJ_KEYS[label]) {
          let ItemType = ItemHandler.inferType(value);
          agg.push(new ItemType(value, this.path.concat([label]), this.doc));
        }
        return agg;
      }, []);
  }
  getValueContentCount () {
    return Object.keys(this.value)
      .filter(label => !RESERVED_OBJ_KEYS[label])
      .length;
  }
};

class RootItem extends BaseItem {
  constructor (docList, selectSingle) {
    super({
      path: [],
      value: {},
      parent: null,
      doc: null,
      label: null,
      uniqueSelector: '@',
      classes: []
    });
    docList.some(doc => {
      this.value[doc._id] = doc;
      return selectSingle;
    });
  }
  remove () {
    throw new Error(`Can't remove the root item`);
  }
}
class DocumentItem extends ContainerItemMixin(BaseItem) {
  constructor (doc) {
    const docPathQuery = `{"_id":"${doc._id}"}`;
    super({
      path: [docPathQuery],
      value: doc,
      parent: null,
      doc: doc,
      label: doc['filename'],
      uniqueSelector: '@' + docPathQuery,
      classes: []
    });
    this._contentItem = new ContainerItem(this.value.contents, this.path.concat(['contents']), this.doc);
  }
  remove () {
    // TODO: remove everything in this.value except _id, _rev, and add _deleted?
    // There's probably some funkiness in the timing of save() I still need to
    // think through...
    throw new Error(`Deleting files via Selections not yet implemented`);
  }
  contentItems () {
    return this._contentItem.contentItems();
  }
  contentItemCount () {
    return this._contentItem.contentItemCount();
  }
  metaItems () {
    return this.getValueContents();
  }
  metaItemCount () {
    return this.getValueContentCount();
  }
}
DocumentItem.isValidId = (docId) => {
  if (docId[0].toLowerCase() !== docId[0]) {
    return false;
  }
  let parts = docId.split(';');
  if (parts.length !== 2) {
    return false;
  }
  return !!mime.extension(parts[0]);
};
DocumentItem.parse = async (text, extension) => {
  let contents;
  if (DATALIB_FORMATS.indexOf(extension) !== -1) {
    contents = datalib.read(text, { type: extension });
  } else if (extension === 'xml') {
    throw new Error('unimplemented');
  } else if (extension === 'txt') {
    throw new Error('unimplemented');
  }
  if (!contents.contents) {
    contents = { contents: contents };
  }
  return contents;
};
DocumentItem.launchStandardization = async (doc, mure) => {
  let existingUntitleds = await mure.db.allDocs({
    startkey: doc.mimeType + ';Untitled ',
    endkey: doc.mimeType + ';Untitled \uffff'
  });
  return mure.ITEM_TYPES.DocumentItem.standardize(doc, existingUntitleds, true);
};
DocumentItem.standardize = (doc, existingUntitleds = { rows: [] }, aggressive) => {
  if (!doc._id || !DocumentItem.isValidId(doc._id)) {
    if (!doc.mimeType && !doc.filename) {
      // Without an id, filename, or mimeType, just assume it's application/json
      doc.mimeType = 'application/json';
    }
    if (!doc.filename) {
      if (doc._id) {
        // We were given an invalid id; use it as the filename instead
        doc.filename = doc._id;
      } else {
        // Without anything to go on, use "Untitled 1", etc
        let minIndex = existingUntitleds.rows.reduce((minIndex, uDoc) => {
          let index = /Untitled (\d+)/g.exec(uDoc._id);
          index = index ? index[1] || Infinity : Infinity;
          return index < minIndex ? index : minIndex;
        }, Infinity);
        minIndex = isFinite(minIndex) ? minIndex + 1 : 1;
        doc.filename = 'Untitled ' + minIndex;
      }
    }
    if (!doc.mimeType) {
      // We were given a bit of info with the filename / bad _id;
      // try to infer the mimeType from that (again use application/json
      // if that fails)
      doc.mimeType = mime.lookup(doc.filename) || 'application/json';
    }
    doc.mimeType = doc.mimeType.toLowerCase();
    doc._id = doc.mimeType + ';' + doc.filename;
  }
  if (doc._id[0] === '_' || doc._id[0] === '$') {
    throw new Error('Document _ids may not start with ' + doc._id[0] + ': ' + doc._id);
  }
  doc.mimeType = doc.mimeType || doc._id.split(';')[0];
  if (!mime.extension(doc.mimeType)) {
    throw new Error('Unknown mimeType: ' + doc.mimeType);
  }
  doc.filename = doc.filename || doc._id.split(';')[1];
  doc.charset = (doc.charset || 'UTF-8').toUpperCase();

  doc.orphanEdges = doc.orphanEdges || {};
  doc.orphanEdges._id = '@$.orphanEdges';

  doc.orphanNodes = doc.orphanNodes || {};
  doc.orphanNodes._id = '@$.orphanNodes';

  doc.classes = doc.classes || {};
  doc.classes._id = '@$.classes';

  let noneId = '@$.classes.none';
  doc.classes.none = doc.classes.none || { _id: noneId, $members: {} };

  doc.contents = doc.contents || {};
  // In case doc.contents is an array, prep it for ContainerItem.standardize
  doc.contents = ContainerItem.convertArray(doc.contents);
  doc.contents = ContainerItem.standardize(doc.contents, [`{"_id":"${doc._id}"}`, '$', 'contents'], doc, aggressive);

  return doc;
};

class TypedItem extends BaseItem {
  constructor (value, path, doc) {
    let parent;
    if (path.length < 2) {
      throw new Error(`Can't create a non-Root or non-Doc Item with a path length less than 2`);
    } else if (path.length === 2) {
      parent = doc;
    } else {
      let temp = jsonPath.stringify(path.slice(1, path.length - 1));
      parent = jsonPath.value(doc, temp);
    }
    const docPathQuery = path[0];
    const uniqueJsonPath = jsonPath.stringify(path.slice(1));
    super({
      path,
      value,
      parent,
      doc,
      label: path[path.length - 1],
      classes: [],
      uniqueSelector: '@' + docPathQuery + uniqueJsonPath
    });
    if (typeof value !== this.constructor.JSTYPE) { // eslint-disable-line valid-typeof
      throw new TypeError(`typeof ${value} is ${typeof value}, which does not match required ${this.constructor.JSTYPE}`);
    }
  }
}
TypedItem.JSTYPE = 'object';

class PrimitiveItem extends TypedItem {
  canConvertTo (ItemType) {
    return ItemType === BooleanItem ||
      ItemType === NumberItem ||
      ItemType === StringItem ||
      ItemType === DateItem ||
      super.canConvertTo(ItemType);
  }
  convertTo (ItemType) {
    if (ItemType === BooleanItem) {
      this.value = !!this.value;
      return new BooleanItem(this.value, this.path, this.doc);
    } else if (ItemType === NumberItem) {
      this.value = Number(this.value);
      return new NumberItem(this.value, this.path, this.doc);
    } else if (ItemType === StringItem) {
      this.value = String(this.value);
      return new StringItem(this.value, this.path, this.doc);
    } else if (ItemType === DateItem) {
      this.value = {
        $isDate: true,
        str: new Date(this.value).toString()
      };
      return new DateItem(this.value, this.path, this.doc);
    } else {
      return super.convertTo(ItemType);
    }
  }
  stringValue () {
    return String(this.value);
  }
}

class NullItem extends PrimitiveItem {}
NullItem.JSTYPE = 'null';
NullItem.getBoilerplateValue = () => null;
NullItem.standardize = () => null;

class BooleanItem extends PrimitiveItem {}
BooleanItem.JSTYPE = 'boolean';
BooleanItem.getBoilerplateValue = () => false;
BooleanItem.standardize = value => !!value;

class NumberItem extends PrimitiveItem {}
NumberItem.JSTYPE = 'number';
NumberItem.getBoilerplateValue = () => 0;
NumberItem.standardize = value => Number(value);

class StringItem extends PrimitiveItem {}
StringItem.JSTYPE = 'string';
StringItem.getBoilerplateValue = () => '';
StringItem.standardize = value => String(value);

class ReferenceItem extends StringItem {
  canConvertTo (ItemType) {
    return BaseItem.prototype.canConvertTo.call(this, ItemType);
  }
  convertTo (ItemType) {
    return BaseItem.prototype.convertTo.call(this, ItemType);
  }
}
ReferenceItem.getBoilerplateValue = () => '@$';

class DateItem extends PrimitiveItem {
  constructor (value, path, doc) {
    super(path, DateItem.standardize(value), doc);
  }
  get value () { return new Date(this._value.str); }
  set value (newValue) {
    super.value = DateItem.standardize(newValue);
  }
  canConvertTo (ItemType) {
    return ItemType === NumberItem ||
      ItemType === StringItem ||
      super.canConvertTo(ItemType);
  }
  convertTo (ItemType) {
    if (ItemType === NumberItem) {
      this.parent[this.label] = this._value = Number(this.value);
      return new NumberItem(this._value, this.path, this.doc);
    } else if (ItemType === StringItem) {
      this.parent[this.label] = this._value = String(this.value);
      return new StringItem(this._value, this.path, this.doc);
    } else {
      return super.convertTo(ItemType);
    }
  }
  stringValue () {
    return String(this.value);
  }
}
DateItem.getBoilerplateValue = () => new Date();
DateItem.standardize = (value) => {
  if (typeof value === 'string') {
    value = new Date(value);
  }
  if (value instanceof Date) {
    value = {
      $isDate: true,
      str: value.toString()
    };
  }
  if (!value.$isDate) {
    throw new Error(`Failed to wrap Date object`);
  }
  return value;
};

class ContainerItem extends ContainerItemMixin(TypedItem) {
  constructor (value, path, doc) {
    super(value, path, doc);
    this.nextLabel = Object.keys(this.value)
      .reduce((max, key) => {
        key = parseInt(key);
        if (!isNaN(key) && key > max) {
          return key;
        } else {
          return max;
        }
      }, 0) + 1;
    this.classes = ItemHandler.getItemClasses(this);
  }
  createNewItem (value, label, ItemType) {
    ItemType = ItemType || ItemHandler.inferType(value);
    if (label === undefined) {
      label = String(this.nextLabel);
      this.nextLabel += 1;
    }
    let path = this.path.concat(label);
    let item = new ItemType(ItemType.getBoilerplateValue(), path, this.doc);
    this.addItem(item, label);
    return item;
  }
  addItem (item, label) {
    if (item instanceof ContainerItem) {
      if (item.value._id) {
        throw new Error('Item has already been assigned an _id');
      }
      if (label === undefined) {
        label = this.nextLabel;
        this.nextLabel += 1;
      }
      item.value._id = `@${jsonPath.stringify(this.path.slice(1).concat([label]))}`;
    }
    this.value[label] = item.value;
  }
  canConvertTo (ItemType) {
    return ItemType === NodeItem ||
      super.canConvertTo(ItemType);
  }
  convertTo (ItemType) {
    if (ItemType === NodeItem) {
      this.value.$edges = {};
      this.value.$tags = {};
      return new NodeItem(this.value, this.path, this.doc);
    } else {
      return super.convertTo(ItemType);
    }
  }
  contentItems () {
    return this.getValueContents();
  }
  contentItemCount () {
    return this.getValueContentCount();
  }
}
ContainerItem.getBoilerplateValue = () => { return {}; };
ContainerItem.convertArray = value => {
  if (value instanceof Array) {
    let temp = {};
    value.forEach((element, index) => {
      temp[index] = element;
    });
    value = temp;
    value.$wasArray = true;
  }
  return value;
};
ContainerItem.standardize = (value, path, doc, aggressive) => {
  // Assign the object's id if a path is supplied
  if (path) {
    value._id = '@' + jsonPath.stringify(path.slice(1));
  }
  // Recursively standardize contents if a path and doc are supplied
  if (path && doc) {
    Object.entries(value).forEach(([key, nestedValue]) => {
      if (!RESERVED_OBJ_KEYS[key]) {
        let temp = Array.from(path);
        temp.push(key);
        // Alayws convert arrays to objects
        nestedValue = ContainerItem.convertArray(nestedValue);
        // What kind of value are we dealing with?
        let ItemType = ItemHandler.inferType(nestedValue, aggressive);
        // Apply that class's standardization function
        value[key] = ItemType.standardize(nestedValue, temp, doc, aggressive);
      }
    });
  }
  return value;
};

class TaggableItem extends ContainerItem {
  constructor (value, path, doc) {
    super(value, path, doc);
    if (!value.$tags) {
      throw new TypeError(`TaggableItem requires a $tags object`);
    }
  }
  addToSetObj (setObj, setFileId) {
    // Convenience function for tagging an item without having to wrap the set
    // object as a SetItem
    const itemTag = this.doc._id === setFileId
      ? this.value._id : ItemHandler.idToUniqueSelector(this.value._id, this.doc._id);
    const setTag = this.doc._id === setFileId
      ? setObj._id : ItemHandler.idToUniqueSelector(setObj._id, setFileId);
    setObj.$members[itemTag] = true;
    this.value.$tags[setTag] = true;
  }
  addClass (className) {
    this.doc.classes[className] = this.doc.classes[className] || {
      _id: '@' + jsonPath.stringify(['$', 'classes', className]),
      $members: {}
    };
    this.addToSetObj(this.doc.classes[className], this.doc._id);
  }
}
TaggableItem.getBoilerplateValue = () => {
  return { $tags: {} };
};
TaggableItem.standardize = (value, path, doc, aggressive) => {
  // Do the regular ContainerItem standardization
  value = ContainerItem.standardize(value, path, doc, aggressive);
  // Ensure the existence of a $tags object
  value.$tags = value.$tags || {};
  // Move any existing class definitions to this document
  Object.keys(value.$tags).forEach(setId => {
    const temp = ItemHandler.extractClassInfoFromId(setId);
    if (temp) {
      delete value.$tags[setId];

      setId = doc.classes._id + temp.classPathChunk;
      value.$tags[setId] = true;

      doc.classes[temp.className] = doc.classes[temp.className] || { _id: setId, $members: {} };
      doc.classes[temp.className].$members[value._id] = true;
    }
  });
  return value;
};

const SetItemMixin = (superclass) => class extends superclass {
  constructor (value, path, doc) {
    super(value, path, doc);
    if (!value.$members) {
      throw new TypeError(`SetItem requires a $members object`);
    }
  }
  addItem (item) {
    const itemTag = item.value._id;
    const setTag = this.value._id;
    this.value.$members[itemTag] = true;
    item.value.$tags[setTag] = true;
  }
};
class SetItem extends SetItemMixin(TypedItem) {
  canConvertTo (ItemType) {
    return BaseItem.prototype.canConvertTo.call(this, ItemType);
  }
  convertTo (ItemType) {
    return BaseItem.prototype.convertTo.call(this, ItemType);
  }
}
SetItem.getBoilerplateValue = () => {
  return { $members: {} };
};
SetItem.standardize = (value) => {
  // Ensure the existence of a $members object
  value.$members = value.$members || {};
  return value;
};

class EdgeItem extends TaggableItem {
  constructor (value, path, doc) {
    super(value, path, doc);
    if (!value.$nodes) {
      throw new TypeError(`EdgeItem requires a $nodes object`);
    }
  }
  canConvertTo (ItemType) {
    return BaseItem.prototype.canConvertTo.call(this, ItemType);
  }
  convertTo (ItemType) {
    return BaseItem.prototype.convertTo.call(this, ItemType);
  }
}
EdgeItem.getBoilerplateValue = () => {
  return { $tags: {}, $nodes: {} };
};
EdgeItem.standardize = (value, path, doc, aggressive) => {
  // Do the regular TaggableItem standardization
  value = TaggableItem.standardize(value, path, doc, aggressive);
  // Ensure the existence of a $nodes object
  value.$nodes = value.$nodes || {};
  return value;
};

class NodeItem extends TaggableItem {
  constructor (value, path, doc) {
    super(value, path, doc);
    if (!value.$edges) {
      throw new TypeError(`NodeItem requires an $edges object`);
    }
  }
  linkTo (otherNode, container, directed) {
    let newEdge = container.createNewItem({}, undefined, EdgeItem);

    if (this.doc === container.doc) {
      newEdge.value.$nodes[this.value._id] = directed ? 'source' : true;
      this.value.$edges[newEdge.value._id] = true;
    } else {
      newEdge.value.$nodes[this.uniqueSelector] = directed ? 'source' : true;
      this.value.$edges[ItemHandler.idToUniqueSelector(newEdge.value._id, container.doc._id)] = true;
    }

    if (otherNode.doc === container.doc) {
      newEdge.value.$nodes[otherNode.value._id] = directed ? 'target' : true;
      otherNode.value.$edges[newEdge.value._id] = true;
    } else {
      newEdge.value.$nodes[otherNode.uniqueSelector] = directed ? 'target' : true;
      otherNode.value.$edges[ItemHandler.idToUniqueSelector(newEdge.value._id, container.doc._id)] = true;
    }
    return newEdge;
  }
  canConvertTo (ItemType) {
    return BaseItem.prototype.canConvertTo.call(this, ItemType);
  }
  convertTo (ItemType) {
    return BaseItem.prototype.convertTo.call(this, ItemType);
  }
}
NodeItem.getBoilerplateValue = () => {
  return { $tags: {}, $edges: {} };
};
NodeItem.standardize = (value, path, doc, aggressive) => {
  // Do the regular TaggableItem standardization
  value = TaggableItem.standardize(value, path, doc, aggressive);
  // Ensure the existence of an $edges object
  value.$edges = value.$edges || {};
  return value;
};

class SupernodeItem extends SetItemMixin(NodeItem) {
  canConvertTo (ItemType) {
    return BaseItem.prototype.canConvertTo.call(this, ItemType);
  }
  convertTo (ItemType) {
    return BaseItem.prototype.convertTo.call(this, ItemType);
  }
}
SupernodeItem.getBoilerplateValue = () => {
  return { $tags: {}, $members: {}, $edges: {} };
};
SupernodeItem.standardize = (value, path, doc, aggressive) => {
  // Do the regular NodeItem standardization
  value = NodeItem.standardize(value, path, doc, aggressive);
  // ... and the SetItem standardization
  value = SetItem.standardize(value);
  return value;
};

const ITEM_TYPES = {
  RootItem,
  DocumentItem,
  PrimitiveItem,
  NullItem,
  BooleanItem,
  NumberItem,
  StringItem,
  DateItem,
  ReferenceItem,
  ContainerItem,
  TaggableItem,
  SetItem,
  EdgeItem,
  NodeItem,
  SupernodeItem
};

const JSTYPES = {
  'null': NullItem,
  'boolean': BooleanItem,
  'number': NumberItem
};

class Handler {
  idToUniqueSelector (selectorString, docId) {
    const chunks = /@[^$]*(\$.*)/.exec(selectorString);
    return `@{"_id":"${docId}"}${chunks[1]}`;
  }
  extractDocQuery (selectorString) {
    const result = /@\s*({.*})/.exec(selectorString);
    if (result && result[1]) {
      return JSON.parse(result[1]);
    } else {
      return null;
    }
  }
  extractClassInfoFromId (id) {
    const temp = /@[^$]*\$\.classes(\.[^\s↑→.]+)?(\["[^"]+"])?/.exec(id);
    if (temp && (temp[1] || temp[2])) {
      return {
        classPathChunk: temp[1] || temp[2],
        className: temp[1] ? temp[1].slice(1) : temp[2].slice(2, temp[2].length - 2)
      };
    } else {
      return null;
    }
  }
  getItemClasses (item) {
    if (!item.value || !item.value.$tags) {
      return [];
    }
    return Object.keys(item.value.$tags).reduce((agg, setId) => {
      const temp = this.extractClassInfoFromId(setId);
      if (temp) {
        agg.push(temp.className);
      }
      return agg;
    }, []).sort();
  }
  inferType (value, aggressive = false) {
    const jsType = typeof value;
    if (JSTYPES[jsType]) {
      return JSTYPES[jsType];
    } else if (jsType === 'string') {
      if (value[0] === '@') {
        // Attempt to parse as a reference
        try {
          new Selection(null, value); // eslint-disable-line no-new
          return ITEM_TYPES.ReferenceItem;
        } catch (err) {
          if (!err.INVALID_SELECTOR) {
            throw err;
          }
        }
      }
      // Not a reference...
      if (aggressive) {
        // Aggressively attempt to identify something more specific than string
        if (!isNaN(Number(value))) {
          return ITEM_TYPES.NumberItem;
        /*
         For now, we don't attempt to identify dates, even in aggressive mode,
         because things like new Date('Player 1') will successfully parse as a
         date. If we can find smarter ways to auto-infer dates (e.g. does the
         value fall suspiciously near the unix epoch, y2k, or more than +/-500
         years from now? Do sibling container items parse this as a date?), then
         maybe we'll add this back...
        */
        // } else if (!isNaN(new Date(value))) {
        //  return ITEM_TYPES.DateItem;
        } else {
          const temp = value.toLowerCase();
          if (temp === 'true') {
            return ITEM_TYPES.BooleanItem;
          } else if (temp === 'false') {
            return ITEM_TYPES.BooleanItem;
          } else if (temp === 'null') {
            return ITEM_TYPES.NullItem;
          }
        }
      }
      // Okay, it's just a string
      return ITEM_TYPES.StringItem;
    } else if (jsType === 'function' || jsType === 'symbol' || jsType === 'undefined' || value instanceof Array) {
      throw new Error('invalid value: ' + value);
    } else if (value === null) {
      return ITEM_TYPES.NullItem;
    } else if (value instanceof Date || value.$isDate === true) {
      return ITEM_TYPES.DateItem;
    } else if (value.$nodes) {
      return ITEM_TYPES.EdgeItem;
    } else if (value.$edges) {
      if (value.$members) {
        return ITEM_TYPES.SupernodeItem;
      } else {
        return ITEM_TYPES.NodeItem;
      }
    } else if (value.$members) {
      return ITEM_TYPES.SetItem;
    } else if (value.$tags) {
      return ITEM_TYPES.TaggableItem;
    } else {
      return ITEM_TYPES.ContainerItem;
    }
  }
}
const ItemHandler = new Handler();

export { ItemHandler, RESERVED_OBJ_KEYS, ITEM_TYPES };
