const { Cc, Ci, Cu } = require('chrome');
const { ToolPanel } = require("devtools/core");
const { Itchpad } = require("itchpad");
const { Class } = require("sdk/core/heritage");
const { Unknown, Service } = require('sdk/platform/xpcom');
const { registerPlugin } = require("plugins/core");
const prefs = require("sdk/preferences/service");
const { Projects } = require("project");

// Set up some preferences from the environment for easier cfx testing.
(function setupPrefs() {
  const { env } = require("sdk/system/environment");

  if (env.ITCHPAD_TOOL_PANEL) {
    prefs.set("itchpad.tool-panel", true);
  }

  if (env.ITCHPAD_PROJECT_DIRS) {
    prefs.set("itchpad.project-dirs", env.ITCHPAD_PROJECT_DIRS);
  }
})();

var CONTRACT_ID = "@mozilla.org/devtools/itchpad;1";

// XPCOM Service for communicating with the itchpad.
var ItchpadLoader = Class({
  extends: Unknown,

  get wrappedJSObject() this,

  // Called from itchpad.xul to create an appropriate itchpad instance.
  initItchpad: function(window, projectPath, toolbox) {
    console.log("project: " + projectPath);

    let promise = projectPath ? Projects.getProject(projectPath) : Projects.defaultProject()
    // Load the default project...
    promise.then(project => {
      return new Itchpad(window, project, toolbox);
    });
  },

  openProject: function(path) {
    
  },

  registerPlugin: function(constr) {
    registerPlugin(constr);
  },
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
  const { getMostRecentWindow, open } = require("sdk/window/utils");
  let current = getMostRecentWindow("devtools:itchpad");
  if (current) {
    current.focus();
    return;
  }

  Projects.defaultProject().then(project => {
    let params = Cc["@mozilla.org/embedcomp/dialogparam;1"]
                 .createInstance(Ci.nsIDialogParamBlock);

    params.SetNumberStrings(1);
    params.SetString(0, project.path);

    return open("chrome://itchpad/content/itchpad.xul", {
      name: "itchpad:" + openSerial++,
      features: {
        chrome: true,
        titlebar: true,
        toolbar: true,
        centerscreen: true,
        resizable: true,
        dialog: "no",
      },
      args: params
    });
  });
};

// Put the real scratchpad back when we're done.
require("sdk/system/unload").when(reason => {
  ScratchpadManager.openScratchpad = realScratchpadOpen;
});

if (prefs.get("itchpad.tool-panel", false)) {
  ToolPanel({
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
}

// Load default plugins

// Uncomment to get logging of addon events.
require("plugins/logging");

require("plugins/apply");
require("plugins/dirty");
require("plugins/new");
require("plugins/save");
require("plugins/open");
require("plugins/style");
require("plugins/target-chooser");
require("plugins/refresh-project");
require("plugins/scratch-js");
require("plugins/scratch-css");
require("plugins/variable-sidebar");
require("plugins/notify");
require("plugins/project-dirs");
require("plugins/aspect-chooser");
require("plugins/search");

