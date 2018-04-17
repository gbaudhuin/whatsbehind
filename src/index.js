const Wappalyzer = require('wappalyzer')
const Tech = require('./tech')
const async = require('async')
const request = require('request-promise')
const requestErrors = require('request-promise/errors');
const Version = require('./version')

const PROGRESS_STEPS = {
  init: { 
    start: 0, 
    end: 1, 
    defaultDescription: 'Starting up...' 
  },
  fetch: { 
    start: 1, 
    end: 5, 
    defaultDescription: 'Fetching page content' 
  },
  analyze: { 
    start: 5, 
    end: 10, 
    defaultDescription: 'Analyzing page content' 
  },
  deepscan: { 
    start: 10, 
    end: 100, 
    defaultDescription: 'Fine grain analysis' 
  },
  complete: { 
    start: 100, 
    end: 100, 
    defaultDescription: 'Scan complete'
  }
}

const DEEPSCAN_RANGE_PHASE_1 = 100 / 3 // phase 1 : looking for a hidden CMS or CMS version
const DEEPSCAN_RANGE_PHASE_2 = 100 - DEEPSCAN_RANGE_PHASE_1 // phase 2 : looking for plugins

class Scanner {
  /**
   * @constructor
   * @summary Scan a website
   * @param {String} url - the url
   * @param {Function} progressCallback - the progress callback
   * @param {String} [homepageBody] - the homepage body
   */
  constructor(url, progressCallback, homepageBody) {
    this.m_url = url;
    this.m_progressCallback = progressCallback;
    this.m_homepageBody = homepageBody;
    this.m_httpStatus = null;
    this.m_networkError = null;
    this.m_apps = null;
  }

  /**
   * @summary Start the scan
   * @returns {undefined} void
   */
  async start() {
    this.m_scanDate = this.getCurrentDate();

    if(!await this.checkHttpStatus()) {
      // stop on error
      this.reportProgress('init', 100);
      return Promise.reject(new Error('unreachable URL'));
    };

    await this.wappalyze();
    await this.deepScan();

    // end
    const completeReport = this.reportProgress('complete', 100, 'Scan complete');
    return Promise.resolve(completeReport);
  }

  /**
   * @summary Get the current date as ISO String
   * @returns {String} Current date as ISO String
   */
  getCurrentDate() {
    return (new Date()).toISOString();
  }

  /**
   * @summary Check if the URL is reachable & update httpStatus and homepageBody if necessary
   * @returns {Boolean} True if the URL is reachable
   */
  async checkHttpStatus() {
    const requestOptions = Tech.getReqOptions(this.m_url);
    requestOptions.resolveWithFullResponse = true;

    try {
      const response = await request(requestOptions);
      this.m_httpStatus = response.statusCode;

      // update homepagebody if necessary
      this.m_homepageBody = this.m_homepageBody || response.body;
      return true;
    } catch(err) {
      if(err instanceof requestErrors.StatusCodeError) {
        this.m_httpStatus = err.statusCode;
      } else {
        this.m_networkError = err.cause && err.cause.code === 'ENOTFOUND' ? 'DNS ERROR' : 'UNKOWN ERROR';    
      }
      
      return false;
    }
  }

  /**
   * @summary Launch Wappalyzer
   * @returns {undefined} void
   */
  async wappalyze() {  
    const options = {
      debug: false,
      delay: 500,
      maxDepth: 1,
      maxUrls: 1,
      maxWait: 5000,
      recursive: false,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36',
    };

    const wappalyzer = new Wappalyzer(this.m_url, options);
    wappalyzer.log = (message) => {
      if (message.indexOf(' fetch;') !== -1) {
        this.reportProgress('fetch', 0);
      }
      if (message.indexOf('browser.visit start') !== -1) {
        this.reportProgress('analyze', 0);
      }
    }
  
    this.m_apps = await wappalyzer.analyze()
  }

  /**
   * @summary Launch Deepscan
   * @returns {undefined} void
   */
  async deepScan() {
    this.initializeDeepScan();

    for (const app of this.m_techApps) {
      try {
        let tech = new Tech(app.name);
        tech.findRoots(this.m_url, this.m_homepageBody)

        if (!app.version) {
          await this.deepScanApp(tech, app);
        }

        await this.findPlugins(tech, app);
      } catch (err) {
        // app not found, go to next app
      }
    }
  }

  /**
   * @summary Initialize the deepScan.
   * @returns {undefined} void
   */
  initializeDeepScan() {
    let hasCMS = false;
    this.m_techApps = [];
    this.m_deepScanProgress = 0;

    for (const app of this.m_apps.applications) {
      if (Tech.allTechs.indexOf(app.name) !== -1) {
        this.m_techApps.push(app);
      }

      const cats = [];
      // look for a CMS
      for (const categories of app.categories) {
        for (const cat in categories) {
          cats.push(cat);
          if (cat == 1 || cat == 11 || cat == 6) { // CMS, blog ou ecommerce
            hasCMS = true;
          }
        }
      }

      // update the array format to simplify PHP exploitation : [{"1": "CMS"}, {"11": "Blogs"}] => [1, 11]
      app.categories = cats;
    }

    if(!hasCMS) {
      this.addTechApp('WordPress', 100, 'WordPress.svg', 'http://wordpress.org', [1, 11]); // {"1": "CMS"},{"11": "Blogs"}
      this.addTechApp('Drupal', 100, 'Drupal.png', 'http://drupal.org', [1]); // {"1": "CMS"}
    }
  }

  /**
   * @summary Add an application to techApps
   * @param {String} name 
   * @param {Number} confidence 
   * @param {String} icon 
   * @param {String} website 
   * @param {Array<Number>} categories 
   * @returns {undefined} void
   */
  addTechApp(name, confidence, icon, website, categories) {
    const app = {
      name,
      confidence,
      icon,
      website,
      categories
    };

    this.m_techApps.push(app)
  }

  /**
   * @async
   * @summary Launch a deepScan on specified app
   * @param {Tech} tech - the tech object
   * @param {Object} app - the app to scan
   * @returns {Promise} A promise that resolve when the scan is finished
   */
  async deepScanApp(tech, app) {
    return new Promise((resolve, reject) => {
      const hiddenApp = !this.m_apps.applications.find((application) => {
        return application.name === app.name;
      })

      let progressMessage;
      if (hiddenApp) {
        progressMessage = 'Looking for hidden ' + app.name + '.';
      } else {
        progressMessage = 'Looking for ' + app.name + ' version.';
      }
    
      const progressCallback = (progress) => {
        const p = this.m_deepScanProgress + (DEEPSCAN_RANGE_PHASE_1 / 100) * progress / this.m_techApps.length;
        this.reportProgress('deepscan', p, progressMessage);
      }
  
      const resultCallback = (err, result) => {
        this.m_deepScanProgress += DEEPSCAN_RANGE_PHASE_1 / this.m_techApps.length
        this.reportProgress('deepscan', this.m_deepScanProgress, progressMessage);
  
        if (result.status == 'fail') {
          reject(err);
          return;
        } 
        
        if (hiddenApp) {
          this.m_apps.applications.push(app);
        }

        this.setDetected(app, {version: result.versions, regex: ".*"}, "file", result.proofs);
        resolve();
      }

      tech.deepScan(resultCallback, progressCallback);
    })    
  }

  /**
   * @summary Set app as detected
   * @param {Object} app 
   * @param {*} pattern 
   * @param {*} type 
   * @param {*} value 
   * @returns {undefined} void
   */
  setDetected(app, pattern, type, value) {
    app.confidence = {};
    for (let v of value) {
      let uri = v.root + "/" + v.path;
      app.confidence[type + ' ' + uri] = v.status;
    }

    // get most probable version among pattern.version. pattern.version is an array
    let maxVersion = null;
    let l = pattern.version.length;
    while (l--) { // take max release version, unless no release version detected.
      if (!maxVersion) {
        maxVersion = pattern.version[l];
      } else {
        const v = pattern.version[l];
        var v1 = new Version(maxVersion);
        var v2 = new Version(v);
        if (v1.isReleaseVersion() === true) {
          if (v2.isReleaseVersion() === true) {
            if (v2.GT(v1)) {
              maxVersion = v;
            }
          }
        } else {
          if (v2.isReleaseVersion() === true) {
            maxVersion = v;
          } else {
            if (v2.GT(v1)) {
              maxVersion = v;
            }
          }
        }
      }
    }

    app.version = maxVersion;
    app.versions = pattern.version; // unlike other types, these are _possible_ versions. only one is really there.
  }

  /**
   * @summary Find plugins for specified app
   * @param {Tech} tech - the tech object
   * @param {Object} app - the app 
   * @returns {undefined} void
   */
  async findPlugins(tech, app) {
    return new Promise((resolve) => {
      let pluginsLookupProgress;

      const progressCallback = (detected_plugins, plugin_progress) => {
        let p = this.m_deepScanProgress + (DEEPSCAN_RANGE_PHASE_2 / 100) * plugin_progress / this.m_techApps.length;
        app.plugins = detected_plugins;
        this.reportProgress('deepscan', p, 'Looking for ' + app.name + ' plugins.');
      };

      const resultCallback = (detected_plugins) => {
        this.m_deepScanProgress += DEEPSCAN_RANGE_PHASE_2 / this.m_techApps.length;

        app.plugins = detected_plugins
        this.reportProgress('deepscan', this.m_deepScanProgress, 'Looking for ' + app.name + ' plugins.');
        resolve();
      };

      tech.findPlugins(app.version, progressCallback, resultCallback);
    });
  }

  /**
   * @summary Report progress
   * @param {String} status 
   * @param {Number} inStepProgress 
   * @param {String} descriptionOverride 
   * @returns {Object} The progress object
   */
  reportProgress(status, inStepProgress, descriptionOverride) {
    const step = PROGRESS_STEPS[status];
    const progressDescription = descriptionOverride || step.defaultDescription;
    const progress = step.start + (((step.end - step.start) * inStepProgress) / 100);
  
    const ret = {
      url: this.m_url,
      status,
      progress,
      progressDescription,
      scanDate: this.m_scanDate,
      lastUpdate: this.getCurrentDate(),
      networkError: this.m_networkError,
      httpStatus: this.m_httpStatus,
      detected: this.m_apps && this.m_apps.applications
    }
    
    if (this.m_progressCallback) {
      this.m_progressCallback(ret)
    }
  
    return ret
  }
}


module.exports = Scanner