const origraph = require('../dist/origraph.cjs.js');
const mime = require('mime-types');
const fs = require('fs');

module.exports = async function (filenames) {
  return Promise.all(filenames.map(async filename => {
    return new Promise((resolve, reject) => {
      fs.readFile(`test/data/${filename}`, 'utf8', async (err, text) => {
        if (err) { reject(err); }
        resolve(await origraph.currentModel.addStringAsStaticTable({
          name: filename,
          extension: mime.extension(mime.lookup(filename)),
          text
        }));
      });
    });
  }));
};
