
/**
 * A simple cache warming utility that fetches URLs from a sitemap index,
 * warms them up using Puppeteer, and logs any errors encountered.
*/

import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import puppeteer from 'puppeteer-core';
import { performance } from 'perf_hooks';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const parser = new XMLParser(); // XML parser instance

/**
 * Runs the cache warm-up process.
 * @param {number} concurrency - The number of concurrent requests.
 * @param {boolean} deepWarm - Whether to perform a deep warm-up (loading all resources).
 * @param {Function} onProgress - A callback function to handle progress updates.
 * @returns {Promise<Object>} An object containing the total URLs, success count, total work time, and any errors encountered.
*/
export async function runCacheWarm(concurrency = 5, deepWarm = true, onProgress) {
  const {urls, errors: sitemapErrors} = await collectAllUrls(process.env.SITE_MAP_URL);
  const {successCount, totalWorkTime, errors: warmErrors} =  await warmUrls(urls, concurrency, deepWarm, onProgress);
  return {
     totalUrls: urls.length, 
     successCount, 
     totalWorkTime, 
     errors: [...sitemapErrors, ...warmErrors]
  }
};

/**
 * Collects all URLs from the sitemap index. 
 * @param {string} indexUrl - The URL of the sitemap index.
 * @returns {Promise<Object>} An object containing an array of URLs and any errors encountered.
*/
async function collectAllUrls(indexUrl) {
  const indexXml = await getXml(indexUrl);
  const sitemapUrls = parseSitemapIndex(indexXml);
  let errors = [];
  let allUrls = [];
  for (const sitemapUrl of sitemapUrls) {
    try {
      const sitemapXml = await getXml(sitemapUrl);
      const urls = parseUrlSet(sitemapXml);
      allUrls.push(...urls);
    } catch (e) {
      errors.push(`❌ Load error ${sitemapUrl}: ${e.message}`);
    }
  }

  return {
    urls: allUrls,
    errors
  };
}

/** 
 * Warming up URLs with Puppeteer.
 * @param {Array} urls - The URLs to warm up.
 * @param {number} concurrency - The number of concurrent requests.
 * @param {boolean} deepWarm - Whether to perform a deep warm-up (loading all resources).
 * @param {Function} onProgress - A callback function to handle progress updates.
 * @returns {Promise<Object>} An object containing the success count, total work time, and any errors encountered.
*/
async function warmUrls(urls, concurrency, deepWarm, onProgress) {
  // console.log(`Starting warm-up for ${urls.length} URLs with concurrency ${concurrency} and deepWarm=${deepWarm}`);
  const start = getCurrentTime();
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  } catch (e) {
    throw new Error(`❌ Critical error: failed to launch the browser: ${e.message}`);
  }

  const chunks = chunkArray(urls, concurrency);
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
  var successCount = 0;
  let errors = [];
  let processed = 0;
  let total = urls.length;
  
  for (const batch of chunks) {
    // console.log(successCount);
  
    // Uncomment the following lines to stop after warming up 1 (concurrency)  URLs
    // if(successCount>=1){
    //   break;
    // }
    await Promise.all(batch.map(async (url) => {
      const page = await browser.newPage();
      try {
        await page.setUserAgent(userAgent);
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
        });
        // console.log(`Visiting: ${url}`);

        if (deepWarm) {
          await page.setRequestInterception(false);
        } else {
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
              req.abort();
            } else {
              req.continue();
            }
          });
        }
          
        const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        if (!response) {
          errors.push(`⚠️ No response from the server at ${url}`);
          return;
        }

        let headers = {};
        let status = 0;
        try {
          headers = response.headers();
          status = response.status();
        } catch (e) {
          errors.push(`⚠️ Error when extracting headers on ${url}: ${e.message}`);
          return;
        }

        try {
          await page.waitForSelector('body', { timeout: 5000 });
        } catch (e) {
          errors.push(`⚠️ Page ${url} failed to load <body> in 5 secs`);
          return;
        }

        const html = await page.content();
        const isHtmlClosed = /\<\/html\>\s*$/i.test(html);
        if (!isHtmlClosed) {;
          errors.push(`⚠️ The ${url} page is not fully loaded (no </html>)`);
          return;
        }
          
        // console.log(`Response Status: ${status}`);
        // console.log('✅ Cache headers:', {
        //   url,
        //   'x-cache': headers['x-cache'],
        //   'cf-cache-status': headers['cf-cache-status'],
        //   'x-cacheable': headers['x-cacheable'],
        //   'cache-control': headers['cache-control']
        // });

        if (status === 200 && isHtmlClosed) {
          successCount++;

          processed++;
          if (onProgress && processed % concurrency === 0 || processed === total) {
            // console.log(`вызов onProgress: ${processed}/${total}`);
            await onProgress(processed, total); // ✅ вызываем прогресс
          }
          
          // console.log(`✅ Successfully warmed up: ${successCount}`);
        }
      } catch (e) {
        errors.push(`❌ Error on ${url}: ${e.message}`);
      } finally {
        if (!page.isClosed()) {
          await page.close(); 
        }
      }
    }));
    await sleep(500); // пауза между чанками
  }

  try {
    await browser.close();
  } catch (e) {
    throw new Error(`❌ Critical error: failed to close the browser: ${e.message}`);
  }

  const end = getCurrentTime();
  const totalWorkTime = ((end - start) / 1000 / 60).toFixed(2);

  return {
    successCount,
    totalWorkTime,
    errors
  };
}

/** Fetches and parses XML from a given URL.
 * @param {string} url - The URL to fetch the XML from.
 * @returns {Promise<Object>} The parsed XML object.
*/
async function getXml(url) {
  const res = await axios.get(url);
  return parser.parse(res.data);
}

/** Parses the sitemap index XML to extract URLs.
 * @param {Object} xml - The parsed XML object.
 * @returns {Array} An array of sitemap URLs.
*/
function parseSitemapIndex(xml) {
  return xml.sitemapindex?.sitemap?.map(s => s.loc) || [];
}

/** * Parses the URL set from a sitemap XML.
 * @param {Object} xml - The parsed XML object.
 * @returns {Array} An array of URLs.
*/
function parseUrlSet(xml) {
  const urlset = xml.urlset?.url;
  if (!urlset) return [];
  const urls = Array.isArray(urlset) ? urlset : [urlset];
  return urls.map(item => item.loc);
}

/** * Returns the current time in milliseconds.
 * @returns {number} The current time in milliseconds.
*/
function getCurrentTime(){
  return performance.now();
}

/** * Splits an array into chunks of a specified size.
 * @param {Array} arr - The array to split.
 * @param {number} size - The size of each chunk.
 * @returns {Array} An array of chunks.
*/
function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Pauses execution for a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to pause.
 * @returns {Promise<void>} A promise that resolves after the specified time.
*/
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}