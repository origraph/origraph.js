import FileFormat from './FileFormat.js';
import JSZip from 'jszip';

class CsvZip extends FileFormat {
  async importData ({
    model,
    text
  }) {
    throw new Error(`unimplemented`);
  }
  async formatData ({
    model,
    includeClasses = Object.values(model.classes),
    indexName = 'index'
  }) {
    const zip = new JSZip();

    for (const classObj of includeClasses) {
      const attributes = classObj.table.attributes;
      let contents = `${indexName},${attributes.join(',')}\n`;
      for await (const item of classObj.table.iterate()) {
        const row = attributes.map(attr => item.row[attr]);
        contents += `${item.index},${row.join(',')}\n`;
      }
      zip.file(classObj.className + '.csv', contents);
    }

    return {
      data: 'data:application/zip;base64,' + await zip.generateAsync({ type: 'base64' }),
      type: 'application/zip',
      extension: 'zip'
    };
  }
}
export default new CsvZip();
