# Selector Syntax

- `@` Indicates the beginning of a selector; when stored as a key or value, traversal begins relative to that key or value (absolute references should begin with `@$`)
- `$` Navigates to the root
- `[]` Navigates to objects' keys; may contain:
  - `*` Indicates all keys (but ignores keys that begin with `⌘`)
  - `1,'Some key',5-17,'⌘hidden key'` Navigates using specific comma-delimited keys; hyphenated numeric ranges are also accepted
- `→` Moves from a key to a value
- `←` Moves from a value to a key, or from a key to its containing object
- `↬` Parses and follows keys or values as selectors, relative to the location of that selector
- `🔗` Navigates to object retrieved, if any, from an AJAX request to the url stored in the key or value
- `⌘` Navigates to any meta objects from the root level (including nested meta objects) that refer to the current location. For example, if the root looks like this:
```json
{
  "foo" : {
    "bar": {}
  },
  "⌘baz": {
    "$['foo']→['bar']→": 1,
    "⌘quz": {
      "$['foo']→['bar']": 2
    }
  }
}
```

`@$['foo']→['bar']→⌘` would navigate to `1`
`@$['foo']→['bar']⌘` would navigate to `2`
