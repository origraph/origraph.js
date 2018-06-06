import mime from 'mime-types';
import datalib from 'datalib';

class DocHandler {
  constructor () {
    this.keyNames = {};
    this.datalibFormats = ['json', 'csv', 'tsv', 'dsv', 'topojson', 'treejson'];
  }
  async parse (text, { format = {}, mimeType } = {}) {
    if (mimeType && (!format || !format.type)) {
      format.type = mime.extension(mimeType);
    }
    let contents;
    format.type = format.type ? format.type.toLowerCase() : 'json';
    if (this.datalibFormats.indexOf(format.type) !== -1) {
      contents = datalib.read(text, format);
    } else if (format.type === 'xml') {
      contents = this.parseXml(text, format);
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
  async standardize (doc, mure) {
    let existingUntitleds = await mure.db.allDocs({
      startkey: doc.mimeType + ';Untitled ',
      endkey: doc.mimeType + ';Untitled \uffff'
    });
    return mure.ITEM_TYPES.DocumentItem.standardize(doc, existingUntitleds, true);
  }
}

export default new DocHandler();
