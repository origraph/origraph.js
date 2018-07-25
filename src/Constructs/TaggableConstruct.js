import jsonPath from 'jsonpath';
import ItemConstruct from './ItemConstruct.js';

class TaggableConstruct extends ItemConstruct {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$tags) {
      throw new TypeError(`TaggableConstruct requires a $tags object`);
    }
  }
  addClass (className) {
    if (!this.doc.classes[className]) {
      this.doc.classes[className] = this.mure.CONSTRUCTS.SetConstruct.getBoilerplateValue();
      this.doc.classes[className]._id = '@' + jsonPath.stringify(['$', 'classes', className]);
    }
    const classItem = new this.mure.CONSTRUCTS.SetConstruct({
      mure: this.mure,
      path: [this.path[0], '$', 'classes', className],
      value: this.doc.classes[className],
      doc: this.doc
    });
    classItem.addConstruct(this);
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
