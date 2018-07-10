import jsonPath from 'jsonpath';
import ItemConstruct from './ItemConstruct.js';

class TaggableConstruct extends ItemConstruct {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$tags) {
      throw new TypeError(`TaggableConstruct requires a $tags object`);
    }
  }
  addToSetObj (setObj, setFileId) {
    // Convenience function for tagging an item without having to wrap the set
    // object as a SetConstruct
    const itemTag = this.doc._id === setFileId
      ? this.value._id : this.mure.idToUniqueSelector(this.value._id, this.doc._id);
    const setTag = this.doc._id === setFileId
      ? setObj._id : this.mure.idToUniqueSelector(setObj._id, setFileId);
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
  getClasses () {
    if (!this.value || !this.value.$tags) {
      return [];
    }
    return Object.keys(this.value.$tags).reduce((agg, setId) => {
      const temp = this.mure.extractClassInfoFromId(setId);
      if (temp) {
        agg.push(temp.className);
      }
      return agg;
    }, []).sort();
  }
}
TaggableConstruct.getBoilerplateValue = () => {
  return { $tags: {} };
};
TaggableConstruct.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular ItemConstruct standardization
  value = ItemConstruct.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of a $tags object
  value.$tags = value.$tags || {};
  // Move any existing class definitions to this document
  Object.keys(value.$tags).forEach(setId => {
    const temp = mure.extractClassInfoFromId(setId);
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

export default TaggableConstruct;
