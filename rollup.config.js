import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import babel from 'rollup-plugin-babel';
import string from 'rollup-plugin-string';
import json from 'rollup-plugin-json';
import uglify from 'rollup-plugin-uglify';
import uglifyEs from 'uglify-es';
import pkg from './package.json';

// Derive some of the configuration from package.json
const peerDependencies = Object.keys(pkg.peerDependencies);
const allExternals = peerDependencies.concat(
  Object.keys(pkg.dependencies)).concat(
  Object.keys(pkg.devDependencies));
const commonPlugins = [
  string({ include: '**/*.text.*' }), // allow us to import files as strings
  json(), // import json files as modules
  babel({ exclude: ['node_modules/**'] }) // let us use fancy new things like async in our code
];

// Basic build formats, without minification
let builds = [
  // browser-friendly UMD build
  {
    input: 'src/module.js',
    output: {
      name: 'mure',
      file: pkg.browser,
      format: 'umd',
      globals: { 'd3': 'd3' }
    },
    plugins: [
      replace({
        include: ['node_modules/uuid/**'],
        delimiters: ['', ''],
        values: {
          'crypto.randomBytes': 'require(\'randombytes\')'
        }
      }),
      resolve({
        browser: true,
        preferBuiltins: true
      }), // so Rollup can find dependencies
      commonjs(), // so Rollup can convert dependencies to ES modules
      builtins(),
      globals()
    ].concat(commonPlugins),
    external: peerDependencies,
    onwarn: message => {
      if (/Circular dependency/.test(message)) return;
      console.error(message);
    }
  },
  // CommonJS build for Node.js
  {
    input: 'src/main.js',
    output: {
      file: pkg.main,
      format: 'cjs'
    },
    external: allExternals,
    plugins: commonPlugins
  },
  // ES Module build for bundlers
  {
    input: 'src/module.js',
    output: {
      file: pkg.module,
      format: 'es'
    },
    external: allExternals,
    plugins: commonPlugins
  }
];

// Create both minified and un-minified versions for
// builds with 'min.js' in their filenames
let minifiedBuilds = [];
builds.forEach(build => {
  if (build.output.file.endsWith('min.js')) {
    // Deep copy the build spec, add uglification
    let minBuild = Object.assign({}, build);
    minBuild.output = Object.assign({}, build.output);
    minBuild.plugins = minBuild.plugins.concat([
      uglify({}, uglifyEs.minfier)
    ]);
    minifiedBuilds.push(minBuild);

    // Keep the un-minified version for development,
    // include a sourcemap
    build.output.file = build.output.file.replace(/min\.js/, 'js');
    build.output.sourcemap = 'inline';
  }
});

export default builds.concat(minifiedBuilds);
