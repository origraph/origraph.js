import jsonPath from 'jsonpath';
import Selection from './Selection.js';

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
BaseItem.getBoilerplateValue = () => {
  throw new Error('unimplemented');
};

const ContainerItemMixin = (superclass) => class extends superclass {
  getValueContents () {
    return Object.entries(this.value)
      .reduce((agg, [label, value]) => {
        if (!RESERVED_OBJ_KEYS[label]) {
          let ItemType = ItemHandler.inferType(value);
          agg.push(new ItemType(this.path.concat([label]), value, this.doc));
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
    this._contentItem = new ContainerItem(this.path.concat(['contents']), this.value.contents, this.doc);
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
class TypedItem extends BaseItem {
  constructor (path, value, doc) {
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
      return new BooleanItem(this.path, this.value, this.doc);
    } else if (ItemType === NumberItem) {
      this.value = Number(this.value);
      return new NumberItem(this.path, this.value, this.doc);
    } else if (ItemType === StringItem) {
      this.value = String(this.value);
      return new StringItem(this.path, this.value, this.doc);
    } else if (ItemType === DateItem) {
      this.value = {
        $isDate: true,
        str: new Date(this.value).toString()
      };
      return new DateItem(this.path, this.value, this.doc);
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

class BooleanItem extends PrimitiveItem {}
BooleanItem.JSTYPE = 'boolean';
BooleanItem.getBoilerplateValue = () => false;

class NumberItem extends PrimitiveItem {}
NumberItem.JSTYPE = 'number';
NumberItem.getBoilerplateValue = () => 0;

class StringItem extends PrimitiveItem {}
StringItem.JSTYPE = 'string';
StringItem.getBoilerplateValue = () => '';

class ReferenceItem extends StringItem {
  canConvertTo (ItemType) {
    return BaseItem.prototype.canConvertTo.call(this, ItemType);
  }
  convertTo (ItemType) {
    return BaseItem.prototype.convertTo.call(this, ItemType);
  }
}
ReferenceItem.getBoilerplateValue = () => '@$';

class DateItem extends TypedItem {
  constructor (path, value, doc) {
    super(path, DateItem.wrap(value), doc);
  }
  get value () { return new Date(this._value.str); }
  set value (newValue) {
    super.value = DateItem.wrap(newValue);
  }
  canConvertTo (ItemType) {
    return ItemType === NumberItem ||
      ItemType === StringItem ||
      super.canConvertTo(ItemType);
  }
  convertTo (ItemType) {
    if (ItemType === NumberItem) {
      this.parent[this.label] = this._value = Number(this.value);
      return new NumberItem(this.path, this._value, this.doc);
    } else if (ItemType === StringItem) {
      this.parent[this.label] = this._value = String(this.value);
      return new StringItem(this.path, this._value, this.doc);
    } else {
      return super.convertTo(ItemType);
    }
  }
  stringValue () {
    return String(this.value);
  }
}
DateItem.wrap = (value) => {
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
DateItem.getBoilerplateValue = () => new Date();

class ContainerItem extends ContainerItemMixin(TypedItem) {
  constructor (path, value, doc) {
    super(path, value, doc);
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
    let item = new ItemType(path, ItemType.getBoilerplateValue(), this.doc);
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
      return new NodeItem(this.path, this.value, this.doc);
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

class TaggableItem extends ContainerItem {
  constructor (path, value, doc) {
    super(path, value, doc);
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

const SetItemMixin = (superclass) => class extends superclass {
  constructor (path, value, doc) {
    super(path, value, doc);
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

class EdgeItem extends TaggableItem {
  constructor (path, value, doc) {
    super(path, value, doc);
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

class NodeItem extends TaggableItem {
  constructor (path, value, doc) {
    super(path, value, doc);
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

const ITEM_TYPES = {
  RootItem,
  DocumentItem,
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
        } else if (!isNaN(new Date(value))) {
          return ITEM_TYPES.DateItem;
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
  standardize (obj, path, classes) {
    if (typeof obj !== 'object') {
      return obj;
    }

    // Convert arrays to objects
    if (obj instanceof Array) {
      let temp = {};
      obj.forEach((element, index) => {
        temp[index] = element;
      });
      obj = temp;
      obj.$wasArray = true;
    }

    // Assign the object's id
    obj._id = '@' + jsonPath.stringify(path.slice(1));

    if (obj.$tags) {
      // Move any existing class definitions to this document
      Object.keys(obj.$tags).forEach(setId => {
        const temp = this.extractClassInfoFromId(setId);
        if (temp) {
          delete obj.$tags[setId];

          setId = classes._id + temp.classPathChunk;
          obj.$tags[setId] = true;

          classes[temp.className] = classes[temp.className] || { _id: setId, $members: {} };
          classes[temp.className].$members[obj._id] = true;
        }
      });
    }

    // Recursively standardize the object's contents
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' &&
          !RESERVED_OBJ_KEYS[key]) {
        let temp = Array.from(path);
        temp.push(key);
        obj[key] = this.standardize(value, temp, classes);
      }
    });
    return obj;
  }
  format (obj) {
    // TODO: if $wasArray, attempt to restore array status,
    // remove _ids
    throw new Error('unimplemented');
  }
}
const ItemHandler = new Handler();

export { ItemHandler, RESERVED_OBJ_KEYS, ITEM_TYPES };
