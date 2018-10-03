const origraph = require('../dist/origraph.cjs.js');
const fs = require('fs');

module.exports = async function (filenames) {
  return Promise.all(filenames.map(async filename => {
    return new Promise((resolve, reject) => {
      fs.readFile(`test/data/${filename}`, 'utf8', async (err, text) => {
        if (err) { reject(err); }
        resolve(await origraph.addStringAsStaticTable({
          name: filename,
          extension: origraph.mime.extension(origraph.mime.lookup(filename)),
          text
        }));
      });
    });
  }));
};
