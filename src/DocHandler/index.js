import mime from 'mime-types';
import datalib from 'datalib';
import mureInteractivityRunnerText from './mureInteractivityRunner.text.js'; // eslint-disable-line no-unused-vars
import defaultSvgContentTemplate from './default.text.svg';
import minimumSvgContent from './minimum.text.svg';

// sneakily embed the interactivity-running script
const defaultSvgContent = defaultSvgContentTemplate.replace(/\${mureInteractivityRunnerText}/, mureInteractivityRunnerText);

class DocHandler {
  constructor (mure) {
    this.mure = mure;
    this.keyNames = {};
    this.datalibFormats = ['json', 'csv', 'tsv', 'dsv', 'topojson', 'treejson'];
    this.defaultSvgContent = this.parseXml(defaultSvgContent);
    this.minimumSvgContent = this.parseXml(minimumSvgContent);
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
    return { todo: true };
  }
  formatDoc (doc) {
    // TODO
    return 'todo';
  }
  isValidId (docId) {
    let parts = docId.split(';');
    if (parts.length !== 2) {
      return false;
    }
    return !!mime.extension(parts[0]);
  }
  async standardize (doc, { purgeArrays = false } = {}) {
    if (!doc._id || !this.isValidId(doc._id)) {
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
    if (!doc.mimeType) {
      doc.mimeType = doc._id.split(';')[0];
    }
    if (!mime.extension(doc.mimeType)) {
      this.mure.warn('Unknown mimeType: ' + doc.mimeType);
    }
    if (!doc.filename) {
      doc.filename = doc._id.split(';')[1];
    }
    if (!doc.contents) {
      doc.contents = {};
    }
    if (purgeArrays) {
      [doc.contents, doc.purgedArrays] = this.purgeArrays(doc.contents);
    }
    return doc;
  }
  purgeArrays (obj) {
    if (typeof obj !== 'object') {
      return [obj, false];
    }
    let foundArray = false;
    if (obj instanceof Array) {
      let temp = {};
      obj.forEach((element, index) => {
        temp[index] = element;
      });
      obj = temp;
      foundArray = true;
    }
    Object.keys(obj).forEach(key => {
      let foundChildArray, childObj;
      [childObj, foundChildArray] = this.purgeArrays(obj[key]);
      obj[key] = childObj;
      foundArray = foundArray || foundChildArray;
    });
    return [obj, foundArray];
  }
  restoreArrays (obj) {
    // todo
  }
}

export default DocHandler;
