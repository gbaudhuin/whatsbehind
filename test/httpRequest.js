const assert = require('assert');
const describe = require('mocha').describe;
const it = require('mocha').it;
const proxyquire = require('proxyquire');

const httpRequest = require('../src/httpRequest');

describe('httpRequest', () => {
  const URL = 'http://www.url.com';

  describe('getOptions', () => {
    it('returns the expected result', () => {
      const EXPECTED_RESULT = {
        url: URL,
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

      const result = httpRequest.getOptions(URL);
      assert.deepEqual(result, EXPECTED_RESULT);
    })

    it('adds the additionalOptions', () => {
      const EXPECTED_RESULT = {
        url: URL,
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
        },
      };

      const additionalOptions = {
        option1: 'opt1',
        option2: 'opt2'
      }

      Object.keys(additionalOptions).forEach((key) => {
        EXPECTED_RESULT[key] = additionalOptions[key];
      })

      const result = httpRequest.getOptions(URL, additionalOptions);
      assert.deepEqual(result, EXPECTED_RESULT);
    })

    it('updates the user agent', () => {
      const USER_AGENT = 'overrided user agent';
      const EXPECTED_RESULT = {
        url: URL,
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
          'User-Agent': USER_AGENT
        },
      };

      const result = httpRequest.getOptions(URL, null, USER_AGENT);
      assert.deepEqual(result, EXPECTED_RESULT);
    })
  })

  describe('execute', () => {
    const HTTP_REQUEST_RESULT = {
      statusCode: 200,
      body: 'my body is ready'
    };
    const httpRequest = proxyquire('../src/httpRequest', {
      'request-promise': () => {
        return Promise.resolve(HTTP_REQUEST_RESULT);
      }
    })

    it('calls getOptions', async () => {
      const additionalOptions = {
        anything: 'something'
      };
      const USER_AGENT = 'override user agent';
      const previousGetOptions = httpRequest.getOptions;
      let getOptionsCalled = false;
      httpRequest.getOptions = (url, pAdditionalOptions, overrideUserAgent) => {
        assert.equal(url, URL);
        assert.deepEqual(pAdditionalOptions, additionalOptions);
        assert.equal(overrideUserAgent, USER_AGENT);
        getOptionsCalled = true;
        return true;
      }
      await httpRequest.execute(URL, additionalOptions, USER_AGENT);
      httpRequest.getOptions = previousGetOptions;
      assert(getOptionsCalled);
    });

    it('calls request-promise module', async () => {
      let requestPromiseCalled = false;
      const httpRequest = proxyquire('../src/httpRequest', {
        'request-promise': (options) => {
          assert.deepEqual(options, httpRequest.getOptions(URL));
          requestPromiseCalled = true;
          return Promise.resolve(HTTP_REQUEST_RESULT);
        }
      })

      await httpRequest.execute(URL);
      assert(requestPromiseCalled);
    });

    it('returns request result', async () => {
      const result = await httpRequest.execute(URL);
      assert.deepEqual(result, HTTP_REQUEST_RESULT);
    });
  })
})