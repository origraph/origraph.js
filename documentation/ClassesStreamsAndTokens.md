# Class Definitions

Classes refer to a specific slice of the data, and impose a specific interpretation on it.

Consequently, the most important parts of a class definition, as far as the system is concerned, are the <a href="#selectors-and-streams">selector</a> and the <a href="#interpretations">interpretation</a>.
Additional parts of the class definition, that matter more to the user's understanding (and less to the system), are <a href="class-names">class names</a> and <a href="annotations">annotations</a>.

## Selectors and Streams
Classes need a way to describe a slice of the data declaratively, without necessarily loading or traversing any data.
A **selector** defines a location in the data, that the **stream** uses to extract a series of **items**—items can be values, objects, arrays, or even object keys or array indices.

The series of **<a href="#token-reference">tokens</a>** in the selector indicate where and how items should be extracted from the raw data.

A class definition represents the canonical interpretation of an item; whenever _any_ stream encounters an item, `mure` looks into the set of class definitions to figure out how to **wrap** the item.

#### Example
For example, if we've loaded datasets that look like:

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

An "Actors" class could refer to the contents of the `actors.csv` with a selector like this:

`root.values('actors.csv').values()`

that, if sampled (with no additional interpretation), would yield a series of wrapped items like this:

```js
[
  GenericWrapper({
    rawItem: { "First name": "Carrie", "Last Name": "Fisher" },
    /* ... */
  }),
  GenericWrapper({
    rawItem: { "First name": "Harrison", "Last Name": "Ford" },
    /* ... */
  }),
  /* ... */
]
```

Alternatively, if we didn't have an `actors.csv` array, we could still refer to "Actor" entities using this selector (<a href="#promote">promoting</a> the keys inside `movies.json` as distinct entities):

`root.values('movies.json').values('cast').keys().promote()`

With this selector, samples would wrap the raw data like this:

```js
[
  GenericWrapper({
    rawItem: "Harrison Ford",
    /* ... */
  }),
  GenericWrapper({
    rawItem: "Carrie Fisher",
    /* ... */
  }),
  /* ... */
]
```


## Raw Data
Speaking of raw data, for large data, we want to delay most of the parsing / loading of raw data as we can until **after** interactive network modeling has taken place—if we want this to be scalable, only the final processing step should take a complete pass.
Consequently, modeling only relies on, at most, small samples of the raw data.

### Static Datasets
Small, in-memory datasets can simply be loaded into mure with some basic functions:

#### `addStaticDataSource(key, obj)`
Adds a raw Javascript object as a dataset.

`key` is the name that the dataset will be stored under
`obj` is the data object

#### `addStringAsStaticDataSource({ key, extension, text })`
Loads and parses a string as a dataset.

`key` is the name that the dataset will be stored under
`extension` is a file extension indicating how to parse the data (we use <a href="http://vega.github.io/datalib/">datalib</a> internally for most formats); should be one of:
  - `json`
  - `csv`
  - `tsv`
  - `topojson`
  - `treejson`
  - `xml`
  - `txt`
`text` is the string containing the data

#### `addFileAsStaticDataSource({ fileObj, encoding, extensionOverride, skipSizeCheck })`
Loads and parses a <a href="https://developer.mozilla.org/en-US/docs/Web/API/File">File</a>, such as the kind from an `<input type="file"/>` HTML element.

`fileObj` is the <a href="https://developer.mozilla.org/en-US/docs/Web/API/File">File</a>
`encoding` is optional; default is `UTF-8`
`extensionOverride` By default, the file is parsed based on its `mimeType`; you can use `extensionOverride` to ensure that a file is parsed, for example, as `topojson` instead of regular `json` by <a href="http://vega.github.io/datalib/">datalib</a>
`skipSizeCheck` if `true`, allows in-memory datasets larger than 30MB to be loaded

### Dynamic Datasets

TODO: For now, we're just using static datasets.
Some ideas for future directions for streaming larger files in node.js / the browser are below.
For each of these examples, we still need two helper functions:
1. Something to handle / chunk / close each browser / node raw stream (I know there are Stack Overflow examples somewhere...)
2. Something to parse chunks based on file format and yield objects... CSV is easy, but I think I've seen JSON / XML examples as well...

```js
// Streams reinterpret a "root" object that can contain all kinds of things
mure.root = {
  // Streaming a file in node.js (TODO: finish this)
  "rawMoviesFile": fs.createReadStream('movies.json'),

  // Streaming a file in the browser (TODO: finish this)
  "rawActorsFile": await fetch('actors.csv').then(response => response.body.getReader()),

  // We can also point to APIs:
  exampleApi: 'http://www.someapi.com/api',

  // TODO: I'm sure there are standard ways for streaming / getting paged results
  // from most databases?

  // Static datasets are stored directly:
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
};
```

Ultimately, dynamic datasets could take the form of:
1. A [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*)
3. A URL (?)

## Starting a stream
Once the raw data is set up, we can set up a stream like this:

```js
const stream = mure.stream({
  root,
  selector: 'root', // root would normally be followed by a series of tokens, described in the next section
  functions: {
    // custom named functions go here (some tokens refer to functions by name)
  },
  streams: {
    // named, connecting streams go here (some tokens refer to other streams by name)
  }
  // TODO: implement / document the DFS vs BFS traversalMode option
});

// What sampling might look like (would be used by our interactive interface)
const samples = stream.sample({ limit: 10 });
for await (const wrappedItem of samples) {
  console.log(wrappedItem.rawItem);
}

// What full iteration might look like (would be used by a node.js script)
const outputFile = fs.createWriteStream('result.csv');
outputFile.write(/* ... a csv file header string would go here ... */);
for await (const wrappedItem of stream.sample({ limit: Infinity })) {
  let row = '';
  /* ... convert wrappedItem.rawItem to a CSV string ... */
  outputFile.write(row);
}
outputFile.end();
```

## Interpretation
Classes represent the canonical **interpretation** of a graph—specifically, given an item from a stream, what role does it play? Is it a node? An edge?

Unless otherwise specified by the user, all items are considered <a href="#generic-classes">generic</a>.

### Generic Classes
Generic classes describe merely a tabular interpretation of items.
They can be <a href="#class-names">named</a> and <a href="#annotation">annotated</a>.
As they will usually have a common set of attributes, they could be displayed in a table.

As generic classes can not be connected to anything else, they can be trivially converted to isolated <a href="#node-classes">nodes</a> or <a href="#edge-classes">edges</a>.

#### `interpretAsNodes()`
Creates a new class definition ... (TODO: replaces existing definition if it existed?)

### Node Classes
(inherits from <a href="#generic-classes">Generic class</a>)

A node class can be connected to existing <a href="#edge-classes">edge</a> classes.
Additionally, node classes can be connected to other node classes, creating a _new_ edge class.

### Edge Classes
TODO

## Class Names
TODO

## Annotation
TODO

# Token Reference

The series of tokens in a selector represent a traversal of the overall data structure.
Each token yields a series of wrapped items (keys, indices, values, objects, or arrays) from the raw data, that serve as the input for the next token.
In the case of the final token, it identifies the series of wrapped values that make up the stream, or the members of a class.

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

Yields an object's keys, or an array's indices.

`query` is optional; if omitted, the token yields all keys and/or indices. If included, it should be a comma-delimited list of specific keys or indices (e.g. `.keys(0,'Some key',5-17,20-∞)`). Hyphenated numeric index ranges are accepted (ranges can reach to infinity with `∞`). Note that _all_ string keys must be wrapped with single quotes `'`. These characters should be escaped when part of a key string: `\'`, `\\`, `\,`

Unless `mure.debug` is `true`, this token quietly yields nothing if the input is not an object or array.

#### Examples
```js
const stream = mure.stream({
  root: {
    'dataset': ['a', 'b', 'c'],
  },
  selector: `root.values('dataset').keys()`
});
for await (const wrappedItem of stream.sample({ limit: Infinity })) {
  console.log(wrappedItem.rawItem);
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
for await (const wrappedItem of stream.sample({ limit: Infinity })) {
  console.log(wrappedItem.rawItem);
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
for await (const wrappedItem of stream.sample({ limit: Infinity })) {
  console.log(wrappedItem.rawItem);
}
/* Output:
b
f
*/
```

### Value
Syntax: `.value()`

Yields the corresponding value of an object's key, or an array's index.

Unless `mure.debug` is `true`, this token silently yields nothing if the input is not an object's key or an array's index.

#### Examples
```js
const stream = mure.stream({
  root: {
    'dataset': ['a', 'b', 'c', 'd', 'e', 'f'],
  },
  selector: `root.values('dataset').keys(0-2,4-∞).value()`
});
for await (const wrappedItem of stream.sample({ limit: Infinity })) {
  console.log(wrappedItem.rawItem);
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
for await (const wrappedItem of stream.sample({ limit: Infinity })) {
  console.log(wrappedItem.rawItem);
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
for await (const wrappedItem of stream.sample({ limit: Infinity })) {
  console.log(wrappedItem.rawItem);
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
for await (const wrappedItem of stream.sample({ limit: Infinity })) {
  console.log(wrappedItem.rawItem);
}
/* Output:
b
f
*/
```

### Evaluate
Syntax: `.evaluate()`

Interprets a key or value string in the data as a selector, evaluates it, and fowards any yielded results or errors of that evaluation.

Unless `mure.debug` is `true`, non-string inputs and bad selectors silently yield nothing.

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
for await (const wrappedActor of stream.sample({ limit: 2 })) {
  console.log(wrappedActor.rawItem['First Name']);
}
/* Output:
Harrison
Carrie
*/
```

### Link
Syntax: `.link()`

Interprets a key or value in the data as a URL, sends an AJAX request, and yields the object or string in the response body.

(TODO: should probably add a helper argument for dealing with pagination / throttling of API calls)

Unless `mure.debug` is `true`, non-string inputs and failed requests silently yield nothing.

#### Example
```js
const stream = mure.stream({
  root: {
    'people': 'https://swapi.co/api/people'
  },
  selector: `root.values('people').link().values('results').values()`
});
for await (const wrappedPerson of stream.sample({ limit: 2 })) {
  console.log(wrappedPerson.rawItem.name);
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
for await (const wrappedFilm of stream.sample({ limit: 2 })) {
  console.log(wrappedFilm.rawItem.title);
}
/* Output:
The Empire Strikes Back
Revenge of the Sith
*/
```

### Map
Syntax: `.map( generator )`

Allows a custom function (`generator`) to yield anything in response to input.

`generator` is required; it should be the <a href="#about-named-functions-and-streams">name</a> of a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) (may be `async`) that `yield`s the raw inputs to the next token in the selector. It will be called with this parameter:
- `wrappedItem` The wrapped item yielded by the previous token

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
    getFullName: function * (wrappedItem) {
      yield wrappedItem.rawItem['First Name'] + ' ' + wrappedItem.rawItem['Last Name'];
    }
  }
});

for await (const wrappedItem of stream.sample({ limit: 2 })) {
  console.log(wrappedItem.rawItem);
}
/* Output is:
Carrie Fisher
Harrison Ford
*/
```

### Promote
Syntax: `.promote( map, hash, reduceInstances )`

Only yields unique values the first time they're encountered.

`map` is optional; if included, it should be the <a href="#about-named-functions-and-streams">name</a> of a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) (may be `async`) that `yield`s the raw, unique, promoted items. This is useful, for example, in cases where we would want to wrap a promoted string value inside an object, in order to add attributes (via `reduceInstances`). If omitted, the first unique item is yielded as-is. It will be called with these parameters:
- `wrappedItem` The wrapped item yielded by the previous token

`hash` is optional; if included, it should be the <a href="#about-named-functions-and-streams">name</a> of a function that returns a raw, unique string that represents the item, so that the algorithm can tell if it has already been seen. Default behavior is to use [md5](https://www.npmjs.com/package/blueimp-md5). It will be called once for each raw item yielded by `map`:
- `rawItem` The not-yet-wrapped result of `map`

`reduceInstances` is optional; if included, it should be the <a href="#about-named-functions-and-streams">name</a> of a function that adds some kind of aggregate information, like a count, to the originally yielded, wrapped item. This function is called every time an additional match is encountered, with these parameters:
- `originalWrappedItem` The originally-yielded, wrapped item
- `newRawItem` The new, raw item that matches the original

**Note:** As `reduceInstances` can mutate the originally-yielded item, it's important to be aware that samples can change **after** they have already been consumed / rendered / etc! To detect this, client applications should listen for `update` events on the wrapped item.

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
    wrapActor: function * (rawItem) {
      yield { name: rawItem, count: 1 };
    },
    addActorCount: function (originalWrappedItem, newRawItem) {
      originalWrappedItem.count += 1;
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
Syntax: `.join( otherStream, thisKeys, otherKeys, map )`

Yields an item for every match between the input item and every item in `otherStream`

`otherStream` is required; should be the <a href="#about-named-functions-and-streams">name</a> of another stream.

`thisKeys` and `otherKeys` are optional <a href="#about-named-functions-and-streams">named</a> [generator functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) that should yield strings that will be used for indexing and matching. Default behavior, when omitted, is to return the item's key or index (or the key or index itself if one has been selected). (TODO: these arguments probably require their own section for what they do / why they're important)

`map` is optional; when omitted, default behavior is to yield an array containing both items, with the item from this stream as the first element, and the item from the other stream as the second. If included, it should be the <a href="#about-named-functions-and-streams">name</a> of a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) (may be `async`) that `yield`s a new, raw item. It will be called for each match with these parameters:
- `thisWrappedItem` The wrapped item from this selection that matched
- `otherWrappedItem` The wrapped item from `otherStream` that matched

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
    buildRoleObject: function * (thisWrappedItem, otherWrappedItem) {
      const castObject = thisWrappedItem
        .wrappedParent
        .wrappedParent;
      const movieObject = thisWrappedItem
        .wrappedParent
        .wrappedParent
        .wrappedParent
        .wrappedParent;
      yield {
        // thisWrappedItem is a key of the cast object, e.g. its raw value is
        // "Harrison Ford" or "Carrie Fisher"
        characterName: castObject[thisWrappedItem.rawItem],
        movieTitle: movieObject.title,
        // otherWrappedItem is the actor object
        reversedActorName: otherItem.rawItem['Last Name'] + ', ' + otherItem.rawItem['First Name']
      };
    }
  },
  streams: {
    actors
  }
});

for await (const wrappedRole of roles.sample({ limit: 2 })) {
  console.log(
    wrappedRole.rawItem.reversedActorName,
    wrappedRole.rawItem.characterName,
    wrappedRole.rawItem.movieTitle
  );
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
    objectsOnly: function * (wrappedItem) => {
      if (typeof wrappedItem.rawItem === 'object') {
        // Filter out the 'planets' dataset, because it's a URL, not an object:
        yield wrappedItem.rawItem;
      }
    }
  }
});

for await (const wrappedLocalDataset of localDatasets.sample({ limit: Infinity })) {
  console.log(JSON.stringify(wrappedLocalDataset.rawItem, null, 2));
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

### `identity`

### `md5`

### `noop`

### `attribute`
(TODO)
