import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import istanbul from 'rollup-plugin-istanbul';
import string from 'rollup-plugin-string';
import json from 'rollup-plugin-json';
import pkg from './package.json';

// Derive some of the configuration from package.json
const peerDependencies = Object.keys(pkg.peerDependencies || {});
const allExternals = peerDependencies.concat(
  Object.keys(pkg.dependencies || {})).concat(
  Object.keys(pkg.devDependencies || {}));
const commonPlugins = [
  string({ include: '**/*.text.*' }), // allow us to import files as strings
  json(), // import json files as modules
  babel({
    exclude: 'node_modules/**',
    externalHelpers: true
  }),
  istanbul({
    exclude: 'test/*'
  })
];

let targets = {
  cjs: !process.env.TARGET || process.env.TARGET === 'cjs' || process.env.TARGET === 'all',
  umd: !process.env.TARGET || process.env.TARGET === 'umd' || process.env.TARGET === 'all',
  esm: !process.env.TARGET || process.env.TARGET === 'esm' || process.env.TARGET === 'all'
};

let sourcemap = process.env.SOURCEMAP === 'false' ? false
  : process.env.SOURCEMAP === 'true' ? true : 'inline';

// Basic build formats, without minification
let builds = [];

if (targets.cjs) {
  // CommonJS build for Node.js
  builds.push({
    input: 'src/main.js',
    output: {
      file: pkg.main,
      format: 'cjs',
      sourcemap
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
      name: pkg.name,
      file: pkg.browser,
      format: 'umd',
      globals: { 'd3': 'd3' },
      sourcemap
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
      format: 'es',
      sourcemap
    },
    external: allExternals,
    plugins: commonPlugins
  });
}

export default builds;
