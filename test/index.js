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
      assert.equal(scanner.m_url, URL);
      assert.deepEqual(scanner.m_progressCallback, progressCallback);
      assert.deepEqual(scanner.m_homepageBody, body);
      assert.equal(scanner.m_httpStatus, null);
      assert.equal(scanner.m_networkError, null);
      assert.equal(scanner.m_apps, null);
    })
  })

  describe('start', () => {
    const CURRENT_DATE = 'date';
    const getMockScanner = () => {
      const scanner = new Scanner(URL);
      scanner.getCurrentDate = () => CURRENT_DATE;
      scanner.checkHttpStatus = () => true;
      scanner.wappalyze = () => {};
      scanner.deepScan = () => {};
      scanner.reportProgress = () => {};
      return scanner;
    }

    it('update m_scanDate with getCurrentDate result', () => {
      const scanner = getMockScanner();
      let getCurrentDateCalled = false;
      scanner.getCurrentDate = () => {
        getCurrentDateCalled = true;
        return CURRENT_DATE;
      }
      scanner.start();
      assert(getCurrentDateCalled);
      assert.equal(scanner.m_scanDate, CURRENT_DATE);
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

      let deepScanCalled = false;
      scanner.deepScan = () => {
        assert(wappalyzeCalled);
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
    it('returns the current date as iso string', () => {
      const scanner = new Scanner(URL);
      assert.equal(scanner.getCurrentDate(), (new Date()).toISOString());
    })
  })

  describe('checkHttpStatus', () => {
    const REQ_OPTIONS = {
      options: 'anything'
    };
    const RESPONSE = {
      statusCode: 200,
      body: 'body'
    };
    const getMockScanner = (requestError) => {
      const Scanner = proxyquire('../src/index', {
        './tech': {
          getReqOptions: () => REQ_OPTIONS
        },
        'request-promise': async () => {
          if(requestError) {
            throw requestError;
          }
          
          return RESPONSE;
        }
      });
      return new Scanner(URL);
    }

    it('calls Tech.getReqOptions', async () => {
      let getReqOptionsCalled = false;
      const Scanner = proxyquire('../src/index', {
        './tech': {
          getReqOptions: () => {
            getReqOptionsCalled = true;
            return REQ_OPTIONS;
          }
        },
        'request-promise': async () => RESPONSE
      });
      const scanner = new Scanner(URL);
      await scanner.checkHttpStatus();
      assert(getReqOptionsCalled);
    });

    it('calls request', async () => {
      let requestCalled = false;
      const Scanner = proxyquire('../src/index', {
        './tech': {
          getReqOptions: () => REQ_OPTIONS
        },
        'request-promise': async () => {
          requestCalled = true;
          return RESPONSE;
        }
      });
      const scanner = new Scanner(URL);
      await scanner.checkHttpStatus();
      assert(requestCalled);
    });

    it('updates m_httpStatus', async () => {
      const scanner = getMockScanner();
      await scanner.checkHttpStatus();
      assert.equal(scanner.m_httpStatus, RESPONSE.statusCode);
    });

    it('updates m_homepageBody if not set', async () => {
      const scanner = getMockScanner();
      assert(!scanner.m_homepageBody);
      await scanner.checkHttpStatus();
      assert.equal(scanner.m_homepageBody, RESPONSE.body);
    });

    it('does not update m_homepageBody if already set', async () => {
      const body = 'already have a body';
      assert.notEqual(body, RESPONSE.body);
      const scanner = getMockScanner();
      scanner.m_homepageBody = body;
      await scanner.checkHttpStatus();
      assert.equal(scanner.m_homepageBody, body);
    });

    it('returns true on success', async () => {      
      const scanner = getMockScanner();
      assert(scanner.checkHttpStatus());
    });

    it('updates m_httpStatus on StatusCodeError', async () => {
      const error = new requestErrors.StatusCodeError();
      error.statusCode = 999;
      const scanner = getMockScanner(error);
      await scanner.checkHttpStatus();
      assert.equal(scanner.m_httpStatus, error.statusCode);
    });

    it('does not update m_httpStatus on other error', async () => {      
      const error = new Error('WTF');
      const scanner = getMockScanner(error);
      await scanner.checkHttpStatus();
      assert(!scanner.m_httpStatus);
    });

    it('set m_networkError to DNS ERROR on ENOTFOUND error', async () => {
      const error = { 
        cause: { 
          code: 'ENOTFOUND' 
        }
      };
      const scanner = getMockScanner(error);
      await scanner.checkHttpStatus();
      assert.equal(scanner.m_networkError, 'DNS ERROR');
    });

    it('set m_networkError to UNKOWN ERROR on other error', async () => {
      const error = { 
        cause: { 
          code: 'WTF' 
        }
      };
      const scanner = getMockScanner(error);
      await scanner.checkHttpStatus();
      assert.equal(scanner.m_networkError, 'UNKOWN ERROR');
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
          constructor(url, options) { }
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
          constructor(url, options) { }
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
          constructor(url, options) { }
          async analyze() {
            analyzeCalled = true;
          }
        }
      });
      const scanner = new Scanner(URL);
      await scanner.wappalyze();
      assert(analyzeCalled);
    })

    it('updates m_apps', async () => {
      const APPS = { apps: 'something' };

      const Scanner = proxyquire('../src/index', {
        wappalyzer: class Wappalyzer {
          constructor(url, options) { }
          async analyze() {
            return APPS;
          }
        }
      });
      const scanner = new Scanner(URL);
      await scanner.wappalyze();
      assert.deepEqual(scanner.m_apps, APPS);
    })
  })

  describe('deepScan', () => {
    it('calls initializeDeepScan');
    it('instantiate Tech for each techApp');
    it('calls findRoots for each techApp');
    it('calls deepScanApp for a techApp without version');
    it('does not call deepScanApp for a techApp with version');
    it('calls findPlugins for each techApp');
    it('does not throw error');
  })

  describe('initializeDeepScan', () => {
    it('updates m_techApps with known tech');
    it('updates the categories array for each app');
    it('add CMS if not in the initial apps')
  })

  describe('addTechApp', () => {
    it('adds an app to m_techApps');
  })

  describe('deepScanApp', () => {
    it('calls deepScan on tech');
    it('calls reportProgress on deepScan progress');
    it('calls reportProgress on deepScan result');
    it('add app to m_apps if not present');
    it('does not add app to m_apps if present');
    it('does not add app to m_apps on failure');
    it('calls setDetected on success');
    it('does not call setDetected on failure');
    it('resolve on success');
    it('reject on failure');
  })

  describe('setDetected', () => {
    it('updates confidence');
    it('updates version to max release version')
    it('updates versions to pattern.version')
  })

  describe('findPlugins', () => {
    it('calls findPlugins on tech');
    it('updates app plugins on progress');
    it('calls reportProgress on progress');
    it('updates app plugins on result');
    it('calls reportProgress on result');
    it('resolve on result');
  })

  describe('reportProgress', () => {
    const STATUS = 'deepscan';
    const IN_STEP_PROGRESS = 50;
    const PROGRESS_DESCRIPTION = 'progress description';
    const SCAN_DATE = 'scan date';
    const LAST_UPDATE = 'laste update';
    const NETWORK_ERROR = 'network error';
    const HTTP_STATUS = 'http status';
    const DETECTED = { applications: 'anything' };

    const EXPECTED_RESULT = {
      url: URL,
      status: STATUS,
      progress: 55,
      progressDescription: PROGRESS_DESCRIPTION,
      scanDate: SCAN_DATE,
      lastUpdate: LAST_UPDATE,
      networkError: NETWORK_ERROR,
      httpStatus: HTTP_STATUS,
      detected: DETECTED
    };
    
    const getMockScanner = (progressCallback) => {      
      const scanner = new Scanner(URL, progressCallback);
      scanner.getCurrentDate = () => LAST_UPDATE;
      scanner.m_scanDate = SCAN_DATE;
      scanner.m_networkError = NETWORK_ERROR;
      scanner.m_httpStatus = HTTP_STATUS;
      scanner.m_apps = {
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
