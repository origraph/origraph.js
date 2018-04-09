import mime from 'mime-types';
import datalib from 'datalib';

class DocHandler {
  constructor (mure) {
    this.mure = mure;
    this.keyNames = {};
    this.datalibFormats = ['json', 'csv', 'tsv', 'dsv', 'topojson', 'treejson'];
  }
  async parse (text, { format = {}, mimeType } = {}) {
    if (mimeType && (!format || !format.type)) {
      format.type = mime.extension(mimeType);
    }
    let contents;
    if (format.type) {
      format.type = format.type.toLowerCase();
      if (this.datalibFormats.indexOf(format.type) !== -1) {
        contents = datalib.read(text, format);
      } else if (format.type === 'xml') {
        contents = this.parseXml(text, format);
      }
    }
    if (!contents.contents) {
      contents = { contents: contents };
    }
    return contents;
  }
  parseXml (text, { format = {} } = {}) {
    throw new Error('unimplemented');
  }
  formatDoc (doc, { mimeType = doc.mimeType } = {}) {
    this.mure.itemHandler.format(doc.contents);
    throw new Error('unimplemented');
  }
  isValidId (docId) {
    if (docId[0].toLowerCase() !== docId[0]) {
      return false;
    }
    let parts = docId.split(';');
    if (parts.length !== 2) {
      return false;
    }
    return !!mime.extension(parts[0]);
  }
  async standardize (doc) {
    if (!doc._id || !this.isValidId(doc._id)) {
      if (!doc.mimeType && !doc.filename) {
        // Without an id, filename, or mimeType, just assume it's application/json
        doc.mimeType = 'application/json';
      }
      doc.mimeType = doc.mimeType.toLowerCase();
      if (!doc.filename) {
        if (doc._id) {
          // We were given an invalid id; use it as the filename instead
          doc.filename = doc._id;
        } else {
          // Without anything to go on, use "Untitled 1", etc
          let existingUntitleds = await this.mure.db.allDocs({
            startkey: doc.mimeType + ';Untitled ',
            endkey: doc.mimeType + ';Untitled \uffff'
          });
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
      doc._id = doc.mimeType + ';' + doc.filename;
    }
    if (doc._id[0] === '_' || doc._id[0] === '$') {
      throw new Error('Document _ids may not start with ' + doc._id[0] + ': ' + doc._id);
    }
    doc.mimeType = doc.mimeType || doc._id.split(';')[0];
    if (!mime.extension(doc.mimeType)) {
      this.mure.warn('Unknown mimeType: ' + doc.mimeType);
    }
    doc.filename = doc.filename || doc._id.split(';')[1];
    doc.charset = (doc.charset || 'UTF-8').toUpperCase();

    doc.orphanLinks = doc.orphanLinks || {};
    doc.orphanLinks._id = `@{_id:'${doc._id}'}$.orphanLinks`;

    doc.orphanNodes = doc.orphanNodes || {};
    doc.orphanNodes._id = `@{_id:'${doc._id}'}$.orphanNodes`;

    doc.classes = doc.classes || {};
    doc.classes._id = `@{_id:'${doc._id}'}$.classes`;
    doc.classes.$members = doc.classes.$members || {};

    doc.groups = doc.groups || {};
    doc.groups._id = `@{_id:'${doc._id}'}$.groups`;
    doc.groups.$members = doc.classes.$members || {};

    doc.contents = doc.contents || {};
    this.mure.itemHandler.standardize(doc.contents, ['$', 'contents']);

    return doc;
  }
}

export default DocHandler;
