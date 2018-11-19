const origraph = require('../dist/origraph.cjs.js');
const mime = require('mime-types');
const fs = require('fs');

const utils = {
  loadFiles: async function (filenames) {
    origraph.createModel();
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
  async getFiveSamples (tableObj) {
    const samples = [];
    for await (const sample of tableObj.iterate({ limit: 5 })) {
      samples.push(sample);
    }
    return samples;
  },
  setupMovies: async function () {
    let [ people, movies, movieEdges ] = await utils.loadFiles(['people.csv', 'movies.csv', 'movieEdges.csv']);

    // Initial interpretation
    people = people.interpretAsNodes();
    people.setClassName('People');

    movies = movies.interpretAsNodes();
    movies.setClassName('Movies');

    movieEdges = movieEdges.interpretAsEdges();

    // Set up initial connections
    people.connectToEdgeClass({
      edgeClass: movieEdges,
      side: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'personID'
    });
    movieEdges.connectToNodeClass({
      nodeClass: movies,
      side: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'movieID'
    });

    return { people, movies, movieEdges };
  }
};
module.exports = utils;
