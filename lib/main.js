const { ToolPanel } = require("devtools");
const { Itchpad } = require("itchpad");
const { Class } = require("sdk/core/heritage");
const { Unknown, Service } = require('sdk/platform/xpcom');
const { Cc, Ci } = require('chrome');
const { registerPlugin } = require("plugins/core");

var CONTRACT_ID = "@mozilla.org/devtools/itchpad;1";

// Load default plugins

// Uncomment to get logging of addon events.
//require("plugins/logging");

require("plugins/apply");
require("plugins/dirty");
require("plugins/save");

var ItchpadLoader = Class({
  extends: Unknown,

  get wrappedJSObject() this,

  initItchpad: function(document) {
    return new Itchpad(document);
  },

  registerPlugin: function(constr) {
    registerPlugin(constr);
  }
});

var ItchpadService = Service({
  contract: CONTRACT_ID,
  Component: ItchpadLoader
});

let panel = ToolPanel({
  id: "itchpad",
  ordinal: 0,
  url: "chrome://itchpad/content/itchpad.xul",
  icon: "chrome://browser/skin/devtools/tool-styleeditor.png",
  label: "Sources",
  tooltip: "Edit Sources",
  isTargetSupported: function(target) {
    return true;
  },
  build: function(iframeWindow, toolbox) {
    if (iframeWindow.setToolbox) {
      console.log("ABOUT TO CALL TOOLBOX\n");
      iframeWindow.setToolbox(toolbox);
    } else {
      iframeWindow.gToolbox = toolbox;
    }
  }
});
