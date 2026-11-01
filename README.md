# Persian Calendar & Date/Time Module for TropaTT

`crm.persian-calendar` — a complete **Jalali (Shamsi) calendar, date picker and
date-time picker** for the TropaTT user interface.

The module is **strictly presentation-layer**: TropaTT keeps storing and
processing every date the way it always has — Gregorian, ISO-8601, untouched
migrations, untouched API contracts. This module converts on input (what the
user picks) and on display (what the user sees), nothing else.

```
User selects ۱۴۰۵/۰۸/۰۹  ──►  internal value 2026-10-31  ──►  stored as before
Stored 2026-10-31         ──►  displayed as ۱۴۰۵/۰۸/۰۹     ──►  user sees Jalali
```

---

## Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Using the components](#using-the-components)
   - [Date picker](#1-date-picker)
   - [Date & time picker](#2-date--time-picker)
   - [Inline calendar](#3-inline-calendar)
   - [Formatting utilities](#4-formatting-utilities)
   - [Conversion utilities](#5-conversion-utilities)
   - [Autoformatting existing date displays](#6-autoformatting-existing-date-displays)
6. [Server-side (PHP) API](#server-side-php-api)
7. [REST endpoints](#rest-endpoints)
8. [MCP tools for AI agents](#mcp-tools-for-ai-agents)
9. [Position slots (UI integration points)](#position-slots-ui-integration-points)
10. [Localization & RTL](#localization--rtl)
11. [Storage & database guarantees](#storage--database-guarantees)
12. [Library & algorithm notes](#library--algorithm-notes)
13. [Testing](#testing)
14. [File structure](#file-structure)
15. [Uninstalling](#uninstalling)
16. [Credits & license](#credits--license)

---

## Features

**Persian calendar**
- Full Jalali month grid, weeks starting on **شنبه (Saturday)**
- Persian month names (فروردین … اسفند) and weekday names (شنبه … جمعه)
- Month navigation, year navigation (buttons + selects), jump to **امروز**
- Correct leap years (33-year break-cycle arithmetic) and month lengths
  (31/31/31/31/31/31/30/30/30/30/30/29-30)
- Persian numerals (۰۱۲۳۴۵۶۷۸۹) throughout
- Weekend tint for جمعه (Friday), today highlight, adjacent-month days
- Full **RTL** layout; LTR also supported
- Clean, modern, responsive UI built on the TropaTT design tokens —
  follows the active theme (light, dark, contrast, sepia, graphite)
- Keyboard navigation (arrows, Enter/Space, PageUp/PageDown, Home/End) and
  ARIA grid roles

**Date picker**
- Opens a Jalali calendar popover on input focus/click
- Visible input shows the Jalali date; a hidden mirror input keeps the
  original field `name` and submits the **Gregorian ISO value** — existing
  forms and handlers keep working unchanged
- `min` / `max` selectable range, arbitrary `disabled` day predicates
- Clear/reset button, configurable date format, read-only mode
- Typing support: `۱۴۰۵/۰۸/۰۹`, `1405/8/9`, `1405-08-09`, `۹ آبان ۱۴۰۵`
- Closes on selection, outside click and Escape; repositions on scroll/resize

**Date & time picker**
- Calendar plus hour/minute panel, 24-hour and 12-hour formats
  (ق.ظ / ب.ظ meridiem)
- Configurable minute step (1, 5, 10, 15, 30 …)
- Configurable minimum/maximum date-time (values are clamped into range)
- Today / Now / Clear / OK actions; the form receives `YYYY-MM-DDTHH:mm`

**Formatting utilities**
- Shared token language on client (JS) and server (PHP), byte-identical output
- `۱۴۰۵/۰۸/۰۹`, `۱۴۰۵-۰۸-۰۹`, `۹ آبان ۱۴۰۵`, `شنبه، ۹ آبان ۱۴۰۵`,
  `۱۴۰۵/۰۸/۰۹ - ۱۴:۳۰`, `۱۴:۳۰`, `۰۲:۳۰ ب.ظ`

**Integration**
- Global `window.CRM.PersianCalendar` library available on every page
- Opt-in autoformatting of existing date displays
- Server-rendered "today" widget on the dashboard and a month reference panel
  on the profile page (both can be disabled in configuration)
- REST endpoints and MCP tools for AI agents
- Module demo & playground page (menu → **Persian Calendar**)

---

## Architecture

```
modules/crm.persian-calendar/
├── manifest.json                 module declaration (assets, positions, config, MCP)
├── api/                          backend (pure computation, no tables)
│   ├── PersianCalendarServiceProvider.php
│   ├── config/routes.php         REST routes (mounted at /_module/crm.persian-calendar)
│   ├── controller/               read-only endpoints
│   ├── service/                  JalaliCalendar · PersianNumerals · JalaliFormatter
│   └── mcp/                      MCP tools for AI agents
└── web/                          frontend
    ├── config/routes.php         module page route
    ├── controller/               page controller (permission-gated)
    ├── position/                 dashboard widget + profile panel renderers
    ├── support/ModuleSettings.php   config accessor for render-time code
    ├── template/page/            demo/playground page
    ├── language/                 en-gb · fa-ir · ru-ru
    └── assets/
        ├── css/persian-calendar.css        theme-aware component styles
        ├── js/persian-calendar.js          global core library (every page)
        └── js/persian-calendar-page.js     demo page logic (route-scoped)
```

Design decisions, in brief:

| Decision | Why |
| --- | --- |
| **No Composer/npm packages** | TropaTT runs with zero runtime dependencies on shared hosting; modules must be drop-in. The Jalali conversion is implemented in ~100 lines of pure PHP/JS. |
| **Same algorithm in PHP and JS** | Server-rendered widgets need Jalali without client JS; pickers need instant interaction. Both implement the identical 33-year break-cycle algorithm and are locked together by shared test vectors. |
| **Global assets for the core library** | Formatting utilities must be callable from anywhere in the UI. The library is dependency-free, lazily initializes, and its route-scoped page logic is separate. |
| **No migrations** | The module never persists anything. Its only state is the standard `module_registry.config` JSON every module already owns. |
| **Value exchange at the boundary** | Pickers show Jalali but hand the application ISO values; displays show Jalali converted from the stored Gregorian. |

---

## Installation

### From the module ZIP (recommended)

1. Open **Administration → Modules → Install** in TropaTT.
2. Upload `crm.persian-calendar-1.0.0.zip` (a flat archive with
   `manifest.json` at the root) or use *Install from URL*.
3. Activate the module and assign the `module.persian-calendar.view`
   permission to the roles that should see it.

### Manual copy

```
cp -r crm.persian-calendar/  /path/to/tropatt/upload/modules/
```

Then open **Administration → Modules**, install and activate
`crm.persian-calendar`.

### Requirements

- TropaTT core `>=1.0.0` (module system with positions/assets)
- PHP `>=8.1` (standard extensions only)
- No database changes, no background jobs, no cron tasks

---

## Configuration

The module follows the standard TropaTT configuration flow: defaults are
declared in `manifest.json` (`config_defaults`), stored in
`module_registry.config`, and editable from
**Administration → Modules → crm.persian-calendar → Configuration**.

| Key | Default | Meaning |
| --- | --- | --- |
| `default_calendar` | `persian` | Calendar shown in the UI (reserved for future calendar modes) |
| `date_format` | `YYYY/MM/DD` | Default date pattern for pickers and formatting |
| `datetime_format` | `YYYY/MM/DD - HH:mm` | Default date-time pattern |
| `time_format` | `HH:mm` | Default time-only pattern |
| `hour_format` | `24h` | `24h` or `12h` for the time panel |
| `persian_numerals` | `true` | Render digits as ۰۱۲۳۴۵۶۷۸۹ (individual users can override it with the toggle on the module page, saved per browser) |
| `first_day_of_week` | `saturday` | Week layout start (شنبه) |
| `minute_step` | `5` | Minute options step in the time panel |
| `direction` | `rtl` | `rtl`, `ltr` or `auto` (follows the page direction) |
| `highlight_today` | `true` | Ring around the current date |
| `show_adjacent_days` | `true` | Leading/trailing days of neighbor months |
| `weekend_day` | `friday` | Tinted column (جمعه); `none` disables |
| `dashboard_widget_enabled` | `true` | "Today" card on the dashboard |
| `profile_panel_enabled` | `true` | Month reference panel on the profile page |
| `autoformat_enabled` | `true` | Jalali display of matched date elements (plus the app-wide display bridge: `CRM.br1.formatDate` and `Date.prototype.toLocaleDateString/toLocaleTimeString` are wrapped at runtime, and the team calendar page grid is re-stamped) |
| `autoformat_selectors` | `[data-crm-persian-date]`, `[datetime]` | Elements the autoformatter processes |

The frontend reads the configuration in this order:

1. compiled-in defaults (sensible Persian defaults),
2. `window.CRM.PersianCalendarConfig` (server-rendered override),
3. `GET /_module/crm.persian-calendar/config` — fetched once in the
   background by every page that loads the library.

Components re-read the effective configuration whenever they open, so a
configuration change applies on the next interaction without a reload.

---

## Using the components

Everything below lives in `window.CRM.PersianCalendar` (aliased as `PC` in the
examples). The library is dependency-free and available on every page of an
activated installation.

### 1. Date picker

Declarative — the module auto-attaches on page load:

```html
<input name="due_at" data-crm-persian-picker="date">
```

**Every `input[type=date]` and `input[type=datetime-local]` in the app gets
the Jalali picker automatically** (the native Gregorian picker is replaced;
`min`/`max` attributes are kept). Opt out per field with
`data-crm-persian-skip="1"`.

The visible input shows the Jalali date while the application keeps reading
and writing Gregorian ISO through every pattern it already uses — `.value`
(by id), `[name=…]` selectors, `FormData`, native submits — via a value
bridge on the input and its hidden mirror. Programmatic prefills written
from JS refresh the Jalali display automatically.

Programmatic:

```js
var PC = window.CRM.PersianCalendar;

var picker = PC.createDatePicker(document.querySelector('input[name=due_at]'), {
  min: '2026-01-01',          // inclusive, ISO
  max: '2026-12-31',
  disabled: function (cell) { // arbitrary predicate
    return cell.iso === '2026-10-29';
  },
  format: 'DD MMMM YYYY',     // display pattern (default from config)
  clearable: true,
  readOnly: false,
  persianNumerals: true,
  rtl: true
});
```

**Value exchange.** The user sees and types Jalali; the application receives
Gregorian ISO:

```js
picker.setIsoValue('2026-10-31');   // input now shows ۱۴۰۵/۰۸/۰۹
picker.getIsoValue();               // '2026-10-31'
picker.getJalaliValue();            // {jy: 1405, jm: 8, jd: 9}
picker.clear();
```

Because the picker moves the original `name` to a hidden mirror input, plain
HTML form posts keep carrying the ISO value:

```html
<!-- after attach -->
<input ... data-crm-persian-picker="date" value="۱۴۰۵/۰۸/۰۹">
<input type="hidden" name="due_at" value="2026-10-31">
```

Events (both bubble from the input):

```js
input.addEventListener('crm-persian-calendar:change', function (e) {
  console.log(e.detail.iso);     // '2026-10-31'  (what the app should store)
  console.log(e.detail.jalali);  // {jy: 1405, jm: 8, jd: 9}
});
// a native 'change' event is also dispatched for existing form handlers
```

### 2. Date & time picker

```html
<input name="reminder_at" data-crm-persian-picker="datetime">
```

```js
var dtPicker = PC.createDateTimePicker(input, {
  hourFormat: '24h',       // or '12h' (ق.ظ / ب.ظ)
  minuteStep: 15,          // 1 | 5 | 10 | 15 | 30 …
  min: '2026-10-01T09:00', // date-time bounds; out-of-range values are clamped
  max: '2026-12-31T21:00'
});

dtPicker.setIsoValue('2026-10-31T14:30'); // shows ۱۴۰۵/۰۸/۰۹ - ۱۴:۳۰
dtPicker.getIsoValue();                   // '2026-10-31T14:30'
```

The time panel appears above the footer; a day click keeps the popover open
until **تأیید** (OK), so the user can adjust the time. **اکنون** (Now) sets
the current moment, **پاک کردن** clears.

### 3. Inline calendar

```js
var calendar = PC.createCalendar(document.getElementById('calendarHost'), {
  selected: '2026-10-31',
  min: '2026-01-01',
  max: '2026-12-31',
  onSelect: function (payload) {
    console.log(payload.iso);  // '2026-11-16'
    console.log(payload.jy, payload.jm, payload.jd);  // 1405 8 25
  }
});

calendar.nextMonth();
calendar.prevYear();
calendar.goToday();
calendar.setSelected('2026-03-21');
calendar.destroy();
```

Keyboard support: focus the grid, then use the arrow keys (RTL-aware),
`Enter`/`Space` to select, `PageUp`/`PageDown` to change months,
`Home`/`End` for week edges.

### 4. Formatting utilities

```js
PC.format('2026-10-31', 'YYYY/MM/DD');        // ۱۴۰۵/۰۸/۰۹
PC.format('2026-10-31', 'YYYY-MM-DD');        // ۱۴۰۵-۰۸-۰۹
PC.format('2026-10-31', 'DD MMMM YYYY');      // ۹ آبان ۱۴۰۵
PC.format('2026-10-31', 'WD، DD MMMM YYYY');  // شنبه، ۹ آبان ۱۴۰۵
PC.format('2026-10-31T14:30', 'YYYY/MM/DD - HH:mm');  // ۱۴۰۵/۰۸/۰۹ - ۱۴:۳۰
PC.format('2026-10-31T14:30', 'hh:mm a');     // ۰۲:۳۰ ب.ظ
PC.format('2026-10-31', 'YYYY/MM/DD', { persianNumerals: false });  // 1405/08/09
```

Accepted inputs: ISO dates `'2026-10-31'`, ISO date-times
`'2026-10-31T14:30[:ss]'`, `Date` objects (local components), Jalali objects
`{jy, jm, jd, h, m}` and Jalali strings `'۱۴۰۵/۰۸/۰۹'`.

**Token reference** (identical in JS and PHP):

| Token | Meaning | Example |
| --- | --- | --- |
| `YYYY` / `YY` | Jalali year (4 / 2 digits) | `۱۴۰۵` / `۰۵` |
| `MMMM` / `MMM` | Persian month name | `آبان` |
| `MM` / `M` | Month (padded / plain) | `۰۸` / `۸` |
| `DD` / `D` | Day (padded / plain)¹ | `۰۹` / `۹` |
| `WD` / `W` | Weekday (full / one letter) | `شنبه` / `ش` |
| `HH` / `H` | Hour, 24h | `۱۴` |
| `hh` / `h` | Hour, 12h | `۰۲` |
| `mm` / `m` | Minute | `۳۰` |
| `ss` | Second | `۰۰` |
| `a` / `A` | Persian meridiem | `ق.ظ` / `قبل‌ازظهر` |
| `'…'` | Literal text | `'Year' YYYY` → `Year ۱۴۰۵` |

¹ Persian typography never zero-pads the day before a month name, so `DD`
directly followed by `MMMM`/`MMM` renders unpadded — exactly as the
specification examples show (`DD MMMM YYYY` → `۹ آبان ۱۴۰۵`).

Presets: `PC.formats.SHORT`, `.ISO`, `.LONG`, `.FULL`, `.DATETIME`, `.TIME`,
`.TIME_12`.

### 5. Conversion utilities

```js
PC.toJalali('2026-10-31');          // {jy: 1405, jm: 8, jd: 9}
PC.toGregorian(1405, 8, 9);         // {gy: 2026, gm: 10, gd: 31}
PC.jalaliToIso(1405, 8, 9);         // '2026-10-31'
PC.isoToJalali('2026-10-31');       // {jy: 1405, jm: 8, jd: 9}
PC.isLeapJalali(1403);              // true  (Esfand has 30 days)
PC.jalaliMonthLength(1405, 8);      // 30
PC.isValidJalali(1405, 13, 1);      // false
PC.todayJalali();                   // {jy, jm, jd}
PC.jalaliWeekdayIndex(1405, 8, 9);  // 0 (شنبه … جمعه = 0…6)
PC.monthGrid(1405, 8, true);        // weeks of cells with jalali+iso+weekday
PC.parseJalali('۹ آبان ۱۴۰۵');      // {jy: 1405, jm: 8, jd: 9}
PC.toPersianDigits('1405');         // '۱۴۰۵'
PC.toLatinDigits('۱۴۰۵');           // '1405'
```

Supported Jalali year range: **1178–3177** (Gregorian 1799–3801).

### 6. Autoformatting existing date displays

On by default (`autoformat_enabled: true`). The module also wraps
the core's shared formatters (`CRM.br1.formatDate`,
`Date.prototype.toLocaleDateString`, `toLocaleTimeString`) so every deadline,
timestamp, agenda entry and calendar label in the UI renders as Jalali
without touching core files. Turn the config off to restore pure Gregorian
display.

Per-element (works with the default `autoformat_enabled: false`):

```html
<!-- text content is converted -->
<span data-crm-persian-date>2026-10-31</span>

<!-- or provide the machine value in the attribute -->
<span data-crm-persian-date="2026-10-31">…</span>

<!-- standard <time> elements: the datetime attribute is preserved,
     only the visible text is localized -->
<time datetime="2026-03-21T14:30">2026-03-21T14:30</time>

<!-- optional display pattern -->
<span data-crm-persian-date="2026-10-31" data-crm-persian-format="DD MMMM YYYY"></span>
```

```js
PC.autoformat.scan(document);   // one-shot scan
PC.autoformat.enable();         // scan + MutationObserver for dynamic content
PC.autoformat.disable();
```

Global mode — set `autoformat_enabled: true` in the module configuration.
The selectors come from `autoformat_selectors` and the scan re-runs (debounced)
for dynamically rendered content. The original Gregorian value is always kept
in `data-crm-persian-original`, and the module never touches elements inside
its own pickers.

---

## Server-side (PHP) API

```php
use Module\Crm\PersianCalendar\Service\JalaliCalendar;
use Module\Crm\PersianCalendar\Service\JalaliFormatter;
use Module\Crm\PersianCalendar\Service\PersianNumerals;

$j = JalaliCalendar::toJalali(2026, 10, 31);       // ['jy' => 1405, 'jm' => 8, 'jd' => 9]
$g = JalaliCalendar::toGregorian(1405, 8, 9);      // ['gy' => 2026, 'gm' => 10, 'gd' => 31]
$iso = JalaliCalendar::jalaliToIso(1405, 8, 9);    // '2026-10-31'
$j2 = JalaliCalendar::isoToJalali('2026-10-31');   // ['jy' => 1405, ...]
JalaliCalendar::isLeap(1403);                      // true
JalaliCalendar::monthLength(1403, 12);             // 30
JalaliCalendar::isValid(1405, 13, 1);              // false
JalaliCalendar::today();                           // today's Jalali date
JalaliCalendar::weekdayIndex(2026, 10, 31);        // 0 (شنبه = 0 … جمعه = 6)
JalaliCalendar::monthGrid(1405, 8);                // full month grid (see REST /month)
JalaliCalendar::monthName(8);                      // 'آبان'
JalaliCalendar::weekdayName(0);                    // 'شنبه'

JalaliFormatter::format('2026-10-31', 'DD MMMM YYYY');        // '۹ آبان ۱۴۰۵'
JalaliFormatter::format('2026-10-31 14:30:00', 'HH:mm');      // '۱۴:۳۰'
JalaliFormatter::formatDate('2026-10-31');                    // '۱۴۰۵/۰۸/۰۹'
JalaliFormatter::formatDateTime('2026-10-31 14:30:00');       // '۱۴۰۵/۰۸/۰۹ - ۱۴:۳۰'
JalaliFormatter::parseJalali('۱۴۰۵/۰۸/۰۹');                   // ['jy' => 1405, ...]

PersianNumerals::toPersian('1405');                 // '۱۴۰۵'
PersianNumerals::toLatin('۱۴۰۵');                   // '1405'
```

The classes are pure and static: no database, no I/O, safe to use from any
module hook, controller, cron handler or template.

---

## REST endpoints

Mounted by the core under `/_module/crm.persian-calendar/…`; authenticated
sessions only, read-only, `workspace_required` is false (pure math, no tenant
data).

| Endpoint | Purpose |
| --- | --- |
| `GET /config` | effective display configuration |
| `GET /today` | today in both calendars + ready-to-render strings |
| `GET /convert/g2j?date=2026-10-31` | Gregorian → Jalali |
| `GET /convert/j2g?jy=1405&jm=8&jd=9` or `?date=۱۴۰۵/۰۸/۰۹` | Jalali → Gregorian |
| `GET /month?jy=1405&jm=8&with_adjacent=1` | month grid exactly as the UI lays it out |
| `GET /format?date=2026-10-31T14:30&pattern=DD MMMM YYYY&persian_numerals=1` | formatting |

From the browser (same pattern as every TropaTT module):

```js
window.CRM.api.request('_module/crm.persian-calendar/convert/g2j', {
  method: 'GET'
}).then(function (envelope) {
  console.log(envelope.data.jalali);   // {jy: 1405, jm: 8, jd: 9}
});
```

---

## MCP tools for AI agents

Declared in the manifest, discoverable with the `all` / `modules` /
`module:crm.persian-calendar` toolsets.

- **`persian_calendar_today`** — current date in both calendars with the
  localized names and display strings.
- **`persian_calendar_convert`** — bidirectional conversion. `direction`
  defaults to `auto`: `'2026-03-21'` is treated as Gregorian, `'1405/01/01'`
  (or explicit `jy/jm/jd`) as Jalali; force it with `g2j` / `j2g`.

Both are pure computation and need no workspace context.

---

## Position slots (UI integration points)

The module registers two renderers (both server-rendered, so they work
without JavaScript, and both gated by configuration):

| Slot | Renderer | Setting |
| --- | --- | --- |
| `dashboard.content.after` | `Position\DashboardTodayWidget` — weekday, Jalali date, long form, month progress | `dashboard_widget_enabled` |
| `profile.content.after` | `Position\ProfilePersianDatePanel` — current Jalali month mini-grid with today marked | `profile_panel_enabled` |

Other modules can render into the same slots independently; the position
system keeps them isolated.

---

## Localization & RTL

- The calendar itself always uses the Persian calendar system (Persian month
  and weekday names from the library constants), independent of the UI locale.
- Widget chrome (buttons, labels, tooltips, placeholders) is translated
  through the standard module language files
  (`web/language/{en-gb,fa-ir,ru-ru}.php`, namespace `module_persian_calendar`)
  and resolves via `window.CRM.i18n` / the server-side `$t()`.
- Direction defaults to `rtl` and can be forced to `ltr` or `auto`
  (follows the page's `dir`). Inputs, popovers and the inline calendar all
  set their own `dir`, so they render correctly on any page.
- Persian digits are used by default everywhere (`persian_numerals: false`
  switches to Latin digits).
- Styles are written with logical properties (`inline-size`, `margin-inline`)
  and consume the TropaTT design tokens, so light, dark, contrast, sepia and
  the graphite palette all work automatically.

---

## Storage & database guarantees

This module does **not**:

- create tables (no `migrations/` directory, no SQL),
- touch existing tables, columns or migrations,
- modify backend date/time storage or parsing logic,
- alter existing API contracts,
- modify core files, routes or templates.

Its only state is the standard module configuration row
(`module_registry.config`) managed by the core module system — the same
mechanism every TropaTT module uses. Removing the module leaves zero traces
in the data model.

---

## Library & algorithm notes

TropaTT ships with **no Composer/npm runtime dependencies** (a deliberate
shared-hosting constraint), so installing e.g. `jalaali-js` or
`dayjs` + a Jalali plugin through a package manager is not compatible with
the module architecture. Instead, this module implements the conversion
directly:

- **Algorithm**: the standard 33-year break-cycle arithmetic of the Solar
  Hijri calendar — the same well-tested algorithm used by `jalaali-js`
  (MIT). ~100 lines of pure integer math, identical in PHP and JS.
- **Validation**: every conversion is cross-checked against an independent
  oracle (ICU's Persian calendar via Node's `Intl`) for all days of Jalali
  years 1390–1420, plus round-trips over 1340–1470 (see [Testing](#testing)).
- **Bundle cost**: the whole client library is a single ~74 KB unminified
  file (comments included), no dependencies, no build step — in line with
  the size of the CRM's own page scripts.

If a future TropaTT core ever adopts a package manager, the conversion layer
is isolated in one file per language and can be swapped for a library without
touching the components.

---

## Testing

```bash
php tests/php/persian_calendar_test.php
php tests/php/module_integration_test.php
php tests/php/template_render_test.php
node --test tests/js/persian_calendar_core_test.mjs
node --test tests/js/picker_value_bridge_test.mjs
```

| Suite | What it covers |
| --- | --- |
| `tests/php/persian_calendar_test.php` | 50k+ checks: shared vectors, round-trips 1340–1470, Nowruz anchors, leap list 1300–1500, month lengths, weekday alignment, numerals, formatter, parser |
| `tests/php/module_integration_test.php` | position renderers, settings fallback, REST controller, MCP tools — runs against the **real TropaTT core classes** when a `upload/` directory is passed (`TROPATT_UPLOAD=…`), otherwise against bundled stubs |
| `tests/php/template_render_test.php` | demo page template renders without notices, balanced tags, nonce'd config script |
| `tests/js/persian_calendar_core_test.mjs` | the same vector set for the JS engine **cross-validated day-by-day against ICU's Persian calendar (1390–1420)**, plus formatting, parsing, month-grid and config-merge tests |

`tests/data/conversion_vectors.json` is the shared fixture consumed by both
language suites — the PHP and JS implementations are locked to identical
output.

Special attention in the suites: Nowruz boundaries (2015–2040), leap years
including the 1403→1408 five-year gap, Esfand 29/30 transitions, year
boundaries, weekday alignment (e.g. 2026-10-31 = شنبه), min/max clamping and
the ISO value handoff to forms.

### Manual & visual testing

The module page (**Persian Calendar** in the menu) doubles as a manual test
surface: live calendar, picker with form value display, restricted picker,
read-only picker, date-time picker, both conversion directions, formatting
showcase and the active configuration. During development the components were
additionally exercised in a headless browser across RTL/LTR, light/dark,
mobile viewports and full keyboard interaction.

---

## File structure

```
crm.persian-calendar/
├── manifest.json
├── README.md                                    this file
├── api/
│   ├── PersianCalendarServiceProvider.php
│   ├── config/routes.php
│   ├── controller/PersianCalendarApiController.php
│   ├── service/{JalaliCalendar,PersianNumerals,JalaliFormatter}.php
│   └── mcp/{TodayTool,ConvertTool}.php
├── tests/
│   ├── data/{conversion_vectors,leap_years}.json
│   ├── php/{persian_calendar_test,module_integration_test,template_render_test}.php
│   └── js/{persian_calendar_core_test,picker_value_bridge_test}.mjs
└── web/
    ├── config/routes.php
    ├── controller/PersianCalendarPageController.php
    ├── position/{DashboardTodayWidget,ProfilePersianDatePanel}.php
    ├── support/ModuleSettings.php
    ├── template/page/persian_calendar.php
    ├── language/{en-gb,fa-ir,ru-ru}.php
    └── assets/
        ├── css/persian-calendar.css
        └── js/{persian-calendar.js,persian-calendar-page.js}
```

---

## Uninstalling

**Administration → Modules → crm.persian-calendar → Uninstall.** No rollback
scripts are needed because the module creates no schema. Forms that used the
pickers fall back to plain inputs; stored data was never touched.

---

## Credits & license

- Module code: AGPL-3.0 (same as the TropaTT core).
- Conversion algorithm: the 33-year break-cycle formulation popularized by
  [jalaali-js](https://github.com/jalaali/jalaali-js) (MIT), reimplemented
  from the published algorithm — cross-validated against ICU.
- Month/weekday names and meridiem forms follow standard Persian calendar
  conventions (ق.ظ / ب.ظ).
