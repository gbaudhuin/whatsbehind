const assert = require('assert');
const describe = require('mocha').describe; // avoid eslint warnings
const it = require('mocha').it; // avoid eslint warnings
const ScanResult = require('../src/scanResult');

const URL = 'url';
const STATUS = 'status';
const PROGRESS = 23;
const PROGRESS_DESCRIPTION = 'progress description';
const SCAN_DATE = new Date();
const LAST_UPDATE = new Date();
const NETWORK_ERROR = 'network error';
const HTTP_STATUS = 200;
const DETECTED = [{}, {}];

const getScanResult = () => {
  return new ScanResult(
    URL,
    STATUS,
    PROGRESS,
    PROGRESS_DESCRIPTION,
    SCAN_DATE,
    LAST_UPDATE,
    NETWORK_ERROR,
    HTTP_STATUS,
    DETECTED
  );
}

describe('scanResult', () => {
  describe('constructor', () => {
    it('set url', () => {
      const scanResult = getScanResult();
      assert.equal(scanResult.url, URL);
    });

    it('set status', () => {
      const scanResult = getScanResult();
      assert.equal(scanResult.status, STATUS);
    });

    it('set progress', () => {
      const scanResult = getScanResult();
      assert.equal(scanResult.progress, PROGRESS);
    });

    it('set progressDescription', () => {
      const scanResult = getScanResult();
      assert.equal(scanResult.progressDescription, PROGRESS_DESCRIPTION);
    });

    it('set scanDate', () => {
      const scanResult = getScanResult();
      assert.equal(scanResult.scanDate, SCAN_DATE.toISOString());
    });

    it('set lastUpdate', () => {
      const scanResult = getScanResult();
      assert.equal(scanResult.lastUpdate, LAST_UPDATE.toISOString());
    });

    it('set networkError', () => {
      const scanResult = getScanResult();
      assert.equal(scanResult.networkError, NETWORK_ERROR);
    });

    it('set httpStatus', () => {
      const scanResult = getScanResult();
      assert.equal(scanResult.httpStatus, HTTP_STATUS);
    });

    it('set detected', () => {
      const scanResult = getScanResult();
      assert.deepEqual(scanResult.detected, DETECTED);
    });

    it('creates the expected vars', () => {
      const EXPECTED_RESULT = {
        url: URL,
        status: STATUS,
        progress: PROGRESS,
        progressDescription: PROGRESS_DESCRIPTION,
        mScanDate: SCAN_DATE.toISOString(),
        mLastUpdate: LAST_UPDATE.toISOString(),
        networkError: NETWORK_ERROR,
        httpStatus: HTTP_STATUS,
        detected: DETECTED
      }

      assert.deepEqual(getScanResult(), EXPECTED_RESULT);
    })
  })

  describe('getDateAsString', () => {
    it('calls toISOString on date', () => {
      const scanResult = getScanResult();
      const EXPECTED_RESULT = 'anything';
      let toISOStringCalled = false;
      const date = {
        toISOString: () => {
          toISOStringCalled = true;
          return EXPECTED_RESULT;
        }
      }
      const asStr = scanResult.getDateAsString(date);
      assert.equal(asStr, EXPECTED_RESULT);
      assert(toISOStringCalled);
    })

    it('returns string', () => {
      const scanResult = getScanResult();
      const str = 'anything';
      const asStr = scanResult.getDateAsString(str);
      assert(str, asStr);
    })
  })

  describe('scanDate', () => {
    it('calls getDateAsString', () => {
      const scanResult = getScanResult();
      let getDateAsStringCalled = false;
      scanResult.getDateAsString = (date) => {
        assert.equal(date, SCAN_DATE);
        getDateAsStringCalled = true;
      }
      scanResult.scanDate = SCAN_DATE;
      assert(getDateAsStringCalled);
    })

    it('returns mScanDate value', () => {
      const scanResult = getScanResult();
      assert.equal(scanResult.scanDate, scanResult.mScanDate);
    })
  })

  describe('lastUpdate', () => {
    it('calls getDateAsString', () => {
      const scanResult = getScanResult();
      let getDateAsStringCalled = false;
      scanResult.getDateAsString = (date) => {
        assert.equal(date, LAST_UPDATE);
        getDateAsStringCalled = true;
      }
      scanResult.lastUpdate = LAST_UPDATE;
      assert(getDateAsStringCalled);
    })

    it('returns mLastUpdate value', () => {
      const scanResult = getScanResult();
      assert.equal(scanResult.lastUpdate, scanResult.mLastUpdate);
    })
  })

  describe('copy', () => {
    it('copy the data of the other scanResult', () => {
      const scanResultSource = getScanResult();
      const scanResult = new ScanResult(null, null, null, null, 'SCAN_DATE', 'LAST_UPDATE', null, null, null);
      scanResult.copy(scanResultSource);
      assert.deepEqual(scanResult, scanResultSource);
    })
  })

  describe('toData', () => {
    it('returns the expected result', () => {
      const EXPECTED_RESULT = {
        url: URL,
        status: STATUS,
        progress: PROGRESS,
        progressDescription: PROGRESS_DESCRIPTION,
        scanDate: SCAN_DATE.toISOString(),
        lastUpdate: LAST_UPDATE.toISOString(),
        networkError: NETWORK_ERROR,
        httpStatus: HTTP_STATUS,
        detected: DETECTED
      }

      const scanResult = getScanResult();
      const scanResultData = scanResult.toData();
      assert.deepEqual(scanResultData, EXPECTED_RESULT);
    })
  })
})