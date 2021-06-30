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

const i18n = require('lighthouse/lighthouse-core/lib/i18n/i18n');
const {group} = require('./messages/common-strings');

const PLUGIN_PATH = 'lighthouse-plugin-publisher-ads';

const UIStrings = {
  categoryDescription: 'A Lighthouse plugin to improve ad speed and overall quality that is targeted at sites using GPT or AdSense tag. ' +
      '[Learn more](https://developers.google.com/publisher-ads-audits/reference)',
};
const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

/** @type {LH.Config.Plugin} */
module.exports = {
  audits: [
    {path: `${PLUGIN_PATH}/audits/ad-blocking-tasks`},
    {path: `${PLUGIN_PATH}/audits/ad-render-blocking-resources`},
    {path: `${PLUGIN_PATH}/audits/ad-request-critical-path`},
    {path: `${PLUGIN_PATH}/audits/bid-request-from-page-start`},
    {path: `${PLUGIN_PATH}/audits/ad-request-from-page-start`},
    {path: `${PLUGIN_PATH}/audits/ad-top-of-viewport`},
    {path: `${PLUGIN_PATH}/audits/ads-in-viewport`},
    {path: `${PLUGIN_PATH}/audits/async-ad-tags`},
    {path: `${PLUGIN_PATH}/audits/blocking-load-events`},
    {path: `${PLUGIN_PATH}/audits/bottleneck-requests`},
    {path: `${PLUGIN_PATH}/audits/duplicate-tags`},
    {path: `${PLUGIN_PATH}/audits/first-ad-render`},
    {path: `${PLUGIN_PATH}/audits/full-width-slots`},
    {path: `${PLUGIN_PATH}/audits/gpt-bids-parallel`},
    {path: `${PLUGIN_PATH}/audits/loads-gpt-from-official-source`},
    {path: `${PLUGIN_PATH}/audits/loads-ad-tag-over-https`},
    {path: `${PLUGIN_PATH}/audits/script-injected-tags`},
    {path: `${PLUGIN_PATH}/audits/serial-header-bidding`},
    {path: `${PLUGIN_PATH}/audits/tag-load-time`},
    {path: `${PLUGIN_PATH}/audits/viewport-ad-density`},
    {path: `${PLUGIN_PATH}/audits/cumulative-ad-shift`},
    {path: `${PLUGIN_PATH}/audits/deprecated-api-usage`},
    {path: `${PLUGIN_PATH}/audits/gpt-errors-overall`},
    {path: `${PLUGIN_PATH}/audits/total-ad-blocking-time`},
    {path: `${PLUGIN_PATH}/audits/ad-lcp`},
  ],
  groups: {
    'metrics': {
      title: group.Metrics,
    },
    'ads-performance': {
      title: group.AdsPerformance,
    },
    'ads-best-practices': {
      title: group.AdsBestPractices,
    },
  },
  category: {
    title: 'Publisher Ads',
    description: str_(UIStrings.categoryDescription),
    auditRefs: [
      // Measurements group.
      {id: 'tag-load-time', weight: 5, group: 'metrics'},
      {id: 'bid-request-from-page-start', weight: 5, group: 'metrics'},
      {id: 'ad-request-from-page-start', weight: 25, group: 'metrics'},
      {id: 'first-ad-render', weight: 10, group: 'metrics'},
      {id: 'cumulative-ad-shift', weight: 5, group: 'metrics'},
      {id: 'total-ad-blocking-time', weight: 2, group: 'metrics'},
      // Performance group.
      {id: 'gpt-bids-parallel', weight: 1, group: 'ads-performance'},
      {id: 'serial-header-bidding', weight: 1, group: 'ads-performance'},
      {id: 'bottleneck-requests', weight: 1, group: 'ads-performance'},
      {id: 'script-injected-tags', weight: 1, group: 'ads-performance'},
      {id: 'blocking-load-events', weight: 1, group: 'ads-performance'},
      {id: 'ad-render-blocking-resources', weight: 1, group: 'ads-performance'},
      {id: 'ad-blocking-tasks', weight: 1, group: 'ads-performance'},
      {id: 'ad-request-critical-path', weight: 0, group: 'ads-performance'},
      {id: 'ad-lcp', weight: 0, group: 'ads-performance'},
      // Best Practices group.
      {id: 'ads-in-viewport', weight: 4, group: 'ads-best-practices'},
      {id: 'async-ad-tags', weight: 2, group: 'ads-best-practices'},
      {id: 'loads-ad-tag-over-https', weight: 1, group: 'ads-best-practices'},
      {id: 'loads-gpt-from-official-source', weight: 4, group: 'ads-best-practices'},
      {id: 'viewport-ad-density', weight: 2, group: 'ads-best-practices'},
      {id: 'ad-top-of-viewport', weight: 2, group: 'ads-best-practices'},
      {id: 'duplicate-tags', weight: 1, group: 'ads-best-practices'},
      {id: 'deprecated-gpt-api-usage', weight: 0, group: 'ads-best-practices'},
      {id: 'gpt-errors-overall', weight: 0, group: 'ads-best-practices'},
    ],
  },
};

// @ts-ignore Use `defineProperty` so that the strings can be referenced but not
// iterated over (i.e. set enumerable=false). Otherwise the config would be
// invalid for having additional keys.
Object.defineProperty(module.exports, 'UIStrings', {
  enumerable: false,
  get: () => UIStrings,
});
