# Mure documents
Mure documents are basically [PouchDB](https://pouchdb.com/) documents (arbitrary JSON that can be synced across browser tabs or even with CouchDB instances across machines), with some nuances:
1. Mure has a special [reference syntax](#reference-syntax). When any string value begins with an `@` character, we recognize and attempt to parse it as a reference; this is a basic mechanism for objects and documents to contain references to each other.
2. For simple reference interpretation and file reshaping, no arrays should exist in a document"s `contents`; instead, integer-keyed objects should be used (e.g. `["a","b"]` becomes `{"0":"a","1":"b"}`). As long as the keys remain consecutive integers starting at zero, these objects can be converted back to arrays on JSON export. For details, see [Importing and Exporting files](#importing-and-exporting-files).
3. All documents and objects must have an `_id` property at their root that follows a specific [convention](#file-ids) similar to `Content-Type` headers; this makes PouchDB"s built-in `_id` index slightly more useful.
4. The basic schema of all documents can be seen in `test/data/Untitled 1.json`; after upload, the contents of a file will be stored inside the `contents` object. The root level of each document is preserved for metadata (TODO: document the default `classes`, `groups`, `orphanNodes`, and `orphanEdges`).
5. Reserved keys throughout the document include: `_id`, `$tags`, `$members`, `$nodes`, and `$links` (TODO: document these)

# Reference Syntax
References should follow the following syntax:

`@ [ mango selector ] [ JSONPath ] [ parent selectors ] [ follow links ]`

All of the above parameters are optional; only the initial `@` symbol is required (selecting just `@` will create a convenience root selection containing the documents themselves, with most reshaping functionality disabled... for now).

## Examples:
Examples of selectors and their results can be seen in `test/data/singleFileSelectorTests.json` and in `test/data/multiFileSelectorTests.json`.
The difference between each is that the first contains the results where each selector is evaluated in this context:

```js
mure.select('{"_id":"application/json;blackJack_round1.json"}')
  .selectAll(selector);
```

Whereas `multiFileSelectorTests.json` contains results evaluated in this context, with several files loaded:

```js
mure.selectAll(selector);
```

TODO: show examples here instead of referring people to the test directory once things have settled down

## `select`, `selectAll`
`select` returns a `Selection` containing only the first match, whereas `selectAll` returns a `Selection` containing all matches.

## Mango selectors
References can point across documents. This is particularly useful, for example, when connecting relational CSV files.

To referencing another document, a selector should begin with the `selector` part of a `JSON.parse`able [Mango query](https://pouchdb.com/guides/mango-queries.html).

You can see mango selectors in use in examples (TODO) above.

When no mango selector is provided, all documents are queried (**warning**: you can imagine how this might be expensive if the user has loaded lots of documents! Best practice is to always include a query that's as restrictive as possible).

With respect to storing selectors as values inside files, please follow the convention (there's no way to enforce this via the library) that stored references should only apply locally to that document. External references to other files should be explicitly use some kind of external file query. In the event that you *really* want a stored reference to refer across *all* files, use the document selector `{"_id":{"$gt":"_\uffff"}}` to avoid picking up internal, reserved PouchDB (`_id`s begin with `_`) or Mure (`_id`s begin with `$`) documents.

## JSONPath
The root `$` selector corresponds to each matched document. No modification of the JSONPath is necessary when multiple files are selected; it will be evaluated for each file returned by the Mango selector. When no JSONPath is provided, the the root `$` selector is assumed (references the document itself).

Examples (TODO) demonstrate JSONPaths in use.

## Parent selectors
A selector can follow the JSONPath with a series of `↑` (U+2191) symbols to refer to the parent object that contains the matched result. This is useful when you want to filter objects based on nested child attributes. If the series of `↑` characters reach beyond a document, an empty result will be returned. Example (TODO) demonstrates a parent selector being used.

## Follow links
A selector can end with an additional `→` (U+2192) symbol to follow the selected link. Invalid / non-links are consequently ignored and excluded from the result. Note that links stored in files are evaluated only relative to their containing file, unless they specifically specify otherwise. In other words, you don't need to store mango queries inside files *unless* you deliberately mean to reference something in a different file or files (for now, auto-following cross-file references is not supported).

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
