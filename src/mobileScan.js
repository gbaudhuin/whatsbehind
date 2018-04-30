const httpRequest = require('./httpRequest');

/**
 * @typedef {Object} mobileScanResult
 * @property {boolean} isAMP - indicate if the page uses AMP
 * @property {viewportMetaResult} viewportMeta - viewport meta data
 * @property {boolean} mediaQueries - indicate if the page uses media queries
 */

/**
 * @summary Scan the url
 * @param {string} url - the url to scan
 * @returns {Promise<mobileScanResult>} A promise that resolve when the scan is over
 */
exports.scanUrl = async (url) => {
  const body = await httpRequest.execute(url);
  return this.scanBody(body);
}

/**
 * @summary Scan the HTML page
 * @param {string} html - the html to scan
 * @returns {mobileScanResult} The scan result
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
    hasWitdhEqualsDeviceWith: false,
    hasInitialScaleEquals1: false,
    hasMinimumScaleEquals1: false,
    hasShrinkToFitEqualsNo: false
  };

  const metas = this.getViewportMetas(html);
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    if (this.isDeviceWidthViewportMeta(meta)) {
      r.hasWitdhEqualsDeviceWith = true;
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