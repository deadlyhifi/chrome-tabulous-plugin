# Tabulous Privacy Policy

Last updated: September 20, 2026

Tabulous is a tab-management Chrome extension. It uses information about your open tabs only
to provide its tab overview, search, sorting, grouping, preview, and diagnostic features.

## Information Tabulous Handles

Tabulous reads the titles, URLs, favicons, grouping, status, and other browser-provided
metadata of your open tabs. If you grant the optional site-access permission, Tabulous also
captures an image of the visible area of active tabs to display as a preview. If you grant the
optional process permission on a supported Chrome channel, Tabulous reads per-tab memory and
CPU information for display in the details panel.

## Storage and Retention

- Tab metadata is processed locally in the extension.
- Preview images are stored locally in IndexedDB. They are deleted when the corresponding tab
  closes and older previews are evicted when the cache exceeds 300 entries.
- Tab open times are stored locally using Chrome storage.
- Appearance and sorting preferences use Chrome Sync storage and may be synchronized by Chrome
  through your signed-in Google account. The developer does not receive this data.
- Chrome removes extension storage when the extension is uninstalled, subject to Chrome's own
  synchronization behavior.

## Sharing and Transmission

Tabulous does not send tab data, browsing activity, screenshots, or diagnostics to the
developer or to third parties. It does not sell user data, use it for advertising or credit
decisions, or allow humans to read it. Tabulous does not include analytics, tracking, or
remotely hosted executable code.

## Permissions

- `tabs`: Display and manage open tabs, including their titles, addresses, and state.
- `tabGroups`: Display and manage Chrome tab groups.
- `storage`: Store preferences, tab open times, and other local extension state.
- `favicon`: Display website icons when a preview is unavailable.
- Optional `<all_urls>` access: Capture visible active-tab screenshots for previews. Declining
  this permission leaves all other features available and uses favicon fallback cards.
- Optional `processes`: Display per-tab memory and CPU information on Chrome channels that
  support the API. Declining it leaves all other features available.

## Your Choices

The screenshot and process permissions are optional and requested in the Tabulous interface.
You can decline them or revoke them from Chrome's extension settings. Closing a tab deletes its
cached preview. You can remove all locally stored Tabulous data by uninstalling the extension.

## Changes

Material changes to this policy will be published in this document with a revised date.

## Contact

For privacy questions or support, open an issue at
https://github.com/deadlyhifi/chrome-tabulous-plugin/issues.

## Limited Use

Tabulous's use of information received from Chrome APIs adheres to the Chrome Web Store User
Data Policy, including the Limited Use requirements.
