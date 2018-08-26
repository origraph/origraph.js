const fs = require('fs');
const mure = require('../dist/mure.cjs.js');
mure.debug = true;

async function getFiveSamples (classObj) {
  const samples = [];
  for await (const sample of classObj.getStream().sample({ limit: 5 })) {
    samples.push(sample.rawItem);
  }
  return samples;
}

describe('Interpretation Tests', () => {
  afterAll(() => {
    mure.removeDataSource('movies');
    mure.removeDataSource('actors');
  });

  test('Movies as Nodes', async () => {
    expect.assertions(3);

    const files = ['people.csv', 'movies.csv', 'movieEdges.csv'];
    const classes = await Promise.all(files.map(async filename => {
      return new Promise((resolve, reject) => {
        fs.readFile(`test/data/${filename}`, 'utf8', async (err, text) => {
          if (err) { reject(err); }
          resolve(await mure.addStringAsStaticDataSource({
            key: filename,
            extension: mure.mime.extension(mure.mime.lookup(filename)),
            text
          }));
        });
      });
    }));

    const [ peopleId, moviesId, movieEdgesId ] = classes.map(classObj => classObj.classId);

    // Initial interpretation
    await mure.classes[peopleId].interpretAsNodes();
    await mure.classes[moviesId].interpretAsNodes();
    await mure.classes[movieEdgesId].interpretAsEdges();

    // Set up initial connections
    mure.classes[peopleId].setNamedFunction('id', function * (wrappedItem) {
      yield wrappedItem.rawItem.id;
    });
    mure.classes[moviesId].setNamedFunction('id', function * (wrappedItem) {
      yield wrappedItem.rawItem.id;
    });
    mure.classes[movieEdgesId].setNamedFunction('sourceId', function * (wrappedItem) {
      yield wrappedItem.rawItem.sourceId;
    });
    mure.classes[movieEdgesId].setNamedFunction('targetId', function * (wrappedItem) {
      yield wrappedItem.rawItem.targetId;
    });

    await mure.classes[peopleId].connectToEdgeClass({
      edgeClass: mure.classes[movieEdgesId],
      direction: 'source',
      nodeHashName: 'id',
      edgeHashName: 'sourceId'
    });
    await mure.classes[movieEdgesId].connectToNodeClass({
      nodeClass: mure.classes[moviesId],
      direction: 'target',
      nodeHashName: 'id',
      edgeHashName: 'targetId'
    });

    // Test that the actors, movies, and edges are what we'd expect
    expect(await getFiveSamples(mure.classes[peopleId])).toEqual([
      {'born': '1964', 'id': '1', 'name': 'Keanu Reeves'},
      {'born': '1967', 'id': '2', 'name': 'Carrie-Anne Moss'},
      {'born': '1961', 'id': '3', 'name': 'Laurence Fishburne'},
      {'born': '1960', 'id': '4', 'name': 'Hugo Weaving'},
      {'born': '1967', 'id': '5', 'name': 'Andy Wachowski'}
    ]);
    expect(await getFiveSamples(mure.classes[moviesId])).toEqual([
      {'id': '0', 'released': '1999', 'tagline': 'Welcome to the Real World', 'title': 'The Matrix'},
      {'id': '9', 'released': '2003', 'tagline': 'Free your mind', 'title': 'The Matrix Reloaded'},
      {'id': '10', 'released': '2003', 'tagline': 'Everything that has a beginning has an end', 'title': 'The Matrix Revolutions'},
      {'id': '11', 'released': '1997', 'tagline': 'Evil has its winning ways', 'title': 'The Devil\'s Advocate'},
      {'id': '15', 'released': '1992', 'tagline': 'In the heart of the nation\'s capital, in a courthouse of the U.S. government, one man will stop at nothing to keep his honor, and one will stop at nothing to find the truth.', 'title': 'A Few Good Men'}
    ]);
    expect(await getFiveSamples(mure.classes[movieEdgesId])).toEqual([
      // TODO
    ]);
  });
});
