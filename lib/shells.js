const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { TextEditor, HTMLEditor, CSSEditor, JSEditor, ImageEditor } = require("views/editors");

const { devtoolsRequire } = require("devtools/core");
const NetworkHelper = devtoolsRequire("devtools/toolkit/webconsole/network-helper");

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
    this.pair.on("changed", this.onPairChanged.bind(this));
    this.currentAspect = selectedResource === this.live ? "live" : "project";

    this.elt = this.doc.createElement("deck");
    this.elt.shell = this;

    this.editors = { project: null, live: null };

    this._ensureEditor();
  },

  onPairChanged: function(aspect) {
    this.onAspectChange(aspect);
  },

  onAspectChange: function(aspect) {
    if (this.pair[aspect] === this[aspect]) {
      return;
    }

    this[aspect] = this.pair[aspect];

    if (this[aspect] && this.editors[aspect]) {
      // Reload from the new aspect
      this.editors[aspect].load(this.pair[aspect]);
    }
  },

  _ensureEditor: function() {
    let aspect = this.currentAspect;
    if (this.editors[aspect]) {
      let editor = this.editors[aspect];
      this.elt.setAttribute("selectedIndex", editor.deckIndex);
      this.currentEditor = editor;
      editor.appended.then(() => {
        emit(this, "editor-activated", editor);
      });
      return;
    }

    let resource = this.resource;
    let constructor = editorTypeForResource(resource);
    let editor = constructor(this.doc);
    editor.appended.then(() => {
      emit(this, "editor-created", editor);
    });

    this.editors[aspect] = editor;
    editor.shell = this;
    editor.aspect = aspect;
    editor.pair = this.pair;

    // XXX: too tired to figure out why .selectedPanel isn't working.
    // .. it's because we're doing this before bindings are created.
    editor.deckIndex = this.elt.children.length;
    this.elt.appendChild(editor.elt);
    this.elt.setAttribute("selectedIndex", editor.deckIndex);
    this.currentEditor = editor;
    editor.appended.then(() => {
      emit(this, "editor-activated", editor);
    });
    editor.load(resource);
  },

  get resource() {
    return this[this.currentAspect];
  },

  // Aspect can be either "project" or "live"
  selectAspect: function(aspect) {
    let aspect = (aspect === "project") ? "project" : "live";
    if (this[aspect] && aspect != this.currentAspect) {
      this.currentAspect = aspect;
      this._ensureEditor();
      emit(this, "aspect-changed");
    }
  },

  _resourceFor: function(operation) {
    if (operation in this.resource) {
      return this.resource;
    }
    let other = (this.currentAspect === "project") ? this.live : this.project;
    if (other && operation in other) {
      return other;
    }
    return null;
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
    if (this._deactivateEditor != shell.currentEditor) {
      emit(this, "editor-deactivated", this._deactivateEditor);
      shell.currentEditor.appended.then(() => {
        emit(this, "editor-activated", shell.currentEditor);
      });
      this._deactivateEditor = shell.currentEditor;
    }
  },

  get currentShell() {
    return this.deck.selectedPanel ? this.deck.selectedPanel.shell : null;
  },

  get currentEditor() {
    let shell = this.currentShell;
    return shell ? shell.currentEditor : shell;
  },

  createShell: function(pair, defaultResource) {
    let shell = Shell(this.doc, pair, defaultResource);
    shell.on("editor-created", (editor) => {
      this.shells.set(shell.pair[shell.aspect], editor);
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
