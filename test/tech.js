var assert = require('assert');
var request = require('request');
var fs = require('fs');
var Tech = require('../src/tech');
var Version = require('../src/version');
const describe = require('mocha').describe; // avoid eslint warnings
const it = require('mocha').it; // avoid eslint warnings

describe('Class Tech', function () {
  it('getHighestCommits', function () {
    this.timeout(5000);// change Mocha default 2000ms timeout
    var tech = new Tech('WordPress');
    var hc = tech.getHighestCommits();
    assert.ok(hc.length > 1900); // at time of writing, we're at least at 1900

    hc = tech.getHighestCommits(50);
    assert.equal(hc.length, 50);
  });

  it('deepScan', function (done) {
    this.timeout(3600 * 1000);// change Mocha default 2000ms timeout
    var tech = new Tech('WordPress');
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

  it('isVersionOrNewer 2.5.1', function (done) {
    this.timeout(10000);// change Mocha default 2000ms timeout
    var tech = new Tech('WordPress');

    const requestOptions = Tech.getReqOptions('http://wordpress2-5-1.whatsbehind.io/');
    request(requestOptions, (err, response, body) => {
      if (err) {
        done(err);
      } else {
        if (response.statusCode === 200 || response.statusCode === 206) {
          tech.findRoots(response.request.uri.href, // response.request.uri contains the response uri, potentially redirected
            body);
          tech.isVersionOrNewer(new Version('2.5.1'), (err, result) => {
            if (err) {
              done(err);
            } else {
              assert.ok(result === 'success');
              done();
            }
          });
        } else {
          done(new Error('Http status code is not 2xx.'));
        }
      }
    });
  });

  it('isVersionOrNewer 3.8', function (done) {
    this.timeout(10000);// change Mocha default 2000ms timeout
    var tech = new Tech('WordPress');

    request(Tech.getReqOptions('http://wordpress3-8.whatsbehind.io/'), function (err, response, body) {
      if (err) {
        done(err);
      } else {
        if (response.statusCode === 200 || response.statusCode === 206) {
          tech.findRoots(response.request.uri.href, // response.request.uri contains the response uri, potentially redirected
            body);
          tech.isVersionOrNewer(new Version('3.8'), function (err, result) {
            if (err) {
              done(err);
            } else {
              assert.ok(result === 'success');
              done();
            }
          });
        } else {
          done(new Error('Http status code is not 2xx.'));
        }
      }
    });
  });

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
    var existedBefore2 = tech.isCommitedInOlderVersions('wp-includes/js/tinymce/themes/advanced/images/numlist.gif', new Version('2.0'));
    var existedBefore21 = tech.isCommitedInOlderVersions('wp-includes/js/tinymce/themes/advanced/images/numlist.gif', new Version('2.1'));
    var existedBefore221Withslash = tech.isCommitedInOlderVersions('/wp-includes/js/tinymce/themes/advanced/images/numlist.gif', new Version('2.1'));
    assert.ok(existedBefore2 === false);
    assert.ok(existedBefore21 === true);
    assert.ok(existedBefore221Withslash === true);
  });

  it('crlf2lf', function () {
    const crlf = fs.readFileSync('./test/data/github_crlf.html');
    const lf = fs.readFileSync('./test/data/github_lf.html');
    const converted = Tech.crlf2lf(crlf);

    assert.equal(converted.length, lf.length);
    var same = true;
    for (var i = 0; i < lf.length; i++) {
      if (lf[i] !== converted[i]) {
        same = false;
        break;
      }
    }
    assert.ok(same);
  });
});