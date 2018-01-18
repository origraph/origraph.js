import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
// import replace from 'rollup-plugin-replace';
import globals from 'rollup-plugin-node-globals';
import json from 'rollup-plugin-json';
import babel from 'rollup-plugin-babel';
import string from 'rollup-plugin-string';

// const packageJson = require('./package.json');
// const external = Object.keys(packageJson.dependencies);

export default {
  input: 'src/mure.js',
  output: {
    name: 'mure',
    sourcemap: 'inline'
  },
  plugins: [
    nodeResolve({
      module: true,
      jsnext: true,
      browser: true,
      preferBuiltins: false
    }),
    commonjs({
      ignoreGlobal: true
    }),
    globals(),
    json(),
    babel({
      exclude: 'node_modules/**'
    }),
    string({
      include: [
        '**/*.text.*'
      ]
    })
  ],
  onwarn: warning => {
    if (warning.code !== 'EVAL' ||
          !(/eslint-disable-line no-eval/.test(warning.frame))) {
      console.warn(warning.message);
    }
  }
};
