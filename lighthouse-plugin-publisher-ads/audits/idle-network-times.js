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

const MainThreadTasks = require('lighthouse/lighthouse-core/computed/main-thread-tasks');
const NetworkRecords = require('lighthouse/lighthouse-core/computed/network-records');
// @ts-ignore
const TraceOfTab = require('lighthouse/lighthouse-core/computed/trace-of-tab');
const {auditNotApplicable} = require('../utils/builder');
const {AUDITS, NOT_APPLICABLE} = require('../messages/messages');
const {Audit} = require('lighthouse');
const {formatMessage} = require('../messages/format');
const {getAdCriticalGraph} = require('../utils/graph');
const {getAttributableUrl} = require('../utils/tasks');
const {getPageStartTime} = require('../utils/network-timing');

const id = 'idle-network-times';
const {
  title,
  failureTitle,
  description,
  displayValue,
  headings,
  causes,
} = AUDITS[id];

/** @enum {string} */
const Cause = {
  DOM_CONTENT_LOADED: causes.domContentLoaded,
  LOAD_EVENT: causes.loadEvent,
  LONG_TASK: causes.longTask,
  RENDER_BLOCKING_RESOURCE: causes.renderBlockingResource,
  TIMEOUT: causes.timeout,
  OTHER: causes.other,
};

/**
 * @typedef {Object} IdlePeriod
 * @property {number} startTime
 * @property {number} endTime
 * @property {number} duration
 * @property {string} url The attributable url
 * @property {string} cause
 */

/**
 * Table headings for audits details sections.
 * @type {LH.Audit.Details.Table['headings']}
 */
const HEADINGS = [
  {
    key: 'cause',
    itemType: 'text',
    text: headings.cause,
  },
  {
    key: 'url',
    itemType: 'url',
    text: headings.url,
  },
  {
    key: 'startTime',
    itemType: 'ms',
    text: headings.startTime,
    granularity: 1,
  },
  {
    key: 'endTime',
    itemType: 'ms',
    text: headings.endTime,
    granularity: 1,
  },
  {
    key: 'duration',
    itemType: 'ms',
    text: headings.duration,
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

/**
 * Returns the intersection of a and b.
 * @param {{startTime: number, endTime: number}} a
 * @param {{startTime: number, endTime: number}} b
 * @return {number}
 */
function getOverlapTime(a, b) {
  return Math.min(a.endTime, b.endTime) - Math.max(a.startTime, b.startTime);
}

const OVERLAP_THRESHOLD = 0.80;
const PROXIMITY_MS_THRESHOLD = 50;

/**
 * Checks if any task causes the idle period and attributes it if so.
 * @param {IdlePeriod} idlePeriod
 * @param {LH.Artifacts.TaskNode[]} mainThreadTasks
 * @param {LH.TraceEvent[]} timerEvents
 * @return {boolean} True if the task caused the idle period, false otherwise.
 */
function checkIfTaskIsBlocking(idlePeriod, mainThreadTasks, timerEvents) {
  // Check if long task is blocking.
  for (const task of mainThreadTasks) {
    const overlapTime = getOverlapTime(task, idlePeriod);
    if (task.duration > 100 &&
        overlapTime / idlePeriod.duration > OVERLAP_THRESHOLD) {
      idlePeriod.cause = Cause.LONG_TASK;
      idlePeriod.url = getAttributableUrl(task);
      return true;
    }
    // Check if timer is blocking.
    if (task.event.name == 'TimerFire' &&
        idlePeriod.endTime - task.startTime < PROXIMITY_MS_THRESHOLD) {
      const timerId = task.event.args.data.timerId;
      const start = timerEvents.find((t) =>
        // @ts-ignore
        t.name == 'TimerInstall' && t.args.data.timerId == timerId);
      // @ts-ignore
      const timeout = start.args.data.timeout;
      if (timeout / idlePeriod.duration > OVERLAP_THRESHOLD) {
        idlePeriod.cause = Cause.TIMEOUT + ` (${timeout} ms)`;
        // @ts-ignore
        idlePeriod.url = start.args.data.stackTrace[0].url;
        return true;
      }
    }
    if (task.startTime > idlePeriod.endTime) {
      // Done searching tasks.
      break;
    }
  }
  return false;
}

/**
 * Checks if any tag is blocking and therefore causing the idle period in ad
 * loading.
 * @param {IdlePeriod} idlePeriod
 * @param {LH.Artifacts.TagBlockingFirstPaint[]} blockingTags
 * @param {number} pageStartTime
 * @return {boolean} True if the tag caused the idle period, false otherwise.
 */
function checkIfTagIsBlocking(idlePeriod, blockingTags, pageStartTime) {
  for (const tag of blockingTags) {
    const shifted = {
      startTime: (tag.startTime - pageStartTime) * 1000,
      endTime: (tag.endTime - pageStartTime) * 1000,
    };
    const overlap = getOverlapTime(shifted, idlePeriod);
    if (overlap / idlePeriod.duration > OVERLAP_THRESHOLD) {
      idlePeriod.cause = Cause.RENDER_BLOCKING_RESOURCE;
      // Yes, tag.tag is correct.
      idlePeriod.url = tag.tag.url;
      return true;
    }
  }
  return false;
}
/**
 * Checks waiting on load events is the cause of the idle period.
 * @param {IdlePeriod} idlePeriod
 * @param {LH.Artifacts.TraceTimes} timings
 * @return {boolean} True if waiting on load is the suspected cause, false
 *     otherwise.
 */
function checkIfLoadIsBlocking(idlePeriod, timings) {
  if (timings.domContentLoaded &&
      idlePeriod.endTime > timings.domContentLoaded &&
      idlePeriod.endTime - timings.domContentLoaded < PROXIMITY_MS_THRESHOLD) {
    // TODO(warrengm): Attribute this to the script that installed the load
    // event listener.
    idlePeriod.cause = Cause.DOM_CONTENT_LOADED;
    return true;
  }
  if (timings.load && idlePeriod.endTime > timings.load &&
      idlePeriod.endTime - timings.load < PROXIMITY_MS_THRESHOLD) {
    // TODO(warrengm): Attribute this to the script that installed the load
    // event listener.
    idlePeriod.cause = Cause.LOAD_EVENT;
    return true;
  }
  return false;
}

/**
 * Checks the cause of the idle period.
 * @param {IdlePeriod} idlePeriod
 * @param {LH.Artifacts.TaskNode[]} mainThreadTasks
 * @param {LH.TraceEvent[]} timerEvents
 * @param {LH.Artifacts.TraceTimes} timings
 * @param {LH.Artifacts.TagBlockingFirstPaint[]} blockingTags
 * @param {number} pageStartTime
 */
function determineCause(
  idlePeriod, mainThreadTasks, timerEvents, timings, blockingTags,
  pageStartTime) {
  checkIfTaskIsBlocking(idlePeriod, mainThreadTasks, timerEvents) ||
      checkIfTagIsBlocking(idlePeriod, blockingTags, pageStartTime) ||
      checkIfLoadIsBlocking(idlePeriod, timings);
}

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
    return {
      id,
      title,
      failureTitle,
      description,
      requiredArtifacts: ['devtoolsLogs', 'traces', 'TagsBlockingFirstPaint'],
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
    /** @type {LH.Artifacts.TaskNode[]} */ let mainThreadTasks = [];
    try {
      mainThreadTasks = await MainThreadTasks.request(trace, context);
    } catch (e) {
      // Ignore tracing errors.
    }
    const {timings} = await TraceOfTab.request(trace, context);

    const timerEvents =
        trace.traceEvents.filter((t) => t.name.startsWith('Timer'));

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

    if (!blockingRequests.length) {
      return auditNotApplicable(NOT_APPLICABLE.NO_AD_RELATED_REQ);
    }

    let maxEndSoFar = Infinity;
    const idleTimes = [];
    for (let i = 0; i < blockingRequests.length;) {
      const {startTime, endTime} = blockingRequests[i];
      if (startTime - maxEndSoFar > MINIMUM_NOTEWORTHY_IDLE_GAP_MS) {
        const idlePeriod = {
          startTime: maxEndSoFar,
          endTime: startTime,
          duration: startTime - maxEndSoFar,
          cause: Cause.OTHER,
          url: '',
        };
        determineCause(
          idlePeriod, mainThreadTasks, timerEvents, timings,
          artifacts.TagsBlockingFirstPaint, pageStartTime);
        idleTimes.push(idlePeriod);
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

    return {
      numericValue: maxIdleTime,
      score: failed ? 0 : 1,
      displayValue:
        formatMessage(displayValue, {idleTime: (totalIdleTime / 1000)}),
      details: IdleNetworkTimes.makeTableDetails(HEADINGS, idleTimes),
    };
  }
}

module.exports = IdleNetworkTimes;
