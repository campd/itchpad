const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const prefs = require("sdk/preferences/service");
const { LocalStore, ScratchStore, OpenStore } = require("stores/local");
const OS = require("helpers/osfile");
const task = require("helpers/task");
const { ProjectIndex } = require("project-index");
const promise = require("helpers/promise");
const { TextEncoder, TextDecoder } = require('sdk/io/buffer');
const { indexedDB } = require('sdk/indexed-db');
const url = require('sdk/url');
const { StoreCollection } = require("store-collection");

const gDecoder = new TextDecoder();
const gEncoder = new TextEncoder();

// I'm fairly certain this could be merged with the app-manager project
// store with a bit of work on the app-manager side.
var IDBProjectStore = {
  _db: null,

  _request: function(request) {
    let deferred = promise.defer();
    request.onerror = function(event) {
      deferred.reject(event.target.errorCode);
    };
    request.onsuccess = function(event) {
      deferred.resolve(event.target.result);
    }
    return deferred.promise;
  },

  _open: function() {
    if (this._openPromise) {
      return this._openPromise;
    }

    let deferred = promise.defer();
    this._openPromise = deferred.promise;

    let request = indexedDB.open("DevtoolsEditorProjects", 1);
    request.onerror = (event) => {
      deferred.reject("Unable to open DevtoolsEdtiorProjects indexedDB. " +
                       "Error code: " + event.target.errorCode);
    };
    request.onupgradeneeded = (event) => {
      let db = event.target.result;
      db.createObjectStore("projects", { keyPath: "id" });
    };
    request.onsuccess = () => {
      deferred.resolve(request.result);
    };

    return this._openPromise;
  },

  all: function() {
    if (this._cachedProjects) {
      return this._cachedProjects;
    }

    this._cachedProjects = this._open().then(db => {
      let objectStore = db.transaction("projects").objectStore("projects");

      let projects = [];
      let deferred = promise.defer();
      objectStore.openCursor().onsuccess = (event) => {
        let cursor = event.target.result;
        if (cursor) {
          projects.push(cursor.value);
          cursor.continue();
        } else {
          deferred.resolve(projects);
        }
      };
      return deferred.promise;
    });

    return this._cachedProjects;
  },

  get: function(id) {
    return this.all().then(projects => {
      for (let project of projects) {
        if (project.id === id) {
          return project;
        }
      }
      return null;
    });
  },

  add: function(project) {
    return this._open().then(db => {
      if (!project.id) {
        return promise.reject("Project must have an id field");
      }

      return this._request(db.transaction(["projects"], "readwrite")
        .objectStore("projects")
        .add(project)).then(() => {
          this._cachedProjects = null;
          return project;
        });
    });
  },

  update: function(project) {
    return this._open().then(db => {
      return this._request(db.transaction(["projects"], "readwrite")
        .objectStore("projects")
        .put(project)).then(() => {
          this._cachedProjects = null;
          return project;
        });
    });
  },

  remove: function(id) {
    return this._open().then(db => {
      return this._request(this._db.transaction(["projects"], "readwrite")
        .objectStore("projects")
        .delete(id)).then(() => { this._cachedProjects = null; });
    });
  }
};

var Projects = Class({
  initialize: function() {
    this.store = IDBProjectStore;
    this._projectsById = new Map();
  },

  projectForID: function(id, create=false) {
    if (this._projectsById.has(id)) {
      return promise.resolve(this._projectsById.get(id));
    }

    return this.store.get(id).then(obj => {
      if (!obj && !create) {
        throw new Error("Project doesn't exist with id: " + id);
      }

      if (obj) {
        return obj;
      }

      obj = emptyProject();
      obj.id = id;
      return this.store.add(obj);
    }).then(obj => {
      let proj = new Project(obj);
      this._projectsById.set(id, proj);
      return proj;
    });
  },

  // Return the default project.
  defaultProject: function() {
    return this.projectForID("default", true);
  },

  forManifest: function(path) {
    let id = "app:" + OS.Path.normalize(path);
    let dir = OS.Path.dirname(path);

    return this.projectForID(id, true).then(project => {
      project.setManifest(path);
      project.addPath(dir);
      return project;
    });
  },
});
exports.Projects = new Projects();

function emptyProject() {
  return {
    directories: [],
    openFiles: []
  };
}

// A project holds a list of local folders and maintains LocalStore objects
// representing them.
var Project = Class({
  extends: StoreCollection,

  initialize: function(info) {
    StoreCollection.prototype.initialize.call(this);

    this.index = new ProjectIndex();
    this.localStores = new Map();

    this.on("resource-added", this.onResourceAdded.bind(this));
    this.on("resource-removed", this.onResourceRemoved.bind(this));

    this.addScratchStore();
    this.addOpenStore();

    this.load(info);
  },

  toString: function() { return "[Project]"; },

  load: function(data) {
    this.id = data.id;
    this.name = data.name || "Untitled";
    if (data.pattern) {
      this.pattern = data.pattern;
      this.manualPattern = true;
    } else {
      this.pattern = "*";
    }

    let paths = new Set(data.directories.map(name => OS.Path.normalize(name)));

    for (let [path, store] of this.localStores) {
      if (!paths.has(path)) {
        this.removePath(path);
      }
    }

    for (let path of paths) {
      this.addPath(path);
    }

    this.setManifest(data.manifestPath);
  },

  save: function() {
    let data = emptyProject();

    data.id = this.id;
    data.name = this.name;
    if (this.manualPattern) {
      data.pattern = this.pattern;
    }
    data.manifest = this.manifestPath;
    data.directories = [store.path for ([id, store] of this.localStores)];
    data.openFiles = [resource.path for (resource of this.openStore.root.children)];

    return IDBProjectStore.update(data);
  },

  setManifest: function(path, json=null) {
    this.manifestPath = path;

    let promise = json ? promise.resolve(json) : (OS.File.read(path).then(bytes => {
      return JSON.parse(gDecoder.decode(bytes));
    }));

    return promise.then(json => {
      this.manifest = json;
      this.name = this.manifest.name || this.name;
      if (!this.manualPattern) {
        let dir = url.fromFilename(OS.Path.dirname(this.manifestPath));
        this.pattern = dir + "*";
      }
    });
  },

  setName: function(name) {
    this.name = name;
    return this.save().then(() => {
      emit(this, "name-change");
    });
  },

  setPattern: function(pattern) {
    this.manualPattern = true;
    this.pattern = pattern;
    return this.save().then(() => {
      emit(this, "pattern-change");
    });
  },

  refresh: function() {
    return task.spawn(function*() {
      yield this.scratchStore.refresh();
      for (let [path, store] of this.localStores) {
        yield store.refresh();
      }
    }.bind(this));
  },

  resourceFor: function(path, options) {
    let store = this.storeContaining(path);
    if (!store) {
      store = this.openStore;
    }
    return store.resourceFor(path, options);
  },

  allStores: function*() {
    yield this.scratchStore;
    yield this.openStore;
    for (let [path, store] of this.localStores) {
      yield store;
    }
  },

  storeContaining: function(path) {
    let ret = null;
    for (let [id, store] of this.localStores) {
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
    if (!this.localStores.has(path)) {
      this.addLocalStore(new LocalStore(path));
    }
  },

  removePath: function(path) {
    this.removeLocalStore(this.localStores.get(path));
    this.localStores.delete(path);
  },

  addLocalStore: function(store) {
    store.canPair = true;
    this.localStores.set(store.path, store);
    this.addStore(store);
  },

  removeLocalStore: function(store) {
    this.localStores.delete(store.path);
    this.removeStore(store);
  },

  addScratchStore: function() {
    this.scratchStore = new ScratchStore();
    this.scratchStore.canPair = false;
    this.addStore(this.scratchStore);
  },

  isScratchStore: function(store) {
    return store === this.scratchStore;
  },

  addOpenStore: function() {
    this.openStore = new OpenStore();
    this.openStore.canPair = false;
    this.addStore(this.openStore);
  },

  isOpenStore: function(store) {
    return store === this.openStore;
  },

  onResourceAdded: function(resource) {
    // Automatically use a manifest for this project if we find
    // one in the only store that exists in the project.
    if (!this.manifest
        && resource.basename === "manifest.webapp"
        && resource.parent === resource.store.root
        && this.localStores.size === 1) {
      this.setManifest(resource.path);
    }

    try {
      this.index.add(resource);
    } catch(ex) {
      console.error(ex);
    }
  },

  onResourceRemoved: function(resource) {
    this.index.remove(resource);
  }
});
exports.Project = Project;

