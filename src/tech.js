const fs = require('fs');
const path = require('path');
const request = require('request');
const crypto = require('crypto');
const url = require('url');
const Async = require('async');
const Version = require('./version');
const Helper = require('./helper');

const techsJson = fs.readFileSync(path.resolve(__dirname, 'techs.json'), 'utf8'); // tech names in techs.json must match tech names in wappalyzer/apps.json
const techs = JSON.parse(techsJson);

/**
 * Tech class
 * scanPlugin, pluginSlug, coreVersion should only be used when scanning a plugin
 * @constructor
 * @param {String} techname - techname
 * @param {Boolean} scanPlugin -scanPlugin
 * @param {String} pluginSlug - pluginSlug
 * @param {String} coreVersion - coreVersion
 */
const Tech = function (techname, scanPlugin, pluginSlug, coreVersion) {
  if (Tech.allTechs.indexOf(techname) === -1) {
    return null;
  }
  this.techname = techname;
  this.scanPlugin = false; // true when scanning plugin version
  if (scanPlugin === true) {
    this.scanPlugin = true;
  }
  this.pluginSlug = pluginSlug; // used when scanning plugin version
  this.coreVersion = coreVersion; // used when scanning plugin version (Drupal)
  this.diffs = []; // diff files cache
  this.versions = this.getAllVersions();
  this.versionsDesc = this.versions.slice().reverse();

  this.args = techs[techname];
  this.args.rootLookup = this.args.rootLookup.map(function (value) {
    return new RegExp(value, 'g');
  });
  this.args.pluginLookup = this.args.pluginLookup.map(function (value) {
    return new RegExp(value, 'g');
  });

  this.appRoots = [];
  this.pluginPaths = [];
};

Tech.nonInterpretableTextExtensions = ['.html', '.js', '.css', '.xml', '.me', '.txt']; // un-interpreted plain text file extensions. other extensions such as scripts would return uncomparable content.
Tech.nonInterpretableOtherExtensions = ['.png', '.jpg', '.gif', '.ico']; // un-interpreted non text extensions.

/**
 * Array of techs managed par tech. Names match the ones in appalayzer/apps.json if they exist (case sensitive).
 */
Tech.allTechs = [];
for (var t in techs) {
  if (techs.hasOwnProperty(t)) {
    Tech.allTechs.push(t);
  }
}

Tech.getReqOptions = (url, options) => {
  var ret = {
    url,
    timeout: 5000,
    rejectUnauthorized: false,
    requestCert: true,
    agent: false,
    jar: true, // gère les cookies
    gzip: true,
    strictSSL: false,
    headers: {
      Accept: 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      Connection: 'keep-alive',
      'Cache-Control': 'max-age=0',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.7',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36'
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
};

/**
* Converts all CRLF to LF
* @param {Buffer} data - data
* @returns {Uint8Array} Converted data
*/
Tech.crlf2lf = function (data) {
  var converted = new Uint8Array(data.length);
  var j = 0;
  for (var i = 0; i < data.length; i++) {
    if (data[i] === 13 && i < data.length - 1 && data[i + 1] === 10) { // 13 = ascii code of lf, 10 = ascii code of cr
      i++;
    }

    converted[j] = data[i];
    j++;
  }
  return converted.slice(0, j)
};

Tech.prototype = {
  /**
  * Returns a list of possible detected versions. In some cases, multiple versions cannot be distinguished (most often RC versions and release version, etc.
  * E.G. because only a few files differ and these files are interpreted code files which look the same from client side), deepScan() list them all.
  * @param {Function} cb - callback
  * @param {Function} cbProgress - progress callback
  * @returns {undefined} void
  */
  deepScan: function (cb, cbProgress) {
    const highestCommits = this.getHighestCommits();

    const queue = [];

    const l = highestCommits.length;
    for (let i = 0; i < l; i++) {
      const localPath = highestCommits[i];
      const ext = path.extname(localPath);
      const extLower = ext.toLowerCase();

      queue.push({
        path: localPath,
        ext: ext,
        extLower: extLower }
      );
    }

    var iter = queue[Symbol.iterator](); // ES6 iterator

    // 1st pass function : try to detect most discriminent files to quickly reduce the number of possible versions to check.
    // most discriminent files are the most commited ones
    let cbPass1Called = false;
    let n = 0;
    let nMatch = 0;
    let maxVersion = null;
    let minVersion = null;
    const possibleVersions = [];
    const proofs = [];
    let curRoot = 0;
    let o = null;
    let progress = 0;
    const maxTriesPass1 = 130;
    function pass1(_this, cb1) {
      n++;
      if (curRoot === 0) {
        o = iter.next();
        // stop condition : no more entries in queue
        if (!o.value || o.done === true) {
          if (!cbPass1Called) {
            cbPass1Called = true; cb1(_this, false);
          }
          return;
        }

        o = o.value;
      }

      o.root = _this.appRoots[curRoot];

      // stop condition : enough tries.
      if (n > maxTriesPass1 || nMatch > 3) {
        if (!cbPass1Called) {
          cbPass1Called = true;
          cb1(_this, false);
        }
        return;
      }

      // stop condition : minVersion == maxVersion
      if (minVersion !== null && maxVersion !== null && minVersion.value === maxVersion.value) {
        if (!cbPass1Called) {
          cbPass1Called = true;
          cb1(_this, false);
        }
        return;
      }

      cbProgress(50 * (n / maxTriesPass1));

      var _maxVersion = null;
      var _minVersion = null;

      var u = o.root + '/' + o.path;
      request(Tech.getReqOptions(u, { encoding: null }), function d(err, response, body) { // encoding=null to get binary content instead of text
        if (!err &&
            (response.statusCode === 200 || response.statusCode === 206) &&
            body &&
            body.length > 0
        ) {
          nMatch++;
          if (Tech.nonInterpretableTextExtensions.indexOf(o.extLower) !== -1) {
            body = Tech.crlf2lf(body); // normalize text files eof
          }

          var md5Web = crypto.createHash('md5').update(body).digest('hex');

          var p = _this.versions.length;
          var version, diffs, diff, d;
          while (p--) {
            version = _this.versions[p];
            diffs = _this.getDiffFiles(version);
            var md5 = null;
            for (d in diffs) {
              if (diffs.hasOwnProperty(d)) {
                diff = diffs[d];
                if (diff.path === o.path) {
                  md5 = diff.md5;
                  break;
                }
              }
            }
            if (md5Web === md5) {
              if (_minVersion === null) {
                _minVersion = version;
                _maxVersion = version;
              } else {
                if (_minVersion.GT(version)) {
                  _minVersion = version;
                }
                if (version.GT(_maxVersion)) {
                  _maxVersion = version;
                }
              }
            }
          }

          if (_maxVersion !== null) {
            // extend maxVersion up to the newest version (excluded) which holds a commit for the file
            var stopExtend = false;
            var p2 = _this.versionsDesc.length;
            while (p2--) {
              version = _this.versionsDesc[p2];
              if (version.GT(_maxVersion)) {
                diffs = _this.getDiffFiles(version);
                for (d in diffs) {
                  if (diffs.hasOwnProperty(d)) {
                    diff = diffs[d];
                    if (diff.path === o.path) {
                      stopExtend = true;
                    }
                    if (stopExtend === true) {
                      break;
                    }
                  }
                }

                if (stopExtend === true) {
                  break;
                } else {
                  _maxVersion = version;
                }
              }
            }
          }

          if (_minVersion !== null) {
            if (minVersion === null) {
              minVersion = _minVersion;
              maxVersion = _maxVersion;
            } else {
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
            p = proofs.length;
            var alreadythere = false;
            while (p-- && alreadythere === false) {
              if (o.path === proofs[p].path) {
                alreadythere = true;
              }
            }
            if (!alreadythere) {
              // add diff as a proof
              diffs = _this.getDiffFiles(_minVersion);
              var i = diffs.length;
              while (i--) {
                diff = diffs[i];
                diff.root = o.root;
                if (diff.path === o.path) {
                  proofs.push(diff);
                  break;
                }
              }
            }
          }
          curRoot = 0;
          pass1(_this, cb1, curRoot);// next with 1st root
        } else {
          curRoot++;
          if (curRoot >= _this.appRoots.length) {
            curRoot = 0;
          }
          pass1(_this, cb1, curRoot);// same with another root
        }
      });
    }

    var cbCalled = false;
    var versionsSubset = [];
    var iterVersions = this.versionsDesc[Symbol.iterator](); // ES6 iterator
    var foundVersion = false;
    function pass2(_this, checkNonReleaseVersions) {
      // stop condition : !minVersion and !maxVersion (pass1 failed) or minVersion == maxVersion
      if ((!minVersion && !maxVersion) || minVersion.value === maxVersion.value) {
        if (!cbCalled) {
          cbCalled = true;
          if (minVersion) {
            cb(null, { status: 'success', versions: [minVersion.value], proofs });
          } else {
            cb(null, { status: 'fail', versions: [], proofs });
          }
        }
        return;
      }

      // stop condition : version was found
      if (foundVersion === true) {
        if (!cbCalled) {
          cbCalled = true;
          cb(null, { status: 'success', versions: possibleVersions, proofs });
        }
        return;
      }

      o = iterVersions.next();
      cbProgress(50 + 50 * (n / versionsSubset.length));
      n++;

      // stop condition : no more versions to test = failure
      if (!o.value || o.done === true) {
        // if (checkNonReleaseVersions === false) {
        //    iterVersions = _this.versionsDesc[Symbol.iterator](); // we need a new iterator to loop again from beginning
        //     pass2(_this, true);
        // } else {
        if (!cbCalled) {
          cbCalled = true; cb(null, { status: 'fail', versions: [], proofs: [] });
        }
        // }
        return;
      }

      var version = o.value;
      _this.isVersionOrNewer(version, function (err, result, _proofs) {
        if (result === 'maybe') {
          if (possibleVersions.indexOf(version.value) === -1) {
            possibleVersions.push(version.value);
          }
        } else if (result === 'success') {
          possibleVersions.push(version.value);
          var _p = _proofs.length;
          while (_p--) {
            var _proof = _proofs[_p];
            var p = proofs.length;
            var alreadythere = false;
            while (p-- && alreadythere === false) {
              if (_proof.path === proofs[p].path) {
                alreadythere = true;
              }
            }
            if (!alreadythere) {
              proofs.push(_proof);
            }
          }
          foundVersion = true;
        } else {
          // any version that was still possible is not anymore
          possibleVersions.length = 0; // clear array
          proofs.length = 0;
        }

        pass2(_this, checkNonReleaseVersions);
      });
    }

    pass1(this, function (_this, checkNonReleaseVersions) {
      for (var i = 0; i < _this.versionsDesc.length; i++) {
        var v = _this.versionsDesc[i];
        if (v.GTOE(minVersion) && v.LTOE(maxVersion)) {
          versionsSubset.push(v);
        }
      }
      iterVersions = versionsSubset[Symbol.iterator](); // ES6 iterator
      n = 0;
      progress = 50;

      cbProgress(progress);
      pass2(_this, checkNonReleaseVersions);
    });// chain pass1 and pass2
  },

  /**
   * Returns a list of all files that ever existe in the history of versions of the app.
   * Files are sorted in descending order according to the number of commits they had in the history of versions of the application.
   * @param {Number} limit Nth higher number of commits
   * @returns {Array<String>} All files that ever existe in the history of versions of the app.
   */
  getHighestCommits(limit) {
    limit = typeof limit !== 'undefined' ? limit : 999999999;
    var commitsCount = {};

    var v = this.versions.length;
    var highestCount = 0;
    while (v--) {
      var diffs = this.getDiffFiles(this.versions[v]);
      var i = diffs.length;
      while (i--) {
        var diff = diffs[i];
        if (diff.status === 'D') {
          continue;
        }
        var ext = path.extname(diff.path);
        var extLower = ext.toLowerCase();
        if (!(Tech.nonInterpretableTextExtensions.indexOf(extLower) !== -1 || Tech.nonInterpretableOtherExtensions.indexOf(extLower) !== -1)) {
          continue;
        }
        if (commitsCount.hasOwnProperty(diff.path)) {
          commitsCount[diff.path]++;
          if (commitsCount[diff.path] > highestCount) {
            highestCount = commitsCount[diff.path];
          }
        } else {
          commitsCount[diff.path] = 1;
        }
      }
    }

    // sort in descending order
    var commitsCountSortedPaths = [];
    var currentCount = highestCount + 1;
    var n = 0;
    while (currentCount-- && n < limit) {
      for (var localPath in commitsCount) {
        if (commitsCount.hasOwnProperty(localPath)) {
          if (commitsCount[localPath] === currentCount) {
            commitsCountSortedPaths.push(localPath);
            n++;
            if (n >= limit) {
              break;
            }
          }
        }
      }
    }

    return commitsCountSortedPaths;
  },

  /**
  * Check if website is in a specific version.
  * Algorithm only relies on files responding HTTP 2xx. As a rule of thumb, non responding files are not reliable because they don't make it possible to
  * distinguish between a file that is really not there on the server and a file that is there but is protected by the server and responds an HTTP error status.
  * Function findRoots must be called before.
  * This function does not ensure we're in a specific version. It is optimized to be used in a descending loop.
  * @param {String} version - version
  * @param {Function} cb - should be 'function (err, result, _proofs)'.
  * @return {String} 'fail' / 'success' / 'maybe'
  * result is 'fail' if version was not identified
  * result is 'succss' if version was identified
  * result is 'maybe' if we can't tell because no files could be tested : "M" code files only, "D" files only, etc.
  */
  isVersionOrNewer: function (version, cb) {
    var diffs = this.getDiffFiles(version);
    var proofs = [];
    var pathSkip = []; // list of path that were already requested or should be skipped
    var nbChecked = 0;
    var cbCalled = false;
    var maxProofs = 1;
    var queue = [];
    var siteUsesSoft404 = null; // true if we detected the site uses soft 404 pages
    for (var i in diffs) {
      if (diffs.hasOwnProperty(i)) {
        for (var j in this.appRoots) {
          if (this.appRoots.hasOwnProperty(j)) {
            // clone diffs[i] in a new object
            var o = { path: diffs[i].path, md5: diffs[i].md5, status: diffs[i].status };
            if (this.appRoots.hasOwnProperty(j)) {
              o.root = this.appRoots[j];
              queue.push(o);
            }
          }
        }
      }
    }

    var iter = queue[Symbol.iterator](); // ES6 iterator

    function f(_this) {
      // stop condition : too many tests already done (= too much time, lots of requests)
      if (proofs.length <= 0 && nbChecked > 50) {
        if (!cbCalled) {
          cbCalled = true; cb(null, 'fail', proofs);
        }
        return;
      }

      // stop condition : we have enough proofs
      if (proofs.length >= maxProofs) {
        if (!cbCalled) {
          cbCalled = true; cb(null, 'success', proofs);
        }
        return;
      }

      var o = iter.next();

      // stop condition : no more entries
      if (!o.value || o.done === true) {
        if (!cbCalled) {
          cbCalled = true;
          if (nbChecked === 0) {
            cb(null, 'maybe', proofs);
          } else if (proofs.length > 0) {
            cb(null, 'success', proofs);
          } else {
            cb(null, 'fail', proofs);
          }
        }
        return;
      }

      var diff = o.value;

      var ext = path.extname(diff.path);
      var extLower = ext.toLowerCase();
      var proofString = diff.status + ' ' + diff.path;
      if (pathSkip.indexOf(proofString) !== -1) { // if path was already found on a another root, don't look for it anymore
        f(_this);// next
        return;
      }
      var u;
      // "A" files and "M" files are checked differently.
      // "A" files are checked for their presence. Works with all types of files, including interpreted files such as php or asp witch are never returned by web servers.
      // "M" files are checked for their presence and checksum. Interpreted or code files can't be used here.
      if (diff.status === 'A') {
        if (_this.isCommitedInOlderVersions(diff.path, version)) {
          pathSkip.push(proofString);
          f(_this);// next
          return;
        }

        nbChecked++;

        u = diff.root + '/' + diff.path;
        request(Tech.getReqOptions(u), function d(err, response) {
          if (!err && (response.statusCode === 200 || response.statusCode === 206 || response.statusCode === 403)) {
            if (siteUsesSoft404 === null || response.statusCode === 403) {
              // test for soft 404 false positive case and 403
              // a 403 ressource tells us it is probably there but not accessible. As for soft 404, we need to check if a random file with the same ext in the same dir gives a 404.
              var u404 = diff.path.substr(0, diff.path.length - ext.length);
              u404 = diff.root + '/' + u404 + 'd894tgd1' + ext; // random non existing url

              request(Tech.getReqOptions(u404), function d(err2, response2) {
                if (!err2 && response2.statusCode === 404) {
                  proofs.push(diff);
                  pathSkip.push(proofString);
                  if (response.statusCode !== 403) {
                    siteUsesSoft404 = false;
                  }
                } else if (!err2 && (response2.statusCode === 200 || response2.statusCode === 206 || response.statusCode === 403)) {
                  if (response.statusCode !== 403) {
                    siteUsesSoft404 = true;
                  }
                }
                f(_this);// next
              });
              return;
            } else if (siteUsesSoft404 === false) { // we're sure we're not on a soft 404. The file is there
              proofs.push(diff);
              pathSkip.push(proofString);
            }
          }
          f(_this);// next
        });
      } else if (diff.status === 'M' && (Tech.nonInterpretableTextExtensions.indexOf(extLower) !== -1 || Tech.nonInterpretableOtherExtensions.indexOf(extLower) !== -1)) {
        if (_this.isExactFileInOlderVersions(diff.path, version)) {// some files may change back an forth between versions
          pathSkip.push(proofString);
          f(_this);// next
          return;
        }

        nbChecked++;

        u = diff.root + '/' + diff.path;
        request(Tech.getReqOptions(u, { encoding: null }), function d(err, response, body) { // encoding=null to get binary content instead of text
          if (!err &&
            (response.statusCode === 200 || response.statusCode === 206) &&
            body !== null && body !== undefined &&
            body.length > 0
          ) {
            // no need to test for soft 404 as we do for A files : for M files, we compare page md5 with diff.md5

            if (Tech.nonInterpretableTextExtensions.indexOf(extLower) !== -1) {
              body = Tech.crlf2lf(body); // normalize text files eof
            }
            var md5 = crypto.createHash('md5').update(body).digest('hex');
            if (diff.md5 === md5) {
              proofs.push(diff);
              pathSkip.push(proofString);  // file found. don't look for it anymore in other roots.
            } else {
              if (siteUsesSoft404 === null) {
                // test for soft 404
                var u404 = diff.path.substr(0, diff.path.length - ext.length);
                u404 = diff.root + '/' + u404 + 'd894tgd1' + ext; // random non existing url

                request(Tech.getReqOptions(u404), function d(err2, response2) {
                  if (!err2 && response2.statusCode === 404) {
                    siteUsesSoft404 = false;
                  } else {
                    siteUsesSoft404 = true;
                  }
                  f(_this);// next
                });
                return;
              } else if (siteUsesSoft404 === false) {
                // we're not on an error page : the file exists on the site but is not in the version we're looking for. don't look for it anymore in other roots.
                pathSkip.push(proofString);
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
  * @param {String} baseUrl - baseUrl
  * @param {String} html - html
  * @returns {undefined} void
  */
  findRoots: function (baseUrl, html) {
    var a = url.parse(baseUrl);

    // add path without query
    var defaultRoot = a.protocol + '//' + a.host + a.pathname; // url without query string
    defaultRoot = Helper.trimChar(defaultRoot, '/');

    // add host
    defaultRoot = a.protocol + '//' + a.host;
    if (this.appRoots.indexOf(defaultRoot) === -1) {
      this.appRoots.push(defaultRoot);
    }

    var match, uri, uri2;
    // find other root urls in html
    for (var i in this.args.rootLookup) {
      if (this.args.rootLookup.hasOwnProperty(i)) {
        var rootLookup = this.args.rootLookup[i];
        match = rootLookup.exec(html);
        while (match !== null) {
          uri = match[2];

          if (uri.substring(0, 2) === '//') {
            uri = a.protocol + uri; // some urls start with '//'. we need to add the protocol.
          }
          uri2 = Helper.trimChar(url.resolve(baseUrl, uri), '/');

          if (this.appRoots.indexOf(uri2) === -1) {
            this.appRoots.push(uri2);
          }

          match = rootLookup.exec(html);
        }
      }
    }

    // find plugins
    for (var j in this.args.pluginLookup) {
      if (this.args.pluginLookup.hasOwnProperty(j)) {
        var pluginLookup = this.args.pluginLookup[j];
        match = pluginLookup.exec(html);
        while (match !== null) {
          uri = match[2];
          if (uri === undefined) {
            uri = a.protocol + '//' + a.host + '/' + match[1];
          }
          uri = uri.replace(/\\\//g, '/');
          if (uri.substring(0, 2) === '//') {
            uri = a.protocol + uri; // some urls start with '//'. we need to add the protocol.
          }

          uri2 = Helper.trimChar(url.resolve(baseUrl, uri), '/');

          if (this.techname === 'WordPress' && uri2.indexOf('/themes') !== -1) { // WP specific : /wp-content/plugins is very probably a sibbling of /wp-content/themes
            uri2 = uri2.replace('/themes', '/plugins');
          }

          if (this.pluginPaths.indexOf(uri2) === -1) {
            this.pluginPaths.push(uri2);
          }

          match = pluginLookup.exec(html);
        }
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
  * @returns {undefined} void
  */
  getAllVersions: function () {
    try {
      var files;
      if (this.scanPlugin === true) {
        files = fs.readdirSync(__dirname + '/../data/' + this.techname.toLowerCase() + '/plugins/' + this.pluginSlug + '_' + this.coreVersion + '.x');
      } else {
        files = fs.readdirSync(__dirname + '/../data/' + this.techname.toLowerCase() + '/versions');
      }
      var diffFiles = [];
      var j = 0;
      for (var i in files) {
        if (path.extname(files[i]) === '.diff') {
          var v = path.basename(files[i]);
          var ver = new Version(v.substr(0, v.length - 5));
          diffFiles[j++] = ver;
        }
      }

      diffFiles.sort(Version.version_compare);
      return diffFiles;
    } catch (e) {
      Helper.die('Unknown tech name \"' + this.techname + '\".');
    }
  },

  /**
  * Returns an array of files that changed in a version.
  * Array elements are  {status, path, md5} objects.
  * status is M for a modified file, D for deleted file, A for added file.
  * path is file name
  * md5 is hash of file in this version (empty for D files)
  * @param {String} version - version
  * @returns {Array<String>} files that changed in a version.
  */
  getDiffFiles: function (version) {
    if (this.diffs.hasOwnProperty(version.value)) {// is version data in cache ?
      return this.diffs[version.value];
    }
    var ret = [];
    try {
      var data;
      if (this.scanPlugin === true) {
        data = fs.readFileSync(__dirname + '/../data/' + this.techname.toLowerCase() + '/plugins/' + this.pluginSlug + '_' + this.coreVersion + '.x/' + version.value + '.diff', 'utf8');
      } else {
        data = fs.readFileSync(__dirname + '/../data/' + this.techname.toLowerCase() + '/versions/' + version.value + '.diff', 'utf8');
      }

      var lines = data.split('\n');

      for (var l in lines) {
        if (lines.hasOwnProperty(l)) {
          var line = lines[l];
          var parts = line.split('\t');
          var diffline;
          if (parts.length === 3) {
            diffline = { status: parts[0].trim(), path: parts[1].trim(), md5: parts[2].trim() };
          } else if (parts.length === 2) {
            diffline = { status: parts[0].trim(), path: parts[1].trim(), md5: '' };
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
        var ss = crypto.createHash('md5').update(r.path).digest('hex');
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
        //   Helper.die("Unknown version '" + version.value + "' for " + this.techname + " plugin '" + this.pluginSlug + "' : could not find '" + version.value + ".diff' file.");
      } else {
        Helper.die('Unknown version \'' + version.value + '\' for tech \'' + this.techname + '\' : could not find \'' + version.value + '.diff\' file.');
      }
    }
  },

  /**
  * Check if the exact same file (byte to byte) had already been commited in an older version.
  * @param {String} localPath - localPath
  * @param {String} version - version
  * @returns {Boolean} True if the exact same file (byte to byte) had already been commited in an older version.
  */
  isExactFileInOlderVersions: function (localPath, version) {
    var diffs = this.getDiffFiles(version);
    var md5 = null;
    var d;
    for (d in diffs) {
      if (diffs.hasOwnProperty(d)) {
        if (diffs[d].path === localPath) {
          md5 = diffs[d].md5;
          break;
        }
      }
    }

    if (md5 === null) {
      return false;
    }

    for (var v in this.versions) {
      if (this.versions.hasOwnProperty(v)) {
        var otherVersion = this.versions[v];
        if (version.GT(otherVersion)) {
          var diffOlder = this.getDiffFiles(otherVersion);
          for (d in diffOlder) {
            if (diffOlder.hasOwnProperty(d)) {
              var older = diffOlder[d];
              if (older.path === localPath && older.md5 === md5) {
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
  * Check if same file path had already been commited in an older version.
  * @param {String} localPath - localPath
  * @param {String} version - version
  * @returns {Boolean} True if same file path had already been commited in an older version
  */
  isCommitedInOlderVersions: function (localPath, version) {
    if (localPath.substr(0, 1) === '/') {
      localPath = localPath.substr(1);
    }
    for (var i in this.versionsDesc) {
      if (this.versionsDesc.hasOwnProperty(i)) {
        var otherVersion = this.versionsDesc[i];
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
   * @param {String} techVersion - techVersion
   * @param {Function} progressCB - progressCB
   * @param {Function} doneCB - doneCB
   * @returns {undefined} void
   */
  findPlugins: function (techVersion, progressCB, doneCB) {
    // check default path
    if (this.pluginPaths.length === 0) {
      if (this.techname === 'Drupal' && techVersion.substring(0, 1) === '8') {
        this.pluginPaths.push(this.appRoots[0] + '/modules');
        this.pluginPaths.push(this.appRoots[0] + '/modules/contrib');
        this.pluginPaths.push(this.appRoots[0] + this.args.pluginDefaultPath);
      } else {
        this.pluginPaths.push(this.appRoots[0] + this.args.pluginDefaultPath);
      }
    }

    try {
      if (this.pluginPaths.length < 1) {
        console.log('Could not find ' + this.techname.toLowerCase() + ' plugins path. Plugins lookup aborted.');
        return;
      }
      var techname = this.techname;
      var dir = __dirname + '/../data/' + this.techname.toLowerCase() + '/plugins/';
      var cvsFilename = 'pluginslist.csv';
      if (techname === 'Drupal') {
        var coreVersion = techVersion.substring(0, 1);
        cvsFilename = 'pluginslist_' + coreVersion + '.csv';
      }

      // read CSV file
      var csvContent = fs.readFileSync(dir + cvsFilename, 'utf8');
      var lines = csvContent.split(/\r\n|\n/);

      var plugins = [];
      var pluginsTxt = {};
      var l = lines.length;
      for (var i = 0; i < l; i++) {
        var line = lines[i];
        var els = line.split('\t');
        if (line.length === 0) {
          continue;// empty line
        }
        if (els.length !== 2) {
          console.log('Bad syntax at line ' + (i + 1) + ' in ' + dir + cvsFilename + ' : "' + line + '". Line was skipped.');
          continue;
        }
        var slug = els[0];
        var prettyText = els[1];
        plugins.push(slug);
        pluginsTxt[slug] = prettyText;
      }

      l = plugins.length * this.pluginPaths.length;
      var detectedPlugins = [];
      var detectedPluginsVersion = {};
      var detectedPluginsData = [];
      var n = 0;
      var regexWPplugin = RegExp('Stable tag: ([a-zA-Z0-9_\.\#\-]+)');
      var startTime = new Date().getTime();

      var fn = (pluginsPath, pluginSlug, callback) => {
        if (detectedPlugins.indexOf(pluginSlug) === -1) {
          var urlPluginTestfile = '';

          if (techname === 'WordPress') {
            urlPluginTestfile = pluginsPath + '/' + pluginSlug + '/readme.txt';
            request(Tech.getReqOptions(urlPluginTestfile, { encoding: null }), (err, response, bodyByteArray) => {
              n++;
              try {
                if (!err) {
                  if (response.statusCode === 200) {
                    bodyByteArray = Tech.crlf2lf(bodyByteArray); // normalize text files eof
                    var bodyBuf = Buffer.from(bodyByteArray);
                    var body = bodyBuf.toString('utf8');
                    var match = regexWPplugin.exec(body);
                    if (match && match.length > 1) {
                      var version = match[1];
                      detectedPlugins.push(pluginSlug);
                      detectedPluginsVersion[pluginSlug] = version;

                      var appData = {};
                      var jsonFilePath = dir + pluginSlug + '.json';
                      if (fs.existsSync(jsonFilePath)) { // file must exist
                        var jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
                        appData = JSON.parse(jsonContent);
                        appData.version = detectedPluginsVersion[pluginSlug];

                        console.log(n + '-' + detectedPluginsData.length + ' : ' + pluginSlug + ' ' + appData.version + ' (last version : ' + appData.latest_version + ')');
                        let pluginFormatted = this.formatPluginOutput(appData)
                        detectedPluginsData.push(pluginFormatted)
                      } else {
                        console.log('Error : could not find \'' + pluginSlug + '.json\' file. Plugin \'' + pluginSlug + '\' will not be looked for.');
                      }
                    }
                  }
                }

                var t = new Date().getTime();
                if (t - startTime > 500) { // notify progress every 500 ms
                  var progress = 100 * n / l;
                  progressCB(detectedPluginsData, progress);
                  startTime = t;
                }

                callback(null);// next
              } catch (e) {
                console.log(e);
                callback(null);// do nothing, go next
              }
            });
          } else if (techname === 'Drupal') {
            urlPluginTestfile = pluginsPath + '/' + pluginSlug + '/' + pluginSlug + '.info';
            if (coreVersion === '8') {
              urlPluginTestfile = pluginsPath + '/' + pluginSlug + '/' + pluginSlug + '.info.yml';
            }

            request(Tech.getReqOptions(urlPluginTestfile, { encoding: null }), (err, response) => {
              n++;
              try {
                var deepScanLaunched = false;
                if (!err) {
                  if (response.statusCode === 200 || response.statusCode === 403) {
                    var appData = {};
                    var coreVersion = techVersion.substring(0, 1);
                    var jsonFilePath = dir + pluginSlug + '_' + coreVersion + '.x/' + pluginSlug + '.json';
                    if (fs.existsSync(jsonFilePath)) {
                      var jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
                      appData = JSON.parse(jsonContent);

                      // look for plugin version
                      var tech = new Tech(techname, true, pluginSlug, coreVersion);
                      tech.setOneRoot(pluginsPath + '/' + pluginSlug);
                      deepScanLaunched = true;
                      tech.deepScan((err, result) => {
                        if (result.status === 'success') {
                          var versions = result.versions;
                          appData.version = versions[0];

                          let pluginFormatted = this.formatPluginOutput(appData)
                          detectedPluginsData.push(pluginFormatted)
                          console.log(n + '-' + detectedPluginsData.length + ' : ' + pluginSlug + ' ' + appData.version + ' (last version : ' + appData.latest_version + ')');
                        }

                        var t = new Date().getTime();
                        if (t - startTime > 500) { // notify progress every 500 ms
                          var progress = 100 * n / l;
                          progressCB(detectedPluginsData, progress);
                          startTime = t;
                        }
                        callback(null);// next
                      }, function progressCB() {
                        // do nothing
                      });
                    } else {
                      console.log('Error : could not find \'' + pluginSlug + '.json\' file. Plugin \'' + pluginSlug + '\' will not be looked for.');
                    }
                  }
                }
                if (deepScanLaunched === false) {
                  var t = new Date().getTime();
                  if (t - startTime > 500) { // notify progress every 500 ms
                    var progress = 100 * n / l;
                    progressCB(detectedPluginsData, progress);
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
      };

      //Async.eachLimit(plugins, 20, function (pluginSlug, cb1) { // test all known plugins
      Async.eachSeries(plugins, (pluginSlug, cb1) => { // test all known plugins
        Async.someSeries(this.pluginPaths, (pluginsPath, cb2) => { // test each path until one works
          fn(pluginsPath, pluginSlug, function () {
            if (detectedPluginsData.length > 0) {
              if (this.pluginPaths.length > 1) {
                l = plugins.length + this.pluginPaths.length * Math.floor(n / this.pluginPaths.length);
                this.pluginPaths = [pluginsPath]; // we found modules path. Keep this one only.
              }
              cb2(null, true); // this path was the good one
            } else {
              cb2(null, false);
            }
          });
        }, () => {
          cb1(null);
        });
      }, () => {
        doneCB(detectedPluginsData);
      });
    } catch (e) {
      Helper.die('Unknown error while looking for "' + this.techname + '" plugins. Error was : ' + e.message);
    }
  },

  /**
   * @param {Object} pIn - pIn
   * @returns {Object} output
   */
  formatPluginOutput: function (pIn) {
    let pOut = {};

    pOut.slug = pIn.slug;
    pOut.name = pIn.name;
    if (!pOut.name) {
      pOut.name = pOut.slug;
    }
    pOut.version = pIn.version;
    pOut.latest_version = pIn.latest_version; // eslint-disable-line camelcase
    pOut.status = 'unknown';
    let version;
    try {
      version = new Version(pIn.version)
      if (pIn.latest_version) {
        const latestVersion = new Version(pIn.latest_version)
        if (latestVersion.GT(version)) {
          pOut.status = 'outdated';
        } else if (latestVersion.EQ(version)) {
          pOut.status = 'uptodate';
        }
      }
    } catch (e) {
      console.log('Error while creating new Version("' + pIn.version + '") or new Version("' + pIn.latest_version + '") for plugin ' + pIn.name + '. See ' + pIn.slug + '.json');
      return pOut;
    }

    if (pIn.vulnerabilities) {
      let vulns = [];
      for (let vuln of pIn.vulnerabilities) {
        try {
          const vulnFixedIn = new Version(vuln.fixed_in);
          if (vulnFixedIn.GT(version)) {
            pOut.status = 'vulnerable';
            vulns.push(vuln);
          }
        } catch (e) {
          console.log('Error while creating new Version("' + vuln.fixed_in + '") for vulnerability of plugin ' + pIn.name + '. See ' + pIn.slug + '.json');
          continue
        }
      }
      if (vulns.length > 0) {
        // sort vulns (highest fixing version first)
        vulns.sort((a, b) => {
          return Version.version_compare(a.fixed_in, b.fixed_in);
        }).reverse()
        pOut.vulnerabilities = vulns;
      }
    }

    return pOut
  }
};

// export the class
module.exports = Tech;