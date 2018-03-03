# Mure documents
Mure documents are basically [PouchDB](https://pouchdb.com/) documents (arbitrary JSON that can be synced across browser tabs or even with CouchDB instances across machines), with four nuances:
1. Mure uses an [adaptation of CSS selector syntax](#reference-syntax) for internal references. When strings begin with a `@` character, we recognize and parse them as references; this is a basic mechanism for objects and documents to contain references to each other
2. For simple reference interpretation and file reshaping, arrays are always converted to objects on import (e.g. `['a','b']` becomes `{'0':'a','1':'b'}`). As long as the keys remain consecutive integers, these objects are converted back to arrays on export. For details, see [Importing and Exporting files](#importing-and-exporting-files).
3. Consistent with PouchDB, all documents must have an `_id` property at their root; we follow a specific [convention](#file-ids) similar to `Content-Type` headers to make PouchDB's built-in `_id` index slightly more useful.
4. Mure apps often need to attach metadata outside a document's basic structure. Consequently, we use a `contents` attribute at the root level of every document—Mure apps can attach whatever metadata is necessary at the root level. Anything not under `contents` will be ignored by references, and will, at most, be imported / exported as separate files (e.g. `myChart.svg.my-app-name.mure`).

# Reference Syntax
While documents and objects can take any free-form JSON shape, references rely on specific attribute names to be more powerful. For example:

```js
{
  '_id': 'text/json;myFile.json',
  'filename': 'myFile.json',
  'mimeType': 'text/json',
  'charset': 'UTF-8',
  'contents': {
    'combinator-reference': '@div > span', // Combinators treat JSON objects like CSS selectors treat elements
    'id-reference': '@#foo', // The # ID selector selects an object by its key
    'tag-reference': '@div', // Regular CSS tag selectors look for objects that have a matching 'tag' property
    'class-reference': '@.a.b', // Class references look for objects that have a matching 'class' property
    'attribute-reference': '@[some-attribute=3]', // Attribute references look for objects that have a matching attributeSelector

    'foo': { // foo is selected by @#foo, @div, @.a.b, and @[some-attribute=3]
      'bar': { // bar is selected by @div > span
        'tag': 'span'
      },
      'tag': 'div',
      'class': 'a b',
      'some-attribute': 3,
    }
  }
};
```
## Keys vs IDs
References treat XML `id` attributes like any other string; instead, the `#` selector picks up objects by their key. To select by actual `id` attributes instead an object's key, you'd need to do something like `@[id="foo"]` instead of `#foo`.

## Reference Scope
Unless modifying syntactic sugar immediately follows the `@` character, all references are evaluated beginning at its containing document.

### Relative References (`@ <` and `@ ~`)
*TODO: unless there's an obvious need for these, I may remove parent references*

When parent (`<`) or sibling (`~`) syntactic sugar is present, the reference is evaluated relative to its current location. For example, `foo` selects `qux`, `quux`, and `quuz`; whereas `bar` and `corge` select `qux` and `quux`; and `baz` only selects `quux`:

```js
{
  '_id': 'text/json;myFile.json',
  'filename': 'myFile.json',
  'mimeType': 'text/json',
  'contents': {
    'qux': {
      'tag': 'div',

      'foo': '@ div',
      'bar': '@ < div',
      'baz': '@ ~',

      'quux': {
        'tag': 'div',

        'corge': '@ < < div'
      }
    },
    'quuz': {
      'tag': 'div'
    }
  }
}
```

Note that traversing above the document level is an error; you should instead use external references (next section) to refer outside the document.

### External References (`@ {}`)
References can also exist across documents. This is particularly useful, for example, when connecting relational CSV files.

If referencing another document, a selector should begin with a JSON `selector` argument of a [Mango query](https://pouchdb.com/guides/mango-queries.html). Usually, this should just refer to the filename (currently, only selecting a single file is supported).
For example, `foo` selects `bar`, and `baz` selects all the contents of `fileA.json`.

```js
{
  '_id': 'text/json;fileA.json',
  'contents': {
    'foo': '@ {"filename":"fileB.csv"} #bar'
  }
},
{
  '_id': 'text/json;fileB.json',
  'contents': {
    'bar': {
      'baz': '@ {"filename":"fileA.csv"}'
    }
  }
}
```

TODO: provide more examples

# File IDs
Our convention is to format document IDs similar to what you'd see in a `Content-Type` or `Content-Disposition` header, minus the keys, and with a specific order:
  1. mimeType
  2. filename
  3. charset (optional)

# Importing and exporting files
TODO: provide general guidance about separate metadata files, shadow trees, etc

## XML
### Export nuances
- Nested XML contents need to be ordered; as such, for XML files, all objects should have consecutive, integer keys (e.g. `"0", "1", "2", ...`).
  - Any integer keys with non-object values (e.g. primitives like strings) are stored as-is; i.e. as an XML attribute with the integer index as the key (this triggers a warning)
  - Any missing indices in the consecutive integer order also triggers a warning (e.g. `"0", "1", "3", ...`). Subsequent integer indices are still processed and stored in-order.
- A special `xml` attribute can indicate that an object is a non-element XML thing; it should be one of `element`, `declaration`, `cdata`, `comment`, `instruction`. Where the `xml` key is missing, the object is assumed to be an `element`. Any other values are stored as a string attribute of the element, and trigger a warning.
- The `tag` attributes used for references are also used to indicate XML tags; where the `tag` attribute is missing on an object, a default `div` tag is assumed (this triggers a warning). The mure library is happy to generate invalid XML; keeping track of XML namespaces and ensuring that nested tags cooperate is up to the client Mure app... or, for data reshaping apps, possibly even up to the user.
- By default, object keys are assumed to be element IDs; duplicates across the whole document are usually tolerated in most applications, but the mure library will still trigger duplicate ID warnings for convenience.
  - When object keys and actual `id` attributes conflict, the key is stored under a `data-mure-key` attribute, and a warning is triggered.

### Imported structure example
```js
{
  '_id': 'image/svg+xml;myImage.svg',
  'filename': 'myImage.svg',
  'mimeType': 'image/svg+xml',
  'charset': 'UTF-8',
  'contents': {
    '0': {
      'xml': 'declaration',
      'version': '1.0',
      'encoding': 'UTF-8',
      'standalone': 'no'
    },
    '1': {
      'tag': 'svg',
      'width': 500,
      'height': 500,
      '0': {
        'tag': 'metadata',
        'id': 'mure',
        'xmlns': 'http://mure-apps.github.io'
      }
    }
  }
}
```

## CSV
```js
{
  '_id': 'text/csv;myData.csv',
  'filename': 'myData.svg',
  'mimeType': 'text/csv',
  'contents': {
    '0': {
      'foo': 3,
      'bar': 'baz'
    },
    '1': {
      'foo': 1,
      'bar': 'qux'
    }
  }
}
```
