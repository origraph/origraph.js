const glompObjs = objList => {
  return objList.reduce((agg, obj) => Object.assign(agg, obj), {});
};

const glompLists = listList => {
  return listList.reduce((agg, list) => {
    list.forEach(value => {
      if (agg.indexOf(value) === -1) {
        agg.push(value);
      }
    });
  }, []);
};

const singleMode = list => {
  return list.sort((a, b) => {
    return list.filter(v => v === a).length - list.filter(v => v === b).length;
  }).pop();
};

class InputSpec {
  constructor () {
    this.options = {};
  }
  addOption ({ name, optionList, defaultValue }) {
    this.options[name] = { optionList, defaultValue };
  }
}
InputSpec.glomp = specList => {
  let result = new InputSpec();

  let options = {};
  specList.forEach(spec => {
    Object.entries(spec.options).forEach(([name, { optionList, defaultValue }]) => {
      if (!options[name]) {
        options[name] = { name, optionList, defaultValues: [defaultValue] };
      } else {
        options[name].optionList = glompLists([optionList, options[name].optionList]);
        options[name].defaultValues.push(defaultValue);
      }
    });
  });
  Object.entries(options).forEach(([name, { optionList, defaultValues }]) => {
    result.addOption({
      name,
      optionList,
      defaultValue: singleMode(defaultValues)
    });
  });

  return result;
};

class OutputSpec {
  constructor ({ newSelectors = null, pollutedDocs = [] }) {
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
      return glompLists(agg, spec.newSelectors);
    }
  }, null);
  const pollutedDocs = specList.reduce((agg, spec) => {
    return glompLists(agg, spec.pollutedDocs);
  }, []);
  return new OutputSpec({
    newSelectors,
    pollutedDocs
  });
};

export { glompObjs, glompLists, singleMode, InputSpec, OutputSpec };
