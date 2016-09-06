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
    this.versions_desc = this.versions.reverse();
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
    getNumberOfCommits(max) {
        max = typeof max !== 'undefined' ? max : 999999999;
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
        while (currentCount-- && n < max) {
            for (var localPath in commitsCount) {
                if (commitsCount.hasOwnProperty(localPath)) {
                    var c = commitsCount[localPath];
                    if (commitsCount[localPath] == currentCount) {
                        commitsCountSortedPaths.push(localPath);
                        n++;
                        if (n >= max) break;
                    }
                }
            }
        }

        var g = commitsCountSortedPaths.length;

        return commitsCountSortedPaths;
    },

    /**
    * Returns a list of possible detected versions. In some cases, multiple versions cannot be distinguished (most often RC versions and release version, etc.
    * E.G. because only a few files differ and these files are interpreted code files which look the same from client side), getPossibleVersions() list them all.
    */
    getPossibleVersions: function () {
        var commitsCount = this.getNumberOfCommits();
        for (var localPath in commitsCount) {
            if (commitsCount.hasOwnProperty(localPath)) {
                var count = commitsCount[localPath];
            }
        }
    },

    /**
	* Check if website is in a specific version.
    * Algorithm only relies on files responding HTTP 2xx. As a rule of thumb, non responding files are not reliable because they don't make it possible to
    * distinguish between a file that is really not there on the server and a file that is there but is protected by the server and responds an HTTP error status.
    * Function findRoots must be called before.
	*/
    isVersion: function (version, cb) {
        var diffs = this.getDiffFiles(version);
        var proofs = [];
        var proofs_txt = [];
        var nb_checked = 0;
        var cb_called = false;
        var max_proofs = 5;
        var queue = [];
        for (var i in diffs) {
            // clone diffs[i] in a new oject
            var o = { "path": diffs[i].path, "md5": diffs[i].md5, "status": diffs[i].status };
            for (var j in this.appRoots) {
                o.root = this.appRoots[j];
                queue.push(o);
            }
        }
        function f(_this) {
            // stop condition : too many tests already done (= too much time, lots of requests)
            if (proofs.length <= 0 && nb_checked > 10) { 
                if (!cb_called) {
                    cb_called = true; cb(null, proofs);
                }
                return;
            }

            // stop condition : we have enough proofs
            if (proofs.length >= max_proofs) {
                if (!cb_called) {
                    cb_called = true; cb(null, proofs);
                }
                return;
            }

            var diff = queue.pop();

            // stop condition : no more diff
            if (!diff) {
                if (!cb_called) {
                    cb_called = true; cb(null, proofs);
                }
                return;
            }

            var ext = path.extname(diff.path);
            var ext_lower = ext.toLowerCase();
            var proof_string = diff.status + " " + diff.path;
            if (proofs_txt.indexOf(proof_string) !== -1) { // if path was already found on a another root, don't look for it anymore
                f(_this);// next
                return;
            }

            if (diff.status == "A") {
                if (_this.isCommitedInOlderVersions(diff.path, version)) {
                    f(_this);// next
                    return;
                }

                nb_checked++;

                var u = url.resolve(diff.root, diff.path);
                request({ url: u, timeout: 5000 }, function d(err, response, body) {
                    if (!err && response.statusCode / 100 == 2) {
                        // test for soft 404 false positive case
                        var u404 = diff.path.substr(0, diff.path.length - ext.length);
                        u404 = url.resolve(diff.root, u404 + "d894tgd1" + ext); // random non existant url

                        request({ url: u404, timeout: 5000 }, function d(err2, response2, body2) {
                            if (!err2 && response2.statusCode / 100 !== 2) {
                                proofs.push(diff);
                                proofs_txt.push(proof_string);
                            }
                            f(_this);// next
                        });
                    } else {
                        f(_this);// next
                    }
                });
            } else if (diff.status == "M" && (Tech.nonInterpretableTextExtensions.indexOf(ext_lower !== -1) || Tech.nonInterpretableOtherExtensions.indexOf(ext_lower !== -1))) {
                if (_this.isExactFileInOlderVersions(diff.path, version)) {// some files may change back an forth between versions
                    f(_this);// next
                    return;
                }

                nb_checked++;

                var u = url.resolve(diff.root, diff.path);
                request({ url: u, timeout: 5000, encoding:null }, function d(err, response, body) { // encoding=null to get binary content instead of text
                    if (!err
                        && response.statusCode / 100 == 2
                        && body != null && body != undefined
                        && body.length > 0
                    ) {
                        if (Tech.nonInterpretableTextExtensions.indexOf(ext_lower) !== -1)
                            body = _this.crlf2lf(body); // normalize text files eof
                        var md5 = crypto.createHash('md5').update(body).digest("hex");
                        if (diff.md5 === md5) {
                            proofs.push(diff);
                            proofs_txt.push(proof_string);
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
            if (diffs[d].path === localPath) {
                md5 = diffs[d].md5;
                break;
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