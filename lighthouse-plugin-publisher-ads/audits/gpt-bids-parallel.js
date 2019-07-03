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
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or pubadsImplied.
// See the License for the specific language governing permissions and
// limitations under the License.

const NetworkRecords = require('lighthouse/lighthouse-core/computed/network-records');
const {auditNotApplicable} = require('../utils/builder');
const {NOT_APPLICABLE} = require('../messages/messages');
const {Audit} = require('lighthouse');
const {getCriticalGraph} = require('../utils/graph');
const {getTimingsByRecord} = require('../utils/network-timing');
const {isGptTag, isImplTag, isBidRequest, getHeaderBidder} = require('../utils/resource-classification');
const {URL} = require('url');

/** @typedef {LH.Artifacts.NetworkRequest} NetworkRequest */
/** @typedef {LH.Gatherer.Simulation.NodeTiming} NodeTiming */

const id = 'gpt-bids-parallel';
const UIStrings = {
  title: 'GPT and bids loaded in parallel',
  failureTitle: 'Load GPT and bids in parallel',
  description: 'To optimize ad loading, bid requests should not wait on GPT to load. This issue can often be fixed by making sure that bid requests do not wait on <pre>googletag.pubadsReady</pre> or <pre>googletag.cmd.push</pre>.',
  headings: {
    bidder: 'Bidder',
    url: 'URL',
    startTime: 'Start time',
    duration: 'Duration',
  },
};

/**
 * Table headings for audits details sections.
 * @type {LH.Audit.Details.Table['headings']}
 */
const HEADINGS = [
  {key: 'bidder', itemType: 'text', text: UIStrings.headings.bidder},
  {key: 'url', itemType: 'url', text: UIStrings.headings.url},
  {key: 'startTime', itemType: 'ms', text: UIStrings.headings.startTime},
  {key: 'duration', itemType: 'ms', text: UIStrings.headings.duration},
];

/**
 * Audit to check if serial header bidding occurs
 */
class GptBidsInParallel extends Audit {
  /**
   * @return {LH.Audit.Meta}
   * @override
   */
  static get meta() {
    return {
      id,
      title: UIStrings.title,
      failureTitle: UIStrings.failureTitle,
      description: UIStrings.description,
      requiredArtifacts: ['devtoolsLogs', 'traces'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts, context) {
    const devtoolsLog = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];
    const  trace = artifacts.traces[Audit.DEFAULT_PASS];
    const network = await NetworkRecords.request(devtoolsLog, context);

    const bids = network.filter(isBidRequest);
    if (!bids.length) {
      return auditNotApplicable(NOT_APPLICABLE.NO_BIDS);
    }
    const pubadsImpl = network.find((r) => isImplTag(r.url));
    if (!pubadsImpl) {
      return auditNotApplicable(NOT_APPLICABLE.NO_TAG);
    }

    /** @type {Map<NetworkRequest, NodeTiming>} */
    const timingsByRecord = await getTimingsByRecord(
      trace, devtoolsLog, context);
    const tableView = [];
    for (const bid of bids) {
      if (getCriticalGraph(network, trace.traceEvents, bid).has(pubadsImpl)) {
        const {startTime, endTime} = timingsByRecord.get(bid) || bid;
        tableView.push({
          bidder: getHeaderBidder(bid.url),
          url: bid.url,
          startTime,
          duration: endTime - startTime,
        });
      }
    }
    const failed = tableView.length > 0;
    return {
      numericValue: failed ? 0 : 1,
      score: failed ? 0 : 1,
      details: failed ?
        GptBidsInParallel.makeTableDetails(HEADINGS, tableView) : undefined,
    };
  }
}

module.exports = GptBidsInParallel;