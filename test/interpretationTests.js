const fs = require('fs');
const mure = require('../dist/mure.cjs.js');
mure.debug = true;

describe('Interpretation Tests', () => {
  afterAll(() => {
    mure.removeDataSource('movies');
    mure.removeDataSource('actors');
  });

  test('Movie + Person nodes + Connections', async () => {
    expect.assertions(1);

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
    mure.classes[peopleId].interpretAsNodes();
    mure.classes[peopleId].setClassName('People');

    mure.classes[moviesId].interpretAsNodes();
    mure.classes[moviesId].setClassName('Movies');

    mure.classes[movieEdgesId].interpretAsEdges();

    // Set up initial connections
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

    expect(mure.getRawObject(mure.classes)).toEqual({
      'class2': {
        'annotation': '',
        'classId': 'class2',
        'className': 'People',
        'edgeClassIds': {
          'class4': true
        },
        'tableId': 'table2',
        'type': 'NodeClass'
      },
      'class3': {
        'annotation': '',
        'classId': 'class3',
        'className': 'Movies',
        'edgeClassIds': {
          'class4': true
        },
        'tableId': 'table3',
        'type': 'NodeClass'
      },
      'class4': {
        'annotation': '',
        'classId': 'class4',
        'className': null,
        'directed': false,
        'sourceClassId': 'class2',
        'sourceEdgeAttr': null,
        'sourceNodeAttr': null,
        'tableId': 'table4',
        'targetClassId': 'class3',
        'type': 'EdgeClass'
      }
    });
  });
});
