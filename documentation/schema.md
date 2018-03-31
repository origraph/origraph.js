# Mure documents
Mure documents are basically [PouchDB](https://pouchdb.com/) documents (arbitrary JSON that can be synced across browser tabs or even with CouchDB instances across machines), with four nuances:
1. Mure has a special [reference syntax](#reference-syntax). When any string value begins with an `@` character, we recognize and attempt to parse it as a reference; this is a basic mechanism for objects and documents to contain references to each other.
2. For simple reference interpretation and file reshaping, no arrays should exist in a document"s `contents`; instead, integer-keyed objects should be used (e.g. `["a","b"]` becomes `{"0":"a","1":"b"}`). As long as the keys remain consecutive integers starting at zero, these objects can be converted back to arrays on JSON export. For details, see [Importing and Exporting files](#importing-and-exporting-files).
3. All documents must define an `_id` property at their root that follows a specific [convention](#file-ids) similar to `Content-Type` headers; this makes PouchDB"s built-in `_id` index slightly more useful.
4. Mure apps often need to attach metadata outside a document"s basic structure. Consequently, we use a `contents` attribute at the root level of every document, which is where the JSONPath component of references are evaluated. Mure apps can attach arbitrary metadata as necessary at the root level. Any data under non-reserved keys (`_id`, `_rev`, `filename`, `mimeType`, `charset`, `contents`) will be ignored by references, and will, at most, be imported / exported as separate files (e.g. `myChart.svg.my-app-name.mure`).

# Reference Syntax
References should follow the following syntax:

`@ [ mango selector ] [ JSONPath ] [ parent selectors ]`

All of the above parameters are optional; only the initial `@` symbol is required.

## Examples:
Given this document:

```json
{
  "_id": "application/json;blackJack_round1.json",
  "filename": "blackJack_round1.json",
  "mimeType": "application/json",
  "charset": "UTF-8",
  "contents": {
    "Player 1": {
      "0": {
        "suit": "♣",
        "value": "8"
      },
      "1": {
        "suit": "♣",
        "value": "Q"
      }
    },
    "Player 2": {
      "0": {
        "suit": "♥",
        "value": "A"
      },
      "1": {
        "suit": "♦",
        "value": "K"
      }
    },
    "Player 3": {
      "0": {
        "suit": "♦",
        "value": "2"
      },
      "1": {
        "suit": "♥",
        "value": "J"
      },
      "2": {
        "suit": "♠",
        "value": "K"
      }
    }
  }
}
```

1. This would return a `Selection` containing Player 1's whole hand:
```js
mure.selectDoc('application/json;blackJack_round1.json')
       .select('@ $["Player 1"]');
```

2. This is an alternate way to select the same thing with a single selection:
```js
mure.select('@ { "filename": "blackJack_round1.json" } $["Player 1"]');
```

3. This would return a `Selection` of both of Player 1's card objects:
```js
mure.selectDoc('application/json;blackJack_round1.json')
       .selectAll('@ $["Player 1"][?(@.suit==="♣")]');
```

4. This would return a `Selection` of all of the Player hands that contain a heart card (in this case, Player 2 and Player 3):
```js
mure.selectAll('@ { "filename": "blackJack_round1.json" } $[*][?(@.suit==="♥")] ^')
```

5. This would return a `Selection` containing all of the `contents` of files matching the regular expression, including the one shown above:
```js
mure.selectAll('@ { "filename": {"$regex": "blackJack_round\d*.json"} }');
```

## `select`, `selectAll`
`select` returns a `Selection` containing only the first match, whereas `selectAll` returns a `Selection` containing all matches.

## Mango selectors
References can point across documents. This is particularly useful, for example, when connecting relational CSV files.

To referencing another document, a selector should begin with the `selector` part of a `JSON.parse`able [Mango query](https://pouchdb.com/guides/mango-queries.html). Note that this is the only part of a reference that is exposed to the whole document, including any arbitrary metadata attached at the root level. This also means that you need to include the `contents` attribute in this part of the reference if you want to search for documents by their data content.

You can see mango selectors in use in examples 2, 4, and 5 above.

When no mango selector is provided, all documents are queried (**warning**: you can imagine how this might be expensive!).

With respect to storing selectors as values inside files, please follow the convention (there's no way to enforce this via the library) that stored references should only apply locally to that document. External references to other files should be explicitly use some kind of external file query (or, in the event that you *really* want a stored reference to refer across *all* files, use the document selector `{"_id":{"$gt":"_\uffff"}}` to avoid picking up internal PouchDB documents).

## JSONPath
By default (without a preceding Mango selector), the JSONPath is evaluated from its containing document's `contents` object. No modification of the JSONPath is necessary when multiple files are selected; it will be evaluated for each file returned by the Mango selector.

Examples 1 - 4 demonstrate JSONPaths in use.

When no JSONPath is provided, the the document's `contents` object is referenced.

## Parent selectors
A query can end with a series of `^` symbols to refer to the parent object that contains the matched result. This is useful when you want to filter objects based on nested child values attributes. If the series of `^` characters reach beyond the `contents`, an empty result will be returned. Example 4 demonstrates a parent selector being used.

# File IDs
Our convention is to format document `_id`s similar to what you'd see in a `Content-Type` or `Content-Disposition` header, minus the keys, and with a specific order:
  1. mimeType (will always be stored as lowercase)
  2. filename

For example: `application/json;myFile.json`

In addition to PouchDB reserving `_id`s beginning with an underscore; Mure reserves `_id`s beginning with a dollar sign (e.g. for special signalling documents like `$currentSelector`).

# Importing and exporting files
TODO: provide general guidance about separate metadata files, shadow trees, etc

## XML
### Export nuances
- Nested XML contents need to be ordered; as such, for XML files, all objects should have consecutive, integer keys (e.g. `"0", "1", "2", ...`).
  - Any integer keys with non-object values (e.g. primitives like strings) are stored as-is; i.e. as an XML attribute with the integer index as the key (this triggers a warning)
  - Any missing indices in the consecutive integer order also triggers a warning (e.g. `"0", "1", "3", ...`). Subsequent integer indices are still processed and stored in-order.
- A special `xml` attribute can indicate that an object is a non-element XML thing; it should be one of `element`, `declaration`, `cdata`, `comment`, `instruction`. Where the `xml` key is missing, the object is assumed to be an `element`. Any other values are stored as a string attribute of the element, and trigger a warning.
- Another special `tag` attribute is recognized; where the `tag` attribute is missing on an object, a default `div` tag is assumed (this triggers a warning). The mure library is happy to generate invalid XML; keeping track of XML namespaces and ensuring that nested tags cooperate is up to the client Mure app... or, for data reshaping apps, possibly even up to the user.

### Imported structure example
```json
{
  "_id": "image/svg+xml;myImage.svg",
  "filename": "myImage.svg",
  "mimeType": "image/svg+xml",
  "charset": "UTF-8",
  "contents": {
    "0": {
      "xml": "declaration",
      "version": "1.0",
      "encoding": "UTF-8",
      "standalone": "no"
    },
    "1": {
      "tag": "svg",
      "width": 500,
      "height": 500,
      "0": {
        "tag": "metadata",
        "id": "mure",
        "xmlns": "http://mure-apps.github.io"
      }
    }
  }
}
```

## CSV
```json
{
  "_id": "text/csv;myData.csv",
  "filename": "myData.svg",
  "mimeType": "text/csv",
  "contents": {
    "0": {
      "foo": 3,
      "bar": "baz"
    },
    "1": {
      "foo": 1,
      "bar": "qux"
    }
  }
}
```
