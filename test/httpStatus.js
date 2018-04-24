const assert = require('assert');
const describe = require('mocha').describe; // avoid eslint warnings
const it = require('mocha').it; // avoid eslint warnings
const proxyquire = require('proxyquire');
const requestErrors = require('request-promise/errors');

const URL = 'http://www.fake.com';

const REQ_OPTIONS = {
  options: 'anything'
};


const getMockHttpStatus = (statusCode, requestError) => {
  const httpStatus = proxyquire('../src/httpStatus', {
    './tech': () => {
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
  return httpStatus;
}

describe('httpStatus', () => {
  it('requests with Tech.getReqOptions', async () => {
    let requestCalled = false;
    const httpStatus = proxyquire('../src/httpStatus', {
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
    await httpStatus(URL);
    assert(requestCalled);
  });

  it('does not fail on StatusCodeError', async () => {
    const error = new requestErrors.StatusCodeError()
    error.statusCode = 999;
    const httpStatus = getMockHttpStatus(0, error);
    await httpStatus(URL);
  });

  it('fails on other request errors', async () => {
    let hasFailed = false;
    const error = {};
    const httpStatus = getMockHttpStatus(0, error);
    try {
      await httpStatus(URL);
    } catch (err) {
      assert.deepEqual(err, error);
      hasFailed = true;
    }
    assert(hasFailed);
  });

  it('returns http status code', async () => {
    const httpStatus = getMockHttpStatus(400);
    const result = await httpStatus(URL);
    assert.equal(result, 400);
  })
})