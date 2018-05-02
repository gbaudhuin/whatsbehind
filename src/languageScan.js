const httpRequest = require('./httpRequest');
const fs = require('fs');
const cultureCodes = JSON.parse(fs.readFileSync('./data/language/cultureCodes.json'));

/**
 * @summary Scan the url
 * @param {string} url - the url to scan
 * @returns {Object} the result
 */
exports.scanUrl = async (url) => {
  const html = await httpRequest.execute(url);
  return this.scanHTML(html);
}

/**
 * @summary Scan the HTML
 * @param {string} html - the html to scan
 * @returns {Object} the result
 */
exports.scanHTML = (html) => {
  const result = {};
  result.hrefLangs = this.scanHrefLangs(html);
  result.internationalLinks = this.scanLinks(html);
  return result;
}

/**
 * @typedef {Object} hrefLangResult
 * @property {string} lang - the hreflang value
 * @property {string} href - the href value
 */

/**
 * @summary Scan hrefLang in the HTML
 * @param {string} html - the html to scan
 * @returns {hrefLangResult[]} the hrefLang presents in the HTML
 */
exports.scanHrefLangs = (html) => {
  const hreflangs = html.match(/<link[^>]+hreflang=[^>]+>/gi);
  if (!hreflangs) {
    return [];
  }

  const result = hreflangs.map((regexResult) => {
    const langResult = regexResult.match(/hreflang="([^"]+)"/i);
    const lang = langResult ? langResult[1] : null;
    const hrefResult = regexResult.match(/href="([^"]+)"/i);
    const href = hrefResult ? hrefResult[1] : null;
    return {
      lang,
      href
    }
  })

  return result;
}

/**
 * @summary Scan international links in the HTML
 * @param {string} html - the html to scan
 * @returns {hrefLangResult[]} the international links presents in the HTML
 */
exports.scanLinks = (html) => {
  const regexResults = html.match(/<a [^>]+>[^<]+<\/a>/gi);
  if (!regexResults) {
    return [];
  }

  // filter international links
  const links = regexResults.filter((result) => {
    const hrefResult = result.match(/href="([^"]+)"/i);
    if (!hrefResult) {
      return false;
    }

    const hrefValue = hrefResult[1];
    for (let i = 0; i < cultureCodes.length; i++) {
      const cultureCode = cultureCodes[i].code;
      const regex = new RegExp('\/' + cultureCode + '\/', 'i');
      if (hrefValue.match(regex)) {
        return true;
      }
    }
    return false;
  })

  // returns only the href value
  const result = links.map((link) => {
    return link.match(/href="([^"]+)"/i)[1];
  })

  return result;
}