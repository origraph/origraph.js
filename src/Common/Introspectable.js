class Introspectable {
  get type () {
    return this.constructor.type;
  }
  get lowerCamelCaseType () {
    return this.constructor.lowerCamelCaseType;
  }
  get humanReadableType () {
    return this.constructor.humanReadableType;
  }
}
Object.defineProperty(Introspectable, 'type', {
  // This can / should be overridden by subclasses
  configurable: true,
  get () { return this.type; }
});
Object.defineProperty(Introspectable, 'lowerCamelCaseType', {
  get () {
    const temp = this.type;
    return temp.replace(/./, temp[0].toLocaleLowerCase());
  }
});
Object.defineProperty(Introspectable, 'humanReadableType', {
  get () {
    // CamelCase to Sentence Case
    return this.type.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
});
export default Introspectable;
