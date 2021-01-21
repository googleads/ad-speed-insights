// Copyright 2019 Google LLC
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

const AdRenderBlockingResources = require('./ad-render-blocking-resources');
const i18n = require('lighthouse/lighthouse-core/lib/i18n/i18n');
const {Audit} = require('lighthouse');

const UIStrings = {
  title: 'Document uses modern HTTP protocols',
  failureTitle: 'Avoid using HTTP/1.1',
  description: 'Use h2 to download resources faster by reducing the number ' +
  'of connections. [Learn more](https://developers.google.com/web/fundamentals/performance/http2)',
  failureDisplayValue: 'Use h2 on {documentUrl} to speed up ad loading by up ' +
  'to {timeInMs, number, seconds} s',
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

/** Audits for render blocking resources */
class UsesH2 extends Audit {
  /**
   * @return {LH.Audit.Meta}
   * @override
   */
  static get meta() {
    return {
      id: 'uses-h2',
      title: str_(UIStrings.title),
      failureTitle: str_(UIStrings.failureTitle),
      scoreDisplayMode: 'binary',
      description: str_(UIStrings.description),
      requiredArtifacts:
          ['LinkElements', 'ScriptElements', 'devtoolsLogs', 'traces', 'URL'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts, context) {
    let syncResources;
    try {
      syncResources =
          await AdRenderBlockingResources.computeResults(artifacts, context);
    } catch (e) {
      return e;
    }

    // TODO(warrengm): Check first party subdomains.
    const firstPartySyncResources = syncResources.map((r) => r. record)
        .filter((r) => {
          const initiator = r.initiatorRequest;
          if (!initiator) return false;
          r.parsedURL.securityOrigin === initiator.parsedURL.securityOrigin;
        });

    firstPartySyncResources.sort((a, b) =>
      a.timing.requestTime - b.timing.requestTime);

    let lastEndMs = -Infinity;
    let opportunityMs = 0;
    for (const r of firstPartySyncResources) {
      // Otherwise could be h2, quic, etc.
      const usesHttp1 = (r.protocol.toLowerCase() === 'http/1.1');
      if (!usesHttp1) break;

      const startMs = r.timing.requestTime;
      const endMs = startMs + r.timing.sendStart;
      const extraBlockedTime = endMs - Math.max(lastEndMs, startMs);

      opportunityMs += Math.max(extraBlockedTime, 0);
      lastEndMs = Math.max(lastEndMs, endMs);
    }

    let displayValue = '';
    const failed = opportunityMs > 0;
    if (failed) {
      const documentUrl = new URL(artifacts.URL.finalUrl).host;
      displayValue = str_(
        UIStrings.failureDisplayValue,
        {documentUrl, timeInMs: opportunityMs});
    }
    return {
      score: failed ? 0 : 1,
      numericValue: firstPartySyncResources.length,
      displayValue,
    };
  }
}

module.exports = UsesH2;
module.exports.UIStrings = UIStrings;
