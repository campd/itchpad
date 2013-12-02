function addPanel() {
  let button = document.createElement("button");
  button.setAttribute("class", "button editor-button");
  button.setAttribute("panel", "editor");
  button.textContent = "Editor";

  let tabs = document.querySelector("#tabs");
  tabs.insertBefore(button, tabs.firstChild);

  let frame = document.createElement("iframe");
  frame.setAttribute("flex", "1")
  frame.setAttribute("class", "panel editor-panel");
  frame.setAttribute("src", "chrome://itchpad/content/itchpad.xul");
  frame.getBoundingClientRect();

  frame.addEventListener("load", (evt) => {
    return;
    if (evt.target != frame.contentWindow) {
      dump("Ignoring: " + evt.target);
      return;
    }
    dump("I CAN MAKE THIS WORK");
    frame.getBoundingClientRect();
    try {
//      let frame = document.querySelector("iframe.editor-panel");
      dump("element\n");
      dump(frame);
      dump("window\n");
      dump(frame.contentWindow);
      dump("wrapped\n");
      dump(frame.contentWindow.wrappedJSObject);
      dump("init\n");
      dump(frame.contentWindow.wrappedJSObject.init);
      dump("calling\n");
      frame.contentWindow.wrappedJSObject.init();
      dump("returning\n");
    } catch(ex) {
      dump("error: " + ex.stack + "\n")
      dump(ex);
    }

  });

  let panels = document.querySelector("#tab-panels");
  panels.appendChild(frame);

  let init = () => {
    button.removeEventListener("click", init);
    frame.contentWindow.wrappedJSObject.init();
  }
  button.addEventListener("click", init);
}

let projects = document.querySelector(".projects-panel");

function editClick(thing, location) {
  var wrapper = Components.classes["@mozilla.org/devtools/itchpad;1"].getService(Components.interfaces.nsISupports);
  var service = wrapper.wrappedJSObject;

  dump("EDIT WAS CLICKED: " + thing + ", " + location);

  service.openPath(location);
}

function modifyProjects() {
  let projects = document.querySelector(".projects-panel");

  function doModifyProjects(event) {
    projects.removeEventListener("load", doModifyProjects);

    projects.contentWindow.itchpadEditClick = editClick;

    dump("MODIFYING THE PROJECTS WINDOW");
    let doc = projects.contentDocument;
    let buttons = doc.querySelector("#lense-template .project-buttons");

    let edit = doc.createElement("button");
    edit.setAttribute("class", "project-button-update");
    edit.setAttribute("onclick", "itchpadEditClick(this, this.dataset.location)");
    edit.setAttribute("template", '{"type":"attribute","path":"location","name":"data-location"}');
    edit.textContent = "Edit";

    buttons.insertBefore(edit, buttons.firstChild);
    dump("BUTTONS: " + buttons);

  }

  projects.addEventListener("load", doModifyProjects);
}

//addPanel();
modifyProjects();
