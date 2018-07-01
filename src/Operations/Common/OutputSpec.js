import { glompLists } from './utils.js';

class OutputSpec {
  constructor ({ newSelectors = null, pollutedDocs = [] } = {}) {
    this.newSelectors = newSelectors;
    this.pollutedDocs = pollutedDocs;
  }
}
OutputSpec.glomp = specList => {
  const newSelectors = specList.reduce((agg, spec) => {
    if (agg === null) {
      return spec.newSelectors;
    } else if (spec.newSelectors === null) {
      return agg;
    } else {
      return glompLists([agg, spec.newSelectors]);
    }
  }, null);
  const pollutedDocs = specList.reduce((agg, spec) => {
    return glompLists([agg, spec.pollutedDocs]);
  }, []);
  return new OutputSpec({
    newSelectors,
    pollutedDocs
  });
};

export default OutputSpec;
