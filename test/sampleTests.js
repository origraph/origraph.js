const origraph = require('../dist/origraph.cjs.js');
const utils = require('./utils.js');

describe('Sample Tests', () => {
  afterEach(() => {
    origraph.deleteAllModels();
  });

  test('Movie + Person + Edge', async () => {
    expect.assertions(4);

    let { people, movies, cast } = await utils.setupBigMovies();

    let count = await people.table.countRows();
    expect(count).toEqual(16233);
    count = await movies.table.countRows();
    expect(count).toEqual(103);
    count = await cast.table.countRows();
    expect(count).toEqual(5654);

    const testMovie = movies.table.currentData.data[18];
    const samples = [];
    for await (const role of testMovie.edges({ classes: [cast], limit: 5 })) {
      for await (const person of role.nodes({ classes: [people] })) {
        samples.push({
          movie: testMovie.row.title,
          character: role.row.character,
          actor: person.row.name
        });
      }
    }

    expect(samples).toEqual([
      {'actor': 'Chris Pratt', 'character': 'Peter Quill / Star-Lord', 'movie': 'Guardians of the Galaxy'},
      {'actor': 'Zoe Saldana', 'character': 'Gamora', 'movie': 'Guardians of the Galaxy'},
      {'actor': 'Dave Bautista', 'character': 'Drax the Destroyer', 'movie': 'Guardians of the Galaxy'},
      {'actor': 'Vin Diesel', 'character': 'Groot (voice)', 'movie': 'Guardians of the Galaxy'},
      {'actor': 'Bradley Cooper', 'character': 'Rocket (voice)', 'movie': 'Guardians of the Galaxy'}
    ]);
  });

  test('Person + Year + Person (as edges)', async () => {
    expect.assertions(3);

    let people = (await utils.loadFiles(['movies/small/people.csv']))[0];

    // Interpretation
    people = people.interpretAsNodes();
    const years = people.connectToNodeClass({
      otherNodeClass: people,
      attribute: 'born',
      otherAttribute: 'born'
    });

    let count = await people.table.countRows();
    expect(count).toEqual(133);
    count = await years.table.countRows();
    expect(count).toEqual(53);

    // Cherry-picked 1958 to give us interesting, but small results
    const testYear = years.table.currentData.data[years.table.currentData.lookup['1958']];
    const samples = [];
    for await (const person1 of testYear.sourceNodes()) {
      for await (const person2 of testYear.targetNodes()) {
        if (person1.row.name !== person2.row.name) {
          samples.push({
            person1: person1.row.name,
            person2: person2.row.name,
            born: testYear.index
          });
        }
      }
    }
    expect(samples).toEqual([
      {'born': '1958', 'person1': 'Kevin Bacon', 'person2': 'Ice-T'},
      {'born': '1958', 'person1': 'Kevin Bacon', 'person2': 'Chris Columbus'},
      {'born': '1958', 'person1': 'Ice-T', 'person2': 'Kevin Bacon'},
      {'born': '1958', 'person1': 'Ice-T', 'person2': 'Chris Columbus'},
      {'born': '1958', 'person1': 'Chris Columbus', 'person2': 'Kevin Bacon'},
      {'born': '1958', 'person1': 'Chris Columbus', 'person2': 'Ice-T'}
    ]);
  });
});
