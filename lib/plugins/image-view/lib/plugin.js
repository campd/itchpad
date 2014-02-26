const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const promise = require("helpers/promise");
const { ImageEditor } = require("./image-editor");
const { registerPlugin, Plugin } = require("plugins/core");

var ImageEditorPlugin = Class({
  extends: Plugin,

  editorForResource: function(node) {
    if (node.contentCategory === "image") {
      return ImageEditor;
    }
  },

  init: function(host) {

  }
});

exports.ImageEditorPlugin = ImageEditorPlugin;
registerPlugin(ImageEditorPlugin);
