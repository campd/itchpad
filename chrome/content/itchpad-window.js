var gItchpad = null;
var gToolbox = null;

function setToolbox(toolbox) {
  window.gToolbox = toolbox;
  if (gItchpad) {
    gItchpad.setToolbox(gToolbox);
  }
}

window.addEventListener("message", receiveMessage, false);

function receiveMessage(event)
{
  if (!gItchpad || !event.data) {
    console.log("Itchpad: message received too early", event);
    return;
  }
  let data = event.data.split("|");
  let path = data[0];
  let opts = {
    name: data[1],
    version: data[2],
    iconUrl: data[3],
    iframeSrc: data[4]
  };
  gItchpad.setProjectToSinglePath(path, opts);
}

function init() {
  var wrapper = Components.classes["@mozilla.org/devtools/itchpad;1"].getService(Components.interfaces.nsISupports);
  var service = wrapper.wrappedJSObject;

  let args = window.arguments;
  let project = null;
  if (args && args[0] instanceof Components.interfaces.nsIDialogParamBlock) {
    project = args[0].GetString(0);
  }

  service.initItchpad(window, project, gToolbox).then(pad => {
    gItchpad = pad;

    // USAGE::
    // window.postMessage("/bin/|Project Name|Version|icon-sample.png|http://localhost", "*");
  });
}

window.addEventListener("load", init, true);

function goUpdateSourceEditorMenuItems() {
  goUpdateGlobalEditMenuItems();
  goUpdateGlobalEditMenuItems();
  let commands = ['cmd_undo', 'cmd_redo', 'cmd_delete', 'cmd_findAgain'];
  commands.forEach(goUpdateCommand);
}