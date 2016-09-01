var Version = require('./version.js');
var helper = require('./helper.js');
var v1 = new Version('1.6.5.1rc');
var v2 = new Version('1.6.5.1');
var comp = Version.version_compare(v1, v2);
if (comp === 0) {
    console.log("both versions are null or equal");
}
else if (comp > 0) {
    console.log("v1 > v2");
} else console.log("v1 < v2");

if (v1.isReleaseVersion())
    console.log("release ! ");


var request = require('request');

var parse = function (patterns) {
    var
        attrs,
        parsed = [];

    // Convert single patterns to an array
    if (typeof patterns === 'string') {
        patterns = [patterns];
    }

    patterns.forEach(function (pattern) {
        attrs = {};

        pattern.split('\\;').forEach(function (attr, i) {
            if (i) {
                // Key value pairs
                attr = attr.split(':');

                if (attr.length > 1) {
                    attrs[attr.shift()] = attr.join(':');
                }
            } else {
                attrs.string = attr;

                try {
                    attrs.regex = new RegExp(attr.replace('/', '\/'), 'i'); // Escape slashes in regular expression
                } catch (e) {
                    attrs.regex = new RegExp();

                    w.log(e + ': ' + attr, 'error');
                }
            }
        });

        parsed.push(attrs);
    });

    return parsed;
};

url = 'http://www.peoleo.fr';
//url = "https://developer.mozilla.org";
//url = "http://drupalfr.org/";

var wappalyzer_wrapper = require("./wappalyzer_wrapper");
var uri = require('url');

var options = {
    url: url,
    hostname: uri.parse(url).hostname,
    debug: false
}

wappalyzer_wrapper.detectFromUrl(options, function (err, apps, appInfo) {
    console.log(err, apps, appInfo);
})