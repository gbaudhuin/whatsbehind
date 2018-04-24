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
 * @typedef {Object} Result
 * @property {number} statusCode
 * @property {SOFT_404_STATUS} soft404Status
 *
 * @summary Request the website to check if it uses soft 404
 * @param {String} root - root of the initial request that returns a 404
 * @param {String} relativePath - relative path of the initial request that returns a 404
 * @param {String} ext - extension of the initial request that returns a 404
 * @returns {Promise<Result>} - the http status code and the soft 404 status
 */
const execute = async (root, relativePath, ext) => {
  const statusCode = await badLinkRequest(root, relativePath, ext);

  const getResult = (status) => {
    return {
      statusCode,
      soft404Status: status
    }
  }

  if (statusCode === 404) {
    return getResult(STATUS.DISABLED);
  }

  const soft404StatusCode = [200, 206, 403];
  if (soft404StatusCode.indexOf(statusCode) !== -1) {
    return getResult(STATUS.ENABLED);
  }

  return getResult(STATUS.UNKNOWN);
}

module.exports = execute;
module.exports.STATUS = STATUS;