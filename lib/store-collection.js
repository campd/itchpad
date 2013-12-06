const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { on, forget } = require("event/scope");

var StoreCollection = Class({
  extends: EventTarget,

  initialize: function() {
    this.stores = new Set();
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
    for (let resource of store.allResources()) {
      this.onResourceAdded(resource);
    }
    on(this, store, "resource-added", (resource) => {
      emit(this, "resource-added", resource);
    });
    on(this, store, "resource-removed", (resource) => {
      emit(this, "resource-removed", resource);
    })

    emit(this, "store-added", store);
  },

  removeStore: function(store) {
    this.stores.delete(store);
    for (let resource of store.allResources()) {
      this.onResourceRemoved(resource);
    }
    forget(this, store);
    emit(this, "store-removed", store);
  }
});

exports.StoreCollection = StoreCollection;
