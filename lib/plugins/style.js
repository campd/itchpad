var { Class } = require("sdk/core/heritage");
var { registerPlugin, Plugin } = require("plugins/core");

var StyleAnnotation = Class({
  extends: Plugin,
  onAnnotate: function(node, editor) {
    if (!node.sheet) {
      return;
    }

    return " (" + node.sheet.ruleCount + " rules)";
  }
});
exports.StyleAnnotation = StyleAnnotation;

registerPlugin(StyleAnnotation);
