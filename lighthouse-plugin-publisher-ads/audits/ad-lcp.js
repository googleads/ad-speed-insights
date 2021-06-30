// Copyright 2021 Google LLC
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const i18n = require('lighthouse/lighthouse-core/lib/i18n/i18n');
const NetworkRecords = require('lighthouse/lighthouse-core/computed/network-records');
// @ts-ignore
const TraceOfTab = require('lighthouse/lighthouse-core/computed/trace-of-tab');
const {auditNotApplicable} = require('../messages/common-strings');
const {Audit} = require('lighthouse');
const {isAdRelated} = require('../utils/resource-classification');

const UIStrings = {
  /* Title of the audit */
  title: 'Ad largest contentful paint',
  description: 'Audits the size of contentful paints inside of ad iframes ' +
      'and compares it to contentful paints on the main page.',
  displayValueNoImpact: 'Ads did not impact LCP',
  displayValueMayImprove: 'Ads may improve LCP (All-Frames)',
  displayValueMayImpact: 'Ads may impact LCP (All-Frames)',
  columnSize: 'Size',
  columnTime: 'Time',
  nameAdLcp: 'Ad LCP',
  nameMainFrameLcp: 'Main Frame LCP',
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);
/**
 * @typedef {Object} TableRow
 * @property {number} blockingTime
 * @property {string} name
 */

/**
 * Table headings for audits details sections.
 * @type {LH.Audit.Details.Table['headings']}
 */
const HEADINGS = [
  {
    key: 'name',
    itemType: 'text',
    text: '',
  },
  {
    key: 'size',
    itemType: 'numeric',
    text: str_(UIStrings.columnSize),
    granularity: 1,
  },
];

/** @inheritDoc */
class AdLcp extends Audit {
  /**
   * @return {LH.Audit.Meta}
   * @override
   */
  static get meta() {
    return {
      id: 'ad-lcp',
      title: str_(UIStrings.title),
      description: str_(UIStrings.description),
      scoreDisplayMode: 'informative',
      requiredArtifacts: ['traces', 'devtoolsLogs', 'URL'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>}
   * @override
   */
  static async audit(artifacts, context) {
    const trace = artifacts.traces[Audit.DEFAULT_PASS];
    const devtoolsLog = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];
    const networkRecords = await NetworkRecords.request(devtoolsLog, context);

    const {
      mainFrameIds,
      timeOriginEvt,
      largestContentfulPaintAllFramesEvt: lcpAfEvt,
      largestContentfulPaintEvt: lcpMfEvt, // Mf is main frame
    } = await TraceOfTab.request(trace, context);

    /** @type Set<string> */ const adFrameIds = new Set(networkRecords
        .filter((r) => isAdRelated(r.url) && r.frameId !== mainFrameIds.frameId)
        .map((r) => r.frameId || 'unknown'));

    if (!adFrameIds.size) {
      return auditNotApplicable.NoAdRelatedReq;
    }

    let lcpAdEvt;
    for (const evt of trace.traceEvents) {
      if (!evt.args || !evt.args.data) continue;
      if (evt.name === 'largestContentfulPaint::Candidate' &&
          !evt.args.data.is_main_frame &&
          adFrameIds.has(evt.args.frame || '--')) {
        if (!lcpAdEvt || evt.ts > lcpAdEvt.ts) {
          lcpAdEvt = evt;
        }
      }
    }

    if (!lcpAfEvt || !lcpAfEvt.args || !lcpAfEvt.args.data ||
        !lcpMfEvt || !lcpMfEvt.args || !lcpMfEvt.args.data ||
        !lcpAdEvt || !lcpAdEvt.args || !lcpAdEvt.args.data) {
      return auditNotApplicable.Default;
    }

    /** @type {string} */ let displayValue;
    if (lcpAfEvt.args.data.isMainFrame ||
        Number(lcpAdEvt.args.data.size) < lcpMfEvt.args.data.size) {
      // The ad is smaller than the main frame LCP, no impact.
      displayValue = UIStrings.displayValueNoImpact;
    } else if (lcpAdEvt.ts >= lcpMfEvt.ts) {
      // Ad LCP happened later, may impact all frames LCP
      displayValue = UIStrings.displayValueMayImpact;
    } else if (lcpAdEvt.ts < lcpMfEvt.ts) {
      // Ad LCP happened before, may improve all frames LCP. Unlikely to
      // happen on real pages.
      displayValue = UIStrings.displayValueMayImprove;
    } else {
      return auditNotApplicable.Default;
    }

    const tableView = [
      {
        name: UIStrings.nameAdLcp,
        size: lcpAdEvt.args.data.size,
        time: (lcpAdEvt.ts - timeOriginEvt.ts) / 1000,
      },
      {
        name: UIStrings.nameMainFrameLcp,
        size: lcpMfEvt.args.data.size,
        time: (lcpMfEvt.ts - timeOriginEvt.ts) / 1000,
      },
    ];

    return {
      // Score is not important since audit is only informative.
      score: lcpAfEvt.args.data.isMainFrame,
      displayValue,
      // TODO: add a table for the LCP time and size for ads vs. main frame
      details: {
        ...AdLcp.makeTableDetails(HEADINGS, tableView),
        lcpAdEvt,
        lcpAfEvt,
        lcpMfEvt,
      },
    };
  }
}

module.exports = AdLcp;
module.exports.UIStrings = UIStrings;
