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

  test('Projected Edge Test', async () => {
    expect.assertions(2);

    const { people, movieEdges, movies } = await utils.setupSmallMovies();

    const collabEdges = people.projectNewEdge([
      movieEdges.classId,
      movies.classId,
      movieEdges.classId,
      people.classId
    ]);

    let count = await collabEdges.table.countRows();
    expect(count).toEqual(1928);

    const samples = [];
    for await (const pair of collabEdges.table.iterate(5)) {
      let source;
      for await (const sourceActor of pair.sourceNodes()) {
        // TODO: multiple sourceNodes() can occur because this is a self edge
        // (so both the target and source will be connectedItems for both
        // sourceNodes() and targetNodes()... ignoring this error for now)
        if (source) { break; }
        source = sourceActor;
      }
      let target;
      for await (const targetActor of pair.targetNodes()) {
        if (target && target !== source) {
          break;
        }
        target = targetActor;
      }
      samples.push({
        index: pair.index,
        source: source.row.name,
        target: target.row.name
      });
    }

    expect(samples).toEqual([
      {'index': '0⨯0', 'source': 'Keanu Reeves', 'target': 'Keanu Reeves'},
      {'index': '0⨯12', 'source': 'Keanu Reeves', 'target': 'Jack Nicholson'},
      {'index': '0⨯121', 'source': 'Keanu Reeves', 'target': 'Diane Keaton'},
      {'index': '0⨯122', 'source': 'Keanu Reeves', 'target': 'Nancy Meyers'},
      {'index': '0⨯122', 'source': 'Keanu Reeves', 'target': 'Nancy Meyers'}
    ]);
  });

  test('Unroll test', async () => {
    expect.assertions(3);

    let { movies } = await utils.setupBigMovies();

    let genreLinks = movies.unroll('genres');

    let samples = [];
    for await (const genreLink of genreLinks.table.iterate(3)) {
      for await (const intermediate of genreLink.edges()) {
        for await (const movie of intermediate.nodes({ classes: [movies] })) {
          samples.push({
            genre: genreLink.row.name,
            movie: movie.row.title
          });
        }
      }
    }
    expect(samples).toEqual([
      { 'genre': 'Science Fiction', 'movie': 'Venom' },
      { 'genre': 'Action', 'movie': 'Mission: Impossible - Fallout' },
      { 'genre': 'Thriller', 'movie': 'Mission: Impossible - Fallout' }
    ]);

    const genres = genreLinks.promote('name');

    samples = [];
    for await (const genre of genres.table.iterate(3)) {
      for await (const genreInt of genre.edges()) {
        for await (const genreLink of genreInt.nodes({ classes: [ genreLinks ], limit: 3 })) {
          for await (const movieInt of genreLink.edges()) {
            for await (const movie of movieInt.nodes({ classes: [ movies ] })) {
              samples.push({
                genre: genre.index,
                movie: movie.row.title
              });
            }
          }
        }
      }
    }
    expect(samples).toEqual([
      {'genre': 'Science Fiction', 'movie': 'Venom'},
      {'genre': 'Science Fiction', 'movie': 'Avengers: Infinity War'},
      {'genre': 'Science Fiction', 'movie': 'The Predator'},
      {'genre': 'Action', 'movie': 'Mission: Impossible - Fallout'},
      {'genre': 'Action', 'movie': 'Avengers: Infinity War'},
      {'genre': 'Action', 'movie': 'The Predator'},
      {'genre': 'Thriller', 'movie': 'Mission: Impossible - Fallout'},
      {'genre': 'Thriller', 'movie': 'The Predator'},
      {'genre': 'Thriller', 'movie': 'The Girl in the Spider\'s Web'}
    ]);

    genreLinks = genreLinks.interpretAsEdges({ autoconnect: true });

    samples = [];
    for await (const genre of genres.table.iterate(3)) {
      for await (const genreLink of genre.edges({ classes: [ genreLinks ], limit: 3 })) {
        for await (const movie of genreLink.nodes({ classes: [movies] })) {
          samples.push({
            genre: genre.index,
            movie: movie.row.title
          });
        }
      }
    }
    expect(samples).toEqual([
      {'genre': 'Science Fiction', 'movie': 'Venom'},
      {'genre': 'Science Fiction', 'movie': 'Avengers: Infinity War'},
      {'genre': 'Science Fiction', 'movie': 'The Predator'},
      {'genre': 'Action', 'movie': 'Mission: Impossible - Fallout'},
      {'genre': 'Action', 'movie': 'Avengers: Infinity War'},
      {'genre': 'Action', 'movie': 'The Predator'},
      {'genre': 'Thriller', 'movie': 'Mission: Impossible - Fallout'},
      {'genre': 'Thriller', 'movie': 'The Predator'},
      {'genre': 'Thriller', 'movie': 'The Girl in the Spider\'s Web'}
    ]);
  });
});
