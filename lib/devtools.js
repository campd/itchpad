const { Cu } = require("chrome");
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { gDevTools } = Cu.import("resource:///modules/devtools/gDevTools.jsm", {});
const unload = require("sdk/system/unload");
const { Class } = require("sdk/core/heritage");
const { merge } = require("sdk/util/object");

exports.SideMenuWidget = Cu.import("resource:///modules/devtools/SideMenuWidget.jsm", {}).SideMenuWidget;

exports.devtoolsRequire = function(id) {
  return devtools.require(id);
}

var ToolPanel = Class({
  initialize: function(definition) {
    this.definition = definition;
    this.register();
    unload.ensure(this, "unregister");
  },

  register: function() {
    this.registered = true;
    gDevTools.registerTool(this.definition);
  },

  unregister: function() {
    if (this.registered) {
      gDevTools.unregisterTool(this.definition);
    }
  }
});

exports.ToolPanel = ToolPanel;
