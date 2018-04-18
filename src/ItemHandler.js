import jsonPath from 'jsonpath';

let RESERVED_OBJ_KEYS = ['$tags', '$members', '$links', '$nodes'];

class ItemHandler {
  constructor (mure) {
    this.mure = mure;
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
      let temp = /@[^$]*\$\.classes(\.[^\s↑→.]+)?(\["[^"]+"])?/.exec(setId);
      if (temp && (temp[1] || temp[2])) {
        delete obj.$tags[setId];

        let classPathChunk = temp[1] || temp[2];
        setId = classes._id + classPathChunk;
        obj.$tags[setId] = true;

        let className = temp[1] ? temp[1].slice(1) : temp[2].slice(2, temp[2].length - 2);
        classes[className] = classes[className] || { _id: setId, $members: {} };
        classes[className].$members[obj._id] = true;
      }
    });

    // Recursively standardize the object's contents
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'object' &&
          RESERVED_OBJ_KEYS.indexOf(key) === -1) {
        let temp = Array.from(path);
        temp.push(key);
        obj[key] = this.standardize(obj[key], temp, classes);
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
