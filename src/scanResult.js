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
   * @param {Object} seo - the seo data of the website
   * @param {Array<Object>} detected - the applications detected by the scan
   */
  constructor(url, status, progress, progressDescription, scanDate, lastUpdate, networkError, httpStatus, seo, detected) {
    this.url = url;
    this.status = status;
    this.progress = progress;
    this.progressDescription = progressDescription;
    this.scanDate = scanDate;
    this.lastUpdate = lastUpdate;
    this.networkError = networkError;
    this.httpStatus = httpStatus;
    this.seo = seo;
    this.detected = detected;
  }

  /**
   * @summary Update scanDate value
   * @param {Date|String} value - the new value
   */
  set scanDate(value) {
    this.mScanDate = this.getDateAsString(value);
  }

  /**
   * @summary Return scanDate value
   * @returns {String} scanDate value
   */
  get scanDate() {
    return this.mScanDate;
  }

  /**
   * @summary Update lastUpdate value
   * @param {Date|String} value - the new value
   */
  set lastUpdate(value) {
    this.mLastUpdate = this.getDateAsString(value);
  }

  /**
   * @summary Return lastUpdate value
   * @returns {String} LastUpdate value
   */
  get lastUpdate() {
    return this.mLastUpdate;
  }

  /**
   * @summary Convert date to string
   * @param {Date|String} date - the date to convert
   * @returns {String} the converted date
   */
  getDateAsString(date) {
    return (typeof date === 'string') ? date : date.toISOString();
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
    this.seo = scanResult.seo;
    this.detected = scanResult.detected;
  }

  /**
   * @summary Return an object based on the scanResult
   * @returns {Object} an object based on the scanResult
   */
  toData() {
    return {
      url: this.url,
      status: this.status,
      progress: this.progress,
      progressDescription: this.progressDescription,
      scanDate: this.scanDate,
      lastUpdate: this.lastUpdate,
      networkError: this.networkError,
      httpStatus: this.httpStatus,
      seo: this.seo,
      detected: this.detected
    }
  }
}

module.exports = ScanResult;