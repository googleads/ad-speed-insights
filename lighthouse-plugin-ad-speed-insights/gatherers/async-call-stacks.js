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
const Gatherer = require('lighthouse/lighthouse-core/gather/gatherers/gatherer.js');

/**
 * @fileoverview Tracks unused JavaScript
 */
class AsyncCallStacks extends Gatherer {
  /**
   * @param {LH.Gatherer.PassContext} passContext
   */
  async beforePass(passContext) {
    await passContext.driver.sendCommand(
      'Runtime.setMaxCallStackSizeToCapture', {size: 100});
    await passContext.driver.sendCommand(
      'Runtime.setAsyncCallStackDepth', {maxDepth: 100});
  }

  /**
   * @param {LH.Gatherer.PassContext} passContext
   */
  async afterPass(passContext) {
    return {};
  }
}

module.exports = AsyncCallStacks;
