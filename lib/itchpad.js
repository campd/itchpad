const { Class } = require("sdk/core/heritage");
const { LocalStore } = require("stores/local");
const { StylesStore } = require("stores/styles");
const { TreeView } = require("views/tree");
const { PairChooser } = require("views/pair");
const { EditorPane } = require("views/editor-pane");
const { ResourceMap } = require("resource-map");
const timers = require("sdk/timers");

const { Cu } = require("chrome");
const { ViewHelpers } = Cu.import("resource:///modules/devtools/ViewHelpers.jsm", {});

const DEFAULT_THROTTLE_DELAY = 500;

var Plugin = Class({
  initialize: function(host) {
    this.host = host;
    this.init(host);
  },

  init: function(host) {},

  priv: function(item) {
    if (!this._privData) {
      this._privData = new WeakMap();
    }
    if (!this._privData.has(item)) {
       this._privData.set(item, {});
    }
    return this._privData.get(item);
  },

  selectNode: function(editor, p) {
    return editor.pair.select(p, editor.source);
  },

  // Editor state lifetime...
  onEditorCreated: function(editor) {},
  onEditorDestroyed: function(editor) {},

  onEditorActivated: function(editor) {},
  onEditorDeactivated: function(editor) {},

  onEditorLoad: function(editor) {},
  onEditorSave: function(editor) {},
  onEditorChange: function(editor) {},
});

var LoggingPlugin = Class({
  extends: Plugin,

  // Editor state lifetime...
  onEditorCreated: function(editor) { console.log("editor created: " + editor) },
  onEditorDestroyed: function(editor) { console.log("editor destroyed: " + editor )},

  onEditorSave: function(editor) { console.log("editor saved: " + editor) },
  onEditorLoad: function(editor) { console.log("editor loaded: " + editor) },

  onEditorActivated: function(editor) { console.log("editor focused: " + editor )},
  onEditorDeactivated: function(editor) { console.log("editor blur: " + editor )},

  onEditorChange: function(editor) { console.log("editor changed: " + editor )},
});

var DirtyPlugin = Class({
  extends: Plugin,

  onEditorSave: function(editor) { this.onEditorChange(editor); },
  onEditorLoad: function(editor) { this.onEditorChange(editor); },

  onEditorChange: function(editor) {
    let tree = this.host.tree;

    // Dont' force a refresh unless the dirty state has changed...
    let priv = this.priv(editor);
    let clean = editor.editor.isClean();
    if (priv.isClean !== clean) {
      this.host.tree.updateNode(editor.pair[editor.source]);
      priv.isClean = clean;
    }
  },

  onAnnotate: function(node, editor) {
    if (editor && !editor.editor.isClean()) {
      return '*';
    }
  }
});

var ApplyPlugin = Class({
  extends: Plugin,

  init: function(host) {
    this.needsUpdate = new Set();
  },

  getAutoApplier: function(editor) {
    return this.selectNode(editor, node => node.canAutoApply);
  },
  getApplier: function(editor) {
    return this.selectNode(editor, node => 'apply' in node);
  },

  onEditorChange: function(editor) {
    this.update(editor);
  },

  onCommand: function(cmd) {
    // If we haven't been auto-applying, at least apply on save (not
    // sure this is great behavior, but I'm gonna try it)
    if (cmd) {
      let editor = this.host.currentEditor;
      this.needsUpdate.add(editor);
      this.apply();
    }
  },

  update: function(editor) {
    let pair = editor.pair;
    let applyNode = this.getAutoApplier(editor);
    if (!applyNode) {
      return;
    }

    this.needsUpdate.add(editor);
    if (this._updateTask) {
      timers.clearTimeout(this._updateTask);
    }

    this._updateTask = timers.setTimeout(this.apply.bind(this), DEFAULT_THROTTLE_DELAY);
  },

  apply: function() {
    if (this._updateTask) {
      timers.clearTimeout(this._updateTask);
      this._updateTask = null;
    }

    for (editor of this.needsUpdate) {
      let applier = this.getApplier(editor);
      if (applier) {
        applier.apply(editor.editor.getText());
      }
    }
    this.needsUpdate = new Set();
  }
});

// Handles the save command.
var SavePlugin = Class({
  extends: Plugin,

  init: function(host) { },

  getSaver: function(editor) {
    return this.selectNode(editor, node => 'save' in node);
  },

  onCommand: function(cmd) {
    if (cmd === "cmd-save") {
      let editor = this.host.currentEditor;
      let saver = this.getSaver(editor);
      if (!saver) {
        return;
      }

      editor.save(saver);
    }
  }
})

var Itchpad = Class({
  initialize: function(document) {
    this.document = document;
    this.stores = [];

    this.resourceMap = new ResourceMap();

    this.editorPane = new EditorPane(document);
    this.onEditorCreated = this.onEditorCreated.bind(this);
    this.editorPane.on("editor-created", this.onEditorCreated);

    this.commands = document.getElementById("itchpad-commandset");
    this.commands.addEventListener("command", (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      this._pluginDispatch("onCommand", evt.target.id);
    });

    document.getElementById("editors").appendChild(this.editorPane.elt);

    this.pairChooser = new PairChooser(this.document);

    this.tree = new TreeView(this.document, {
      nodeFormatter: this.formatNode.bind(this),
    });
    this.tree.on("selection", node => {
      if (!node.isDir) {
        let pair = this.resourceMap.pair(node);
        dump("Local node: " + (pair.local ? pair.local.uri : "null") + "\n");
        dump("Remote node: " + (pair.remote ? pair.remote.uri : "null") + "\n");
        let editor = this.editorPane.open(pair, node);
        this.pairChooser.setEditor(editor);
      }
    });
    document.getElementById("sources").appendChild(this.tree.elt);

    this.sourceToggle = document.getElementById("toggle-sources");

    this.editorPane.on("dirty-changed", (editor) => {
      this.tree.updateNode(editor.node);
    });

    this.addLocalStore(new LocalStore("/Users/dcamp/git/mechanic"));
    this.loadPlugins();
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
  },

  loadPlugins: function() {
    this.plugins = [];
    this.plugins.push(new LoggingPlugin(this));
    this.plugins.push(new DirtyPlugin(this));
    this.plugins.push(new ApplyPlugin(this));
    this.plugins.push(new SavePlugin(this));
  },

  onEditorCreated: function(editor) {
    this.plugins.forEach(plugin => plugin.onEditorCreated(editor));
    this._editorListen(editor, "change", "onEditorChange");
    this._containerListen(editor, "load", "onEditorLoad");
    this._containerListen(editor, "save", "onEditorSave");
  },

  _pluginDispatch: function(handler, ...args) {
    this.plugins.forEach(plugin => {
      try {
        if (handler in plugin) plugin[handler](...args);
      } catch(ex) {
        console.exception(ex);
      }
    })
  },

  _containerListen: function(editor, event, handler) {
    editor.on(event, (...args) => {
      this._pluginDispatch(handler, editor, ...args);
    });
  },

  _editorListen: function(editor, event, handler) {
    editor.editor.on(event, (...args) => {
      this._pluginDispatch(handler, editor, ...args);
    });
  },

  setToolbox: function(toolbox) {
    this.toolbox = toolbox;
    toolbox.target.makeRemote().then(() => {
      this.addRemoteStore(new StylesStore(this.toolbox.target));
    }).then(null, console.error);
  },

  formatNode: function(node, elt) {
    let text = [node.displayName];

    let editor = this.editorPane.editorFor(node);

    let annotations;
    this.plugins.forEach(plugin => {
      if (!plugin.onAnnotate) {
        return;
      }
      text = (text || []).concat(plugin.onAnnotate(node, editor));
    });

    elt.textContent = text.join('');
  },

  addRemoteStore: function(store) {
    return this._addStore(store).then(() => {
      this.resourceMap.addRemoteStore(store);
    });
  },

  addLocalStore: function(store) {
    return this._addStore(store).then(() => {
      this.resourceMap.addLocalStore(store);
    });
  },

  _addStore: function(store) {
    this.stores.push(store);
    return store.refresh().then(() => this.tree.addModel(store));
  },

  get sourcesVisible() {
    return this.sourceToggle.hasAttribute("pane-collapsed");
  },

  toggleSources: function() {
    if (this.sourcesVisible) {
      this.sourceToggle.setAttribute("tooltiptext", "Hide sources");
      this.sourceToggle.removeAttribute("pane-collapsed");
    } else {
      this.sourceToggle.setAttribute("tooltiptext", "Show sources");
      this.sourceToggle.setAttribute("pane-collapsed", "");
    }

    ViewHelpers.togglePane({
      visible: this.sourcesVisible,
      animated: true,
      callback: function() { console.log("done toggling!") }
    }, this.document.getElementById("sources"));
  },

  get currentEditor() {
    return this.editorPane.currentEditor
  },
  get currentPairEditor() {
    return this.editorPane.currentPairEditor;
  },

  saveFile: function() {
    this.currentEditor.save().then(() => { console.log ("saved!") });
  }
});

exports.Itchpad = Itchpad;
