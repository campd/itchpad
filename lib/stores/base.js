const { Cc, Ci, Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const URL = require("sdk/url");
const promise = require("helpers/promise");

const NetworkHelper = require("devtools/toolkit/webconsole/network-helper");

var Store = Class({
  extends: EventTarget,

  // Should be called during initialize() of a subclass.
  initStore: function() {
    this.resources = new Map();
    this._basenameIndex = new Map();
  },

  refresh: function() {
    return promise.resolve();
  },

  indexResource: function(resource) {
    let name = resource.basename;
    let set;
    if (this._basenameIndex.has(name)) {
      set = this._basenameIndex.get(name);
    } else {
      set = new Set();
      this._basenameIndex.set(name, set);
    }
    if (!set.has(resource)) {
      emit(this, "resource-added", resource);
      set.add(resource);
    }
  },

  unindexResource: function(resource) {
    let name = resource.basename;
    let set = this._basenameIndex.get(name);
    if (set && set.has(resource)) {
      emit(this, "resource-removed", resource);
      set.delete(resource);
      this.resources.delete(resource);
    }
  },

  unindexMissing: function(oldChildren, newChildren) {
    for (let item of oldChildren) {
      if (!newChildren.has(item)) {
        this.unindexResource(item);
      }
    }
  },

  findBasename: function(basename) {
    return this._basenameIndex.get(basename) || new Set();
  },

  root: function() {
    throw new Error("root() is not implemented by this project store.");
  }
});

ProjectStore = Class({
  extends: Store,
  isProject: true,
  isLive: false,
  aspect: "project"
});
exports.ProjectStore = ProjectStore;

LiveStore = Class({
  extends: Store,
  isProject: false,
  isLive: true,
  aspect: "live"
});
exports.LiveStore = LiveStore;

// rename: Resource
var Resource = Class({
  extends: EventTarget,

  get isProject() { return this.store.isProject },
  get aspect() { return this.store.aspect },

  set uri(uri) {
    this._uriBasename = uriBasename(uri);
    this._uri = uri;
  },
  get uri() { return this._uri },

  get basename() { return this._uriBasename },

  get displayName() { return this.basename },

  get isDir() { return false; },
  get hasChildren() { return false; },

  get contentType() { return "text/plain" },
  get contentCategory() { return NetworkHelper.mimeCategoryMap[this.contentType] || "txt" },
});

exports.Resource = Resource;

// Surely there's a better way to do this.
function uriBasename(uri) {
  var basename = uri.path;

  let idx = uri.path.lastIndexOf("/", basename.length - 2);
  if (idx > -1) {
    basename = uri.path.substring(idx + 1);
  }

  if (basename[basename.length - 1] === "/") {
    basename = basename.substring(0, basename.length - 1);
  }

  return basename;
}

