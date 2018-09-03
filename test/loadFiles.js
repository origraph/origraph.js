const mure = require('../dist/mure.cjs.js');
const fs = require('fs');

module.exports = async function (filenames) {
  return Promise.all(filenames.map(async filename => {
    return new Promise((resolve, reject) => {
      fs.readFile(`test/data/${filename}`, 'utf8', async (err, text) => {
        if (err) { reject(err); }
        resolve(await mure.addStringAsStaticTable({
          name: filename,
          extension: mure.mime.extension(mure.mime.lookup(filename)),
          text
        }));
      });
    });
  }));
};
