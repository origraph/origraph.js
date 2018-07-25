class OutputSpec {
  constructor ({ newSelectors = null, pollutedDocs = {}, warnings = {} } = {}) {
    this.newSelectors = newSelectors;
    this.pollutedDocs = pollutedDocs;
    this.warnings = warnings;
  }
  addSelectors (selectors) {
    this.newSelectors = (this.newSelectors || []).concat(selectors);
  }
  flagPollutedDoc (doc) {
    this.pollutedDocs[doc._id] = doc;
  }
  warn (warning) {
    this.warnings[warning] = this.warnings[warning] || 0;
    this.warnings[warning] += 1;
  }
}
OutputSpec.glomp = specList => {
  let newSelectors = {};
  let pollutedDocs = {};
  let warnings = {};
  specList.forEach(spec => {
    if (spec.newSelectors) {
      spec.newSelectors.forEach(selector => {
        newSelectors[selector] = true;
      });
    }
    Object.values(spec.pollutedDocs).forEach(doc => {
      pollutedDocs[doc._id] = doc;
    });
    Object.entries(spec.warnings).forEach(([warning, count]) => {
      warnings[warning] = warnings[warning] || 0;
      warnings[warning] += count;
    });
  });
  newSelectors = Object.keys(newSelectors);
  return new OutputSpec({
    newSelectors: newSelectors.length > 0 ? newSelectors : null,
    pollutedDocs,
    warnings
  });
};

export default OutputSpec;
