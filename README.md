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
For basic use in the browser:

```html
<script src="https://cdn.jsdelivr.net/npm/mure@0.3.0/dist/mure.umd.min.js"></script>
```

For server-side apps or pre-bundled browser apps:

```bash
npm install mure
```

However, for the latter, be advised that some of the dependencies of this library result in webpack / rollup / whatever configuration hell. If you discover a configuration that actually works, I'd love to hear about it!

# Usage
See the [boilerplate app](https://github.com/mure-apps/app-boilerplate) for a basic example for how to use the library to create a mure editor

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
When debugging in the browser, launch this in parallel to whatever you're using to debug / serve your web app:
```
npm run watchumd
```

*For now, just use symlinks to the dist/ folder; worry about `npm link` / app-level bundling in the future*

# Releasing a new version
A list of reminders to make sure I don't forget any steps:

- Update the version in package.json
- Update the release link in this README
- `npm run test`
- `npm run build`
- `git commit -a -m "commit message"`
- `git push`
- (Verify Travis CI doesn't fail)
- `git tag -a #.#.# -m "tag annotation"`
- `git push --tags`
- `npm publish`
- (maybe optional) Edit / document the release on Github, add built files in `dist`
