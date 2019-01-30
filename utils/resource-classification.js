// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const bidderPatterns = require('./bidder-patterns');

/**
 * Checks if the url is from a Google ads host.
 * @param {URL} url
 * @return {boolean}
 */
function isGoogleAds(url) {
  return /(^|\.)(doubleclick.net|google(syndication|tagservices).com)$/
      .test(url.hostname);
}

/**
 * Checks if the url is for pubads implementation tag.
 * @param {URL} url
 * @return {boolean}
 */
function isImplTag(url) {
  return /(^\/gpt\/pubads_impl_\d+.js)/
      .test(url.pathname);
}

/**
 * Checks if the url is loading a gpt.js script.
 * @param {URL} url
 * @return {boolean}
 */
function isGptTag(url) {
  return url.host === 'www.googletagservices.com' &&
      (url.pathname === '/tag/js/gpt.js' ||
      url.pathname === '/tag/js/gpt_mobile.js');
}

/**
 * Checks if the url is loading a gpt.js or pubads_impl_*.js script.
 * @param {URL} url
 * @return {boolean}
 */
function isGpt(url) {
  return isGptTag(url) || isImplTag(url);
}

/**
 * Checks if str contains at least one provided substring.
 * @param {string} str
 * @param {Array<string>} substrings
 * @return {boolean}
 */
function containsAnySubstring(str, substrings) {
  return substrings.some((substring) => str.includes(substring));
}

/**
 * Checks if the url has an ad request path.
 * @param {URL} url
 * @return {boolean}
 */
function hasAdRequestPath(url) {
  return url.pathname === '/gampad/ads';
}

/**
 * Checks if the url has an impression path.
 * @param {URL} url
 * @return {boolean}
 */
function hasImpressionPath(url) {
  return url.pathname === '/pcs/view' ||
      url.pathname === '/pagead/adview';
}

/**
 * Returns header bidder or false if not a bid.
 * @param {string} url
 * @return {string | boolean}
 */
function getHeaderBidder(url) {
  for (const def of bidderPatterns) {
    for (const pattern of def.patterns) {
      if (new RegExp(pattern).test(url)) {
        return def.label;
      }
    }
  }
  return false;
}

module.exports = {
  isGoogleAds,
  hasAdRequestPath,
  hasImpressionPath,
  isGpt,
  isGptTag,
  isImplTag,
  containsAnySubstring,
  getHeaderBidder,
};
