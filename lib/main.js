const { ToolPanel } = require("devtools");

const { Itchpad } = require("itchpad");

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
    new Itchpad(iframeWindow.document);
  }
});
