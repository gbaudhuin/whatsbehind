const assert = require('assert')
const describe = require('mocha').describe // avoid eslint warnings
const it = require('mocha').it // avoid eslint warnings
const scanner = require('../src/index')

describe('scan', function () {
  this.timeout(300000)

  it.only('une phrase à la con', async function () {
    let url = 'http://wordpress3-8.whatsbehind.io/'
    //let url = 'https://www.isatech.fr/'
    //let url = 'http://wordpress4-9-4.whatsbehind.io/'
    //let url = 'https://wptavern.com/'
    //let url = 'https://stackoverflow.com/'
    //let url = 'https://edition.cnn.com/'
    //let url = 'https://www.isatech.fr/' // vieux wordpress avec plein de plugins vérolés
    //let url = 'http://www.spindrift-racing.com/' // drupal 7
    //let url = 'http://www.starwars.com/' // wordpress caché
    //let url = 'https://druid.fi/'
    //let url = 'https://www.auchan.fr/' 
    //let url = 'https://www.alibaba.com'
    // url = 'https://www.nike.com'
    // url = 'https://www.sony.com'
    //url = 'https://www.nytimes.com/'

    let result = await scanner.scan(url, (json) => {
      console.log(JSON.stringify(json, null, 2))
    })
  })
})
