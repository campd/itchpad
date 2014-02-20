const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");

var DeletePlugin = Class({
  extends: Plugin,

  init: function(host) {
  },

  onCommand: function(cmd) {
    if (cmd === "cmd-delete") {
      let tree = this.host.activeTree;
      let resource = tree.getSelected();
      let parent = resource.parent;
      tree.deleteNode(resource).then(() => {
        this.host.project.refresh();
      })
    }
  }
});

exports.DeletePlugin = DeletePlugin;
registerPlugin(DeletePlugin);
