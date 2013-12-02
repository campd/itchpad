const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const prefs = require("sdk/preferences/service");
const { LocalStore, ScratchStore, OpenStore } = require("stores/local");
const OS = require("helpers/osfile");
const task = require("helpers/task");
const { ProjectIndex } = require("project-index");
const promise = require("promise");
const { TextEncoder, TextDecoder } = require('sdk/io/buffer');

const gDecoder = new TextDecoder();
const gEncoder = new TextEncoder();

var Projects = Class({
  initialize: function() {
    // A map of promises that will resolve to Project objects for a given
    // .fx-project path.
    this.projectsByPath = new Map();
  },

  init: function() {
    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = this.readProjectDir.then(() => undefined);
    return this._initPromise;
  },

  projectStorageDir: function() {
    let dir = OS.Path.join(OS.Constants.Path.profileDir, "ScratchProjects");
    return OS.File.makeDir(dir, { ignoreExisting: true }).then(() => {
      return dir;
    });
  },

  // Read all projects in our default project storage directory to get a
  // set of existing projects.
  readProjectDir: function() {
    let projects = [];
    let iterator;

    // Project directory -> list of active projects.
    this.projectsForDirs = new Map();

    task.spawn(function() {
      let dir = yield this.projectStorageDir();
      iterator = new OS.File.DirectoryIterator(dir);
      let projs = this.projectsForDirs;
      while (true) {
        let entry = yield iterator.next();
        try {
          let bytes = yield OS.File.read(entry.path);
          let project = JSON.stringify(gDecoder.decode(bytes));
          for (let dir of project.directories) {
            if (!projs.has(dir)) {
              projs.set(dir, []);
            }
            projs.get(dir).push({ path: path, project: project });
          }
        } catch(ex) {
          console.error(ex);
        }
      }
    }).then(null, (ex) => {
      iterator.close();
      if (ex !== StopIteration) {
        throw ex;
      }
    });
  },

  // Return the default project.
  defaultProject: function() {
    return this.projectStorageDir().then(path => {
      return this.getProject(OS.Path.join(path, "untitled.fx-project"));
    });
  },

  // Path points to a .fx-project file, whether it exists or not.
  getProject: function(path) {
    path = OS.Path.normalize(path);
    console.log("Getting project for " + path);
    if (this.projectsByPath.has(path)) {
      return this.projectsByPath.get(path);
    }

    let promise = this.readProject(path);
    this.projectsByPath.set(path, promise);
    return promise;
  },

  readProject: function(path) {
    let project = new Project(path);
    return project.load().then(() => project);
  },

  forDir: function(path) {
    return this.init().then(() => {
      if (this.projectsForDirs.has(path)) {
        let projects = this.projectsForDirs.get(path);
        // Just choose the first one for now.
        return this.getProject(projects[0].path);
      }
    });
  },

  // Path points to either a .fx-project file, an app manifest,
  // or a directory that will be the first item added to the project.
  // If path doesn't exist, this will fail.
  forPath: function(path) {
    path = OS.Path.normalize(path);
    return OS.File.stat(path).then(info => {
      if (this.info.isDir) {
        return this.forDir(path);
      }
      throw new Error("Couldn't find a way to read that path.");
    });
  }
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
  extends: EventTarget,

  initialize: function(path) {
    this.path = path;
    this.stores = new Map();
    this.index = new ProjectIndex();

    this.onResourceAdded = this.onResourceAdded.bind(this);
    this.onResourceRemoved = this.onResourceRemoved.bind(this);

    this.addScratchStore();
    this.addOpenStore();
  },

  load: function() {
    return OS.File.read(this.path).then(bytes => {
      return JSON.parse(gDecoder.decode(bytes));
    }, () => {
      return emptyProject();
    }).then(data => {
      let paths = new Set(data.directories.map(name => OS.Path.normalize(name)));

      for (let [path, store] of this.stores) {
        if (!paths.has(path)) {
          this.removePath(path);
        }
      }

      for (let path of paths) {
        this.addPath(path);
      }
    });
  },

  save: function() {
    let data = emptyProject();

    data.directories = [store.path for ([id, store] of this.stores)];
    data.openFiles = [resource.path for (resource of this.openStore.rootResource.children)];

    let buffer = gEncoder.encode(JSON.stringify(data));
    return OS.File.writeAtomic(this.path, buffer);
  },

  refresh: function() {
    return task.spawn(function*() {
      yield this.scratchStore.refresh();
      for (let [path, store] of this.stores) {
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
      this.addLocalStore(new LocalStore(path));
    }
  },

  removePath: function(path) {
    this.removeStore(this.stores.get(path));
    this.stores.delete(path);
  },

  addLocalStore: function(store) {
    this.stores.set(store.path, store);
    store.canPair = true;
    this.watchStore(store);
    emit(this, "store-added", store);
  },

  removeStore: function(store) {
    this.stores.delete(store.path);
    this.unwatchStore(store);
    emit(this, "store-removed", store);
  },

  addScratchStore: function() {
    this.scratchStore = new ScratchStore();
    this.scratchStore.canPair = false;
    this.watchStore(this.scratchStore);
    emit(this, "store-added", this.scratchStore);
  },

  isScratchStore: function(store) {
    return store === this.scratchStore;
  },

  addOpenStore: function() {
    this.openStore = new OpenStore();
    this.openStore.canPair = false;
    this.watchStore(this.openStore);
    emit(this, "store-added", this.openStore);
  },

  isOpenStore: function(store) {
    return store === this.openStore;
  },

  watchStore: function(store) {
    for (let resource of store.allResources()) {
      this.onResourceAdded(resource);
    }
    store.on("resource-added", this.onResourceAdded);
    store.on("resource-removed", this.onResourceRemoved);
  },

  unwatchStore: function(store) {
    for (let resource of store.allResources()) {
      this.onResourceRemoved(resource);
    }
    store.off("resource-added", this.onResourceAdded);
    store.off("resource-removed", this.onResourceRemoved);
  },

  onResourceAdded: function(resource) {
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

