const httpRequest = require('./httpRequest');
const urlHelper = require('./urlHelper');

/**
 * @typedef {Object} responsiveScanResult
 * @property {mediaQueriesResult} mediaQueries - the media queries included in the HTML
 */

/**
 * @summary Scan the url
 * @param {string} url - the url to scan
 * @returns {responsiveScanResult} A promise that resolve when the scan is over
 */
exports.scanUrl = async (url) => {
  const body = await httpRequest.execute(url);
  return this.scanBody(url, body);
}

/**
 * @summary Scan the HTML page
 * @param {string} rootUrl - the root url of the body to scan
 * @param {string} html - the html to scan
 * @returns {responsiveScanResult} A promise that resolve when the scan is over
 */
exports.scanBody = async (rootUrl, html) => {
  const result = {};
  result.mediaQueries = await this.scanMediaQueries(rootUrl, html);
  return result;
}

/**
 * @typedef {Object} mediaQueriesResult
 * @property {string[]} inHTML - the media queries contained in the HTML file directly
 * @property {string[]} inCSS - the media queries contained in external CSS files
 */

/**
 * @summary Scan the HTML for media queries
 * @param {string} rootUrl - the root url of the body to scan
 * @param {string} html - the html to scan
 * @returns {mediaQueriesResult} - the media queries found in the HTML
 */
exports.scanMediaQueries = async (rootUrl, html) => {
  const result = {};
  result.inHTML = this.getMediaQueries(html);
  result.inCSS = await this.getExternalMediaQueries(rootUrl, html);
  return result;
}

/**
 * @summary Get the media queries in source
 * @param {string} source - the string to scan
 * @returns {string[]} the media queries found
 */
exports.getMediaQueries = (source) => {
  const regExResult = source.match(/@media [^{]*/gi);
  if (!regExResult) {
    return [];
  }

  // unique values
  const filteredResult = regExResult.filter((value, index, self) => {
    return self.indexOf(value) === index;
  })

  // removes the @media string
  const result = filteredResult.map((element) => element.substr(7).trim());
  return result;
}

/**
 * @summary Returns the css files linked in the body
 * @param {string} body - the body from which css files must be retrieved
 * @returns {string[]} - the css files
 */
exports.getCssFiles = (body) => {
  const regExResult = body.match(/href="[^>]+\.css"/gi);
  if (!regExResult) {
    return [];
  }

  // removes the href and the quotes
  const result = regExResult.map((element) => element.substring(6, element.length - 1));
  return result;
}

/**
 * @summary Find the media queries in external CSS files
 * @param {string} rootUrl - the root url of the body to scan
 * @param {string} html - the html to scan
 * @returns {Object} the media queries found with key as css url and value as string[]
 */
exports.getExternalMediaQueries = async (rootUrl, html) => {
  const cssFiles = this.getCssFiles(html);
  const result = {};

  for (let i = 0; i < cssFiles.length; i++) {
    const url = this.getCssUrl(rootUrl, cssFiles[i]);
    try {
      const cssFileContent = await httpRequest.execute(url);
      const mediaQueries = this.getMediaQueries(cssFileContent);
      result[url] = mediaQueries;
    } catch (err) {
      // nothing to do
    }
  };

  return result;
}

/**
 * @summary Get the css url based on root url and css path defined in the HTML
 * @param {string} rootUrl - the root url of the scanned body
 * @param {string} cssPath - the css path defined in the HTML
 * @returns {string} the css path
 */
exports.getCssUrl = (rootUrl, cssPath) => {
  if (urlHelper.isAbsolute(cssPath)) {
    if (cssPath.startsWith('//')) {
      return 'http:' + cssPath;
    }

    return  cssPath;
  }
  return rootUrl + '/' + cssPath;
}