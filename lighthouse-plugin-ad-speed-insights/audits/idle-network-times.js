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

const NetworkRecords = require('lighthouse/lighthouse-core/computed/network-records');
const {auditNotApplicable} = require('../utils/builder');
const {AUDITS, NOT_APPLICABLE} = require('../messages/messages.js');
const {Audit} = require('lighthouse');
const {format} = require('util');
const {getAdCriticalGraph} = require('../utils/graph');
const {getPageStartTime} = require('../utils/network-timing');

/**
 * Table headings for audits details sections.
 * @type {LH.Audit.Details.Table['headings']}
 */
const HEADINGS = [
  {
    key: 'startTime',
    itemType: 'ms',
    text: 'Start Time',
    granularity: 1,
  },
  {
    key: 'endTime',
    itemType: 'ms',
    text: 'End Time',
    granularity: 1,
  },
  {
    key: 'duration',
    itemType: 'ms',
    text: 'Duration',
    granularity: 1,
  },
];

// TODO(warrengm) tune parameters below.

/**
 * Any contiguous idle times that exceed the following threshold will be
 * included in the report.
 */
const MINIMUM_NOTEWORTHY_IDLE_GAP_MS = 150;

/**
 * This audit will fail if there is a contiguous idle time that exceeds this
 * threshold.
 */
const FAILING_IDLE_GAP_MS = 400;

/** This audit will fail if the total idle time exceeds this threshold. */
const FAILING_TOTAL_IDLE_TIME_MS = 1500;

const id = 'idle-network-times';
const {
  title,
  failureTitle,
  description,
  displayValue,
} = AUDITS[id];

/**
 * Audit to check the length of the critical path to load ads.
 * Also determines the critical path for visualization purposes.
 */
class IdleNetworkTimes extends Audit {
  /**
   * @return {LH.Audit.Meta}
   * @override
   */
  static get meta() {
    // @ts-ignore - TODO: add AsyncCallStacks to enum.
    return {
      id,
      title,
      failureTitle,
      description,
      requiredArtifacts: ['devtoolsLogs', 'traces', 'AsyncCallStacks'],
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
    const networkRecords = await NetworkRecords.request(devtoolsLog, context);

    const criticalRequests =
      getAdCriticalGraph(networkRecords, trace.traceEvents);

    const pageStartTime = getPageStartTime(networkRecords);
    const blockingRequests = Array.from(criticalRequests)
        .filter((r) => ['Script', 'XHR', 'Fetch', 'EventStream', 'Document'].includes(r.resourceType))
        .filter((r) => r.mimeType != 'text/css')
        .filter((r) => r.startTime > 0)
        .map((r) => ({
          startTime: (r.startTime - pageStartTime) * 1e3,
          endTime: (r.endTime - pageStartTime) * 1e3,
        }))
        .sort((a, b) => a.startTime - b.startTime);

    if (!blockingRequests) {
      return auditNotApplicable(NOT_APPLICABLE.NO_AD_RELATED_REQ);
    }

    let maxEndSoFar = Infinity;
    const idleTimes = [];
    for (let i = 0; i < blockingRequests.length;) {
      const {startTime, endTime} = blockingRequests[i];
      if (startTime - maxEndSoFar > MINIMUM_NOTEWORTHY_IDLE_GAP_MS) {
        idleTimes.push({
          startTime: maxEndSoFar,
          endTime: startTime,
          duration: startTime - maxEndSoFar,
        });
      }

      maxEndSoFar = endTime;
      while (++i < blockingRequests.length &&
          blockingRequests[i].startTime < maxEndSoFar) {
        maxEndSoFar = Math.max(maxEndSoFar, blockingRequests[i].endTime);
      }
    }

    const durations = idleTimes.map((it) => it.duration);
    const totalIdleTime = durations.reduce((sum, dur) => sum + dur, 0);
    const maxIdleTime = Math.max(...durations);
    const failed = maxIdleTime > FAILING_IDLE_GAP_MS ||
      totalIdleTime > FAILING_TOTAL_IDLE_TIME_MS;

    const displayTime = Math.round(totalIdleTime).toLocaleString();

    // TODO(warrengm): Identify culprits in idle times.
    return {
      rawValue: maxIdleTime,
      score: failed ? 0 : 1,
      displayValue: format(displayValue, displayTime),
      details: IdleNetworkTimes.makeTableDetails(HEADINGS, idleTimes),
    };
  }
}

module.exports = IdleNetworkTimes;
