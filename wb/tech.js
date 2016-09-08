var fs = require("fs"),
    path = require("path"),
    request = require("request"),
    crypto = require("crypto"),
    url = require("url");
    Version = require("./version"),
    Helper = require("./helper");

/**
 * Tech class
 */
var Tech = function (techname) {
    this.techname = techname;
    this.diffs = []; // diff files cache
    this.versions = this.getAllVersions();
    this.versions_desc = this.versions.slice().reverse();
    this.rootLookup = Tech.rootLookUps[techname];
    this.appRoots = [];
};

Tech.nonInterpretableTextExtensions = [".html", ".js", ".css", ".xml", ".me", ".txt"]; // un-interpreted plain text file extensions. other extensions such as scripts would return uncomparable content.
Tech.nonInterpretableOtherExtensions = [".png", ".jpg", ".gif", ".ico"]; // un-interpreted non text extensions.

var rgxRootUrl = '(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})';
Tech.rootLookUps = {
    "wordpress": [
        new RegExp("(href|src)\\s*=\\s*[\\\"\\']((" + rgxRootUrl + ")?[\\/\\w \\.-]*?)\/wp-content\/(themes|plugins)/", "g"),
        new RegExp("(href|src)\\s*=\\s*[\\\"\\']((" + rgxRootUrl + ")?[\\/\\w \\.-]*?)/wp-includes/", "g"),
        new RegExp("(href|src)\\s*=\\s*[\\\"\\']((" + rgxRootUrl + ")?[\\/\\w \\.-]*?)/wp-admin/", "g")],
    "drupal": [
        new RegExp("(href|src)\\s*=\\s*[\\\"\\']((" + rgxRootUrl + ")?[\\/\\w \\.-]*?)/sites/(all|default)/", "g")]
};

Tech.prototype = {
    /**
    * Returns a list of possible detected versions. In some cases, multiple versions cannot be distinguished (most often RC versions and release version, etc.
    * E.G. because only a few files differ and these files are interpreted code files which look the same from client side), getPossibleVersions() list them all.
    */
    getPossibleVersions: function (cb) {
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
            if (n > 50 || nMatch > 3) {
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

            var _maxVersion = null;
            var _minVersion = null;

            var u = url.resolve(o.root, o.path);
            request({ url: u, timeout: 5000, encoding: null, rejectUnauthorized: false, requestCert: true, agent: false }, function d(err, response, body) { // encoding=null to get binary content instead of text
                if (!err
                    && response.statusCode / 100 == 2
                    && body != null && body != undefined
                    && body.length > 0
                ) {
                    nMatch++;
                    if (Tech.nonInterpretableTextExtensions.indexOf(o.ext_lower) !== -1)
                        body = _this.crlf2lf(body); // normalize text files eof
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
                            if (_minVersion.GT(minVersion)) {
                                minVersion = _minVersion;
                            }
                            if (maxVersion.GT(_maxVersion)) {
                                maxVersion = _maxVersion;
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
        var iter_versions = this.versions_desc[Symbol.iterator](); // ES6 iterator
        var found_version = false;
        function pass2(_this, check_non_release_versions) {
            // stop condition : minVersion == maxVersion
            if (minVersion !== null && maxVersion !== null && minVersion.value == maxVersion.value) {
                if (!cb_called) {
                    cb_called = true; cb(null, { "status":"success", "versions": [minVersion.value], "proofs": proofs });
                }
                return;
            }

            // stop condition : version was found
            if (found_version === true) {
                if (!cb_called) {
                    cb_called = true;
                    _this.checkMissedVersions(possibleVersions, proofs, cb);
                }
                return;
            }

            o = iter_versions.next();

            // stop condition : no more versions to test = failure
            if (!o.value || o.done === true) {
                if (check_non_release_versions === false) {
                    iter_versions = _this.versions_desc[Symbol.iterator](); // we need a new iterator to loop again from beginning
                    pass2(_this, true);
                } else {
                    if (!cb_called) {
                        cb_called = true; cb(null, { "status": "fail", "versions": [], "proofs": [] });
                    }
                }
                return;
            }

            var version = o.value;

            if (version.GTOE(minVersion) && version.LTOE(maxVersion)) {
                var isRelease = version.isReleaseVersion();
                if ((!check_non_release_versions && isRelease) || (check_non_release_versions && !isRelease)) {
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
                } else {
                    pass2(_this, check_non_release_versions);
                }
            } else {
                pass2(_this, check_non_release_versions);
            }            
        }
        
        pass1(this, pass2);// chain pass1 and pass2
    },

    /**
     * Helper function for getPossibleVersions : in the process of 2nd pass (releae versions) followed by 3rd pass (non release versions), there exists a little possibility some versions are missed. Look for them.
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
        var max_proofs = 5;
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

        var iter = queue[Symbol.iterator](); // ES6 iterator

        function f(_this) {
            // stop condition : too many tests already done (= too much time, lots of requests)
            if (proofs.length <= 0 && nb_checked > 10) { 
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
            // "A" files are checked for their presence. Works with all types of files, including interpreted files such as php or asp with by nature are never returned by web servers.
            // "M" files are checked for their presence and checksum. Interpreted or code files can't be used here.
            if (diff.status == "A") {
                if (_this.isCommitedInOlderVersions(diff.path, version)) {
                    path_skip.push(proof_string);
                    f(_this);// next
                    return;
                }

                nb_checked++;

                var u = url.resolve(diff.root, diff.path);
                request({ url: u, timeout: 10000 }, function d(err, response, body) {
                    if (!err && response.statusCode / 100 == 2) {
                        if (site_uses_soft404 === null) {
                            // test for soft 404 false positive case
                            var u404 = diff.path.substr(0, diff.path.length - ext.length);
                            u404 = url.resolve(diff.root, u404 + "d894tgd1" + ext); // random non existing url

                            request({ url: u404, timeout: 5000, rejectUnauthorized: false, requestCert: true, agent: false }, function d(err2, response2, body2) {
                                if (!err2 && response2.statusCode / 100 != 2) {
                                    proofs.push(diff);
                                    path_skip.push(proof_string);
                                    if (response2.statusCode == 404) site_uses_soft404 = false;
                                } else if (!err2 && response2.statusCode / 100 == 2) {
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

                var u = url.resolve(diff.root, diff.path);
                request({ url: u, timeout: 5000, encoding: null, rejectUnauthorized: false, requestCert: true, agent: false }, function d(err, response, body) { // encoding=null to get binary content instead of text
                    if (!err
                        && response.statusCode / 100 == 2
                        && body != null && body != undefined
                        && body.length > 0
                    ) {
                        // no need to test for soft 404 as we do for A files : for M files, we compare page md5 with diff.md5

                        if (Tech.nonInterpretableTextExtensions.indexOf(ext_lower) !== -1)
                            body = _this.crlf2lf(body); // normalize text files eof
                        var md5 = crypto.createHash('md5').update(body).digest("hex");
                        if (diff.md5 === md5) {
                            proofs.push(diff);
                            path_skip.push(proof_string);  // file found. don't look for it anymore in other roots.
                        } else {
                            if (site_uses_soft404 === null) {
                                // test for soft 404
                                var u404 = diff.path.substr(0, diff.path.length - ext.length);
                                u404 = url.resolve(diff.root, u404 + "d894tgd1" + ext); // random non existing url

                                request({ url: u404, timeout: 5000, rejectUnauthorized: false, requestCert: true, agent: false }, function d(err2, response2, body2) {
                                    if (!err2 && response2.statusCode / 100 === 4) {
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
    findRoots: function (baseUrl, html)
    {
        var a = url.parse(baseUrl);

        // add path without query
        var defaultRoot = a.protocol + "//" + a.host + a.pathname; // url without query string
        defaultRoot = Helper.trimChar(defaultRoot, '/');

        // add host
        defaultRoot = a.protocol + "//" + a.host;
        if (this.appRoots.indexOf(defaultRoot) === -1) this.appRoots.push(defaultRoot);

        // find other root urls in html
        for (var i in this.rootLookup) {
            if (this.rootLookup.hasOwnProperty(i)) {
                var rootLookup = this.rootLookup[i];
                var match = rootLookup.exec(html);
                while (match !== null) {
                    var uri = match[2];

                    if (uri.substring(0, 2) == '//') uri = a.protocol + uri; // some urls start with '//'. we need to add the protocol.

                    var uri2 = Helper.trimChar(url.resolve(baseUrl, uri), '/');

                    if (this.appRoots.indexOf(uri2) === -1) this.appRoots.push(uri2);

                    match = rootLookup.exec(html);
                }
            }
        }
    },

    /**
	* Returns all known versions from diff files in ascending order
	*/
    getAllVersions: function () {
        try {
            var files = fs.readdirSync(__dirname + "/ocassets/" + this.techname + "/versions");
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
            Helper.die("Unkown tech name \"" + this.techname + "\".");
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
            var data = fs.readFileSync(__dirname + "/ocassets/" + this.techname + "/versions/" + version.value + ".diff", 'utf8');
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
            Helper.die("Unkown version \"" + version.value + "\" for tech \"" + this.techname + "\" : could not find \"" + version.value + ".diff\" file.");
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
    * Converts all CRLF to LF
    */
    crlf2lf: function (data) {
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
};

// export the class
module.exports = Tech;