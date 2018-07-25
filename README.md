mure.js
=======
[![Build Status](https://travis-ci.org/mure-apps/mure-library.svg?branch=master)](https://travis-ci.org/mure-apps/mure-library)
[![Coverage Status](https://coveralls.io/repos/github/mure-apps/mure-library/badge.svg?branch=master)](https://coveralls.io/github/mure-apps/mure-library?branch=master)

`mure.js` is a library for wrangling graph data inside PouchDB. Graph constructs (like node, edge, supernode, hyperedge, class, etc) are deliberately lightweight, so that they are easy to map (and re-map) to data items, regardless of how the PouchDB documents are structured.

Its main technical strength lies in its [d3.js](https://d3js.org/)-esque selection mechanisms, that take advantage of whatever structures already exist in a document (e.g. rows in a CSV file), but also any graph metadata attached to items. Consequently, a `mure.selectAll()` command provides a unified mechanism for operations like pivoting from one selection to another, connecting nodes, assigning node or edge classes, converting from one construct to another, grouping items, promoting and piping values, merging and dissolving supernodes or hyperedges, and toggling edge direction.

![Operations](documentation/teaser.svg)

Be advised that this is project is *very* work-in-progress, and is being implemented in parallel with [Origraph](https://github.com/mure-apps/origraph), the non-programmer's visual interface for using this library.
Expect frequent sweeping changes and poor documentation for now, especially as we explore and refine what constructs and operations are even important for this graph data wrangling.

Installation
============
For basic use in the browser:

```html
<script src="https://cdn.jsdelivr.net/npm/mure@0.4.2/dist/mure.umd.min.js"></script>
```

For server-side apps or pre-bundled browser apps:

```bash
npm install mure
```

However, for the latter, be advised that some of the dependencies of this library result in webpack / rollup / whatever configuration hell. If you discover a configuration that actually works, we'd love to hear about it!

Development
===========
## Setup:

```bash
git clone https://github.com/mure-apps/mure-library.git
cd mure-library
npm install
```

## Debugging:
When debugging with the test scripts, launch these as parallel processes:

```
npm run watchcjs
```

```
npm run debug
```

## Debugging in the browser:
When debugging in the browser, launch this in parallel to whatever you're using to debug / serve your web app (make sure to point your app to the built `dist/mure.umd.js` file):
```
npm run watchumd
```

# Releasing a new version
A list of reminders to make sure we don't forget any steps:

- Run `npm-check-updates`
- Update the version in package.json
- Update the release link in this README
- `npm run build`
- `npm run test`
- `git commit -a -m "commit message"`
- `git push`
- (Verify Travis CI doesn't fail)
- `git tag -a #.#.# -m "tag annotation"`
- `git push --tags`
- `npm publish`
- (maybe optional) Edit / document the release on Github, add built files in `dist`
