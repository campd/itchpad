const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const promise = require("helpers/promise");

const { devtoolsRequire } = require("devtools");

const Editor  = devtoolsRequire("devtools/sourceeditor/editor");


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

  load: function(resource) {
    return promise.resolve();
  },

  focus: function() {
    return promise.resolve();
  }
});
exports.ItchEditor = ItchEditor;

var MODE_CATEGORIES = {};

MODE_CATEGORIES[Editor.modes.text.name] = "txt";
MODE_CATEGORIES[Editor.modes.js.name] = "js";
MODE_CATEGORIES[Editor.modes.html.name] = "html";
MODE_CATEGORIES[Editor.modes.css.name] = "css";

var TextEditor = Class({
  extends: ItchEditor,

  get category() {
    return MODE_CATEGORIES[this.editor.getMode().name];
  },

  initialize: function(document, mode=Editor.modes.text) {
    ItchEditor.prototype.initialize.call(this, document);

    this.editor = new Editor({
      mode: mode,
      lineNumbers: true,
    });

    this.appended = this.editor.appendTo(this.elt);
  },

  load: function(resource) {
    return this.appended.then(() => {
      return resource.load();
    }).then(text => {
      this.editor.setText(text);
      this.editor.setClean();
      emit(this, "load");
    }).then(null, console.error);
  },

  save: function(resource) {
    return resource.save(this.editor.getText()).then(() => {
      this.editor.setClean();
      emit(this, "save");
    });
  },

  focus: function(resource) {
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
    this.appended = promise.resolve();
  },

  load: function(resource) {
    let image = this.doc.createElement("image");
    image.setAttribute("src", resource.uri);
    this.elt.appendChild(image);
  }
});
exports.ImageEditor = ImageEditor;

