var assert = require('assert');
var Version = require('../version');

describe('Class Version', function () {
    it('comparison functions', function () {
        var v1 = new Version("1.0");
        var v2 = new Version("2.0");
        var comp = Version.version_compare(v1, v2);
        assert.ok(comp < 0);


        v1 = new Version('1.6.5.1rc');
        v2 = new Version('1.6.5.1');
        comp = Version.version_compare(v1, v2);
        assert.ok(comp < 0);
        assert.ok(v2.GT(v1));

        assert.ok(v2.isReleaseVersion());
        assert.ok(!v1.isReleaseVersion());
    })
})