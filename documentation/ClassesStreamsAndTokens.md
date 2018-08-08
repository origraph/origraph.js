# Class Specification

Classes are stored in memory like this:
```javascript
const allClasses = [
  {
    names: ['My Class'], // if undefined, auto-inferred from the stream
    annotations: ['This is what I think of these items'],
    interpretation: 'Node', // can be 'Node', 'Edge', or undefined
    stream: mure.stream({ /* ... more on this below ... */ })
  }
];
```

The only required part of a class is the **stream definition**, described in the next section. TODO: more about classes' optional, user-defined bits

# Streams
Classes need a way to describe their items, without loading or traversing any data. We also need to be able to sample a class's items. For example, if we've loaded datasets that look like:

```js
{
  "actors.csv": [
    { "First name": "Carrie", "Last Name": "Fisher" },
    { "First name": "Harrison", "Last Name": "Ford" },
    ...
  ],
  "movies.json": [
    {
      "title": "Star Wars",
      "cast": {
        "Harrison Ford": "Han Solo",
        "Carrie Fisher": "Princess Leia",
        ...
      }
    },
    ...
  ]
}
```

An "Actors" class that refers to the contents of the `actors.csv` array would need to use a selector like this:

`root.values('actors.csv').values()`

Alternatively, if we didn't have an `actors.csv` array, we could still refer to "Actor" entities using this selector (promoting the keys inside `movies.json` as distinct entities):

`root.values('movies.json').values('cast').keys().promote()`

The selector defines a location in the data, that the stream uses to extract a series of items (keys, values, objects, or arrays). The series of characters in the selector are called _tokens_—these indicate where and how items should be extracted from the raw data that has been loaded or linked.

Ultimately, we want streams to be able to do things like:
```javascript
// Streams reinterpret a "root" object that can contain all kinds of things
const root = {
  /* ... all loaded or linked data goes here ... */
  exampleParsedCsvFile: [ /* ... parsed rows would go here ... */ ],
  exampleJsonFile: { /* ... loaded JSON would go here ... */ }
  exampleApi: 'http://www.someapi.com/api'
};

// Initializing a stream
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
outputFile.write(/* csv file header string goes here */);
for await (const item of stream.sample({ limit: Infinity })) {
  let row = '';
  /* ... convert item to a CSV row ... */
  outputFile.write(row);
}
outputFile.end();
```

# Token Reference

The series of tokens in a selector represent a traversal of the overall data structure. Each token yields a series of values that serve as the input for the next token, or, in the case of the final token, the series of values that make up the stream.

- **`root`** Indicates the start of a selector, and yields the root object.
- **`.keys( query )`** Yields an object's keys, or an array's indices. Throws a `TypeError` if the input is not an object or array.
  - `query` is optional; if omitted, the token yields all keys and/or indices. If included, it should be a comma-delimited list of specific keys or indices (e.g. `.keys(0,'Some key',5-17,'⌘hidden key',20-∞)`). Hyphenated numeric index ranges are accepted (ranges can reach to infinity with `∞`). Note that all key strings must be wrapped with `'` or `"`. These characters should be escaped when part of a key string: `\'`, `\"`, `\\`
- **`.value()`** Yields the corresponding value of an object's key, or an array's index; a `TypeError` is thrown if the input is not an object's key or an array's index.
- **`.values( query )`** Shorthand for `.keys( query ).value()`
- **`.evaluate()`** Interprets a key or value string in the data as a selector, evaluates it, and fowards any yielded results or errors of that evaluation. Non-string inputs throw `TypeError`, and bad selectors throw `SyntaxError`.
- **`.link()`** Interprets a key or value in the data as a URL, sends an AJAX request, and yields the object or string in the response body. Non-string inputs throw `TypeError`, and failed requests throw `URIError`.
- **`.map( generator )`** Allows a custom function (`generator`) to yield anything in response to input.
  - `generator` is required; it should be the name of a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) (may be `async`) that `yield`s the inputs to the next token in the selector.
- **`.promote( map, hash, reduceInstances )`** Only yield unique values the first time they're encountered
  - `map` is optional; if included, it should be the name of a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) (may be `async`) that `yield`s the unique, promoted items. This is useful, for example, in cases where we would want to wrap a promoted string value inside an object, in order to add attributes (via `reduceInstances`). If omitted, the first unique item is yielded as-is.
  - `hash` is optional; if included, it should be the name of a function that returns a unique string that represents this item, so that the algorithm can tell if it has already been seen. Its `item` argument is the result of `map`. Default behavior is to use [md5](https://www.npmjs.com/package/blueimp-md5).
  - `reduceInstances` is optional; if included, it should be a function that adds some kind of aggregate information, like a count, to the originally yielded item. Its parameters are `function (yieldedItem, newMatchItem, path) {}`. This is called every time an additional match is encountered. **Note:** As this can mutate the originally-yielded item, it's important to be aware that samples can change **after** they have already been consumed / rendered / etc! The only way to know if an item is stable is if the sampling process has completed.
- **`.union( otherStream )`** Yields the results of `otherStream` after the current stream has been completed.
  - `otherStream` is required; should be the name of another stream, provided in the `mure.stream(streams={ ... })` parameter.
- **`.join( otherStream, thisKey, otherKey, map )`** Yields an item for every match between the input item and every item in `otherStream`
  - `otherStream` is required; should be the name of another stream, provided in the `mure.stream(streams={ ... })` parameter.
  - `thisKey` and `otherKey` are optional named functions that should return a string that will be used for indexing and matching. Default behavior, when omitted, is to return the item's key or index (or the key or index itself if one has been selected). (TODO: these arguments probably require their own section for what they do / why they're important)
  - `map` is optional; when omitted, default behavior is to yield an array containing both items, with the item from this stream as the first element, and the item from the other stream as the second. If included, it should be the name of a [generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) (may be `async`) that `yield`s a new item. Its parameters are: `function * (thisItem, thisPath, otherItem, otherPath) { ... }`.

# About Named Functions
Unless otherwise specified, all functions are called with two arguments: `function * (item, path) { ... }`, where `item` is the input item yielded by the previous token, and `path` is the result of each token leading up to `item` (`path[0]` is the root, and `path[path.length - 1]` is `item`).

The name of each function should correspond to a key in the `functions` argument. For example, this would yield all datasets that have been loaded in memory as items:
```javascript
mure.stream({
  root: { /* ... */ },
  selector: 'root.values().map(objectsOnly)',
  functions: {
    objectsOnly: function * (item, path) => {
      if (typeof item === 'object') {
        yield item;
      }
    }
  }
})
```

# Examples: TODO!
All of the examples below operate in the context of this example root object:

```js
const root = {
  'Actors': {

  },
  'Roles': {

  },
  'Star Wars API': {
    'people': 'https://swapi.co/people',
    'planets': 'https://swapi.co/planets',
    'films': 'https://swapi.co/films',
    'species': 'https://swapi.co/species',
    'vehicles': 'https://swapi.co/vehicles',
    'starships': 'https://swapi.co/starships'
  }
};


```

# Example Workflows
TODO!
