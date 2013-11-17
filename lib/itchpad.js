const { Class } = require("sdk/core/heritage");

const { LocalStore, ScratchStore } = require("stores/local");
const { StylesStore } = require("stores/styles");
const { TreeView } = require("views/tree");
const { PairChooser } = require("views/pair");
const { ShellDeck } = require("shells");
const { Resource } = require("stores/base");
const { ResourceMap } = require("resource-map");
const { registeredPlugins } = require("plugins/core");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { merge } = require("sdk/util/object");
const promise = require("promise");
const prefs = require("sdk/preferences/service");
const { PrefsTarget } = require("sdk/preferences/event-target");

const { devtoolsRequire } = require("devtools");
const { ToolSidebar } = devtoolsRequire("devtools/framework/sidebar");

const { Cu } = require("chrome");
const { OS } = Cu.import("resource://gre/modules/osfile.jsm", {});
const { ViewHelpers } = Cu.import("resource:///modules/devtools/ViewHelpers.jsm", {});

var Itchpad = Class({
  extends: EventTarget,

  initialize: function(window, toolbox) {
    let document = window.document;

    this.window = window;
    this.document = window.document;
    this.toolbox = toolbox;
    this.stores = new Set();
    this.projectStores = new Map();

    this.prefsTarget = new PrefsTarget({
      branchName: "itchpad."
    });

    this.resourceMap = new ResourceMap();

    this.shells = new ShellDeck(document);
    this.onEditorCreated = this.onEditorCreated.bind(this);
    this.shells.on("editor-created", this.onEditorCreated);

    this.onEditorActivated = this.onEditorActivated.bind(this);
    this.shells.on("editor-activated", this.onEditorActivated);

    this.commands = document.getElementById("itchpad-commandset");
    this.commands.addEventListener("command", (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      this._pluginDispatch("onCommand", evt.target.id, evt.target);
    });

    this.shells.elt.setAttribute("flex", "4");
    document.getElementById("shells").appendChild(this.shells.elt);

    this.pairChooser = new PairChooser(this.document);

    this.onNodeSelection = this.onNodeSelection.bind(this);

    this.projectTree = new TreeView(this.document, {
      nodeFormatter: this.formatNode.bind(this)
    });
    this.projectTree.on("selection", this.onNodeSelection);
    document.querySelector("#sources-tabs > tabpanels").appendChild(this.projectTree.elt);

    this.liveTree = new TreeView(this.document, {
      nodeFormatter: this.formatNode.bind(this)
    });
    this.liveTree.on("selection", this.onNodeSelection);

    document.querySelector("#sources-tabs > tabpanels").appendChild(this.liveTree.elt);

    document.getElementById("sources-tabs").selectedPanel = this.projectTree.elt;

    let tabbox = document.getElementById("sidebar");
    this.sidebar = new ToolSidebar(tabbox, this, "itchpad");
    ViewHelpers.togglePane({
      visible: false,
      delayed: false,
      animated: false
    }, document.getElementById("sidebar-box"));

    this.scratch = new ScratchStore();
    this.addScratchStore(this.scratch);

    this.updateProjectStores();
    this.watchProjectStores();

    this.styles = new StylesStore(toolbox ? toolbox.target : null);
    this.addLiveStore(this.styles);

    this.pluginMethods = {};

    this.loadPlugins();
  },

  destroy: function() {
    this.prefsTarget.off();
  },

  watchProjectStores: function() {
    this.prefsTarget.on("project-dirs", (name) => {
      this.updateProjectStores();
    });
  },

  updateProjectStores: function() {
    let dirs = prefs.get("itchpad.project-dirs");
    let paths = new Set(dirs.split(':')
                        .filter(name => !!name)
                        .map(name => OS.Path.normalize(name)));

    for (let [path, store] of this.projectStores) {
      if (!paths.has(path)) {
        this.removeProjectStore(store);
      }
    }

    for (let path of paths) {
      if (!this.projectStores.has(path)) {
        this.addProjectStore(new LocalStore(path));
      }
    }
  },

  get activeTree() {
    return this.document.getElementById("sources-tabs").selectedPanel.tree;
  },

  onNodeSelection: function(resource) {
    if (resource.isDir) {
      return;
    }
    let pair = this.resourceMap.pair(resource);
    let shell = this.shells.open(pair, resource);
    this.pairChooser.setShell(shell);
  },

  addCommand: function(definition) {
    let command = this.document.createElement("command");
    command.setAttribute("id", definition.id);
    if (definition.key) {
      let key = doc.createElement("key");
      key.id = "key_" + definition.id;

      let keyName = definition.key;
      if (keyName.startsWith("VK_")) {
        key.setAttribute("keycode", keyName);
      } else {
        key.setAttribute("key", keyName);
      }
      key.setAttribute("modifiers", definition.modifiers);
      key.setAttribute("oncommand", "void(0);"); // needed. See bug 371900
      this.document.getElementById("itchpad-keyset").appendChild(key);
    }
    this.document.getElementById("itchpad-commandset").appendChild(command);
    return command;
  },

  createElement: function(type, options) {
    let elt = this.document.createElement(type);

    let parent;

    for (let opt in options) {
      if (opt === "command") {
        let command = typeof(options.command) === "string" ? options.command : options.command.id;
        elt.setAttribute("command", command);
      } else if (opt === "parent") {
        continue;
      } else {
        elt.setAttribute(opt, options[opt]);
      }
    }

    if (options.parent) {
      let parent = options.parent;
      if (typeof(parent) === "string") {
        parent = this.document.getElementById(parent);
      }
      parent.appendChild(elt);
    }

    return elt;
  },

  createToolbarGroup: function(options) {
    return this.createElement("hbox", merge({
      class: "toolbar-group"
    }, options));
  },

  createToolbarButton: function(options) {
    return this.createElement("toolbarbutton", merge({
      class: "devtools-toolbarbutton"
    }, options));
  },

  addSidebar: function(name, url) {
    let deferred = promise.defer();

    this.sidebar.once(name + "-ready", () => {
      deferred.resolve(this.sidebar.getWindowForTab(name));
    });
    this.sidebar.addTab(name, url, false);

    return deferred.promise;
  },

  showSidebar: function(name) {
    this.sidebar.select(name);
    let sidebar = this.document.getElementById("sidebar-box");
    ViewHelpers.togglePane({ visible: true, animated: true, delayed: true }, sidebar);
  },

  hideSidebar: function() {
    let sidebar = this.document.getElementById("sidebar-box");
    ViewHelpers.togglePane({ visible: false, animated: true, delayed: true }, sidebar);
  },

  loadPlugins: function() {
    this.plugins = [];

    for (let plugin of registeredPlugins) {
      try {
        this.plugins.push(plugin(this));
      } catch(ex) {
        console.exception(ex);
      }
    }
  },

  onEditorCreated: function(editor) {
    this.plugins.forEach(plugin => plugin.onEditorCreated(editor));
    this._editorListen(editor, "change", "onEditorChange");
    this._containerListen(editor, "load", "onEditorLoad");
    this._containerListen(editor, "save", "onEditorSave");
  },

  onEditorActivated: function(editor) {
    this.plugins.forEach(plugin => plugin.onEditorActivated(editor));
  },

  _pluginDispatch: function(handler, ...args) {
    this.plugins.forEach(plugin => {
      try {
        if (handler in plugin) plugin[handler](...args);
      } catch(ex) {
        console.error(ex);
      }
    })
  },

  _containerListen: function(editor, event, handler) {
    editor.on(event, (...args) => {
      this._pluginDispatch(handler, editor, ...args);
    });
  },

  _editorListen: function(editor, event, handler) {
    if (!editor.editor) {
      return;
    }
    editor.editor.on(event, (...args) => {
      this._pluginDispatch(handler, editor, ...args);
    });
  },

  setTarget: function(target) {
    if (target === this.target) {
      return promise.resolve();
    }
    this._webConsolePromise = null;
    this.target = target;
    return target.makeRemote().then(() => {
      // XXX: replace styles store?
      for (let store of this.stores) {
        if ("setTarget" in store) {
          store.setTarget(target);
        }
      }
      emit(this, "target-changed");
    }).then(null, console.error);
  },

  getWebConsoleClient: function() {
    if (this._webConsolePromise) {
      return this._webConsolePromise;
    }
    let deferred = promise.defer();
    this.target.client.attachConsole(this.target.form.consoleActor, [], (response, consoleClient) => {
      try {
        if (response.error) {
          deferred.reject(response.error);
          return;
        }
        deferred.resolve(consoleClient);
      } catch(ex) {
        console.error(ex);
      }
    });
    this._webConsolePromise = deferred.promise;
    return deferred.promise
  },


  setToolbox: function(toolbox) {
    this.toolbox = toolbox;
    emit(this, "toolbox-changed");
  },

  // Find a shell for either a resource or a pair
  shellFor: function(resource) {
    if (resource instanceof Resource) {
      resource = this.resourceMap.pair(resource);
    }
    return this.shells.shellFor(resource);
  },

  // Returns the Editor for a given resource.
  editorFor: function(resource) {
    let shell = this.shellFor(resource);
    return shell ? shell.editors[resource.aspect] : shell;
  },

  formatNode: function(node, elt) {
    let text = [node.displayName];

    let editor = this.editorFor(node);

    if (this.plugins) {
      let annotations;
      this.plugins.forEach(plugin => {
        if (!plugin.onAnnotate) {
          return;
        }
        text = (text || []).concat(plugin.onAnnotate(node, editor));
      });
    }

    elt.textContent = text.join('');
  },

  addLiveStore: function(store) {
    this.stores.add(store);
    this.liveTree.addModel(store);
    this.resourceMap.addLiveStore(store);
  },

  removeLiveStore: function(store) {
    this.stores.delete(store);
    this.liveTree.removeModel(store);
    this.resourceMap.removeLiveStore(store);
  },

  addScratchStore: function(store) {
    this.stores.add(store);
    this.projectTree.addModel(store);
    this.resourceMap.addProjectStore(store, { noAutoPair: true });
  },

  addProjectStore: function(store) {
    this.stores.add(store);
    this.projectStores.set(store.path, store);
    this.projectTree.addModel(store);
    this.resourceMap.addProjectStore(store);
  },

  removeProjectStore: function(store) {
    this.stores.delete(store);
    this.projectStores.delete(store.path);
    this.projectTree.removeModel(store);
    this.resourceMap.removeProjectStore(store);
  },

  get sourcesVisible() {
    return this.sourceToggle.hasAttribute("pane-collapsed");
  },

  get currentShell() {
    return this.shells.currentShell;
  },

  get currentEditor() {
    return this.shells.currentEditor;
  },
});

exports.Itchpad = Itchpad;
