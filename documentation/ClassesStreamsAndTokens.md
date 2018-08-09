# Class Specification

Classes are stored in memory like this:
```js
const allClasses = [
  {
    names: ['My Class'], // if undefined, auto-inferred from the stream
    annotations: ['This is what I think of these items'],
    interpretation: 'Node', // can be 'Node', 'Edge', or undefined
    stream: mure.stream({ /* ... more on this below ... */ })
  }
];
```

The only required part of a class is the stream definition, described in the next section. *TODO: more about classes' optional, user-defined parts, as well as defaults that are inferred from the stream when they're undefined*

# Streams
Classes need a way to describe their items declaratively, without loading or traversing any data. We also need to be able to sample a class's items. For example, if we've loaded datasets that look like:

```js
{
  "actors.csv": [
    { "First name": "Carrie", "Last Name": "Fisher" },
    { "First name": "Harrison", "Last Name": "Ford" },
    /* ... */
  ],
  "movies.json": [
    {
      "title": "Star Wars",
      "cast": {
        "Harrison Ford": "Han Solo",
        "Carrie Fisher": "Leia Organa",
        /* ... */
      }
    },
    /* ... */
  ]
}
```

An "Actors" class could refer to the contents of the `actors.csv` with a **selector** like this:

`root.values('actors.csv').values()`

Alternatively, if we didn't have an `actors.csv` array, we could still refer to "Actor" entities using this selector (promoting the keys inside `movies.json` as distinct entities):

`root.values('movies.json').values('cast').keys().promote()`

The selector defines a location in the data, that the stream uses to extract a series of items (keys, values, objects, or arrays). The series of **<a href="#token-reference">tokens</a>** in the selector indicate where and how items should be extracted from the raw data that has been loaded or linked.

## Raw Data
Speaking of raw data, we want to delay most of the parsing / loading of raw data as we can until **after** interactive network modeling has taken place—if we want this to be scalable, only the final processing step should take a complete pass.
Modeling should, at most, rely on samples of the raw data.

Consequently, we need a way to refer to the raw data, and sample it without actually loading the whole thing.

TODO: for now, we're just using in-memory, pre-parsed Javascript objects at the root, and I've written some hints below for where we could get started on streaming files in node.js / the browser. For each of the streaming examples, we still need two helper functions:
1. Something to handle / chunks / close each browser / node raw stream (I know there are Stack Overflow examples somewhere...)
2. Something to parse chunks based on file format and yield objects... CSV is easy, but I think I've seen JSON / XML examples as well...

```js
// Streams reinterpret a "root" object that can contain all kinds of things
const root = {
  // Streaming a file in node.js (TODO: finish this)
  "rawMoviesFile": fs.createReadStream('movies.json'),

  // Streaming a file in the browser (TODO: finish this)
  "rawActorsFile": await fetch('actors.csv').then(response => response.body.getReader()),

  // Of course, we can handle in-memory, pre-parsed, native Javascript objects:
  "actors.csv": [
    { "First name": "Carrie", "Last Name": "Fisher" },
    { "First name": "Harrison", "Last Name": "Ford" },
    /* ... */
  ],
  "movies.json": [
    {
      "title": "Star Wars",
      "cast": {
        "Harrison Ford": "Han Solo",
        "Carrie Fisher": "Leia Organa",
        /* ... */
      }
    },
    /* ... */
  ],

  // We can also point to APIs:
  exampleApi: 'http://www.someapi.com/api'

  // TODO: I'm sure there are standard ways for streaming / getting paged results
  // from most databases?
};
```

Ultimately, each raw data source should be stored as:
1. A raw Javascript object
2. A [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*)
3. A URL (?)

## Starting a stream
Once the raw data is set up in a `root` object, we can set up a stream like this:

```js
const stream = mure.stream({
  root,
  selector: 'root', // root would normally be followed by a series of tokens, described in the next section
  functions: {
    // named functions go here (some tokens refer to functions by name)
  },
  streams: {
    // named, connecting streams go here (some tokens refer to other streams by name)
  },
  mode: 'permissive'
  /* Default mode is permissive. Errors thrown by tokens are ignored, and the
     stream continues to attempt to extract items. The alternative is 'debug,'
     where all token errors are thrown, and the stream terminates immediately. */
});

// What sampling might look like (would be used by our interactive interface)
const samples = stream.sample({ limit: 10 });
for await (const item of samples) {
  console.log(item);
}

// What full iteration might look like (would be used by a node.js script)
const outputFile = fs.createWriteStream('result.csv');
outputFile.write(/* ... csv file header string goes here ... */);
for await (const item of stream.sample({ limit: Infinity })) {
  let row = '';
  /* ... convert item to a CSV row ... */
  outputFile.write(row);
}
outputFile.end();
```

## Token Reference

The series of tokens in a selector represent a traversal of the overall data structure. Each token yields a series of values that serve as the input for the next token, or, in the case of the final token, the series of values that make up the stream.

### Root
Syntax: `root`

#### Example
```js
const stream = mure.stream({
  root: {
    'emptyDataset': [],
  },
  selector: `root`
});

for await (const root of stream.sample({ limit: Infinity })) {
  console.log(JSON.stringify(root));
}
/* Output is:
{"emptyDataset":[]}
*/
```

Indicates the start of a selector, and yields the root object.

### Keys
Syntax: `.keys( query )`

Yields an object's keys, or an array's indices. Throws a `TypeError` if the input is not an object or array.

`query` is optional; if omitted, the token yields all keys and/or indices. If included, it should be a comma-delimited list of specific keys or indices (e.g. `.keys(0,'Some key',5-17,20-∞)`). Hyphenated numeric index ranges are accepted (ranges can reach to infinity with `∞`). Note that all key strings must be wrapped with single quotes `'`. These characters should be escaped when part of a key string: `\'`, `\\`, `\,`

#### Examples
```js
const stream = mure.stream({
  root: {
    'dataset': ['a', 'b', 'c'],
  },
  selector: `root.values('dataset').keys()`
});
for await (const item of stream.sample({ limit: Infinity })) {
  console.log(item);
}
/* Output:
0
1
2
*/
```
```js
const stream = mure.stream({
  root: {
    'dataset': ['a', 'b', 'c', 'd', 'e', 'f'],
  },
  selector: `root.values('dataset').keys(0-2,4-∞).value()`
});
for await (const item of stream.sample({ limit: Infinity })) {
  console.log(item);
}
/* Output:
a
b
c
e
f
*/
```
```js
const stream = mure.stream({
  root: {
    'dataset': { a: 'b', c: 'd', e: 'f' },
  },
  selector: `root.values('dataset').keys(a,e).value()`
});
for await (const item of stream.sample({ limit: Infinity })) {
  console.log(item);
}
/* Output:
b
f
*/
```

### Value
Syntax: `.value()`

Yields the corresponding value of an object's key, or an array's index; a `TypeError` is thrown if the input is not an object's key or an array's index.

#### Examples
```js
const stream = mure.stream({
  root: {
    'dataset': ['a', 'b', 'c', 'd', 'e', 'f'],
  },
  selector: `root.values('dataset').keys(0-2,4-∞).value()`
});
for await (const item of stream.sample({ limit: Infinity })) {
  console.log(item);
}
/* Output:
a
b
c
e
f
*/
```
```js
const stream = mure.stream({
  root: {
    'dataset': { a: 'b', c: 'd', e: 'f' },
  },
  selector: `root.values('dataset').keys(a,e).value()`
});
for await (const item of stream.sample({ limit: Infinity })) {
  console.log(item);
}
/* Output:
b
f
*/
```

### Values
Syntax: `.values( query )`

Shorthand for `.keys( query ).value()`

#### Examples
```js
const stream = mure.stream({
  root: {
    'dataset': ['a', 'b', 'c', 'd', 'e', 'f'],
  },
  selector: `root.values('dataset').values(0-2,4-∞)`
});
for await (const item of stream.sample({ limit: Infinity })) {
  console.log(item);
}
/* Output:
a
b
c
e
f
*/
```
```js
const stream = mure.stream({
  root: {
    'dataset': { a: 'b', c: 'd', e: 'f' },
  },
  selector: `root.values('dataset').values(a,e)`
});
for await (const item of stream.sample({ limit: Infinity })) {
  console.log(item);
}
/* Output:
b
f
*/
```

### Evaluate
Syntax: `.evaluate()`

Interprets a key or value string in the data as a selector, evaluates it, and fowards any yielded results or errors of that evaluation. Non-string inputs throw `TypeError`, and bad selectors throw `SyntaxError`.

#### Example
```js
const stream = mure.stream({
  root: {
    'actors.csv': [
      { 'First name': 'Carrie', 'Last Name': 'Fisher' },
      { 'First name': 'Harrison', 'Last Name': 'Ford' },
      /* ... */
    ],
    'movies.json': [
      {
        'title': 'Star Wars',
        'cast': {
          'Han Solo': `root.values('actors.csv').values(1)`,
          'Leia Organa': `root.values('actors.csv').values(1)`,
          /* ... */
        }
      },
      /* ... */
    ]
  },
  selector: `root.values('movies.json').values('cast').values().evaluate()`
});
for await (const actor of stream.sample({ limit: 2 })) {
  console.log(actor['First Name']);
}
/* Output:
Harrison
Carrie
*/
```

### Link
Syntax: `.link()`

Interprets a key or value in the data as a URL, sends an AJAX request, and yields the object or string in the response body. Non-string inputs throw `TypeError`, and failed requests throw `URIError`.

(TODO: should probably add a helper argument for dealing with pagination / throttling of API calls)

#### Example
```js
const stream = mure.stream({
  root: {
    'people': 'https://swapi.co/api/people'
  },
  selector: `root.values('people').link()
                 .values('results').values()`
});
for await (const person of stream.sample({ limit: 2 })) {
  console.log(person['name']);
}
/* Output:
Luke Skywalker
C-3PO
*/
```
```js
const stream = mure.stream({
  root: {
    'people': 'https://swapi.co/api/people'
  },
  selector: `root.values('people').link()
                 .values('results').values()
                 .values('films').values().link()
                 .values('results').values()`
});
for await (const film of stream.sample({ limit: 2 })) {
  console.log(film['title']);
}
/* Output:
The Empire Strikes Back
Revenge of the Sith
*/
```

### Map
Syntax: `.map( generator )`

Allows a custom function (`generator`) to yield anything in response to input.

`generator` is required; it should be the <a href="#about-named-functions-and-streams">name</a> of a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) (may be `async`) that `yield`s the inputs to the next token in the selector. It will be called with these parameters:
- `item` The item yielded by the previous token
- `path` An array containing each result leading up to `item`, yielded by each preceding token. `path[0]` is the root object, and `path[path.length - 1]` is `item`.

#### Example
```js
const stream = mure.stream({
  selector: `root.values('actors.csv').map(getFullName)`
  root: {
    'actors.csv': [
      { 'First name': 'Carrie', 'Last Name': 'Fisher' },
      { 'First name': 'Harrison', 'Last Name': 'Ford' },
      /* ... */
    ],
  },
  functions: {
    getFullName: function * (item) {
      yield item['First Name'] + ' ' + item['Last Name'];
    }
  }
});

for await (const item of stream.sample({ limit: 2 })) {
  console.log(item);
}
/* Output is:
Carrie Fisher
Harrison Ford
*/
```

### Promote
Syntax: `.promote( map, hash, reduceInstances )`

Only yields unique values the first time they're encountered.

`map` is optional; if included, it should be the <a href="#about-named-functions-and-streams">name</a> of a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) (may be `async`) that `yield`s the unique, promoted items. This is useful, for example, in cases where we would want to wrap a promoted string value inside an object, in order to add attributes (via `reduceInstances`). If omitted, the first unique item is yielded as-is. It will be called with these parameters:
- `item` The item yielded by the previous token
- `path` An array containing each result leading up to `item`, yielded by each preceding token. `path[0]` is the root object, and `path[path.length - 1]` is `item`.

`hash` is optional; if included, it should be the <a href="#about-named-functions-and-streams">name</a> of a function that returns a unique string that represents the item, so that the algorithm can tell if it has already been seen. Default behavior is to use [md5](https://www.npmjs.com/package/blueimp-md5). It will be called once for each item yielded by `map`:
- `item` The result of `map`
- `path` An array containing each result leading up to `item`, yielded by each preceding token. `path[0]` is the root object, and `path[path.length - 1]` is `item`.

`reduceInstances` is optional; if included, it should be the <a href="#about-named-functions-and-streams">name</a> of a function that adds some kind of aggregate information, like a count, to the originally yielded item. This function is called every time an additional match is encountered, with these parameters:
- `yieldedItem` The originally-yielded item
- `newMatchItem` The new item that matches the original
- `path` The path leading up to `newMatchItem` (except for `newMatchItem`, the path should be identical to the one originally encountered with `yieldedItem`)

**Note:** As `reduceInstances` can mutate the originally-yielded item, it's important to be aware that samples can change **after** they have already been consumed / rendered / etc! The only way to know if an item is stable is if the sampling process has completed.

#### Examples
```js
const stream = mure.stream({
  selector: `root.values('movies.json').values('cast').keys().promote(wrapActor, , addActorCount)`
  root: {
    'movies.json': [
      {
        'title': 'Star Wars',
        'cast': {
          'Harrison Ford': 'Han Solo',
          'Carrie Fisher': 'Leia Organa',
          /* ... */
        }
      },
      /* ... */
    ]
  },
  functions: {
    wrapActor: function * (item, path) {
      yield { name: item, count: 1 };
    },
    addActorCount: function (yieldedItem, newMatchItem, path) {
      yieldedItem.count += 1;
    }
  }
});

for await (const actor of stream.sample({ limit: 2 })) {
  console.log(actor.name, actor.count);
}
/* Output is:
Carrie Fisher 1
Harrison Ford 1
*/

const actors = [];
for await (const actor of stream.sample({ limit: Infinity })) {
  actors.push(actor);
}
for await (const actor of actors) {
  console.log(actor.name, actor.count);
}
/* Output might look like:
Carrie Fisher 38
Harrison Ford 52
...
*/
```

### Union
Syntax: `.union( otherStream )`

Yields the results of `otherStream` after the current stream has been completed.

`otherStream` is required; should be the <a href="#about-named-functions-and-streams">name</a> of another stream.

#### Example
```js
const root = {
  jedi: [
    { name: 'Luke Skywalker' },
    /* ... */
  ],
  sith: [
    { name: 'Darth Vader' },
    /* ... */
  ]
};

const jediStream = mure.stream({
  root,
  selector: `root.values('jedi').values()`
});
const forceUsersStream = mure.stream({
  root,
  selector: `root.values('sith').values().union(jediStream)`,
  streams: {
    jediStream
  }
});
```

### Join
Syntax: `.join( otherStream, thisKey, otherKey, map )`

Yields an item for every match between the input item and every item in `otherStream`

`otherStream` is required; should be the <a href="#about-named-functions-and-streams">name</a> of another stream.

`thisKey` and `otherKey` are optional <a href="#about-named-functions-and-streams">named</a> [generator functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) that should yield strings that will be used for indexing and matching. Default behavior, when omitted, is to return the item's key or index (or the key or index itself if one has been selected). (TODO: these arguments probably require their own section for what they do / why they're important)

`map` is optional; when omitted, default behavior is to yield an array containing both items, with the item from this stream as the first element, and the item from the other stream as the second. If included, it should be the <a href="#about-named-functions-and-streams">name</a> of a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) (may be `async`) that `yield`s a new item. It will be called for each match with these parameters:
- `thisItem` The item from this selection that matched
- `thisPath` The path leading up to `thisItem`
- `otherItem` The item from `otherStream` that matched
- `otherPath` The path leading up to `otherItem`

#### Examples
```js
const root = {
  'actors.csv': [
    { 'First name': 'Carrie', 'Last Name': 'Fisher' },
    { 'First name': 'Harrison', 'Last Name': 'Ford' },
    /* ... */
  ],
  'movies.json': [
    {
      'title': 'Star Wars',
      'cast': {
        'Harrison Ford': 'Han Solo',
        'Carrie Fisher': 'Leia Organa',
        /* ... */
      }
    },
    /* ... */
  ]
};

const actors = mure.stream({
  root,
  selector: `root.values('actors.csv').values()`
});

const roles = mure.stream({
  root,
  selector: `root.values('movies.json').values().keys('cast').join(actors, , actorKey, buildRoleObject)`,
  functions: {
    actorKey: function * (item, path) {
      yield item['First name'] + ' ' + item['Last Name'];
    },
    buildRoleObject: function * (thisItem, thisPath, otherItem, otherPath) {
      const castObject = thisPath[thisPath.length - 2];
      const movieObject = thisPath[thisPath.length - 4];
      yield {
        // thisItem is a key of the cast object, e.g. "Harrison Ford" or "Carrie Fisher"
        characterName: c### `commaDelimitedAttribute`

### ``astObject[thisItem],
        movieTitle: movieObject.title,
        // otherItem is the actor object
        reversedActorName: otherItem['Last Name'] + ', ' + otherItem['First Name'],
        // Save foreign keys into the other tables:
        actorIndex: otherPath[otherPath.length - 2],
        movieIndex: thisPath[thisPath.length - 5]
      };
    }
  },
  streams: {
    actors
  }
})

for await (const role of roles.sample({ limit: 2 })) {
  console.log(role.reversedActorName, role.characterName, role.movieTitle);
}
/* Output:
Ford, Harrison Han Solo Star Wars
Fisher, Carrie Leia Organa Star Wars
*/
```

# About Named Functions and Streams
The library includes a set of <a href="#predefined-function-library">predefined named functions</a> that you can choose from, or you can provide your own custom logic via the `functions` argument. For example:
```js
const localDatasets = mure.stream({
  root: {
    people: [
      { name: 'Luke Skywalker' },
      /* ... */
    ],
    planets: 'https://swapi.co/api/planets/'
  },
  selector: 'root.values().map(objectsOnly)',
  functions: {
    objectsOnly: function * (item, path) => {
      if (typeof item === 'object') {
        // Filter out the 'planets' dataset, because it's a URL, not an object:
        yield item;
      }
    }
  }
});

for await (const localDataset of localDatasets.sample({ limit: Infinity })) {
  console.log(JSON.stringify(localDataset, null, 2));
}
/* Output:
[
  {
    "name": "Luke Skywalker",
    ...
  },
  ...
]
*/
```

References to other streams, as used by the <a href="#union">Union</a> and <a href="#join">Join</a> tokens, should also be passed to the stream definition. For example:
```js
const root = {
  jedi: [
    { name: 'Luke Skywalker' },
    /* ... */
  ],
  sith: [
    { name: 'Darth Vader' },
    /* ... */
  ]
};

const jediStream = mure.stream({
  root,
  selector: `root.values('jedi').values()`
});
const forceUsersStream = mure.stream({
  root,
  selector: `root.values('sith').values().union(jediStream)`,
  streams: {
    jediStream
  }
});
```

## Predefined Function Library

### `attribute`
(TODO)
