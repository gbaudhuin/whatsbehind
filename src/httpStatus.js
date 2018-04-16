const http = require('http');

/**
 * @async
 * @summary Get the http status code for the specified URL
 * @param {String} url - URL from which http status code must be returned 
 * @return {Promise<Number>} The http status code for the URL
 */
module.exports = async (url) => {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      resolve(response.statusCode);

      // resume called to consume response data and free memory
      response.resume();
    })

    request.on('error', reject);
  })
}