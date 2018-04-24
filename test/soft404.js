const assert = require('assert');
const describe = require('mocha').describe; // avoid eslint warnings
const it = require('mocha').it; // avoid eslint warnings
const proxyquire = require('proxyquire');
const requestErrors = require('request-promise/errors');

const ROOT = 'http://www.fake.com';
const RELATIVE_PATH = 'fakeDir/fake';
const EXTENSION = 'ext';

const REQ_OPTIONS = {
  options: 'anything'
};
const getMockSoft404 = (statusCode, requestError) => {
  const soft404 = proxyquire('../src/soft404', {
    './tech': {
      getReqOptions: () => REQ_OPTIONS
    },
    'request-promise': async () => {
      if (requestError) {
        throw requestError;
      }
      return {
        statusCode
      };
    }
  });
  return soft404;
}

describe('soft404', () => {
  it('calls Tech.getReqOptions', async () => {
    let getReqOptionsCalled = false;
    const soft404 = proxyquire('../src/soft404', {
      './tech': {
        getReqOptions: (url) => {
          assert.equal(url.substring(0, ROOT.length), ROOT);
          assert.equal(url.substring(url.length - EXTENSION.length, url.length), EXTENSION);
          getReqOptionsCalled = true;
          return REQ_OPTIONS
        }
      },
      'request-promise': async () => {
        return {
          statusCode: 200
        };
      }
    });
    await soft404(ROOT, RELATIVE_PATH, EXTENSION, 400);
    assert(getReqOptionsCalled);
  });

  it('requests with Tech.getReqOptions', async () => {
    let requestCalled = false;
    const soft404 = proxyquire('../src/soft404', {
      './tech': {
        getReqOptions: () => REQ_OPTIONS
      },
      'request-promise': async (options) => {
        requestCalled = true;
        assert.deepEqual(options, REQ_OPTIONS);
        return {
          statusCode: 200
        };
      }
    });
    await soft404(ROOT, RELATIVE_PATH, EXTENSION, 400);
    assert(requestCalled);
  });

  it('does not fail on StatusCodeError', async () => {
    const error = new requestErrors.StatusCodeError()
    error.statusCode = 999;
    const soft404 = getMockSoft404(0, error);
    await soft404(ROOT, RELATIVE_PATH, EXTENSION, 400);
  });

  it('fails on other request errors', async () => {
    let hasFailed = false;
    const error = {};
    const soft404 = getMockSoft404(0, error);
    try {
      await soft404(ROOT, RELATIVE_PATH, EXTENSION, 400);
    } catch (err) {
      assert.deepEqual(err, error);
      hasFailed = true;
    }
    assert(hasFailed);
  });

  it('returns DISABLED on 404 if statusCode differs from 403', async () => {
    const soft404 = getMockSoft404(404);
    const result = await soft404(ROOT, RELATIVE_PATH, EXTENSION, 400);
    assert.equal(result.soft404Status, soft404.STATUS.DISABLED);
    assert.equal(result.statusCode, 404);
  });

  it('returns UNKNOWN on 404 if statusCode equals 403', async () => {
    const soft404 = getMockSoft404(404);
    const result = await soft404(ROOT, RELATIVE_PATH, EXTENSION, 403);
    assert.equal(result.soft404Status, soft404.STATUS.UNKNOWN);
    assert.equal(result.statusCode, 404);
  });

  const validStatusCodes = [200, 206, 403];
  validStatusCodes.forEach((statusCode) => {
    it('returns ENABLED on ' + statusCode + ' if statusCode differs from 403', async () => {
      const soft404 = getMockSoft404(statusCode);
      const result = await soft404(ROOT, RELATIVE_PATH, EXTENSION, 400);
      assert.equal(result.soft404Status, soft404.STATUS.ENABLED);
      assert.equal(result.statusCode, statusCode);
    });

    it('returns UNKNOWN on ' + statusCode + ' if statusCode equals 403', async () => {
      const soft404 = getMockSoft404(statusCode);
      const result = await soft404(ROOT, RELATIVE_PATH, EXTENSION, 403);
      assert.equal(result.soft404Status, soft404.STATUS.UNKNOWN);
      assert.equal(result.statusCode, statusCode);
    });
  });

  for (let statusCode = 100; statusCode < 600; statusCode++) {
    if (validStatusCodes.indexOf(statusCode) === -1 && statusCode !== 404) {
      it('returns UNKNOWN on ' + statusCode + ' if statusCode differs from 403', async () => {
        const soft404 = getMockSoft404(statusCode);
        const result = await soft404(ROOT, RELATIVE_PATH, EXTENSION, 400);
        assert.equal(result.soft404Status, soft404.STATUS.UNKNOWN);
      });

      it('returns UNKNOWN on ' + statusCode + ' if statusCode equals 403', async () => {
        const soft404 = getMockSoft404(statusCode);
        const result = await soft404(ROOT, RELATIVE_PATH, EXTENSION, 403);
        assert.equal(result.soft404Status, soft404.STATUS.UNKNOWN);
      });
    }
  }
})