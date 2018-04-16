const Wappalyzer = require('wappalyzer')
const Tech = require('./tech')
const async = require('async')
const request = require('request-promise')
const requestErrors = require('request-promise/errors');
const Version = require('./version')

const progressSteps = {
  init: { start: 0, end: 1, defaultDescription: 'Starting up...' },
  fetch: { start: 1, end: 5, defaultDescription: 'Fetching page content' },
  analyze: { start: 5, end: 10, defaultDescription: 'Analyzing page content' },
  deepscan: { start: 10, end: 100, defaultDescription: 'Fine grain analysis' },
  complete: { start: 100, end: 100, defaultDescription: 'Scan complete' }
}

let progressCB = null

let setDetected = (app, pattern, type, value, key) => {
  for (let v of value) {
    let uri = v.root + "/" + v.path
    app.confidence[type + ' ' + uri] = v.status
  }

  // get most probable version among pattern.version. pattern.version is an array
  let maxVersion = null
  let l = pattern.version.length
  while (l--) { // take max release version, unless no release version detected.
      if (!maxVersion) maxVersion = pattern.version[l]
      else {
          v = pattern.version[l]
          var v1 = new Version(maxVersion)
          var v2 = new Version(v)
          if (v1.isReleaseVersion() === true) {
              if (v2.isReleaseVersion() === true) {
                  if (v2.GT(v1)) maxVersion = v
              }
          } else {
              if (v2.isReleaseVersion() === true) {
                  maxVersion = v
              } else {
                  if (v2.GT(v1)) maxVersion = v
              }
          }
      }
  }

  app.version = maxVersion
  app.versions = pattern.version // unlike other types, these are _possible_ versions. only one is really there.
}

let report = (url, scanDate, status, in_step_progress, networkError, httpStatus, description_override, apps) => {
  let detected = []

  if (apps) {
    for (let app of apps.applications) {
      detected.push(app)
    }
  }

  var progress_step = progressSteps[status]
  var desc = progress_step.defaultDescription
  if (description_override) desc = description_override
  var progress = progress_step.start + (((progress_step.end - progress_step.start) * in_step_progress) / 100)

  let ret = {
    url,
    status,
    progress,
    progressDescription: desc,
    scanDate,
    lastUpdate: (new Date()).toISOString(),
    networkError,
    httpStatus,
    detected
  }
  
  if (progressCB) {
    progressCB(ret)
  }

  return ret
}

let scan = async (url, _progressCB, homepageBody) => {
  progressCB = _progressCB
  const options = {
    debug: false,
    delay: 500,
    maxDepth: 1,
    maxUrls: 1,
    maxWait: 5000,
    recursive: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36',
  };

  const scanDate = (new Date()).toISOString()

  report(url, scanDate, 'init', 0)

  // request the URL
  let httpStatusCode, networkError;
  {
    const requestOptions = Tech.getReqOptions(url);
    requestOptions.resolveWithFullResponse = true;

    try {
      const response = await request(requestOptions);
      httpStatusCode = response.statusCode;

      // update homepagebody if necessary
      homepageBody = homepageBody || response.body;
    } catch(err) {
      if(err instanceof requestErrors.StatusCodeError) {
        httpStatusCode = err.statusCode;
      } else {
        networkError = err.cause && err.cause.code === 'ENOTFOUND' ? 'DNS ERROR' : 'UNKOWN ERROR';    
      }
      
      // stop on error
      report(url, scanDate, 'init', 100, networkError, httpStatusCode);
      return;
    }
  }

  const wappalyzer = new Wappalyzer(url, options)
  wappalyzer.log = (message, source, type) => {
    if (message.indexOf(' fetch;') !== -1) {
      report(url, scanDate, 'fetch', 0, networkError, httpStatusCode)
    }
    if (message.indexOf('browser.visit start') !== -1) {
      report(url, scanDate, 'analyze', 0, networkError, httpStatusCode)
    }
  }

  let apps = await wappalyzer.analyze()

  // DEEPSCAN
  let techApps = []
  let hasCMS = false // est-ce qu'un CMS a été détecté ?
  for (let app of apps.applications) {
    if (Tech.allTechs.indexOf(app.name) !== -1) {
      techApps.push(app)
    }

    let cats = []
    // est-ce qu'on a un CMS ?
    for (let categories of app.categories) {
      for (let cat in categories) {
        cats.push(cat)
        if (cat == 1 || cat == 11 || cat == 6) { // CMS, blog ou ecommerce
          hasCMS = true
        }
      }
    }

    app.categories = cats // change le format du tableau pour simplifier exploitation en PHP: [{"1": "CMS"}, {"11": "Blogs"}] => [1, 11]
  }

  if (!hasCMS) { // on n'a pas trouvé de CMS avec wappalyzer. On essaie avec Deepscan
    // wordpress
    let app = {}
    app.name = 'WordPress'
    app.confidence = 100 // si l'app est detectee, on est sûr à 100%
    app.icon = 'WordPress.svg'
    app.website = 'http://wordpress.org'
    app.categories = [1, 11] // {"1": "CMS"},{"11": "Blogs"}
    techApps.push(app)

    // drupal
    app = {}
    app.name = 'Drupal'
    app.confidence = 100 // si l'app est détectée, on est sûr à 100%
    app.icon = 'Drupal.png'
    app.website = 'http://drupal.org'
    app.categories = [1] // {"1": "CMS"}
    techApps.push(app)
  }

  var progressStep = progressSteps['deepscan']
  let deepScanStepSize = (progressStep.end - progressStep.start) / techApps.length
  let deepScanProgress = 0
  let deepScanRangePhase1 = 100 / 3 // phase 1 : recherche d'un cms caché ou de la version du CMS
  let deepScanRangePhase2 = 100 - deepScanRangePhase1 // phase 2 : recherche des plugins

  for (let app of techApps) {
    try {
      let tech = new Tech(app.name)
      tech.findRoots(url, homepageBody)

      if (!app.version) { // si on n'a pas de version on essaye de la trouver avec un deepscan
        await new Promise((resolve, reject) => {
          let progressMessage = 'Looking for ' + app.name + ' version.'
          if (!hasCMS) progressMessage = 'Looking for hidden ' + app.name + '.'

          tech.deepScan(function (err, result) {
              deepScanProgress += deepScanRangePhase1 / techApps.length
              report(url, scanDate, 'deepscan', deepScanProgress, networkError, httpStatusCode, progressMessage, apps)

              if (result.status == 'fail') {
                reject(err) // lève une exception
              } else {
                if (!hasCMS) { // cas où l'app ne fait pas encore partie de apps 
                  apps.applications.push(app)
                }
                setDetected(app, {version: result.versions, regex: ".*"}, "file", result.proofs)
                resolve()
              }
          }, function progressCB(progress) {
              let p = deepScanProgress + (deepScanRangePhase1 / 100) * progress / techApps.length
              report(url, scanDate, 'deepscan', p, networkError, httpStatusCode, progressMessage, apps)
          })
        })
      }

      // find plugins. Si on arrive ici c'est que la recherche d'app ci dessus n'a pas déclenché d'exception
      await new Promise((resolve) => {
        let pluginsLookupProgress
        tech.findPlugins(app.version, function (detected_plugins, plugin_progress) {
          let p = deepScanProgress + (deepScanRangePhase2 / 100) * plugin_progress / techApps.length
          app.plugins = detected_plugins
          report(url, scanDate, 'deepscan', p, networkError, httpStatusCode, 'Looking for ' + app.name + ' plugins.', apps)
        }, function doneCB(detected_plugins) {
            deepScanProgress += deepScanRangePhase2 / techApps.length

            app.plugins = detected_plugins
            report(url, scanDate, 'deepscan', deepScanProgress, networkError, httpStatusCode, 'Looking for ' + app.name + ' plugins.', apps)
            resolve()
        })
      })
    } catch (err) {
      // on n'a pas trouvé l'app. On passe à la suivante
    }
  }

  return new Promise((resolve)=>{
    resolve(report(url, scanDate, 'complete', 100, networkError, httpStatusCode, 'Scan complete', apps))
  })
}

module.exports.scan = scan