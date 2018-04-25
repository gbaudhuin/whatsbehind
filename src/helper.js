"use strict";

exports.die = function (message) {
    var obj = { "status": "error", "error_message": message };
    console.log(JSON.stringify(obj));
    process.exit(1);
};
