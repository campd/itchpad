const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");

var DeletePlugin = Class({
  extends: Plugin,

  init: function(host) {
    console.log("Delete plugin started");
  },

  onCommand: function(cmd) {
    if (cmd === "cmd-delete") {
      let tree = this.host.activeTree;
      let resource = tree.getSelected();
      parent = resource.isDir ? resource : resource.parent;
      sibling = resource.isDir ? null : resource;

      tree.deleteNode(resource);
      console.log("Delete received", resource);
    }
  }
});

exports.DeletePlugin = DeletePlugin;
registerPlugin(DeletePlugin);
