import jsonPath from 'jsonpath';

let RESERVED_OBJ_KEYS = ['$tags', '$members', '$links', '$nodes'];

class ItemHandler {
  constructor (mure) {
    this.mure = mure;
  }
  standardize (obj, path) {
    if (typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Array) {
      let temp = {};
      obj.forEach((element, index) => {
        temp[index] = element;
      });
      obj = temp;
      obj.$wasArray = true;
    }
    obj._id = jsonPath.stringify(path);
    obj.$tags = obj.$tags || {};
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'object' &&
          RESERVED_OBJ_KEYS.indexOf(key) === -1) {
        let temp = Array.from(path);
        temp.push(key);
        obj[key] = this.standardize(obj[key], temp);
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
