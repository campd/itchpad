const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");

var StoreCollection = Class({
  extends: EventTarget,

  initialize: function() {
    this.stores = new Set();
    this._onResourceAdded = this._onResourceAdded.bind(this);
    this._onResourceRemoved = this._onResourceRemoved.bind(this);
  },

  allStores: function*() {
    for (let store of this.stores) {
      yield store;
    }
  },

  allResources: function*() {
    for (let store of this.stores) {
      for (let [key, resource] of store.resources) {
        yield resource;
      }
    }
  },

  addStore: function(store) {
    this.stores.add(store);
    this.watchStore(store);
    emit(this, "store-added", store);
  },

  removeStore: function(store) {
    this.stores.delete(store);
    this.unwatchStore(store);
    emit(this, "store-removed", store);
  },

  watchStore: function(store) {
    for (let resource of store.allResources()) {
      this.onResourceAdded(resource);
    }
    store.on("resource-added", this._onResourceAdded);
    store.on("resource-removed", this._onResourceRemoved);
  },

  unwatchStore: function(store) {
    for (let resource of store.allResources()) {
      this.onResourceRemoved(resource);
    }
    store.off("resource-added", this._onResourceAdded);
    store.off("resource-removed", this._onResourceRemoved);
  },

  _onResourceAdded: function(resource) {
    emit(this, "resource-added", resource);
  },

  _onResourceRemoved: function(resource) {
    emit(this, "resource-removed", resource);
  }
});

exports.StoreCollection = StoreCollection;
