# WhatsBehind [![NPM version](https://img.shields.io/npm/v/gulp.svg)](https://www.npmjs.com/package/whatsbehind) [![Build Status](https://travis-ci.org/gbaudhuin/whatsbehind.svg?branch=master)](https://travis-ci.org/gbaudhuin/whatsbehind)
A node.js 6.6.0+ app/module to scan technologies used by websites.

Forked from Wappalyzer.

WhatsBehind scans entire websites and finds technologies that Wappalyzer is unable to detect in single pages.

WhatsBehind purpose is to find all possible and sometimes hard-to-detect technologies along with their precise versions (release, RC, beta, etc.), their plugins, and their themes (for CMSs).

WhatsBehind knows what files were modified, added and deleted in each version of technologies. A smart algorithm prioritize lookup order to quickly identify these files in websites, with the smallest possible number of queries.

Building and Installing
-----------------------

```shell
npm install whatsbehind
```

Usage
-----

```javascript
var wb = require('whatsbehind');
var url = "http://www.starwars.com/";// A WordPress site wappalyzer cannot detect
wb.scan(url, function (err, data) {
    // this function is called multiple times until data.status is "complete"

    if (err) {
        console.log("Error : Scan of \"" + url + "\" failed : " + err.name + ":" + err.message + ".");
        return;
    }

    if (data.status == "complete") {
        console.log("Scan completed successfully");
        console.log(data.detected);
    } else {
        console.log("Progress : " + data.progress + "% (" + data.progressDescription + ")");
    }
});
```

Author
------

[Guillaume Baudhuin](https://github.com/gbaudhuin)

License
-------

*Licensed under the [GPL3](https://www.gnu.org/licenses/gpl-3.0.txt).*
