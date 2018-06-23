import mime from 'mime-types';
import datalib from 'datalib';
import BaseItem from './BaseItem.js';
import ContainerItem from './ContainerItem.js';
import ContainerItemMixin from './ContainerItemMixin.js';

// extensions that we want datalib to handle
const DATALIB_FORMATS = [
  'json',
  'csv',
  'tsv',
  'topojson',
  'treejson'
];

class DocumentItem extends ContainerItemMixin(BaseItem) {
  constructor ({ mure, doc }) {
    const docPathQuery = `{"_id":"${doc._id}"}`;
    super({
      mure,
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
  async contentSelectors () {
    return this._contentItem.contentSelectors();
  }
  async contentItems () {
    return this._contentItem.contentItems();
  }
  async contentItemCount () {
    return this._contentItem.contentItemCount();
  }
  async metaItemSelectors () {
    return (await this.metaItems()).map(item => item.uniqueSelector);
  }
  async metaItems () {
    return this.getValueContents();
  }
  async metaItemCount () {
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
DocumentItem.launchStandardization = async ({ mure, doc }) => {
  let existingUntitleds = await mure.db.allDocs({
    startkey: doc.mimeType + ';Untitled ',
    endkey: doc.mimeType + ';Untitled \uffff'
  });
  return DocumentItem.standardize({
    mure,
    doc,
    existingUntitleds,
    aggressive: true
  });
};
DocumentItem.standardize = ({
  mure,
  doc,
  existingUntitleds = { rows: [] },
  aggressive
}) => {
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
  doc.contents = ContainerItem.standardize({
    mure,
    value: doc.contents,
    path: [`{"_id":"${doc._id}"}`, '$', 'contents'],
    doc,
    aggressive
  });

  return doc;
};

export default DocumentItem;
