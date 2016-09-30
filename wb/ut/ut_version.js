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
        v3 = new Version('1.6.5.1');
        comp = Version.version_compare(v1, v2);
        assert.ok(comp < 0);
        assert.ok(v2.GT(v1));
        assert.equal(v1.GT(v2), false);
        assert.ok(v2.GTOE(v1));
        assert.equal(v1.GTOE(v2), false);
        assert.ok(v2.GTOE(v3));
        assert.ok(v1.LT(v2));
        assert.equal(v2.LT(v1), false);
        assert.ok(v1.LTOE(v2));
        assert.equal(v2.LTOE(v1), false);
        assert.ok(v3.LTOE(v2));

        assert.ok(v2.isReleaseVersion());
        assert.ok(!v1.isReleaseVersion());
    })

    it('trunk version', function () {
        var v1 = new Version("1.0");
        var v2 = new Version("trunk");
        assert.ok(v2.GTOE(v1));
    })
})