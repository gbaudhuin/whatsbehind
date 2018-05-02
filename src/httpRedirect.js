const httpRequest = require('./httpRequest');
const urlHelper = require('./urlHelper');

/**
 * @typedef {Object} redirectResult
 * @property {number} statusCode - the status code
 * @property {string} redirectUri - the redirect uri
 */

/**
 * @summary Returns the redirects of a request
 * @param {String} url - the url to request
 * @param {Object} [additionalOptions] - additional options that will be added to the default request options
 * @param {string} [userAgentOverride] - override the default user agent
 * @returns {Promise<redirectResult[]>} the redirects of the request
 */
const get = async (url, additionalOptions = null, userAgentOverride = null) => {
  const options = {
    simple: false,
    followRedirect: true,
    resolveWithFullResponse: true
  }

  if (additionalOptions) {
    Object.keys(additionalOptions).forEach((additionalOptionKey) => {
      options[additionalOptionKey] = additionalOptions[additionalOptionKey];
    })
  }

  const result = await httpRequest.execute(url, options, userAgentOverride);
  return result.request._redirect.redirects;
}

/**
 * @summary Check if the request has the expected url as redirect
 * @param {String} requestUrl - the url to request
 * @param {String|String[]} expectedUrl - the expected url
 * @param {Boolean} ignoreProcotol - ignore the procotol while comparing the url
 * @returns {Promise<Boolean>} True if the request has the expected url as redirect
 */
const hasRedirect = async (requestUrl, expectedUrl, ignoreProcotol = true) => {
  const redirects = await this.get(requestUrl);

  const expectedUrls = typeof expectedUrl === 'string' ? [expectedUrl] : expectedUrl;

  for (let i = 0; i < redirects.length; i++) {
    const redirect = redirects[i];
    const redirectUri = redirect.redirectUri;

    for (let j = 0; j < expectedUrls.length; j++) {
      if (urlHelper.equals(redirectUri, expectedUrls[j], ignoreProcotol)) {
        return true;
      }
    }
  }

  return false;
}

module.exports.get = get;
module.exports.hasRedirect = hasRedirect;