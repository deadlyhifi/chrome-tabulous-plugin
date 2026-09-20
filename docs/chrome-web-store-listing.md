# Chrome Web Store Submission

Use this sheet when completing the Chrome Web Store Developer Dashboard for version 1.0.1.

## Product Details

**Name:** Tabulous

**Category:** Tools

**Summary:** A visual overview of every open tab, with previews, groups, search, sorting, and fast tab management.

**Single purpose:** Tabulous provides a visual interface for finding, organizing, and managing the tabs currently open in Chrome.

**Detailed description:**

Tabulous turns your open Chrome tabs into a clear visual overview across every window. Find the page you need, understand how your tabs are organized, and manage them without hunting through a crowded tab strip.

- Browse optional locally stored previews of active tabs.
- Search tab titles, addresses, and group names.
- Sort by window order, recent use, age, title, website, group, or memory.
- Create, rename, recolor, collapse, and reorganize Chrome tab groups.
- Select multiple tabs to group, close, or move them together.
- Drag tabs between windows and groups.
- Inspect tab state and, where supported, optional memory and CPU information.
- Follow the system appearance or choose light or dark mode.

Tabulous does not send browsing data anywhere. Screenshot previews are optional and remain in local browser storage.

## Privacy Tab

### Permission Justifications

| Permission   | Dashboard justification                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`       | Required to list open tabs and read their titles, URLs, and state, and to let the user activate, pin, move, group, or close them.                        |
| `tabGroups`  | Required to display existing Chrome tab groups and let the user create, rename, recolor, collapse, reorder, and move them.                               |
| `storage`    | Required to retain appearance and sorting preferences, tab open times, and locally cached preview metadata.                                              |
| `favicon`    | Required to show a website icon when a screenshot preview is unavailable.                                                                                |
| `<all_urls>` | Optional. Used only after an in-product request to capture the visible area of active tabs for local preview cards. Without it, favicon cards are shown. |
| `processes`  | Optional. Used only after an in-product request to show per-tab memory and CPU information on Chrome Dev/Canary channels that expose this API.           |

### Remote Code

Select **No, I am not using remote code**. All executable code ships inside the extension package. Tabulous does not fetch or evaluate remote scripts or WebAssembly.

### Data Usage

Disclose these categories:

- **Web history:** Open-tab URLs, titles, favicons, grouping, and tab state are read to render and manage the overview.
- **Website content:** With optional permission, visible active-tab screenshots are captured for preview cards.

The data is used only for the extension's tab-management purpose. It is not sold, transferred, used for advertising or creditworthiness, or accessed by humans. Processing and preview storage remain local. Chrome may synchronize appearance and sorting preferences through Chrome Sync; the developer cannot access them.

Certify all Limited Use statements only after confirming they still match the submitted build.

**Privacy policy URL:**
https://github.com/deadlyhifi/chrome-tabulous-plugin/blob/main/PRIVACY.md

## Store Assets

- Store icon: `images/store/store-icon.png` (128x128)
- Screenshots: `images/store/01-overview.png`, `02-dark-groups.png`, and `03-tab-details.png` (1280x800)
- Small promo tile: `images/store/promo-small.png` (440x280)
- Marquee promo image: `images/store/promo-marquee.png` (1400x560, optional)

## URLs

- Homepage: https://github.com/deadlyhifi/chrome-tabulous-plugin
- Support: https://github.com/deadlyhifi/chrome-tabulous-plugin/issues
- Privacy: https://github.com/deadlyhifi/chrome-tabulous-plugin/blob/main/PRIVACY.md

The Privacy URL will work publicly after `PRIVACY.md` is pushed to the default branch. A dedicated website URL can replace it later.

## Reviewer Instructions

1. Click the Tabulous toolbar action. A pinned Tabulous dashboard opens.
2. The dashboard immediately lists tabs across all normal Chrome windows. Search, sorting, activation, pinning, closing, moving, and tab-group controls work without optional access.
3. Click **Enable** in the preview disclosure to grant optional site access. Visit a normal web page, then return to Tabulous to see its locally cached preview. Chrome internal pages, the Chrome Web Store, and PDF viewer pages intentionally use fallback cards.
4. Memory and CPU details require the optional `processes` permission and a Chrome Dev or Canary channel. Stable Chrome reports that this feature is unavailable.
5. Split View controls appear only on Chrome 155 or newer because earlier versions do not expose the required API.

No account, payment, external service, or test credentials are required.

## Distribution and Account Checklist

- Register the intended permanent publisher account and pay Google's one-time fee.
- Verify the publisher contact email and enable review/publication notifications.
- Confirm the publisher name, regions, visibility, and free distribution settings.
- Verify the project domain in Search Console if displaying an official publisher URL.
- Search the Chrome Web Store and relevant trademark databases for conflicts with “Tabulous.”
- Upload `dist.zip`, complete every Privacy field, and use deferred publishing for final review.
- After approval, tag the exact submitted commit, for example `git tag v1.0.1`, and retain the matching `dist.zip`. Do not create the tag until the release commit is final.
- Increment both `manifest.json` and `package.json` before every later upload.
