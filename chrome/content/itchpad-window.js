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
  let path = event.data;
  let project = gItchpad.project;
  setTimeout(function() {

  let paths = [];
  for (let model of gItchpad.projectTree.models) {
    console.log(model.displayName, model);
    paths.push(model.path);
  }

  for (let path of paths) {
    project.removePath(path);
  }
  project.addPath(path);
  project.save().then(() => {
    project.refresh();
  });

  }, 1000);
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
    // window.postMessage("/Users/bgrinstead/Sites/itchpad/test/mock/soup/js", "*");
  });
}

window.onload = init;

function goUpdateSourceEditorMenuItems() {
  goUpdateGlobalEditMenuItems();
  goUpdateGlobalEditMenuItems();
  let commands = ['cmd_undo', 'cmd_redo', 'cmd_delete', 'cmd_findAgain'];
  commands.forEach(goUpdateCommand);
}