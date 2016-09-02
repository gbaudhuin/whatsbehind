var assert = require('assert');
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
})
