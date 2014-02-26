const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { EditorTypeForResource } = require("editors");
const NetworkHelper = require("devtools/toolkit/webconsole/network-helper");

var Shell = Class({
  extends: EventTarget,

  initialize: function(host, pair, selectedResource) {
    this.host = host;
    this.doc = host.document;
    this.pair = pair;
    this.project = pair.project;
    this.live = pair.live;
    this.elt = this.doc.createElement("vbox");
    this.elt.shell = this;

    this.editor = null;

    this._ensureEditor();
  },

  _ensureEditor: function() {
    if (this.editor) {
      let editor = this.editor;
      editor.appended.then(() => {
        emit(this, "editor-activated", editor);
      });
      return;
    }

    let project = this.project;
    let constructor = EditorTypeForResource(project);

    if (this.host.plugins) {
      this.host.plugins.forEach(plugin => {
        if (plugin.editorForResource) {
          let pluginEditor = plugin.editorForResource(project);
          if (pluginEditor) {
            constructor = pluginEditor;
          }
        }
      });
    }

    let editor = constructor(this.doc, this.host);
    editor.appended.then(() => {
      emit(this, "editor-created", editor);
    });

    this.editor = editor;
    editor.shell = this;
    editor.pair = this.pair;

    this.elt.appendChild(editor.elt);
    editor.appended.then(() => {
      emit(this, "editor-activated", editor);
    });
    editor.load(project);
  }
});

var ShellDeck = Class({
  extends: EventTarget,

  initialize: function(document, host) {
    this.doc = document;
    this.host = host;
    this.deck = this.doc.createElement("deck");
    this.deck.setAttribute("flex", "1");
    this.elt = this.deck;

    this.shells = new Map();

    this._deactivateEditor = null;
  },

  open: function(pair, defaultResource) {
    // XXX: This doesn't work if pairing changes...
    let shell = this.shells.get(pair);
    if (!shell) {
      shell = this.createShell(pair, defaultResource);
      this.shells.set(pair, shell);
    }
    this.selectShell(shell);
    return shell;
  },

  shellFor: function(resource) {
    return this.shells.get(resource);
  },

  selectShell: function(shell) {
    if (this.deck.selectedPanel.shell != shell) {
      this.deck.selectedPanel = shell.elt;
    }
    if (this._deactivateEditor != shell.editor) {
      emit(this, "editor-deactivated", this._deactivateEditor);
      shell.editor.appended.then(() => {
        emit(this, "editor-activated", shell.editor);
      });
      this._deactivateEditor = shell.editor;
    }
  },

  get currentShell() {
    return this.deck.selectedPanel ? this.deck.selectedPanel.shell : null;
  },

  get currentEditor() {
    let shell = this.currentShell;
    return shell ? shell.editor : shell;
  },

  createShell: function(pair, defaultResource) {
    let shell = Shell(this.host, pair, defaultResource);
    shell.on("editor-created", (editor) => {
      this.shells.set(shell.project, editor);
      emit(this, "editor-created", editor);
    });
    shell.on("editor-activated", (editor) => {
      if (this.currentShell === shell) {
        emit(this, "editor-activated", editor);
      }
    });

    this.deck.appendChild(shell.elt);
    return shell;
  },
});
exports.ShellDeck = ShellDeck;
