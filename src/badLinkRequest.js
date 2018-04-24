const httpStatus = require('./httpStatus');

/**
 * @summary Request the website with a non existing url
 * @param {String} root - root of the initial request
 * @param {String} relativePath - relative path of the initial request
 * @param {String} ext - extension of the initial request
 * @returns {Promise<number>} the httpStatus of the request
 */
const execute = async (root, relativePath, ext) => {
  const pathWithoutExt = relativePath.substr(0, relativePath.length - ext.length);
  const url404 = root + '/' + pathWithoutExt + 'd894tgd1' + ext; // random non existing url

  return await httpStatus(url404);
}

module.exports = execute;