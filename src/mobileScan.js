const httpRequest = require('./httpRequest');
const httpRedirect = require('./httpRedirect');

/**
 * @typedef {mobileBodyScanResult} mobileScanResult
 * @property {string} redirection - indicate if the mobile redirection of the site
 */

/**
 * @summary Scan the url
 * @param {string} url - the url to scan
 * @returns {Promise<mobileScanResult>} A promise that resolve when the scan is over
 */
exports.scanUrl = async (url) => {
  const body = await httpRequest.execute(url);
  const result = await this.scanBody(body);
  result.redirection = await this.scanRedirection(url);
  return result;
}

/**
 * @summary Scan the url to see if the site has a mobile redirection
 * @param {string} url - the url to scan
 * @returns {Promise<string>} A promise that resolve when the scan is over
 */
exports.scanRedirection = async (url) => {
  try {
    const initialRedirections = await httpRedirect.get(url);
    const mobileUserAgent = 'Mozilla/5.0 (Linux; U; Android 4.0.3; ko-kr; LG-L160L Build/IML74K) AppleWebkit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30';
    const mobileRedirections = await httpRedirect.get(url, null, mobileUserAgent);

    const lastInitialRedirection = initialRedirections.length === 0 ? null : initialRedirections.pop().redirectUri;
    const lastMobileRedirection = mobileRedirections.length === 0 ? null : mobileRedirections.pop().redirectUri;

    if (lastInitialRedirection === lastMobileRedirection) {
      return null;
    }

    return lastMobileRedirection;
  } catch (err) {
    return null;
  }
}

/**
 * @typedef {Object} mobileBodyScanResult
 * @property {boolean} isAMP - indicate if the page uses AMP
 * @property {viewportMetaResult} viewportMeta - viewport meta data
 */

/**
 * @summary Scan the HTML page
 * @param {string} html - the html to scan
 * @returns {mobileBodyScanResult} The scan result
 */
exports.scanBody = async (html) => {
  const result = {};
  result.isAMP = this.scanAMP(html);
  result.viewportMeta = this.scanViewportMetas(html);
  return result;
}

/**
 * @summary Scan the HTML page for AMP (https://www.ampproject.org/)
 * @param {string} html - the html to scan
 * @returns {boolean} True if the HTML page uses AMP
 */
exports.scanAMP = (html) => {
  return !!html.match(/<.*(html ⚡)|(html amp).*>/gi);
}

/**
 * @typedef {Object} viewportMetaResult
 * @property {boolean} hasWidhtEqualsDeviceWith - indicate if the page has a viewport meta containing width=device-width
 * @property {boolean} hasInitialScaleEquals1 - indicate if the page has a viewport meta containing initial-scale=1
 * @property {boolean} hasMinimumScaleEquals1 - indicate if the page has a viewport meta containing minimum-scale=1
 * @property {boolean} hasShrinkToFitEqualsNo - indicate if the page has a viewport meta containing shrink-to-fit=no
 */

/**
 * @summary Scan the HTML page for viewport metas
 * @param {string} html - the html to scan
 * @returns {viewportMetaResult} The scan result
 */
exports.scanViewportMetas = (html) => {
  const r = {
    hasWitdhEqualsDeviceWidth: false,
    hasInitialScaleEquals1: false,
    hasMinimumScaleEquals1: false,
    hasShrinkToFitEqualsNo: false
  };

  const metas = this.getViewportMetas(html);
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    if (this.isDeviceWidthViewportMeta(meta)) {
      r.hasWitdhEqualsDeviceWidth = true;
    }
    if (this.isInitialScaleViewportMeta(meta)) {
      r.hasInitialScaleEquals1 = true;
    }
    if (this.isMinimumScaleViewportMeta(meta)) {
      r.hasMinimumScaleEquals1 = true;
    }
    if (this.isShrinkToFitViewportMeta(meta)) {
      r.hasShrinkToFitEqualsNo = true;
    }
  }

  return r;
}

/**
 * @summary Get the viewport metas from the html source
 * @param {string} html - the html from which the meta must be retrieved
 * @returns {string[]} The viewport metas
 */
exports.getViewportMetas = (html) => {
  const metas = html.match(/<meta[^>]+>/gi);
  if (!metas) {
    return [];
  }

  // filter viewport metas
  const viewportMetas = metas.filter((element) => {
    if (element.match(/name=["']viewport["']/gi)) {
      return element;
    }
  })
  return viewportMetas;
}

/**
 * @summary Returns true if the HTML contains at least one viewport meta
 * @param {string} html - the html to scan
 * @returns {boolean} True if the HTML contains at least one viewport meta
 */
exports.hasViewportMeta = (html) => {
  const metas = this.getViewportMetas(html);
  return metas.length > 0;
}

/**
 * @summary Returns true if the meta contains width=device-width
 * @param {string} meta - the meta to scan
 * @returns {boolean} True if the meta contains width=device-width
 */
exports.isDeviceWidthViewportMeta = (meta) => {
  return !!meta.match(/content=["'](.*)width=device-width(.*)["']/gi);
}

/**
 * @summary Returns true if the meta contains initial-scale=1
 * @param {string} meta - the meta to scan
 * @returns {boolean} True if the meta contains initial-scale=1
 */
exports.isInitialScaleViewportMeta = (meta) => {
  return !!meta.match(/content=["'](.*)initial-scale=1\.*0*(.*)["']/gi);
}

/**
 * @summary Returns true if the meta contains minimum-scale=1
 * @param {string} meta - the meta to scan
 * @returns {boolean} True if the meta contains minimum-scale=1
 */
exports.isMinimumScaleViewportMeta = (meta) => {
  return !!meta.match(/content=["'](.*)minimum-scale=1\.*0*(.*)["']/gi);
}

/**
 * @summary Returns true if the meta contains shrink-to-fit=no
 * @param {string} meta - the meta to scan
 * @returns {boolean} True if the meta contains shrink-to-fit=no
 */
exports.isShrinkToFitViewportMeta = (meta) => {
  return !!meta.match(/content=["'](.*)shrink-to-fit=no(.*)["']/gi)
}