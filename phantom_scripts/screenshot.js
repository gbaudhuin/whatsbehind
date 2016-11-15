/**
 * Captures the full height document even if it's not showing on the screen or captures with the provided range of screen sizes.
 *
 * A basic example for taking a screen shot using phantomjs which is sampled for https://nodejs-dersleri.github.io/
 *
 * usage : phantomjs responsive-screenshot.js {url} [output format] [doClipping]
 *
 * examples >
 *      phantomjs responsive-screenshot.js https://nodejs-dersleri.github.io/
 *      phantomjs responsive-screenshot.js https://nodejs-dersleri.github.io/ pdf
 *      phantomjs responsive-screenshot.js https://nodejs-dersleri.github.io/ true
 *      phantomjs responsive-screenshot.js https://nodejs-dersleri.github.io/ png true
 *
 * @author Salih sagdilek <salihsagdilek@gmail.com>
 */

/**
 * http://phantomjs.org/api/system/property/args.html
 *
 * Queries and returns a list of the command-line arguments.
 * The first one is always the script name, which is then followed by the subsequent arguments.
 */
var args = require('system').args;

/**
 * http://phantomjs.org/api/webpage/
 *
 * Web page api
 */
var page = new WebPage();

if ( args.length < 3) {
    console.log('Url address and Output filename are required');
    phantom.exit();
}

/**
 *  setup url address (second argument);
 */
var urlAddress = args[1].toLowerCase();

/**
 * setup viewports
 */
var viewports = [
    {
        width : 1200,
        height : 1920
    },
];

page.open(urlAddress, function (status) {
    if ( 'success' !== status ) {
        console.log('Unable to load the url address!');
    } else {
        var output, key;

        function render(n) {
            if ( !!n ) {
                key = n - 1;
                page.viewportSize = viewports[key];
                page.clipRect = viewports[key];
                output = args[2];
                console.log('Saving ' + output);
                page.render(output);
                render(key);
            }
        }

        render(viewports.length);
    }
    phantom.exit();
});