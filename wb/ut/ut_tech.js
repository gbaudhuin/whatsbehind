var assert = require('assert');
var request = require('request');
var fs = require('fs');
var Tech = require('../tech');
var Version = require('../version');

describe('Class Tech', function () {
    it('getHighestCommits', function () {
        var tech = new Tech("wordpress");
        var hc = tech.getHighestCommits();
        assert.ok(hc.length > 1900); // at time of writing, we're at least at 1900

        hc = tech.getHighestCommits(50);
        assert.ok(hc.length == 50);
    })

    it('getPossibleVersions', function (done) {
        this.timeout(3600 * 1000);// change Mocha default 2000ms timeout
        var tech = new Tech("wordpress");
       // var uri = "https://www.wordfence.com/";
        //var uri = "http://www.starwars.com";
      //  var uri = "http://www.peoleo.com";
        var uri = "https://wordpress.org";
        request({ url: uri, timeout: 5000, rejectUnauthorized: false, requestCert: true, agent: false}, function (err, response, body) {
            if (err) done(err);
            else {
                if (response.statusCode / 100 == 2) {
                    tech.findRoots(response.request.uri.href, // response.request.uri contains the response uri, potentially redirected
                        body);
                    tech.getPossibleVersions(function (err, result) {
                        if (err) done(err);
                        else {
                            assert.ok(result.status == "success");
                            done();
                        }
                    });
                } else {
                    done(new Error("Http status code is not 2xx."));
                }
            }
        });
    })

    it('checkMissedVersions', function (done) {
        this.timeout(3600 * 1000);// change Mocha default 2000ms timeout
        var tech = new Tech("wordpress");
        request({ url: "https://wordpress.org/", timeout: 5000, rejectUnauthorized: false, requestCert: true, agent: false }, function (err, response, body) {
            if (err) done(err);
            else {
                if (response.statusCode / 100 == 2) {
                    tech.findRoots(response.request.uri.href, // response.request.uri contains the response uri, potentially redirected
                        body);
                    tech.checkMissedVersions([new Version("4.6")], [], function (err, result) {
                        if (err) done(err);
                        else {
                            assert.ok(result.status == "success");
                            done();
                        }
                    });
                } else {
                    done(new Error("Http status code is not 2xx."));
                }
            }
        });
    })

    it('isVersionOrNewer', function (done) {
        this.timeout(10000);// change Mocha default 2000ms timeout
        var tech = new Tech("wordpress");

        request({ url: "https://wordpress.org/", timeout: 5000, rejectUnauthorized: false, requestCert: true, agent: false }, function (err, response, body) {
            if (err) done(err);
            else {
                if (response.statusCode / 100 == 2) {
                    tech.findRoots(response.request.uri.href, // response.request.uri contains the response uri, potentially redirected
                                    body);
                    tech.isVersionOrNewer(new Version("4.6"), function (err, result, proofs) {
                        if (err) done(err);
                        else {
                            assert.ok(result=="maybe");
                            done();
                        }
                    });
                } else {
                    done(new Error("Http status code is not 2xx."));
                }
            }
        });
    })

    it('findRoots', function() {
        var tech = new Tech("wordpress");
        var html = fs.readFileSync(__dirname + "/data/observer_com.html", "utf8"); // observer.com (09/2016) is a good example of WordPress website with multiple roots
        var r = tech.findRoots("http://observer.com/", html);
        assert.ok(tech.appRoots.indexOf("http://observer.com") !== -1);
        assert.ok(tech.appRoots.indexOf("http://s0.wp.com") !== -1);
        assert.ok(tech.appRoots.indexOf("https://s1.wp.com") !== -1);
    })

    it('getAllVersions', function() {
        var tech = new Tech("wordpress");
        var versions = tech.getAllVersions();
        assert.ok(versions.indexOf("3.9"), "This should succeed");
        assert.ok(versions.indexOf("4.6-beta4"), "This should succeed");
    })

    it('getDiffFiles', function () {
        var tech = new Tech("wordpress");
        var b = tech.getDiffFiles(new Version("2.0"));
        
        var found = false;
        for (i in b) {
            if (b[i].path == "wp-includes/js/tinymce/themes/advanced/images/numlist.gif" && b[i].status == "A") {
                found = true;
            }
        }
        assert.ok(found, "This should succeed");
    })

    it('isExactFileInOlderVersions', function () {
        var tech = new Tech("wordpress");
        var existed_before = tech.isExactFileInOlderVersions("wp-admin/about.php", new Version("4.6"));
        assert.ok(existed_before === false);
        existed_before = tech.isExactFileInOlderVersions("readme.html", new Version("2.0"));
        assert.ok(existed_before === false);
    })

    it('isCommitedInOlderVersions', function () {
        var tech = new Tech("wordpress");
        var existed_before_2 = tech.isCommitedInOlderVersions("wp-includes/js/tinymce/themes/advanced/images/numlist.gif", new Version("2.0"));
        var existed_before_2_1 = tech.isCommitedInOlderVersions("wp-includes/js/tinymce/themes/advanced/images/numlist.gif", new Version("2.1"));
        var existed_before_2_1_withslash = tech.isCommitedInOlderVersions("/wp-includes/js/tinymce/themes/advanced/images/numlist.gif", new Version("2.1"));
        assert.ok(existed_before_2 === false);
        assert.ok(existed_before_2_1 === true);
        assert.ok(existed_before_2_1_withslash === true);
    })

    it('crlf2lf', function () {
        var tech = new Tech("wordpress");
        var a = __dirname + "/data/github_crlf.html";
        var data_crlf = fs.readFileSync(__dirname + "/data/github_crlf.html");
        var data_lf = fs.readFileSync(__dirname + "/data/github_lf.html");

        
        var converted_trim = tech.crlf2lf(data_crlf);

        var l1 = data_lf.length;
        var l2 = converted_trim.length;

        assert.ok(data_lf.length == converted_trim.length);
        var same = true;
        for (var i = 0; i < data_lf.length; i++) {
            if (data_lf[i] != converted_trim[i]){
                same = false;
                break;
            }
        }
        assert.ok(same); 
    })
})