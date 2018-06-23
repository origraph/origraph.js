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

const testEquality = (a, b) => {
  if (a.equals && b.equals) {
    return a.equals(b);
  } else {
    return a === b;
  }
};

const singleMode = list => {
  return list.sort((a, b) => {
    return list.filter(v => testEquality(v, a)).length -
      list.filter(v => testEquality(v, b)).length;
  }).pop();
};

class InputSpec {
  constructor () {
    this.valueOptions = {};
    this.toggleOptions = {};
    this.itemRequirements = {};
  }
  addValueOption ({ name, defaultValue }) {
    this.valueOptions[name] = defaultValue;
  }
  addToggleOption ({ name, optionList, defaultValue }) {
    this.toggleOptions[name] = { optionList, defaultValue };
  }
  addItemRequirement ({ name, ItemType, defaultValue }) {
    this.itemRequirements[name] = { ItemType, defaultValue };
  }
}
InputSpec.glomp = specList => {
  if (specList.indexOf(null) !== -1) {
    return null;
  }
  let result = new InputSpec();

  let valueOptions = {};
  let toggleOptions = {};
  let itemRequirements = {};

  specList.forEach(spec => {
    // For valueOptions, find the most common defaultValues
    Object.entries(spec.valueOptions).forEach(([name, defaultValue]) => {
      if (!valueOptions[name]) {
        valueOptions[name] = [defaultValue];
      } else {
        valueOptions[name].push(defaultValue);
      }
    });
    // For toggleOptions, glomp all optionLists, and find the most common defaultValue
    Object.entries(spec.toggleOptions).forEach(([name, { optionList, defaultValue }]) => {
      if (!toggleOptions[name]) {
        toggleOptions[name] = { name, optionList, defaultValues: [defaultValue] };
      } else {
        toggleOptions[name].optionList = glompLists([optionList, toggleOptions[name].optionList]);
        toggleOptions[name].defaultValues.push(defaultValue);
      }
    });
    // For itemRequirements, ensure ItemTypes are consistent, and find the most common default values
    Object.entries(spec.itemRequirements).forEach(([name, { ItemType, defaultValue }]) => {
      if (!itemRequirements[name]) {
        itemRequirements[name] = { name, ItemType, defaultValues: [defaultValue] };
      } else {
        if (ItemType !== itemRequirements[name].ItemType) {
          throw new Error(`Inconsistent ItemType requirements`);
        }
        itemRequirements[name].defaultValues.push(defaultValue);
      }
    });
  });
  Object.entries(valueOptions).forEach(([name, defaultValues]) => {
    result.addValueOption({
      name,
      defaultValue: singleMode(defaultValues)
    });
  });
  Object.entries(toggleOptions).forEach(([name, { optionList, defaultValues }]) => {
    result.addToggleOption({
      name,
      optionList,
      defaultValue: singleMode(defaultValues)
    });
  });
  Object.entries(itemRequirements).forEach(([name, { ItemType, defaultValues }]) => {
    result.addOption({
      name,
      ItemType,
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
