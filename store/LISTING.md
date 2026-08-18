# Edge Add-ons listing copy

Everything Partner Center asks for, ready to paste. Replace the bracketed placeholders
before you submit.

---

## Name

```
Site Label
```

## Short description (limit 132 characters)

```
Colour-coded labels for your environments. Never confuse UAT with Production again.
```

## Category

`Developer tools`

## Supported languages

`English (United States)`

---

## Detailed description

```
Site Label puts a clear, colour-coded label over any website, so you always know which
environment you are looking at.

If you work across several environments of the same application — Development, Test, UAT,
Training, Production — they all look identical. Site Label makes them impossible to mix up.

BUILT FOR CONSULTANTS
Made for people who keep six near-identical tabs open at once. It understands Dynamics 365
Finance & Operations addresses and can tell a sandbox from a production host automatically,
and it works just as well with Salesforce, SAP, ServiceNow, Power Platform, Jira, or any
internal web application.

LABEL A SITE ONCE
Save a site and every page underneath it keeps the label — sub-pages, menu items, query
strings and single-page-app routes included. Choose how far it reaches: one exact site, a
single section by path, or a domain and all its subdomains. Where rules overlap, the most
specific one wins, so you can shade a whole domain grey and still make its UAT box orange.

CHOOSE HOW IT LOOKS — twenty styles
• Corner ribbon, in any of the four corners
• A bar across the top or the bottom, overlaying the page or pushing it down
• A hairline along one edge with a small tag, for a strong hint that covers almost nothing
• A tab down the left or right edge, clear of toolbars and content
• Corner brackets that frame the screen while covering 0.2% of it
• A border frame around the page, with or without a label tab
• A floating badge in any corner, or a pill centred on an edge
• A centred watermark you can read straight through
• Five meme-inspired styles, each matched to an environment: an Impact caption, rolling caution
  tape for Production, a rubber approval stamp for UAT, glitching text for Test, and a green
  terminal for Dev. These borrow the formats' typography, never the copyrighted meme images.
• Buddy - a character stands in the corner holding your label on a placard and every so often
  does its own little routine: the safety cone rocks and refuses to fall over, the penguin
  waddles, the bunny twitches its ears and hops, the rain cloud lets a little rain fall. Ten in
  all, every one original, and Site Label suggests the one that suits the environment - a cone
  on guard over Production, a hopeful bunny in Test. Unlock a buddy to drag it anywhere and
  resize it with the mouse.
• Ships with no access to any website. Access is requested one site at a time, as you add it,
  and you are told exactly which addresses are involved.
• Never reads page content — no text, no form fields, no credentials, no cookies.
• No network requests, no analytics, no tracking, no remote code. Nothing leaves your browser.
• The label cannot swallow your clicks; they pass straight through to the app underneath,
  except while you have deliberately unlocked it to drag it.
• Delete a label and the site access is handed back automatically.

Keyboard shortcuts: Alt+Shift+L hides or shows the label on the current tab, Alt+Shift+S
opens the popup.
```

---

## Permission justifications

Reviewers ask for these individually. Keep the wording specific.

**`storage`**
```
Stores the user's label rules, groups, colours and display settings locally in the browser.
No data is transmitted anywhere. This is the only place the extension keeps state.
```

**`scripting`**
```
Used to register and inject the content script that draws the label overlay, and only for
sites the user has explicitly added and granted access to. Registrations are kept in step
with the granted permissions, so revoking access to a site deregisters its script. The
injected script draws an overlay element and does not read page content.
```

**`activeTab`**
```
Lets the popup read the address of the current tab when the user clicks the toolbar icon,
so it can suggest a label and the correct scope for the site they are looking at. Without
it the popup cannot tell the user which site they are about to label.
```

**`contextMenus`**
```
Adds a single right-click item, "Label this site with Site Label", which opens the options
page with the current address pre-filled. It is a convenience entry point for the same
action available from the toolbar popup.
```

**`optional_host_permissions: *://*/*`**
```
This is declared as OPTIONAL and is never held by default — the extension installs with no
host access at all.

The extension cannot know in advance which sites a user will want to label; those are
private internal addresses such as company ERP environments. Rather than requesting broad
access up front, it requests access to one specific site at a time, at the moment the user
adds that site, using chrome.permissions.request from a user gesture. The user sees exactly
which addresses are involved before granting.

Granted access is used solely to inject the overlay script that draws the label. No page
content is read and no data is transmitted. Deleting a label releases the corresponding
host permission if no other rule needs it, and the options page lets the user review and
revoke access per site at any time.
```

---

## Privacy

**Does this extension collect user data?** `No`

**Permissions explainer**

`PERMISSIONS.md` in the repository is written for end users, not reviewers. It is worth
linking from the listing's support page: it explains why Edge's prompt sounds broad, what the
extension does with the access, and how to withdraw it.

**Privacy policy URL**
```
[Host PRIVACY.md and paste the URL here — a GitHub Pages URL or a raw GitHub file is fine]
```

**Support / contact**
```
[your support email or repository issues URL]
```

---

## Screenshots

Partner Center wants at least one at **1280×800** or **640×400**. Four or five tells the
story properly. Use `tools/preview-page.html` for clean shots that contain no real data.

1. **The problem, solved** — a realistic ERP page with a red `PRODUCTION` corner ribbon.
   This is the store tile shot; make it the first one.
2. **The popup mid-add** — icon clicked on a UAT host, showing the guessed label, the colour
   presets and the three scope choices. Shows how quick adding a site is.
3. **Display modes** — a grid or collage of the ribbon, top bar, frame and badge.
4. **Groups** — the options page Groups tab with Production, UAT, Test and Dev.
5. **Export** — the Import / export tab, to sell the team-sharing angle.

Avoid real customer host names in every shot. `contoso.com` and
`contoso-uat.sandbox.operations.dynamics.com` are safe.

## Store icon

`icons/icon-128.png` is included in the package. The **300×300** store logo Partner Center
asks for is generated alongside it as `store/store-logo-300.png`.

---

## Submission checklist

- [ ] `node tools/test-matcher.js` passes
- [ ] `python tools/package.py` produces the zip
- [ ] Version in `manifest.json` bumped since the last submission
- [ ] Privacy policy hosted and the URL filled in
- [ ] Screenshots captured at 1280×800
- [ ] Permission justifications pasted from above
- [ ] "Does this extension collect user data" answered **No**
