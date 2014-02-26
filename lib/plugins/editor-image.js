const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const promise = require("helpers/promise");
const { ItchEditor } = require("editors");
const { registerPlugin, Plugin } = require("plugins/core");

var ImagePlugin = Class({
  extends: Plugin,

  editorForResource: function(node) {
    if (node.contentCategory === "image") {
      return ImageEditor;
    }
  },

  init: function(host) {

  }
});

var ImageEditor = Class({
  extends: ItchEditor,

  initialize: function(document) {
    ItchEditor.prototype.initialize.call(this, document);
    this.appended = promise.resolve();
  },

  load: function(resource) {
    let image = this.doc.createElement("image");
    image.className = "editor-image";
    image.setAttribute("src", resource.uri);

    let box1 = this.doc.createElement("box");
    box1.appendChild(image);

    let box2 = this.doc.createElement("box");
    box2.setAttribute("flex", 1);

    this.elt.appendChild(box1);
    this.elt.appendChild(box2);
  }
});

exports.ImagePlugin = ImagePlugin;
registerPlugin(ImagePlugin);
