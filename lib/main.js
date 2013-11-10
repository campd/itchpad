const { ToolPanel } = require("devtools");
const { Itchpad } = require("itchpad");
const { Class } = require("sdk/core/heritage");
var { Unknown, Service } = require('sdk/platform/xpcom');
var { Cc, Ci } = require('chrome');

var CONTRACT_ID = "@mozilla.org/devtools/itchpad;1";

var ItchpadLoader = Class({
  extends: Unknown,

  get wrappedJSObject() this,

  initItchpad: function(document) {
    return new Itchpad(document);
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
