var args = require('system').args;

if ( args.length < 2) {
    console.log('Url address is required');
    phantom.exit();
}

var webPage = require('webpage');
var page = webPage.create();

var envs = [];
var pass = 0;
page.onConsoleMessage = function (msg) {
    msg = msg.trim();
    if (msg.length > 0) {
        if (envs.indexOf(msg) == -1) {
            envs.push(msg);
            if (pass === 1) {
                console.log(msg);
            }
        }
    }
};

page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36';
page.settings.javascriptEnabled = true;
page.settings.loadImages = false;
if (args[2]) { // if outpt filename, generate a thumbnail
    page.settings.loadImages = true;
}
page.settings.resourceTimeout = 20000;

// get js document vars before page loading. these vars won't be displayed
page.evaluateJavaScript('function(){for(var b in window) {if(window.hasOwnProperty(b)) console.log(b);}}');

page.open(args[1], function (status) {
    pass = 1;
    // get js document vars a second time, after page loading. New vars (set by js scripts of page) will be displayed.
    page.evaluateJavaScript('function(){for(var b in window) {if(window.hasOwnProperty(b)) console.log(b);}}');

    if (args[2]) { // if outpt filename, generate a thumbnail
        var viewport_size =
        {
            width: 1200,
            height: 1920
        };

        page.viewportSize = viewport_size;
        page.clipRect = viewport_size;
        output = args[2];
        page.render(output);
    }

    phantom.exit();
});