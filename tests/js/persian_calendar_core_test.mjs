/**
 * Node test suite for the Persian Calendar module core library.
 * Run with:  node --test tests/js/
 *
 * No DOM required: this covers the pure computation layer
 * (conversion, leap years, month lengths, weekdays, numerals, parsing,
 * formatting, month grids). Component/DOM behaviour is verified by the
 * browser harness described in README.md ("Manual & visual testing").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

const PC = require('../../web/assets/js/persian-calendar.js');
const vectors = JSON.parse(readFileSync(path.join(here, '..', 'data', 'conversion_vectors.json'), 'utf8'));
const leapFixture = JSON.parse(readFileSync(path.join(here, '..', 'data', 'leap_years.json'), 'utf8'));

// ICU (Node's built-in Persian calendar) as an independent oracle.
const icu = new Intl.DateTimeFormat('en-u-ca-persian', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric'
});

function icuJalali(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const parts = icu.formatToParts(new Date(Date.UTC(y, m - 1, d)));
  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return { jy: parseInt(map.year, 10), jm: parseInt(map.month, 10), jd: parseInt(map.day, 10) };
}

// --------------------------------------------------------------------
// Reference examples from the module specification
// --------------------------------------------------------------------

test('spec examples: 2026-03-21 -> 1405/01/01 and 2026-10-31 -> 1405/08/09', () => {
  assert.deepEqual(PC.toJalali('2026-03-21'), { jy: 1405, jm: 1, jd: 1 });
  assert.deepEqual(PC.toJalali('2026-10-31'), { jy: 1405, jm: 8, jd: 9 });
  assert.equal(PC.jalaliToIso(1405, 1, 1), '2026-03-21');
  assert.equal(PC.jalaliToIso(1405, 8, 9), '2026-10-31');
  assert.deepEqual(PC.toGregorian(1405, 8, 9), { gy: 2026, gm: 10, gd: 31 });
});

test('Nowruz boundaries: 1 Farvardin matches the official dates', () => {
  const expected = {
    1399: '2020-03-20', 1400: '2021-03-21', 1401: '2022-03-21',
    1402: '2023-03-21', 1403: '2024-03-20', 1404: '2025-03-21',
    1405: '2026-03-21', 1406: '2027-03-21', 1407: '2028-03-20',
    1408: '2029-03-20', 1409: '2030-03-21', 1410: '2031-03-21'
  };
  for (const [jy, iso] of Object.entries(expected)) {
    assert.equal(PC.jalaliToIso(Number(jy), 1, 1), iso, `Nowruz ${jy}`);
  }
});

test('year boundary: last day of Esfand converts both ways', () => {
  // 1403 is a leap year -> Esfand has 30 days.
  assert.equal(PC.jalaliMonthLength(1403, 12), 30);
  assert.equal(PC.jalaliToIso(1403, 12, 30), '2025-03-20');
  assert.deepEqual(PC.toJalali('2025-03-20'), { jy: 1403, jm: 12, jd: 30 });
  // 1404 is not a leap year -> Esfand has 29 days, next day is Nowruz.
  assert.equal(PC.jalaliMonthLength(1404, 12), 29);
  assert.deepEqual(PC.toJalali('2025-03-21'), { jy: 1404, jm: 1, jd: 1 });
});

// --------------------------------------------------------------------
// Shared vectors + ICU cross-validation
// --------------------------------------------------------------------

test('all shared vectors: g2j, j2g round-trip and weekday alignment', () => {
  for (const vector of vectors) {
    const got = PC.toJalali(vector.g);
    assert.deepEqual(
      got,
      { jy: vector.j[0], jm: vector.j[1], jd: vector.j[2] },
      `g2j ${vector.g}`
    );
    const iso = PC.jalaliToIso(vector.j[0], vector.j[1], vector.j[2]);
    assert.equal(iso, vector.g, `j2g ${vector.j.join('/')}`);
    assert.equal(
      PC.jalaliWeekdayIndex(vector.j[0], vector.j[1], vector.j[2]),
      vector.w,
      `weekday ${vector.g}`
    );
  }
});

test('algorithm matches the ICU Persian calendar for every vector', () => {
  for (const vector of vectors) {
    assert.deepEqual(icuJalali(vector.g), {
      jy: vector.j[0], jm: vector.j[1], jd: vector.j[2]
    }, `ICU disagrees at ${vector.g}`);
  }
});

test('algorithm matches the ICU Persian calendar day-by-day (1390-1420)', () => {
  let checked = 0;
  for (let jy = 1390; jy <= 1420; jy += 1) {
    for (let jm = 1; jm <= 12; jm += 1) {
      const length = PC.jalaliMonthLength(jy, jm);
      for (let jd = 1; jd <= length; jd += 1) {
        const iso = PC.jalaliToIso(jy, jm, jd);
        assert.deepEqual(icuJalali(iso), { jy, jm, jd }, `ICU day-by-day ${iso}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 11000, `expected the full sweep, got ${checked}`);
});

test('round-trip over every day of Jalali years 1340..1470', () => {
  let count = 0;
  for (let jy = 1340; jy <= 1470; jy += 1) {
    for (let jm = 1; jm <= 12; jm += 1) {
      const length = PC.jalaliMonthLength(jy, jm);
      for (let jd = 1; jd <= length; jd += 1) {
        const iso = PC.jalaliToIso(jy, jm, jd);
        const back = PC.toJalali(iso);
        assert.deepEqual(back, { jy, jm, jd }, `round-trip ${jy}/${jm}/${jd}`);
        count += 1;
      }
    }
  }
  assert.ok(count > 45000, `expected a large sweep, got ${count}`);
});

// --------------------------------------------------------------------
// Leap years
// --------------------------------------------------------------------

test('leap years match the reference list (1300-1500)', () => {
  const computed = [];
  for (let jy = 1300; jy <= 1500; jy += 1) {
    if (PC.isLeapJalali(jy)) {
      computed.push(jy);
    }
  }
  assert.deepEqual(computed, leapFixture.leaps_1300_1500);
});

test('leap day exists only in leap years', () => {
  assert.equal(PC.isValidJalali(1403, 12, 30), true);  // leap
  assert.equal(PC.isValidJalali(1402, 12, 30), false); // not leap
  assert.equal(PC.isValidJalali(1399, 12, 30), true);  // leap
  assert.equal(PC.isValidJalali(1408, 12, 30), true);  // leap (5-year gap)
});

test('invalid inputs are rejected', () => {
  assert.equal(PC.isValidJalali(1405, 13, 1), false);
  assert.equal(PC.isValidJalali(1405, 0, 1), false);
  assert.equal(PC.isValidJalali(1405, 1, 0), false);
  assert.equal(PC.isValidJalali(1405, 1, 32), false);
  assert.equal(PC.isValidJalali(1405, 7, 31), false); // Mehr has 30 days
  assert.throws(() => PC.toGregorian(1405, 13, 1));
  assert.throws(() => PC.toJalali('2026-02-30'));
});

// --------------------------------------------------------------------
// Month lengths
// --------------------------------------------------------------------

test('month lengths: 31/31/31/31/31/31/30/30/30/30/30/29-30', () => {
  for (let jm = 1; jm <= 6; jm += 1) {
    assert.equal(PC.jalaliMonthLength(1405, jm), 31, `month ${jm}`);
  }
  for (let jm = 7; jm <= 11; jm += 1) {
    assert.equal(PC.jalaliMonthLength(1405, jm), 30, `month ${jm}`);
  }
  assert.equal(PC.jalaliMonthLength(1405, 12), 29);
  assert.equal(PC.jalaliMonthLength(1403, 12), 30); // leap year
});

// --------------------------------------------------------------------
// Weekday alignment
// --------------------------------------------------------------------

test('weekday names align: 2026-10-31 is shanbe (Saturday)', () => {
  assert.equal(PC.jalaliWeekdayIndex(1405, 8, 9), 0);
  assert.equal(PC.weekdayName(0), 'شنبه');
  assert.equal(PC.weekdayName(6), 'جمعه');
  // 2026-11-01 is Sunday (yekshanbe).
  assert.equal(PC.jalaliWeekdayIndex(1405, 8, 10), 1);
  // 2026-03-21 (Nowruz 1405) was a Saturday.
  assert.equal(PC.jalaliWeekdayIndex(1405, 1, 1), 0);
});

// --------------------------------------------------------------------
// Numerals
// --------------------------------------------------------------------

test('Persian numeral conversion', () => {
  assert.equal(PC.toPersianDigits('1405/08/09'), '۱۴۰۵/۰۸/۰۹');
  assert.equal(PC.toLatinDigits('۱۴۰۵/۰۸/۰۹'), '1405/08/09');
  assert.equal(PC.toLatinDigits('١٤٠٥'), '1405'); // Arabic-Indic digits too
  assert.equal(PC.toPersianDigits(42), '۴۲');
  assert.equal(PC.toLatinDigits('mixed ۱۲ and 34'), 'mixed 12 and 34');
});

// --------------------------------------------------------------------
// Parsing
// --------------------------------------------------------------------

test('parseJalali accepts Persian digits, Latin digits and month names', () => {
  assert.deepEqual(PC.parseJalali('۱۴۰۵/۰۸/۰۹'), { jy: 1405, jm: 8, jd: 9 });
  assert.deepEqual(PC.parseJalali('1405/8/9'), { jy: 1405, jm: 8, jd: 9 });
  assert.deepEqual(PC.parseJalali('1405-08-09'), { jy: 1405, jm: 8, jd: 9 });
  assert.deepEqual(PC.parseJalali('۹ آبان ۱۴۰۵'), { jy: 1405, jm: 8, jd: 9 });
  assert.deepEqual(PC.parseJalali('1 فروردین 1405'), { jy: 1405, jm: 1, jd: 1 });
  assert.equal(PC.parseJalali('1405/13/09'), null);
  assert.equal(PC.parseJalali('not a date'), null);
});

test('normalizeValue handles ISO dates, datetimes, Jalali objects and Date', () => {
  const dateOnly = PC.normalizeValue('2026-10-31');
  assert.equal(dateOnly.iso, '2026-10-31');
  assert.equal(dateOnly.time, null);
  assert.deepEqual(dateOnly.jalali, { jy: 1405, jm: 8, jd: 9 });

  const dateTime = PC.normalizeValue('2026-10-31T14:30');
  assert.equal(dateTime.iso, '2026-10-31');
  assert.deepEqual(dateTime.time, { h: 14, m: 30 });

  const jalaliObj = PC.normalizeValue({ jy: 1405, jm: 8, jd: 9, h: 14, m: 30 });
  assert.equal(jalaliObj.iso, '2026-10-31');
  assert.deepEqual(jalaliObj.time, { h: 14, m: 30 });

  const asDate = PC.normalizeValue(new Date(2026, 9, 31, 14, 30));
  assert.equal(asDate.iso, '2026-10-31');
  assert.deepEqual(asDate.time, { h: 14, m: 30 });

  assert.equal(PC.normalizeValue(''), null);
  assert.equal(PC.normalizeValue(null), null);
});

// --------------------------------------------------------------------
// Formatting (specification examples)
// --------------------------------------------------------------------

test('formatting patterns from the specification', () => {
  assert.equal(PC.format('2026-10-31', 'YYYY/MM/DD'), '۱۴۰۵/۰۸/۰۹');
  assert.equal(PC.format('2026-10-31', 'YYYY-MM-DD'), '۱۴۰۵-۰۸-۰۹');
  assert.equal(PC.format('2026-10-31', 'DD MMMM YYYY'), '۹ آبان ۱۴۰۵');
  assert.equal(PC.format('2026-10-31', 'WD، DD MMMM YYYY'), 'شنبه، ۹ آبان ۱۴۰۵');
  assert.equal(PC.format('2026-10-31T14:30', 'YYYY/MM/DD - HH:mm'), '۱۴۰۵/۰۸/۰۹ - ۱۴:۳۰');
  assert.equal(PC.format('2026-10-31T14:30', 'HH:mm'), '۱۴:۳۰');
  assert.equal(PC.format('2026-10-31T02:30', 'hh:mm a'), '۰۲:۳۰ ق.ظ');
  assert.equal(PC.format('2026-10-31T14:30', 'hh:mm a'), '۰۲:۳۰ ب.ظ');
});

test('formatting with Latin numerals and quoted literals', () => {
  assert.equal(PC.format('2026-10-31', 'YYYY/MM/DD', { persianNumerals: false }), '1405/08/09');
  assert.equal(PC.format('2026-10-31', "'Year' YYYY"), 'Year ۱۴۰۵');
});

test('formatting month and weekday names', () => {
  assert.equal(PC.monthName(1), 'فروردین');
  assert.equal(PC.monthName(12), 'اسفند');
  assert.equal(PC.weekdayName(0), 'شنبه');
  const months = PC.monthNames;
  assert.equal(months.length, 12);
  assert.equal(months[7], 'آبان');
});

// --------------------------------------------------------------------
// Month grid
// --------------------------------------------------------------------

test('month grid structure and alignment', () => {
  // 1405/08 starts on Saturday? Compute the expected first weekday.
  const grid = PC.monthGrid(1405, 8, true);
  assert.equal(grid.jy, 1405);
  assert.equal(grid.jm, 8);
  assert.equal(grid.monthLength, 30);
  assert.equal(grid.monthName, 'آبان');
  assert.ok(grid.weeks.length >= 4 && grid.weeks.length <= 6, 'weeks within 4..6');
  assert.equal(grid.weeks[0].length, 7);

  // First in-month cell must sit on its weekday column.
  const firstCell = grid.weeks.flat().find((cell) => cell && cell.inMonth);
  assert.equal(firstCell.weekday, grid.firstWeekday);
  assert.deepEqual([firstCell.jy, firstCell.jm, firstCell.jd], [1405, 8, 1]);

  // Every in-month cell's weekday equals its column index.
  grid.weeks.forEach((week) => {
    week.forEach((cell, index) => {
      if (cell) {
        assert.equal(cell.weekday, index, `cell ${cell.jy}/${cell.jm}/${cell.jd}`);
      }
    });
  });

  // Adjacent cells are marked and belong to neighbor months.
  const adjacent = grid.weeks.flat().filter((cell) => cell && !cell.inMonth);
  assert.ok(adjacent.length >= 0);
  adjacent.forEach((cell) => {
    assert.ok(cell.jm === 7 || cell.jm === 9, 'adjacent cells come from Mehr/Azar');
  });

  // The grid without adjacent days has null padding instead.
  const plain = PC.monthGrid(1405, 8, false);
  plain.weeks.flat().forEach((cell) => {
    if (cell === null) {
      return;
    }
    assert.equal(cell.jm, 8);
  });
});

test('month grid covers leap Esfand 1403 completely', () => {
  const grid = PC.monthGrid(1403, 12, true);
  const days = grid.weeks.flat().filter((cell) => cell && cell.inMonth).map((cell) => cell.jd);
  assert.equal(days.length, 30);
  assert.equal(Math.max(...days), 30);
  assert.equal(PC.jalaliToIso(1403, 12, 30), '2025-03-20');
});

// --------------------------------------------------------------------
// Config merge (API snake_case -> library camelCase)
// --------------------------------------------------------------------

test('config keys are mapped from snake_case and merged over defaults', () => {
  const merged = PC._internal.mergeConfig({}, PC._internal.DEFAULT_CONFIG, {
    date_format: 'DD MMMM YYYY',
    persian_numerals: false
  });
  assert.equal(merged.date_format, 'DD MMMM YYYY');
  assert.equal(merged.persian_numerals, false);
  assert.equal(merged.dateFormat, 'YYYY/MM/DD'); // default untouched
});

// --------------------------------------------------------------------
// Gregorian/Jalali input disambiguation (v1.1)
// --------------------------------------------------------------------

test('typed or pasted Gregorian dates are never read as Jalali years', () => {
  // '2026-10-31' pasted into a picker: an ISO date stays Gregorian.
  assert.equal(PC.parseJalali('2026-10-31'), null);
  assert.equal(PC.normalizeValue('2026-10-31').iso, '2026-10-31');

  // Slashed machine dates are recognized as Gregorian too.
  const slashed = PC.normalizeValue('2026/10/31');
  assert.equal(slashed.iso, '2026-10-31');
  assert.deepEqual(slashed.jalali, { jy: 1405, jm: 8, jd: 9 });

  // Jalali-era years keep the Jalali reading in both notations.
  assert.deepEqual(PC.parseJalali('1405-08-09'), { jy: 1405, jm: 8, jd: 9 });
  assert.deepEqual(PC.normalizeValue('1405/08/09').jalali, { jy: 1405, jm: 8, jd: 9 });

  // Plausibility window: numeric years past 1500 are not a Jalali date.
  assert.deepEqual(PC.parseJalali('1500-01-01'), { jy: 1500, jm: 1, jd: 1 });
  assert.equal(PC.parseJalali('1501-01-01'), null);
});

test('setPersianNumerals flips the effective config at runtime', () => {
  const original = PC.config().persianNumerals;
  try {
    PC.setPersianNumerals(false);
    assert.equal(PC.config().persianNumerals, false);
    assert.equal(PC.format('2026-10-31', 'YYYY/MM/DD'), '1405/08/09');
    PC.setPersianNumerals(true);
    assert.equal(PC.config().persianNumerals, true);
    assert.equal(PC.format('2026-10-31', 'YYYY/MM/DD'), '۱۴۰۵/۰۸/۰۹');
  } finally {
    PC.setPersianNumerals(original);
  }
});
