const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { TextEditor, HTMLEditor, CSSEditor, JSEditor, ImageEditor } = require("editors");

const NetworkHelper = require("devtools/toolkit/webconsole/network-helper");

let categoryMap = {
  "txt": TextEditor,
  "html": HTMLEditor,
  "xml": HTMLEditor,
  "css": CSSEditor,
  "js": JSEditor,
  "json": JSEditor,
  "image": ImageEditor
};

function editorTypeForResource(resource)
{
  return categoryMap[resource.contentCategory] || TextEditor;
}

var Shell = Class({
  extends: EventTarget,

  initialize: function(document, pair, selectedResource) {
    this.doc = document;
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
    let constructor = editorTypeForResource(project);
    let editor = constructor(this.doc);
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

var History = Class({
  initialize: function() {
    this.items = [];
    this.index = -1;
  },

  navigate: function(item) {
    this.items = this.items.filter(i => i != item);
    this.items.push(item);
    this.index = this.items.length - 1;
  },

  get current() {
    return this.index >= 0 ? this.items[this.index] : null;
  },

  canBack: function() { return this.index > 0 },
  back: function() {
    return this.canBack() ? this.items[--this.index] : this.current;
  },

  canForward: function() { return this.index < (this.items.length - 1) },
  forward: function() {
    return this.canForward() ? this.items[++this.index] : this.current;
  }
});

var ShellDeck = Class({
  extends: EventTarget,

  initialize: function(document, appendTo) {
    this.doc = document;
    this.deck = this.doc.createElement("deck");
    this.deck.setAttribute("flex", "1");
    this.elt = this.deck;

    this.shells = new Map();

    this.history = History();
    this._deactivateEditor = null;
  },

  open: function(pair, defaultResource) {
    // XXX: This doesn't work if pairing changes...
    let shell = this.shells.get(pair);
    if (!shell) {
      shell = this.createShell(pair, defaultResource);
      this.shells.set(pair, shell);
    }
    this.history.navigate(shell);
    this.selectShell(shell);
    return shell;
  },

  back: function() {
    this.selectShell(this.history.back());
  },

  forward: function() {
    this.selectShell(this.history.forward());
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
    let shell = Shell(this.doc, pair, defaultResource);
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
