const request = require('request-promise');

/**
 * @summary Returns the default request options
 * @param {String} url - the url to request
 * @param {Object} [additionalOptions] - the additional options that will be added to the default request options
 * @returns {Object} the default request options
 */
exports.getOptions = (url, additionalOptions = null) => {
  const ret = {
    url,
    timeout: 5000,
    rejectUnauthorized: false,
    requestCert: true,
    agent: false,
    jar: true, // cookies
    gzip: true,
    strictSSL: false,
    headers: {
      Accept: 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      Connection: 'keep-alive',
      'Cache-Control': 'max-age=0',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.7',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36'
    }
  };

  if (additionalOptions) {
    Object.keys(additionalOptions).forEach((additionalOptionKey) => {
      ret[additionalOptionKey] = additionalOptions[additionalOptionKey];
    })
  }

  return ret;
}

/**
 * @summary Request the URL with the default options
 * @param {String} url - the url to request
 * @param {Object} [additionalOptions] - the additional options that will be added to the default request options
 * @returns {Object} the default request options
 */
exports.execute = async (url, additionalOptions = null) => {
  const options = this.getOptions(url, additionalOptions);
  return await request(options);
}