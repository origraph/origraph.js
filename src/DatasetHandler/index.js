import datalib from 'datalib';

class DatasetHandler {
  inferParser (fileObj) {
    let ext = fileObj.type.split('/')[1];
    if (ext === 'csv') {
      return (contents) => { return datalib.read(contents, {type: 'csv', parse: 'auto'}); };
    } else if (ext === 'tsv') {
      return (contents) => { return datalib.read(contents, {type: 'tsv', parse: 'auto'}); };
    } else if (ext === 'dsv') {
      return (contents) => { return datalib.read(contents, {type: 'dsv', parse: 'auto'}); };
    } else if (ext === 'json') {
      // TODO: attempt to auto-discover topojson or treejson?
      return (contents) => { return datalib.read(contents, {type: 'json', parse: 'auto'}); };
    } else {
      return null;
    }
  }
  async embedDataset (fileObj, doc) {
    // TODO
    /*
    let parser = this.inferParser(fileObj);
    if (!parser) {
      let errorObj = new Error('Unkawait this.validateFileName(fileObj.name, metadata.datasets, reader.abort)nown data file type: ' + fileObj.type);
      this.trigger('error', errorObj);
      return Promise.reject(errorObj);
    }

    let existingDatasets = dh.selectAll(doc, '#mure > mure > datasets')[0];
    let reader = new window.FileReader();
    let fileId = await this.validateFileName(fileObj.name, metadata.datasets, reader.abort);
      .push({
        'type': 'element',
        'name': 'dataset',
        'attributes': {
          'format':
        }
      })

    metadata.datasets = metadata.datasets || {};

    let reader = new window.FileReader();
    let dataFileName = await this.validateFileName(fileObj.name, metadata.datasets, reader.abort);
    let fileText = await this.readFile(reader, fileObj);

    metadata.datasets[dataFileName] = parser(fileText);
    return this.saveFile({ metadata });
    */
  }
}

export default new DatasetHandler();
