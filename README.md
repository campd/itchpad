
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

    git clone git@github.com:campd/itchpad.git
    git clone https://github.com/mozilla/addon-sdk.git
    cd itchpad
    ../addon-sdk/bin/cfx run # run in fresh profile for testing
    ../addon-sdk/bin/cfx xpi # get an xpi

Once it is running, start Scratchpad from the web developer menu (it currently monkeypatches scratchpad to open itchpad).
