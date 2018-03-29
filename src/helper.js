"use strict";

exports.die = function (message) {
    var obj = { "status": "error", "error_message": message };
    console.log(JSON.stringify(obj));
    process.exit(1);
};

exports.trimChar = function (string, charToRemove) {
    while (string.charAt(0) == charToRemove) {
        string = string.substring(1);
    }

    while (string.charAt(string.length - 1) == charToRemove) {
        string = string.substring(0, string.length - 1);
    }

    return string;
};