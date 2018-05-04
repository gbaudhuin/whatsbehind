const assert = require('assert');
const describe = require('mocha').describe;
const it = require('mocha').it;
const proxyquire = require('proxyquire');

const mobileScan = require('../src/mobileScan');

const URL = 'http://www.url.com';
const HTTP_REQUEST_RESULT = 'something';
const SCAN_BODY_RESULT = {
  something: 'anything'
};
const SCAN_MOBLE_REDIRECTION_RESULT = 'mobile redirection';
const getMockMobileScan = () => {
  const mobileScan = proxyquire('../src/mobileScan', {
    './httpRequest': {
      execute: async () => {
        return HTTP_REQUEST_RESULT;
      }
    }
  })

  mobileScan.scanRedirection = async () => SCAN_MOBLE_REDIRECTION_RESULT;
  return mobileScan;
}

describe('mobileScan', () => {
  describe('scanUrl', () => {
    it('calls httpRequest.execute', async () => {
      let executeCalled = false;
      const mobileScan =  proxyquire('../src/mobileScan', {
        './httpRequest': {
          execute: async (url) => {
            assert.equal(url, URL);
            executeCalled = true;
            return HTTP_REQUEST_RESULT;
          }
        }
      })

      await mobileScan.scanUrl(URL);
      assert(executeCalled);
    });

    it('calls scanBody', async () => {
      const mobileScan = getMockMobileScan();
      let scanBodyCalled = false;
      mobileScan.scanBody = (html) => {
        assert.equal(html, HTTP_REQUEST_RESULT);
        scanBodyCalled = true;
        return {};
      }
      await mobileScan.scanUrl(URL);
      assert(scanBodyCalled);
    });

    it('calls scanRedirection', async () => {
      const mobileScan = getMockMobileScan();
      let scanRedirectionCalled = false;
      mobileScan.scanRedirection = (url) => {
        assert.equal(url, URL);
        scanRedirectionCalled = true;
      }
      await mobileScan.scanUrl(URL);
      assert(scanRedirectionCalled);
    })

    it('returns expected result', async () => {
      const EXPECTED_RESULT = {
        redirection: SCAN_MOBLE_REDIRECTION_RESULT
      }
      Object.keys(SCAN_BODY_RESULT).forEach((key) => {
        EXPECTED_RESULT[key] = SCAN_BODY_RESULT[key];
      })
      const mobileScan = getMockMobileScan();
      mobileScan.scanBody = () => SCAN_BODY_RESULT;
      const result = await mobileScan.scanUrl(URL);
      assert.deepEqual(result, EXPECTED_RESULT);
    });
  });

  describe('scanRedirection', () => {
    const REDIRECTIONS_NO_USER_AGENT = [
      [],
      [],
      [{redirectUri: 'redirection' }],
      [{redirectUri: 'redirection'}],
      [{redirectUri: 'redirection'}]
    ];
    const REDIRECTIONS_MOBILE_USER_AGENT = [
      [],
      [{redirectUri: 'mobile redirection'}],
      [],
      [{redirectUri: 'redirection'}],
      [{redirectUri: 'mobile redirection'}]
    ];
    const EXPECTED_RESULTS = [
      null,
      'mobile redirection',
      null,
      null,
      'mobile redirection'
    ]

    for (let i = 0; i < REDIRECTIONS_NO_USER_AGENT.length; i++) {
      const redirections = REDIRECTIONS_NO_USER_AGENT[i];
      const mobileRedirections = REDIRECTIONS_MOBILE_USER_AGENT[i];
      const expectedResult = EXPECTED_RESULTS[i];
      it('returns ' + expectedResult + ' for [' + redirections + '] and [' + mobileRedirections + ']', async () => {
        let redirectIndex = 0;
        const mobileScan = proxyquire('../src/mobileScan', {
          './httpRedirect': {
            get: async (url, additionalOptions, userAgentOverride) => {
              assert.equal(url, URL);
              assert.deepEqual(additionalOptions, null);
              assert.deepEqual(userAgentOverride, redirectIndex === 0 ? null : 'Mozilla/5.0 (Linux; U; Android 4.0.3; ko-kr; LG-L160L Build/IML74K) AppleWebkit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30');
              const result = redirectIndex === 0 ? redirections : mobileRedirections;
              redirectIndex++;
              return result;
            }
          }
        });
        const result = await mobileScan.scanRedirection(URL);
        assert.equal(redirectIndex, 2);
        assert.deepEqual(result, expectedResult);
      })
    }
  })

  describe('scanBody', () => {
    it('calls scanAMP', async () => {
      const expectedHTML = 'html';
      let scanAMPCalled = false;
      const mobileScan = getMockMobileScan();
      mobileScan.scanAMP = (html) => {
        assert.equal(html, expectedHTML);
        scanAMPCalled = true;
      }
      await mobileScan.scanBody(expectedHTML);
      assert(scanAMPCalled);
    });

    it('calls scanViewportMetas', async () => {
      const expectedHTML = 'html';
      let scanViewportMetasCalled = false;
      const mobileScan = getMockMobileScan();
      mobileScan.scanViewportMetas = (html) => {
        assert.equal(html, expectedHTML);
        scanViewportMetasCalled = true;
      }
      await mobileScan.scanBody(expectedHTML);
      assert(scanViewportMetasCalled);
    });

    it('returns expected result', async () => {
      const SCAN_AMP_RESULT = {
        scanAMP: 'result'
      };
      const VIEWPORT_META_RESULT = {
        anything: 'something'
      };
      const EXPECTED_RESULT = {
        isAMP: SCAN_AMP_RESULT,
        viewportMeta: VIEWPORT_META_RESULT
      }
      const mobileScan = getMockMobileScan();
      mobileScan.scanAMP = () => SCAN_AMP_RESULT;
      mobileScan.scanViewportMetas = () => VIEWPORT_META_RESULT;
      const result = await mobileScan.scanBody();
      assert.deepEqual(result, EXPECTED_RESULT);
    });
  });

  describe('scanAMP', () => {
    const htmls = [
      '<html amp>',
      '<html ⚡>',
      '<html>'
    ];

    const expectedResults = [
      true,
      true,
      false
    ]

    for (let i = 0; i < htmls.length; i++) {
      const meta = htmls[i];
      const expectedResult = expectedResults[i];
      it('returns ' + expectedResult + ' for ' + meta, () => {
        const result = mobileScan.scanAMP(meta);
        assert.deepEqual(result, expectedResult);
      });
    }
  })

  describe('scanViewportMetas', () => {
    it('calls getViewportMetas', () => {
      const HTML = 'HTML';
      const mobileScan = getMockMobileScan();
      let getViewportMetasCalled = false;
      mobileScan.getViewportMetas = (html) => {
        assert.equal(html, HTML);
        getViewportMetasCalled = true;
        return [];
      }
      mobileScan.scanViewportMetas(HTML);
      assert(getViewportMetasCalled);
    });

    const methods = [
      'isDeviceWidthViewportMeta',
      'isInitialScaleViewportMeta',
      'isMinimumScaleViewportMeta',
      'isShrinkToFitViewportMeta'
    ];

    const bools = [
      'hasWitdhEqualsDeviceWidth',
      'hasInitialScaleEquals1',
      'hasMinimumScaleEquals1',
      'hasShrinkToFitEqualsNo'
    ]

    const METAS = ['meta1', 'meta2'];
    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      const bool = bools[i];
      it('calls ' + method + ' for each viewport meta', () => {
        const mobileScan = getMockMobileScan();
        mobileScan.getViewportMetas = () => {
          return METAS;
        }
        let index = 0;
        mobileScan[method] = (meta) => {
          assert.equal(meta, METAS[index++]);
        }
        mobileScan.scanViewportMetas();
        assert.equal(index, METAS.length);
      });

      it('sets ' + bool + ' to true if ' + method + ' returns true (every time)', () => {
        const mobileScan = getMockMobileScan();
        mobileScan.getViewportMetas = () => {
          return METAS;
        }
        mobileScan[method] = () => {
          return true;
        }
        const result = mobileScan.scanViewportMetas();
        assert.deepEqual(result[bool], true);
      });

      it('sets ' + bool + ' to false if ' + method + ' returns false (every time)', () => {
        const mobileScan = getMockMobileScan();
        mobileScan.getViewportMetas = () => {
          return METAS;
        }
        mobileScan[method] = () => {
          return false;
        }
        const result = mobileScan.scanViewportMetas();
        assert.deepEqual(result[bool], false);
      });

      it('sets ' + bool + ' to true if ' + method + ' returns true (one time)', () => {
        const mobileScan = getMockMobileScan();
        mobileScan.getViewportMetas = () => {
          return METAS;
        }
        let index = 0;
        mobileScan[method] = () => {
          return index++ === 0;
        }
        const result = mobileScan.scanViewportMetas();
        assert.deepEqual(result[bool], true);
      });
    }
  })

  describe('getViewportMetas', () => {
    it('returns an empty array if there is no meta', () => {
      const result = mobileScan.getViewportMetas('');
      assert.deepEqual(result, []);
    });

    it('returns only the viewport meta', () => {
      const result = mobileScan.getViewportMetas('<meta name="something"><meta name="viewport"><meta name="anything">');
      assert.deepEqual(result, ['<meta name="viewport">']);
    });
  })

  describe('hasViewportMeta', () => {
    it('calls getViewportMetas', () => {
      let getViewportMetasCalled = false;
      const mobileScan = getMockMobileScan();
      mobileScan.getViewportMetas = () => {
        getViewportMetasCalled = true;
        return [];
      }
      mobileScan.hasViewportMeta('html');
      assert(getViewportMetasCalled);
    });

    it('returns false if getViewportMetas returns an empty array', () => {
      const mobileScan = getMockMobileScan();
      mobileScan.getViewportMetas = () => {
        return [];
      }
      const result = mobileScan.hasViewportMeta('html');
      assert.deepEqual(result, false);
    });

    it('returns true if getViewportMetas returns a non-empty array', () => {
      const mobileScan = getMockMobileScan();
      mobileScan.getViewportMetas = () => {
        return ['meta1'];
      }
      const result = mobileScan.hasViewportMeta('html');
      assert.deepEqual(result, true);
    })
  })

  describe('isDeviceWidthViewportMeta', () => {
    const metas = [
      '<meta name="viewport" content="minimum-scale=1>',
      '<meta name="viewport" content="width=device-width, minimum-scale=1">',
      '<meta name="viewport" content="initial-scale=1.0, width=device-width, minimum-scale=1.0">',
      '<meta name="viewport" content="initial-scale=1.0, minimum-scale=1.0, width=device-width">'
    ];

    const expectedResults = [
      false,
      true,
      true,
      true
    ]

    for (let i = 0; i < metas.length; i++) {
      const meta = metas[i];
      const expectedResult = expectedResults[i];
      it('returns ' + expectedResult + ' for ' + meta, () => {
        const result = mobileScan.isDeviceWidthViewportMeta(meta);
        assert.deepEqual(result, expectedResult);
      });
    }
  })

  describe('isInitialScaleViewportMeta', () => {
    const metas = [
      '<meta name="viewport" content="width=device-width, minimum-scale=1>',
      '<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0">',
      '<meta name="viewport" content="width=device-width, minimum-scale=1.0, initial-scale=1.0">'
    ];

    const expectedResults = [
      false,
      true,
      true,
      true
    ]

    for (let i = 0; i < metas.length; i++) {
      const meta = metas[i];
      const expectedResult = expectedResults[i];
      it('returns ' + expectedResult + ' for ' + meta, () => {
        const result = mobileScan.isInitialScaleViewportMeta(meta);
        assert.deepEqual(result, expectedResult);
      });
    }
  })

  describe('isMinimumScaleViewportMeta', () => {
    const metas = [
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0">',
      '<meta name="viewport" content="width=device-width, minimum-scale=1.0, initial-scale=1.0">'
    ];

    const expectedResults = [
      false,
      true,
      true,
      true
    ]

    for (let i = 0; i < metas.length; i++) {
      const meta = metas[i];
      const expectedResult = expectedResults[i];
      it('returns ' + expectedResult + ' for ' + meta, () => {
        const result = mobileScan.isMinimumScaleViewportMeta(meta);
        assert.deepEqual(result, expectedResult);
      });
    }
  })

  describe('isShrinkToFitViewportMeta', () => {
    const metas = [
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, shrink-to-fit=no">',
      '<meta name="viewport" content="width=device-width, shrink-to-fit=no, initial-scale=1.0">',
      '<meta name="viewport" content="width=device-width, shrink-to-fit=yes, initial-scale=1.0">',
    ];

    const expectedResults = [
      false,
      true,
      true,
      false
    ]

    for (let i = 0; i < metas.length; i++) {
      const meta = metas[i];
      const expectedResult = expectedResults[i];
      it('returns ' + expectedResult + ' for ' + meta, () => {
        const result = mobileScan.isShrinkToFitViewportMeta(meta);
        assert.deepEqual(result, expectedResult);
      });
    }
  })
})