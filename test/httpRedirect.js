const assert = require('assert');
const describe = require('mocha').describe;
const it = require('mocha').it;
const proxyquire = require('proxyquire');

const URL = 'http://url.com';

const EXPECTED_REDIRECTS = [];
EXPECTED_REDIRECTS.push({
  redirectUri: 'http://wwww.url.com'
})
EXPECTED_REDIRECTS.push({
  redirectUri: 'https://www.url.com'
})

const REQUEST_RESULT = {
  request: {
    _redirect: {
      redirects: EXPECTED_REDIRECTS
    }
  }
}

const getMockHttpRedirect = () => {
  const httpRedirect = proxyquire('../src/httpRedirect', {
    './httpRequest': {
      execute: (url, additionalOptions) => {
        assert(url, URL);
        assert(additionalOptions, {
          simple: false,
          followRedirect: true,
          resolveWithFullResponse: true
        })
        return REQUEST_RESULT
      }
    }
  })
  return httpRedirect;
}

describe('httpRedirect', () => {
  describe('get', () => {
    it('calls httpRequest.execute', () => {
      let httpRequestCalled = false;
      const httpRedirect = proxyquire('../src/httpRedirect', {
        './httpRequest': {
          execute: (url, additionalOptions) => {
            assert(url, URL);
            assert(additionalOptions, {
              simple: false,
              followRedirect: true,
              resolveWithFullResponse: true
            })
            httpRequestCalled = true;
            return {
              request: {
                _redirect: {
                  redirects: []
                }
              }
            }
          }
        }
      })
      httpRedirect.get(URL);
      assert(httpRequestCalled);
    });

    it('returns expected result', async () => {
      const httpRedirect = getMockHttpRedirect();
      const result = await httpRedirect.get(URL);
      assert.deepEqual(result, EXPECTED_REDIRECTS);
    });
  })

  describe('hasRedirect', () => {
    it('calls get', async () => {
      let getCalled = false;
      const httpRedirect = getMockHttpRedirect();
      httpRedirect.get = (url) => {
        assert.equal(url, URL);
        getCalled = true;
        return REQUEST_RESULT;
      }
      await httpRedirect.hasRedirect(URL, 'url');
      assert(getCalled);
    });

    it('calls urlHelper.equals for expectedUrl (as string)', async () => {
      let equalsCalled = false;
      let urlIndex = 0;
      const expectedUrl = 'url';
      const httpRedirect = proxyquire('../src/httpRedirect', {
        './httpRequest': {
          execute: async () => {
            return REQUEST_RESULT;
          }
        },
        './urlHelper': {
          equals: (url1, url2, ignoreProtocol) => {
            assert.equal(url1, EXPECTED_REDIRECTS[urlIndex++].redirectUri);
            assert.equal(url2, expectedUrl);
            assert.equal(ignoreProtocol, true);
            equalsCalled = true;
            return false;
          }
        }
      })
      await httpRedirect.hasRedirect(URL, expectedUrl);
      assert(equalsCalled);
    });

    it('calls urlHelper.equals for each expectedUrl (as array)', async () => {
      let equalsCalled = false;
      let url1Index = 0;
      let url2Index = 0;
      const expectedUrls = ['url1', 'url2'];
      const httpRedirect = proxyquire('../src/httpRedirect', {
        './httpRequest': {
          execute: async () => {
            return REQUEST_RESULT;
          }
        },
        './urlHelper': {
          equals: (url1, url2, ignoreProtocol) => {
            assert.equal(url1, EXPECTED_REDIRECTS[url1Index].redirectUri);
            assert.equal(url2, expectedUrls[url2Index++]);
            assert.equal(ignoreProtocol, true);
            equalsCalled = true;
            if (url2Index === expectedUrls.length) {
              url2Index = 0;
              url1Index++;
            }
            return false;
          }
        }
      })
      await httpRedirect.hasRedirect(URL, expectedUrls);
      assert(equalsCalled);
    });

    const expectedUrls = [
      'nope'
    ];

    const expectedResults = [
      false
    ];
    EXPECTED_REDIRECTS.forEach((redirect) => {
      expectedUrls.push(redirect.redirectUri);
      expectedResults.push(true);
    })

    for (let i = 0; i < expectedUrls.length; i++) {
      it('returns ' + expectedResults[i] + ' for ' + expectedUrls[i] + ' (as string)', async () => {
        const httpRedirect = getMockHttpRedirect();
        const result = await httpRedirect.hasRedirect(URL, expectedUrls[i]);
        assert.equal(result, expectedResults[i]);
      });
    }

    it('returns true if expectedUrl contains the redirection (as array)', async () => {
      const expectedUrls = [
        'nope'
      ];
      EXPECTED_REDIRECTS.forEach((redirect) => {
        expectedUrls.push(redirect.redirectUri);
      })

      const httpRedirect = getMockHttpRedirect();
      const result = await httpRedirect.hasRedirect(URL, expectedUrls);
      assert.equal(result, true);
    });

    it('returns false if expectedUrl contains the a redirection (as array)', async () => {
      const expectedUrls = [
        'nope',
        'nope nope'
      ];

      const httpRedirect = getMockHttpRedirect();
      const result = await httpRedirect.hasRedirect(URL, expectedUrls);
      assert.equal(result, false);
    });
  })
})