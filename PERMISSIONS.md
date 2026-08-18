# What Site Label can access, and why

Short version: Site Label installs with access to **no websites at all**, and asks for one
site at a time as you add it. It has no networking code, so nothing it sees can leave your
browser.

---

## The four fixed permissions

These are declared in the manifest and are always held. **None of them can see a website.**
Because none of them carries a user-facing warning, Edge shows no permission prompt when you
install Site Label.

| Permission | What it allows | What Site Label uses it for |
| --- | --- | --- |
| `storage` | Save data on this computer | Keeps your labels, groups, colours and settings. The only place anything is stored, and it never leaves the browser. |
| `scripting` | Run a script on pages the extension already has access to | Draws the label on sites you have added. It cannot reach a site you have not granted. |
| `activeTab` | See the current tab's address, only when you click the toolbar icon | Lets the popup tell you which site you are on and suggest a label and scope. No access before the click, none after. |
| `contextMenus` | Add a right-click menu item | Adds one entry, "Label this site with Site Label". |

## The one permission you are asked about

`optional_host_permissions: *://*/*` is declared as **optional**, which means it is never
held on installation. Site Label cannot know in advance which sites you will want to
label — they are usually private internal addresses — so instead of demanding access to
everything up front, it asks for one specific site at the moment you add it.

### Why the prompt sounds alarming

Edge will say:

> Read and change your data on uat.contoso.com

That wording is not chosen by Site Label and cannot be changed by any extension. It is the
only sentence Edge has for host access, and it describes the **ceiling** of what the
permission could technically allow — not what this extension does with it.

Site Label shows you, immediately before that prompt appears, exactly which addresses are
about to be granted and what they are used for.

### What Site Label actually does with site access

Two things:

1. Adds one element to the page to draw your label.
2. Reads the page's address, to work out whether one of your labels applies to it.

That is all. It does not read or change the page's content, text, form fields, passwords or
cookies.

### What it does not do

- No network requests of any kind. There is **no** `fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource` or `sendBeacon` anywhere in the shipped code, and no remote URL. This is
  enforced by a test (`tools/test-matcher.js`) that scans every shipped file and fails the
  build if any of them appears.
- No analytics, telemetry, crash reporting or tracking.
- No remote or generated code — no `eval`, no `new Function`, no external scripts. The
  extension's content security policy is `script-src 'self'`.
- No `innerHTML`, `insertAdjacentHTML` or `document.write`. Every element is built with
  `createElement` and `textContent`, so no text can ever be parsed as markup.
- No access to your history, downloads, cookies, bookmarks or other tabs. Those permissions
  are not requested, so the APIs are simply unavailable.

### Scope, per option

When you add a site you choose how far the rule reaches, and the grant follows it:

| You choose | Granted | Reaches |
| --- | --- | --- |
| This site | `https://uat.contoso.com/*` | that exact scheme, host and port, and pages under it |
| This section only | `https://apps.contoso.com/tenant-a/*` | see the note below |
| All subdomains | `*://contoso.com/*`, `*://*.contoso.com/*` | the domain and every subdomain — the widest option |
| This host, any scheme | `*://uat.contoso.com/*` | that host over http and https, any port |
| Wildcard | closest whole-subdomain equivalent | see the note below |

Two honest caveats:

- **"This section only" narrows where the label appears, not what is granted.** Browsers
  grant host access by site, not by folder, so the underlying permission still covers the
  whole site. If that matters to you, this option does not reduce the grant.
- **Wildcard patterns cannot be expressed exactly** in a browser permission. Edge is given
  the nearest whole-subdomain equivalent, which may be broader than your pattern.

### Withdrawing access

- Delete a label and its access is released automatically, unless another label still needs it.
- Options → Settings → **Site access** lists everything Site Label can currently see, with a
  Remove button for each, and a "Remove all site access" button.
- `edge://extensions` → Site Label → **Site permissions** gives you Edge's own controls.

Revoking access leaves your label rules intact; they simply stop being drawn until you grant
access again.

## Verifying all of this yourself

The extension is a few small, readable files with no build step and no minification — what
you load is what you read. The claims above are checkable:

```bash
node tools/test-matcher.js
```

257 assertions, including the scan that fails if any networking or HTML-injection primitive
is introduced.

To read the source, the parts that touch the page are
[`src/content/label.js`](src/content/label.js) (the only code that runs on a website) and
[`src/background/service-worker.js`](src/background/service-worker.js) (which decides where
that script is allowed to run).
