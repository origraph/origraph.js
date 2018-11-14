const origraph = require('../dist/origraph.cjs.js');
const mime = require('mime-types');
const fs = require('fs');

module.exports = {
  loadFiles: async function (filenames) {
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
  },
  getNodeToNodeSamples: async function (nodeClassObj, branchLimit, fullLimit = 5) {
    const samples = [];
    let fullMatches = 0;
    for await (const node of nodeClassObj.table.iterate()) {
      for await (const edge of node.edges({ limit: branchLimit })) {
        for await (const source of edge.sourceNodes({ limit: branchLimit })) {
          for await (const target of edge.targetNodes({ limit: branchLimit })) {
            samples.push({ node, edge, source, target });
            fullMatches++;
            if (fullMatches >= fullLimit) {
              return samples;
            }
          }
        }
      }
    }
  },
  getNodeToEdgeSamples: async function (nodeClassObj, branchLimit = 1, fullLimit = 5) {
    const samples = [];
    let fullMatches = 0;
    for await (const node of nodeClassObj.table.iterate()) {
      for await (const edge of node.edges({ limit: branchLimit })) {
        samples.push({ node, edge });
        fullMatches++;
        if (fullMatches >= fullLimit) {
          return samples;
        }
      }
    }
    return samples;
  },
  getEdgeToNodeSamples: async function (edgeClassObj, branchLimit = 1, fullLimit = 5) {
    const samples = [];
    let fullMatches = 0;
    for await (const edge of edgeClassObj.table.iterate()) {
      for await (const source of edge.sourceNodes({ limit: branchLimit })) {
        for await (const target of edge.targetNodes({ limit: branchLimit })) {
          samples.push({ source, edge, target });
          fullMatches++;
          if (fullMatches >= fullLimit) {
            return samples;
          }
        }
      }
    }
    return samples;
  }
};
