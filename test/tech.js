var assert = require('assert');
var request = require('request');
var fs = require('fs');
const path = require('path');
const proxyquire = require('proxyquire');
var Tech = require('../src/tech');
var Version = require('../src/version');
const soft404 = require('../src/soft404');
const describe = require('mocha').describe; // avoid eslint warnings
const it = require('mocha').it; // avoid eslint warnings

describe('Class Tech', function () {
  describe('getHighestCommits', () => {
    const DIFF_FILES = [];
    for (let i = 0; i < 100; i++) {
      DIFF_FILES.push({
        status: 'A',
        path: 'http://www.whatsbehind.io/file' + i + '.html'
      })
    }

    const getTech = () => {
      const tech = new Tech('WordPress');
      tech.getDiffFiles = () => {
        return DIFF_FILES;
      }
      tech.versions = [1, 2, 3];
      return tech;
    }

    it('calls getDiffFiles for each version', () => {
      const tech = getTech();
      let diffFileIndex = tech.versions.length - 1;
      tech.getDiffFiles = (version) => {
        assert.deepEqual(version, tech.versions[diffFileIndex--]);
        return [];
      }
      tech.getHighestCommits();
      assert.equal(diffFileIndex, -1);
    });

    it('ignore deleted files', () => {
      const tech = getTech();
      tech.getDiffFiles = () => {
        return [{
          status: 'D',
          path: 'http://www.whatsbehind.io/file.html'
        }];
      }
      const commits = tech.getHighestCommits();
      assert.deepEqual(commits, []);
    });

    it('does not ignore file if not deleted', () => {
      const PATH = 'http://www.whatsbehind.io/file.html';
      const tech = getTech();
      tech.getDiffFiles = () => {
        return [{
          status: 'A',
          path: PATH
        }];
      }
      const commits = tech.getHighestCommits();
      assert.deepEqual(commits, [PATH]);
    })

    it('ignore file if interpretable extension', () => {
      const tech = getTech();
      tech.getDiffFiles = () => {
        return [{
          status: 'A',
          path: 'http://www.whatsbehind.io/file.php'
        }];
      }
      const commits = tech.getHighestCommits();
      assert.deepEqual(commits, []);
    });

    it('does not ignore file if un interpretable extension', () => {
      const PATH = 'http://www.whatsbehind.io/file.html';
      const tech = getTech();
      tech.getDiffFiles = () => {
        return [{
          status: 'A',
          path: PATH
        }];
      }
      const commits = tech.getHighestCommits();
      assert.deepEqual(commits, [PATH]);
    });

    it('result is sorted in descending order', () => {
      const tech = getTech();
      tech.getDiffFiles = (version) => {
        switch (version) {
          case 1: {
            return  [{
              status: 'A',
              path: 'http://www.whatsbehind.io/file01.html'
            }];
          }

          case 2:
          case 3: {
            return  [{
              status: 'A',
              path: 'http://www.whatsbehind.io/file02.html'
            }];
          }
        }
      }
      const commits = tech.getHighestCommits();
      assert.deepEqual(commits, [
        'http://www.whatsbehind.io/file02.html',
        'http://www.whatsbehind.io/file01.html'
      ]);
    });

    it('returns all files', () => {
      const tech = getTech();
      const hc = tech.getHighestCommits();
      assert.equal(hc.length, DIFF_FILES.length);
    })

    it('limits the result if limit param is set', function () {
      const tech = getTech();
      const hc = tech.getHighestCommits(50);
      assert.equal(hc.length, 50);
    })
  });


  it('deepScan', function (done) {
    this.timeout(3600 * 1000);// change Mocha default 2000ms timeout
    var tech = new Tech('WordPress');
    tech.loadVersions();
    //var data = { uri: "https://www.wordfence.com/", version: "4.6" };
    //var data = { uri: "http://www.starwars.com", version: "4.5.3" };
    var data = { uri: 'http://wordpress3-8.whatsbehind.io/', version: '3.8' };
    //var data = { uri: "https://wordpress.org", version: "4.6" };
    //var data = { uri: "http://observer.com", version: "4.6" };
    //var data = { uri: "http://www.bbcamerica.com/", version: "4.5.1" };
    request(Tech.getReqOptions(data.uri), function (err, response, body) {
      if (err) {
        done(err);
      } else {
        if (response.statusCode === 200 || response.statusCode === 206) {
          tech.findRoots(response.request.uri.href, // response.request.uri contains the response uri, potentially redirected
            body);
          tech.deepScan(function (err, result) {
            if (err) {
              done(err);
            } else {
              var found = false;
              var i = result.versions.length;
              while (i-- && found === false) {
                if (result.versions[i] === data.version) {
                  found = true;
                }
              }
              assert.ok(found === true);
              done();
            }
          }, () => {
          });
        } else {
          done(new Error('Http status code is not 2xx.'));
        }
      }
    });
  });

  describe('isVersionOrNewer', () => {
    const VERSION = new Version('2.5.1');
    const APP_ROOTS = ['something'];
    const DIFF_FILES = [];
    for (let i = 0; i < 2; i++) {
      DIFF_FILES.push({
        status: 'A',
        path: 'path' + i,
        md5: 'md5' + i
      })
    }
    for (let i = 0; i < 3; i++) {
      DIFF_FILES.push({
        status: 'M',
        path: 'path' + i,
        md5: 'md5' + i
      })
    }

    const getMockTech = () => {
      const tech = new Tech('WordPress');
      tech.getDiffFiles = () => {
        return DIFF_FILES;
      }
      tech.cloneDiffs = () => {
        return DIFF_FILES;
      }
      tech.checkDiff = () => true;
      tech.appRoots = APP_ROOTS;
      return tech;
    }

    it('calls getDiffFiles', async () => {
      const tech = getMockTech();
      let getDiffFilesCalled = false;
      tech.getDiffFiles = (version) => {
        assert.equal(version, VERSION);
        getDiffFilesCalled = true;
        return [];
      }
      await tech.isVersionOrNewer(VERSION);
      assert(getDiffFilesCalled);
    });

    it('calls cloneDiffs', async () => {
      const tech = getMockTech();
      let cloneDiffsCalled = false;
      tech.cloneDiffs = (diffs, appRoots) => {
        assert.deepEqual(diffs, DIFF_FILES);
        assert.deepEqual(appRoots, tech.appRoots);
        cloneDiffsCalled = true;
        return [];
      }
      await tech.isVersionOrNewer(VERSION);
      assert(cloneDiffsCalled);
    });

    it('calls checkDiff for every diff', async () => {
      const tech = getMockTech();
      let checkDiffIndex = 0;
      tech.checkDiff = (pProofString, pDiff, pExt, pExtLower, pVersion, pPathSkip) => {
        const diff = DIFF_FILES[checkDiffIndex++];
        const ext = path.extname(diff.path);
        const extLower = ext.toLowerCase();
        const proofString = diff.status + ' ' + diff.path;
        assert.equal(pProofString, proofString);
        assert.deepEqual(pDiff, diff);
        assert.equal(pExt, ext);
        assert.equal(pExtLower, extLower);
        assert.equal(pVersion, VERSION);
        assert.deepEqual(pPathSkip, []);
        return false;
      }
      await tech.isVersionOrNewer(VERSION);
      assert.equal(checkDiffIndex, DIFF_FILES.length);
    });

    it('returns proofs', async () => {
      const tech = getMockTech();
      tech.checkDiff = () => {
        return true;
      }
      const result = await tech.isVersionOrNewer(VERSION, DIFF_FILES.length);
      assert.deepEqual(result.proofs, DIFF_FILES);
    });

    it('returns maybe if no file can be tested', async () => {
      const tech = getMockTech();
      tech.getDiffFiles = () => {
        return [];
      }
      tech.cloneDiffs = () => {
        return [];
      }
      const result = await tech.isVersionOrNewer(VERSION, DIFF_FILES.length);
      assert.equal(result.status, 'maybe');
    });

    it('returns success if proofs has been found', async () => {
      const tech = getMockTech();
      tech.checkDiff = () => {
        return true;
      }
      const result = await tech.isVersionOrNewer(VERSION, DIFF_FILES.length);
      assert.equal(result.status, 'success');
    });

    it('returns success if proofs length equals to maxProofs', async () => {
      const tech = getMockTech();
      let checkDiffIndex = 0;
      tech.checkDiff = () => {
        checkDiffIndex++;
        return true;
      }
      const result = await tech.isVersionOrNewer(VERSION, 1);
      assert.equal(checkDiffIndex, 1);
      assert.equal(result.status, 'success');
    });

    it('returns fail if more than 50 tries', async () => {
      const tech = getMockTech();
      const createDiffs = () => {
        const diffs = [];
        for (let i = 0; i < 100; i++) {
          diffs.push({
            status: 'A',
            path: 'path' + i,
            md5: 'md5' + i
          })
        }
        return diffs;
      }
      tech.getDiffFiles = () => {
        return createDiffs();
      }
      tech.cloneDiffs = () => {
        return createDiffs();
      }
      tech.checkDiff = () => {
        return false;
      }
      const result = await tech.isVersionOrNewer(VERSION, DIFF_FILES.length);
      assert.equal(result.status, 'fail');
    });

    it('returns fail if proof is empty', async () => {
      const tech = getMockTech();
      tech.checkDiff = () => {
        return false;
      }
      const result = await tech.isVersionOrNewer(VERSION, DIFF_FILES.length);
      assert.equal(result.status, 'fail');
    });

    it('isVersionOrNewer 2.5.1', function (done) {
      this.timeout(10000);// change Mocha default 2000ms timeout
      var tech = new Tech('WordPress');

      const requestOptions = Tech.getReqOptions('http://wordpress2-5-1.whatsbehind.io/');
      request(requestOptions, async (err, response, body) => {
        if (err) {
          done(err);
        } else {
          if (response.statusCode === 200 || response.statusCode === 206) {
            tech.findRoots(response.request.uri.href, // response.request.uri contains the response uri, potentially redirected
              body);
            const result = await tech.isVersionOrNewer(new Version('2.5.1'));
            assert.equal(result.status, 'success');
            done();
          } else {
            done(new Error('Http status code is not 2xx.'));
          }
        }
      });
    });

    it('isVersionOrNewer 3.8', function (done) {
      this.timeout(10000);// change Mocha default 2000ms timeout
      var tech = new Tech('WordPress');

      request(Tech.getReqOptions('http://wordpress3-8.whatsbehind.io/'), async (err, response, body) => {
        if (err) {
          done(err);
        } else {
          if (response.statusCode === 200 || response.statusCode === 206) {
            tech.findRoots(response.request.uri.href, // response.request.uri contains the response uri, potentially redirected
              body);
            const result = await tech.isVersionOrNewer(new Version('3.8'));
            assert.equal(result.status, 'success');
            done();
          } else {
            done(new Error('Http status code is not 2xx.'));
          }
        }
      });
    });
  })

  describe('cloneDiffs', () => {
    it('clone the diffs and add appRoots', () => {
      var tech = new Tech('WordPress');
      const DIFF_COUNT = 25;
      const DIFFS = [];
      for (let i = 0; i < DIFF_COUNT; i++) {
        DIFFS.push({
          path: 'path' + i,
          md5: 'md5' + i,
          status: 'status' + i
        })
      }
      const APP_ROOTS_COUNT = 5;
      const APP_ROOTS = [];
      for (let i = 0; i < APP_ROOTS_COUNT; i++) {
        APP_ROOTS.push('appRoot' + i);
      }

      const EXPECTED_RESULT = [];
      Object.keys(DIFFS).forEach((diffKey) => {
        Object.keys(APP_ROOTS).forEach((appRootKey) => {
          const diff = DIFFS[diffKey];
          const clonedDiff = {
            path: diff.path,
            md5: diff.md5,
            status: diff.status,
            root: APP_ROOTS[appRootKey]
          }
          EXPECTED_RESULT.push(clonedDiff);
        })
      })

      const clones = tech.cloneDiffs(DIFFS, APP_ROOTS);
      assert.deepEqual(clones, EXPECTED_RESULT);
    })
  })

  describe('checkDiff', () => {
    const PROOF_STRING = 'proofString';
    const DIFF_ADDED = {
      status: 'A'
    };
    const DIFF_MODIFIED = {
      status: 'M'
    };
    const EXT = 'ext';
    const EXT_LOWER = 'extLower';
    const VERSION = 'version';
    const PATH_SKIP = [];

    it('calls checkAddedDiff if diff status equals A', async () => {
      let checkAddedDiffCalled = false;
      var tech = new Tech('WordPress');
      tech.checkAddedDiff = async (proofString, diff, ext, extLower, version, pathSkip) => {
        assert.equal(proofString, PROOF_STRING);
        assert.deepEqual(diff, DIFF_ADDED);
        assert.equal(ext, EXT);
        assert.equal(extLower, EXT_LOWER);
        assert.equal(version, VERSION);
        assert.equal(pathSkip, PATH_SKIP);
        checkAddedDiffCalled = true;
        return true;
      }
      await tech.checkDiff(PROOF_STRING, DIFF_ADDED, EXT, EXT_LOWER, VERSION, PATH_SKIP);
      assert(checkAddedDiffCalled);
    });

    it('returns checkAddedDiff result if diff status equals A', async () => {
      const RESULT = { something: 'anything' };
      var tech = new Tech('WordPress');
      tech.checkAddedDiff = async () => {
        return RESULT;
      }
      const result = await tech.checkDiff(PROOF_STRING, DIFF_ADDED, EXT, EXT_LOWER, VERSION, PATH_SKIP);
      assert.deepEqual(result, RESULT);
    });

    it('calls checkModifiedDiff if diff status equals M', async () => {
      let checkModifiedDiffCalled = false;
      var tech = new Tech('WordPress');
      tech.checkModifiedDiff = async (proofString, diff, ext, extLower, version, pathSkip) => {
        assert.equal(proofString, PROOF_STRING);
        assert.deepEqual(diff, DIFF_MODIFIED);
        assert.equal(ext, EXT);
        assert.equal(extLower, EXT_LOWER);
        assert.equal(version, VERSION);
        assert.equal(pathSkip, PATH_SKIP);
        checkModifiedDiffCalled = true;
        return true;
      }
      await tech.checkDiff(PROOF_STRING, DIFF_MODIFIED, EXT, EXT_LOWER, VERSION, PATH_SKIP);
      assert(checkModifiedDiffCalled);
    });

    it('returns checkModifiedDiff result if diff status equals A', async () => {
      const RESULT = { something: 'anything' };
      var tech = new Tech('WordPress');
      tech.checkModifiedDiff = async () => {
        return RESULT;
      }
      const result = await tech.checkDiff(PROOF_STRING, DIFF_MODIFIED, EXT, EXT_LOWER, VERSION, PATH_SKIP);
      assert.deepEqual(result, RESULT);
    });

    it('calls nothing if status equals other value', async () => {
      let called = false;
      var tech = new Tech('WordPress');
      tech.checkAddedDiff = async () => {
        called = true;
        return true;
      }
      tech.checkModifiedDiff = async () => {
        called = true;
        return true;
      }
      await tech.checkDiff(PROOF_STRING, {}, EXT, EXT_LOWER, VERSION, PATH_SKIP);
      assert(!called);
    });

    it('returns false if status equal other value', async () => {
      var tech = new Tech('WordPress');
      const result = await tech.checkDiff(PROOF_STRING, {}, EXT, EXT_LOWER, VERSION, PATH_SKIP);
      assert.deepEqual(result, false);
    });
  })

  describe('checkAddedDiff', () => {
    const PROOF_STRING = 'proofString';
    const DIFFS = {};

    for (let i = 100; i < 600; i++) {
      const root = 'root' + i;
      const path = 'path' + i;
      DIFFS[root + '/' + path] = {
        root,
        path,
        status: 'A',
        statusCode: i
      };
    }
    const DIFF = DIFFS[Object.keys(DIFFS)[0]];
    const EXT = 'ext';
    const EXT_LOWER = 'extLower';
    const VERSION = 'version';
    const PATH_SKIP = [];

    const Tech = proxyquire('../src/tech.js', {
      './httpStatus': async (url) => {
        const diff = DIFFS[url];
        assert(diff);
        return diff.statusCode;
      }
    })

    const getMockedTech = () => {
      const tech = new Tech('WordPress');
      tech.isCommitedInOlderVersions = () => {
        return false;
      }
      return tech;
    }

    it('calls isCommitedInOlderVersions', async () => {
      const tech = getMockedTech();
      let isCommitedInOlderVersionsCalled = false;
      tech.isCommitedInOlderVersions = (localPath, version) => {
        assert.equal(localPath, DIFF.path);
        assert.equal(version, VERSION);
        isCommitedInOlderVersionsCalled = true;
      }
      await tech.checkAddedDiff(PROOF_STRING, DIFF, EXT, EXT_LOWER, VERSION, PATH_SKIP);
      assert(isCommitedInOlderVersionsCalled);
    });

    it('updates pathSkip if isCommitedInOlderVersions returns true', async () => {
      const pathSkip = [];
      const tech = getMockedTech();
      tech.isCommitedInOlderVersions = () => {
        return true;
      }
      await tech.checkAddedDiff(PROOF_STRING, DIFF, EXT, EXT_LOWER, VERSION, pathSkip);
      assert.deepEqual(pathSkip, [PROOF_STRING]);
    });

    it('returns false if isCommitedInOlderVersions returns true', async () => {
      const pathSkip = [];
      var tech = getMockedTech();
      tech.isCommitedInOlderVersions = () => {
        return true;
      }
      const result = await tech.checkAddedDiff(PROOF_STRING, DIFF, EXT, EXT_LOWER, VERSION, pathSkip);
      assert(!result);
    });

    it('calls httpStatus', async () => {
      let httpStatusCalled = false;
      const Tech = proxyquire('../src/tech.js', {
        './httpStatus': (url) => {
          assert.equal(url, DIFF.root + '/' + DIFF.path);
          httpStatusCalled = true;
        }
      })
      const tech = new Tech('WordPress');
      await tech.checkAddedDiff(PROOF_STRING, DIFF, EXT, EXT_LOWER, VERSION, PATH_SKIP);
      assert(httpStatusCalled);
    });

    const allowedStatusCode = [200, 206, 403];
    Object.keys(DIFFS).forEach((url) => {
      const diff = DIFFS[url];
      if (allowedStatusCode.indexOf(diff.statusCode) === -1) {
        it('returns false on ' + diff.statusCode, async () => {
          const tech = getMockedTech();
          const result = await tech.checkAddedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert(!result);
        });
      } else {
        it('calls mustRequestBadLink on ' + diff.statusCode, async () => {
          const tech = getMockedTech();
          let mustRequestBadLinkCalled = false;
          tech.mustRequestBadLink = (pStatusCode) => {
            assert.equal(pStatusCode, diff.statusCode);
            mustRequestBadLinkCalled = true;
            return false;
          }
          await tech.checkAddedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert(mustRequestBadLinkCalled);
        });

        it('calls requestBadLink on ' + diff.statusCode + ' if mustRequestBadLink returns true', async () => {
          const tech = getMockedTech();
          let requestBadLinkCalled = false;
          tech.mustRequestBadLink = () => {
            return true;
          }
          tech.requestBadLink = (pDiff, ext, pStatusCode) => {
            assert.deepEqual(pDiff, diff);
            assert.equal(ext, EXT);
            assert.equal(pStatusCode, diff.statusCode);
            requestBadLinkCalled = true;
          }
          await tech.checkAddedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert(requestBadLinkCalled);
        });

        it('returns false if requestBadLink fails on ' + diff.statusCode, async () => {
          const tech = getMockedTech();
          tech.mustRequestBadLink = () => {
            return true;
          }
          tech.requestBadLink = () => {
            throw new Error('WTF');
          }
          const result = await tech.checkAddedDiff(PROOF_STRING, DIFF, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert.deepEqual(result, false);
        });

        it('returns true if requestBadLink returns 404 on ' + diff.statusCode, async () => {
          const tech = getMockedTech();
          tech.mustRequestBadLink = () => {
            return true;
          }
          tech.requestBadLink = () => 404;
          const result = await tech.checkAddedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert.deepEqual(result, true);
        });

        it('returns false if requestBadLink returns other value than 404 on ' + diff.statusCode, async () => {
          const tech = getMockedTech();
          tech.mustRequestBadLink = () => {
            return true;
          }
          tech.requestBadLink = () => 400;
          const result = await tech.checkAddedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert.deepEqual(result, false);
        });

        it('returns true if soft404 is disabled and mustRequestBadLink returns false on ' + diff.statusCode, async () => {
          const tech = getMockedTech();
          tech.mustRequestBadLink = () => {
            return false;
          }
          tech.websiteSoft404Status = soft404.STATUS.DISABLED;
          const result = await tech.checkAddedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert.deepEqual(result, true);
        });

        it('returns false if soft404 is enabled and mustRequestBadLink returns false on ' + diff.statusCode, async () => {
          const tech = getMockedTech();
          tech.mustRequestBadLink = () => {
            return false;
          }
          tech.websiteSoft404Status = soft404.STATUS.ENABLED;
          const result = await tech.checkAddedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert.deepEqual(result, false);
        });

        it('returns false if soft404 is unknown and mustRequestBadLink returns false on ' + diff.statusCode, async () => {
          const tech = getMockedTech();
          tech.mustRequestBadLink = () => {
            return false;
          }
          tech.websiteSoft404Status = soft404.STATUS.UNKOWN;
          const result = await tech.checkAddedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert.deepEqual(result, false);
        });
      }
    })
  })

  describe('checkModifiedDiff', () => {
    const PROOF_STRING = 'proofString';
    const DIFFS = {};

    for (let i = 100; i < 600; i++) {
      const root = 'root' + i;
      const path = 'path' + i;
      DIFFS[root + '/' + path] = {
        root,
        path,
        status: 'M',
        body: 'body',
        md5: 'f1d3ff8443297732862df21dc4e57262',
        statusCode: i
      };
    }
    const DIFF = DIFFS[Object.keys(DIFFS)[0]];
    const EXT = '.html';
    const EXT_LOWER = '.html';
    const VERSION = 'version';
    const PATH_SKIP = [];

    const Tech = proxyquire('../src/tech.js', {
      'request-promise': async (options) => {
        const diff = DIFFS[options.url];
        assert(diff);
        return {
          statusCode: diff.statusCode,
          body: diff.body
        }
      }
    })

    const getMockedTech = () => {
      const tech = new Tech('WordPress');
      tech.isExactFileInOlderVersions = () => {
        return false;
      }
      tech.mustRequestBadLink = () => false;
      tech.requestBadLink = async () => {
        return;
      }
      return tech;
    }

    it('returns false if extension is not in NON_INTERPRETABLE_EXTENSIONS', async () => {
      const tech = getMockedTech();
      const result = await tech.checkModifiedDiff(PROOF_STRING, DIFF, '.ext', '.ext', VERSION, PATH_SKIP);
      assert.deepEqual(result, false);
    });

    it('returns false if isExactFileInOlderVersions returns true', async () => {
      const tech = new Tech('WordPress');
      let isExactFileInOlderVersionsCalled = false;
      tech.isExactFileInOlderVersions = (path, version) => {
        assert.equal(path, DIFF.path);
        assert.equal(version, VERSION);
        isExactFileInOlderVersionsCalled = true;
        return true;
      }
      const result = await tech.checkModifiedDiff(PROOF_STRING, DIFF, EXT, EXT_LOWER, VERSION, PATH_SKIP);
      assert(isExactFileInOlderVersionsCalled);
      assert.deepEqual(result, false);
    });

    it('updates pathSkip if isExactFileInOlderVersions returns true', async () => {
      const pathSkip = [];
      const tech = new Tech('WordPress');
      tech.isExactFileInOlderVersions = () => {
        return true;
      }
      await tech.checkModifiedDiff(PROOF_STRING, DIFF, EXT, EXT_LOWER, VERSION, pathSkip);
      assert.deepEqual(pathSkip, [PROOF_STRING]);
    });

    it('requests url', async () => {
      let requestCalled = false;
      const Tech = proxyquire('../src/tech.js', {
        'request-promise': async (options) => {
          assert.equal(options.url, DIFF.root + '/' + DIFF.path);
          assert(options.resolveWithFullResponse);
          requestCalled = true;
          return {
            statusCode: DIFF.statusCode,
            body: 'body'
          }
        }
      })

      const tech = new Tech('WordPress');
      tech.isExactFileInOlderVersions = () => {
        return false;
      }
      await tech.checkModifiedDiff(PROOF_STRING, DIFF, EXT, EXT_LOWER, VERSION, PATH_SKIP);
      assert(requestCalled);
    });

    it('fails if an error occured while requesting url', async () => {
      const error = new Error('WTF');
      const Tech = proxyquire('../src/tech.js', {
        'request-promise': async () => {
          throw error;
        }
      })

      const tech = new Tech('WordPress');
      tech.isExactFileInOlderVersions = () => {
        return false;
      }

      let hasFailed = false;
      try {
        await tech.checkModifiedDiff(PROOF_STRING, DIFF, EXT, EXT_LOWER, VERSION, PATH_SKIP);
      } catch (err) {
        assert.deepEqual(err, error);
        hasFailed = true;
      }
      assert(hasFailed);
    });

    const allowedStatusCode = [200, 206];
    Object.keys(DIFFS).forEach((url) => {
      const diff = DIFFS[url];
      if (allowedStatusCode.indexOf(diff.statusCode) === -1) {
        it('returns false on ' + diff.statusCode, async () => {
          const tech = getMockedTech();
          const result = await tech.checkModifiedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert.deepEqual(result, false);
        })
      } else {
        it('returns false if body is null on ' + diff.statusCode, async () => {
          const previousBody = diff.body;
          diff.body = null;
          const tech = getMockedTech();
          const result = await tech.checkModifiedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          diff.body = previousBody;
          assert.deepEqual(result, false);
        });

        it('returns false if body is empty on ' + diff.statusCode, async () => {
          const previousBody = diff.body;
          diff.body = '';
          const tech = getMockedTech();
          const result = await tech.checkModifiedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          diff.body = previousBody;
          assert.deepEqual(result, false);
        });

        it('updates body with stringHelper.crlf2lf result on text files on ' + diff.statusCode, async () => {
          let md5Called = false;
          const Tech = proxyquire('../src/tech.js', {
            'request-promise': async (options) => {
              const diff = DIFFS[options.url];
              assert(diff);
              return {
                statusCode: diff.statusCode,
                body: diff.body
              }
            },
            './stringHelper': {
              crlf2lf: (data) => {
                assert.equal(data, 'body');
                return 'crlf2lf';
              },
              md5: (string) => {
                assert.equal(string, 'crlf2lf');
                md5Called = true;
              }
            }
          })

          const tech = new Tech('WordPress');
          tech.isExactFileInOlderVersions = () => {
            return false;
          }
          tech.mustRequestBadLink = () => false;
          await tech.checkModifiedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert(md5Called);
        });

        it('does not update body with stringHelper.crlf2lf result on non text files on ' + diff.statusCode, async () => {
          let md5Called = false;
          const Tech = proxyquire('../src/tech.js', {
            'request-promise': async (options) => {
              const diff = DIFFS[options.url];
              assert(diff);
              return {
                statusCode: diff.statusCode,
                body: diff.body
              }
            },
            './stringHelper': {
              crlf2lf: (data) => {
                assert.equal(data, 'body');
                return 'crlf2lf';
              },
              md5: (string) => {
                assert.equal(string, 'body');
                md5Called = true;
              }
            }
          })

          const tech = new Tech('WordPress');
          tech.isExactFileInOlderVersions = () => {
            return false;
          }
          tech.mustRequestBadLink = () => false;
          await tech.checkModifiedDiff(PROOF_STRING, diff, '.png', '.png', VERSION, PATH_SKIP);
          assert(md5Called);
        });

        it('returns true on same md5 on ' + diff.statusCode, async () => {
          const tech = getMockedTech();
          const result = await tech.checkModifiedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          assert.deepEqual(result, true);
        });

        it('returns false if different md5 on ' + diff.statusCode, async () => {
          const previousMd5 = diff.md5;
          diff.md5 = 'pouet';
          const tech = getMockedTech();
          const result = await tech.checkModifiedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          diff.body = previousMd5;
          assert.deepEqual(result, false);
        });

        it('calls mustRequestBadLink if different md5 on ' + diff.statusCode, async () => {
          const previousMd5 = diff.md5;
          diff.md5 = 'pouet';
          const tech = getMockedTech();
          let mustRequestBadLinkCalled = false;
          tech.mustRequestBadLink = () => {
            mustRequestBadLinkCalled = true;
            return false;
          }
          await tech.checkModifiedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          diff.body = previousMd5;
          assert(mustRequestBadLinkCalled);
        });

        it('calls requestBadLink when mustRequestBadLink returns true and different md5 on ' + diff.statusCode, async () => {
          const previousMd5 = diff.md5;
          diff.md5 = 'pouet';
          const tech = getMockedTech();
          tech.mustRequestBadLink = () => {
            return true;
          }
          let requestBadLinkCalled = false;
          tech.requestBadLink = async () => {
            requestBadLinkCalled = true;
            return;
          }
          await tech.checkModifiedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, PATH_SKIP);
          diff.body = previousMd5;
          assert(requestBadLinkCalled);
        });

        it('adds to pathSkip if soft404 is disabled and different md5 on ' + diff.statusCode, async () => {
          const pathSkip = [];
          const previousMd5 = diff.md5;
          diff.md5 = 'pouet';
          const tech = getMockedTech();
          tech.mustRequestBadLink = () => {
            return true;
          }
          tech.websiteSoft404Status = soft404.STATUS.DISABLED;
          await tech.checkModifiedDiff(PROOF_STRING, diff, EXT, EXT_LOWER, VERSION, pathSkip);
          diff.body = previousMd5;
          assert.deepEqual(pathSkip, [PROOF_STRING]);
        });
      }
    });
  })

  describe('mustRequestBadLink', () => {
    it('returns true if websiteSoft404Status = UNKOWN', () => {
      const tech = new Tech('WordPress');
      tech.websiteSoft404Status = soft404.STATUS.UNKNOWN;
      assert.deepEqual(tech.mustRequestBadLink(), true);
    });

    it('returns false if websiteSoft404Status = ENABLED', () => {
      const tech = new Tech('WordPress');
      tech.websiteSoft404Status = soft404.STATUS.ENABLED;
      assert.deepEqual(tech.mustRequestBadLink(), false);
    });

    it('returns false if websiteSoft404Status = DISABLED', () => {
      const tech = new Tech('WordPress');
      tech.websiteSoft404Status = soft404.STATUS.DISABLED;
      assert.deepEqual(tech.mustRequestBadLink(), false);
    });

    it('returns true if websiteSoft404Status = UNKNOWN and statusCode = 403', () => {
      const tech = new Tech('WordPress');
      tech.websiteSoft404Status = soft404.STATUS.UNKNOWN;
      assert.deepEqual(tech.mustRequestBadLink(403), true);
    });

    it('returns true if websiteSoft404Status = ENABLED and statusCode = 403', () => {
      const tech = new Tech('WordPress');
      tech.websiteSoft404Status = soft404.STATUS.ENABLED;
      assert.deepEqual(tech.mustRequestBadLink(403), true);
    });

    it('returns true if websiteSoft404Status = DISABLED and statusCode = 403', () => {
      const tech = new Tech('WordPress');
      tech.websiteSoft404Status = soft404.STATUS.ENABLED;
      assert.deepEqual(tech.mustRequestBadLink(403), true);
    });

    for (let i = 100; i < 600; i++) {
      if (i !== 403) {
        it('returns true if websiteSoft404Status = UNKNOWN and statusCode = ' + i, () => {
          const tech = new Tech('WordPress');
          tech.websiteSoft404Status = soft404.STATUS.UNKNOWN;
          assert.deepEqual(tech.mustRequestBadLink(i), true);
        });

        it('returns false if websiteSoft404Status = ENABLED and statusCode = ' + i, () => {
          const tech = new Tech('WordPress');
          tech.websiteSoft404Status = soft404.STATUS.ENABLED;
          assert.deepEqual(tech.mustRequestBadLink(i), false);
        });

        it('returns false if websiteSoft404Status = DISABLED and statusCode = ' + i, () => {
          const tech = new Tech('WordPress');
          tech.websiteSoft404Status = soft404.STATUS.DISABLED;
          assert.deepEqual(tech.mustRequestBadLink(i), false);
        });
      }
    }
  })

  describe('requestBadLink', () => {
    const DIFF = {
      root: 'root',
      path: 'path'
    };
    const EXT = 'ext';

    const Tech = proxyquire('../src/tech.js', {
      './soft404': async (root, relativePath, ext) => {
        assert.equal(root, DIFF.root);
        assert.equal(relativePath, DIFF.path);
        assert.equal(ext, EXT);
        return {
          soft404Status: soft404.STATUS.ENABLED,
          statusCode: 200
        };
      }
    })

    it('calls soft404', async () => {
      let soft404Called = false;
      const Tech = proxyquire('../src/tech.js', {
        './soft404': async (root, relativePath, ext) => {
          assert.equal(root, DIFF.root);
          assert.equal(relativePath, DIFF.path);
          assert.equal(ext, EXT);
          soft404Called = true;
          return {
            soft404Status: soft404.STATUS.ENABLED,
            statusCode: 200
          };
        }
      });
      const tech = new Tech('WordPress');
      await tech.requestBadLink(DIFF, EXT, 200);
      assert(soft404Called);
    });

    it('updates websiteSoft404Status if UNKOWN & statusCode !== 403', async () => {
      const tech = new Tech('WordPress');
      assert.equal(tech.websiteSoft404Status, soft404.STATUS.UNKNOWN);
      await tech.requestBadLink(DIFF, EXT, 200);
      assert.equal(tech.websiteSoft404Status, soft404.STATUS.ENABLED);
    });

    it('returns status code', async () => {
      const tech = new Tech('WordPress');
      const result = await tech.requestBadLink(DIFF, EXT, 200);
      assert.equal(result, 200);
    });
  })

  it('findRoots', function () {
    var tech = new Tech('WordPress');
    var html = fs.readFileSync('./test/data/observer_com.html', 'utf8'); // observer.com (09/2016) is a good example of WordPress website with multiple roots
    tech.findRoots('http://observer.com/', html);
    assert.ok(tech.appRoots.indexOf('http://observer.com') !== -1);
    assert.ok(tech.appRoots.indexOf('http://s0.wp.com') !== -1);
    assert.ok(tech.appRoots.indexOf('https://s1.wp.com') !== -1);
  });

  it('getAllVersions', function () {
    var tech = new Tech('WordPress');
    var versions = tech.getAllVersions();
    assert.ok(versions.indexOf('3.9'), 'This should succeed');
    assert.ok(versions.indexOf('4.6-beta4'), 'This should succeed');
  });

  it('getDiffFiles', function () {
    var tech = new Tech('WordPress');
    var b = tech.getDiffFiles(new Version('2.0'));

    var found = false;
    for (var i in b) {
      if (b[i].path === 'wp-includes/js/tinymce/themes/advanced/images/numlist.gif' && b[i].status === 'A') {
        found = true;
      }
    }
    assert.ok(found, 'This should succeed');
  });

  it('isExactFileInOlderVersions', function () {
    var tech = new Tech('WordPress');
    var existedbefore = tech.isExactFileInOlderVersions('wp-admin/about.php', new Version('4.6'));
    assert.ok(existedbefore === false);
    existedbefore = tech.isExactFileInOlderVersions('readme.html', new Version('2.0'));
    assert.ok(existedbefore === false);
  });

  it('isCommitedInOlderVersions', function () {
    var tech = new Tech('WordPress');
    tech.loadVersions();
    var existedBefore2 = tech.isCommitedInOlderVersions('wp-includes/js/tinymce/themes/advanced/images/numlist.gif', new Version('2.0'));
    var existedBefore21 = tech.isCommitedInOlderVersions('wp-includes/js/tinymce/themes/advanced/images/numlist.gif', new Version('2.1'));
    var existedBefore221Withslash = tech.isCommitedInOlderVersions('/wp-includes/js/tinymce/themes/advanced/images/numlist.gif', new Version('2.1'));
    assert.ok(existedBefore2 === false);
    assert.ok(existedBefore21 === true);
    assert.ok(existedBefore221Withslash === true);
  });
});