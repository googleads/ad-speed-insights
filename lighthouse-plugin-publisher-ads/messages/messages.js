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

const Messages = require('./en-US.json');

/**
 * Formats an ICU message.
 * @param {string} msg
 * @param {Object} vars A dictionary to inflate the ICU template.
 */
Messages.formatMessage = (msg, vars) => {
  // TODO: Implement locale picking.
  const formatter = new IntlMessageFormat(msg, 'en-us');
  return formatter.format(vars);
};

module.exports = Messages;
