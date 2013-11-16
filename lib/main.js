const { ToolPanel } = require("devtools");
const { Itchpad } = require("itchpad");
const { Class } = require("sdk/core/heritage");
const { Unknown, Service } = require('sdk/platform/xpcom');
const { Cc, Ci, Cu } = require('chrome');
const { registerPlugin } = require("plugins/core");

var CONTRACT_ID = "@mozilla.org/devtools/itchpad;1";

// Load default plugins

// Uncomment to get logging of addon events.
require("plugins/logging");

require("plugins/apply");
require("plugins/dirty");
require("plugins/new");
require("plugins/save");
require("plugins/style");
require("plugins/target-chooser");
require("plugins/refresh-project");
require("plugins/scratch-js");
require("plugins/scratch-css");
require("plugins/variable-sidebar.js");

var ItchpadLoader = Class({
  extends: Unknown,

  get wrappedJSObject() this,

  initItchpad: function(document, toolbox) {
    return new Itchpad(document, toolbox);
  },

  registerPlugin: function(constr) {
    registerPlugin(constr);
  }
});

var ItchpadService = Service({
  contract: CONTRACT_ID,
  Component: ItchpadLoader
});

// Be a jerk and replace scratchpad for now.
let { ScratchpadManager } = Cu.import("resource:///modules/devtools/scratchpad-manager.jsm", {});
let realScratchpadOpen = ScratchpadManager.openScratchpad;
let openSerial = 0;
ScratchpadManager.openScratchpad = function() {
  const { open } = require("sdk/window/utils");
  return open("chrome://itchpad/content/itchpad.xul", {
    name: "itchpad:" + openSerial++,
    features: {
      chrome: true,
      titlebar: true,
      toolbar: true,
      centerscreen: true,
      resizable: true,
      dialog: "no"
    }
  });
};

// Put the real scratchpad back when we're done.
require("sdk/system/unload").when(reason => {
  ScratchpadManager.openScratchpad = realScratchpadOpen;
})

let panel = ToolPanel({
  id: "itchpad",
  ordinal: 0,
  url: "chrome://itchpad/content/itchpad.xul",
  icon: "chrome://browser/skin/devtools/tool-styleeditor.png",
  label: "Editor",
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
    return { destroy: function() {} };
  },
});
