const urlHelper = require('./urlHelper');

/**
 * @typedef {Object} seoScanResult
 * @property {boolean} existsWithWWW - indicate if the site exists with the www prefix
 * @property {boolean} existsWithoutWWW - indicate if the site exists without the www prefix
 * @property {boolean} hasWWWRedirection - indicate if the site has a WWW <-> no WWW redirection
 * @property {boolean} existsWithHTTP - indicate if the site exists with the HTTP protocol
 * @property {boolean} existsWithHTTPS - indicate if the site exists with the HTTPS protocol
 * @property {boolean} hasHTTPRedirection - indicate if the site has a HTTP <-> HTTPS redirection
 */

/**
 * @callback progressCallback
 * @param {number} progress - the inner progression
 * @param {seoScanResult} result - the result
 */

/**
 * @summary Scan the url
 * @param {string} url - url to scan
 * @param {progressCallback} progressCallback - the progressCallback
 * @returns {Promise<seoScanResult>} A promise that resolve when the scan is over
 */
module.exports = async (url, progressCallback) => {
  const result = {};

  const queue = [
    'existsWithWWW',
    'existsWithoutWWW',
    'hasWWWRedirection',
    'existsWithHTTP',
    'existsWithHTTPS',
    'hasHTTPRedirection'
  ];

  const notifyProgress = () => {
    if (progressCallback) {
      const progress = Object.keys(result).length / queue.length;
      progressCallback(progress, result);
    }
  }

  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    result[id] = await urlHelper[id](url);
    notifyProgress();
  }

  return result;
}