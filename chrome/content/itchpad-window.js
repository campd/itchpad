var gItchpad = null;
var gToolbox = null;

function setToolbox(toolbox) {
  window.gToolbox = toolbox;
  if (gItchpad) {
    gItchpad.setToolbox(gToolbox);
  }
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
  });
}

window.onload = init;

function goUpdateSourceEditorMenuItems() {
  goUpdateGlobalEditMenuItems();
  goUpdateGlobalEditMenuItems();
  let commands = ['cmd_undo', 'cmd_redo', 'cmd_delete', 'cmd_findAgain'];
  commands.forEach(goUpdateCommand);
}