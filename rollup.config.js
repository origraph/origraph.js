import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import string from 'rollup-plugin-string';
import json from 'rollup-plugin-json';
// import { uglify } from 'rollup-plugin-uglify';
// import { terser } from 'rollup-plugin-terser';
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

let targets = {
  cjs: !process.env.TARGET || process.env.TARGET === 'cjs' || process.env.TARGET === 'all',
  umd: !process.env.TARGET || process.env.TARGET === 'umd' || process.env.TARGET === 'all',
  esm: !process.env.TARGET || process.env.TARGET === 'esm' || process.env.TARGET === 'all'
};

// Basic build formats, without minification
let builds = [];

if (targets.cjs) {
  // CommonJS build for Node.js
  builds.push({
    input: 'src/main.js',
    output: {
      file: pkg.main,
      format: 'cjs'
    },
    external: allExternals,
    plugins: commonPlugins
  });
}

if (targets.umd) {
  // browser-friendly UMD build
  builds.push({
    input: 'src/module.js',
    output: {
      name: 'mure',
      file: pkg.browser,
      format: 'umd',
      globals: { 'd3': 'd3' }
    },
    plugins: [
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
  });
}

if (targets.esm) {
  // ES Module build for bundlers
  builds.push({
    input: 'src/module.js',
    output: {
      file: pkg.module,
      format: 'es'
    },
    external: allExternals,
    plugins: commonPlugins
  });
}

// Create both minified and un-minified versions for
// builds with 'min.js' in their filenames
let minifiedBuilds = [];
/*
TODO: some kind of recent change to rollup-plugin-uglify has broken this...

builds.forEach(build => {
  if (build.output.file.endsWith('min.js')) {
    // Deep copy the build spec, add uglification
    let minBuild = Object.assign({}, build);
    minBuild.output = Object.assign({}, build.output);
    minBuild.plugins = minBuild.plugins.concat([
      build.output.file.endsWith('esm.min.js') ? terser() : uglify()
    ]);
    minifiedBuilds.push(minBuild);

    // Keep the un-minified version for development,
    // include a sourcemap
    build.output.file = build.output.file.replace(/min\.js/, 'js');
    build.output.sourcemap = 'inline';
  }
});
*/

export default builds.concat(minifiedBuilds);
