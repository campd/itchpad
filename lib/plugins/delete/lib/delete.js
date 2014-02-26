const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");

var DeletePlugin = Class({
  extends: Plugin,

  init: function(host) {
    this.host.addCommand({
      id: "cmd-delete"
    });
    this.host.createMenuItem({
      parent: "#directory-menu-popup",
      label: "Delete",
      command: "cmd-delete"
    });
  },

  onCommand: function(cmd) {
    if (cmd === "cmd-delete") {
      let tree = this.host.projectTree;
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
