const crypto = require('crypto');

/**
  * Converts all CRLF to LF
  * @param {Buffer} data - data
  * @returns {Uint8Array} Converted data
  */
exports.crlf2lf = (data) => {
  var converted = new Uint8Array(data.length);
  var j = 0;
  for (var i = 0; i < data.length; i++) {
    if (data[i] === 13 && i < data.length - 1 && data[i + 1] === 10) { // 13 = ascii code of lf, 10 = ascii code of cr
      i++;
    }

    converted[j] = data[i];
    j++;
  }
  return converted.slice(0, j)
}

/**
 * @summary Compute the md5 of a string
 * @param {string} string - the string for which the md5 will be computed
 * @returns {string} the md5 of the string
 */
exports.md5 = (string) => {
  const hash = crypto.createHash('md5');
  hash.update(string);
  const result = hash.digest('hex');
  return result;
}

/**
 * @summary Remove charToRemove from the beginning and the end of the string
 * @param {string} string - the string to trim
 * @param {string} charToRemove - the char to remove
 * @returns {string} the trimmed string
 */
exports.trimChar = (string, charToRemove) => {
  while (string.charAt(0) === charToRemove) {
    string = string.substring(1);
  }

  while (string.charAt(string.length - 1) === charToRemove) {
    string = string.substring(0, string.length - 1);
  }

  return string;
};