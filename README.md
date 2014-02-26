
## Project Terms

* Stores: A Store manages access to a set of Resources.

* Resources: A Resource is a single item.

* Project Stores/Resources: Resources that are worked on outside of the webpage, like on the local disk.  They can be read from and saved to, but not applied.

* Live Stores/Resources: Resources in a running web page.  They can be read from and possibly applied to, but they cannot be saved to.

* Pair: When a live resource and project resource are associated with each other, they're treated as a Pair.

* Aspects: Live and Project are two Aspects of a Pair.

* Shell: A viewer for a pair.  Would like a better name for this.

* Editor: a single text editor.

* ShellDeck: a deck of shells.

## Embedding

Install the extension, then open a frame with the URL `chrome://itchpad/content/itchpad.xul`.

If you would like to set the project to open only a single path on the filesystem, you can run:

    window.postMessage("/path/to/folder", "*")

This can temporarily also take the form of | separated values of path|name|version|iconUrl|iframePreview.  Iframe preview is the URL to open when the project root is clicked

    window.postMessage("/path/to/folder|Project Name|Version #|icon-sample.png|http://localhost", "*");

    window.postMessage("/path/to/folder", "*")

Or if you have access to the gItchpad object, you can:

    gItchpad.setProjectToSinglePath("/path/to/folder")

## To Run Locally

The basic workflow is generating an XPI file and adding this to the browser with your specified profile.  This is automated with [grunt](http://gruntjs.com/getting-started).  See the [gruntfile](Gruntfile.js for more information).  Run:

    # If you don't have grunt yet installed
    npm install -g grunt-cli

    git clone git@github.com:bgrins/itchpad.git
    cd itchpad
    npm install
    grunt build # Will download addon sdk locally, and generate an itchpad.xpi file

What if I don't want to use grunt?  This just wraps up the addon sdk, so if you have the cfx binary somewhere on your path, you can do whatever you want with it:

    # The -b is optional, but will run with a specified binary (see the [docs](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/cfx#cfx_run))
    cfx run -b /path/to/fx-team/obj-x86_64-apple-darwin12.5.0/dist/NightlyDebug.app/Contents/MacOS/firefox

    cfx xpi # get an xpi and run it in another profile

Once it the browser is running, you can open   `chrome://itchpad/content/itchpad.xul` in the main window - this allows the content to be inspected better than a popup window.

To open in a new window, you can use:

    window.open("chrome://itchpad/content/itchpad.xul","Itchpad","resizable,scrollbars,status");

I also set the [logging level](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/console#Logging_Levels) for extensions so I can see console.logs - extensions.sdk.console.logLevel -> "all".

## To auto run after updates

There are some tools to make the workflow quicker than running `cfx run` or reinstalling the xpi after each change.

Install https://addons.mozilla.org/en-US/firefox/addon/autoinstaller/.   More about this on the [Getting started with cfx page](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Getting_Started_With_cfx).

Then run:

    grunt watch

Now just make changes to the project and it will auto post to the running browser.

If you'd rather use your own cfx, then use:

    cfx xpi
    wget --post-file=itchpad.xpi http://localhost:8888/

Now reload the `chrome://itchpad/content/itchpad.xul` page and it should be running the latest version.
