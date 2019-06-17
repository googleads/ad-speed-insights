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

const BaseNode = require('lighthouse/lighthouse-core/lib/dependency-graph/base-node');
// eslint-disable-next-line no-unused-vars
const CpuNode = require('lighthouse/lighthouse-core/lib/dependency-graph/cpu-node.js');
// eslint-disable-next-line no-unused-vars
const NetworkNode = require('lighthouse/lighthouse-core/lib/dependency-graph/network-node.js');
const {assert} = require('./asserts');
const {getNetworkInitiators} = require('lighthouse/lighthouse-core/computed/page-dependency-graph');
const {isGptAdRequest, getHeaderBidder} = require('./resource-classification');

/** @typedef {LH.TraceEvent} TraceEvent */
/** @typedef {LH.Artifacts.NetworkRequest} NetworkRequest */

/**
 * @typedef {Object} NetworkSummary
 * @property {Map<string, NetworkRequest>} requestsByUrl
 * @property {Map<string, Set<string>>} xhrEdges
 * @property {NetworkRequest[]} allRecords
 */

/**
 * @param {BaseNode.Node} root The root node of the DAG.
 * @param {(req: NetworkRequest) => boolean} isTargetRequest
 * @return {?NetworkNode}
 */
function findTargetRequest(root, isTargetRequest) {
  /** @type {?NetworkNode} */
  let firstTarget = null;
  root.traverse((node) => {
    if (node.type === BaseNode.TYPES.CPU || !isTargetRequest(node.record)) {
      return;
    }
    if (firstTarget && firstTarget.startTime < node.startTime) {
      return;
    }
    firstTarget = node;
  });
  return firstTarget;
}

/**
 * Returns all requests and CPU tasks in the loading graph of the target
 * requests.
 * @param {BaseNode.Node} root The root node of the DAG.
 * @param {(req: NetworkRequest) => boolean} isTargetRequest
 * @return {{requests: NetworkRequest[], traceEvents: TraceEvent[]}}
 */
function getTransitiveClosure(root, isTargetRequest) {
  /** @type {Set<BaseNode.Node>} */
  const closure = new Set();
  /** @type {?NetworkNode} */
  const firstTarget = findTargetRequest(root, isTargetRequest);

  /** @type {NetworkRequest[]} */
  const requests = [];
  /** @type {TraceEvent[]} */
  const traceEvents = [];

  if (firstTarget == null) {
    return {requests, traceEvents};
  }

  /** @type {BaseNode.Node[]} */ const stack = [firstTarget];

  // Search target -> root
  while (stack.length) {
    const node = stack.pop();
    if (!node || closure.has(node)) {
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
    if (!node || visited.has(node)) {
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


  for (const node of closure) {
    if (node.type === BaseNode.TYPES.NETWORK) {
      if (node.endTime < assert(firstTarget).startTime) {
        requests.push(node.record);
      }
    } else if (node.type === BaseNode.TYPES.CPU) {
      if (node.event.ts < assert(firstTarget).startTime * 1e6) {
        traceEvents.push(node.event, ...node.childEvents);
      }
    }
  }
  return {requests, traceEvents};
}

/**
 * Checks if the given XHR request is critical.
 * @param {NetworkRequest} xhrReq
 * @param {NetworkSummary} networkSummary
 * @param {Set<NetworkRequest>} criticalRequests Known critical requests.
 * @return {boolean}
 */
function isXhrCritical(xhrReq, networkSummary, criticalRequests) {
  const edges = networkSummary.xhrEdges.get(xhrReq.url);
  if (!edges) {
    return false;
  }
  for (const {url} of criticalRequests) {
    if (edges.has(url)) {
      return true;
    }
  }
  return false;
}

/**
 * Adds all XHRs and JSONPs initiated by the given script if they are critical.
 * @param {NetworkRequest} scriptReq
 * @param {NetworkRequest} parentReq
 * @param {NetworkSummary} networkSummary
 * @param {Set<NetworkRequest>} criticalRequests Known critical requests. This
 *     method may mutate this set to add new requests.
 */
function addInitiatedRequests(
  scriptReq, parentReq, networkSummary, criticalRequests) {
  const initiatedRequests = networkSummary.allRecords
      .filter((r) => ['Script', 'XHR'].includes(r.resourceType) &&
          r.endTime < parentReq.startTime)
      .filter((r) => r.initiatorRequest == scriptReq ||
        getNetworkInitiators(r).includes(scriptReq.url));

  for (const initiatedReq of initiatedRequests) {
    // TODO(warrengm): Check for JSONP and Fetch requests.
    const blocking =
      initiatedReq.resourceType == 'XHR' &&
      isXhrCritical(initiatedReq, networkSummary, criticalRequests);
    if (blocking) {
      getCriticalGraph(networkSummary, initiatedReq, criticalRequests);
    }
  }
}

/**
 * Returns the set of requests in the critical path of the target request.
 * @param {NetworkSummary} networkSummary
 * @param {?NetworkRequest} targetRequest
 * @param {Set<NetworkRequest>=} criticalRequests
 * @return {Set<NetworkRequest>}
 */
function getCriticalGraph(
  networkSummary, targetRequest, criticalRequests = new Set()) {
  if (!targetRequest || criticalRequests.has(targetRequest)) {
    return criticalRequests;
  }
  criticalRequests.add(targetRequest);
  const seen = new Set();
  for (let stack = targetRequest.initiator.stack; stack; stack = stack.parent) {
    for (const {url} of stack.callFrames) {
      if (seen.has(url)) continue;
      seen.add(url);

      const request = networkSummary.requestsByUrl.get(url);
      if (!request) continue;

      getCriticalGraph(networkSummary, request, criticalRequests);

      if (request.resourceType == 'Script') {
        const scriptUrl = stack.callFrames[0].url;
        const scriptReq = networkSummary.requestsByUrl.get(scriptUrl);
        if (scriptReq) {
          addInitiatedRequests(
            scriptReq,
            targetRequest,
            networkSummary,
            criticalRequests);
        }
      }
    }
  }
  // Check the initiator request just to be sure.
  getCriticalGraph(
    networkSummary, targetRequest.initiatorRequest || null, criticalRequests);
  return criticalRequests;
}

/**
 * @param {NetworkRequest[]} networkRecords
 * @param {TraceEvent[]} traceEvents
 * @return {NetworkSummary}
 */
function buildNetworkSummary(networkRecords, traceEvents) {
  const requestsByUrl = new Map();
  for (const req of networkRecords) {
    requestsByUrl.set(req.url, req);
  }

  const xhrEvents = traceEvents
      .filter((t) => t.name.startsWith('XHR'))
      .filter((t) => !!(t.args.data || {}).url);
  const xhrEdges = new Map();
  for (const e of xhrEvents) {
    const data = e.args.data || {};
    const edges = xhrEdges.get(data.url) || new Set();
    for (const {url} of data.stackTrace || []) {
      edges.add(url);
    }
    xhrEdges.set(data.url, edges);
  }
  return {requestsByUrl, xhrEdges, allRecords: networkRecords};
}

/**
 * Returns all requests in the loading graph of ads. This will return the empty
 * set if no ad requests are present.
 * @param {NetworkRequest[]} networkRecords
 * @param {TraceEvent[]} traceEvents
 * @return {Set<NetworkRequest>}
 */
function getAdCriticalGraph(networkRecords, traceEvents) {
  const maybeFirstAdRequest = networkRecords.find(isGptAdRequest);
  const criticalRequests = new Set();
  if (maybeFirstAdRequest == null) {
    return criticalRequests;
  }
  const firstAdRequest = assert(maybeFirstAdRequest);
  const bidRequests = networkRecords.filter((r) =>
    !!getHeaderBidder(r.url) && r.endTime <= firstAdRequest.startTime);
  const summary = buildNetworkSummary(networkRecords, traceEvents);
  for (const req of [firstAdRequest, ...bidRequests]) {
    getCriticalGraph(summary, req, criticalRequests);
  }
  const result = new Set(Array.from(criticalRequests).filter(
    (r) => r.endTime < firstAdRequest.startTime));
  return result;
}

module.exports = {getTransitiveClosure, getCriticalGraph, getAdCriticalGraph};
