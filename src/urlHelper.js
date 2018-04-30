const httpRequest = require('./httpRequest');
const httpRedirect = require('./httpRedirect');
const stringHelper = require('./stringHelper');

/**
 * Check if the URL is absolute.
 * An URL is considered as absoulute if it starts with a protocol followed by : or if it starts with '//'
 * @summary Check if URL is absolute
 * @param {string} url - the url to check
 * @returns {boolean} True if the URL is absolute
 */
exports.isAbsolute = (url) => {
  if (/^[a-z][a-z0-9+.-]*:/.test(url)) {
    return true;
  }

  if (url.startsWith('//')) {
    return true;
  }

  return false;
}

/**
 * @summary Check if two URL are equals
 * @param {String} url1 - the first url
 * @param {String} url2 - the second url
 * @param {Boolean} [ignoreProtocol=true] - indicate if the protocol must be ignored
 * @returns {Boolean} True if url1 equals url2
 */
exports.equals = (url1, url2, ignoreProtocol = true) => {
  const trimUrl1 = stringHelper.trimChar(url1, '/');
  const trimUrl2 = stringHelper.trimChar(url2, '/');
  if (ignoreProtocol) {
    return this.removeProtocol(trimUrl1) === this.removeProtocol(trimUrl2);
  }
  return trimUrl1 === trimUrl2;
}

/**
 * @summary Check if the url exists
 * @param {string} url - the url to check
 * @returns {Promise<Boolean>} true if the url exists
 */
exports.exists = async (url) => {
  try {
    await httpRequest.execute(url);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * @summary Check if the url contains WWW
 * @param {string} url - the url to check
 * @returns {Boolean} True if the url contains WWW
 */
exports.hasWWW = (url) => {
  const result = url.match(/^(http|https)(:\/\/)(www\.)/);
  return result != null;
}

/**
 * @summary Check if the url contains a subdomain (WWW is considered a subdomain)
 * @param {string} url - the url to check
 * @returns {Boolean} True if the url contains a subdomain
 */
exports.hasSubdomain = (url) => {
  const match = url.match(/^(http|https)(:\/\/)(.+)(\..+)$/);
  if (match != null && match.length > 3) {
    return match[3].indexOf('.') !== -1;
  }

  return false;
}

/**
 * Check if WWWW can be added to the url
 * @param {string} url - the url to check
 * @returns {Boolean} True if WWW can added to the url
 */
exports.wwwCanBeAdded = (url) => {
  // returns false if url already contains a subdomain
  if (this.hasSubdomain(url)) {
    return false;
  }

  return true;
}

/**
 * @summary Add www to the url
 * @param {string} url - the url to convert
 * @returns {string} the modified url
 */
exports.convertWithWWW = (url) => {
  return url.replace(/^(http|https)(:\/\/)(.+)(\..+)$/, (fullString, procotol, dotSlashSlash, domain, topLevelDomain) => {
    // add www only if there no subdomain (. found in domain)
    return procotol + dotSlashSlash + (domain.indexOf('.') === -1 ? 'www.' : '') + domain + topLevelDomain;
  });
}

/**
 * @summary Remove www to the url
 * @param {string} url - the url to convert
 * @returns {string} the modified url
 */
exports.convertWithoutWWW = (url) => {
  return url.replace(/^(http|https)(:\/\/)(www.)/, '$1$2');
}

/**
 * @summary Check if thr url can be toggled between WWW and no WWW
 * @param {string} url - the url to convert
 * @returns {Boolean} True if the url can be toggled between WWW and no WWW
 */
exports.toggleWWWAllowed = (url) => {
  if (!this.hasWWW(url) && !this.wwwCanBeAdded(url)) {
    return false;
  }

  return true;
}

/**
 * @summary Toggle WWW <-> no WWW
 * @param {string} url - the url to convert
 * @returns {string} the converted url
 */
exports.toggleWWW = (url) => {
  if (!this.toggleWWWAllowed(url)) {
    return url;
  }

  if (!this.hasWWW(url)) {
    return this.convertWithWWW(url);
  }

  return this.convertWithoutWWW(url);
}

/**
 * @summary Check if the url exists with www subdomain
 * @param {string} url - the url to check
 * @returns {Promise<Boolean>} true if the url exists with www subdomain
 */
exports.existsWithWWW = async (url) => {
  return this.exists(this.convertWithWWW(url));
}

/**
 * @summary Check if the url exists without www subdomain
 * @param {string} url - the url to check
 * @returns {Promise<Boolean>} true if the url exists without www subdomain
 */
exports.existsWithoutWWW = (url) => {
  return this.exists(this.convertWithoutWWW(url));
}

/**
 * @summary Check if there is a WWW redirection to the url (no WWW <-> WWW)
 * @param {string} url - the url to check
 * @returns {Promise<Boolean>} True if there is a WWW redirection to the url
 */
exports.hasWWWRedirection = async (url) => {
  const urlHasWWW = this.hasWWW(url);
  if (!urlHasWWW && !this.wwwCanBeAdded(url)) {
    return false;
  }

  const sourceUrl = urlHasWWW ? this.convertWithoutWWW(url) : this.convertWithWWW(url);
  return await httpRedirect.hasRedirect(sourceUrl, url);
}

/**
 * @summary Remove the protocol from an url
 * @param {string} url - the url from which the procotol must be removed
 * @returns {string} the url without protocol
 */
exports.removeProtocol = (url) => {
  return url.replace(/^(.+)(:\/\/)(.+)/, '$3');
}

/**
 * @summary Check if the url uses HTTP protocol
 * @param {String} url - the url to check
 * @returns {Boolean} true if the url uses HTTP protocol
 */
exports.useHTTP = (url) => {
  const result = url.match(/^(http:\/\/)/);
  return result != null;
}

/**
 * @summary Check if the url uses HTTPS protocol
 * @param {String} url - the url to check
 * @returns {Boolean} true if the url uses HTTPS protocol
 */
exports.useHTTPS = (url) => {
  const result = url.match(/^(https:\/\/)/);
  return result != null;
}

/**
 * @summary Convert the url to use HTTP protocol
 * @param {string} url - the url to convert
 * @returns {string} the url with HTTP protocol
 */
exports.convertToHTTP = (url) => {
  return url.replace(/^(https)(:\/\/)/, 'http$2');
}

/**
 * @summary Convert the url to use HTTPS protocol
 * @param {string} url - the url to convert
 * @returns {string} the url with HTTPS protocol
 */
exports.convertToHTTPS = (url) => {
  return url.replace(/^(http)(:\/\/)/, 'https$2');
}

/**
 * @summary Toggle HTTP <-> HTTPS
 * @param {string} url - the url to convert
 * @returns {string} the converted url
 */
exports.toggleHTTP = (url) => {
  if (this.useHTTP(url)) {
    return this.convertToHTTPS(url);
  }

  return this.convertToHTTP(url);
}

/**
 * @summary Check if the url exists with HTTP protocol
 * @param {string} url - the url to check
 * @returns {Promise<Boolean>} true if the url exists with HTTP protocol
 */
exports.existsWithHTTP = async (url) => {
  return this.exists(this.convertToHTTP(url));
}

/**
 * @summary Check if the url exists with HTTPS protocol
 * @param {string} url - the url to check
 * @returns {Promise<Boolean>} true if the url exists with HTTPS protocol
 */
exports.existsWithHTTPS = async (url) => {
  return this.exists(this.convertToHTTPS(url));
}

/**
 * @summary Check if there is an HTTP redirection to the url (HTTP <-> HTTPS)
 * @param {string} url - the url to check
 * @returns {Promise<Boolean>} True if there is an HTTP redirection to the url
 */
exports.hasHTTPRedirection = async (url) => {
  const sourceUrl = this.toggleHTTP(url);
  return await httpRedirect.hasRedirect(sourceUrl, url);
}