const badLinkRequest = require('./badLinkRequest')

/**
 * Enum for soft 404 status
 * @readonly
 * @enum {number}
 */
const STATUS = {
  UNKNOWN: 0,
  DISABLED: 1,
  ENABLED: 2
}

/**
 * @summary Request the website to check if it uses soft 404
 * @param {String} root - root of the initial request
 * @param {String} relativePath - relative path of the initial request
 * @param {String} ext - extension of the initial request
 * @returns {Promise<SOFT_404_STATUS>} - the result
 */
const execute = async (root, relativePath, ext) => {
  const statusCode = await badLinkRequest(root, relativePath, ext);

  if (statusCode === 404) {
    return STATUS.DISABLED;
  }

  const soft404StatusCode = [200, 206, 403];
  if (soft404StatusCode.indexOf(statusCode) !== -1) {
    return STATUS.ENABLED;
  }

  return STATUS.UNKNOWN;
}

module.exports = execute;
module.exports.STATUS = STATUS;