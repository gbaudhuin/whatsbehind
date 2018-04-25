const fs = require('fs');
const path = require('path');
const request = require('request');
const requestPromise = require('request-promise');
const url = require('url');
const Async = require('async');
const Version = require('./version');
const Helper = require('./helper');
const httpRequest = require('./httpRequest');
const httpStatus = require('./httpStatus');
const soft404 = require('./soft404');
const stringHelper = require('./stringHelper');

// un-interpreted plain text file extensions. other extensions such as scripts would return uncomparable content.
const NON_INTERPRETABLE_TEXT_EXTENSIONS = ['.html', '.js', '.css', '.xml', '.me', '.txt'];
// un-interpreted non text extensions.
const NON_INTERPRETABLE_OTHER_EXTENSIONS = ['.png', '.jpg', '.gif', '.ico'];
const NON_INTERPRETABLE_EXTENSIONS = NON_INTERPRETABLE_TEXT_EXTENSIONS.concat(NON_INTERPRETABLE_OTHER_EXTENSIONS);

let allTechs = null;

const techsJson = fs.readFileSync(path.resolve(__dirname, 'techs.json'), 'utf8'); // tech names in techs.json must match tech names in wappalyzer/apps.json
const techs = JSON.parse(techsJson);

allTechs = [];
for (var t in techs) {
  if (techs.hasOwnProperty(t)) {
    allTechs.push(t);
  }
}

/**
 * Tech class
 */
class Tech {
  /**
   * Tech class
   * scanPlugin, pluginSlug, coreVersion should only be used when scanning a plugin
   * @constructor
   * @param {String} techname - techname
   * @param {Boolean} scanPlugin -scanPlugin
   * @param {String} pluginSlug - pluginSlug
   * @param {String} coreVersion - coreVersion
   */
  constructor(techname, scanPlugin, pluginSlug, coreVersion) {
    if (Tech.allTechs.indexOf(techname) === -1) {
      throw new Error('Tech ' + techname + ' does not exist');
    }

    this.websiteSoft404Status = soft404.STATUS.UNKNOWN;

    this.techname = techname;
    this.scanPlugin = false; // true when scanning plugin version
    if (scanPlugin === true) {
      this.scanPlugin = true;
    }
    this.pluginSlug = pluginSlug; // used when scanning plugin version
    this.coreVersion = coreVersion; // used when scanning plugin version (Drupal)
    this.diffs = []; // diff files cache

    this.args = techs[techname];
    this.args.rootLookup = this.args.rootLookup.map(function (value) {
      return new RegExp(value, 'g');
    });
    this.args.pluginLookup = this.args.pluginLookup.map(function (value) {
      return new RegExp(value, 'g');
    });

    this.appRoots = [];
    this.pluginPaths = [];
  }

  /**
   * @summary Return all the techs
   * @returns {Array} all the techs
   */
  static get allTechs() {
    return allTechs;
  }

  /**
   * @summary Load tech versions.
   * @returns {undefined} void
   */
  loadVersions() {
    this.versions = this.getAllVersions();
    this.versionsDesc = this.versions.slice().reverse();
  }

  /**
  * Returns a list of possible detected versions. In some cases, multiple versions cannot be distinguished (most often RC versions and release version, etc.
  * E.G. because only a few files differ and these files are interpreted code files which look the same from client side), deepScan() list them all.
  * @param {Function} cb - callback
  * @param {Function} cbProgress - progress callback
  * @returns {undefined} void
  */
  deepScan(cb, cbProgress) {
    const highestCommits = this.getHighestCommits();

    const queue = Array.from(highestCommits, (localPath) => {
      const ext = path.extname(localPath);
      const extLower = ext.toLowerCase();

      return {
        path: localPath,
        ext,
        extLower
      }
    });

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
      request(httpRequest.getOptions(u, { encoding: null }), function d(err, response, body) { // encoding=null to get binary content instead of text
        if (!err &&
            (response.statusCode === 200 || response.statusCode === 206) &&
            body &&
            body.length > 0
        ) {
          nMatch++;
          if (NON_INTERPRETABLE_TEXT_EXTENSIONS.indexOf(o.extLower) !== -1) {
            body = stringHelper.crlf2lf(body); // normalize text files eof
          }

          var md5Web = stringHelper.md5(body);

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
      _this.isVersionOrNewer(version)
        .then(({status, proofs}) => {
          if (status === 'maybe') {
            if (possibleVersions.indexOf(version.value) === -1) {
              possibleVersions.push(version.value);
            }
          } else if (status === 'success') {
            possibleVersions.push(version.value);
            var _p = proofs.length;
            while (_p--) {
              var _proof = proofs[_p];
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
        })
        .catch((err) => {
          throw err;
        })
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
  }

  /**
   * Returns a list of all files that ever existed in the history of versions of the app.
   * Files are sorted in descending order according to the number of commits they had in the history of versions of the application.
   * @param {Number} [limit] - Nth higher number of commits
   * @returns {Array<String>} All files that ever existed in the history of versions of the app.
   */
  getHighestCommits(limit = 999999999) {
    const commitsCount = {};

    let v = this.versions.length;
    let highestCount = 0;
    while (v--) {
      const diffs = this.getDiffFiles(this.versions[v]);

      // filter the diff
      const filteredDiffs = diffs.filter((diff) => {
        const ext = path.extname(diff.path);
        const extLower = ext.toLowerCase();
        return diff.status !== 'D' && NON_INTERPRETABLE_EXTENSIONS.indexOf(extLower) !== -1;
      })

      // loop
      let i = filteredDiffs.length;
      while (i--) {
        const diff = filteredDiffs[i];

        let count = commitsCount[diff.path] || 0;
        count++;
        highestCount = Math.max(count, highestCount);
        commitsCount[diff.path] = count;
      }
    }

    // convert to array
    const commitsCountArray = [];
    for (const localPath in commitsCount) {
      commitsCountArray.push({localPath, count: commitsCount[localPath]});
    }

    // sort in descending order
    commitsCountArray.sort((element1, element2) => {
      return element2.count - element1.count;
    })

    // limit results
    commitsCountArray.splice(limit);

    // create result array
    const result = Array.from(commitsCountArray, (element) => element.localPath);

    return result;
  }

  /**
   * @typedef {Object} ProofResult
   * @property {String} status - the status ('maybe' or 'success')
   * @property {Array} proofs - the proofs
   */

  /**
  * Check if website is in a specific version.
  * Algorithm only relies on files responding HTTP 2xx. As a rule of thumb, non responding files are not reliable because they don't make it possible to
  * distinguish between a file that is really not there on the server and a file that is there but is protected by the server and responds an HTTP error status.
  * Function findRoots must be called before.
  * This function does not ensure we're in a specific version. It is optimized to be used in a descending loop.
  * @param {String} version - version
  * @param {number} maxProofs - maximum number of proofs
  * @return {Promise<ProofResult>} the status and the proofs
  * result is 'fail' if version was not identified
  * result is 'success' if version was identified
  * result is 'maybe' if we can't tell because no files could be tested : "M" code files only, "D" files only, etc.
  */
  async isVersionOrNewer(version, maxProofs = 1) {
    // clone each diff in a new object
    const diffs = this.getDiffFiles(version);
    const queue = this.cloneDiffs(diffs, this.appRoots);
    const proofs = [];

    const FAIL = 'fail';
    const MAYBE = 'maybe';
    const SUCCESS = 'success';

    const getResult = (status) => {
      return {
        status,
        proofs
      };
    }

    const pathSkip = []; // list of path that were already requested or should be skipped
    let count = 0;
    for (let i = 0; i < queue.length; i++) {
      if (count > 50) {
        return getResult(FAIL);
      }

      if (proofs.length >= maxProofs) {
        return getResult(SUCCESS);
      }

      const diff = queue[i];

      const ext = path.extname(diff.path);
      const extLower = ext.toLowerCase();
      const proofString = diff.status + ' ' + diff.path;

      // if path was already found on a another root, don't look for it anymore
      if (pathSkip.indexOf(proofString) !== -1) {
        continue;
      }

      count++;
      const addProof = await this.checkDiff(proofString, diff, ext, extLower, version, pathSkip);
      if (addProof) {
        pathSkip.push(proofString);
        proofs.push(diff);
      }
    }

    if (count === 0) {
      return getResult(MAYBE);
    }

    if (proofs.length > 0) {
      return getResult(SUCCESS);
    }

    return getResult(FAIL);
  }

  /**
   * @summary Clone diffs
   * @param {Array} diffs - the diffs source
   * @param {Array} appRoots - the appRoots
   * @returns {Array} cloned diffs
   */
  cloneDiffs(diffs, appRoots) {
    const result = [];
    Object.keys(diffs).forEach((diffKey) => {
      Object.keys(appRoots).forEach((appRootKey) => {
        const diff = diffs[diffKey];
        const clonedDiff = {
          path: diff.path,
          md5: diff.md5,
          status: diff.status,
          root: appRoots[appRootKey]
        }
        result.push(clonedDiff);
      })
    })

    return result;
  }

  /**
   * @summary Check a diff
   * @param {String} proofString - the proofString
   * @param {Object} diff - the diff to check
   * @param {String} ext - the ext
   * @param {String} extLower - the ext in lower case
   * @param {String} version - the version to check
   * @param {String[]} pathSkip - the path skip array
   * @returns {Promise<Boolean>} True if the diff is a valid proof
   */
  async checkDiff(proofString, diff, ext, extLower, version, pathSkip) {
    // "A" files and "M" files are checked differently.
    // "A" files are checked for their presence. Works with all types of files, including interpreted files such as php or asp witch are never returned by web servers.
    // "M" files are checked for their presence and checksum. Interpreted or code files can't be used here.
    if (diff.status === 'A') {
      return await this.checkAddedDiff(proofString, diff, ext, extLower, version, pathSkip);
    } else if (diff.status === 'M') {
      return await this.checkModifiedDiff(proofString, diff, ext, extLower, version, pathSkip);
    }

    return false;
  }

  /**
   * @summary Check an added diff
   * @param {String} proofString - the proofString
   * @param {Object} diff - the diff to check
   * @param {String} ext - the ext
   * @param {String} extLower - the ext in lower case
   * @param {String} version - the version to check
   * @param {String[]} pathSkip - the path skip array
   * @returns {Promise<Boolean>} True if the diff is a valid proof
   */
  async checkAddedDiff(proofString, diff, ext, extLower, version, pathSkip) {
    if (this.isCommitedInOlderVersions(diff.path, version)) {
      pathSkip.push(proofString);
      return false;
    }

    const url = diff.root + '/' + diff.path;
    const statusCode = await httpStatus(url);

    const allowedStatusCode = [200, 206, 403];
    if (allowedStatusCode.indexOf(statusCode) === -1) {
      return false;
    }

    if (this.mustRequestBadLink(statusCode)) {
      let badLinkStatusCode;
      try {
        badLinkStatusCode = this.requestBadLink(diff, ext, statusCode);
      } catch (err) {
        return false;
      }

      return badLinkStatusCode === 404;
    }

    return this.websiteSoft404Status === soft404.STATUS.DISABLED;
  }

  /**
   * @summary Check a modified diff
   * @param {String} proofString - the proofString
   * @param {Object} diff - the diff to check
   * @param {String} ext - the ext
   * @param {String} extLower - the ext in lower case
   * @param {String} version - the version to check
   * @param {String[]} pathSkip - the path skip array
   * @returns {Promise<Boolean>} True if the diff is a valid proof
   */
  async checkModifiedDiff(proofString, diff, ext, extLower, version, pathSkip) {
    if (NON_INTERPRETABLE_EXTENSIONS.indexOf(extLower) === -1) {
      return false;
    }

    // some files may change back an forth between versions
    if (this.isExactFileInOlderVersions(diff.path, version)) {
      pathSkip.push(proofString);
      return false;
    }

    const url = diff.root + '/' + diff.path;
    // encoding=null to get binary content instead of text
    const reqOptions = httpRequest.getOptions(url, { encoding: null });
    reqOptions.resolveWithFullResponse = true;

    const response = await requestPromise(reqOptions);
    const statusCode = response.statusCode;
    let body = response.body;

    const allowedStatusCode = [200, 206];
    if (allowedStatusCode.indexOf(statusCode) === -1) {
      return false;
    }

    if (!body || body.length === 0) {
      return false;
    }

    // normalize text files eof
    if (NON_INTERPRETABLE_TEXT_EXTENSIONS.indexOf(extLower) !== -1) {
      body = stringHelper.crlf2lf(body);
    }

    // no need to test for soft 404 as we do for A files : for M files, we compare page md5 with diff.md5
    const md5 = stringHelper.md5(body);
    if (diff.md5 === md5) {
      return true;
    }

    if (this.mustRequestBadLink()) {
      await this.requestBadLink(diff, ext, statusCode);
    }

    if (this.websiteSoft404Status === soft404.STATUS.DISABLED) {
      // we're not on an error page : the file exists on the site but is not in the version we're looking for. don't look for it anymore in other roots.
      pathSkip.push(proofString);
    }

    return false;
  }

  /**
   * @summary Check if a request to a bad link must be done, either to check soft 404 or to check 403 statusCode
   * @param {Number} [statusCode] - the status code of the previous request
   * @returns {Promise<Boolean>} True if a request to a bad link me be done
   */
  mustRequestBadLink(statusCode = -1) {
    if (this.websiteSoft404Status === soft404.STATUS.UNKNOWN) {
      return true;
    }

    // a 403 ressource tells us it is probably there but not accessible
    if (statusCode === 403) {
      return true;
    }

    return false;
  }

  /**
   * @summary Request a bad link and update the websiteSoft404Status if needed
   * @param {Object} diff - the diff of the previous request
   * @param {String} ext - the extension of the previous request
   * @param {Number} statusCode - the status code of the previous request
   * @returns {Promise<number>} The http status code of the request
   */
  async requestBadLink(diff, ext, statusCode) {
    const result = await soft404(diff.root, diff.path, ext);
    if (this.websiteSoft404Status === soft404.STATUS.UNKNOWN && statusCode !== 403) {
      this.websiteSoft404Status = result.soft404Status;
    }

    return result.statusCode;
  }

  /**
  * Find root paths of app.
  * An app may have multiple root path depending on modules : cache, cdn, specific directories, etc.
  * @param {String} baseUrl - baseUrl
  * @param {String} html - html
  * @returns {undefined} void
  */
  findRoots(baseUrl, html) {
    var a = url.parse(baseUrl);

    // add path without query
    var defaultRoot = a.protocol + '//' + a.host + a.pathname; // url without query string
    defaultRoot = stringHelper.trimChar(defaultRoot, '/');

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
          uri2 = stringHelper.trimChar(url.resolve(baseUrl, uri), '/');

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

          uri2 = stringHelper.trimChar(url.resolve(baseUrl, uri), '/');

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
  }

  /**
   * TODO
   * @param {*} rootUrl - rootUrl
   * @returns {undefined} void
   */
  setOneRoot(rootUrl) {
    this.appRoots = [];
    rootUrl = stringHelper.trimChar(rootUrl, '/');
    this.appRoots.push(rootUrl);
  }

  /**
  * Returns all known versions from diff files in ascending order
  * @returns {undefined} void
  */
  getAllVersions() {
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
  }

  /**
  * Returns an array of files that changed in a version.
  * Array elements are  {status, path, md5} objects.
  * status is M for a modified file, D for deleted file, A for added file.
  * path is file name
  * md5 is hash of file in this version (empty for D files)
  * @param {String} version - version
  * @returns {Array<String>} files that changed in a version.
  */
  getDiffFiles(version) {
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
        var ss = stringHelper.md5(r.path);
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
  }

  /**
  * Check if the exact same file (byte to byte) had already been commited in an older version.
  * @param {String} localPath - localPath
  * @param {String} version - version
  * @returns {Boolean} True if the exact same file (byte to byte) had already been commited in an older version.
  */
  isExactFileInOlderVersions(localPath, version) {
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
  }

  /**
  * Check if same file path had already been commited in an older version.
  * @param {String} localPath - localPath
  * @param {String} version - version
  * @returns {Boolean} True if same file path had already been commited in an older version
  */
  isCommitedInOlderVersions(localPath, version) {
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
  }

  /**
   * Find plugins of CMS
   * @param {String} techVersion - techVersion
   * @param {Function} progressCB - progressCB
   * @param {Function} doneCB - doneCB
   * @returns {undefined} void
   */
  findPlugins(techVersion, progressCB, doneCB) {
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
            request(httpRequest.getOptions(urlPluginTestfile, { encoding: null }), (err, response, bodyByteArray) => {
              n++;
              try {
                if (!err) {
                  if (response.statusCode === 200) {
                    bodyByteArray = stringHelper.crlf2lf(bodyByteArray); // normalize text files eof
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

            request(httpRequest.getOptions(urlPluginTestfile, { encoding: null }), (err, response) => {
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
                      tech.loadVersions();
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
          fn(pluginsPath, pluginSlug, () => {
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
  }

  /**
   * @param {Object} pIn - pIn
   * @returns {Object} output
   */
  formatPluginOutput(pIn) {
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