/** Available looks; the first is the default. */
export const UIS = [
  { id: "classic", label: "Classic" },
  { id: "journal", label: "Journal" },
  { id: "terminal", label: "Terminal" },
  { id: "swiss", label: "Swiss" },
  { id: "library", label: "Library" },
  { id: "blueprint", label: "Blueprint" },
] as const;

export type UiId = (typeof UIS)[number]["id"];

export const UI_STORAGE_KEY = "ohmline:ui";

/**
 * Inline script for <head>: picks the look from
 * `#ui=` or localStorage before first paint and
 * writes a render-blocking <link> for it.
 */
export const UI_HEAD_SCRIPT = `(function () {
  var UIS = ${JSON.stringify(UIS.map((u) => u.id))};
  var m = /(?:^#|[#&])ui=([a-z]+)/.exec(location.hash);
  var ui = m && m[1];
  try {
    ui = ui || localStorage.getItem("${UI_STORAGE_KEY}");
  } catch (e) {}
  if (UIS.indexOf(ui) === -1) ui = UIS[0];
  document.documentElement.dataset.ui = ui;
  document.write(
    '<link id="uiCss" rel="stylesheet" href="/ui/'
    + ui + '.css">'
  );
})();`;
