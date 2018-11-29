const origraph = require('../dist/origraph.cjs.js');
const utils = require('./utils.js');

describe('Derivation Tests', () => {
  afterEach(async () => {
    origraph.deleteAllModels();
  });

  test('Cast gender bias (movies and avg for cast members)', async () => {
    expect.assertions(2);

    const { movies, cast, people } = await utils.setupBigMovies();

    movies.table.deriveAttribute('castBias', async movie => {
      let nWomen = 0;
      let nMen = 0;
      for await (const role of movie.edges({ classes: [cast] })) {
        for await (const person of role.nodes({ classes: [people] })) {
          if (person.row.gender === 1) {
            nWomen++;
          } else if (person.row.gender === 2) {
            nMen++;
          }
        }
      }
      return nMen / (nMen + nWomen);
    });

    let samples = [];

    for await (const movie of movies.table.iterate(5)) {
      samples.push({
        movie: movie.row.title,
        castBias: await movie.row.castBias
      });
    }

    expect(samples).toEqual([ null ]);

    people.table.deriveAttribute('avgBiasWhenCast', async person => {
      let count = 0;
      let total = 0;
      for await (const role of person.edges({ classes: [cast] })) {
        for await (const movie of role.nodes({ classes: [movies] })) {
          total += await movie.row.castBias;
          count++;
        }
      }
      return total / count;
    });

    samples = [];
    for await (const person of people.table.iterate(5)) {
      samples.push({
        name: person.row.name,
        avgBiasWhenCast: await person.row.avgBiasWhenCast
      });
    }

    expect(samples).toEqual([ null ]);
  });
});
