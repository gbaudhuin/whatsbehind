/** source code derived from file index.js from npm-wappalyzer module
*/

'use strict';

var request = require('request');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var Tech = require('./tech.js');


exports.detectFromUrl = function (options, cb, generateScreenshot) {
    var url = options.url;

    if (options.debug) {
        console.log('Fetching the page');
    }

    runWappalyzer(options, url, function (err, data_out) {
        cb(null, data_out);
    });
};

function getHTMLFromUrl(url, cb, generateScreenshot) {
    request(Tech.getReqOptions(url, {}), function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var childProcess = require('child_process');
            var phantomjs = require('phantomjs-prebuilt');
            var binPath = phantomjs.path;

            var hash = crypto.createHash("md5");
            hash.update(url);
            var outfilename = hash.digest("hex") + ".jpg";

            var childArgs = [
                path.join(__dirname, 'phantom_scripts/js_env.js'),
                url];
            
            if (generateScreenshot === true) {
                childArgs.push(path.join(__dirname, outfilename));
            }

            childProcess.execFile(binPath, childArgs, function (err, stdout, stderr) {
                var js_env = stdout.split("\n");
                for (var i in js_env) {
                    js_env[i] = js_env[i].trim(); // remove eols
                }

                var data = {
                    html: body,
                    url: response.request.uri.href, // response.request.uri contains the response uri, potentially redirected
                    headers: response.headers,
                    env: js_env
                };
                cb(null, data);
            });
        } else {
            cb(error, null);
        }
    });
}

function getAppsJson(cb) {
    // use original wappalyzer apps.json file. This file needs to be udpated from time to time from https://github.com/AliasIO/Wappalyzer
    fs.readFile(path.resolve(__dirname, 'wappalyzer/apps.json'), 'utf8', function (err, data) {
        if (err) throw err;
        return cb(null, JSON.parse(data));
    });
}

function runWappalyzer(options, url, cb, generateScreenshot) {
    var debug = options.debug || false;

    var wappalyzer = require('./wappalyzer/wappalyzer_ex').wappalyzer;
    getAppsJson(function (err, apps) {
        var w = wappalyzer;

        w.driver = {
            log: function (args) {
                if (debug) {
                    console.log(args.message);
                }
            },

            init: function () {
                w.categories = apps.categories;
                w.apps = apps.apps;
            },
            displayApps: function (data) {
                if (data.progress) data.progress = parseFloat(Math.round(data.progress * 10) / 10).toFixed(1);
                else data.progress = 0;
                cb(null, data);
            },
        };
        w.init();
        w.driver.displayApps(w.report(url, "fetch", 0));
        w.detected = [];
        getHTMLFromUrl(url, function (err, data) {
            if (err || data === null) {
                cb(err, null);
            } else {
                w.driver.displayApps(w.report(url, "analyze", 0));
                w.analyze(options.hostname, data.url, data);
            }
        }, options.generateScreenshot);
    });
}