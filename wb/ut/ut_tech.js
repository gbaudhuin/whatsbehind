var assert = require('assert');
var request = require('request');
var fs = require('fs');
var Tech = require('../tech');
var Version = require('../version');

describe('Class Tech', function() {
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

    it('isCommitedInOlderVersions', function () {
        var tech = new Tech("wordpress");
        var existed_before_2 = tech.isCommitedInOlderVersions("wp-includes/js/tinymce/themes/advanced/images/numlist.gif", new Version("2.0"));
        var existed_before_2_1 = tech.isCommitedInOlderVersions("wp-includes/js/tinymce/themes/advanced/images/numlist.gif", new Version("2.1"));
        assert.ok(existed_before_2 === false);
        assert.ok(existed_before_2_1 === true);
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
        /*
        fs.appendFile(__dirname + "/data/test_lf.html", new Buffer(converted_trim), function (err) {
            if (err) {
                console.log(err);
            } else {
                console.log("The file was saved!");
            }
        });

        try {
            request({ url: "http://www.sitepoint.com", encoding: null }, function (error, response, body) {
                var b = body.toString('utf8');
                var ff = 999;
            //    tech.crlf2lf("gg");
               if (error) done(error);
               else done();
            });
        } catch (e) {
            var ff = 9;
        }*/
    })
})
