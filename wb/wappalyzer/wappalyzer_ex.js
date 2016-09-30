/**
 * Extended version of Wappalyzer v2
 *
 * Guillaume BAUDHUIN <g.baudhuin@peoleo.fr>
 *
 * Wappalyzer v2 was created by Elbert Alias <elbert@alias.io>
 *
 * License: GPLv3 http://www.gnu.org/licenses/gpl-3.0.txt
 */

var Tech = require('../tech');
var Version = require('../version');
var Async = require('async');

var wappalyzer = (function () {
    //'use strict';

	/**
	 * Application class
	 */
    var Application = function (app, detected) {
        this.app = app;
        this.confidence = {};
        this.confidenceTotal = 0;
        this.detected = Boolean(detected);
        this.excludes = [];
        this.version = '';
        this.versions = [];
        this.cats = [];
        this.icon = '';
        this.website = '',
        this.tech = null ;// Internal. Set if app was detected by Tech.deepScan.
    };

    Application.prototype = {
		/**
		 * Calculate confidence total
		 */
        getConfidence: function () {
            var total = 0, id;

            for (id in this.confidence) {
                total += this.confidence[id];
            }

            return this.confidenceTotal = Math.min(total, 100);
        },

		/**
		 * Resolve version number (find the longest version number that contains all shorter detected version numbers)
		 */
        getVersion: function () {
            var i, resolved;

            if (!this.versions.length) {
                return;
            }

            this.versions.sort(function (a, b) {
                return a.length - b.length;
            });

            resolved = this.versions[0];

            for (i = 1; i < this.versions.length; i++) {
                if (this.versions[i].indexOf(resolved) === -1) {
                    break;
                }

                resolved = this.versions[i];
            }

            return this.version = resolved;
        },

        setDetected: function (pattern, type, value, key) {
            this.detected = true;

            if (type == "file") { // detected by Tech
                for (v in value) {
                    var uri = value.root + "/" + value.url;
                    this.confidence[type + ' ' + uri] = value.status;
                }

                // get most probable version among pattern.version. When type == "file", pattern.version is an array
                var maxVersion = null;
                var l = pattern.version.length;
                while (l--) { // take max release version, unless no release version detected.
                    if (!maxVersion) maxVersion = pattern.version[l];
                    else {
                        var v = pattern.version[l];
                        var v1 = new Version(maxVersion);
                        var v2 = new Version(v);
                        if (v1.isReleaseVersion() === true) {
                            if (v2.isReleaseVersion() === true) {
                                if (v2.GT(v1)) maxVersion = v;
                            }
                        } else {
                            if (v2.isReleaseVersion() === true) {
                                maxVersion = v;
                            } else {
                                if (v2.GT(v1)) maxVersion = v;
                            }
                        }
                    }
                }

                this.version = maxVersion;
                this.versions = pattern.version; // unlike other types, these are _possible_ versions. only one is really there.
            } else {
                this.confidence[type + ' ' + (key ? key + ' ' : '') + pattern.regex] = pattern.confidence ? pattern.confidence : 100;
                if (pattern.version) {// Detect version number
                    var
                        version = pattern.version,
                        matches = pattern.regex.exec(value);

                    if (matches) {
                        matches.forEach(function (match, i) {
                            // Parse ternary operator
                            var ternary = new RegExp('\\\\' + i + '\\?([^:]+):(.*)$').exec(version);

                            if (ternary && ternary.length === 3) {
                                w.log({ match: match, i: i, ternary: ternary });

                                version = version.replace(ternary[0], match ? ternary[1] : ternary[2]);

                                w.log({ version: version });
                            }

                            // Replace back references
                            version = version.replace(new RegExp('\\\\' + i, 'g'), match ? match : '');
                        });

                        if (version && this.versions.indexOf(version) < 0) {
                            this.versions.push(version);
                        }

                        this.getVersion();
                    }
                }
            }
        }
    };

    var Profiler = function () {
        this.regexCount = 0;
        this.startTime = new Date().getTime();
        this.lastTime = new Date().getTime();
        this.slowest = { duration: null, app: '', type: '', pattern: '' };
        this.timedOut = false;
    };

    Profiler.prototype = {
        checkPoint: function (app, type, regex) {
            var duration = new Date().getTime() - this.lastTime;

            if (!this.slowest.duration || duration > this.slowest.duration) {
                this.slowest.duration = duration;
                this.slowest.app = app;
                this.slowest.type = type;
                this.slowest.regex = regex;
            }

            this.regexCount++;

            this.lastTime = new Date().getTime();

            this.timedOut = this.lastTime - this.startTime > 1000;
        }
    };

	/**
	 * Call driver functions
	 */
    var driver = function (func, args) {
        if (typeof w.driver[func] !== 'function') {
            w.log('not implemented: w.driver.' + func, 'warn');

            return;
        }

        if (func !== 'log') {
            w.log('w.driver.' + func);
        }

        return w.driver[func](args);
    };

	/**
	 * Parse apps.json patterns
	 */
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

	/**
	 * Main script
	 */
    var w = {
        apps: {},
        cats: null,
        ping: { hostnames: {} },
        adCache: [],
        detected: {},
        scanDate: new Date(),
        progressSteps: {
            init: { start: 0, end: 1, text: 'Starting up...' },
            fetch: { start: 1, end: 5, text: 'Fetching page content' },
            analyze: { start: 5, end: 10, text: 'Analyzing page content' },
            deepscan: { start: 10, end: 30, text: 'Analyzing website files checksums' },
            plugins: { start: 30, end: 100, text: 'Looking for CMS plugins' },
            complete: { start: 100, end: 100, text: 'Scan complete' }
        },

        config: {
            websiteURL: 'https://wappalyzer.com/',
            twitterURL: 'https://twitter.com/Wappalyzer',
            githubURL: 'https://github.com/AliasIO/Wappalyzer',
        },

		/**
		 * Log messages to console
		 */
        log: function (message, type) {
            if (type === undefined) {
                type = 'debug';
            }

            if (typeof message === 'object') {
                message = JSON.stringify(message);
            }

            driver('log', { message: message, type: type });
        },

		/**
		 * Initialize
		 */
        init: function () {
            w.log('w.init');

            // Checks
            if (w.driver === undefined) {
                w.log('no driver, exiting');

                return;
            }

            // Initialize driver
            driver('init');
        },

        report: function (url, step, in_step_progress) {
            var progress_step = this.progressSteps[step];
            var progress = progress_step.start + (((progress_step.end - progress_step.start) * in_step_progress) / 100);
            var data = [];
            for (app in w.detected[url]) {
                var a = w.detected[url][app];
                var confidences = [];
                for (c in a.confidence) {
                    if (a.confidence.hasOwnProperty(c)) {
                        if (a.confidence[c] == 100) {
                            var parts = c.split(' ');

                            if (parts.length > 1) {
                                var t = parts.shift();
                                var val = parts.join(' ');
                            }
                            confidences.push({ type: t, value: val });
                        }
                    }
                }
                
                var o = { name: app, cats: a.cats, versions: a.versions, confidences: confidences, icon: a.icon, website: a.website };

                if (a.plugins) {
                    var plugins = [];
                    for (var p in a.plugins) {
                        var pIn = a.plugins[p];
                        var pOut = {};
                        pOut.slug = pIn.slug;
                        pOut.name = pIn.name;
                        if (!pOut.name) pOut.name = pOut.slug;
                        pOut.version = pIn.version;
                        pOut.latest_version = pIn.latest_version;
                        pOut.status = "unknown";
                        try {
                            var version = new Version(pIn.version);
                            if (pIn.latest_version) {
                                var latest_version = new Version(pIn.latest_version);
                                if (latest_version.GT(version)) {
                                    pOut.status = "outdated";
                                } else if (latest_version.EQ(version)) {
                                    pOut.status = "uptodate";
                                }
                            }
                        } catch (e) {
                            console.log("Error while creating new Version(\"" + pIn.version + "\") or new Version(\"" + pIn.latest_version + "\") for plugin " + app + "/" + pIn.name + ". See " + pIn.slug + ".json");
                            continue;
                        }

                        if (pIn.vulnerabilities) {
                            var vulns = [];
                            for (var v in pIn.vulnerabilities) {
                                try {
                                    var vuln = pIn.vulnerabilities[v];
                                    var vuln_fixed_in = new Version(vuln.fixed_in);
                                    if (vuln_fixed_in.GT(version)) {
                                        pOut.status = "vulnerable";
                                        vulns.push(vuln);
                                    }
                                } catch (e) {
                                    console.log("Error while creating new Version(\"" + vuln.fixed_in + "\") for vulnerability of plugin " + app + "/" + pIn.name + ". See " + pIn.slug + ".json");
                                    continue;
                                }
                            }
                            if (vulns.length > 0) {
                                pOut.vulnerabilities = vulns;
                            }
                        }

                        plugins.push(pOut);
                    }

                    if (plugins.length > 0) {
                        o.plugins = plugins;
                    }
                }

                data.push(o);
            }
            return { url: url.replace(/\/+$/g, ''), status: step, progress: progress, progressDescription: progress_step.text, scanDate: w.scanDate, lastUpdate: new Date(), detected: data };
        },

        lookForPlugins: function (url, cb) {
            var techs_with_plugins = [];
            var techs_with_plugins_progress = {};
            for (var app in w.detected[url]) {
                if (w.detected[url][app].tech) {
                    techs_with_plugins.push(app);
                }
            }

            if (techs_with_plugins.length > 0) {
                Async.eachSeries(techs_with_plugins, function progressCB(app_name, callback) {
                    var app = w.detected[url][app_name];
                    if (app.tech) {
                        app.tech.findPlugins(function (detected_plugins, plugin_progress) {
                            techs_with_plugins_progress[app_name] = plugin_progress;
                            var progress_allplugins = 0;
                            for (var p in techs_with_plugins_progress) {
                                if (techs_with_plugins_progress.hasOwnProperty(p)) {
                                    progress_allplugins += techs_with_plugins_progress[p];
                                }
                            }
                            app.plugins = detected_plugins;
                            var progress_plugins = (progress_allplugins) / techs_with_plugins.length;
                            driver('displayApps', w.report(url, "plugins", progress_plugins));
                        }, function doneCB(detected_plugins) {
                            app.plugins = detected_plugins;
                            callback(null);
                        });
                    } else callback(null);
                }, function done(err) {
                    cb();
                });
            } else {
                cb();
            }
        },

		/**
		 * Analyze the request
		 */
        analyze: function (hostname, url, data) {
            var
                i, j, app, confidence, type, regexMeta, regexScript, match, content, meta, header, version, id,
                profiler = new Profiler(),
                apps = {},
                excludes = [],
                checkImplies = true;
            
            w.log('w.analyze');

            // Remove hash from URL
            data.url = url = url.split('#')[0];

            if (w.apps === undefined || w.categories === undefined) {
                w.log('apps.json not loaded, check for syntax errors');

                return;
            }

            if (w.detected[url] === undefined) {
                w.detected[url] = {};
            }

            for (app in w.apps) {
                // Exit loop after one second to prevent CPU hogging
                // Remaining patterns will not be evaluated
                /*if (profiler.timedOut) {
                    w.log('Timeout, exiting loop');

                    break;
                }
                */
                apps[app] = w.detected[url] && w.detected[url][app] ? w.detected[url][app] : new Application(app);
                apps[app].cats = w.apps[app].cats;

                for (type in w.apps[app]) {
                    switch (type) {
                        case 'url':
                            parse(w.apps[app][type]).forEach(function (pattern) {
                                if (pattern.regex.test(url)) {
                                    apps[app].setDetected(pattern, type, url);
                                }

                                profiler.checkPoint(app, type, pattern.regex);
                            });

                            break;
                        case 'html':
                            if (typeof data[type] !== 'string' || !data.html) {
                                break;
                            }

                            parse(w.apps[app][type]).forEach(function (pattern) {
                                if (pattern.regex.test(data[type])) {
                                    apps[app].setDetected(pattern, type, data[type]);
                                }

                                profiler.checkPoint(app, type, pattern.regex);
                            });

                            break;
                        case 'script':
                            if (typeof data.html !== 'string' || !data.html) {
                                break;
                            }

                            regexScript = new RegExp('<script[^>]+src=("|\')([^"\']+)', 'ig');

                            parse(w.apps[app][type]).forEach(function (pattern) {
                                while (match = regexScript.exec(data.html)) {
                                    if (pattern.regex.test(match[2])) {
                                        apps[app].setDetected(pattern, type, match[2]);
                                    }
                                }

                                profiler.checkPoint(app, type, pattern.regex);
                            });

                            break;
                        case 'meta':
                            if (typeof data.html !== 'string' || !data.html) {
                                break;
                            }

                            regexMeta = /<meta[^>]+>/ig;

                            while (match = regexMeta.exec(data.html)) {
                                for (meta in w.apps[app][type]) {
                                    profiler.checkPoint(app, type, regexMeta);

                                    if (new RegExp('name=["\']' + meta + '["\']', 'i').test(match)) {
                                        content = match.toString().match(/content=("|')([^"']+)("|')/i);

                                        parse(w.apps[app].meta[meta]).forEach(function (pattern) {
                                            if (content && content.length === 4 && pattern.regex.test(content[2])) {
                                                apps[app].setDetected(pattern, type, content[2], meta);
                                            }

                                            profiler.checkPoint(app, type, pattern.regex);
                                        });
                                    }
                                }
                            }

                            break;
                        case 'headers':
                            if (typeof data[type] !== 'object' || !data[type]) {
                                break;
                            }

                            for (header in w.apps[app].headers) {
                                parse(w.apps[app][type][header]).forEach(function (pattern) {
                                    if (typeof data[type][header.toLowerCase()] === 'string' && pattern.regex.test(data[type][header.toLowerCase()])) {
                                        apps[app].setDetected(pattern, type, data[type][header.toLowerCase()], header);
                                    }

                                    profiler.checkPoint(app, type, pattern.regex);
                                });
                            }

                            break;
                        case 'env':
                            if (typeof data[type] !== 'object' || !data[type]) {
                                break;
                            }

                            parse(w.apps[app][type]).forEach(function (pattern) {
                                for (i in data[type]) {

                                    if (pattern.regex.test(data[type][i])) {
                                        apps[app].setDetected(pattern, type, data[type][i]);
                                    }
                                }

                                profiler.checkPoint(app, type, pattern.regex);
                            });

                            break;
                    }
                }
            }

            w.log('[ profiler ] Tested ' + profiler.regexCount + ' regular expressions in ' + ((new Date().getTime() - profiler.startTime) / 1000) + 's');
            w.log('[ profiler ] Slowest pattern took ' + (profiler.slowest.duration / 1000) + 's: ' + profiler.slowest.app + ' | ' + profiler.slowest.type + ' | ' + profiler.slowest.regex);

            function f() {
                for (app in apps) {
                    if (!apps[app].detected) {
                        delete apps[app];
                    }
                }

                // Exclude app in detected apps only
                for (app in apps) {
                    if (w.apps[app].excludes) {
                        if (typeof w.apps[app].excludes === 'string') {
                            w.apps[app].excludes = [w.apps[app].excludes];
                        }

                        w.apps[app].excludes.forEach(function (excluded) {
                            excludes.push(excluded);
                        });
                    }
                }

                // Remove excluded applications
                for (app in apps) {
                    if (excludes.indexOf(app) !== -1) {
                        delete apps[app];
                    }
                }

                // Implied applications
                // Run several passes as implied apps may imply other apps
                while (checkImplies) {
                    checkImplies = false;

                    for (app in apps) {
                        confidence = apps[app].confidence;

                        if (w.apps[app] && w.apps[app].implies) {
                            // Cast strings to an array
                            if (typeof w.apps[app].implies === 'string') {
                                w.apps[app].implies = [w.apps[app].implies];
                            }

                            w.apps[app].implies.forEach(function (implied) {
                                implied = parse(implied)[0];

                                if (!w.apps[implied.string]) {
                                    w.log('Implied application ' + implied.string + ' does not exist', 'warn');

                                    return;
                                }

                                if (!apps.hasOwnProperty(implied.string)) {
                                    apps[implied.string] = w.detected[url] && w.detected[url][implied.string] ? w.detected[url][implied.string] : new Application(implied.string, true);

                                    checkImplies = true;
                                }

                                // Apply app confidence to implied app
                                for (id in confidence) {
                                    apps[implied.string].confidence[id + ' implied by ' + app] = confidence[id] * (implied.confidence ? implied.confidence / 100 : 1);
                                }

                                // set categories
                                apps[implied.string].cats = w.apps[implied.string].cats;
                            });
                        }
                    }
                }

                w.log(Object.keys(apps).length + ' apps detected: ' + Object.keys(apps).join(', ') + ' on ' + url);

                // Generate definitive list of apps
                w.detected[url] = {};
                for (app in apps) {
                    confidence = apps[app].confidence;
                    version = apps[app].version;

                    // Per URL
                    w.detected[url][app] = apps[app];

                    for (id in confidence) {
                        w.detected[url][app].confidence[id] = confidence[id];
                    }
                }

                var techApps = [];
                for (app in apps) {
                    apps[app].icon = w.apps[app].icon;
                    apps[app].website = w.apps[app].website;
                    if (!apps[app].tech && // no need to deepScan if already done
                        Tech.allTechs.indexOf(app) !== -1) {
                        techApps.push(apps[app]);
                    }
                }

                // use Tech to find or verify versions
                var partial_progress_step_size = 100 / techApps.length;
                var partial_progress_stepped = 0;
                driver('displayApps', w.report(url, "deepscan", 0));
                Async.eachSeries(techApps, function iteratee(app, callback) {
                    var tech = new Tech(app.app);
                    tech.findRoots(url, data.html);
                    tech.deepScan(function (err, result) {
                        if (result.status === "success") {
                            app.setDetected({ "version": result.versions, "regex": ".*" }, "file", result.proofs);
                            apps[app.app].tech = tech;
                        }
                        partial_progress_stepped += partial_progress_step_size;
                        driver('displayApps', w.report(url, "deepscan", partial_progress_stepped));
                        callback(err, result.status === "fail");
                    }, function progressCB(progress) {
                        var p = partial_progress_stepped + ((partial_progress_step_size * progress) / 100);
                        driver('displayApps', w.report(url, "deepscan", p));
                    });
                }, function done(err) {
                    apps = null;
                    data = null;

                    driver('displayApps', w.report(url, "deepscan", 100));

                    w.lookForPlugins(url, function () {
                        driver('displayApps', w.report(url, "complete", 100));
                    });
                });
            }

            // if no baseCMS nor web framework are detected at this point, look for them with a deep scan with Tech
            var baseCMSorFrameworkDetected = false;
            for (app in apps) {
                if (baseCMSorFrameworkDetected == false && apps[app].detected && (
                    apps[app].cats.indexOf(1) !== -1 ||   // 1 : CMS
                    apps[app].cats.indexOf(18) !== -1)) { // 18: web framework
                    baseCMSorFrameworkDetected = true;
                    break;
                }
            }

            // Generate a partial list of detected apps to display to user before deepScan
            for (app in apps) {
                if (!apps[app].detected) continue;
                confidence = apps[app].confidence;
                version = apps[app].version;
                w.detected[url][app] = apps[app];
                w.detected[url][app].icon = w.apps[app].icon;
                w.detected[url][app].website = w.apps[app].website;
                for (id in confidence) {
                    w.detected[url][app].confidence[id] = confidence[id];
                }
            }
            var aaa = w.detected[url].length;

            driver('displayApps', w.report(url, "analyze", 100));
            if (baseCMSorFrameworkDetected === false) {
                driver('displayApps', w.report(url, "deepscan", 0));
                var partial_progress_step_size = 100 / Tech.allTechs.length;
                var partial_progress_stepped = 0;
                Async.everySeries(Tech.allTechs, function iteratee(app, callback) {
                    var tech = new Tech(app);
                    tech.findRoots(url, data.html);
                    tech.deepScan(function (err, result) {
                        var t = app;
                        if (result.status === "success") {
                            apps[app].setDetected({ "version": result.versions, "regex": ".*" }, "file", result.proofs);
                            apps[app].tech = tech;
                        }
                        partial_progress_stepped += partial_progress_step_size;
                        driver('displayApps', w.report(url, "deepscan", partial_progress_stepped));
                        callback(err, result.status === "fail");
                    }, function progressCB(progress) {
                        var p = partial_progress_stepped + (partial_progress_step_size * progress / 100);
                        driver('displayApps', w.report(url, "deepscan", p));
                    });
                }, function done(err, result) {
                    f();
                });
            } else {
                f();
            }
        }
    };

    return w;
})();

// CommonJS package
// See http://wiki.commonjs.org/wiki/CommonJS
if (typeof exports === 'object') {
    exports.wappalyzer = wappalyzer;
}
