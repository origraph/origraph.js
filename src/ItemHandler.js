import jsonPath from 'jsonpath';

class ItemHandler {
  constructor (mure) {
    this.mure = mure;
  }
  extractClassInfoFromId (id) {
    let temp = /@[^$]*\$\.classes(\.[^\s↑→.]+)?(\["[^"]+"])?/.exec(id);
    if (temp && (temp[1] || temp[2])) {
      return {
        classPathChunk: temp[1] || temp[2],
        className: temp[1] ? temp[1].slice(1) : temp[2].slice(2, temp[2].length - 2)
      };
    } else {
      return null;
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

    // Make sure the object has at least one class (move any class definitions
    // to this document), or assign it the 'none' class
    obj.$tags = obj.$tags || {};
    Object.keys(obj.$tags).forEach(setId => {
      let temp = this.extractClassInfoFromId(setId);
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
          !this.mure.RESERVED_OBJ_KEYS[key]) {
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

export default ItemHandler;
