# reader/

The capture step: what every control on the page is asking.

`capture.js` is a **classic** content script (`chrome.scripting.executeScript` does not load modules), injected into every frame on click. It reads form controls and the text that names them, never `innerHTML`, which is how the output stays a couple of KB on a page that is half a megabyte of utility classes.

Naming a field follows the browser's own accessible-name rules, the ones screen readers use, because that is already a standardised answer to "what is this box asking?" and needs no AI at all. Container text is the fallback for the many forms that put the question in a plain div above the box.

It also renders the panel and performs an Insert, both only in the frame that owns the field.

Install, use and the whole flow: see [`../README.md`](../README.md).

```
node reader/capture.test.mjs
```

22 checks against a fixture carrying the label patterns real ATS forms use. Run it after any change to `capture.js`.
