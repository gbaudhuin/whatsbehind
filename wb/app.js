var Version = require('./version.js');
var helper = require('./helper.js');

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

//url = 'http://www.peoleo.fr';
//url = "https://developer.mozilla.org";
//url = "http://drupalfr.org/";
url = "http://www.starwars.com/"; //hidden WordPress site
//url = "http://wordpress.org/";

var wappalyzer_wrapper = require("./wappalyzer_wrapper");
var uri = require('url');

var options = {
    url: url,
    hostname: uri.parse(url).hostname,
    debug: false
}

var Tech = require("./tech");
var tech = new Tech("WordPress");
var a = tech.getAllVersions();
var b = tech.getDiffFiles(new Version("2.0"));
wappalyzer_wrapper.detectFromUrl(options, function (err, apps, appInfo) {
    console.log(err, apps, appInfo);
})