const tabs = require("sdk/tabs");
const data = require("sdk/self").data;

exports.modifyAppManager = function() {
  tabs.on("ready", (tab) => {
    if (tab.url == "about:app-manager") {
      tab.attach({
        contentScriptFile: data.url("app-manager-mod.js"),
        onMessage: (msg) => {
          
        }
      });
    }
  });
}
