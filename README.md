mure.js
=======
[![Build Status](https://travis-ci.org/mure-apps/mure-library.svg?branch=master)](https://travis-ci.org/mure-apps/mure-library)

The Javascript integration library for the mure ecosystem of apps

Currently in development; ultimately, this will be a library that people can use
to create their own mure web editors / tools. Its goal is to standardize synced (via PouchDB / CouchDB) graphics, selection, and metadata changes between any other open mure apps.

As specific types of metadata (embedded datasets, bindings, etc) become standardized
across apps, some core functionality associated with that metadata may be
absorbed here as well.

Installation
============
For basic use in the browser ():

```html
<script src="https://cdn.jsdelivr.net/npm/mure@0.2.1/dist/mure.umd.js"></script>
```

For server-side apps or pre-bundled browser apps:

```bash
npm install mure
```

However, for the latter, be advised that some of the dependencies of this library result in webpack / rollup / whatever configuration hell. If you can figure out a configuration that actually works, I'd love to hear about it!

# Usage
See the [boilerplate app](https://github.com/mure-apps/app-boilerplate) for a basic example for how to use the library to create a mure editor

# Releasing a new version
(Mostly a list of reminders to make sure I don't forget any steps):

- Update the version in package.json
- `npm run test`
- Update the release link in this README
- `git commit -a -m "commit message"`
- `git tag -a #.#.# -m "tag annotation"`
- `git push --tags`
- Edit the release on Github, add built files in `dist`
- `npm publish`
