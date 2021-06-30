# Publisher Ads Lighthouse Plugin
[![Linux Build Status](https://img.shields.io/travis/googleads/publisher-ads-lighthouse-plugin/master.svg)](https://travis-ci.org/googleads/publisher-ads-lighthouse-plugin)
[![NPM lighthouse package](https://img.shields.io/npm/v/lighthouse-plugin-publisher-ads.svg)](https://npmjs.org/package/lighthouse-plugin-publisher-ads)

Publisher Ads Lighthouse Plugin is a tool to improve ad speed and overall quality through a series of automated audits. At the moment, this is primarily targeted at sites using Google Ad Manager. This tool will aid in resolving discovered problems, providing a tool to be used to evaluate effectiveness of iterative changes while suggesting actionable feedback.

This tool is a plugin for [Lighthouse](https://github.com/GoogleChrome/lighthouse), an open-sourced tool integrated into Chrome dev tools that is widely used by developers.

In order to help us improve please [file an issue](https://github.com/googleads/publisher-ads-lighthouse-plugin/issues) to let us know of any issues or suggestions you may have.

## Web App

We currently have a web app version of Publisher Ads Lighthouse Plugin. It can be accessed at [developers.google.com/publisher-ads-audits](https://developers.google.com/publisher-ads-audits/).

## Lighthouse Node CLI

Publisher Ads Audits is available as a [node package](https://npmjs.org/package/lighthouse-plugin-publisher-ads) which can be used with the Lighthouse CLI.

### Setup

```sh
mkdir pub-ads-audits-wrapper && cd pub-ads-audits-wrapper && \
npm init -y && \
yarn add -D lighthouse && \
yarn add -D lighthouse-plugin-publisher-ads
```

### Usage

From within `wrapper` directory created above:

```sh
yarn lighthouse {url} --plugins=lighthouse-plugin-publisher-ads
```

Common additional arguments include:

-   `--view`: Open report in Chrome after execution.
-   `--only-categories=performance,lighthouse-plugin-publisher-ads` to only run page and ad performance audits
-   `--preset=desktop` and `--preset=mobile` to run on the desktop or mobile version of the site.
-   `--extra-headers "{\"Cookie\":\"monster=blue\"}"` to include additional
    cookies on all requests.

See [Lighthouse documentation](https://github.com/GoogleChrome/lighthouse/#cli-options) for additional options.

## Development

### Setup

```sh
git clone git@github.com:googleads/publisher-ads-lighthouse-plugin.git
cd publisher-ads-lighthouse-plugin
yarn
```

Afterwards you can run the plugin on its own with:

```sh
node index.js <url> [..options]
```

See the [Usage](#usage) section for supported options

#### Continuous Integration

This plugin can be integrated with your existing CI using Lighthouse CI to 
ensure that ad performance hasn't regressed. 
[Learn More.](https://github.com/googleads/publisher-ads-lighthouse-plugin/blob/master/lighthouse-ci/README.md)

### Tests
```sh
# Lint and test all files.
yarn test
```


## Contributions

See [CONTRIBUTING.md](https://github.com/googleads/publisher-ads-lighthouse-plugin/blob/master/CONTRIBUTING.md)




## References

-   Lighthouse Docs: https://github.com/GoogleChrome/lighthouse
-   DevTools Protocol: https://chromedevtools.github.io/devtools-protocol
