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

// @ts-ignore
// eslint-disable-next-line
const BaseNode = require('lighthouse/lighthouse-core/lib/dependency-graph/base-node');

/** @typedef {LH.TraceEvent} TraceEvent */
/** @typedef {LH.Artifacts.NetworkRequest} NetworkRequest */

/**
 * Returns all requests and CPU tasks in the loading graph of the target
 * requests.
 * @param {typeof BaseNode} root The root node of the DAG.
 * @param {(req: NetworkRequest) => boolean} isTargetRequest
 * @return {{requests: NetworkRequest[], traceEvents: TraceEvent[]}}
 */
function getTransitiveClosure(root, isTargetRequest) {
  const closure = new Set();
  /** @type {LH.Artifacts.NetworkRequest} */
  let firstTarget = null;
  root.traverse(/** @param {typeof BaseNode} node */ (node) => {
    if (!node.record || !isTargetRequest(node.record)) return;
    if (firstTarget && firstTarget.record.startTime < node.record.startTime) {
      return;
    }
    firstTarget = node;
  });

  // Search target -> root
  const stack = [firstTarget];
  while (stack.length) {
    const node = stack.pop();
    if (closure.has(node)) {
      continue;
    }
    closure.add(node);
    stack.push(...node.getDependencies());
  }

  // Search root -> target
  const visited = new Set();
  stack.push(...root.getDependents());
  while (stack.length) {
    const node = stack.pop();
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);
    if (closure.has(node)) {
      for (const n of stack) {
        closure.add(n);
      }
    }
    stack.push(...node.getDependents());
  }

  const requests = Array.from(closure).map((n) => n.record)
      .filter(Boolean).filter((r) => r.endTime < firstTarget.record.startTime);
  const cpu = Array.from(closure).filter((n) => n.event)
      .filter((n) => n.event.ts < firstTarget.startTime * 1000 * 1000)
      .map((n) => [n.event, ...n.childEvents]);

  const  traceEvents = [].concat.apply([], cpu);  // eslint-disable-line
  return {requests, traceEvents};
}

/**
 * @param {T[][]}
 * @return {T[]}
 * @template {T}
 */
function flatten(arrs) {
  return [].concat.apply([], arrs);
}

function isXhrBlocking(xhrReq, networkRecords, criticalRequests, traceEvents) {
  const relevantEvents = traceEvents.filter((t) => t.name.startsWith('XHR'))
      .filter((t) => t.args.data.url == xhrReq.url);
  // TODO(warrengm): Investigate if we can get async stack traces here.
  const frames = flatten(
    relevantEvents.map((t) => t.args.data.stackTrace).filter(Boolean));
  const urls = new Set(frames.map((f) => f.url));
  const xhrIsCritical = !!networkRecords.find(
    (r) => urls.has(r.url) && criticalRequests.has(r));
  return xhrIsCritical;
}

/**
 * Adds all XHRs and JSONPs initiated by the given script if they are critical.
 */
function addInitiatedRequests(
  scriptReq, parentReq, networkRecords, traceEvents, criticalRequests) {
  const initiatedRequests = networkRecords.filter((r) =>
    r.initiatorRequest == scriptReq &&
    ['Script', 'XHR'].includes(r.resourceType) &&
    r.endTime < parentReq.startTime);

  for (const initiatedReq of initiatedRequests) {
    const blocking = initiatedReq.resourceType == 'XHR' ?
    // Verify the XHR is actually blocking.
      isXhrBlocking(initiatedReq, networkRecords, criticalRequests, traceEvents) :
    // If there are no initiated requests, then it's probably JSONP
      !networkRecords.find((r) => r.initiatorRequest == initiatedReq);
    if (blocking) {
      getCriticalPath(
        networkRecords, initiatedReq, traceEvents, criticalRequests);
    }
  }
}

/**
 * Returns the set of requests in the critical path of the target request.
 * @param {NetworkRequest[]} networkRecords
 * @param {NetworkRequest} targetRequest
 * @param {Set<NetworkRequest>=} criticaulRequests
 * @return {Set<NetworkRequest>}
 */
function getCriticalPath(
  networkRecords, targetRequest, traceEvents, criticalRequests = new Set()) {
  if (!targetRequest || criticalRequests.has(targetRequest)) {
    return criticalRequests;
  }
  criticalRequests.add(targetRequest);
  for (let stack = targetRequest.initiator.stack; stack; stack = stack.parent) {
    // @ts-ignore
    const urls = new Set(stack.callFrames.map((f) => f.url));
    for (const url of urls) {
      const request = networkRecords.find((r) => r.url === url);
      if (!request) continue;

      getCriticalPath(
        networkRecords, request, traceEvents, criticalRequests);

      if (request.resourceType == 'Script') {
        const scriptUrl = stack.callFrames[0].url;
        const scriptReq = networkRecords.find((r) => r.url === scriptUrl);
        if (scriptReq) {
          addInitiatedRequests(
            scriptReq, targetRequest, networkRecords, traceEvents,
            criticalRequests);
        }
      }
    }
  }
  getCriticalPath(
    networkRecords, targetRequest.initiatorRequest, traceEvents, criticalRequests);
  return criticalRequests;
}

module.exports = {getTransitiveClosure, getCriticalPath};
