var fs = require("fs"),
    path = require("path"),
    request = require("request"),
    crypto = require("crypto"),
    url = require("url"),
    Async = require("async"),
    Version = require("./version"),
    Helper = require("./helper");

var techs_json = fs.readFileSync(path.resolve(__dirname, 'techs.json'), 'utf8'); // tech names in techs.json must match tech names in wappalyzer/apps.json
var techs = JSON.parse(techs_json);

/**
 * Tech class
 * scanPlugin, plugin_slug, coreVersion should only be used when scanning a plugin
 */
var Tech = function (techname, scanPlugin, plugin_slug, coreVersion) {
    if (Tech.allTechs.indexOf(techname) === -1) {
        return null;
    }
    this.techname = techname;
    this.scanPlugin = false; // true when scanning plugin version
    if (scanPlugin === true) this.scanPlugin = true;
    this.plugin_slug = plugin_slug; // used when scanning plugin version
    this.coreVersion = coreVersion; // used when scanning plugin version (Drupal)
    this.diffs = []; // diff files cache
    this.versions = this.getAllVersions();
    this.versions_desc = this.versions.slice().reverse();

    this.args = techs[techname];
    this.args.rootLookup = this.args.rootLookup.map(function (value) {
        return new RegExp(value, "g");
    });
    this.args.pluginLookup = this.args.pluginLookup.map(function (value) {
        return new RegExp(value, "g");
    });
    
    this.appRoots = [];
    this.pluginPaths = [];
};

Tech.nonInterpretableTextExtensions = [".html", ".js", ".css", ".xml", ".me", ".txt"]; // un-interpreted plain text file extensions. other extensions such as scripts would return uncomparable content.
Tech.nonInterpretableOtherExtensions = [".png", ".jpg", ".gif", ".ico"]; // un-interpreted non text extensions.

/**
 * Array of techs managed par tech. Names match the ones in appalayzer/apps.json if they exist (case sensitive).
 */
Tech.allTechs = [];
for (var t in techs) {
    if (techs.hasOwnProperty(t)) Tech.allTechs.push(t);
}

Tech.getReqOptions = function (url, options) {
    var ret = {
        url: url,
        timeout: 5000,
        rejectUnauthorized: false,
        requestCert: true,
        agent: false,
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.116 Safari/537.36'
        }
    };
    if (options) {
        for (var opt in options) {
            if (options.hasOwnProperty(opt)) {
                ret[opt] = options[opt];
            }
        }
    }
    return ret;
}

/**
* Converts all CRLF to LF
*/
Tech.crlf2lf = function (data) {
    var converted = new Uint8Array(data.length);
    var j = 0;
    for (var i = 0; i < data.length; i++) {
        if (data[i] == 13 && i < data.length - 1 && data[i + 1] == 10) { // 13 = ascii code of lf, 10 = ascii code of cr
            i++;
        }

        converted[j] = data[i];
        j++;
    }
    var converted_trim = converted.slice(0, j);
    return converted_trim;
}

Tech.prototype = {
    /**
    * Returns a list of possible detected versions. In some cases, multiple versions cannot be distinguished (most often RC versions and release version, etc.
    * E.G. because only a few files differ and these files are interpreted code files which look the same from client side), deepScan() list them all.
    */
    deepScan: function (cb, cb_progress) {
        var highestCommits = this.getHighestCommits();

        var queue = [];
        
        var l = highestCommits.length;
        for (var i = 0; i < l; i++)
        {
            var localPath = highestCommits[i];
            var ext = path.extname(localPath);
            var ext_lower = ext.toLowerCase();

            queue.push({ "path": localPath, "ext": ext, "ext_lower": ext_lower });
        }

        var iter = queue[Symbol.iterator](); // ES6 iterator

        // 1st pass function : try to detect most discriminent files to quickly reduce the number of possible versions to check.
        // most discriminent files are the most commited ones
        var cb_pass1_called = false;
        var n = 0;
        var nMatch = 0;
        var maxVersion = null;
        var minVersion = null;
        var possibleVersions = [];
        var proofs = [];
        var cur_root = 0;
        var o = null;
        var progress = 0;
        const max_tries_pass1 = 30;
        function pass1(_this, cb1) {
            n++;
            if (cur_root === 0) {
                o = iter.next();
                // stop condition : no more entries in queue
                if (!o.value || o.done === true) {
                    if (!cb_pass1_called) {
                        cb_pass1_called = true; cb1(_this, false);
                    }
                    return;
                }

                o = o.value;
            } 

            o.root = _this.appRoots[cur_root];

            // stop condition : enough tries.
            if (n > max_tries_pass1 || nMatch > 3) {
                if (!cb_pass1_called) {
                    cb_pass1_called = true; cb1(_this, false);
                }
                return;
            }

            // stop condition : minVersion == maxVersion
            if (minVersion !== null && maxVersion !== null && minVersion.value == maxVersion.value) {
                if (!cb_pass1_called) {
                    cb_pass1_called = true; cb1(_this, false);
                }
                return;
            }

            cb_progress(50 * (n / max_tries_pass1));

            var _maxVersion = null;
            var _minVersion = null;

            var u = o.root + "/" + o.path;
            request(Tech.getReqOptions(u, { encoding: null }), function d(err, response, body) { // encoding=null to get binary content instead of text
                if (!err
                    && (response.statusCode == 200 || response.statusCode == 206)
                    && body
                    && body.length > 0
                ) {
                    nMatch++;
                    if (Tech.nonInterpretableTextExtensions.indexOf(o.ext_lower) !== -1)
                        body = Tech.crlf2lf(body); // normalize text files eof
                    var md5Web = crypto.createHash('md5').update(body).digest("hex");

                    var p = _this.versions.length;
                    while (p--) {
                        var version = _this.versions[p];
                        var diffs = _this.getDiffFiles(version);
                        var md5 = null;
                        for (var d in diffs) {
                            if (diffs.hasOwnProperty(d)) {
                                var diff = diffs[d];
                                if (diff.path == o.path) {
                                    md5 = diff.md5;
                                    break;
                                }
                            }
                        }
                        if (md5Web === md5) {
                            if (_minVersion === null) {
                                _minVersion = version;
                                _maxVersion = version;
                            }
                            else {
                                if (_minVersion.GT(version)) _minVersion = version;
                                if (version.GT(_maxVersion)) _maxVersion = version;
                            }
                        }
                    }

                    if (_maxVersion != null) {
                        // extend maxVersion up to the newest version (excluded) which holds a commit for the file
                        var stopExtend = false;
                        var p = _this.versions_desc.length;
                        while (p--) {
                            var version = _this.versions_desc[p];
                            if (version.GT(_maxVersion)) {
                                var diffs = _this.getDiffFiles(version);
                                for (var d in diffs) {
                                    if (diffs.hasOwnProperty(d)) {
                                        var diff = diffs[d];
                                        if (diff.path == o.path) stopExtend = true;
                                        if (stopExtend === true) break;
                                    }
                                }

                                if (stopExtend === true) break;
                                else _maxVersion = version;
                            }
                        }
                    }

                    if (_minVersion !== null) {
                        if (minVersion === null) {
                            minVersion = _minVersion;
                            maxVersion = _maxVersion;
                        }
                        else {
                            if (minVersion.GT(_maxVersion)) { // special unexplained non coherent case : widden up versions range to avoid further inconsistencies
                                if (_minVersion.LT(minVersion)) {
                                    minVersion = _minVersion;
                                }
                                if (_maxVersion.GT(maxVersion)) {
                                    maxVersion = _maxVersion;
                                }
                            } else { // narrow down versions range
                                if (_minVersion.GT(minVersion)) {
                                    minVersion = _minVersion;
                                }
                                if (maxVersion.GT(_maxVersion)) {
                                    maxVersion = _maxVersion;
                                }
                            }
                        }

                        // add proof
                        var p = proofs.length;
                        var alreadythere = false;
                        while (p-- && alreadythere === false) {
                            if (o.path == proofs[p].path) alreadythere = true;
                        }
                        if (!alreadythere) {
                            // add diff as a proof
                            var diffs = _this.getDiffFiles(_minVersion);
                            var i = diffs.length;
                            while (i--) {
                                var diff = diffs[i];
                                diff.root = o.root;
                                if (diff.path == o.path) {
                                    proofs.push(diff);
                                    break;
                                }
                            }
                        }
                    }
                    cur_root = 0;
                    pass1(_this, cb1, cur_root);// next with 1st root
                } else {
                    cur_root++;
                    if (cur_root >= _this.appRoots.length) cur_root = 0;
                    pass1(_this, cb1, cur_root);// same with another root
                }
            });
        }
        var cb_called = false;
        var versions_subset = [];
        var iter_versions = this.versions_desc[Symbol.iterator](); // ES6 iterator
        var found_version = false;
        function pass2(_this, check_non_release_versions) {
            // stop condition : !minVersion and !maxVersion (pass1 failed) or minVersion == maxVersion
            if ((!minVersion && !maxVersion) || minVersion.value == maxVersion.value) {
                if (!cb_called) {
                    cb_called = true;
                    if (minVersion)
                        cb(null, { "status": "success", "versions": [minVersion.value], "proofs": proofs });
                    else 
                        cb(null, { "status": "fail", "versions": [], "proofs": proofs });
                }
                return;
            }

            // stop condition : version was found
            if (found_version === true) {
                if (!cb_called) {
                    cb_called = true;
                    //_this.checkMissedVersions(possibleVersions, proofs, cb);
                    cb_called = true; cb(null, { "status": "success", "versions": possibleVersions, "proofs": proofs });
                }
                return;
            }

            o = iter_versions.next();
            cb_progress(50 + 50 * (n / versions_subset.length));
            n++;

            // stop condition : no more versions to test = failure
            if (!o.value || o.done === true) {
                // if (check_non_release_versions === false) {
                //    iter_versions = _this.versions_desc[Symbol.iterator](); // we need a new iterator to loop again from beginning
                //     pass2(_this, true);
                // } else {
                if (!cb_called) {
                    cb_called = true; cb(null, { "status": "fail", "versions": [], "proofs": [] });
                }
                // }
                return;
            }

            var version = o.value;

            var isRelease = version.isReleaseVersion();
            _this.isVersionOrNewer(version, function (err, result, _proofs) {
                if (result == "maybe") {
                    if (possibleVersions.indexOf(version.value) === -1) possibleVersions.push(version.value);
                } else if (result == "success") {
                    possibleVersions.push(version.value);
                    var _p = _proofs.length;
                    while (_p--) {
                        var _proof = _proofs[_p];
                        var p = proofs.length;
                        var alreadythere = false;
                        while (p-- && alreadythere === false) {
                            if (_proof.path == proofs[p].path) alreadythere = true;
                        }
                        if (!alreadythere) proofs.push(_proof);
                    }
                    found_version = true;
                } else {
                    // any version that was still possible is not anymore
                    possibleVersions.length = 0; // clear array
                    proofs.length = 0;
                }

                pass2(_this, check_non_release_versions);
            });
        }
        
        pass1(this, function (_this, check_non_release_versions) {
            for (var i = 0; i < _this.versions_desc.length; i++) {
                var v = _this.versions_desc[i];
                if (v.GTOE(minVersion) && v.LTOE(maxVersion)) {
                    versions_subset.push(v);
                }
            }
            iter_versions = versions_subset[Symbol.iterator](); // ES6 iterator
            n = 0;
            progress = 50;
            
            cb_progress(progress);
            pass2(_this, check_non_release_versions);
        });// chain pass1 and pass2
    },

    /**
     * Helper function for deepScan : in the process of 2nd pass (releae versions) followed by 3rd pass (non release versions), there exists a little possibility some versions are missed. Look for them.
     * @param possibleVersions
     * @param proofs
     * @param cb
     */
    checkMissedVersions(possibleVersions, proofs, cb) {
        var l = this.versions.length;
        var _done = false;
        function f(_this, i) {
            // stop condition : all versions were checked or we're done
            if (i < 0 || _done === true) {
                cb(null, { "status": "success", "versions": possibleVersions, "proofs": proofs });
                return;
            }

            var v = _this.versions[i];
            if (possibleVersions.indexOf(v.value) !== -1) {
                f(_this, i - 1);
            }

            var j = i - 1;
            if (j >= 0) {
                var v2 = _this.versions[j];
                if (possibleVersions.indexOf(v2.value) === -1) {
                    _this.isVersionOrNewer(v2, function (err, result, _proofs) {
                        if (result == "maybe") {
                            possibleVersions.push(v2.value);
                        } else {
                            _done = true;// match an older erroneous version
                        }
                        f(_this, i - 1);
                    });
                    return;
                }
            }
            f(_this, i - 1);
        }
        f(this, l - 1);
    },

    /**
     * Returns a list of all files that ever existe in the history of versions of the app.
     * Files are sorted in descending order according to the number of commits they had in the history of versions of the application.
     * @param limit Nth higher number of commits
     */
    getHighestCommits(limit) {
        limit = typeof limit !== 'undefined' ? limit : 999999999;
        var commitsCount = new Object();

        var v = this.versions.length;
        var highestCount = 0;
        while(v--){
            var diffs = this.getDiffFiles(this.versions[v]);
            var i = diffs.length;
            while (i--) {
                var diff = diffs[i];
                if (diff.status == "D") continue;
                var ext = path.extname(diff.path);
                var ext_lower = ext.toLowerCase();
                if (!(Tech.nonInterpretableTextExtensions.indexOf(ext_lower) !== -1 || Tech.nonInterpretableOtherExtensions.indexOf(ext_lower) !== -1)) continue;
                if (commitsCount.hasOwnProperty(diff.path)) {
                    commitsCount[diff.path]++;
                    if (commitsCount[diff.path] > highestCount) {
                        highestCount = commitsCount[diff.path];
                    }
                }
                else commitsCount[diff.path] = 1;
            }
        }

        // sort in descending order
        var commitsCountSortedPaths = [];
        var l = commitsCount.length;
        var currentCount = highestCount + 1;
        var n = 0;
        while (currentCount-- && n < limit) {
            for (var localPath in commitsCount) {
                if (commitsCount.hasOwnProperty(localPath)) {
                    var c = commitsCount[localPath];
                    if (commitsCount[localPath] == currentCount) {
                        commitsCountSortedPaths.push(localPath);
                        n++;
                        if (n >= limit) break;
                    }
                }
            }
        }

        var g = commitsCountSortedPaths.length;

        return commitsCountSortedPaths;
    },

    /**
	* Check if website is in a specific version.
    * Algorithm only relies on files responding HTTP 2xx. As a rule of thumb, non responding files are not reliable because they don't make it possible to
    * distinguish between a file that is really not there on the server and a file that is there but is protected by the server and responds an HTTP error status.
    * Function findRoots must be called before.
    * This function does not ensure we're in a specific version. It is optimized to be used in a descending loop.
    * @param cb should be 'function (err, result, _proofs)'.
    * result is 'fail' if version was not identified
    * result is 'succss' if version was identified
    * result is 'maybe' if we can't tell because no files could be tested : "M" code files only, "D" files only, etc. E.G : WordPress 4.6
	*/
    isVersionOrNewer: function (version, cb) {
        var diffs = this.getDiffFiles(version);
        var proofs = [];
        var path_skip = []; // list of path that were already requested or should be skipped
        var nb_checked = 0;
        var cb_called = false;
        var max_proofs = 1;
        var queue = [];
        var site_uses_soft404 = null; // true if we detected the site uses soft 404 pages
        for (var i in diffs) {
            // clone diffs[i] in a new object
            var o = { "path": diffs[i].path, "md5": diffs[i].md5, "status": diffs[i].status };
            for (var j in this.appRoots) {
                o.root = this.appRoots[j];
                queue.push(o);
            }
        }
        /*
        if (version.value == "4.5.3") {
            var r = 9;
        }
        */
        var iter = queue[Symbol.iterator](); // ES6 iterator

        function f(_this) {
            // stop condition : too many tests already done (= too much time, lots of requests)
            if (proofs.length <= 0 && nb_checked > 50) { 
                if (!cb_called) {
                    cb_called = true; cb(null, "fail", proofs);
                }
                return;
            }

            // stop condition : we have enough proofs
            if (proofs.length >= max_proofs) {
                if (!cb_called) {
                    cb_called = true; cb(null, "success", proofs);
                }
                return;
            }

            var o = iter.next();

            // stop condition : no more entries
            if (!o.value || o.done === true) {
                if (!cb_called) {
                    cb_called = true;
                    if (nb_checked == 0) {
                        cb(null, "maybe", proofs);
                    } else if (proofs.length > 0) {
                        cb(null, "success", proofs);
                    } else {
                        cb(null, "fail", proofs);
                    }
                }
                return;
            }

            var diff = o.value;

            var ext = path.extname(diff.path);
            var ext_lower = ext.toLowerCase();
            var proof_string = diff.status + " " + diff.path;
            if (path_skip.indexOf(proof_string) !== -1) { // if path was already found on a another root, don't look for it anymore
                f(_this);// next
                return;
            }

            // "A" files and "M" files are checked differently.
            // "A" files are checked for their presence. Works with all types of files, including interpreted files such as php or asp witch are never returned by web servers.
            // "M" files are checked for their presence and checksum. Interpreted or code files can't be used here.
            if (diff.status == "A") {
                if (_this.isCommitedInOlderVersions(diff.path, version)) {
                    path_skip.push(proof_string);
                    f(_this);// next
                    return;
                }

                nb_checked++;

                var u = diff.root + "/" + diff.path;
                request(Tech.getReqOptions(u), function d(err, response, body) {
                    if (!err && (response.statusCode == 200 || response.statusCode == 206)) {
                        if (site_uses_soft404 === null) {
                            // test for soft 404 false positive case
                            var u404 = diff.path.substr(0, diff.path.length - ext.length);
                            u404 = diff.root + "/" + u404 + "d894tgd1" + ext; // random non existing url

                            request(Tech.getReqOptions(u404), function d(err2, response2, body2) {
                                if (!err2 && response2.statusCode == 404) {
                                    proofs.push(diff);
                                    path_skip.push(proof_string);
                                    site_uses_soft404 = false;
                                } else if (!err2 && (response2.statusCode == 200 || response2.statusCode == 206)) {
                                    site_uses_soft404 = true;
                                }
                                f(_this);// next
                            });
                            return;
                        } else if (site_uses_soft404 === false) { // we're sure we're not on a soft 404. The file is there
                            proofs.push(diff);
                            path_skip.push(proof_string);
                        }
                    }
                    f(_this);// next
                });
            } else if (diff.status == "M" && (Tech.nonInterpretableTextExtensions.indexOf(ext_lower) !== -1 || Tech.nonInterpretableOtherExtensions.indexOf(ext_lower) !== -1)) {
                if (_this.isExactFileInOlderVersions(diff.path, version)) {// some files may change back an forth between versions
                    path_skip.push(proof_string);
                    f(_this);// next
                    return;
                }

                nb_checked++;

                var u = diff.root + "/" + diff.path;
                request(Tech.getReqOptions(u, { encoding: null }), function d(err, response, body) { // encoding=null to get binary content instead of text
                    if (!err
                        && (response.statusCode == 200 || response.statusCode == 206)
                        && body != null && body != undefined
                        && body.length > 0
                    ) {
                        // no need to test for soft 404 as we do for A files : for M files, we compare page md5 with diff.md5

                        if (Tech.nonInterpretableTextExtensions.indexOf(ext_lower) !== -1)
                            body = Tech.crlf2lf(body); // normalize text files eof
                        var md5 = crypto.createHash('md5').update(body).digest("hex");
                        if (diff.md5 === md5) {
                            proofs.push(diff);
                            path_skip.push(proof_string);  // file found. don't look for it anymore in other roots.
                        } else {
                            if (site_uses_soft404 === null) {
                                // test for soft 404
                                var u404 = diff.path.substr(0, diff.path.length - ext.length);
                                u404 = diff.root + "/" + u404 + "d894tgd1" + ext; // random non existing url

                                request(Tech.getReqOptions(u404), function d(err2, response2, body2) {
                                    if (!err2 && response2.statusCode == 404) {
                                        site_uses_soft404 = false;
                                    } else {
                                        site_uses_soft404 = true;
                                    }
                                    f(_this);// next
                                });
                                return;
                            } else if (site_uses_soft404 === false) {
                                // we're not on an error page : the file exists on the site but is not in the version we're looking for. don't look for it anymore in other roots.
                                path_skip.push(proof_string); 
                            }
                        }
                    }

                    f(_this);// next
                });
            } else {
                f(_this);// next
            }
        }

        f(this);
    },

    /**
	* Find root paths of app.
    * An app may have multiple root path depending on modules : cache, cdn, specific directories, etc.
	*/
    findRoots: function (baseUrl, html) {
        var a = url.parse(baseUrl);

        // add path without query
        var defaultRoot = a.protocol + "//" + a.host + a.pathname; // url without query string
        defaultRoot = Helper.trimChar(defaultRoot, '/');

        // add host
        defaultRoot = a.protocol + "//" + a.host;
        if (this.appRoots.indexOf(defaultRoot) === -1) this.appRoots.push(defaultRoot);

        // find other root urls in html
        for (var i in this.args.rootLookup) {
            var rootLookup = this.args.rootLookup[i];
            var match = rootLookup.exec(html);
            while (match !== null) {
                var uri = match[2];

                if (uri.substring(0, 2) == '//') uri = a.protocol + uri; // some urls start with '//'. we need to add the protocol.

                var uri2 = Helper.trimChar(url.resolve(baseUrl, uri), '/');

                if (this.appRoots.indexOf(uri2) === -1) this.appRoots.push(uri2);

                match = rootLookup.exec(html);
            }
        }

        // find plugins
        for (var i in this.args.pluginLookup) {
            var pluginLookup = this.args.pluginLookup[i];
            var match = pluginLookup.exec(html);
            while (match !== null) {
                var uri = match[2];
                if (uri === undefined) uri = a.protocol + '//' + a.host + '/' + match[1];
                uri = uri.replace(/\\\//g, "/");
                if (uri.substring(0, 2) == '//') uri = a.protocol + uri; // some urls start with '//'. we need to add the protocol.

                var uri2 = Helper.trimChar(url.resolve(baseUrl, uri), '/');

                if (this.techname == "WordPress" && uri2.indexOf("/themes") !== -1) { // WP specific : /wp-content/plugins is very probably a sibbling of /wp-content/themes
                    uri2 = uri2.replace("/themes", "/plugins");
                }

                if (this.pluginPaths.indexOf(uri2) == -1) {
                    this.pluginPaths.push(uri2);
                }

                match = pluginLookup.exec(html);
            }
        }

        // plugins default path is set in findPlugins (we need to know CMSyy version)
    },

    setOneRoot: function (rootUrl) {
        this.appRoots = [];
        rootUrl = Helper.trimChar(rootUrl, '/');
        this.appRoots.push(rootUrl);
    },

    /**
	* Returns all known versions from diff files in ascending order
	*/
    getAllVersions: function () {
        try {
            var files;
            if (this.scanPlugin === true) {
                files = fs.readdirSync(__dirname + "/data/" + this.techname + "/plugins/" + this.plugin_slug + "_" + this.coreVersion + ".x");
            } else {
                files = fs.readdirSync(__dirname + "/data/" + this.techname + "/versions");
            }
            var diffFiles = [];
            var j = 0;
            for (i in files) {
                if (path.extname(files[i]) === ".diff") {
                    var v = path.basename(files[i]);
                    var ver = new Version(v.substr(0, v.length - 5));
                    diffFiles[j++] = ver;
                }
            }

            diffFiles.sort(Version.version_compare);
            return diffFiles;
        } catch (e) {
            Helper.die("Unknown tech name \"" + this.techname + "\".");
        }
    },

    /**
    * Returns an array of files that changed in a version.
    * Array elements are  {status, path, md5} objects.
    * status is M for a modified file, D for deleted file, A for added file.
    * path is file name
    * md5 is hash of file in this version (empty for D files)
    */
    getDiffFiles: function (version) {
        if (this.diffs.hasOwnProperty(version.value)) {// is version data in cache ?
            return this.diffs[version.value];
        }
        var ret = [];
        try {
            var data;
            if (this.scanPlugin === true) {
                data = fs.readFileSync(__dirname + "/data/" + this.techname + "/plugins/" + this.plugin_slug + "_" + this.coreVersion + ".x/" + version.value + ".diff", 'utf8');
            } else {
                data = fs.readFileSync(__dirname + "/data/" + this.techname + "/versions/" + version.value + ".diff", 'utf8');
            }
            
            var lines = data.split('\n');
            
            for (var l in lines) {
                if (lines.hasOwnProperty(l)) {
                    var line = lines[l];
                    var parts = line.split('\t');
                    if (parts.length == 3) {
                        var diffline = { "status": parts[0].trim(), "path": parts[1].trim(), "md5": parts[2].trim() };
                    } else if (parts.length == 2) {
                        var diffline = { "status": parts[0].trim(), "path": parts[1].trim(), "md5": "" };
                    }
                    ret.push(diffline);
                }
            }

            // shuffle to avoid starting test loops in the same directory
            // we shuffle with hashes to get reproductible orders. We generate new hashes because D lines don't have any.
            var s = [];
            var s2 = [];
            var k = 0;
            var i = ret.length;
            while (i--) {
                var r = ret[i];
                var ss = crypto.createHash('md5').update(r.path).digest("hex");
                s[ss] = r;
                s2[k++] = ss;
            }
            s2.sort();
            var ret2 = [];
            for (var j = 0; j < s2.length; j++) {
                ret2.push(s[s2[j]]);
            }
            this.diffs[version] = ret2; // add to cache
            return ret2;
        } catch (e) {
            if (this.scanPlugin === true) {
                return [];// empty array
             //   Helper.die("Unknown version '" + version.value + "' for " + this.techname + " plugin '" + this.plugin_slug + "' : could not find '" + version.value + ".diff' file.");
            } else {
                Helper.die("Unknown version '" + version.value + "' for tech '" + this.techname + "' : could not find '" + version.value + ".diff' file.");
            }
        }
    },

    /**
    * Check if the exact same file (byte to byte) had already been commited in an older version.
    */
    isExactFileInOlderVersions: function (localPath, version) {
        var diffs = this.getDiffFiles(version);
        var md5 = null;
        for (var d in diffs) {
            if (diffs.hasOwnProperty(d)) {
                if (diffs[d].path === localPath) {
                    md5 = diffs[d].md5;
                    break;
                }
            }
        }

        if (md5 === null) return false;

        for(var v in this.versions)
        {
            var otherVersion = this.versions[v];
            if (version.GT(otherVersion)) {
                var diffOlder = this.getDiffFiles(otherVersion);
                for(var d in diffOlder)
                {
                    var older = diffOlder[d];
                    if (older.path === localPath && older.md5 === md5) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    /**
    * Check if same file path had already been commited in an older version. 
    */
    isCommitedInOlderVersions: function (localPath, version) {
        if (localPath.substr(0, 1) == '/') localPath = localPath.substr(1);
        for (var i in this.versions_desc) {
            if (this.versions_desc.hasOwnProperty(i)) {
                var otherVersion = this.versions_desc[i];
                if (version.GT(otherVersion)) {
                    var diffFiles = this.getDiffFiles(otherVersion);
                    for (var j in diffFiles) {
                        if (diffFiles.hasOwnProperty(j)) {
                            if (diffFiles[j].path === localPath) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    },

    /**
     * Find plugins of CMS
     */
    findPlugins: function (techVersion, progressCB, doneCB) {
        // check default path
        if (this.pluginPaths.length == 0) {
            if (this.techname == "Drupal" && techVersion.substring(0, 1) === "8") {
                this.pluginPaths.push(this.appRoots[0] + '/modules');
                this.pluginPaths.push(this.appRoots[0] + '/modules/contrib');
                this.pluginPaths.push(this.appRoots[0] + this.args.pluginDefaultPath);
            } else {
                this.pluginPaths.push(this.appRoots[0] + this.args.pluginDefaultPath);
            }
        }

        try {
            if (this.pluginPaths.length < 1) {
                console.log("Could not find " + this.techname + " plugins path. Plugins lookup aborted.");
                return;
            }
            var techname = this.techname;
            var dir = __dirname + "/data/" + this.techname + "/plugins/";
            var cvs_filename = "pluginslist.csv";
            if (techname == "Drupal") {
                var coreVersion = techVersion.substring(0, 1);
                cvs_filename = "pluginslist_" + coreVersion + ".csv";
            }

            // read CSV file
            var csv_content = fs.readFileSync(dir + cvs_filename, "utf8");
            var lines = csv_content.split(/\r\n|\n/);

            var plugins = [];
            var pluginsTxt = {};
            var l = lines.length;
            for (var i = 0; i < l; i++) {
                var line = lines[i];
                var els = line.split('\t');
                var a = line.length;
                if (line.length == 0) continue;// empty line
                if (els.length != 2) {
                    console.log("Bad syntax at line " + (i + 1) + " in " + dir + cvs_filename + " : \"" + line + "\". Line was skipped.");
                    continue;
                }
                var slug = els[0];
                var prettyText = els[1];
                plugins.push(slug);
                pluginsTxt[slug] = prettyText;
            }

            var l = plugins.length * this.pluginPaths.length;
            var detected_plugins = [];
            var detected_plugins_version = {};
            var detected_plugins_data = [];
            var n = 0;
            var regexWPplugin = RegExp("Stable tag: ([a-zA-Z0-9_\.\#\-]+)");
            var startTime = new Date().getTime();

            //function fn(pluginsPath, cb) {
              //  Async.eachLimit(plugins, 6, function (plugin_slug, callback) { // test all known plugins
            function fn2(pluginsPath, plugin_slug, callback) {
                    if (detected_plugins.indexOf(plugin_slug) === -1) {
                        var url_plugin_testfile = "";

                        if (techname == "WordPress") {
                            url_plugin_testfile = pluginsPath + "/" + plugin_slug + "/readme.txt";
                            request(Tech.getReqOptions(url_plugin_testfile, { encoding: null }), function d(err, response, body_bytearray) {
                                n++;
                                try {
                                    if (!err) {
                                        if (response.statusCode === 200) {
                                            body_bytearray = Tech.crlf2lf(body_bytearray); // normalize text files eof
                                            var body_buf = Buffer.from(body_bytearray);
                                            var body = body_buf.toString('utf8');
                                            var match = regexWPplugin.exec(body);
                                            if (match && match.length > 1) {
                                                var version = match[1];
                                                detected_plugins.push(plugin_slug);
                                                detected_plugins_version[plugin_slug] = version;

                                                var app_data = {};
                                                var jsonFilePath = dir + plugin_slug + ".json";
                                                if (fs.existsSync(jsonFilePath)) { // file must exist
                                                    var json_content = fs.readFileSync(jsonFilePath, "utf8");
                                                    app_data = JSON.parse(json_content);
                                                    app_data.version = detected_plugins_version[plugin_slug];

                                                    console.log(n + "-" + detected_plugins_data.length + " : " + plugin_slug + " " + app_data.version + " (last version : " + app_data.latest_version + ")");
                                                    detected_plugins_data.push(app_data);
                                                } else {
                                                    console.log("Error : could not find '" + plugin_slug + ".json' file. Plugin '" + plugin_slug + "' will not be looked for.");
                                                }
                                            }
                                        }
                                    }

                                    var t = new Date().getTime();
                                    var dt = t - startTime;
                                    if (t - startTime > 500) { // notify progress every 500 ms
                                        var progress = 100 * n / l;
                                        progressCB(detected_plugins_data, progress);
                                        startTime = t;
                                    }

                                    callback(null);// next
                                } catch (e) {
                                    console.log(e);
                                    callback(null);// do nothing, go next
                                }
                            });
                        } else if (techname == "Drupal") {
                            url_plugin_testfile = pluginsPath + "/" + plugin_slug + "/" + plugin_slug + ".info";
                            if (coreVersion === "8") {
                                url_plugin_testfile = pluginsPath + "/" + plugin_slug + "/" + plugin_slug + ".info.yml";
                            }
                           /* var tech_tmp = new Tech(techname, true, plugin_slug, coreVersion);
                            var allVersions = tech_tmp.getAllVersions();
                            var done = false;
                            for (var v in allVersions) {
                                var vers = allVersions[v];
                                var a = tech_tmp.getDiffFiles(vers);
                                for (var f in a) {
                                    var ff = a[f];
                                    var p = ff.path;
                                    if (p.endsWith(".js") || p.endsWith(".css")) {
                                        url_plugin_testfile = pluginsPath + "/" + plugin_slug + "/" + p;
                                        done = true;
                                       // console.log(n + " : " + p);
                                        break;
                                    }
                                }
                                if (done === true) break;
                            }*/
                         //   console.log(n + " : " + url_plugin_testfile);
                            request(Tech.getReqOptions(url_plugin_testfile, { encoding: null }), function d(err, response, body_bytearray) {
                                n++;
                                try {
                                    var deepScanLaunched = false;
                                    if (!err) {
                                        if (response.statusCode === 200 || response.statusCode === 403) {
                                            var app_data = {};
                                            var coreVersion = techVersion.substring(0, 1);
                                            var jsonFilePath = dir + plugin_slug + "_" + coreVersion + ".x/" + plugin_slug + ".json";
                                            if (fs.existsSync(jsonFilePath)) {
                                                var json_content = fs.readFileSync(jsonFilePath, "utf8");
                                                app_data = JSON.parse(json_content);

                                                // look for plugin version
                                                var tech = new Tech(techname, true, plugin_slug, coreVersion);
                                                tech.setOneRoot(pluginsPath + "/" + plugin_slug);
                                                deepScanLaunched = true;
                                                tech.deepScan(function (err, result) {
                                                    if (result.status === "success") {
                                                        var versions = result.versions;
                                                        var proofs = result.proofs;
                                                        app_data.version = versions[0];
                                                        detected_plugins_data.push(app_data);
                                                        console.log(n + "-" + detected_plugins_data.length + " : " + plugin_slug + " " + app_data.version + " (last version : " + app_data.latest_version + ")");
                                                    }

                                                    var t = new Date().getTime();
                                                    var dt = t - startTime;
                                                    if (t - startTime > 500) { // notify progress every 500 ms
                                                        var progress = 100 * n / l;
                                                        progressCB(detected_plugins_data, progress);
                                                        startTime = t;
                                                    }
                                                    callback(null);// next
                                                }, function progressCB(progress) {
                                                    // do nothing
                                                });
                                            }
                                            else {
                                                console.log("Error : could not find '" + plugin_slug + ".json' file. Plugin '" + plugin_slug + "' will not be looked for.");
                                            }
                                        }
                                    }
                                    if (deepScanLaunched === false) {
                                        var t = new Date().getTime();
                                        var dt = t - startTime;
                                        if (t - startTime > 500) { // notify progress every 500 ms
                                            var progress = 100 * n / l;
                                            progressCB(detected_plugins_data, progress);
                                            startTime = t;
                                        }

                                        callback(null);// next
                                    }
                                } catch (e) {
                                    console.log(e);
                                    callback(null);// do nothing, go next
                                }
                            });
                        }
                    } else {
                        n++;
                    }
            }

            var _this = this;
            Async.eachSeries(plugins, function (plugin_slug, cb1) { // test all known plugins
                Async.someSeries(_this.pluginPaths, function (pluginsPath, cb2) { // test each path until one works
                    fn2(pluginsPath, plugin_slug, function () {
                        if (detected_plugins_data.length > 0) {
                            _this.pluginPaths = [pluginsPath]; // we found modules path. Keep this one only.
                            cb2(null, true); // this path was the good one
                        }
                        else cb2(null, false);
                    });
                }, function done(err) {
                    cb1(null);
                });
            }, function done(err) {
                doneCB(detected_plugins_data);
            });
        } catch (e) {
            Helper.die("Unknown error while looking for \"" + this.techname + "\" plugins. Error was : " + e.message);
        }


    }
};

// export the class
module.exports = Tech;