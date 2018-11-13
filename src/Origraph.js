import NetworkModel from './Common/NetworkModel.js';

let NEXT_MODEL_ID = 1;

class Origraph {
  constructor (FileReader, localStorage) {
    this.FileReader = FileReader; // either window.FileReader or one from Node
    this.localStorage = localStorage; // either window.localStorage or null

    this.plugins = {};

    this.models = {};
    let existingModels = this.localStorage && this.localStorage.getItem('origraph_models');
    if (existingModels) {
      for (const [modelId, model] of Object.entries(JSON.parse(existingModels))) {
        model.origraph = this;
        this.models[modelId] = new NetworkModel(model);
      }
    }

    this._currentModelId = null;
  }
  registerPlugin (name, plugin) {
    this.plugins[name] = plugin;
  }
  save () {
    if (this.localStorage) {
      const models = {};
      for (const [modelId, model] of Object.entries(this.models)) {
        models[modelId] = model._toRawObject();
      }
      this.localStorage.setItem('origraph_models', JSON.stringify(models));
    }
  }
  closeCurrentModel () {
    this._currentModelId = null;
  }
  get currentModel () {
    return this.models[this._currentModelId] || this.createModel();
  }
  set currentModel (model) {
    this._currentModelId = model.modelId;
  }
  createModel (options = {}) {
    while (!options.modelId || this.models[options.modelId]) {
      options.modelId = `model${NEXT_MODEL_ID}`;
      NEXT_MODEL_ID += 1;
    }
    options.origraph = this;
    this.models[options.modelId] = new NetworkModel(options);
    this._currentModelId = options.modelId;
    this.save();
    return this.models[options.modelId];
  }
  deleteModel (modelId = this.currentModelId) {
    if (!this.models[modelId]) {
      throw new Error(`Can't delete non-existent model: ${modelId}`);
    }
    delete this.models[modelId];
    if (this._currentModelId === modelId) {
      this._currentModelId = null;
    }
    this.save();
  }
}

export default Origraph;
