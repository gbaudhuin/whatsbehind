const proxyquire = require('proxyquire');
const httpStatus = require('../src/httpStatus');
const assert = require('assert');

const TEST_URL = 'fake url'

const FAKE_REQUEST = {
  on: () => {}
}

describe('httpStatus', () => {
  it('calls http.get', (done) => {
    const httpStatus = proxyquire('../src/httpStatus', {
      http: {
        get: (url) => {
          assert.equal(url, TEST_URL);
          done()
          const response = {
            resume: () => {}
          };

          return FAKE_REQUEST;
        }
      }
    })

    httpStatus(TEST_URL)
      .catch(done);
  })

  it('calls resume on request response', (done) => {
    const httpStatus = proxyquire('../src/httpStatus', {
      http: {
        get: (url, callback) =>{
          assert.equal(url, TEST_URL);
          const response = {
            resume: () => {
              done();
            }
          };
          callback(response);
          return FAKE_REQUEST;
        }
      }
    })

    httpStatus(TEST_URL)
      .catch(done);
  })

  it('resolve with status code', (done) => {
    const httpStatus = proxyquire('../src/httpStatus', {
      http: {
        get: (url, callback) =>{
          assert.equal(url, TEST_URL);
          const response = {
            resume: () => {},
            statusCode: 123
          };
          callback(response);
          return FAKE_REQUEST;
        }
      }
    })

    httpStatus(TEST_URL)
      .then((code) => {
        assert.equal(code, 123);
        done();
      })
      .catch(done);
  });

  it('reject if http.get fails', (done) => {
    const httpStatus = proxyquire('../src/httpStatus', {
      http: {
        get: (url) =>{
          assert.equal(url, TEST_URL);
          throw new Error('WTF');
        }
      }
    })

    httpStatus(TEST_URL)
      .then(() => {
        done(new Error('Should not resolve'));
      })
      .catch((error) => {
        assert.equal(error.message, 'WTF');
        done();
      });
  });

  it('reject if request throws an error', (done) => {
    const httpStatus = proxyquire('../src/httpStatus', {
      http: {
        get: (url, callback) =>{
          assert.equal(url, TEST_URL);
          return {
            on: (type, callback) => {
              assert(type, 'error');
              callback(new Error('WTF'));
            }
          };
        }
      }
    })

    httpStatus(TEST_URL)
      .then(() => {
        done(new Error('Should not resolve'));
      })
      .catch((error) => {
        assert.equal(error.message, 'WTF');
        done();
      });
  });
})