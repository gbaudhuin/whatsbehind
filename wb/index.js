exports.scan = function (params, callback) {
    var uri = params.url;
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

    wappalyzer_wrapper.detectFromUrl(options, callback);
}

/*
//url = 'http://whatsbehind.io';
//url = "https://developer.mozilla.org";
//url = "http://drupal.org/";
//url = "http://www.starwars.com/"; //hidden WordPress site
url = "http://wordpress.org/";
//url = "https://www.yahoo.com/";
//url = "https://branded7.com";
//url = "http://www.captaincreative.com.au";
//url = 'https://www.google.fr/';
//url = 'http://9gag.com/';
url = 'http://travelportland.com';
exports.scan({ url: url, generateScreenshot: true }, function (err, apps) {
    console.log(apps.status + " " + apps.progress + " : " + apps.detected.length);
    if (apps.status == "complete") {
        console.log(err, apps);
    }
});
*/