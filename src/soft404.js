const Tech = require('./tech');
const request = require('request-promise');
const requestErrors = require('request-promise/errors');

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
 * @property {SOFT_404_STATUS} soft404Status - indicate if the status of soft 404
 * @property {number} statusCode - the statusCode returned by the request
 *
 * @summary Request the website to check if it uses soft 404
 * @param {String} root - root of the initial request
 * @param {String} relativePath - relative path of the initial request
 * @param {String} ext - extension of the initial request
 * @param {Number} statusCode - status code of the initial request
 * @returns {Promise<Result>} - the result
 */
const execute = async (root, relativePath, ext, statusCode) => {
  const pathWithoutExt = relativePath.substr(0, relativePath.length - ext.length);
  const url404 = root + '/' + pathWithoutExt + 'd894tgd1' + ext; // random non existing url
  const reqOptions = Tech.getReqOptions(url404);

  const throwError = () => {
    throw new Error('Unable to compute soft404');
  }

  let code;
  try {
    const response = await request(reqOptions);
    code = response.statusCode;
  } catch (err) {
    if (err instanceof requestErrors.StatusCodeError) {
      code = err.statusCode;
    } else {
      throwError();
    }
  }

  const getResult = (soft404Status) => {
    return {
      soft404Status,
      statusCode: code
    }
  }

  if (code === 404) {
    if (statusCode !== 403) {
      return getResult(STATUS.DISABLED);
    }
    return getResult(STATUS.UNKNOWN);
  }

  const validStatusCodes = [200, 206, 403];
  if (validStatusCodes.indexOf(code) !== -1) {
    if (statusCode !== 403) {
      return getResult(STATUS.ENABLED);
    }
  }
  return getResult(STATUS.UNKNOWN);
}

module.exports = execute;
module.exports.STATUS = STATUS;