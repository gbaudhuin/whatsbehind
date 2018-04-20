const assert = require('assert');
const describe = require('mocha').describe; // avoid eslint warnings
const it = require('mocha').it; // avoid eslint warnings
const ScanResult = require('../src/scanResult');

const URL = 'url';
const STATUS = 'status';
const PROGRESS = 23;
const PROGRESS_DESCSRIPTION = 'progress description';
const SCAN_DATE = new Date();
const LAST_UPDATE = new Date();
const NETWORK_ERROR = 'network error';
const HTTP_STATUS = 200;
const DETECTED = [{}, {}];

describe('scanResult', () => {
  describe('constructor', () => {
    it('set url', () => {
      const scanResult = new ScanResult(URL, STATUS, PROGRESS, PROGRESS_DESCSRIPTION, SCAN_DATE, LAST_UPDATE, NETWORK_ERROR, HTTP_STATUS, DETECTED);
      assert.equal(scanResult.url, URL);
    });

    it('set status', () => {
      const scanResult = new ScanResult(URL, STATUS, PROGRESS, PROGRESS_DESCSRIPTION, SCAN_DATE, LAST_UPDATE, NETWORK_ERROR, HTTP_STATUS, DETECTED);
      assert.equal(scanResult.status, STATUS);
    });

    it('set progress', () => {
      const scanResult = new ScanResult(URL, STATUS, PROGRESS, PROGRESS_DESCSRIPTION, SCAN_DATE, LAST_UPDATE, NETWORK_ERROR, HTTP_STATUS, DETECTED);
      assert.equal(scanResult.progress, PROGRESS);
    });

    it('set progressDescription', () => {
      const scanResult = new ScanResult(URL, STATUS, PROGRESS, PROGRESS_DESCSRIPTION, SCAN_DATE, LAST_UPDATE, NETWORK_ERROR, HTTP_STATUS, DETECTED);
      assert.equal(scanResult.progressDescription, PROGRESS_DESCSRIPTION);
    });

    it('set scanDate', () => {
      const scanResult = new ScanResult(URL, STATUS, PROGRESS, PROGRESS_DESCSRIPTION, SCAN_DATE, LAST_UPDATE, NETWORK_ERROR, HTTP_STATUS, DETECTED);
      assert.equal(scanResult.scanDate, SCAN_DATE.toISOString());
    });

    it('set lastUpdate', () => {
      const scanResult = new ScanResult(URL, STATUS, PROGRESS, PROGRESS_DESCSRIPTION, SCAN_DATE, LAST_UPDATE, NETWORK_ERROR, HTTP_STATUS, DETECTED);
      assert.equal(scanResult.lastUpdate, LAST_UPDATE.toISOString());
    });

    it('set networkError', () => {
      const scanResult = new ScanResult(URL, STATUS, PROGRESS, PROGRESS_DESCSRIPTION, SCAN_DATE, LAST_UPDATE, NETWORK_ERROR, HTTP_STATUS, DETECTED);
      assert.equal(scanResult.networkError, NETWORK_ERROR);
    });

    it('set httpStatus', () => {
      const scanResult = new ScanResult(URL, STATUS, PROGRESS, PROGRESS_DESCSRIPTION, SCAN_DATE, LAST_UPDATE, NETWORK_ERROR, HTTP_STATUS, DETECTED);
      assert.equal(scanResult.httpStatus, HTTP_STATUS);
    });

    it('set detected', () => {
      const scanResult = new ScanResult(URL, STATUS, PROGRESS, PROGRESS_DESCSRIPTION, SCAN_DATE, LAST_UPDATE, NETWORK_ERROR, HTTP_STATUS, DETECTED);
      assert.deepEqual(scanResult.detected, DETECTED);
    });
  })
})