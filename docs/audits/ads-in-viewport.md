# Lazy load ads below the fold

## Overview

This audit ensures that no more than three ads are loaded outside the viewport.
Ads outside of the viewport are less likely to be seen by users, so loading an
excessive number of them can lower viewability rates and decrease page
performance.

## Recommendations

Defer loading ads outside of the viewport until they are nearly on-screen. See
the
[Google Publisher Tag Lazy Loading API](https://developers.google.com/publisher-tag/reference#googletag.PubAdsService_enableLazyLoad)
for an example.

## More information

[GPT Reference](https://developers.google.com/publisher-tag/reference)
[GPT Samples](https://developers.google.com/publisher-tag/samples/lazy-loading)
[Viewability best practices](https://support.google.com/admanager/answer/6199883)
