exports.scan = function (params, callback) {
    var uri = params.url;
    var generateScreenshot = params.generateScreenshot;
    if (typeof params == 'string' || params instanceof String) {
        uri = params;
    }

    var wappalyzer_wrapper = require("./wappalyzer_wrapper");
    var url = require('url');

    var options = {
        url: uri,
        hostname: url.parse(uri).hostname,
        debug: false
    }

    if (generateScreenshot) options.generateScreenshot = generateScreenshot;

    wappalyzer_wrapper.detectFromUrl(options, callback);
}

/*
//url = 'http://whatsbehind.io';
//url = "https://developer.mozilla.org";
//url = "http://drupal.org/";
url = "http://www.starwars.com/"; //hidden WordPress site
//url = "http://wordpress.org/";
//url = "https://www.yahoo.com/";
exports.scan({ url: url, generateScreenshot: true }, function (err, apps) {
    if (apps.status == "complete") {
        console.log(err, apps);
    }
});
*/