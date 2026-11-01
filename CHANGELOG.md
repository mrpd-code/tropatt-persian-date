# Changelog

All notable changes to the `crm.persian-calendar` module are documented here.
The module follows a Keep a Changelog style; versions match `manifest.json`.

## [1.0.0] - 2026-11-01

### Added

- Jalali (Shamsi) ⇄ Gregorian conversion core, implemented identically in
  PHP and JS (33-year break-cycle algorithm, cross-validated day-by-day
  against ICU for Jalali years 1390–1420 and round-tripped over 1340–1470).
- Inline Jalali month calendar, date picker and date & time picker:
  RTL layout, Persian numerals, keyboard navigation, min/max constraints,
  12/24-hour time panel, theming via the TropaTT design tokens.
- Auto-attach to every `input[type=date]` / `input[type=datetime-local]`
  (opt-out per field with `data-crm-persian-skip="1"`): the native Gregorian
  picker is replaced and a value bridge keeps `.value` (by id), `[name=…]`
  selectors, `FormData` and native submits carrying the Gregorian ISO value —
  the saving flow stays untouched while the user sees and types Jalali.
- App-wide display bridge: `CRM.br1.formatDate`,
  `Date.prototype.toLocaleDateString` and `toLocaleTimeString` are wrapped at
  runtime so deadlines, timestamps, agenda entries and labels render as
  Jalali everywhere without modifying core files.
- Team calendar page (events, meetings, deadlines): month-grid day numbers,
  day/week column heads and the weekday header row are re-stamped to Jalali
  after every render.
- Persian vs Latin digit option: module configuration (`persian_numerals`)
  plus a per-user toggle on the module page (saved per browser only).
- Input disambiguation: numeric years past 1500 are always read as Gregorian,
  so pasting a stored ISO date keeps its meaning instead of being read as a
  Jalali year.
- Server-rendered "today" dashboard widget and profile month panel
  (both can be disabled in configuration).
- REST endpoints under `/_module/crm.persian-calendar/` and MCP tools
  (`persian_calendar_today`, `persian_calendar_convert`).
- Demo & playground page (menu → Persian Calendar).
- Test suites: PHP conversion unit tests (50k+ checks), JS core tests
  cross-validated against ICU, and a fake-DOM suite covering the picker
  value bridge and auto-attach behavior.
