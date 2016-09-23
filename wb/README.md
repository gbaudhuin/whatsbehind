# WhatsBehind
A module to scan technologies used by websites.

Forked from Wappalyzer.

WhatsBehind scans entire websites and finds technologies that Wappalyzer is unable to detect in single pages.

WhatsBehind purpose is to find all possible and sometimes hard-to-detect technologies along with their precise versions (release, RC, beta, etc.), their plugins, and their themes (for CMSs).

WhatsBehind knows what files were modified, added and deleted in each version of technologies. A smart algorithm prioritize lookup order to quickly identify these files in websites, with the smallest possible number of queries.

Building and Installing
-----------------------

```shell
npm install whatsbehind
```

Author
------

[Guillaume Baudhuin](https://github.com/gbaudhuin)

License
-------

*Licensed under the [GPL3](https://www.gnu.org/licenses/gpl-3.0.txt).*
