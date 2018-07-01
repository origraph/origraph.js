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
    return agg;
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

export { glompObjs, glompLists, testEquality, singleMode };
