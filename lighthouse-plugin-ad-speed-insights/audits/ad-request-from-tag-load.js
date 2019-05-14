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

const NetworkRecords = require('lighthouse/lighthouse-core/computed/network-records');
const util = require('util');
const {auditNotApplicable} = require('../utils/builder');
const {AUDITS, NOT_APPLICABLE} = require('../messages/messages.js');
const {Audit} = require('lighthouse');
const {getAdStartTime, getTagEndTime} = require('../utils/network-timing');

const id = 'ad-request-from-tag-load';
const {
  title,
  failureTitle,
  description,
  displayValue,
} = AUDITS[id];

// Point of diminishing returns.
const PODR = 0.3; // seconds
const MEDIAN = 0.6; // seconds

/**
 * Audit to determine time for first ad request relative to tag load.
 */
class AdRequestFromTagLoad extends Audit {
  /**
   * @return {LH.Audit.Meta}
   * @override
   */
  static get meta() {
    return {
      id,
      title,
      failureTitle,
      description,
      // @ts-ignore
      scoreDisplayMode: Audit.SCORING_MODES.NUMERIC,
      requiredArtifacts: ['devtoolsLogs'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts, context) {
    const devtoolsLogs = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];
    const networkRecords = await NetworkRecords.request(devtoolsLogs, context);
    const adStartTime = getAdStartTime(networkRecords);
    const tagEndTime = getTagEndTime(networkRecords);

    if (tagEndTime < 0) {
      return auditNotApplicable(NOT_APPLICABLE.NO_TAG);
    }
    if (adStartTime < 0) {
      return auditNotApplicable(NOT_APPLICABLE.NO_ADS);
    }

    const adReqTime = (adStartTime - tagEndTime);

    let normalScore = Audit.computeLogNormalScore(adReqTime, PODR, MEDIAN);

    // Results that have green text should be under passing category.
    if (normalScore >= .9) {
      normalScore = 1;
    }

    return {
      rawValue: adReqTime,
      score: normalScore,
      displayValue: util.format(displayValue, adReqTime.toFixed(2)),
    };
  }
}

module.exports = AdRequestFromTagLoad;
