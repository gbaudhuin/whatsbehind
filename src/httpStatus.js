const httpRequest = require('./httpRequest');
const requestErrors = require('request-promise/errors');

/**
 * @summary Returns the http status code of a request
 * @param {String} url - the url to request
 * @returns {Promise<number>} the httpStatus of the request
 */
const execute = async (url) => {
  let statusCode;
  try {
    const response = await httpRequest.execute(url);
    statusCode = response.statusCode;
  } catch (err) {
    if (err instanceof requestErrors.StatusCodeError) {
      statusCode = err.statusCode;
    } else {
      throw err;
    }
  }

  return statusCode;
}

module.exports = execute;