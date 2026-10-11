// Opens (or focuses) the full-screen Violet Audio dashboard when the toolbar icon is clicked.
const APP_URL = chrome.runtime.getURL('app.html');

chrome.action.onClicked.addListener(async () => {
  const existing = await chrome.tabs.query({ url: APP_URL });
  const tab = existing[0];
  if (tab && tab.id !== undefined) {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: APP_URL });
  }
});
