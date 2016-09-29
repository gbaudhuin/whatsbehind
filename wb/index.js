exports.scan = function (uri, callback) {
    var wappalyzer_wrapper = require("./wappalyzer_wrapper");
    var url = require('url');

    var options = {
        url: uri,
        hostname: url.parse(uri).hostname,
        debug: false
    }

    var Tech = require("./tech");
    var tech = new Tech("WordPress");

    wappalyzer_wrapper.detectFromUrl(options, callback);
}


//url = 'http://whatsbehind.io';
//url = "https://developer.mozilla.org";
//url = "http://drupal.org/";
url = "http://www.starwars.com/"; //hidden WordPress site
//url = "http://wordpress.org/";
//url = "https://www.yahoo.com/";
//url = "http://www.peoleo.fr";
exports.scan(url, function (err, apps) {
    if (apps.status == "complete") {
        console.log(err, apps);
    }
});
