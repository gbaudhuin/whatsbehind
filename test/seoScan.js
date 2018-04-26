const assert = require('assert');
const describe = require('mocha').describe;
const it = require('mocha').it;
const proxyquire = require('proxyquire');

const URL_METHODS = [
  'existsWithWWW',
  'existsWithoutWWW',
  'hasWWWRedirection',
  'existsWithHTTP',
  'existsWithHTTPS',
  'hasHTTPRedirection'
];

describe('seoScan', () => {
  const getMockSeoScan = () => {
    const seoScan = proxyquire('../src/seoScan', {
      './urlHelper': {
        existsWithWWW: () => true,
        existsWithoutWWW: () => true,
        hasWWWRedirection: () => true,
        existsWithHTTP: () => true,
        existsWithHTTPS: () => true,
        hasHTTPRedirection: () => true
      }
    })
    return seoScan;
  }

  it('notify progress', async () => {
    const seoScan = getMockSeoScan();
    let progressCalled = 0;

    await seoScan('fake url', (progress, result) => {
      progressCalled++;
      assert.equal(progress, (progressCalled) / URL_METHODS.length);

      const expectedResult = {};
      for (let i = 0; i < progressCalled; i++) {
        expectedResult[URL_METHODS[i]] = true;
      }

      assert.deepEqual(result, expectedResult);
    });
    assert.equal(progressCalled, URL_METHODS.length);
  });

  it('does not fail if progress callback is not defined', async () => {
    const seoScan = getMockSeoScan();
    await seoScan('fake url');
  });

  it('calls methods in order', async () => {
    let existsWithWWWCalled = false;
    let existsWithoutWWWCalled = false;
    let hasWWWRedirectionCalled = false;
    let existsWithHTTPCalled = false;
    let existsWithHTTPSCalled = false;
    let hasHTTPRedirectionCalled = false;
    const seoScan = proxyquire('../src/seoScan', {
      './urlHelper': {
        existsWithWWW: () => {
          existsWithWWWCalled = true
          return true;
        },
        existsWithoutWWW: () => {
          assert(existsWithWWWCalled);
          existsWithoutWWWCalled = true
          return true;
        },
        hasWWWRedirection: () => {
          assert(existsWithoutWWWCalled);
          hasWWWRedirectionCalled = true
          return true;
        },
        existsWithHTTP: () => {
          assert(hasWWWRedirectionCalled);
          existsWithHTTPCalled = true
          return true;
        },
        existsWithHTTPS: () => {
          assert(existsWithHTTPCalled);
          existsWithHTTPSCalled = true
          return true;
        },
        hasHTTPRedirection: () => {
          assert(existsWithHTTPSCalled);
          hasHTTPRedirectionCalled = true
          return true;
        }
      }
    })
    await seoScan('fake url');
    assert(hasHTTPRedirectionCalled);
  });

  it('returns expected result', async () => {
    const seoScan = getMockSeoScan();
    const result = await seoScan('fake url');

    const expectedResult = {};
    for (let i = 0; i < URL_METHODS.length; i++) {
      expectedResult[URL_METHODS[i]] = true;
    }

    assert.deepEqual(result, expectedResult);
  });
})