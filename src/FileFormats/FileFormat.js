class FileFormat {
  async buildRow (item) {
    const row = {};
    for (let attr in item.row) {
      row[attr] = await item.row[attr];
    }
    return row;
  }
}
export default FileFormat;
