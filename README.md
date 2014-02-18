
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

## To Run Locally

    git clone git@github.com:bgrins/itchpad.git
    git clone https://github.com/mozilla/addon-sdk.git
    cd itchpad

    # Can be run with either of these
    ../addon-sdk/bin/cfx run # run in fresh profile for testing
    ../addon-sdk/bin/cfx xpi # get an xpi

Once it is running, start Scratchpad from the web developer menu (it currently monkeypatches scratchpad to open itchpad).  Or, you can open   `chrome://itchpad/content/itchpad.xul` in the browser window - this allows the content to be inspected better than the scratchpad window, however it doesn't associate the window with a current page.

I also set the [logging level](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/console#Logging_Levels) for extensions so I can see console.logs - extensions.sdk.console.logLevel -> "all".

## To auto run after updates

There are some tools to make the workflow quicker than running `cfx run` or reinstalling the xpi after each change.

Install https://addons.mozilla.org/en-US/firefox/addon/autoinstaller/.   More about this on the [Getting started with cfx page](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Getting_Started_With_cfx).

Make changes to project, then run:

    ../addon-sdk/bin/cfx xpi ; wget --post-file=itchpad.xpi http://localhost:8888/

Now reload the `chrome://itchpad/content/itchpad.xul` page and it should be running the latest version.

This is automated with the `grunt watch` command.  See the [gruntfile](Gruntfile.js for more information).  Run:

    npm install
    grunt watch
