#!/bin/bash

declare -a formats=("es", "iife")

for f in "$formats[@]"
do
  ./node_modules/.bin/rollup "-c rollup.config.js --output.format $f --output.file build/mure.$f.js"
  ./node_modules/.bin/uglifyjs "./build/mure.$f.js -c -m -o ./build/mure.$f.min.js"
done
