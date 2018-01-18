/* globals d3, mure */

let tests = [
  {
    execute: () => {
      let svg = d3.select('body').append('svg');

      console.log(svg.node().outerHTML);

      svg.remove();
    }
  }
];

tests.forEach(test => test.execute());
