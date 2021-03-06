"use strict";
const helper = require('./helper.js')
const php_version_compare = require('php_version_compare')

function Version(value) {
    this.value = value;
}

Version.prototype.toString = function () {
    return this.value;
};

Version.version_compare = function (_prev, _cur) {
    if (!_prev && !_cur) return 0;
    if (!_prev) return -1;
    if (!_cur) return 1;

    if (_prev.value == _cur.value) return 0;
    if (_prev.value.toLowerCase() == "trunk") return 1;// special case "trunk" is a probably a nightly build and is the newest version
    if (_cur.value.toLowerCase() == "trunk") return -1;// special case "trunk" is a probably a nightly build and is the newest version

    /*
    // filter _prev
    var prev = _prev.value.replace(/[_+-]/g, ".");
    prev = prev.replace(/[a-zA-Z]+/g, function (match) { return "." + match + "."; });

    prev = prev.replace(".alpha.", ".a.").toLowerCase();
    prev = prev.replace(".beta.", ".b.");
    prev = prev.replace(".pl.", ".p.");
    prev = prev.replace(".x.", "x"); // no dots. x is considered a digit

    if (/[^a-z0-9\.\#]+/.test(prev)) {
        helper.die("Invalid version format \"" + _prev.value + "\". Version should only contain alphanumeric characters, '.', '#', '+', '_' and '-'.");
    }

    // filter _cur
    var cur = _cur.value.replace(/[_+-]/g, ".");
    cur = cur.replace(/[a-zA-Z]+/g, function (match) { return "." + match + "."; });

    cur = cur.replace(".alpha.", ".a.").toLowerCase();
    cur = cur.replace(".beta.", ".b.");
    cur = cur.replace(".pl.", ".p.");
    cur = cur.replace(".x.", "x"); // no dots. x is considered a digit

    if (/[^a-z0-9\.\#]+/.test(cur)) {
        helper.die("Invalid version format \"" + _cur.value + "\". Version should only contain alphanumeric characters, '.', '#', '+', '_' and '-'.");
    }

    var a = ["a", "b", "rc", "#", "p", "dev"];

    var parts1 = prev.split('.');
    var parts2 = cur.split('.');

    while (parts1.length < parts2.length) parts1.push("0");
    while (parts2.length < parts1.length) parts2.push("0");

    for (var i = 0; i < parts1.length; i++) {
        var p1 = parts1[i];
        var p2 = parts2[i];

        var p1_numeric = /\d/.test(p1);
        var p2_numeric = /\d/.test(p2);

        if (p1_numeric && p2_numeric) {
            var p1int = parseInt(p1);
            var p2int = parseInt(p2);
            if (p1int < p2int) return -1;
            if (p1int > p2int) return 1;
        }
        else if (p1_numeric && !p2_numeric) {
            if (p2 === "x") return -1; // special case. e.g: 1.2.x is a probably a nightly build and is newer than 1.2.3
            else return 1;
        }
        else if (!p1_numeric && p2_numeric) {
            if (p1 === "x") return 1; // special case. e.g: 1.2.x is a probably a nightly build and is newer than 1.2.3
            else return -1;
        }
        else {
            var pos1 = -1;
            var pos2 = -1;
            for (var j = 0; j < a.length; j++) {
                if (p1 === a[j]) pos1 = j;
                if (p2 === a[j]) pos2 = j;
            }
            if (pos1 < pos2) return -1;
            else if (pos1 > pos2) return 1;
            else {
                var c = p1.localeCompare(p2);
                if (c !== 0) return c;
            }
        }
    }

    return 0;*/

    let ret = php_version_compare(_prev.value, _cur.value)
    return ret
};

/**
* Check if current version is strictly greater than another one.
*/
Version.prototype.GT = function (other) {
    if (Version.version_compare(this, other) > 0) return true;
    return false;
};

/**
* Check if current version is greater or equal to another one.
*/
Version.prototype.GTOE = function (other) {
    if (Version.version_compare(this, other) >= 0) return true;
    return false;
};

/**
* Check if current version is strictly lesser than another one.
*/
Version.prototype.LT = function (other) {
    if (Version.version_compare(this, other) < 0) return true;
    return false;
};

/**
* Check if current version is lesser or equal to another one.
*/
Version.prototype.LTOE = function (other) {
    if (Version.version_compare(this, other) <= 0) return true;
    return false;
};

/**
* Check if current version is equal to another one.
*/
Version.prototype.EQ = function (other) {
    if (Version.version_compare(this, other) === 0) return true;
    return false;
};

Version.prototype.isReleaseVersion = function () {
    if (!this.value) return false;

    var sanitized = this.value.replace(/[_+-]/g, ".");
    sanitized = sanitized.replace(/[a-zA-Z]+/g, function (match) { return "." + match + "."; });

    sanitized = sanitized.replace(".alpha.", ".a.").toLowerCase();
    sanitized = sanitized.replace(".beta.", ".b.");
    sanitized = sanitized.replace(".pl.", ".p.");

    if (/[^a-z0-9\.\#]+/.test(sanitized)) {
        helper.die("Invalid version format \"" + this.value + "\". Version should only contain alphanumeric characters, '.', '#', '+', '_' and '-'.");
    }

    var a = ["dev", "a", "b", "rc", "#", "p"];
    for (var j = 0; j < a.length; j++) {
        if (sanitized.indexOf("." + a[j] + ".") !== -1) return false;
    }

    return true;
};

// export the class
module.exports = Version;