const assert = require('assert');
const describe = require('mocha').describe; // avoid eslint warnings
const it = require('mocha').it; // avoid eslint warnings
const proxyquire = require('proxyquire');

const ROOT = 'http://www.fake.com';
const RELATIVE_PATH = 'fakeDir/fake';
const EXTENSION = 'ext';

const getMockSoft404 = (statusCode, requestError) => {
  const soft404 = proxyquire('../src/soft404', {
    './badLinkRequest': () => {
      if (requestError) {
        throw requestError;
      }
      return statusCode;
    }
  });
  return soft404;
}

describe('soft404', () => {
  it('calls badLinkRequest', async () => {
    let badLinkRequestCalled = false;
    const soft404 = proxyquire('../src/soft404', {
      './badLinkRequest': (root, relativePath, ext) => {
        assert.equal(root, ROOT);
        assert.equal(relativePath, RELATIVE_PATH);
        assert.equal(ext, EXTENSION);
        badLinkRequestCalled = true;
      }
    });
    await soft404(ROOT, RELATIVE_PATH, EXTENSION);
    assert(badLinkRequestCalled);
  });

  it('fails if badLinkRequest throws an error', async () => {
    let hasFailed = false;
    const error = {};
    const soft404 = getMockSoft404(0, error);
    try {
      await soft404(ROOT, RELATIVE_PATH, EXTENSION);
    } catch (err) {
      assert.deepEqual(err, error);
      hasFailed = true;
    }
    assert(hasFailed);
  });

  it('returns DISABLED on 404', async () => {
    const soft404 = getMockSoft404(404);
    const result = await soft404(ROOT, RELATIVE_PATH, EXTENSION);
    assert.equal(result.statusCode, 404);
    assert.equal(result.soft404Status, soft404.STATUS.DISABLED);
  });

  const validStatusCodes = [200, 206, 403];
  validStatusCodes.forEach((statusCode) => {
    it('returns ENABLED on ' + statusCode, async () => {
      const soft404 = getMockSoft404(statusCode);
      const result = await soft404(ROOT, RELATIVE_PATH, EXTENSION);
      assert.equal(result.statusCode, statusCode);
      assert.equal(result.soft404Status, soft404.STATUS.ENABLED);
    });
  });

  for (let statusCode = 100; statusCode < 600; statusCode++) {
    if (validStatusCodes.indexOf(statusCode) === -1 && statusCode !== 404) {
      it('returns UNKNOWN on ' + statusCode, async () => {
        const soft404 = getMockSoft404(statusCode);
        const result = await soft404(ROOT, RELATIVE_PATH, EXTENSION);
        assert.equal(result.statusCode, statusCode);
        assert.equal(result.soft404Status, soft404.STATUS.UNKNOWN);
      });
    }
  }
})