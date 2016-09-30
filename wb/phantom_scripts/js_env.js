var args = require('system').args;

if ( args.length < 2) {
    console.log('Url address is required');
    phantom.exit();
}

var webPage = require('webpage');
var page = webPage.create();

page.onConsoleMessage = function(msg) {
  console.log(msg);
};

var viewport_size =
    {
        width: 1200,
        height: 1920
    };

page.open(args[1], function (status) {
    var vars = page.evaluateJavaScript('function(){for(var b in window) {if(window.hasOwnProperty(b)) console.log(b);}}');
    console.log(vars);

    if (args[2]) { // if outpt filename, generate a thumbnail
        page.viewportSize = viewport_size;
        page.clipRect = viewport_size;
        output = args[2];
        page.render(output);
    }

    phantom.exit();
});