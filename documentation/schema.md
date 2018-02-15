# Mure documents
Mure documents are basically [PouchDB](https://pouchdb.com/) documents (arbitrary JSON that can be synced across browser tabs or even with CouchDB instances across machines), with four nuances:
1. Mure uses an [adaptation of CSS selector syntax](#reference-syntax) for internal references. When strings begin with a `@` character, we recognize and parse them as references; this is a basic mechanism for objects and documents to contain references to each other
2. For simple reference interpretation and file reshaping, arrays are always converted to objects on import (e.g. `['a','b']` becomes `{'0':'a','1':'b'}`). As long as the keys remain consecutive integers, these objects are converted back to arrays on export. For details, see [Importing and Exporting files](#importing-and-exporting-files).
3. Consistent with PouchDB, all documents must have an `_id` property at their root; our convention is to store these with the file extension *reversed* (e.g. `svg.myChart`) to make PouchDB's built-in `_id` index slightly more useful.
4. Mure apps often need to attach metadata outside a document's basic structure. Mure apps should create *shadow documents* (e.g. `_id: "svg.myChart/my-app-name"`) rather than store metadata in the document directly. Mure will include these in zipped downloads as `myChart.svg.my-app-name.mure.shadow` files.

# Reference Syntax
While documents and objects can take any free-form JSON shape, references rely on specific attribute names to be more powerful. For example:

```js
{
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
```
## Keys vs IDs
References treat actual `id` attributes are like any other string; to select by actual `id` attributes instead an object's key, you'd need to do something like `@[id="foo"]`.

## Reference Scope
Unless modifying syntactic sugar immediately follows the `@` character, all references are evaluated beginning at its containing document.

### Relative References (`@ <` and `@ ~`)
When parent (`<`) or sibling (`~`) syntactic sugar is present, the reference is evaluated relative to its current location. For example, `foo` selects `qux`, `quux`, and `quuz`; whereas `bar` and `corge` select `qux` and `quux`; and `baz` only selects `quux`:

```js
{
  '_id': 'json.myFile',
  'qux': {
    'tag': 'div',

    'foo': '@ div',
    'bar': '@ < div',
    'baz': '@ ~ div',

    'quux': {
      'tag': 'div',

      'corge': '@ < < div'
    }
  },
  'quuz': {
    'tag': 'div'
  }
}
```

Note that traversing above the document level is an error; you should instead use external references (next section) to refer outside the document.

### External References (`@ /svg.myChart/`)
References can also exist across files. This is particularly useful, for example, representing relational CSV files or databases.

TODO: provide an example, not totally sure about that syntactic sugar up there


# Importing and exporting files

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
  '_id': 'svg.myImage',
  'c': [
    {
      'xml': 'declaration',
      'version': '1.0',
      'encoding': 'UTF-8',
      'standalone': 'no'
    },
    {
      'tag': 'svg',
      'width': 500,
      'height': 500,
      'c': [
        {
          'tag': 'metadata',
          'id': 'mure',
          'xmlns': 'http://mure-apps.github.io'
        }
      ]
    }
  ]
}
```

## CSV
```js
{
  '_id': 'csv.myData',
  'n': {
    'tag': 'metadata',
    'n': {
      'id': 'mure',
      'xmlns': 'http://mure-apps.github.io'
    }
  },
  'o': [
    {
      {
        'n': {
          'foo': 3,
          'bar': 'baz'
        }
      },
      {
        'n': {
          'foo': 1,
          'bar': 'qux'
        }
      }
    }
  ]
}
```
