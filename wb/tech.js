var fs = require("fs"),
    path = require("path"),
    crypto = require("crypto"),
    Version = require("./version"),
    Helper = require("./helper");

/**
 * Tech class
 */
var Tech = function (techname) {
    this.techname = techname;
    this.diffs = []; // diff files cache
    this.versions = this.getAllVersions();
};

Tech.prototype = {
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
    * Array elements are  {status, path, md5} objcts.
    * status is M for a modified file, D for deleted file, A for added file.
    * path is file name
    * md5 is hash of file in this version (empty for D files)
    */
    getDiffFiles: function (version) {
        if (version.value in this.diffs) { // is version data in cache ?
            return this.diffs[version.value];
        }
        var ret = [];
        try {
            var data = fs.readFileSync(__dirname + "/ocassets/" + this.techname + "/versions/" + version.value + ".diff", 'utf8');
            var lines = data.split('\n');
            for (var l in lines) {
                var line = lines[l];
                var parts = line.split('\t');
                if (parts.length == 3) {
                    var diffline = { "status": parts[0].trim(), "path": parts[1].trim(), "md5": parts[2].trim() };
                } else if (parts.length == 2) {
                    var diffline = { "status": parts[0].trim(), "path": parts[1].trim(), "md5": "" };
                } else {
                    console.log(parts.length);
                }
                ret.push(diffline);
            }

            // shuffle to avoid starting test loops in the same directory
            // we shuffle with hashes to get reproductible orders. We generate new hashes because D lines don't have any.
            var s = [];
            var s2 = [];
            var k = 0;
            for (var i in ret) {
                if (ret.hasOwnProperty(i)) {
                    var ss = crypto.createHash('md5').update(ret[i].path).digest("hex");
                    s[ss] = ret[i];
                    s2[k++] = ss;
                }
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
    * Check if same file path had already been commited in an older version. 
    */
    isCommitedInOlderVersions: function (localPath, version) {
        for (var i in this.versions) {
            if (this.versions.hasOwnProperty(i)) {
                var otherVersion = this.versions[i];
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
};

// export the class
module.exports = Tech;