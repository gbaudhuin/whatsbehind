/**
 * Represent a scan's result
 */
class ScanResult {
  /**
   * @constructor
   * @param {String} url - the scanned url
   * @param {String} status - the status
   * @param {Number} progress - the progression
   * @param {String} progressDescription - the description of the progression
   * @param {Date|String} scanDate - the date where the scan started
   * @param {Date|String} lastUpdate - the date of the scan's last update
   * @param {String} networkError - the network error that occured while scanning
   * @param {Number} httpStatus - the http status returned by the server when the scan started
   * @param {Array<Object>} detected - the applications detected by the scan
   */
  constructor(url, status, progress, progressDescription, scanDate, lastUpdate, networkError, httpStatus, detected) {
    this.url = url;
    this.status = status;
    this.progress = progress;
    this.progressDescription = progressDescription;
    this.scanDate = (typeof scanDate === 'string') ? scanDate : scanDate.toISOString();
    this.lastUpdate = (typeof lastUpdate === 'string') ? lastUpdate : lastUpdate.toISOString();
    this.networkError = networkError;
    this.httpStatus = httpStatus;
    this.detected = detected;
  }

  /**
   * @summary Copy the scanResult
   * @param {ScanResult} scanResult - the scanResult to copy
   * @returns {undefined} void
   */
  copy(scanResult) {
    this.url = scanResult.url;
    this.status = scanResult.status;
    this.progress = scanResult.progress;
    this.progressDescription = scanResult.progressDescription;
    this.scanDate = scanResult.scanDate;
    this.lastUpdate = scanResult.lastUpdate;
    this.networkError = scanResult.networkError;
    this.httpStatus = scanResult.httpStatus;
    this.detected = scanResult.detected;
  }
}

module.exports = ScanResult;