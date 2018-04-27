import jsonPath from 'jsonpath';
import { TYPES, RESERVED_OBJ_KEYS } from './Types.js';
import Selection from './Selection.js';

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
    return Object.keys(item.value.$tags).reduce((agg, setId) => {
      const temp = this.extractClassInfoFromId(setId);
      if (temp) {
        agg.push(temp.className);
      }
      return agg;
    }, []).sort();
  }
  inferType (value) {
    const jsType = typeof value;
    if (TYPES[jsType]) {
      if (jsType === 'string' && value[0] === '@') {
        try {
          new Selection(null, value); // eslint-disable-line no-new
        } catch (err) {
          if (err.INVALID_SELECTOR) {
            return TYPES.string;
          } else {
            throw err;
          }
        }
        return TYPES.reference;
      } else {
        return TYPES[jsType];
      }
    } else if (value === null) {
      return TYPES.null;
    } else if (value instanceof Date) {
      return TYPES.date;
    } else if (jsType === 'function' || jsType === 'symbol' || value instanceof Array) {
      throw new Error('invalid value: ' + value);
    } else {
      return TYPES.container;
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
    obj._id = '@' + jsonPath.stringify(path);

    // Move any class definitions to this document
    obj.$tags = obj.$tags || {};
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

class BaseItem {
  constructor ({ path, value, parent, doc, label, type, uniqueSelector, classes }) {
    this.path = path;
    this.value = value;
    this.parent = parent;
    this.doc = doc;
    this.label = label;
    this.type = type;
    this.uniqueSelector = uniqueSelector;
    this.classes = classes;
  }
}
class RootItem extends BaseItem {
  constructor (docList, selectSingle) {
    super({
      path: [],
      value: {},
      parent: null,
      doc: null,
      label: null,
      type: TYPES.root,
      uniqueSelector: '@',
      classes: []
    });
    docList.some(doc => {
      this.value[doc._id] = doc;
      return selectSingle;
    });
  }
}
class DocItem extends BaseItem {
  constructor (doc) {
    const docPathQuery = `{"_id":"${doc._id}"}`;
    super({
      path: [docPathQuery],
      value: doc,
      parent: null,
      doc: doc,
      label: doc['filename'],
      type: TYPES.document,
      uniqueSelector: docPathQuery,
      classes: []
    });
  }
}
class Item extends BaseItem {
  constructor (path, value, doc, type) {
    let parent;
    if (path.length < 2) {
      throw new Error(`Can't create a non-Root or non-Doc Item with a path length less than 2`);
    } else if (path.length === 2) {
      parent = doc;
    } else {
      let temp = jsonPath.stringify(path.slice(0, path.length - 1));
      parent = jsonPath.value(doc, temp);
    }
    const docPathQuery = `{"_id":"${doc._id}"}`;
    const uniqueJsonPath = jsonPath.stringify(path);
    path.unshift(docPathQuery);
    super({
      path,
      value,
      parent,
      doc,
      label: path[path.length - 1],
      type,
      classes: [],
      uniqueSelector: '@' + docPathQuery + uniqueJsonPath
    });
    if (path[2] === 'contents' && this.type === TYPES.container) {
      this.classes = ItemHandler.getItemClasses(this);
    }
  }
}
class ContainerItem extends Item {
  constructor (path, value, doc) {
    super(path, value, doc, TYPES.container);
    this.nextLabel = Object.keys(this.value)
      .reduce((max, key) => typeof key === 'number' && key > max ? key : max, 0) + 1;
  }
  createNewItem (value, label, type) {
    type = type || ItemHandler.inferType(value);
    if (label === undefined) {
      label = this.nextLabel;
      this.nextLabel += 1;
    }
    let path = this.path.concat(label);
    let item;
    if (type === TYPES.container) {
      item = new ContainerItem(path, value, this.doc);
    } else {
      item = new Item(path, value, this.doc, type);
    }
    this.addItem(item, label);
    return item;
  }
  addItem (item, label) {
    if (item.type === TYPES.container) {
      if (item.value._id) {
        throw new Error('Item has already been assigned an _id');
      }
      if (label === undefined) {
        label = this.nextLabel;
        this.nextLabel += 1;
      }
      item.value._id = `@${jsonPath.stringify(this.path.concat([label]))}`;
    }
    this.value[label] = item.value;
  }
  addToSet (setObj, setFileId) {
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
    this.addToSet(this.doc.classes[className], this.doc._id);
  }
}

export { ItemHandler, Item, RootItem, DocItem, ContainerItem };
