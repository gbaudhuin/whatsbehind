const assert = require('assert');
const describe = require('mocha').describe;
const it = require('mocha').it;
const proxyquire = require('proxyquire');

const responsiveScan = require('../src/responsiveScan');

const URL = 'http://www.peoleo.com';
const HTTP_REQUEST_RESULT = 'something';
const getMockResponsiveScan = () => {
  return proxyquire('../src/responsiveScan', {
    './httpRequest': {
      execute: async () => {
        return HTTP_REQUEST_RESULT;
      }
    }
  })
}


describe('responsiveScan', () => {
  describe('scanUrl', () => {
    it('calls httpRequest.execute', async () => {
      let executeCalled = false;
      const responsiveScan =  proxyquire('../src/responsiveScan', {
        './httpRequest': {
          execute: async (url) => {
            assert.equal(url, URL);
            executeCalled = true;
            return HTTP_REQUEST_RESULT;
          }
        }
      })

      await responsiveScan.scanUrl(URL);
      assert(executeCalled);
    });

    it('calls scanBody', async () => {
      const mobileScan = getMockResponsiveScan();
      let scanBodyCalled = false;
      mobileScan.scanBody = (rootUrl, html) => {
        assert.equal(rootUrl, URL);
        assert.equal(html, HTTP_REQUEST_RESULT);
        scanBodyCalled = true;
      }
      await mobileScan.scanUrl(URL);
      assert(scanBodyCalled);
    });

    it('returns scanBody result', async () => {
      const SCAN_BODY_RESULT = {
        scanBody: 'result'
      };
      const mobileScan = getMockResponsiveScan();
      mobileScan.scanBody = () => {
        return SCAN_BODY_RESULT;
      }
      const result = await mobileScan.scanUrl(URL);
      assert.deepEqual(result, SCAN_BODY_RESULT);
    });
  });

  describe('scanBody', () => {
    it('calls scanMediaQueries', () => {
      const responsiveScan = getMockResponsiveScan(URL);
      let scanMediaQueriesCalled = false;
      responsiveScan.scanMediaQueries = (rootUrl, html) => {
        assert.equal(rootUrl, URL);
        assert.equal(html, HTTP_REQUEST_RESULT);
        scanMediaQueriesCalled = true;
        return {};
      }
      responsiveScan.scanBody(URL, HTTP_REQUEST_RESULT);
      assert(scanMediaQueriesCalled);
    });

    it('returns expected result', async () => {
      const SCAN_MEDIA_QUERIES_RESULT = {
        anything: 'someting'
      };
      const EXPECTED_RESULT = {
        mediaQueries: SCAN_MEDIA_QUERIES_RESULT
      }
      const responsiveScan = getMockResponsiveScan(URL);
      responsiveScan.scanMediaQueries = () => {
        return SCAN_MEDIA_QUERIES_RESULT;
      }
      const result = await responsiveScan.scanBody(URL, HTTP_REQUEST_RESULT);
      assert.deepEqual(result, EXPECTED_RESULT);
    });
  })

  describe('scanMediaQueries', () => {
    it('calls getMediaQueries', async () => {
      const responsiveScan = getMockResponsiveScan(URL);
      let getMediaQueriesCalled = false;
      responsiveScan.getMediaQueries = (html) => {
        assert.equal(html, HTTP_REQUEST_RESULT);
        getMediaQueriesCalled = true;
        return [];
      }
      await responsiveScan.scanMediaQueries(URL, HTTP_REQUEST_RESULT);
      assert(getMediaQueriesCalled);
    });

    it('calls getExternalMediaQueries', async () => {
      const responsiveScan = getMockResponsiveScan(URL);
      let getExternalMediaQueriesCalled = false;
      responsiveScan.getExternalMediaQueries = (rootUrl, html) => {
        assert.equal(rootUrl, URL);
        assert.equal(html, HTTP_REQUEST_RESULT);
        getExternalMediaQueriesCalled = true;
        return [];
      }
      await responsiveScan.scanMediaQueries(URL, HTTP_REQUEST_RESULT);
      assert(getExternalMediaQueriesCalled);
    });

    it('returns expected result', async () => {
      const MEDIA_QUERIES = {
        anything: ['1']
      };
      const EXTERNAL_MEDIA_QUERIES = {
        something: ['1', '2']
      };
      const EXPECTED_RESULT = {
        inHTML: MEDIA_QUERIES,
        inCSS: EXTERNAL_MEDIA_QUERIES
      };
      const responsiveScan = getMockResponsiveScan(URL);
      responsiveScan.getMediaQueries = () => MEDIA_QUERIES;
      responsiveScan.getExternalMediaQueries = () => EXTERNAL_MEDIA_QUERIES;
      const result = await responsiveScan.scanMediaQueries(URL, HTTP_REQUEST_RESULT);
      assert.deepEqual(result, EXPECTED_RESULT);
    });
  })

  describe('getMediaQueries', () => {
    it('returns an empty array if HTML contains no media queries', () => {
      const result = responsiveScan.getMediaQueries('');
      assert.deepEqual(result, []);
    });

    it('returns the expected result without duplicate', () => {
      const result = responsiveScan.getMediaQueries('@media mediaQuery1 {} @media mediaQuery2 {} @media mediaQuery1 {}}');
      assert.deepEqual(result, ['mediaQuery1', 'mediaQuery2']);
    });
  })

  describe('getCssFiles', () => {
    it('returns an empty array if HTML contains no css files', () => {
      const result = responsiveScan.getCssFiles('');
      assert.deepEqual(result, []);
    });

    it('returns the expected result', () => {
      const result = responsiveScan.getCssFiles('<link href="pathToCss.css"> <link href="pathToCss2.css">');
      assert.deepEqual(result, ['pathToCss.css', 'pathToCss2.css']);
    });
  })

  describe('getExternalMediaQueries', () => {
    it('calls getCssFiles', async () => {
      const responsiveScan = getMockResponsiveScan(URL);
      let getCssFilesCalled = false;
      responsiveScan.getCssFiles = (html) => {
        assert.equal(html, HTTP_REQUEST_RESULT);
        getCssFilesCalled = true;
        return [];
      }
      await responsiveScan.getExternalMediaQueries(URL, HTTP_REQUEST_RESULT);
      assert(getCssFilesCalled);
    });

    it('calls getCssUrl for each css file', async () => {
      const CSS_FILES = ['path01', 'path02'];
      let getCssUrlIndex = 0;
      const responsiveScan = getMockResponsiveScan(URL);
      responsiveScan.getCssFiles = () => CSS_FILES;
      responsiveScan.getCssUrl = (rootUrl, cssFile) => {
        assert.equal(rootUrl, URL);
        assert.equal(cssFile, CSS_FILES[getCssUrlIndex++]);
        return 'url';
      }
      await responsiveScan.getExternalMediaQueries(URL, HTTP_REQUEST_RESULT);
      assert.equal(getCssUrlIndex, CSS_FILES.length);
    });

    it('calls httpRequest.execute for each css file', async () => {
      const CSS_FILES = ['path01', 'path02'];
      let httpRequestIndex = 0;
      const responsiveScan = proxyquire('../src/responsiveScan', {
        './httpRequest': {
          execute: async (url) => {
            assert.equal(url, URL + '/' + CSS_FILES[httpRequestIndex++]);
            return HTTP_REQUEST_RESULT;
          }
        }
      })
      responsiveScan.getCssFiles = () => CSS_FILES;
      await responsiveScan.getExternalMediaQueries(URL, HTTP_REQUEST_RESULT);
      assert.equal(httpRequestIndex, CSS_FILES.length);
    })

    it('does not fail if httpRequest.execute throws an error', async () => {
      const CSS_FILES = ['path01', 'path02'];
      let executeCalled = false;
      const responsiveScan = proxyquire('../src/responsiveScan', {
        './httpRequest': {
          execute: async () => {
            executeCalled = true;
            throw new Error('WTF');
          }
        }
      })
      responsiveScan.getCssFiles = () => CSS_FILES;
      await responsiveScan.getExternalMediaQueries(URL, HTTP_REQUEST_RESULT);
      assert(executeCalled);
    })

    it('calls getMediaQueries for each css file', async () => {
      const CSS_FILES = ['path01', 'path02'];
      const responsiveScan = getMockResponsiveScan(URL);
      responsiveScan.getCssFiles = () => CSS_FILES;
      let getMediaQueriesIndex = 0;
      responsiveScan.getMediaQueries = (cssFileContent) => {
        assert.equal(cssFileContent, HTTP_REQUEST_RESULT);
        getMediaQueriesIndex++;
      }
      await responsiveScan.getExternalMediaQueries(URL, HTTP_REQUEST_RESULT);
      assert.equal(getMediaQueriesIndex, CSS_FILES.length);
    })

    it('returns expected result', async () => {
      const CSS_FILES = ['path01', 'path02'];
      const MEDIA_QUERIES = ['anything'];
      const EXPECTED_RESULT = {};
      CSS_FILES.forEach((css) => {
        EXPECTED_RESULT[URL + '/' + css] = MEDIA_QUERIES
      });
      const responsiveScan = getMockResponsiveScan(URL);
      responsiveScan.getCssFiles = () => CSS_FILES;
      responsiveScan.getMediaQueries = () => MEDIA_QUERIES;
      const result = await responsiveScan.getExternalMediaQueries(URL, HTTP_REQUEST_RESULT);
      assert.deepEqual(result, EXPECTED_RESULT);
    })
  })

  describe('getCssUrl', () => {
    it('calls urlHelper.isAbsolute', () => {
      const CSS_PATH = 'css';
      let isAbsoluteCalled = false;
      const responsiveScan = proxyquire('../src/responsiveScan', {
        './urlHelper': {
          isAbsolute: (url) => {
            assert(url, CSS_PATH);
            isAbsoluteCalled = true;
          }
        }
      })
      responsiveScan.getCssUrl(URL, CSS_PATH);
      assert(isAbsoluteCalled);
    });

    const cssPaths = [
      'http://www.peoleo.com/peoleo.css',
      '//peoleo.com/peoleo.css',
      './peoleo.css'
    ];

    const expectedResults = [
      'http://www.peoleo.com/peoleo.css',
      'http://peoleo.com/peoleo.css',
      'http://www.peoleo.com/./peoleo.css'
    ]

    for (let i = 0; i < cssPaths.length; i++) {
      const cssPath = cssPaths[i];
      const expectedResult = expectedResults[i];
      it('returns ' + expectedResult + ' for ' + cssPath, () => {
        const cssUrl = responsiveScan.getCssUrl(URL, cssPath);
        assert.equal(cssUrl, expectedResult);
      })
    }
  })
})