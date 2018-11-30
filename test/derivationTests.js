const origraph = require('../dist/origraph.cjs.js');
const utils = require('./utils.js');

describe('Derivation Tests', () => {
  afterEach(async () => {
    origraph.deleteAllModels();
  });

  test('Filter Test', async () => {
    expect.assertions(1);

    const { people } = await utils.setupBigMovies();

    people.table.addFilter('gender', gender => gender > 0);

    const samples = [];
    for await (const person of people.table.iterate(5)) {
      samples.push({
        name: person.row.name,
        gender: person.row.gender
      });
    }

    expect(samples).toEqual([
      {'gender': 2, 'name': 'Tom Hardy'},
      {'gender': 1, 'name': 'Michelle Williams'},
      {'gender': 2, 'name': 'Riz Ahmed'},
      {'gender': 2, 'name': 'Scott Haze'},
      {'gender': 2, 'name': 'Reid Scott'}
    ]);
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

    await movies.table.buildCache();
    let allData = movies.table.currentData;

    let samples = await Promise.all([0, 1, 2, 3, 4]
      .map(async index => {
        return {
          title: allData.data[index].row.title,
          castBias: await allData.data[index].row.castBias
        };
      }));

    expect(samples).toEqual([
      {'castBias': 0.52, 'title': 'Venom'},
      {'castBias': 0.68, 'title': 'Mission: Impossible - Fallout'},
      {'castBias': 0.8823529411764706, 'title': 'Bohemian Rhapsody'},
      {'castBias': 0.6792452830188679, 'title': 'Avengers: Infinity War'},
      {'castBias': 0.875, 'title': 'The Predator'}
    ]);

    people.table.deriveAttribute('avgBiasWhenCast', async person => {
      let count = 0;
      let total = 0;
      for await (const role of person.edges({ classes: [cast] })) {
        for await (const movie of role.nodes({ classes: [movies] })) {
          const castBias = await movie.row.castBias;
          if (!isNaN(castBias)) {
            total += castBias;
            count++;
          }
        }
      }
      return total / count;
    });

    await people.table.buildCache();
    allData = people.table.currentData;

    samples = await Promise.all([0, 1, 2, 3, 4]
      .map(async index => {
        return {
          name: allData.data[index].row.name,
          gender: allData.data[index].row.gender,
          avgBiasWhenCast: await allData.data[index].row.avgBiasWhenCast
        };
      }));

    expect(samples).toEqual([
      {'avgBiasWhenCast': 0.6236363636363637, 'gender': 2, 'name': 'Tom Hardy'},
      {'avgBiasWhenCast': 0.51, 'gender': 1, 'name': 'Michelle Williams'},
      {'avgBiasWhenCast': 0.585, 'gender': 2, 'name': 'Riz Ahmed'},
      {'avgBiasWhenCast': 0.52, 'gender': 2, 'name': 'Scott Haze'},
      {'avgBiasWhenCast': 0.52, 'gender': 2, 'name': 'Reid Scott'}
    ]);
  });
});
