var { Class } = require("sdk/core/heritage");
var { registerPlugin, Plugin } = require("plugins/core");

var StyleAnnotation = Class({
  extends: Plugin,
  onAnnotate: function(resource, editor) {
    if (!resource.sheet) {
      return;
    }

    return " (" + resource.sheet.ruleCount + " rules)";
  }
});
exports.StyleAnnotation = StyleAnnotation;

registerPlugin(StyleAnnotation);
