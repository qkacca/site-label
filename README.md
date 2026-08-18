# Site Label

A Microsoft Edge extension that puts a colour-coded label over any site, so you always
know which environment you are working in.

Built for consultants who keep six D365 Finance & Operations tabs open and need to be
certain which one is Production before pressing Post.

---

## What it does

- **Labels a site and every page under it.** You save a base address once; sub-pages,
  menu items, query strings and single-page-app routes all keep the label.
- **Twenty-six looks.** Corner ribbon (any of the four corners), a bar across the top or bottom,
  a hairline along one edge with a small tag, a tab down the left or right edge, corner
  brackets, a border frame, a floating badge or centre pill, a watermark, or a Buddy character
  holding your label on a placard.
- **Sized for the screen you are on.** Every dimension is responsive: the same label renders
  larger on a 4K monitor and smaller in a narrow window, instead of being a fixed pixel size
  that is lost on one and overwhelming on the other.
- **Your own text and colours.** Eighteen presets including gold, plus any custom colour you
  like. Colours you use often can be saved to your own palette, which then appears alongside
  the presets everywhere you pick a colour.
- **Size it to suit.** One "overall size" control scales the whole label from 50% to 300% -
  discreet on a system you trust, impossible to miss on Production. Text size, opacity, bold,
  upper case and diagonal stripes are all separately adjustable.
- **Transparency.** Set how see-through the label is, from solid to barely there - the
  background and the text fade together, so a bold ribbon can sit lightly over a busy screen.
- **Glow.** Switch on a light that runs continuously across the label, the way cabin lighting
  travels across a car's dashboard, with a speed control from a 12-second drift to a
  1.2-second sweep. Bars, ribbons, badges and frame tabs get the travelling light; a border
  frame breathes instead, and a watermark pulses.
- **Put it where you want it.** Labels are locked in place by default so they can never
  intercept a click. Unlock one and you can drag it anywhere on the page; the position is
  remembered per site and is stored as a fraction of the window, so it stays put when you
  resize. One button puts it back where it started.
- **Groups.** Tag sites into groups such as Production, UAT, Test or a client name. The
  group holds the look; its sites inherit it, so restyling a group restyles every site in it.
- **Export and import.** Send a group and its sites to the rest of the project team as a
  single file.
- **Environment detection.** When you add a site it guesses the label and colour from the
  address, including D365 F&O production vs sandbox hosts, LCS and Dataverse.

## Safety

This extension is built to ask for as little as possible.

- **It ships with no access to any website.** `host_permissions` is empty. Access is
  requested one site at a time, at the moment you add that site, and the popup tells you
  exactly which addresses are about to be granted.
- **Remove a label and the access goes with it**, unless another label still needs it.
  The Settings tab lists every site it can currently see, with a Remove button each.
- **It never reads page content.** The content script only draws an overlay. It does not
  read form fields, text, cookies or storage belonging to the page.
- **Nothing leaves your browser.** There are no network requests, no analytics, no remote
  code, no external scripts. Sharing happens only through files you export yourself.
- **The overlay cannot swallow your clicks.** It is `pointer-events: none` by default, so
  clicks pass straight through to the app underneath. Click-to-dismiss is opt-in per label.
  A label only accepts the mouse while you have deliberately unlocked it to move it, and it
  goes back to being click-through the moment you lock it again.
- **The overlay is isolated from the page.** It lives in a *closed* shadow root, so page
  scripts cannot read or tamper with it, and its CSS cannot leak into the page.
- **The permission prompt is explained before it appears.** Edge's own dialog always says
  "Read and change your data on…" and no extension can reword it, so Site Label shows you
  first exactly which addresses are being granted, what it does with them, what it does not
  do, and how to undo it. Options → Settings lists every permission with its purpose.
  See [PERMISSIONS.md](PERMISSIONS.md) for the full account.
- **Imported files are treated as untrusted.** Every field is re-validated: colours must be
  literal hex, display modes must be known values, numbers are clamped, text is stripped of
  control characters and length-capped, and unknown fields are dropped. You see a summary of
  what a file contains before anything is written, and importing never grants site access on
  its own.

## Installing it while you develop

1. Open `edge://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.

To install the packaged build instead, run `python tools/package.py` and load
`dist/site-label-1.9.0.zip`.

## Using it

**Label the site you are on** — click the Site Label icon, check the suggested text,
colour and scope, then **Add label**. Edge asks for access to that site; the label appears
straight away, with no reload.

**Choose how far it reaches** — the popup offers up to three scopes:

| Scope | Example | Matches |
| --- | --- | --- |
| This site | `https://uat.contoso.com` | that exact scheme and host, all pages under it |
| This section only | `https://apps.contoso.com/tenant-a` | that path and everything below it |
| All subdomains | `contoso.com` | `contoso.com` and `*.contoso.com` |

The Edit dialog adds two more: *this host on any scheme*, and a `*` wildcard pattern for
generated hostnames such as `https://*-uat.contoso.com/*`.

When more than one rule matches a page, the most specific one wins — a path prefix beats a
site, which beats a subdomain rule. So you can label all of `contoso.com` grey and still
have `uat.contoso.com` show orange.

**Share a set of environments** — Options → Import / export → tick the groups → **Export
selected**. The person receiving the file imports it, reviews the summary, and grants access
to the sites in one prompt from the Sites tab.

**Keyboard** — `Alt+Shift+L` hides or shows the label on the current tab, `Alt+Shift+S`
opens the popup. Both are configurable at `edge://extensions/shortcuts`.

## Moving and resizing a label

Every label is **locked** by default: it ignores the mouse entirely, so it can never
intercept a click in the app underneath.

To move one, open the popup on that site and untick **Lock in place** (or untick it in
Options → Edit). The label picks up a dashed outline and a grab cursor - drag it wherever
you want it. Lock it again when you are done and it goes back to being click-through.

The position is saved against that site as a fraction of the window, so it holds its place
when you resize the browser or move to a different monitor. **Reset to default position**
returns it to the corner its display mode implies.

A border frame has nothing to reposition, so the lock control is hidden for that mode.

Use **Overall size** to scale the whole label between 50% and 300%. It scales the geometry
and the text together, so a ribbon stays a properly proportioned ribbon at any size.

## Meme-inspired styles

Five styles that borrow the visual language of well-known meme formats, each matched to the
environment whose tone it suits:

| Style | Looks like | Suits |
| --- | --- | --- |
| Impact caption | Heavy condensed white caps with a black outline, straight over the page, with a rule in the label's colour | anything, especially a warning |
| Caution tape | The label's colour behind rolling black diagonal stripes | Production |
| Approval stamp | A rotated rubber stamp: double rule, wide letter-spacing | UAT, Staging |
| Glitch text | The label with two offset colour copies flickering behind it | Test, SIT, QA |
| Terminal | Monospace green on black with a blinking block cursor | Dev, Build, Local |

**What these deliberately are not.** The famous meme *images* are copyrighted photographs and
artwork, usually of real people, so none is reproduced here - an extension that shipped them
would not survive store review, and putting a stranger's face on your Production banner is a
poor idea regardless. What each style borrows is the format's typography and layout, which is
what carries the joke, and unlike a photograph it recolours to your label and scales with
everything else. A test asserts that no style references an external image.

`SL.memeForEnvironment()` gives the suggested style for an environment name if you want to
wire it up further.

## Choosing a look

All twenty modes are listed in the Style dropdown. If the concern is noticing the label
without it getting in the way, these cover the least screen while still showing the text —
measured as a share of a 1280×720 window:

| Mode | Covers | Good for |
| --- | --- | --- |
| Corner brackets | 0.22% | Frames the whole screen peripherally, covers almost nothing |
| Side tab, left or right | 0.24% | Clear of toolbars and page content entirely |
| Floating badge | 0.24% | The classic discreet marker |
| Centre pill | 0.26% | Hard to miss without sitting over a toolbar |
| Corner ribbon | 0.53% | Most recognisable as an environment marker |
| Edge line with tag | 0.72% | A colour wash along one edge, very strong peripherally |
| Top or bottom bar | 3.2% | The most emphatic; can push the page down instead of covering it |
| Watermark | 5.4% | Translucent, so you read straight through it |

Side tabs and corner brackets are the ones to reach for on a dense screen such as the D365
F&O client, where the top and bottom edges are already busy.

## Buddy

Buddy mode stands a little character in the corner holding your label on a placard, and now
and then it says something in its own voice.

Ten characters, each with a completely different silhouette - which is what makes them
recognisable at a glance - and each with its own small routine.

**The character matches the environment.** When you add a site, Site Label suggests the one
that fits what the environment is for: a safety cone standing guard over Production, a formal
penguin doing things properly in UAT, a hopefully-trying bunny in Test, a jellyfish with no
consequences in a sandbox. So the corner of your screen carries a mood as well as a name. You
can always pick a different one.

| Character | Its move | Suits |
| --- | --- | --- |
| Cone the Safety Marshal | rocks, refuses to fall over | Production |
| Pip the Penguin | flaps its flippers and waddles | UAT, Staging |
| Mochi the Bunny | twitches its ears and hops | Test, SIT, QA |
| Bumble the Bee | flutters its wings and hovers | Dev, Build |
| Blinky the Jellyfish | pulses and trails its tentacles | Sandbox |
| Waffle the Corgi | wags its tail, delighted | Demo |
| Nimbus the Rain Cloud | lets a little rain fall | Dataverse |
| Luna the Sleepy Moon | yawns while the stars twinkle | Local |
| Mango the Desk Plant | sways its leaves | Training |
| Biscuit the Office Cat | crouches, then loses interest | anywhere |

The placard floats in front of the character, edged in that character's own colour with a real
drop shadow doing the depth. Earlier versions drew little hands gripping the top edge of the
sign; at this size they read as feet planted in it, so they are gone.

**Each character has its own move, and it exists to sell the label.** At rest the character is
completely still - a constant bob plus a swaying placard plus a speech bubble was too much
happening at once, and none of it landed. Instead, on a timer you set, the character performs
its routine once: the cup tips back for a sip with the steam rising, the clock rings with its
bells jiggling, the monitor drops a frame, the cat crouches and then loses interest. The
placard pops at the same moment, so the movement catches the eye and the label is where it
lands. Characters also blink. All of it stops if the system asks for reduced motion.

Speech bubbles are gone for now. The lines are still in `src/common/buddies.js` if they are
ever wanted back.

**Moving and resizing.** Unlock the buddy and the whole figure becomes the grab handle - grab
the character, not just the sign. A round grip appears on the corner facing into the page:
drag it away from the corner the buddy is docked to and it grows, drag it back and it shrinks,
between 50% and 300%. Growth is anchored to the docked corner so it expands into the page
rather than sliding off the edge.

Configure all of it from the popup: character, routine on or off, how often it performs (as often as every five seconds, or as rarely as every ten minutes), and
**Do it now** to audition a character instantly.

### Why these characters and not famous ones

Everything here is original. A published extension cannot use a living person's likeness or a
licensed character without permission, and inventing quotes for a real public figure is a
problem of its own. The cast in `src/common/buddies.js` is plain data if you want to add your
own for private use.

## Transparency and glow

**Transparency** runs from 0% (solid) to 85%, and applies to the label and its background
together. It is in the popup and in the editor; the underlying value is stored as opacity,
so anything you set before this existed carries over untouched.

**Glow** makes the label's own edge glow. Rather than a highlight sliding across the surface -
which read as a reflection on the label rather than a light coming from it - the border swells
and fades while cycling through three hues drawn from the label's own colour. A red label
burns through crimson, bright red and red-orange; a blue one through cyan, blue and deep blue.
It reads like a warning lamp, which is the point.

The speed slider runs from 1 to 10: a 12-second breath at one end, a 1.2-second pulse at the
other, with the exact duration shown as you drag. Border frames and corner brackets glow along
their own edges; a watermark pulses in brightness and colour together. The browser pauses all
of it on background tabs, and if the system asks for reduced motion the glow is shown at full
strength but held still.

## Matching your browser

Site Label's own popup and options page follow your browser's light or dark setting. Edge lets
you set its appearance independently of Windows, and when those two disagree the automatic
choice can land on the wrong one - so Settings has an explicit **Appearance** control: match
the browser, always light, or always dark.

## Saving your own colours

Any colour is available from the two colour pickers. When you have one you want to keep,
click **Save colour** in the popup, or **Save to palette** in the editor, and it joins the
presets everywhere a colour is picked. Manage the saved list in Options → Settings →
**Custom colours**, which is also where you can add one directly.

## A note on the address bar

Extensions cannot recolour Edge's own address bar or tab strip — the browser does not expose
it, in any browser. Site Label gets as close as the platform allows:

- a **top bar** immediately under the address bar, which can either overlay the page or push
  it down;
- the label on the **toolbar icon** as a coloured badge;
- an optional **tab title prefix**, so the environment shows in the tab, the taskbar and in
  any screenshot you paste into a ticket.

## Project layout

```
manifest.json              MV3 manifest
src/common/schema.js       defaults, validation, sanitisers, style resolution
src/common/matcher.js      URL parsing, pattern matching, environment detection
src/common/storage.js      storage access, export and import
src/common/preview.js      shared style preview used by popup and options
src/content/label.js       the renderer that draws on the page
src/background/            service worker: script registration, badge, menus
src/popup/                 the toolbar popup
src/options/               sites, groups, import/export, settings
tools/make-icons.py        regenerates the PNG icons and the store logo
tools/package.py           builds dist/site-label-<version>.zip
tools/test-matcher.js      checks for matching and import validation
tools/preview-page.html    render harness (see below)
tools/consent-preview.html  proof-reading page for the permission wording
tools/buddy-sheet.html      all ten characters at size, for judging the drawing
```

## Development

Run the checks:

```bash
node tools/test-matcher.js
```

394 assertions covering base-URL matching, scope precedence, path boundaries, scheme
rejection, permission-pattern narrowness, colour and text sanitising, environment detection,
import validation, the size and position fields, the transparency
conversion, the glow speed mapping, the custom palette, the permission wording, an upgrade check that loads a
1.0.0-shaped store and proves nothing is lost, a wiring check that every shared module is
loaded in every context that needs it, and a scan of every shipped file that fails if
a networking or HTML-injection primitive is ever introduced.

Ribbon geometry is checked at source (all four corners must use the transform-based centring,
since offset-based positioning put the band off the corner diagonal and made it drift with the
text size). The geometry itself is measured in the browser through the harness.

The render harness stubs the `chrome.*` APIs and loads the real content script, so you can
see every display mode without installing anything. Serve the folder and open it:

```bash
python -m http.server 8765
```

Then visit `http://localhost:8765/tools/preview-page.html`. It has to be served over http
rather than opened as a file, because the matcher only accepts http and https addresses.

Regenerate the icons after editing `tools/make-icons.py`:

```bash
python tools/make-icons.py
```

## Publishing to the Edge Add-ons store

1. `python tools/package.py`
2. Register at [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge) —
   free for the Edge store.
3. Create a new extension and upload the zip from `dist/`.
4. Fill in the listing from `store/LISTING.md`, which has the description, the permission
   justifications reviewers ask for, and the screenshot shot-list.
5. Point the privacy policy field at your hosted copy of `PRIVACY.md`.

Review usually takes a few business days. The permission justifications matter most: this
extension requests `*://*/*` as an *optional* host permission, so explain that access is
requested per site at runtime and never held by default.

## Licence

MIT — see `LICENSE`.
