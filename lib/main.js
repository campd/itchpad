const { Cc, Ci } = require("chrome");

var domSerializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"]
                    .createInstance(Ci.nsIDOMSerializer);

const { devtoolsRequire, ToolPanel, SideMenuWidget } = require("devtools");

const { LocalStore } = require("stores/local");
const { TreeView } = require("views/tree");
const { EditorList } = require("views/editors");

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
    let doc = iframeWindow.document;
    let store = new LocalStore("/Users/dcamp/git/itchpad");
    store.refresh().then(() => {
      let tree = new TreeView(doc, store);
      let editors = new EditorList(doc);

      doc.getElementById("sources").appendChild(tree.elt);
      doc.getElementById("editors").appendChild(editors.elt)

      tree.on("selection", node => {
        if (!node.isDir) {
          editors.open(node);
        }
        console.log("selection: " + node.path + " has content type: " + node.contentType);
      });
    }).then(null, console.error);
  }
});
