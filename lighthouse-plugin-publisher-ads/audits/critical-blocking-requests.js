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

const i18n = require('lighthouse/lighthouse-core/lib/i18n/i18n');
const {auditNotApplicable} = require('../messages/common-strings');
const {Audit} = require('lighthouse');
const {computeAdRequestWaterfall} = require('../utils/graph');
const {isGptAdRequest} = require('../utils/resource-classification');

/** @typedef {LH.Artifacts.NetworkRequest} NetworkRequest */
/** @typedef {LH.Gatherer.Simulation.NodeTiming} NodeTiming */

const UIStrings = {
  title: 'No blocking requests found',
  failureTitle: 'Avoid blocking requests',
  description: 'Speed up, parallelize, or eliminate the following ' +
    'requests and their dependencies in order to speed up ad loading.',
  displayValue: '{blockedTime, number, seconds} s spent blocked on requests',
  columnUrl: 'Blocking Request',
  columnInitiatorUrl: 'Initiator Request',
  columnStartTime: 'Start',
  columnSelfTime: 'Self Time',
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);


/**
 * Table headings for audits details sections.
 * @type {LH.Audit.Details.Table['headings']}
 */
const HEADINGS = [
  {
    key: 'url',
    itemType: 'url',
    text: str_(UIStrings.columnUrl),
  },
  {
    key: 'startTime',
    itemType: 'ms',
    text: str_(UIStrings.columnStartTime),
    granularity: 1,
  },
  {
    key: 'selfTime',
    itemType: 'ms',
    text: str_(UIStrings.columnSelfTime),
    granularity: 1,
  },
];


/**
 * Audit to check the length of the critical path to load ads.
 * Also determines the critical path for visualization purposes.
 */
class CriticalBlockingRequests extends Audit {
  /**
   * @return {LH.Audit.Meta}
   * @override
   */
  static get meta() {
    return {
      id: 'critical-blocking-requests',
      title: str_(UIStrings.title),
      failureTitle: str_(UIStrings.failureTitle),
      description: str_(UIStrings.description),
      requiredArtifacts: ['devtoolsLogs', 'traces'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts, context) {
    const trace = artifacts.traces[Audit.DEFAULT_PASS];
    const devtoolsLog = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];

    const waterfall =
      (await computeAdRequestWaterfall(trace, devtoolsLog, context))
          .filter((r) => r.startTime > 0 && !isGptAdRequest(r.record));
    if (!waterfall.length) {
      return auditNotApplicable.NoAdRelatedReq;
    }
    const CRITICAL_SELF_TIME_MS = 150;
    const criticalRequests = waterfall
        .filter((a) => a.selfTime > CRITICAL_SELF_TIME_MS)
        .sort((a, b) => b.selfTime - a.selfTime)
        // Only show the top critical requests for the sake of brevity.
        .slice(0, 5);
    const blockedTime =
      // @ts-ignore param types not inferred.
      criticalRequests.reduce((sum, r) => sum + r.selfTime, 0) / 1000;
    const failed = criticalRequests.length > 3 || blockedTime > 0.5;
    return {
      numericValue: criticalRequests.length,
      score: failed ? 0 : 1,
      displayValue: failed ? str_(UIStrings.displayValue, {blockedTime}) : '',
      details:
        CriticalBlockingRequests.makeTableDetails(HEADINGS, criticalRequests),
    };
  }
}

module.exports = CriticalBlockingRequests;
module.exports.UIStrings = UIStrings;
