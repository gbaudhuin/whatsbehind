const assert = require('assert');
const describe = require('mocha').describe;
const it = require('mocha').it;
const proxyquire = require('proxyquire');
const requestErrors = require('request-promise/errors');
const urlHelper = require('../src/urlHelper');

const URL_TO_CHECK = 'http://www.url.com';
const REQUEST_RESPONSE = {
  statusCode: 200
};


describe('url', () => {
  describe('equals', () => {
    describe('ignoreProtocol', () => {
      const urls = [
        URL_TO_CHECK,
        urlHelper.convertToHTTPS(URL_TO_CHECK),
        URL_TO_CHECK + '/',
        urlHelper.convertToHTTPS(URL_TO_CHECK) + '/',
        'http://www.peoleo.fr'
      ]

      const expectedResults = [
        true,
        true,
        true,
        true,
        false
      ];

      for (let i = 0; i < urls.length; i++) {
        const urlToCompare = urls[i];
        const expectedResult = expectedResults[i];
        it('returns ' + expectedResult + ' for ' + URL_TO_CHECK + ' and ' + urlToCompare, () => {
          const result = urlHelper.equals(URL_TO_CHECK, urlToCompare);
          assert.equal(result, expectedResults[i]);
        })
      }
    })

    describe('does not ignoreProtocol', () => {
      const urls = [
        URL_TO_CHECK,
        urlHelper.convertToHTTPS(URL_TO_CHECK),
        URL_TO_CHECK + '/',
        urlHelper.convertToHTTPS(URL_TO_CHECK) + '/',
        'http://www.peoleo.fr'
      ]

      const expectedResults = [
        true,
        false,
        true,
        false,
        false
      ];

      for (let i = 0; i < urls.length; i++) {
        const urlToCompare = urls[i];
        const expectedResult = expectedResults[i];
        it('returns ' + expectedResult + ' for ' + URL_TO_CHECK + ' and ' + urlToCompare, () => {
          const result = urlHelper.equals(URL_TO_CHECK, urlToCompare, false);
          assert.equal(result, expectedResults[i]);
        })
      }
    })
  })

  describe('exists', () => {
    it('calls httpRequest.execute', async () => {
      let executeCalled = false;
      const url = proxyquire('../src/urlHelper', {
        './httpRequest': {
          execute: (url) => {
            assert.deepEqual(url, URL_TO_CHECK);
            executeCalled = true;
            return REQUEST_RESPONSE;
          }
        }
      })
      await url.exists(URL_TO_CHECK);
      assert(executeCalled);
    });

    it('returns true if httpRequest does not fail', async () => {
      const url = proxyquire('../src/urlHelper', {
        './httpRequest': {
          execute: () => {
            return REQUEST_RESPONSE;
          }
        }
      })
      const result = await url.exists(URL_TO_CHECK);
      assert.deepEqual(result, true);
    });

    it('returns false if httpRequest fails with StatusCodeError', async () => {
      const url = proxyquire('../src/urlHelper', {
        './httpRequest': {
          execute: () => {
            throw new requestErrors.StatusCodeError();
          }
        }
      })
      const result = await url.exists(URL_TO_CHECK);
      assert.deepEqual(result, false);
    });

    it('returns false if httpRequest fails with other error', async () => {
      const url = proxyquire('../src/urlHelper', {
        './httpRequest': {
          execute: () => {
            throw new Error('WTF');
          }
        }
      })
      const result = await url.exists(URL_TO_CHECK);
      assert.deepEqual(result, false);
    });
  })

  describe('hasWWW', () => {
    const urls = [
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://peoleo.fr',
      'https://peoleo.fr',
      'http://subdomain.peoleo.fr',
      'https://subdomain.peoleo.fr',
      'http://peoleo.www.fr',
      'https://peoleo.www.fr'
    ];

    const expectedResults = [
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false
    ]

    for (let i = 0; i < urls.length; i++) {
      const expectedResult = expectedResults[i];
      const urlToCheck = urls[i];
      it('returns ' + expectedResult + ' for ' + urlToCheck, () => {
        assert.equal(urlHelper.hasWWW(urlToCheck), expectedResult);
      })
    }
  })

  describe('hasSubdomain', () => {
    const urls = [
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://peoleo.fr',
      'https://peoleo.fr',
      'http://subdomain.peoleo.fr',
      'https://subdomain.peoleo.fr',
      'http://peoleo.www.fr',
      'https://peoleo.www.fr'
    ];

    const expectedResults = [
      true,
      true,
      false,
      false,
      true,
      true,
      true,
      true
    ]

    for (let i = 0; i < urls.length; i++) {
      const expectedResult = expectedResults[i];
      const urlToCheck = urls[i];
      it('returns ' + expectedResult + ' for ' + urlToCheck, () => {
        assert.equal(urlHelper.hasSubdomain(urlToCheck), expectedResult);
      })
    }
  })

  describe('wwwCanBeAdded', () => {
    const urls = [
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://peoleo.fr',
      'https://peoleo.fr',
      'http://subdomain.peoleo.fr',
      'https://subdomain.peoleo.fr',
      'https://peoleo.www.fr',
      'http://peoleo.www.fr'
    ];

    const expectedResults = [
      false,
      false,
      true,
      true,
      false,
      false,
      false,
      false
    ]

    for (let i = 0; i < urls.length; i++) {
      const expectedResult = expectedResults[i];
      const urlToCheck = urls[i];
      it('returns ' + expectedResult + ' for ' + urlToCheck, () => {
        assert.equal(urlHelper.wwwCanBeAdded(urlToCheck), expectedResult);
      })
    }
  })

  describe('convertWithWWW', () => {
    const urls = [
      'http://peoleo.com',
      'https://peoleo.fr',
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://subdomain.peoleo.com',
      'https://subdomain.peoleo.com'
    ];
    const expectedUrls = [
      'http://www.peoleo.com',
      'https://www.peoleo.fr',
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://subdomain.peoleo.com',
      'https://subdomain.peoleo.com'
    ];

    for (let i = 0; i < urls.length; i++) {
      const baseUrl = urls[i];
      const expectedUrl = expectedUrls[i];
      it('returns ' + expectedUrl + ' for ' + baseUrl, () => {
        const convertedUrl = urlHelper.convertWithWWW(baseUrl);
        assert.equal(convertedUrl, expectedUrl);
      })
    }
  });


  describe('convertWithoutWWW', () => {
    const urls = [
      'http://www.peoleo.com',
      'https://www.peoleo.com',
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://peoleo.com',
      'https://peoleo.com'
    ];
    const expectedUrls = [
      'http://peoleo.com',
      'https://peoleo.com',
      'http://peoleo.fr',
      'https://peoleo.fr',
      'http://peoleo.com',
      'https://peoleo.com'
    ];

    for (let i = 0; i < urls.length; i++) {
      const baseUrl = urls[i];
      const expectedUrl = expectedUrls[i];
      it('calls exists with ' + expectedUrl + ' for ' + baseUrl, () => {
        const convertedUrl = urlHelper.convertWithoutWWW(baseUrl);
        assert.equal(convertedUrl, expectedUrl);
      })
    }
  })

  describe('toggleWWWAllowed', () => {
    const urls = [
      'http://www.peoleo.com',
      'http://peoleo.com',
      'http://subdomain.peoleo.com'
    ];
    const expectedResults = [
      true,
      true,
      false
    ];

    for (let i = 0; i < urls.length; i++) {
      const baseUrl = urls[i];
      const expectedResult = expectedResults[i];
      it('returns ' + expectedResult + ' for ' +  baseUrl, () => {
        const result = urlHelper.toggleWWWAllowed(baseUrl);
        assert.equal(result, expectedResult);
      })
    }
  })

  describe('toggleWWW', () => {
    const urls = [
      'http://www.peoleo.com',
      'http://peoleo.com',
      'http://subdomain.peoleo.com'
    ];
    const expectedResults = [
      'http://peoleo.com',
      'http://www.peoleo.com',
      'http://subdomain.peoleo.com'
    ];

    for (let i = 0; i < urls.length; i++) {
      const baseUrl = urls[i];
      const expectedResult = expectedResults[i];
      it('returns ' + expectedResult + ' for ' +  baseUrl, () => {
        const result = urlHelper.toggleWWW(baseUrl);
        assert.equal(result, expectedResult);
      })
    }
  })

  describe('existsWithWWW', () => {
    const urls = [
      'http://peoleo.com',
      'https://peoleo.fr',
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://subdomain.peoleo.com',
      'https://subdomain.peoleo.com'
    ];
    const expectedUrls = [
      'http://www.peoleo.com',
      'https://www.peoleo.fr',
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://subdomain.peoleo.com',
      'https://subdomain.peoleo.com'
    ];

    for (let i = 0; i < urls.length; i++) {
      const baseUrl = urls[i];
      const expectedUrl = expectedUrls[i];
      it('calls exists with ' + expectedUrl + ' for ' + baseUrl, () => {
        let existsCalled = false;
        const previousExists = urlHelper.exists;
        urlHelper.exists = (url) => {
          assert.equal(url, expectedUrl);
          existsCalled = true;
          return true;
        }
        urlHelper.existsWithWWW(baseUrl);
        urlHelper.exists = previousExists;
        assert(existsCalled);
      })
    }

    it('returns exists result', async () => {
      const EXPECTED_RESULT = {
        something: 'yep'
      };

      const previousExists = urlHelper.exists;
      urlHelper.exists = () => {
        return EXPECTED_RESULT;
      }
      const result = await urlHelper.existsWithWWW('url');
      urlHelper.exists = previousExists;
      assert.deepEqual(result, EXPECTED_RESULT);
    })
  });

  describe('existsWithoutWWW', () => {
    const urls = [
      'http://www.peoleo.com',
      'https://www.peoleo.com',
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://peoleo.com',
      'https://peoleo.com'
    ];
    const expectedUrls = [
      'http://peoleo.com',
      'https://peoleo.com',
      'http://peoleo.fr',
      'https://peoleo.fr',
      'http://peoleo.com',
      'https://peoleo.com'
    ];

    for (let i = 0; i < urls.length; i++) {
      const baseUrl = urls[i];
      const expectedUrl = expectedUrls[i];
      it('calls exists with ' + expectedUrl + ' for ' + baseUrl, () => {
        let existsCalled = false;
        const previousExists = urlHelper.exists;
        urlHelper.exists = (url) => {
          assert.equal(url, expectedUrl);
          existsCalled = true;
          return true;
        }
        urlHelper.existsWithoutWWW(baseUrl);
        urlHelper.exists = previousExists;
        assert(existsCalled);
      })
    }

    it('returns exists result', async () => {
      const EXPECTED_RESULT = {
        something: 'yep'
      };

      const previousExists = urlHelper.exists;
      urlHelper.exists = () => {
        return EXPECTED_RESULT;
      }
      const result = await urlHelper.existsWithoutWWW('url');
      urlHelper.exists = previousExists;
      assert.deepEqual(result, EXPECTED_RESULT);
    })
  });

  describe('hasWWWRedirection', () => {
    const getMockUrlHelper = (hasRedirect) => {
      const urlHelper = proxyquire('../src/urlHelper', {
        './httpRedirect': {
          hasRedirect: () => {
            return hasRedirect;
          }
        }
      });
      return urlHelper;
    }

    it('calls hasWWW', async () => {
      const urlHelper = getMockUrlHelper();
      let hasWWWCalled = false;
      urlHelper.hasWWW = (url) => {
        assert.equal(url, URL_TO_CHECK);
        hasWWWCalled = true;
        return true;
      }
      await urlHelper.hasWWWRedirection(URL_TO_CHECK);
      assert(hasWWWCalled);
    });

    it('calls wwwCanBeAdded if hasWWW results false', async () => {
      const urlHelper = getMockUrlHelper();
      urlHelper.hasWWW = () => {
        return false;
      }
      let wwwCanBeAddedCalled = false;
      urlHelper.wwwCanBeAdded = (url) => {
        assert.equal(url, URL_TO_CHECK);
        wwwCanBeAddedCalled = true;
        return false;
      }
      await urlHelper.hasWWWRedirection(URL_TO_CHECK);
      assert(wwwCanBeAddedCalled);
    });

    it('does not calls wwwCanBeAdded if hasWWW results true', async () => {
      const urlHelper = getMockUrlHelper();
      urlHelper.hasWWW = () => {
        return true;
      }
      let wwwCanBeAddedCalled = false;
      urlHelper.wwwCanBeAdded = () => {
        wwwCanBeAddedCalled = true;
        return false;
      }
      await urlHelper.hasWWWRedirection(URL_TO_CHECK);
      assert(!wwwCanBeAddedCalled);
    });

    it('calls convertWithoutWWW if url has www', async () => {
      const urlHelper = getMockUrlHelper();
      urlHelper.hasWWW = () => {
        return true;
      }
      let convertWithoutWWWCalled = false;
      urlHelper.convertWithoutWWW = (url) => {
        assert.equal(url, URL_TO_CHECK);
        convertWithoutWWWCalled = true;
        return false;
      }
      await urlHelper.hasWWWRedirection(URL_TO_CHECK);
      assert(convertWithoutWWWCalled);
    });

    it('does not call convertWithWWW if url has www', async () => {
      const urlHelper = getMockUrlHelper();
      urlHelper.hasWWW = () => {
        return true;
      }
      let convertWithWWWCaled = false;
      urlHelper.convertWithWWW = () => {
        convertWithWWWCaled = true;
        return false;
      }
      await urlHelper.hasWWWRedirection(URL_TO_CHECK);
      assert(!convertWithWWWCaled);
    });

    it('calls convertWithWWW if url does not have www', async () => {
      const urlHelper = getMockUrlHelper();
      urlHelper.hasWWW = () => {
        return false;
      }
      urlHelper.wwwCanBeAdded = () => {
        return true;
      }
      let convertWithWWWCalled = false;
      urlHelper.convertWithWWW = (url) => {
        assert.equal(url, URL_TO_CHECK);
        convertWithWWWCalled = true;
        return false;
      }
      await urlHelper.hasWWWRedirection(URL_TO_CHECK);
      assert(convertWithWWWCalled);
    });

    it('does not call convertWithoutWWW if url does not have www', async () => {
      const urlHelper = getMockUrlHelper();
      urlHelper.hasWWW = () => {
        return false;
      }
      let convertWithoutWWWCaled = false;
      urlHelper.convertWithoutWWW = () => {
        convertWithoutWWWCaled = true;
        return false;
      }
      await urlHelper.hasWWWRedirection(URL_TO_CHECK);
      assert(!convertWithoutWWWCaled);
    });

    it('calls httpRedirect.hasRedirect', async () => {
      let hasRedirectCalled = false;
      const urlHelper = proxyquire('../src/urlHelper', {
        './httpRedirect': {
          hasRedirect: (url, expectedUrl) => {
            assert.equal(url, urlHelper.toggleWWW(URL_TO_CHECK));
            assert.equal(expectedUrl, URL_TO_CHECK);
            hasRedirectCalled = true;
            return true;
          }
        }
      });
      urlHelper.hasWWW = () => {
        return true;
      }
      await urlHelper.hasWWWRedirection(URL_TO_CHECK);
      assert(hasRedirectCalled);
    });

    it('returns httpRedirect.hasRedirect result', async () => {
      const urlHelper = proxyquire('../src/urlHelper', {
        './httpRedirect': {
          hasRedirect: () => {
            return true;
          }
        }
      });
      urlHelper.hasWWW = () => {
        return true;
      }
      const result = await urlHelper.hasWWWRedirection(URL_TO_CHECK);
      assert.equal(result, true);
    });
  })

  describe('removeProtocol', () => {
    const urls = [
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://peoleo.fr',
      'https://peoleo.fr',
      'http://subdomain.peoleo.fr',
      'https://subdomain.peoleo.fr',
      'http://peoleo.www.fr',
      'https://peoleo.www.fr',
      'file://pathToFile'
    ];

    const expectedResults = [
      'www.peoleo.fr',
      'www.peoleo.fr',
      'peoleo.fr',
      'peoleo.fr',
      'subdomain.peoleo.fr',
      'subdomain.peoleo.fr',
      'peoleo.www.fr',
      'peoleo.www.fr',
      'pathToFile'
    ]

    for (let i = 0; i < urls.length; i++) {
      const expectedResult = expectedResults[i];
      const urlToCheck = urls[i];
      it('returns ' + expectedResult + ' for ' + urlToCheck, () => {
        const result = urlHelper.removeProtocol(urlToCheck);
        assert.equal(result, expectedResult);
      })
    }
  })

  describe('useHTTP', () => {
    const urls = [
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://peoleo.fr',
      'https://peoleo.fr',
      'http://subdomain.peoleo.fr',
      'https://subdomain.peoleo.fr',
      'http://peoleo.www.fr',
      'https://peoleo.www.fr'
    ];

    const expectedResults = [
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false
    ]

    for (let i = 0; i < urls.length; i++) {
      const expectedResult = expectedResults[i];
      const urlToCheck = urls[i];
      it('returns ' + expectedResult + ' for ' + urlToCheck, () => {
        assert.equal(urlHelper.useHTTP(urlToCheck), expectedResult);
      })
    }
  })

  describe('useHTTPS', () => {
    const urls = [
      'http://www.peoleo.fr',
      'https://www.peoleo.fr',
      'http://peoleo.fr',
      'https://peoleo.fr',
      'http://subdomain.peoleo.fr',
      'https://subdomain.peoleo.fr',
      'http://peoleo.www.fr',
      'https://peoleo.www.fr'
    ];

    const expectedResults = [
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true
    ]

    for (let i = 0; i < urls.length; i++) {
      const expectedResult = expectedResults[i];
      const urlToCheck = urls[i];
      it('returns ' + expectedResult + ' for ' + urlToCheck, () => {
        assert.equal(urlHelper.useHTTPS(urlToCheck), expectedResult);
      })
    }
  })

  describe('convertToHTTP', () => {
    const urls = [
      'https://www.peoleo.fr',
      'https://peoleo.fr',
      'http://www.peoleo.fr',
      'http://peoleo.fr'
    ];

    const expectedResults = [
      'http://www.peoleo.fr',
      'http://peoleo.fr',
      'http://www.peoleo.fr',
      'http://peoleo.fr',
    ]

    for (let i = 0; i < urls.length; i++) {
      const baseUrl = urls[i];
      const expectedResult = expectedResults[i];
      it('returns ' + expectedResult + ' for ' + baseUrl, () => {
        const result = urlHelper.convertToHTTP(baseUrl);
        assert.equal(result, expectedResult);
      })
    }
  });

  describe('convertToHTTPS', () => {
    const urls = [
      'https://www.peoleo.fr',
      'https://peoleo.fr',
      'http://www.peoleo.fr',
      'http://peoleo.fr'
    ];

    const expectedResults = [
      'https://www.peoleo.fr',
      'https://peoleo.fr',
      'https://www.peoleo.fr',
      'https://peoleo.fr',
    ]

    for (let i = 0; i < urls.length; i++) {
      const baseUrl = urls[i];
      const expectedResult = expectedResults[i];
      it('returns ' + expectedResult + ' for ' + baseUrl, () => {
        const result = urlHelper.convertToHTTPS(baseUrl);
        assert.equal(result, expectedResult);
      })
    }
  });

  describe('toggleHTTP', () => {
    const urls = [
      'https://www.peoleo.fr',
      'https://peoleo.fr',
      'http://www.peoleo.fr',
      'http://peoleo.fr'
    ];

    const expectedResults = [
      'http://www.peoleo.fr',
      'http://peoleo.fr',
      'https://www.peoleo.fr',
      'https://peoleo.fr',
    ]

    for (let i = 0; i < urls.length; i++) {
      const baseUrl = urls[i];
      const expectedResult = expectedResults[i];
      it('returns ' + expectedResult + ' for ' + baseUrl, () => {
        const result = urlHelper.toggleHTTP(baseUrl);
        assert.equal(result, expectedResult);
      })
    }
  });

  describe('existsWithHTTP', () => {
    const urls = [
      'https://www.peoleo.com',
      'http://www.peoleo.fr',
      'https://peoleo.com',
      'http://peoleo.com',
    ];
    const expectedUrls = [
      'http://www.peoleo.com',
      'http://www.peoleo.fr',
      'http://peoleo.com',
      'http://peoleo.com'
    ];

    for (let i = 0; i < urls.length; i++) {
      const baseUrl = urls[i];
      const expectedUrl = expectedUrls[i];
      it('calls exists with ' + expectedUrl + ' for ' + baseUrl, () => {
        let existsCalled = false;
        const previousExists = urlHelper.exists;
        urlHelper.exists = (url) => {
          assert.equal(url, expectedUrl);
          existsCalled = true;
          return true;
        }
        urlHelper.existsWithHTTP(baseUrl);
        urlHelper.exists = previousExists;
        assert(existsCalled);
      })
    }
  });

  describe('existsWithHTTPS', () => {
    const urls = [
      'https://www.peoleo.com',
      'http://www.peoleo.fr',
      'https://peoleo.com',
      'http://peoleo.com',
    ];
    const expectedUrls = [
      'https://www.peoleo.com',
      'https://www.peoleo.fr',
      'https://peoleo.com',
      'https://peoleo.com'
    ];

    for (let i = 0; i < urls.length; i++) {
      const baseUrl = urls[i];
      const expectedUrl = expectedUrls[i];
      it('calls exists with ' + expectedUrl + ' for ' + baseUrl, () => {
        let existsCalled = false;
        const previousExists = urlHelper.exists;
        urlHelper.exists = (url) => {
          assert.equal(url, expectedUrl);
          existsCalled = true;
          return true;
        }
        urlHelper.existsWithHTTPS(baseUrl);
        urlHelper.exists = previousExists;
        assert(existsCalled);
      })
    }

    it('returns exists result', async () => {
      const EXPECTED_RESULT = {
        something: 'yep'
      };

      const previousExists = urlHelper.exists;
      urlHelper.exists = () => {
        return EXPECTED_RESULT;
      }
      const result = await urlHelper.existsWithHTTPS('url');
      urlHelper.exists = previousExists;
      assert.deepEqual(result, EXPECTED_RESULT);
    })
  });

  describe('hasHTTPRedirection', async () => {
    const getMockUrlHelper = () => {
      const urlHelper = proxyquire('../src/urlHelper', {
        './httpRedirect': {
          hasRedirect: () => {
            return true;
          }
        }
      })
      return urlHelper;
    }
    it('calls toggleHTTP', async () => {
      const urlHelper = getMockUrlHelper();
      let toggleHTTPCalled = false;
      urlHelper.toggleHTTP = (url) => {
        assert.equal(url, URL_TO_CHECK);
        toggleHTTPCalled = true;
        return url;
      }
      await urlHelper.hasHTTPRedirection(URL_TO_CHECK);
      assert(toggleHTTPCalled);
    })

    it('calls httpRedirect.hasRedirect', async () => {
      let hasRedirectCalled = false;
      const urlHelper = proxyquire('../src/urlHelper', {
        './httpRedirect': {
          hasRedirect: (url, expectedUrl) => {
            assert.equal(url, urlHelper.toggleHTTP(URL_TO_CHECK));
            assert.deepEqual(expectedUrl, URL_TO_CHECK);
            hasRedirectCalled = true;
            return true;
          }
        }
      })
      await urlHelper.hasHTTPRedirection(URL_TO_CHECK);
      assert(hasRedirectCalled);
    })

    it('returns httpRedirect.hasRedirect result', async () => {
      const urlHelper = proxyquire('../src/urlHelper', {
        './httpRedirect': {
          hasRedirect: () => {
            return true;
          }
        }
      })
      urlHelper.toggleWWWAllowed = () => {
        return true;
      }
      const result = await urlHelper.hasHTTPRedirection(URL_TO_CHECK);
      assert.equal(result, true);
    })
  })
})