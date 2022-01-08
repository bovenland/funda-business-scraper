#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

const CACHE_FILENAME = path.join(__dirname, 'data', 'funda-cache.json')
let cache = {}
try {
  cache = require(CACHE_FILENAME)
} catch (err) {
  console.error('Cache not found, creating after first run')
}

function writeCacheToFile () {
  console.error('Writing cache to file')
  fs.writeFileSync(CACHE_FILENAME, JSON.stringify(cache, null, 2))
}

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shuffleArray (array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }

  return array
}

async function newPage (browser) {
  const page = await browser.newPage()

  await page.setViewport({
    width: 1000 + Math.floor(Math.random() * 100),
    height: 1400 + Math.floor(Math.random() * 100)
  })

  return page
}

async function scrapePostcode (page, postcode) {
  const postcodeResults = []

  let index = 1
  let foundItems = false

  do {
    const pageResults = await scrapePostcodePage(page, postcode, index)

    if (pageResults && pageResults.length > 0) {
      postcodeResults.push(...pageResults)
      foundItems = true
    } else {
      foundItems = false
    }

    index += 1
  } while (foundItems)

  return postcodeResults
}

async function scrapePostcodePage (page, postcode, index) {
  const url = `https://www.fundainbusiness.nl/winkel/${postcode}/+5km/p${index}`

  const seconds = 2 + 7 * Math.random()
  console.error(`Sleeping ${Math.round(seconds)} seconds...`)
  await sleep(1000 * seconds)

  console.error('Scraping', url)

  const cookies = await page.cookies(url)
  await page.deleteCookie(...cookies)

  await page.goto(url)

  const results = await page.$$eval('ol.search-results li.search-result', (elements) => elements
    .map((element) => ({
      address: element.querySelector('.search-result__header-title').innerText,
      price: element.querySelector('.search-result-price').innerText,
      types: element.querySelector('.search-result__header-subtitle').innerText.split('|').map((str) => str.trim()),
      details: Array.from(element.querySelectorAll('.search-result-kenmerken span')).map((element) => ({
        key: element.getAttribute('title'),
        value: element.innerText.trim()
      })),
      image: (element.querySelector('.search-result-image img') && element.querySelector('.search-result-image img').getAttribute('src')) ||
      (element.querySelector('.promo-thumbnail img') && element.querySelector('.promo-thumbnail img').getAttribute('src'))
    })))

  return results
}

async function run () {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--user-agent="Mozilla/5.0 (Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36"'
  ]

  const options = {
    args,
    headless: true,
    ignoreHTTPSErrors: true
  }

  const browser = await puppeteer.launch(options)

  const postcodeBounds = [1011, 9999]
  const postcodes = Array.from({length: postcodeBounds[1] - postcodeBounds[0] + 1})
    .map((_, index) => index + postcodeBounds[0])

  const postcodesShuffled = shuffleArray(postcodes)

  for (let postcode of postcodesShuffled) {
    let postcodeResults

    if (cache[postcode]) {
      postcodeResults = cache[postcode]
    } else {
      const page = await newPage(browser)
      postcodeResults = await scrapePostcode(page, postcode)
      cache[postcode] = postcodeResults

      await page.close()
    }

    if (postcodeResults && postcodeResults.length) {
      const results = postcodeResults.map((item) => ({
        query: postcode,
        ...item
      }))

      console.log(results.map(JSON.stringify).join('\n'))
    }

    const cachedCount = Object.keys(cache).length
    const totalCount = postcodesShuffled.length

    console.error(`${cachedCount} / ${totalCount} done (${Math.round(cachedCount / totalCount * 100)}%)`)

    writeCacheToFile()
  }

  await browser.close()
  writeCacheToFile()
}

run()
