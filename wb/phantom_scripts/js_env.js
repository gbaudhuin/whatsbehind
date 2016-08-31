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

page.open(args[1], function(status) {
  var vars = page.evaluateJavaScript('function(){for(var b in window) {if(window.hasOwnProperty(b)) console.log(b);}}');
  console.log(vars);

  phantom.exit();
  
});