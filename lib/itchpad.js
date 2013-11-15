const { Class } = require("sdk/core/heritage");

const { LocalStore } = require("stores/local");
const { StylesStore } = require("stores/styles");
const { TreeView } = require("views/tree");
const { PairChooser } = require("views/pair");
const { EditorPane } = require("views/editor-pane");
const { ResourceMap } = require("resource-map");
const { registeredPlugins } = require("plugins/core");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");


const { Cu } = require("chrome");
const { ViewHelpers } = Cu.import("resource:///modules/devtools/ViewHelpers.jsm", {});

var Itchpad = Class({
  extends: EventTarget,

  initialize: function(document, toolbox) {
    this.document = document;
    this.toolbox = toolbox;
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

    this.onNodeSelection = this.onNodeSelection.bind(this);

    this.localTree = new TreeView(this.document, {
      nodeFormatter: this.formatNode.bind(this)
    });
    this.localTree.on("selection", this.onNodeSelection);
    document.querySelector("#sources-tabs > tabpanels").appendChild(this.localTree.elt);

    this.remoteTree = new TreeView(this.document, {
      nodeFormatter: this.formatNode.bind(this)
    });
    this.remoteTree.on("selection", this.onNodeSelection);

    document.querySelector("#sources-tabs > tabpanels").appendChild(this.remoteTree.elt);

    this.addLocalStore(new LocalStore("/Users/dcamp/git/mechanic"));
    this.addRemoteStore(new StylesStore(toolbox ? toolbox.target : null));
    this.loadPlugins();
  },

  onNodeSelection: function(node) {
    if (node.isDir) {
      return;
    }
    let pair = this.resourceMap.pair(node);
    let editor = this.editorPane.open(pair, node);
    this.pairChooser.setEditor(editor);
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

    for (let plugin of registeredPlugins) {
      this.plugins.push(plugin(this));
    }
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
    if (!editor.editor) {
      return;
    }
    editor.editor.on(event, (...args) => {
      this._pluginDispatch(handler, editor, ...args);
    });
  },

  setTarget: function(target) {
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

  setToolbox: function(toolbox) {
    this.toolbox = toolbox;
    emit(this, "toolbox-changed");
  },

  formatNode: function(node, elt) {
    let text = [node.displayName];

    let editor = this.editorPane.editorFor(node);

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

  addRemoteStore: function(store) {
    return this._addStore(store).then(() => {
      this.remoteTree.addModel(store);
      this.resourceMap.addRemoteStore(store);
    });
  },

  addLocalStore: function(store) {
    return this._addStore(store).then(() => {
      this.localTree.addModel(store);
      this.resourceMap.addLocalStore(store);
    });
  },

  _addStore: function(store) {
    this.stores.push(store);
    return store.refresh();
  },

  get sourcesVisible() {
    return this.sourceToggle.hasAttribute("pane-collapsed");
  },

  get currentEditor() {
    return this.editorPane.currentEditor;
  },
  get currentPairEditor() {
    return this.editorPane.currentPairEditor;
  }
});

exports.Itchpad = Itchpad;
