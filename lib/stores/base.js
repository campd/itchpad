const { Cc, Ci, Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const URL = require("sdk/url");
const promise = require("helpers/promise");

/**
 * A Store object maintains a collection of Resource objects stored in a tree.
 * A given store is either a Project store or a Live store.
 */
var Store = Class({
  extends: EventTarget,

  // Should be called during initialize() of a subclass.
  initStore: function() {
    this.resources = new Map();
  },

  // Set the root resource.
  setRoot: function(resource) {
    this.root = resource;
    this.notifyAdd(resource);
  },

  refresh: function() {
    return promise.resolve();
  },

  allResources: function*() {
    for (let [key, resource] of this.resources) {
      yield resource;
    }
  },

  notifyAdd: function(resource) {
    emit(this, "resource-added", resource);
  },

  notifyRemove: function(resource) {
    emit(this, "resource-removed", resource);
  },

  notifyMissing: function(oldChildren, newChildren) {
    for (let item of oldChildren) {
      if (!newChildren.has(item)) {
        this.notifyRemove(item);
      }
    }
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

var Resource = Class({
  extends: EventTarget,

  get isProject() { return this.store.isProject },
  get aspect() { return this.store.aspect },

  refresh: function() { return promise.resolve(this) },

  setURI: function(uri) {
    if (typeof(uri) === "string") {
      uri = URL.URL(uri);
    }
    this._uriBasename = uriBasename(uri);
    this.uri = uri;
  },

  get basename() { return this._uriBasename },
  get displayName() { return this.basename },

  get isDir() { return this.children !== undefined; },
  get hasChildren() { return this.children && this.children.size > 0; },

  setChildren: function(newChildren) {
    let oldChildren = this.children || new Set();
    let change = false;

    for (let child of oldChildren) {
      if (!newChildren.has(child)) {
        change = true;
        child.parent = null;
        this.store.notifyRemove(child);
      }
    }

    for (let child of newChildren) {
      if (!oldChildren.has(child)) {
        change = true;
        child.parent = this;
        this.store.notifyAdd(child);
      }
    }

    this.children = newChildren;
    if (change) {
      emit(this, "children-changed", this);
    }
  },

  addChild: function(resource) {
    this.children = this.children || new Set();

    resource.parent = this;
    this.children.add(resource);
    this.store.notifyAdd(resource);
    emit(this, "children-changed", this);
    return resource;
  },

  removeChild: function(resource) {
    resource.parent = null;
    this.children.remove(resource);
    this.store.notifyRemove(resource);
    emit(this, "children-changed", this);
    return resource;
  },

  get contentType() { return "text/plain" },
  get contentCategory() {
    const NetworkHelper = require("devtools/toolkit/webconsole/network-helper");
    let category = NetworkHelper.mimeCategoryMap[this.contentType];
    // Boo hard-coding.
    if (!category && this.basename === "manifest.webapp") {
      return "json";
    }
    return category || "txt";
  }
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

