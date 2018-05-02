const requestErrors = require('request-promise/errors');
const Wappalyzer = require('wappalyzer');

const Tech = require('./tech');
const httpRequest = require('./httpRequest');
const languageScan = require('./languageScan');
const mobileScan = require('./mobileScan');
const ScanResult = require('./scanResult');
const seoScan = require('./seoScan');
const Version = require('./version');

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
  seo: {
    start: 10,
    end: 12,
    defaultDescription: 'Analyzing SEO'
  },
  mobile: {
    start: 12,
    end: 14,
    defaultDescription: 'Analyzing Mobile Data'
  },
  language: {
    start: 14,
    end: 16,
    defaultDescription: 'Analyzing Language Data'
  },
  deepscan: {
    start: 16,
    end: 99,
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

/**
 * @summary Scan a website
 */
class Scanner {
  /**
   * @constructor
   * @summary Scan a website
   * @param {String} url - the url
   * @param {Function} progressCallback - the progress callback
   * @param {String} [homepageBody] - the homepage body
   * @returns {undefined} void
   */
  constructor(url, progressCallback, homepageBody) {
    this.url = url;
    this.progressCallback = progressCallback;
    this.homepageBody = homepageBody;
    this.httpStatus = null;
    this.networkError = null;
    this.apps = null;
    this.seo = null;
    this.mobile = null;
    this.language = null;
  }

  /**
   * @summary Start the scan
   * @returns {Promise} A promise that resolve when the scan is finished
   */
  async start() {
    this.scanDate = this.getCurrentDate();

    if (!await this.checkHttpStatus()) {
      // stop on error
      this.reportProgress('init', 100);
      return Promise.reject(new Error('unreachable URL'));
    };

    await this.wappalyze();
    await this.seoScan();
    await this.mobileScan();
    await this.languageScan();
    await this.deepScan();

    // end
    const completeReport = this.reportProgress('complete', 100, 'Scan complete');
    return Promise.resolve(completeReport);
  }

  /**
   * @summary Get the current date
   * @returns {Date} Current date
   */
  getCurrentDate() {
    return new Date();
  }

  /**
   * @summary Check if the URL is reachable & update httpStatus and homepageBody if necessary
   * @returns {Boolean} True if the URL is reachable
   */
  async checkHttpStatus() {
    try {
      const additionalOptions = {
        resolveWithFullResponse: true
      }
      const response = await httpRequest.execute(this.url, additionalOptions);
      this.httpStatus = response.statusCode;

      // update homepagebody if necessary
      this.homepageBody = this.homepageBody || response.body;
      return true;
    } catch (err) {
      if (err instanceof requestErrors.StatusCodeError) {
        this.httpStatus = err.statusCode;
      } else {
        this.networkError = err.cause && err.cause.code === 'ENOTFOUND' ? 'DNS ERROR' : 'UNKOWN ERROR';
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

    const wappalyzer = new Wappalyzer(this.url, options);
    wappalyzer.log = (message) => {
      if (message.indexOf(' fetch;') !== -1) {
        this.reportProgress('fetch', 0);
      }
      if (message.indexOf('browser.visit start') !== -1) {
        this.reportProgress('analyze', 0);
      }
    }

    this.apps = await wappalyzer.analyze()
  }

  /**
   * @summary Execute the SEO scan
   * @returns {undefined} void
   */
  async seoScan() {
    this.reportProgress('seo', 0);
    this.seo = await seoScan(this.url, (progress, result) => {
      this.seo = result;
      this.reportProgress('seo', progress * 100);
    });
  }

  /**
   * @summary Execute the mobile scan
   * @returns {undefined} void
   */
  async mobileScan() {
    this.reportProgress('mobile', 0);
    this.mobile = await mobileScan.scanUrl(this.url);
  }

  /**
   * @summary Execute the language scan
   * @returns {undefined} void
   */
  async languageScan() {
    this.reportProgress('language', 0);
    this.language = await languageScan.scanUrl(this.url);
  }

  /**
   * @summary Launch Deepscan
   * @returns {undefined} void
   */
  async deepScan() {
    this.initializeDeepScan();

    for (const app of this.techApps) {
      try {
        let tech = new Tech(app.name);
        tech.loadVersions();
        tech.findRoots(this.url, this.homepageBody)

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
    this.techApps = [];
    this.deepScanProgress = 0;

    for (const app of this.apps.applications) {
      if (Tech.allTechs.indexOf(app.name) !== -1) {
        this.techApps.push(app);
      }

      const cats = [];
      // look for a CMS
      for (const categories of app.categories) {
        for (const cat in categories) {
          cats.push(cat);
          if (cat === '1' || cat === '11' || cat === '6') { // CMS, blog ou ecommerce
            hasCMS = true;
          }
        }
      }

      // update the array format to simplify PHP exploitation : [{"1": "CMS"}, {"11": "Blogs"}] => [1, 11]
      app.categories = cats;
    }

    if (!hasCMS) {
      this.addTechApp('WordPress', 100, 'WordPress.svg', 'http://wordpress.org', [1, 11]); // {"1": "CMS"},{"11": "Blogs"}
      this.addTechApp('Drupal', 100, 'Drupal.png', 'http://drupal.org', [1]); // {"1": "CMS"}
    }
  }

  /**
   * @summary Add an application to techApps
   * @param {String} name - app name
   * @param {Number} confidence - app confidence
   * @param {String} icon - app icon
   * @param {String} website - app website
   * @param {Array<Number>} categories - app categories
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

    this.techApps.push(app)
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
      const hiddenApp = !this.apps.applications.find((application) => {
        return application.name === app.name;
      })

      let progressMessage;
      if (hiddenApp) {
        progressMessage = 'Looking for hidden ' + app.name + '.';
      } else {
        progressMessage = 'Looking for ' + app.name + ' version.';
      }

      const progressCallback = (progress) => {
        const p = this.deepScanProgress + (DEEPSCAN_RANGE_PHASE_1 / 100) * progress / this.techApps.length;
        this.reportProgress('deepscan', p, progressMessage);
      }

      const resultCallback = (err, result) => {
        this.deepScanProgress += DEEPSCAN_RANGE_PHASE_1 / this.techApps.length
        this.reportProgress('deepscan', this.deepScanProgress, progressMessage);

        if (result.status === 'fail') {
          reject(err);
          return;
        }

        if (hiddenApp) {
          this.apps.applications.push(app);
        }

        this.setDetected(app, {version: result.versions, regex: '.*'}, 'file', result.proofs);
        resolve();
      }

      tech.deepScan(resultCallback, progressCallback);
    })
  }

  /**
   * @summary Set app as detected
   * @param {Object} app - app
   * @param {Object} pattern - pattern
   * @param {String} type - type
   * @param {Array} proofs - proofs
   * @returns {undefined} void
   */
  setDetected(app, pattern, type, proofs) {
    app.proofs = proofs;

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
      const progressCallback = (detectedPlugins, pluginProgress) => {
        let p = this.deepScanProgress + (DEEPSCAN_RANGE_PHASE_2 / 100) * pluginProgress / this.techApps.length;
        app.plugins = detectedPlugins;
        this.reportProgress('deepscan', p, 'Looking for ' + app.name + ' plugins.');
      };

      const resultCallback = (detectedPlugins) => {
        this.deepScanProgress += DEEPSCAN_RANGE_PHASE_2 / this.techApps.length;

        app.plugins = detectedPlugins
        this.reportProgress('deepscan', this.deepScanProgress, 'Looking for ' + app.name + ' plugins.');
        resolve();
      };

      tech.findPlugins(app.version, progressCallback, resultCallback);
    });
  }

  /**
   * @summary Report progress
   * @param {String} status - status
   * @param {Number} inStepProgress - in step progress
   * @param {String} descriptionOverride - description override
   * @returns {Object} The progress object
   */
  reportProgress(status, inStepProgress, descriptionOverride) {
    const step = PROGRESS_STEPS[status];
    const progressDescription = descriptionOverride || step.defaultDescription;
    const progress = step.start + (((step.end - step.start) * inStepProgress) / 100);

    const scanResult = new ScanResult(
      this.url,
      status,
      progress,
      progressDescription,
      this.scanDate,
      this.getCurrentDate(),
      this.networkError,
      this.httpStatus,
      this.seo,
      this.mobile,
      this.language,
      this.apps && this.apps.applications
    );

    let scanResultData = scanResult.toData();

    if (this.progressCallback) {
      this.progressCallback(scanResultData);
    }

    return scanResultData;
  }
}


module.exports = Scanner