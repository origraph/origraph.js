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

```
npm install mure
```
or
```
<script src="https://mure-apps.github.io/mure-library/dist/mure.cjs.js"></script>
```

Temporary Development Notes
===========================
For now, because we're waiting on these packages to merge bugfixes, we initially have to do some messy stuff:
```
git clone https://github.com/fedorio/rollup-plugin-node-resolve.git
cd node-plugin-node-resolve
npm install
npm run build
npm link
cd ..

git clone https://github.com/isaacs/sax-js.git
cd sax-js
npm install
npm run build
npm link
cd ..

git clone https://github.com/mure-apps/mure-library.git
cd mure-library
npm install
npm link node-plugin-node-resolve
npm link sax
npm run build
npm link
cd ..

# now install your app and run
npm link mure
```

Usage
=====
Coming soon
