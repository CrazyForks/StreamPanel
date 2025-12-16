// Create Stream Panel in DevTools
chrome.devtools.panels.create(
  'Stream',
  null,
  'devtools/panel.html',
  function(panel) {
    // Panel created
  }
);
