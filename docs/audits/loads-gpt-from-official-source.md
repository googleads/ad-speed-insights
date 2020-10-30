# Load GPT from an official source

## Overview

This audit ensures that the Google Publisher Tag (GPT) library is being loaded
from an official source. The browser must open a connection to each new host
your page references, which can take significant time. By loading GPT from the
recommended host you ensure that all ad serving requests are made to a single
domain, reducing the number of connections to open and improving page load
performance.

## Recommendations

Ensure that GPT is being loaded from an official source. Standard integrations
should use:

```HTML
<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"></script>
```

Integrations with limited ads should use:

```HTML
<script async src="https://pagead2.googlesyndication.com/tag/js/gpt.js"></script>
```

## More information

[Load GPT from an official source](https://developers.google.com/doubleclick-gpt/guides/general-best-practices#load_from_an_official_source)
[Assessing Loading Performance in Real Life with Navigation and Resource Timing](https://developers.google.com/web/fundamentals/performance/navigation-and-resource-timing)
[Get Started with Google Publisher Tags](https://developers.google.com/doubleclick-gpt/guides/get-started)
