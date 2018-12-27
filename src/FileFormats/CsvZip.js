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
      const attributes = classObj.table.unSuppressedAttributes;
      let contents = `${indexName},${attributes.join(',')}\n`;
      for await (const item of classObj.table.iterate()) {
        contents += `${item.index}`;
        for (const attr of attributes) {
          contents += `,${await item.row[attr]}`;
        }
        contents += `\n`;
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
