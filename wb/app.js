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


var path = require('path');
var childProcess = require('child_process');
var phantomjs = require('phantomjs');
var binPath = phantomjs.path;

url = 'http://www.peoleo.fr';
url = "https://developer.mozilla.org";
//url = "http://drupalfr.org/";
var childArgs = [
    path.join(__dirname, 'phantom_scripts/js_env.js'),
    url
];

childProcess.execFile(binPath, childArgs, function (err, stdout, stderr) {
    var js_env = stdout.split("\n");

    request(url, function (error, response, html) {
        // remove html comments
        html = html.replace(/<!--.*?-->/mg, "");

        var headers = [];
        for (var h in response.headers) {
            if (response.headers.hasOwnProperty(h)) {
                headers[h.toLowerCase()] = response.headers[h];
            }
        }
    
        if (!error) {
            var fs = require('fs');
   
            fs.readFile('./wappalyzer/apps.json', 'utf8', function (err, data) {
                if (err) helper.die("Error reading apps db.");
                var list = JSON.parse(data);
                for (app in list.apps) {
                    for (type in list.apps[app]) {
                        switch (type) {
                            case 'html':
                                parse(list.apps[app][type]).forEach(function (pattern) {
                                    if (pattern.regex.test(html)) {
                                        console.log(app + " detected in html");
                                    }
                                });
                                break;
                            case 'script':
                                regexScript = new RegExp('<script[^>]+src=("|\')([^"\']+)', 'ig');

                                parse(list.apps[app][type]).forEach(function (pattern) {
                                    while (match = regexScript.exec(html)) {
                                        if (pattern.regex.test(match[2])) {
                                            console.log(app + ' detected in <script src="');
                                        }
                                    }
                                });
                                break;
                            case 'meta':
                                regexMeta = /<meta[^>]+>/ig;

                                while (match = regexMeta.exec(html)) {
                                    for (meta in list.apps[app][type]) {
                                        if (new RegExp('name=["\']' + meta + '["\']', 'i').test(match)) {
                                            content = match.toString().match(/content=("|')([^"']+)("|')/i);

                                            parse(list.apps[app].meta[meta]).forEach(function (pattern) {
                                                if (content && content.length === 4 && pattern.regex.test(content[2])) {
                                                    console.log(app + " detected in meta");
                                                }
                                            });
                                        }
                                    }
                                }
                                break;
                            case 'headers':
                                for (header in list.apps[app].headers) {
                                    parse(list.apps[app][type][header]).forEach(function (pattern) {
                                    
                                        if (typeof headers[header.toLowerCase()] === 'string' && pattern.regex.test(headers[header.toLowerCase()])) {
                                            console.log(app + " detected in http headers");
                                        }

                                    });
                                }

                                break;
                            case 'env':
                                parse(list.apps[app][type]).forEach(function (pattern) {
                                    for (i in js_env) {
                                        var jsenv = js_env[i].trim();
                                        if (pattern.regex.test(jsenv)) {
                                            console.log(app + " detected in js env");
                                        }
                                    }
                                });

                                break;
                        }
                    }
                }
                var t = 0;
            });
        }
    })
})