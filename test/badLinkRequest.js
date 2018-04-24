const assert = require('assert');
const describe = require('mocha').describe; // avoid eslint warnings
const it = require('mocha').it; // avoid eslint warnings
const proxyquire = require('proxyquire');

const ROOT = 'http://www.fake.com';
const RELATIVE_PATH = 'fakeDir/fake';
const EXTENSION = 'ext';

describe('badLinkRequest', () => {
  it('calls httpStatus', async () => {
    let httpStatusCalled = false;
    const badLinkRequest = proxyquire('../src/badLinkRequest', {
      './httpStatus': async (url) => {
        assert.equal(url.substring(0, ROOT.length), ROOT);
        assert.equal(url.substring(url.length - EXTENSION.length, url.length), EXTENSION);
        httpStatusCalled = true;
        return 400;
      }
    });

    const statusCode = await badLinkRequest(ROOT, RELATIVE_PATH, EXTENSION);
    assert(httpStatusCalled);
    assert.equal(statusCode, 400);
  });
})