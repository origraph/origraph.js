const fs = require('fs');
const mure = require('../dist/mure.cjs.js');
mure.debug = true;

describe('Interpretation Tests', () => {
  afterAll(() => {
    mure.removeDataSource('movies');
    mure.removeDataSource('actors');
  });

  test('Movie + Person nodes + Connections', async () => {
    expect.assertions(3);

    const files = ['people.csv', 'movies.csv', 'movieEdges.csv'];
    const classes = await Promise.all(files.map(async filename => {
      return new Promise((resolve, reject) => {
        fs.readFile(`test/data/${filename}`, 'utf8', async (err, text) => {
          if (err) { reject(err); }
          resolve(await mure.addStringAsStaticTable({
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
    mure.classes[peopleId].addHashFunction('id', function * (wrappedItem) {
      yield wrappedItem.rawItem.id;
    });
    mure.classes[moviesId].addHashFunction('id', function * (wrappedItem) {
      yield wrappedItem.rawItem.id;
    });
    mure.classes[movieEdgesId].addHashFunction('sourceID', function * (wrappedItem) {
      yield wrappedItem.rawItem.sourceID;
    });
    mure.classes[movieEdgesId].addHashFunction('targetID', function * (wrappedItem) {
      yield wrappedItem.rawItem.targetID;
    });

    await mure.classes[peopleId].connectToEdgeClass({
      edgeClass: mure.classes[movieEdgesId],
      direction: 'source',
      nodeHashName: 'id',
      edgeHashName: 'sourceID'
    });
    await mure.classes[movieEdgesId].connectToNodeClass({
      nodeClass: mure.classes[moviesId],
      direction: 'target',
      nodeHashName: 'id',
      edgeHashName: 'targetID'
    });

    expect(mure.getRawClasses()).toEqual({
      // TODO
    });
  });
});
