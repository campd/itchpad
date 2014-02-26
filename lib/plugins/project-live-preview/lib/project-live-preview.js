const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const { emit } = require("sdk/event/core");
const tabs = require("sdk/tabs");

// XXX: Experimenting with hooking a tab up with a live view of a project

var LivePreviewProject = Class({
  extends: Plugin,

  init: function(host) {
    let doc = host.document;
    let toolbar = doc.getElementById("project-toolbar");

    this.host.createMenuItem({
      parent: "#directory-menu-popup",
      label: "Live Preview Project",
      command: "live-preview-project"
    });
    this.command = host.addCommand({
      id: "live-preview-project",
    });
  },

  getActiveTabUrl: function() {
    let paths = [store.path for ([id, store] of this.host.project.localStores)];
    if (!paths[0]) {
      return;
    }

    return "file://" + encodeURI(paths[0] + "/index.html");
  },

  onCommand: function(id, cmd) {
    if (cmd !== this.command) {
      return;
    }

    let activeTabUrl = this.getActiveTabUrl();
    if (activeTabUrl) {
      openTab(activeTabUrl);
    }
  },

  onEditorSave: function(editor, resource) {
    if (resource.basename === "index.html") {
      let activeTabUrl = this.getActiveTabUrl();
      if (activeTabUrl) {
        openTab(activeTabUrl);
      }
    }
  }
});

function getTab(url) {
  for (let tab of tabs) {
    if (tab.url === url) {
      return tab;
    }
  }
}

function openTab(url) {
  let tab = getTab(url);
  if (tab) {
    tab.reload();
    return tab; //.activate();
  } else {
    return tabs.open(url);
  }
}

exports.LivePreviewProject = LivePreviewProject;
registerPlugin(LivePreviewProject);
