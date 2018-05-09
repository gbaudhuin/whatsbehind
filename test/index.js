/* eslint require-jsdoc: off */

const assert = require('assert');
const describe = require('mocha').describe; // avoid eslint warnings
const it = require('mocha').it; // avoid eslint warnings
const Scanner = require('../src/index');
const requestErrors = require('request-promise/errors');
const proxyquire = require('proxyquire');

const URL = 'fake url';

describe('Scanner', () => {
  describe('constructor', ()  => {
    it('initialize variables', () => {
      const progressCallback = () => {};
      const body = { body: 'blabla' };
      const scanner = new Scanner(URL, progressCallback, body);
      assert.equal(scanner.url, URL);
      assert.deepEqual(scanner.progressCallback, progressCallback);
      assert.deepEqual(scanner.homepageBody, body);
      assert.equal(scanner.httpStatus, null);
      assert.equal(scanner.networkError, null);
      assert.equal(scanner.apps, null);
      assert.equal(scanner.seo, null);
    })
  })

  describe('start', () => {
    const CURRENT_DATE = new Date();
    const getMockScanner = (seoScan = null) => {
      const Scanner = proxyquire('../src/index.js', {
        './seoScan': seoScan || (async () => {
          return {};
        }),
        './mobileScan': {
          scanUrl: () => {}
        },
        './languageScan': {
          scanUrl: () => {}
        }
      })
      const scanner = new Scanner(URL);
      scanner.getCurrentDate = () => CURRENT_DATE;
      scanner.checkHttpStatus = () => true;
      scanner.wappalyze = () => {};
      scanner.deepScan = () => {};
      scanner.reportProgress = () => {};
      return scanner;
    }

    it('update scanDate with getCurrentDate result', () => {
      const scanner = getMockScanner();
      let getCurrentDateCalled = false;
      scanner.getCurrentDate = () => {
        getCurrentDateCalled = true;
        return CURRENT_DATE;
      }
      scanner.start();
      assert(getCurrentDateCalled);
      assert.equal(scanner.scanDate, CURRENT_DATE);
    })

    it('calls checkHttpStatus', () => {
      const scanner = getMockScanner();
      let checkHttpStatusCalled = false;
      scanner.checkHttpStatus = () => {
        checkHttpStatusCalled = true;
        return true;
      }
      scanner.start();
      assert(checkHttpStatusCalled);
    });

    it('calls reportProgress if checkHttpStatus return false', (done) => {
      const scanner = getMockScanner();
      let reportProgressCalled = false;
      scanner.reportProgress = (status, inStepProgress, descriptionOverride) => {
        assert.equal(status, 'init');
        assert.equal(inStepProgress, 100);
        assert(!descriptionOverride);
        reportProgressCalled = true;
      }
      scanner.checkHttpStatus = () => {
        return false;
      }
      scanner.start()
        .then(() => {
          done(new Error('Should not resolve'));
        })
        .catch(() => {
          assert(reportProgressCalled);
          done();
        })
        .catch(done);
    })

    it('stop execution if checkHttpStatus return false', (done) => {
      const scanner = getMockScanner();
      scanner.checkHttpStatus = () => {
        return false;
      }
      scanner.wappalyze = () => {
        done(new Error('wappalyze should not be called'));
      }
      scanner.deepScan = () => {
        done(new Error('deepScan should not be called'));
      }
      scanner.start()
        .then(() => {
          done(new Error('Should not resolve'));
        })
        .catch(() => {
          done();
        })
        .catch(done);
    });

    it('calls wappalyze', (done) => {
      const scanner = getMockScanner();

      let checkHttpStatusCalled = false;
      scanner.checkHttpStatus = () => {
        checkHttpStatusCalled = true;
        return true;
      }

      let wappalyzeCalled = false;
      scanner.wappalyze = () => {
        assert(checkHttpStatusCalled);
        wappalyzeCalled = true;
      }

      scanner.start()
        .then(() => {
          assert(wappalyzeCalled);
          done();
        })
        .catch(done);
    });

    it('calls seoScan', async () => {
      const scanner = getMockScanner();
      let seoScanCalled = false;
      scanner.seoScan = () => {
        seoScanCalled = true;
      };
      await scanner.start();
      assert(seoScanCalled);
    })

    it('calls deepScan', (done) => {
      const scanner = getMockScanner();

      let checkHttpStatusCalled = false;
      scanner.checkHttpStatus = () => {
        checkHttpStatusCalled = true;
        return true;
      }

      let wappalyzeCalled = false;
      scanner.wappalyze = () => {
        assert(checkHttpStatusCalled);
        wappalyzeCalled = true;
      }

      let deepScanCalled = false;
      scanner.deepScan = () => {
        assert(wappalyzeCalled);
        deepScanCalled = true;
      }

      scanner.start()
        .then(() => {
          assert(deepScanCalled);
          done();
        })
        .catch(done);
    });

    it('calls reportProgress at end', (done) => {
      const scanner = getMockScanner();

      let checkHttpStatusCalled = false;
      scanner.checkHttpStatus = () => {
        checkHttpStatusCalled = true;
        return true;
      }

      let wappalyzeCalled = false;
      scanner.wappalyze = () => {
        assert(checkHttpStatusCalled);
        wappalyzeCalled = true;
      }

      let seoScanCalled = false;
      scanner.seoScan = () => {
        assert(wappalyzeCalled);
        seoScanCalled = true;
      }

      let mobileScanCalled = false;
      scanner.mobileScan = () => {
        assert(seoScanCalled);
        mobileScanCalled = true;
      }

      let languageScanCalled = false;
      scanner.languageScan = () => {
        assert(mobileScanCalled);
        languageScanCalled = true;
      }

      let deepScanCalled = false;
      scanner.deepScan = () => {
        assert(languageScanCalled);
        deepScanCalled = true;
      }

      let reportProgressCalled = false;
      scanner.reportProgress = (status, inStepProgress, descriptionOverride) => {
        assert(deepScanCalled);
        assert.equal(status, 'complete');
        assert.equal(inStepProgress, 100);
        assert.equal(descriptionOverride, 'Scan complete');
        reportProgressCalled = true;
      }

      scanner.start()
        .then(() => {
          assert(reportProgressCalled);
          done();
        })
        .catch(done);
    });

    it('resolve with last progress', (done) => {
      const progress = {
        progress: 'something'
      };

      const scanner = getMockScanner();
      scanner.reportProgress = () => progress;

      scanner.start()
        .then((result) => {
          assert.deepEqual(result, progress);
          done();
        })
        .catch(done);
    });
  })

  describe('getCurrentDate', () => {
    it('returns the current date', () => {
      const scanner = new Scanner(URL);
      assert.deepEqual(scanner.getCurrentDate(), new Date());
    })
  })

  describe('checkHttpStatus', () => {
    const RESPONSE = {
      statusCode: 200,
      body: 'body'
    };
    const getMockScanner = (requestError) => {
      const Scanner = proxyquire('../src/index', {
        './httpRequest': {
          execute: () => {
            if (requestError) {
              throw requestError;
            }
            return RESPONSE;
          }
        }
      });
      return new Scanner(URL);
    }

    it('calls httpRequest.execute', async () => {
      let httpRequestCalled = false;
      const Scanner = proxyquire('../src/index', {
        './httpRequest': {
          execute: (url) => {
            assert.equal(url, URL);
            httpRequestCalled = true;
            return RESPONSE;
          }
        }
      });
      const scanner = new Scanner(URL);
      await scanner.checkHttpStatus();
      assert(httpRequestCalled);
    });

    it('updates httpStatus', async () => {
      const scanner = getMockScanner();
      await scanner.checkHttpStatus();
      assert.equal(scanner.httpStatus, RESPONSE.statusCode);
    });

    it('updates homepageBody if not set', async () => {
      const scanner = getMockScanner();
      assert(!scanner.homepageBody);
      await scanner.checkHttpStatus();
      assert.equal(scanner.homepageBody, RESPONSE.body);
    });

    it('does not update homepageBody if already set', async () => {
      const body = 'already have a body';
      assert.notEqual(body, RESPONSE.body);
      const scanner = getMockScanner();
      scanner.homepageBody = body;
      await scanner.checkHttpStatus();
      assert.equal(scanner.homepageBody, body);
    });

    it('returns true on success', async () => {
      const scanner = getMockScanner();
      assert(scanner.checkHttpStatus());
    });

    it('updates httpStatus on StatusCodeError', async () => {
      const error = new requestErrors.StatusCodeError();
      error.statusCode = 999;
      const scanner = getMockScanner(error);
      await scanner.checkHttpStatus();
      assert.equal(scanner.httpStatus, error.statusCode);
    });

    it('does not update httpStatus on other error', async () => {
      const error = new Error('WTF');
      const scanner = getMockScanner(error);
      await scanner.checkHttpStatus();
      assert(!scanner.httpStatus);
    });

    it('set networkError to DNS ERROR on ENOTFOUND error', async () => {
      const error = {
        cause: {
          code: 'ENOTFOUND'
        }
      };
      const scanner = getMockScanner(error);
      await scanner.checkHttpStatus();
      assert.equal(scanner.networkError, 'DNS ERROR');
    });

    it('set networkError to UNKOWN ERROR on other error', async () => {
      const error = {
        cause: {
          code: 'WTF'
        }
      };
      const scanner = getMockScanner(error);
      await scanner.checkHttpStatus();
      assert.equal(scanner.networkError, 'UNKOWN ERROR');
    });

    it('returns false on failure', async () => {
      const scanner = getMockScanner(new Error('WTF'));
      assert(!await scanner.checkHttpStatus());
    });
  })

  describe('wappalyze', () => {
    it('instantiate Wappalyzer', async () => {
      const EXPECTED_OPTIONS = {
        debug: false,
        delay: 500,
        maxDepth: 1,
        maxUrls: 1,
        maxWait: 5000,
        recursive: false,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36',
      };

      let constructorCalled = false;
      const Scanner = proxyquire('../src/index', {
        wappalyzer: class Wappalyzer {
          constructor(url, options) {
            assert.equal(url, URL);
            assert.deepEqual(options, EXPECTED_OPTIONS);
            constructorCalled = true;
          }
          async analyze() { }
        }
      });
      const scanner = new Scanner(URL);
      await scanner.wappalyze();
      assert(constructorCalled);
    });

    it('calls reportProgress on log (fetch)', async () => {
      const Scanner = proxyquire('../src/index', {
        wappalyzer: class Wappalyzer {
          constructor() { }
          async analyze() {
            this.log(' fetch;');
          }
        }
      });
      const scanner = new Scanner(URL);
      let reportProgressCalled = false;
      scanner.reportProgress = (status, inStepProgress) => {
        assert.equal(status, 'fetch');
        assert.equal(inStepProgress, 0);
        reportProgressCalled = true;
      }
      await scanner.wappalyze();
      assert(reportProgressCalled);
    })

    it('calls reportProgress on log (analyze)', async () => {
      const Scanner = proxyquire('../src/index', {
        wappalyzer: class Wappalyzer {
          constructor() { }
          async analyze() {
            this.log('browser.visit start');
          }
        }
      });
      const scanner = new Scanner(URL);
      let reportProgressCalled = false;
      scanner.reportProgress = (status, inStepProgress) => {
        assert.equal(status, 'analyze');
        assert.equal(inStepProgress, 0);
        reportProgressCalled = true;
      }
      await scanner.wappalyze();
      assert(reportProgressCalled);
    })

    it('calls analyze on Wappalyzer', async () => {
      let analyzeCalled = false;
      const Scanner = proxyquire('../src/index', {
        wappalyzer: class Wappalyzer {
          constructor() { }
          async analyze() {
            analyzeCalled = true;
          }
        }
      });
      const scanner = new Scanner(URL);
      await scanner.wappalyze();
      assert(analyzeCalled);
    })

    it('updates apps', async () => {
      const APPS = { apps: 'something' };

      const Scanner = proxyquire('../src/index', {
        wappalyzer: class Wappalyzer {
          constructor() { }
          async analyze() {
            return APPS;
          }
        }
      });
      const scanner = new Scanner(URL);
      await scanner.wappalyze();
      assert.deepEqual(scanner.apps, APPS);
    })
  })

  describe('seoScan', () => {
    const SEO_SCAN_PROGRESS = 0.5;
    const SEO_SCAN_RESULT = {
      something: 'pouet'
    };

    const getMockScanner = () => {
      const Scanner = proxyquire('../src/index', {
        './seoScan': async (url, progressCallback) => {
          assert.equal(url, URL);
          progressCallback(SEO_SCAN_PROGRESS, SEO_SCAN_RESULT);
          assert(progressCallback);
          return SEO_SCAN_RESULT;
        }
      });
      const scanner = new Scanner(URL);
      scanner.scanDate = new Date();
      return scanner;
    }

    it('calls seoScan', () => {
      let seoScanCalled = false;
      const Scanner = proxyquire('../src/index', {
        './seoScan': async (url, progressCallback) => {
          assert.equal(url, URL);
          assert(progressCallback);
          seoScanCalled = true;
          return {};
        }
      });
      const scanner = new Scanner(URL);
      scanner.scanDate = new Date();
      scanner.seoScan();
      assert(seoScanCalled);
    })

    it('calls report progress', async () => {
      const scanner = getMockScanner();
      let reportProgressCalled = 0;
      scanner.reportProgress = (status, inStepProgress, descriptionOverride) => {
        assert.equal(status, 'seo');
        assert.equal(inStepProgress, reportProgressCalled === 0 ? 0 : SEO_SCAN_PROGRESS * 100);
        assert(!descriptionOverride);
        reportProgressCalled++;
      }
      await scanner.seoScan();
      assert(reportProgressCalled, 2);
    })

    it('updates set with seoScan results', async () => {
      const scanner = getMockScanner();
      await scanner.seoScan();
      assert.deepEqual(scanner.seo, SEO_SCAN_RESULT);
    })
  })

  describe('deepScan', () => {
    const TECH_APPS = [];
    for (let i = 0; i < 3; i++) {
      TECH_APPS.push({
        name: 'appName' + i
      })
    }

    const getMockScanner = () => {
      const Scanner = proxyquire('../src/index', {
        './tech': class Tech {
          constructor() {}
          loadVersions() {}
          findRoots() {}
        }
      });

      const scanner = new Scanner(URL);
      scanner.techApps = TECH_APPS;
      scanner.initializeDeepScan = () => {};
      scanner.deepScanApp = () => {};
      scanner.findPlugins = () => {};
      return scanner;
    }

    it('calls initializeDeepScan', async () => {
      const scanner = new Scanner(URL);
      scanner.techApps = [];
      let initializeDeepScanCalled = false;
      scanner.initializeDeepScan = () => {
        initializeDeepScanCalled = true;
      }
      await scanner.deepScan();
      assert(initializeDeepScanCalled);
    });

    it('instantiate Tech for each techApp', async () => {
      let techIndex = 0
      const Scanner = proxyquire('../src/index', {
        './tech': class Tech {
          constructor(appName) {
            assert.equal(appName, TECH_APPS[techIndex++]);
          }
          loadVersions() {}
          findRoots() {}
        }
      });
      const scanner = new Scanner(URL);
      scanner.initializeDeepScan = () => {};
      scanner.techApps = TECH_APPS;
      await scanner.deepScan();
      assert.equal(techIndex, TECH_APPS.length);
    });

    it('calls findRoots for each techApp', async () => {
      let findRootsIndex = 0
      const Scanner = proxyquire('../src/index', {
        './tech': class Tech {
          constructor() { }
          loadVersions() {}
          findRoots(url, homepageBody) {
            assert.equal(url, URL);
            assert.deepEqual(homepageBody, scanner.homepageBody);
            findRootsIndex++;
          }
        }
      });
      const scanner = new Scanner(URL);
      scanner.initializeDeepScan = () => {};
      scanner.techApps = TECH_APPS;
      await scanner.deepScan();
      assert.equal(findRootsIndex, TECH_APPS.length);
    });

    it('calls deepScanApp for a techApp without version', async () => {
      let deepScanAppIndex = 0;
      const scanner = getMockScanner();
      scanner.deepScanApp = (tech, app) => {
        assert.deepEqual(app, TECH_APPS[deepScanAppIndex++]);
      }
      await scanner.deepScan();
      assert.equal(deepScanAppIndex, TECH_APPS.length);
    });

    it('does not call deepScanApp for a techApp with version', async () => {
      const TECH_APPS = [];
      for (let i = 0; i < 3; i++) {
        TECH_APPS.push({
          name: 'appName' + i,
          version: 'something'
        })
      }

      const scanner = getMockScanner();
      scanner.deepScanApp = () => {
        throw new Error('Should not be called');
      }
      await scanner.deepScan();
    });

    it('calls findPlugins for each techApp', async () => {
      let findPluginsIndex = 0;
      const scanner = getMockScanner();
      scanner.findPlugins = (tech, app) => {
        assert.deepEqual(app, TECH_APPS[findPluginsIndex++]);
      }
      await scanner.deepScan();
      assert.equal(findPluginsIndex, TECH_APPS.length);
    });

    it('does not throw error if Tech constructor fails', async () => {
      const Scanner = proxyquire('../src/index', {
        './tech': class Tech {
          constructor() {
            throw new Error('WTF');
          }
        }
      });
      const scanner = new Scanner(URL);
      scanner.initializeDeepScan = () => {};
      scanner.techApps = TECH_APPS;
      await scanner.deepScan();
    });

    it('does not throw error if findRoots fails', async () => {
      const Scanner = proxyquire('../src/index', {
        './tech': class Tech {
          constructor() { }
          loadVersions() {}
          findRoots() {
            throw new Error('WTF');
          }
        }
      });
      const scanner = new Scanner(URL);
      scanner.initializeDeepScan = () => {};
      scanner.techApps = TECH_APPS;
      await scanner.deepScan();
    });

    it('does not throw error if deepScanApp fails', async () => {
      const scanner = getMockScanner();
      scanner.deepScanApp = () => {
        throw new Error('WTF');
      }
      await scanner.deepScan();
    });

    it('does not throw error if findPlugins fails', async () => {
      const scanner = getMockScanner();
      scanner.findPlugins = () => {
        throw new Error('WTF');
      }
      await scanner.deepScan();
    });
  })

  describe('initializeDeepScan', () => {
    it('updates techApps with known tech', () => {
      const scanner = new Scanner(URL);
      scanner.apps = {
        applications: [{
          name: 'WordPress',
          categories: [{1: 'CMS'}]
        }, {
          name: 'Unknown Tech',
          categories: []
        }]
      };
      scanner.initializeDeepScan();
      assert.deepEqual(scanner.techApps, scanner.apps.applications.slice(0, 1));
    });

    it('updates the categories array for each app', () => {
      const scanner = new Scanner(URL);
      scanner.apps = {
        applications: [{
          name: 'WordPress',
          categories: [{1: 'CMS'}]
        }, {
          name: 'Drupal',
          categories: [{1: 'CMS'}]
        }]
      };
      scanner.initializeDeepScan();
      for (let i = 0; i < scanner.techApps.length; i++) {
        assert.deepEqual(scanner.techApps[i].categories, [1]);
      }
    });

    it('calls addTechApp if CMS are not in the initial apps', () => {
      const scanner = new Scanner(URL);
      scanner.apps = {
        applications: []
      };

      const NAMES = ['WordPress', 'Drupal'];
      const ICONS = ['WordPress.svg', 'Drupal.png'];
      const WEBSITES = ['http://wordpress.org', 'http://drupal.org'];
      const CATEGORIES = [[1, 11], [1]];

      let index = 0;
      scanner.addTechApp = (name, confidence, icon, website, categories) => {
        assert.deepEqual(name, NAMES[index]);
        assert.deepEqual(confidence, 100);
        assert.deepEqual(icon, ICONS[index]);
        assert.deepEqual(website, WEBSITES[index]);
        assert.deepEqual(categories, CATEGORIES[index]);
        index++;
      }
      scanner.initializeDeepScan();
      assert.equal(index, 2);
    })

    it('doest not call addTechApp if CMS are in the initials apps', () => {
      const scanner = new Scanner(URL);
      scanner.apps = {
        applications: [{
          name: 'WordPress',
          categories: [{1: 'CMS'}]
        }]
      };

      let addTechAppCalled = false;
      scanner.addTechApp = () => {
        addTechAppCalled = true;
      }
      scanner.initializeDeepScan();
      assert(!addTechAppCalled);
    })
  })

  describe('addTechApp', () => {
    it('adds an app to techApps', () => {
      const app = {
        name: 'appName',
        confidence: 56,
        icon: 'icon',
        website: 'website',
        categories: []
      };

      const scanner = new Scanner(URL);
      scanner.techApps = [];
      scanner.addTechApp(app.name, app.confidence, app.icon, app.website, app.categories);
      assert.deepEqual(scanner.techApps, [app]);
    });
  })

  describe('deepScanApp', () => {
    const getScanner = () => {
      const scanner = new Scanner(URL);
      scanner.scanDate = new Date();
      scanner.techApps = [];
      scanner.apps = {
        applications: []
      };
      return scanner;
    }

    it('calls deepScan on tech', () => {
      let deepScanCalled = false;
      const app = { };
      const tech = {
        deepScan: () => {
          deepScanCalled = true;
        }
      }
      const scanner = getScanner();
      scanner.deepScanApp(tech, app);
      assert(deepScanCalled);
    });

    it('calls reportProgress on deepScan progress', () => {
      const app = {
        name: 'appName'
      };
      const tech = {
        deepScan: (resultCallback, progressCallback) => {
          progressCallback(50);
        }
      }

      const scanner = getScanner();
      let reportProgressCalled = false;
      scanner.reportProgress = (status, inStepProgress, descriptionOverride) => {
        assert.equal(descriptionOverride, 'Looking for hidden ' + app.name + '.')
        reportProgressCalled = true;
      }
      scanner.deepScanApp(tech, app);
      assert(reportProgressCalled);
    });

    it('calls reportProgress on deepScan result', () => {
      const app = {
        name: 'appName'
      };
      const tech = {
        deepScan: (resultCallback) => {
          resultCallback(null, {
            versions: [],
            proofs: [],
            status: 'ok'
          });
        }
      }

      const scanner = getScanner();
      let reportProgressCalled = false;
      scanner.reportProgress = (status, inStepProgress, descriptionOverride) => {
        assert.equal(descriptionOverride, 'Looking for hidden ' + app.name + '.')
        reportProgressCalled = true;
      }
      scanner.deepScanApp(tech, app);
      assert(reportProgressCalled);
    });

    it('add app to apps if not present', () => {
      const app = {
        name: 'appName'
      };
      const tech = {
        deepScan: (resultCallback) => {
          resultCallback(null, {
            versions: [],
            proofs: [],
            status: 'ok'
          });
        }
      }

      const scanner = getScanner();
      scanner.deepScanApp(tech, app);
      assert.deepEqual(scanner.apps.applications, [app]);
    });

    it('does not add app to apps if present', () => {
      const app = {
        name: 'appName'
      };
      const tech = {
        deepScan: (resultCallback) => {
          resultCallback(null, {
            versions: [],
            proofs: [],
            status: 'ok'
          });
        }
      }

      const scanner = getScanner();
      scanner.apps.applications = [app];
      scanner.deepScanApp(tech, app);
      assert.deepEqual(scanner.apps.applications, [app]);
    });

    it('does not add app to apps on failure', async () => {
      const ERROR = new Error('WTF');
      const app = {
        name: 'appName'
      };
      const tech = {
        deepScan: (resultCallback) => {
          resultCallback(ERROR, {
            versions: [],
            proofs: [],
            status: 'fail'
          });
        }
      }

      let errorThrown = false;
      const scanner = getScanner();
      try {
        await scanner.deepScanApp(tech, app);
      } catch (err) {
        assert.deepEqual(err, ERROR);
        errorThrown = true;
      }
      assert.deepEqual(scanner.apps.applications, []);
      assert(errorThrown);
    });

    it('calls setDetected on success', async () => {
      const VERSIONS = [1, 2, 3];
      const PROOFS = [4, 5, 6];
      const app = {
        name: 'appName'
      };
      const tech = {
        deepScan: (resultCallback) => {
          resultCallback(null, {
            versions: VERSIONS,
            proofs: PROOFS,
            status: 'ok'
          });
        }
      }

      let setDetectedCalled = false;
      const scanner = getScanner();
      scanner.setDetected = (pApp, pattern, type, value) => {
        assert.deepEqual(app, pApp);
        assert.deepEqual(pattern, {
          version: VERSIONS,
          regex: '.*'
        })
        assert.equal(type, 'file');
        assert.equal(value, PROOFS);
        setDetectedCalled = true;
      }
      await scanner.deepScanApp(tech, app);
      assert(setDetectedCalled);
    });

    it('does not call setDetected on failure', async () => {
      const app = {
        name: 'appName'
      };
      const tech = {
        deepScan: (resultCallback) => {
          resultCallback({}, {
            versions: [],
            proofs: [],
            status: 'fail'
          });
        }
      }

      let errorThrown = false;
      let setDetectedCalled = false;
      const scanner = getScanner();
      scanner.setDetected = () => {
        setDetectedCalled = true;
      }
      try {
        await scanner.deepScanApp(tech, app);
      } catch (err) {
        errorThrown = true;
      }
      assert(errorThrown);
      assert(!setDetectedCalled);
    });

    it('resolve on success', async () => {
      const app = {
        name: 'appName'
      };
      const tech = {
        deepScan: (resultCallback) => {
          resultCallback(null, {
            versions: [],
            proofs: [],
            status: 'ok'
          });
        }
      }

      let errorThrown = false;
      const scanner = getScanner();
      try {
        await scanner.deepScanApp(tech, app);
      } catch (err) {
        errorThrown = true;
      }
      assert(!errorThrown);
    });

    it('reject on failure', async () => {
      const ERROR = new Error('WTF');
      const app = {
        name: 'appName'
      };
      const tech = {
        deepScan: (resultCallback) => {
          resultCallback(ERROR, {
            versions: [],
            proofs: [],
            status: 'fail'
          });
        }
      }

      let errorThrown = false;
      const scanner = getScanner();
      try {
        await scanner.deepScanApp(tech, app);
      } catch (err) {
        assert.deepEqual(err, ERROR);
        errorThrown = true;
      }
      assert(errorThrown);
    });
  })

  describe('setDetected', () => {
    const PROOFS =  [{
      root: 'http://www.whatsbehind.io',
      path: 'path01',
      status: '85'
    }, {
      root: 'http://www.whatsbehind.io',
      path: 'path02',
      status: '51'
    }];

    const PATTERN = {
      version: ['1', '2', '3'],
      regex: '.*'
    };

    it('updates proofs', () => {
      const scanner = new Scanner(URL);
      const app = { };
      scanner.setDetected(app, PATTERN, 'file', PROOFS);
      assert.deepEqual(app.proofs, PROOFS);
    });

    it('updates version to max release version', () => {
      const scanner = new Scanner(URL);
      const app = { };

      scanner.setDetected(app, PATTERN, 'file', PROOFS);
      assert.equal(app.version, 3);
    });

    it('updates versions to pattern.version', () => {
      const scanner = new Scanner(URL);
      const app = { };

      scanner.setDetected(app, PATTERN, 'file', PROOFS);
      assert.deepEqual(app.versions, PATTERN.version);
    })
  })

  describe('findPlugins', () => {
    it('calls findPlugins on tech', async () => {
      let findPluginsCalled = false;
      const app = {
        version: 123
      };
      const tech = {
        findPlugins: (version, progressCallback, resultCallback) => {
          assert(version, app.version);
          findPluginsCalled = true;
          resultCallback();
        }
      }
      const scanner = new Scanner(URL);
      scanner.scanDate = new Date();
      scanner.techApps = [];
      await scanner.findPlugins(tech, app);
      assert(findPluginsCalled);
    });

    it('updates app plugins on progress', async () => {
      const DETECTED_PLUGINS = {
        detected: 'plugins'
      };
      const app = {
        version: 123,
        plugins: null
      };
      const tech = {
        findPlugins: (version, progressCallback, resultCallback) => {
          progressCallback(DETECTED_PLUGINS)
          assert.deepEqual(app.plugins, DETECTED_PLUGINS);
          resultCallback();
        }
      }
      const scanner = new Scanner(URL);
      scanner.scanDate = new Date();
      scanner.techApps = [];
      await scanner.findPlugins(tech, app);
    });

    it('calls reportProgress on progress', async () => {
      const DETECTED_PLUGINS = {
        detected: 'plugins'
      };
      const app = {
        name: 'appName',
        version: 123
      };
      const tech = {
        findPlugins: (version, progressCallback, resultCallback) => {
          progressCallback(DETECTED_PLUGINS, 0);
          resultCallback(DETECTED_PLUGINS);
        }
      }
      const scanner = new Scanner(URL);
      scanner.deepScanProgress = 0;
      scanner.techApps = ['techapp01', 'techapp02'];
      let reportProgressCalled = false;
      scanner.reportProgress = (status, inStepProgress, descriptionOverride) => {
        if (!reportProgressCalled) {
          assert.equal(status, 'deepscan');
          assert.equal(inStepProgress, 0);
          assert.equal(descriptionOverride, 'Looking for ' + app.name + ' plugins.')
          reportProgressCalled = true;
        }
      }
      await scanner.findPlugins(tech, app);
      assert(reportProgressCalled);
    });

    it('updates app plugins on result', async () => {
      const DETECTED_PLUGINS = {
        detected: 'plugins'
      };
      const app = {
        version: 123,
        plugins: null
      };
      const tech = {
        findPlugins: (version, progressCallback, resultCallback) => {
          progressCallback(null)
          resultCallback(DETECTED_PLUGINS);
        }
      }
      const scanner = new Scanner(URL);
      scanner.scanDate = new Date();
      scanner.techApps = [];
      await scanner.findPlugins(tech, app);
      assert.deepEqual(app.plugins, DETECTED_PLUGINS);
    });

    it('calls reportProgress on result', async () => {
      const DETECTED_PLUGINS = {
        detected: 'plugins'
      };
      const app = {
        name: 'appName',
        version: 123
      };
      const tech = {
        findPlugins: (version, progressCallback, resultCallback) => {
          progressCallback(DETECTED_PLUGINS, 0);
          resultCallback(DETECTED_PLUGINS);
        }
      }
      const scanner = new Scanner(URL);
      scanner.deepScanProgress = 0;
      scanner.techApps = ['techapp01', 'techapp02'];
      let reportProgressCalled = 0;
      scanner.reportProgress = (status, inStepProgress, descriptionOverride) => {
        assert.equal(status, 'deepscan');
        assert.equal(inStepProgress, reportProgressCalled === 0 ? 0 : 33.33333333333333);
        assert.equal(descriptionOverride, 'Looking for ' + app.name + ' plugins.')
        reportProgressCalled++;
      }
      await scanner.findPlugins(tech, app);
      assert.equal(reportProgressCalled, 2);
    });

    it('resolve on result', (done) => {
      const scanner = new Scanner(URL);
      scanner.scanDate = new Date();
      scanner.deepScanProgress = 0;
      scanner.techApps = ['techapp01', 'techapp02'];
      const app = {
        name: 'appName',
        version: 123
      };
      const tech = {
        findPlugins: (version, progressCallback, resultCallback) => {
          progressCallback();
          resultCallback();
        }
      }
      scanner.findPlugins(tech, app)
        .then(() => {
          done();
        })
        .catch(done);
    });
  })

  describe('reportProgress', () => {
    const STATUS = 'deepscan';
    const IN_STEP_PROGRESS = 50;
    const PROGRESS_DESCRIPTION = 'progress description';
    const SCAN_DATE = new Date();
    const LAST_UPDATE = new Date();
    const NETWORK_ERROR = 'network error';
    const HTTP_STATUS = 'http status';
    const SEO = {seo: 'true'};
    const MOBILE = {mobile: true};
    const LANGUAGE = {language: true};
    const DETECTED = { applications: 'anything' };

    const EXPECTED_RESULT = {
      url: URL,
      status: STATUS,
      progress: 57.5,
      progressDescription: PROGRESS_DESCRIPTION,
      scanDate: SCAN_DATE.toISOString(),
      lastUpdate: LAST_UPDATE.toISOString(),
      networkError: NETWORK_ERROR,
      httpStatus: HTTP_STATUS,
      seo: SEO,
      mobile: MOBILE,
      language: LANGUAGE,
      detected: DETECTED
    };

    const getMockScanner = (progressCallback) => {
      const scanner = new Scanner(URL, progressCallback);
      scanner.getCurrentDate = () => LAST_UPDATE;
      scanner.scanDate = SCAN_DATE;
      scanner.networkError = NETWORK_ERROR;
      scanner.httpStatus = HTTP_STATUS;
      scanner.seo = SEO;
      scanner.mobile = MOBILE;
      scanner.language = LANGUAGE;
      scanner.apps = {
        applications: DETECTED
      };

      return scanner;
    }

    it('does not fail if no progress callback', () => {
      const scanner = getMockScanner();
      scanner.reportProgress(STATUS, IN_STEP_PROGRESS, PROGRESS_DESCRIPTION);
    });

    it('returns progress object', () => {
      const scanner = getMockScanner();
      const result = scanner.reportProgress(STATUS, IN_STEP_PROGRESS, PROGRESS_DESCRIPTION);
      assert.deepEqual(result, EXPECTED_RESULT);
    });

    it('calls progress callback', () => {
      let progressCallbackCalled = false;
      const scanner = getMockScanner((progress) => {
        assert.deepEqual(progress, EXPECTED_RESULT);
        progressCallbackCalled = true;
      });
      scanner.reportProgress(STATUS, IN_STEP_PROGRESS, PROGRESS_DESCRIPTION);
      assert(progressCallbackCalled);
    });
  })

  /*it.only('une phrase à la con', async function () {
    let url = 'http://wordpress3-8.whatsbehind.io/'
    //let url = 'https://www.isatech.fr/'
    //let url = 'http://wordpress4-9-4.whatsbehind.io/'
    //let url = 'https://wptavern.com/'
    //let url = 'https://stackoverflow.com/'
    //let url = 'https://edition.cnn.com/'
    //let url = 'https://www.isatech.fr/' // vieux wordpress avec plein de plugins vérolés
    //let url = 'http://www.spindrift-racing.com/' // drupal 7
    //let url = 'http://www.starwars.com/' // wordpress caché
    //let url = 'https://druid.fi/'
    //let url = 'https://www.auchan.fr/'
    //let url = 'https://www.alibaba.com'
    // url = 'https://www.nike.com'
    // url = 'https://www.sony.com'
    //url = 'https://www.nytimes.com/'
    url = 'https://www.julianabicycles.com'
    url = 'http://www.liberty-auto.fr/'

    const scanner = new Scanner(url, (json) => {
      console.log(JSON.stringify(json, null, 2));
    })
    scanner.start();
  })*/
})
