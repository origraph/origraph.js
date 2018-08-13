const fs = require('fs');
const mure = require('../dist/mure.cjs.js');
mure.debug = true;

async function getFiveSamples (classObj) {
  const samples = [];
  for await (const sample of classObj.sample({ limit: 5 })) {
    samples.push(sample.rawItem);
  }
  return samples;
}

describe('Interpretation Tests', () => {
  afterAll(() => {
    mure.removeDataSource('movies');
    mure.removeDataSource('actors');
  });

  test('Movies as Edges', async () => {
    expect.assertions(6);

    // Load movie data from JSON
    let movies = await mure.addStaticDataSource('movies', require('./data/movies.json'));

    // Load actor data from CSV
    const actorData = await new Promise((resolve, reject) => {
      fs.readFile('test/data/actors.csv', 'utf8', (err, data) => {
        if (err) { reject(err); }
        resolve(data);
      });
    });
    let actors = await mure.addStringAsStaticDataSource({
      key: 'actors',
      extension: 'csv',
      text: actorData
    });

    // Initially interpret actors and movies as nodes
    actors = actors.interpretAsNodes();
    movies = movies.interpretAsNodes();

    // Create "role" edges
    let roles = movies.connect(actors);

    // Test that the actors, movies, and roles are what we'd expect
    expect(await getFiveSamples(actors)).toEqual([
      // TODO
    ]);
    expect(await getFiveSamples(movies)).toEqual([
      // TODO
    ]);
    expect(await getFiveSamples(roles)).toEqual([
      // TODO
    ]);

    // Now interpret movies as edges
    movies.interpretAsEdges();

    // Test that actors and movies are what we'd expect:
    expect(await getFiveSamples(actors)).toEqual([
      // TODO
    ]);
    expect(await getFiveSamples(movies)).toEqual([
      // TODO
    ]);

    // TODO: what happened to the roles edges / its associated movie-nodes? Are
    // they still canonical?

    // Reinstate the roles class
    roles.reinstate();

    // Validate that roles, as well as its movie-nodes now exist
  });
});
