const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { merge } = require("sdk/util/object");

const { devtoolsRequire } = require("devtools");

const Editor  = devtoolsRequire("devtools/sourceeditor/editor");

const { Promise } = Cu.import("resource://gre/modules/Promise.jsm", {});

const HTML_NS = "http://www.w3.org/1999/xhtml";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var ItchEditor = Class({
  extends: EventTarget,

  initialize: function(document) {
    this.doc = document;
    this.elt = this.doc.createElement("vbox");
    this.elt.setAttribute("flex", "1");
    this.elt.editor = this;
  },

  load: function(node) {
    return Promise.resolve();
  },

  focus: function() {
    return Promise.resolve();
  }
});
exports.ItchEditor = ItchEditor;

var TextEditor = Class({
  extends: ItchEditor,

  initialize: function(document, mode=Editor.modes.text) {
    ItchEditor.prototype.initialize.call(this, document);

    this.editor = new Editor({
      mode: mode,
      lineNumbers: true,
    });

    this.appended = this.editor.appendTo(this.elt);
  },

  load: function(node) {
    return this.appended.then(() => {
      return node.load();
    }).then(text => {
      this.editor.setText(text);
      this.editor.markClean();
      emit(this, "load");
    }).then(null, console.error);
  },

  save: function(node) {
    return node.save(this.editor.getText()).then(() => {
      this.editor.markClean();
      emit(this, "save");
    });
  },

  focus: function(node) {
    return this.appended.then(() => {
      this.editor.focus();
    });
  }
});
exports.TextEditor = TextEditor;


function textMode(mode) {
  return function(document) { return TextEditor(document, mode); }
}

exports.JSEditor = textMode(Editor.modes.js);
exports.CSSEditor = textMode(Editor.modes.css);
exports.HTMLEditor = textMode(Editor.modes.html);

var ImageEditor = Class({
  extends: ItchEditor,

  initialize: function(document) {
    ItchEditor.prototype.initialize.call(this, document);
    this.appended = Promise.resolve();
  },

  load: function(node) {
    let image = this.doc.createElement("image");
    image.setAttribute("src", node.uri);
    this.elt.appendChild(image);
  }
});
exports.ImageEditor = ImageEditor;

