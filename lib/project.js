const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const prefs = require("sdk/preferences/service");
const { LocalStore } = require("stores/local");

const { Cu } = require("chrome");
const { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});

// A project holds a list of local folders and maintains LocalStore objects
// representing them.
var Project = Class({
  extends: EventTarget,

  initialize: function() {
    this.stores = new Map();
  },

  savePref: function() {
    prefs.set("itchpad.project-dirs", [store.path for (store of this.stores)].join(':'));
  },

  loadPref: function() {
    let dirs = prefs.get("itchpad.project-dirs", "");
    let paths = new Set(dirs.split(':')
                        .filter(name => !!name)
                        .map(name => OS.Path.normalize(name)));

    for (let [path, store] of this.stores) {
      if (!paths.has(path)) {
        this.removePath(path);
      }
    }

    for (let path of paths) {
      this.addPath(path);
    }
  },

  allStores: function*() {
    for (let [path, store] of this.stores) {
      yield store;
    }
  },

  storeContaining: function(path) {
    let ret = null;
    for (let [id, store] of this.stores) {
      if (store.contains(path)) {
        if (ret) {
          // XXX
          console.warning("Nested projects are going to cause pain.");
        }
        ret = store;
      }
    }
    return ret;
  },

  addPath: function(path) {
    if (!this.stores.has(path)) {
      this.addStore(new LocalStore(path));
    }
  },

  removePath: function(path) {
    this.removeStore(this.stores.get(path));
    this.stores.delete(path);
  },

  addStore: function(store) {
    this.stores.set(store.path, store);
    emit(this, "store-added", store);
  },

  removeStore: function(store) {
    this.stores.delete(store.path);
    emit(this, "store-removed", store);
  }
});
exports.Project = Project;

