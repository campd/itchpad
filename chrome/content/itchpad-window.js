var gItchpad = null;
var gToolbox = null;

function setToolbox(toolbox) {
  window.gToolbox = toolbox;
  if (gItchpad) {
    gItchpad.setToolbox(gToolbox);
  }
}

window.addEventListener("message", receiveMessage, false);

var queuedMessage = null;

function receiveMessage(event)
{
  if (!event.data) {
    console.log("Itchpad: message with no data", event);
    return;
  }

  // XXX: This should use promises to manage asynchronous gItchpad loading,
  // but API has not yet been finalized so just storing it with a variable for now.
  if (!gItchpad) {
    console.log("Itchpad: message received too early.  Queueing to process later", event);
    queuedMessage = event.data
    return;
  }
  queuedMessage = null;
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

  // USAGE::
  // window.postMessage("/bin/|Project Name|Version|icon-sample.png|http://localhost", "*");

  service.initItchpad(window, project, gToolbox).then(pad => {
    gItchpad = pad;

    if (queuedMessage) {
      window.postMessage(queuedMessage, "*");
    }
  });
}

window.addEventListener("load", init, true);

function goUpdateSourceEditorMenuItems() {
  goUpdateGlobalEditMenuItems();
  goUpdateGlobalEditMenuItems();
  let commands = ['cmd_undo', 'cmd_redo', 'cmd_delete', 'cmd_findAgain'];
  commands.forEach(goUpdateCommand);
}