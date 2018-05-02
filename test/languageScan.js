const assert = require('assert');
const describe = require('mocha').describe;
const it = require('mocha').it;
const proxyquire = require('proxyquire');
const languageScan = require('../src/languageScan');

const fs = require('fs');
const cultureCodes = JSON.parse(fs.readFileSync('./data/language/cultureCodes.json'));

const URL = 'http://www.peoleo.com';
const HTML = 'html';

const getMockLanguageScan = () => {
  return proxyquire('../src/languageScan', {
    './httpRequest': {
      execute: async () => {
        return HTML;
      }
    }
  })
}

describe('languageScan', () => {
  describe('scanUrl', () => {
    it('calls httpRequest.execute', async () => {
      let httpRequestCalled = false;
      const languageScan = proxyquire('../src/languageScan', {
        './httpRequest': {
          execute: async (url) => {
            assert.equal(url, URL);
            httpRequestCalled = true;
            return HTML;
          }
        }
      })
      await languageScan.scanUrl(URL);
      assert(httpRequestCalled);
    });

    it('calls scanHTML', async () => {
      const languageScan = getMockLanguageScan();
      let scanHTMLCalled = false;
      languageScan.scanHTML = (html) => {
        assert.equal(html, HTML);
        scanHTMLCalled = true;
      }
      await languageScan.scanUrl(URL);
      assert(scanHTMLCalled);
    });

    it('returns expected result', async () => {
      const SCAN_HTML_RESULT = {
        result: 'anything'
      };
      const languageScan = getMockLanguageScan();
      languageScan.scanHTML = () => SCAN_HTML_RESULT;
      const result = await languageScan.scanUrl(URL);
      assert.deepEqual(result, SCAN_HTML_RESULT);
    });
  })

  describe('scanHTML', () => {
    it('calls scanHrefLangs', () => {
      const languageScan = getMockLanguageScan();
      let scanHrefLangsCalled = false;
      languageScan.scanHrefLangs = (html) => {
        assert.equal(html, HTML);
        scanHrefLangsCalled = true;
      }
      languageScan.scanHTML(HTML);
      assert(scanHrefLangsCalled);
    });

    it('calls scanLinks', () => {
      const languageScan = getMockLanguageScan();
      let scanLinksCalled = false;
      languageScan.scanLinks = (html) => {
        assert.equal(html, HTML);
        scanLinksCalled = true;
      }
      languageScan.scanHTML(HTML);
      assert(scanLinksCalled);
    });

    it('returns expected result', () => {
      const HREF_LANGS_RESULT = {
        langs: 'something'
      };
      const INTERNATIONAL_LINKS_RESULT = {
        link: 'international'
      };
      const EXPECTED_RESULT = {
        hrefLangs: HREF_LANGS_RESULT,
        internationalLinks: INTERNATIONAL_LINKS_RESULT
      }
      const languageScan = getMockLanguageScan();
      languageScan.scanHrefLangs = () => HREF_LANGS_RESULT;
      languageScan.scanLinks = () => INTERNATIONAL_LINKS_RESULT;
      const result = languageScan.scanHTML(HTML);
      assert.deepEqual(result, EXPECTED_RESULT);
    });
  })

  describe('scanHrefLangs', () => {
    it('returns an empty array if no hreflang are found', () => {
      const result = languageScan.scanHrefLangs('');
      assert.deepEqual(result, []);
    });

    it('returns expected result', () => {
      const EXPECTED_RESULT = [
        {
          lang: 'en',
          href: 'http://www.peoleo.com/en/'
        },
        {
          lang: null,
          href: 'http://www.peoleo.com'
        },
        {
          lang: 'fr',
          href: null
        },
      ]
      const html = '<link hreflang="en" href="http://www.peoleo.com/en/"><link hreflang="" href="http://www.peoleo.com"><link hreflang="fr">';
      const result = languageScan.scanHrefLangs(html);
      assert.deepEqual(result, EXPECTED_RESULT);
    });
  })

  describe('scanLinks', () => {
    it('returns an empty array if no links are found', () => {
      const result = languageScan.scanLinks('');
      assert.deepEqual(result, []);
    });

    it('returns expected result', () => {
      let html = '';
      const EXPECTED_RESULT = [];
      cultureCodes.forEach((cultureCode) => {
        const link = 'http://www.peoleo.com/' + cultureCode.code + '/';
        const link2 = 'http://www.peoleo.com/' + cultureCode.code + '/2';
        EXPECTED_RESULT.push(link)
        EXPECTED_RESULT.push(link2)
        html += '<a href="' + link + '">link</a>';
        html += '<a href="' + link2 + '"><img /></a>';
      });

      const result = languageScan.scanLinks(html);
      assert.deepEqual(result, EXPECTED_RESULT);
    });
  })
})