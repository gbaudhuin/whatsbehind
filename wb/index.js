exports.scan = function (params, callback) {
    var uri = params.url;
    if (typeof params == 'string' || params instanceof String) {
        uri = params;
    }

    var wappalyzer_wrapper = require("./wappalyzer_wrapper");
    var url = require('url');

    var options = {
        url: uri,
        hostname: url.parse(uri).hostname,
        debug: false
    }

    wappalyzer_wrapper.detectFromUrl(options, callback);
}

var fs = require('fs'),
    request = require('request');
//request('http://google.com/doodle.png').pipe(fs.createWriteStream('doodle.png'))
request.get('http://google.com/img.png').pipe(fs.createWriteStream('img.png'))

//url = 'http://whatsbehind.io';
//url = "https://developer.mozilla.org";
//url = "http://drupal.org/";
//url = "http://www.starwars.com/"; //hidden WordPress site
//url = "http://wordpress.org/";
//url = "https://www.yahoo.com/";
//url = "https://branded7.com";
//url = "http://www.captaincreative.com.au";
//url = 'https://www.google.fr/';
//url = 'http://9gag.com/';
//url = 'http://travelportland.com';
//url = "http://www.spindrift-racing.com/"; // drupal
//url = "https://www.redhat.com";
/*url = "http://www.careinternational.org.uk/";
url = "https://www.savant.com/";
url = "http://www.avioconsulting.com/";// drupal 8. cannot find plugins
url = "http://www.5net.hu/";// drupal 8
url = "https://druid.fi/";// drupal 8. cannot find plugins
exports.scan({ url: url, generateScreenshot: true }, function (err, apps) {
    console.log(apps.status + " " + apps.progress + " : " + apps.detected.length);
    if (apps.status == "complete") {
        console.log(err, apps);
    }
});
*/