/**
 * Persian (Jalali / Shamsi) Calendar & Date/Time library for TropaTT.
 * Module: crm.persian-calendar
 *
 * Presentation-only: this library converts between the Persian calendar the
 * user sees and the Gregorian / ISO-8601 values TropaTT already stores.
 * It never writes anywhere and has no runtime dependencies.
 *
 * Exposed as window.CRM.PersianCalendar (browser) / module.exports (Node,
 * used by tests/js). Sections:
 *   1. Jalali <-> Gregorian conversion (33-year break cycle, the standard
 *      algorithm used by jalaali-js; validated against ICU in tests)
 *   2. Persian numerals
 *   3. Parsing
 *   4. Formatting (token language mirrored 1:1 by the PHP JalaliFormatter)
 *   5. Configuration (compiled defaults -> window.CRM.PersianCalendarConfig
 *      -> module API /config)
 *   6. Calendar component (inline month grid)
 *   7. DatePicker (popover)
 *   8. DateTimePicker (popover with time panel)
 *   9. Autoformat (opt-in re-formatting of displayed dates)
 *  10. Auto-init for data-crm-persian-picker inputs
 */
(function (root, factory) {
  'use strict';

  var api = factory(root);

  if (typeof module === 'object' && module.exports) {
    module.exports = api; // Node test harness
  }
  root.CRM = root.CRM || {};
  root.CRM.PersianCalendar = api;
}(typeof self !== 'undefined' ? self : globalThis, function (root) {
  'use strict';

  var MODULE_NAME = 'crm.persian-calendar';
  var API_ROUTE = '_module/' + MODULE_NAME + '/config';
  var VERSION = '1.0.0';

  // ==================================================================
  // 1. Jalali <-> Gregorian conversion
  // ==================================================================

  // Break years of the 33-year cycle calibration table (reference
  // implementation: jalaali-js, MIT). Shared verbatim with the PHP engine.
  var BREAKS = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
  ];

  var MIN_JALALI_YEAR = 1178;
  var MAX_JALALI_YEAR = 3177;
  // Numeric years above this are never read as Jalali in user input: a CRM
  // deadline past Gregorian 2121 is out of scope, so '2026-10-31' pasted into
  // a picker stays Gregorian instead of becoming Jalali year 2026 (~2647).
  var MAX_INPUT_JALALI_YEAR = 1500;

  // Truncating integer division (toward zero) - matches PHP intdiv() and the
  // reference JS implementation for every value this algorithm produces.
  function div(a, b) {
    return ~~(a / b);
  }

  function mod(a, b) {
    return a - ~~(a / b) * b;
  }

  function jalCal(jy) {
    var bl = BREAKS.length;
    var gy = jy + 621;
    var leapJ = -14;
    var jp = BREAKS[0];
    var jm = 0;
    var jump = 0;
    var leap = 0;
    var i;

    if (jy < jp || jy >= BREAKS[bl - 1]) {
      throw new Error('Invalid Jalali year ' + jy);
    }

    for (i = 1; i < bl; i += 1) {
      jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) {
        break;
      }
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }

    var n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) {
      leapJ += 1;
    }

    var leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    var march = 20 + leapJ - leapG;

    if (jump - n < 6) {
      n = n - jump + div(jump + 4, 33) * 33;
    }

    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) {
      leap = 4;
    }

    return { leap: leap, gy: gy, march: march };
  }

  function g2d(gy, gm, gd) {
    var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * mod(gm + 9, 12) + 2, 5)
      + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  function d2g(jdn) {
    var j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    var i = div(mod(j, 1461), 4) * 5 + 308;
    var gd = div(mod(i, 153), 5) + 1;
    var gm = mod(div(i, 153), 12) + 1;
    var gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy: gy, gm: gm, gd: gd };
  }

  function j2d(jy, jm, jd) {
    var r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    var gy = d2g(jdn).gy;
    var jy = gy - 621;
    var r = jalCal(jy);
    var jdn1f = g2d(gy, 3, r.march);
    var k = jdn - jdn1f;

    if (k >= 0) {
      if (k <= 185) {
        return { jy: jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
      }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) {
        k += 1;
      }
    }

    return { jy: jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
  }

  /** Gregorian -> Jalali. Accepts {gy,gm,gd} or a ISO 'YYYY-MM-DD' string. */
  function toJalali(input) {
    var g = normalizeGregorian(input);
    var j = d2j(g2d(g.gy, g.gm, g.gd));
    return { jy: j.jy, jm: j.jm, jd: j.jd };
  }

  /** Jalali -> Gregorian {gy,gm,gd}. */
  function toGregorian(jy, jm, jd) {
    if (!isValidJalali(jy, jm, jd)) {
      throw new Error('Invalid Jalali date ' + jy + '/' + jm + '/' + jd);
    }
    return d2g(j2d(jy, jm, jd));
  }

  function isLeapJalali(jy) {
    assertYear(jy);
    return jalCal(jy).leap === 0;
  }

  function jalaliMonthLength(jy, jm) {
    assertYear(jy);
    if (jm < 1 || jm > 12) {
      throw new Error('Jalali month must be 1-12, got ' + jm);
    }
    if (jm <= 6) {
      return 31;
    }
    if (jm <= 11) {
      return 30;
    }
    return isLeapJalali(jy) ? 30 : 29;
  }

  function isValidJalali(jy, jm, jd) {
    try {
      assertYear(jy);
    } catch (e) {
      return false;
    }
    if (jm < 1 || jm > 12 || jd < 1) {
      return false;
    }
    return jd <= jalaliMonthLength(jy, jm);
  }

  function assertYear(jy) {
    if (jy < MIN_JALALI_YEAR || jy > MAX_JALALI_YEAR) {
      throw new Error('Jalali year must be between ' + MIN_JALALI_YEAR + ' and ' + MAX_JALALI_YEAR);
    }
  }

  var MONTH_NAMES = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];

  // Persian week starts on Saturday (index 0 = shanbe, 6 = jomeh).
  var WEEKDAY_NAMES = [
    'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'
  ];
  var WEEKDAY_NAMES_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

  /** ISO 'YYYY-MM-DD' of a Jalali date. */
  function jalaliToIso(jy, jm, jd) {
    var g = toGregorian(jy, jm, jd);
    return pad4(g.gy) + '-' + pad2(g.gm) + '-' + pad2(g.gd);
  }

  /** Jalali date of an ISO 'YYYY-MM-DD' (timezone-naive by design). */
  function isoToJalali(isoDate) {
    return toJalali(isoDate);
  }

  /** Today's Jalali date (local calendar). */
  function todayJalali() {
    var now = new Date();
    return toJalali({ gy: now.getFullYear(), gm: now.getMonth() + 1, gd: now.getDate() });
  }

  /** Persian weekday index (0=Saturday) of a JS Date. */
  function weekdayIndexOfDate(date) {
    return (date.getDay() + 1) % 7; // JS getDay(): 0=Sunday .. 6=Saturday
  }

  /** Persian weekday index of a Jalali date. */
  function jalaliWeekdayIndex(jy, jm, jd) {
    var iso = jalaliToIso(jy, jm, jd);
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    // Weekday from a local Date built out of the calendar components:
    // constructing with local parts keeps the weekday timezone-safe.
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return weekdayIndexOfDate(d);
  }

  /** Build a local Date (midnight) from a Jalali date. */
  function jalaliToDate(jy, jm, jd) {
    var iso = jalaliToIso(jy, jm, jd);
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  /** Jalali parts of a JS Date (local components). */
  function dateToJalali(date) {
    return toJalali({ gy: date.getFullYear(), gm: date.getMonth() + 1, gd: date.getDate() });
  }

  /**
   * Month grid exactly as rendered by the UI.
   * Returns {jy, jm, leap, monthLength, firstWeekday, weeks, cells} where
   * weeks is a list of 7-cell rows; each cell is either null or
   * {jy, jm, jd, iso, inMonth, weekday}.
   */
  function monthGrid(jy, jm, withAdjacent) {
    assertYear(jy);
    if (jm < 1 || jm > 12) {
      throw new Error('Jalali month must be 1-12, got ' + jm);
    }
    withAdjacent = withAdjacent !== false;

    var monthLength = jalaliMonthLength(jy, jm);
    var firstWeekday = jalaliWeekdayIndex(jy, jm, 1);

    var prevJm = jm === 1 ? 12 : jm - 1;
    var prevJy = jm === 1 ? jy - 1 : jy;
    var nextJm = jm === 12 ? 1 : jm + 1;
    var nextJy = jm === 12 ? jy + 1 : jy;

    var cells = [];
    var i;

    if (withAdjacent) {
      var prevLength = jalaliMonthLength(prevJy, prevJm);
      for (i = firstWeekday; i > 0; i -= 1) {
        cells.push(cellOf(prevJy, prevJm, prevLength - i + 1, false));
      }
    } else {
      for (i = 0; i < firstWeekday; i += 1) {
        cells.push(null);
      }
    }

    for (i = 1; i <= monthLength; i += 1) {
      cells.push(cellOf(jy, jm, i, true));
    }

    var trail = cells.length % 7;
    if (trail > 0) {
      for (i = 1; i <= 7 - trail; i += 1) {
        if (withAdjacent) {
          cells.push(cellOf(nextJy, nextJm, i, false));
        } else {
          cells.push(null);
        }
      }
    }

    var weeks = [];
    for (i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    return {
      jy: jy,
      jm: jm,
      leap: isLeapJalali(jy),
      monthLength: monthLength,
      firstWeekday: firstWeekday,
      weeks: weeks,
      monthName: MONTH_NAMES[jm - 1]
    };
  }

  function cellOf(jy, jm, jd, inMonth) {
    return {
      jy: jy,
      jm: jm,
      jd: jd,
      iso: jalaliToIso(jy, jm, jd),
      inMonth: inMonth,
      weekday: jalaliWeekdayIndex(jy, jm, jd)
    };
  }

  // ==================================================================
  // 2. Persian numerals
  // ==================================================================

  var PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  var ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  var PERSIAN_MAP = {};
  var LATIN_MAP = {};
  (function () {
    var i;
    for (i = 0; i < 10; i += 1) {
      PERSIAN_MAP['' + i] = PERSIAN_DIGITS[i];
      LATIN_MAP[PERSIAN_DIGITS[i]] = '' + i;
      LATIN_MAP[ARABIC_DIGITS[i]] = '' + i;
    }
  }());

  function toPersianDigits(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[0-9]/g, function (d) { return PERSIAN_MAP[d]; });
  }

  function toLatinDigits(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[۰-۹٠-٩]/g, function (d) { return LATIN_MAP[d] || d; });
  }

  // ==================================================================
  // 3. Value normalization & parsing
  // ==================================================================

  /**
   * Normalize any accepted input into
   * {iso: 'YYYY-MM-DD', time: {h,m}|null, jalali: {jy,jm,jd}}.
   *
   * Accepted inputs:
   *  - 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm[:ss]' (timezone-naive; explicit
   *    offsets/Z are honored for the wall-clock display)
   *  - Date objects (local calendar components)
   *  - {jy,jm,jd[,h,m]} Jalali objects
   *  - {gy,gm,gd[,h,m]} Gregorian objects
   */
  function normalizeValue(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (value instanceof Date) {
      var j = dateToJalali(value);
      return {
        iso: jalaliToIso(j.jy, j.jm, j.jd),
        time: { h: value.getHours(), m: value.getMinutes() },
        jalali: j
      };
    }

    if (typeof value === 'object') {
      // Already-normalized value ({iso, jalali, time}) passes through
      // unchanged, so format()/pickers can round values safely.
      if (typeof value.iso === 'string' && value.jalali && typeof value.jalali.jy === 'number') {
        return value;
      }
      if (typeof value.jy === 'number') {
        return {
          iso: jalaliToIso(value.jy, value.jm, value.jd),
          time: hasTime(value) ? { h: value.h | 0, m: value.m | 0 } : null,
          jalali: { jy: value.jy, jm: value.jm, jd: value.jd }
        };
      }
      if (typeof value.gy === 'number') {
        var jg = toJalali(value);
        return {
          iso: jalaliToIso(jg.jy, jg.jm, jg.jd),
          time: hasTime(value) ? { h: value.h | 0, m: value.m | 0 } : null,
          jalali: jg
        };
      }
      return null;
    }

    var text = toLatinDigits(String(value)).trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(text);
    if (m) {
      var jj = toJalali({ gy: +m[1], gm: +m[2], gd: +m[3] });
      return {
        iso: pad4(+m[1]) + '-' + pad2(+m[2]) + '-' + pad2(+m[3]),
        time: m[4] !== undefined ? { h: +m[4], m: +m[5] } : null,
        jalali: jj
      };
    }

    // 'YYYY/MM/DD' with Persian or Latin digits. Slashes are a Jalali
    // notation, but a numeric year past MAX_INPUT_JALALI_YEAR is always read
    // as Gregorian so pasted machine dates keep their meaning.
    var jm = /^(\d{3,4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?$/.exec(text);
    if (jm && (String(value).indexOf('/') !== -1 || /[۰-۹]/.test(String(value)))) {
      var jy = +jm[1];
      var mo = +jm[2];
      var day = +jm[3];
      if (jy > MAX_INPUT_JALALI_YEAR) {
        try {
          var gj = toJalali({ gy: jy, gm: mo, gd: day });
        } catch (e) {
          return null;
        }
        return {
          iso: pad4(jy) + '-' + pad2(mo) + '-' + pad2(day),
          time: jm[4] !== undefined ? { h: +jm[4], m: +jm[5] } : null,
          jalali: gj
        };
      }
      if (isValidJalali(jy, mo, day)) {
        return {
          iso: jalaliToIso(jy, mo, day),
          time: jm[4] !== undefined ? { h: +jm[4], m: +jm[5] } : null,
          jalali: { jy: jy, jm: mo, jd: day }
        };
      }
    }

    // 'D MonthName YYYY'
    var mn = /^(\d{1,2})\s+([\u0600-\u06FF]+)\s+(\d{3,4})$/.exec(String(value).trim());
    if (mn) {
      var monthIndex = MONTH_NAMES.indexOf(mn[2]);
      if (monthIndex !== -1 && isValidJalali(+mn[3], monthIndex + 1, +mn[1])) {
        return {
          iso: jalaliToIso(+mn[3], monthIndex + 1, +mn[1]),
          time: null,
          jalali: { jy: +mn[3], jm: monthIndex + 1, jd: +mn[1] }
        };
      }
    }

    return null;
  }

  function hasTime(obj) {
    return (obj.h !== undefined && obj.h !== null) || (obj.m !== undefined && obj.m !== null);
  }

  function normalizeGregorian(input) {
    if (typeof input === 'string') {
      var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(toLatinDigits(input).trim());
      if (!m) {
        throw new Error('Expected an ISO date (YYYY-MM-DD), got: ' + input);
      }
      var gy = +m[1];
      var gm = +m[2];
      var gd = +m[3];
      if (!isValidGregorian(gy, gm, gd)) {
        throw new Error('Invalid Gregorian date ' + m[0]);
      }
      return { gy: gy, gm: gm, gd: gd };
    }
    if (input && typeof input === 'object' && typeof input.gy === 'number') {
      if (!isValidGregorian(input.gy, input.gm, input.gd)) {
        throw new Error('Invalid Gregorian date ' + input.gy + '-' + input.gm + '-' + input.gd);
      }
      return { gy: input.gy, gm: input.gm, gd: input.gd };
    }
    throw new Error('Unsupported Gregorian input: ' + input);
  }

  function isValidGregorian(gy, gm, gd) {
    if (gm < 1 || gm > 12 || gd < 1 || gd > 31) {
      return false;
    }
    var probe = new Date(gy, gm - 1, gd);
    return probe.getFullYear() === gy && probe.getMonth() === gm - 1 && probe.getDate() === gd;
  }

  /** Parse a human Jalali string -> {jy,jm,jd} | null. */
  function parseJalali(input) {
    var normalized = toLatinDigits(String(input || '')).trim();
    normalized = normalized.replace(/[\/.]/g, '-').replace(/\s+/g, ' ');

    var m = /^(\d{3,4})-(\d{1,2})-(\d{1,2})$/.exec(normalized);
    if (m && +m[1] <= MAX_INPUT_JALALI_YEAR && isValidJalali(+m[1], +m[2], +m[3])) {
      return { jy: +m[1], jm: +m[2], jd: +m[3] };
    }

    m = /^(\d{1,2}) ([\u0600-\u06FF]+) (\d{3,4})$/.exec(normalized);
    if (m) {
      var monthIndex = MONTH_NAMES.indexOf(m[2]);
      if (monthIndex !== -1 && isValidJalali(+m[3], monthIndex + 1, +m[1])) {
        return { jy: +m[3], jm: monthIndex + 1, jd: +m[1] };
      }
    }

    return null;
  }

  // ==================================================================
  // 4. Formatting
  // ==================================================================

  var FORMAT = {
    SHORT: 'YYYY/MM/DD',
    ISO: 'YYYY-MM-DD',
    LONG: 'DD MMMM YYYY',
    FULL: 'WD، DD MMMM YYYY',
    DATETIME: 'YYYY/MM/DD - HH:mm',
    TIME: 'HH:mm',
    TIME_12: 'hh:mm a'
  };

  var MERIDIEM_BEFORE = 'ق.ظ';
  var MERIDIEM_AFTER = 'ب.ظ';

  /**
   * Format a value (see normalizeValue) with a Jalali token pattern.
   * Tokens: YYYY YY MMMM MMM MM M DD D WD W HH H hh h mm m ss a A.
   * Single-quoted text is emitted verbatim.
   *
   * Persian typography never zero-pads the day of month when it precedes
   * the month name ("۹ آبان ۱۴۰۵", not "۰۹ آبان ۱۴۰۵"), so 'DD' directly
   * followed by a month-name token renders unpadded - exactly as the
   * specification examples show for the 'DD MMMM YYYY' pattern.
   */
  function format(value, pattern, opts) {
    var norm = normalizeValue(value);
    if (!norm) {
      return '';
    }

    opts = opts || {};
    var numerals = opts.persianNumerals !== undefined
      ? !!opts.persianNumerals
      : (runtimeConfig.persianNumerals !== false);
    var patternUsed = pattern || opts.dateFormat || FORMAT.SHORT;
    patternUsed = String(patternUsed).replace(/DD(?=\s+MMMM?)/g, 'D');

    var j = norm.jalali;
    var hour = norm.time ? norm.time.h : 0;
    var minute = norm.time ? norm.time.m : 0;
    var hour12 = hour % 12;
    if (hour12 === 0) {
      hour12 = 12;
    }
    var weekdayIndex = jalaliWeekdayIndex(j.jy, j.jm, j.jd);

    var replacements = {
      YYYY: '' + j.jy,
      YY: pad2(j.jy % 100),
      MMMM: MONTH_NAMES[j.jm - 1],
      MMM: MONTH_NAMES[j.jm - 1],
      MM: pad2(j.jm),
      M: '' + j.jm,
      DD: pad2(j.jd),
      D: '' + j.jd,
      WD: WEEKDAY_NAMES[weekdayIndex],
      W: WEEKDAY_NAMES_SHORT[weekdayIndex],
      HH: pad2(hour),
      H: '' + hour,
      hh: pad2(hour12),
      h: '' + hour12,
      mm: pad2(minute),
      m: '' + minute,
      ss: '00',
      a: hour < 12 ? MERIDIEM_BEFORE : MERIDIEM_AFTER,
      A: hour < 12 ? 'قبل‌ازظهر' : 'بعدازظهر'
    };

    var out = applyTokens(patternUsed, replacements);
    return numerals ? toPersianDigits(out) : out;
  }

  function applyTokens(pattern, replacements) {
    var out = '';
    var len = pattern.length;
    var i = 0;

    while (i < len) {
      var ch = pattern.charAt(i);

      if (ch === "'") {
        var end = pattern.indexOf("'", i + 1);
        if (end === -1) {
          out += pattern.slice(i + 1);
          break;
        }
        out += pattern.slice(i + 1, end);
        i = end + 1;
        continue;
      }

      var matched = false;
      var tokenLength;
      var token;
      for (tokenLength = 4; tokenLength >= 1; tokenLength -= 1) {
        token = pattern.substr(i, tokenLength);
        if (token && replacements[token] !== undefined) {
          out += replacements[token];
          i += tokenLength;
          matched = true;
          break;
        }
      }

      if (!matched) {
        out += ch;
        i += 1;
      }
    }

    return out;
  }

  function pad2(value) {
    return (value < 10 ? '0' : '') + value;
  }

  function pad4(value) {
    var text = '' + value;
    while (text.length < 4) {
      text = '0' + text;
    }
    return text;
  }

  function monthName(index) {
    return MONTH_NAMES[(index - 1 + 12) % 12] || '';
  }

  function weekdayName(index) {
    return WEEKDAY_NAMES[((index % 7) + 7) % 7] || '';
  }

  // ==================================================================
  // 5. Configuration
  // ==================================================================

  var DEFAULT_CONFIG = {
    defaultCalendar: 'persian',
    dateFormat: FORMAT.SHORT,
    datetimeFormat: FORMAT.DATETIME,
    timeFormat: FORMAT.TIME,
    hourFormat: '24h', // '24h' | '12h'
    persianNumerals: true,
    firstDayOfWeek: 'saturday',
    minuteStep: 5,
    direction: 'rtl', // 'rtl' | 'ltr' | 'auto'
    highlightToday: true,
    showAdjacentDays: true,
    weekendDay: 'friday',
    dashboardWidgetEnabled: true,
    profilePanelEnabled: true,
    autoformatEnabled: true,
    autoformatSelectors: ['[data-crm-persian-date]', '[datetime]']
  };

  var runtimeConfig = mergeConfig({}, DEFAULT_CONFIG);
  var configFetchPromise = null;

  // Server-side overrides rendered by a template can set this before init.
  if (root.CRM && root.CRM.PersianCalendarConfig && typeof root.CRM.PersianCalendarConfig === 'object') {
    runtimeConfig = mergeConfig({}, runtimeConfig, root.CRM.PersianCalendarConfig);
  }

  function mergeConfig(target) {
    var sources = Array.prototype.slice.call(arguments, 1);
    sources.forEach(function (source) {
      if (!source || typeof source !== 'object') {
        return;
      }
      Object.keys(source).forEach(function (key) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
          && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
          target[key] = mergeConfig({}, target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      });
    });
    return target;
  }

  /**
   * Current effective configuration (synchronous, no server round trip).
   * Pickers read this whenever they open, so a late /config response is
   * picked up without a reload.
   */
  function config() {
    return runtimeConfig;
  }

  /**
   * Fetch the module configuration from the module API once and merge it.
   * Resolves with the effective config; never rejects (falls back to the
   * compiled defaults when the API is unavailable, e.g. on public pages).
   */
  function ready() {
    if (configFetchPromise) {
      return configFetchPromise;
    }

    configFetchPromise = new Promise(function (resolve) {
      var api = root.CRM && root.CRM.api;
      if (!api || typeof api.request !== 'function') {
        resolve(runtimeConfig);
        return;
      }

      var settled = false;
      var finish = function (data) {
        if (settled) {
          return;
        }
        settled = true;
        if (data && typeof data === 'object' && data.config && typeof data.config === 'object') {
          runtimeConfig = mergeConfig({}, runtimeConfig, mapKeys(data.config));
        }
        resolve(runtimeConfig);
      };

      // Snake_case (API/manifest) -> camelCase (library).
      function mapKeys(input) {
        var out = {};
        Object.keys(input).forEach(function (key) {
          var camel = key.replace(/_([a-z])/g, function (all, ch) { return ch.toUpperCase(); });
          out[camel] = input[key];
        });
        return out;
      }

      try {
        api.request(API_ROUTE, { method: 'GET', timeoutMs: 8000 })
          .then(function (envelope) {
            finish(envelope && envelope.data);
          })
          .catch(function () {
            finish(null);
          });

        // Never let a stalled request block the UI longer than 10s.
        root.setTimeout(function () {
          finish(null);
        }, 10000);
      } catch (e) {
        finish(null);
      }
    });

    return configFetchPromise;
  }

  function isRtlConfigured() {
    var direction = runtimeConfig.direction || 'auto';
    if (direction === 'auto') {
      return !!(root.CRM && root.CRM.isRtl) || (typeof document !== 'undefined' && document.documentElement
        && String(document.documentElement.getAttribute('dir') || '').toLowerCase() === 'rtl');
    }
    return direction === 'rtl';
  }

  // ==================================================================
  // 6. Shared DOM helpers
  // ==================================================================

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null && text !== '') {
      node.textContent = String(text);
    }
    return node;
  }

  function escapeHtml(value) {
    if (root.CRM && root.CRM.text && typeof root.CRM.text.escapeHtml === 'function') {
      return root.CRM.text.escapeHtml(String(value === null || value === undefined ? '' : value));
    }
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function t(key, fallback) {
    if (root.CRM && root.CRM.i18n && typeof root.CRM.i18n.t === 'function') {
      var value = root.CRM.i18n.t(key, fallback);
      if (value && value !== key) {
        return value;
      }
    }
    return fallback;
  }

  // Persian defaults for the widget chrome; localized through the module
  // language packs (module_persian_calendar.*) when available.
  var L = {
    today: function () { return t('module_persian_calendar.btn_today', 'امروز'); },
    now: function () { return t('module_persian_calendar.btn_now', 'اکنون'); },
    clear: function () { return t('module_persian_calendar.btn_clear', 'پاک کردن'); },
    ok: function () { return t('module_persian_calendar.btn_ok', 'تأیید'); },
    prevMonth: function () { return t('module_persian_calendar.prev_month', 'ماه قبل'); },
    nextMonth: function () { return t('module_persian_calendar.next_month', 'ماه بعد'); },
    prevYear: function () { return t('module_persian_calendar.prev_year', 'سال قبل'); },
    nextYear: function () { return t('module_persian_calendar.next_year', 'سال بعد'); },
    selectMonth: function () { return t('module_persian_calendar.select_month', 'انتخاب ماه'); },
    selectYear: function () { return t('module_persian_calendar.select_year', 'انتخاب سال'); },
    hours: function () { return t('module_persian_calendar.hours', 'ساعت'); },
    minutes: function () { return t('module_persian_calendar.minutes', 'دقیقه'); },
    pickDate: function () { return t('module_persian_calendar.pick_date', 'انتخاب تاریخ'); },
    pickDateTime: function () { return t('module_persian_calendar.pick_datetime', 'انتخاب تاریخ و ساعت'); },
    toggle: function () { return t('module_persian_calendar.open_calendar', 'باز کردن تقویم'); },
    disabled: function () { return t('module_persian_calendar.day_disabled', 'غیرقابل انتخاب'); },
    calendar: function () { return t('module_persian_calendar.calendar_label', 'تقویم شمسی'); }
  };

  function weekendIndexFromConfig() {
    var names = { saturday: 0, sunday: 1, monday: 2, tuesday: 3, wednesday: 4, thursday: 5, friday: 6, none: -1 };
    var value = String(runtimeConfig.weekendDay || 'friday').toLowerCase();
    return names[value] !== undefined ? names[value] : 6;
  }

  /**
   * Compare two normalized values (date-only part).
   * Returns -1 / 0 / 1 like a standard comparator.
   */
  function compareIso(a, b) {
    if (a === b) {
      return 0;
    }
    return a < b ? -1 : 1;
  }

  // ==================================================================
  // 7. Calendar component
  // ==================================================================

  /**
   * Inline Jalali month calendar.
   *
   * @param {HTMLElement} container
   * @param {Object} [options]
   *   view:        {jy, jm} initial month shown (default: today)
   *   selected:    value accepted by normalizeValue (highlighted)
   *   min:         minimum selectable value (inclusive)
   *   max:         maximum selectable value (inclusive)
   *   disabled:    function(value {jy,jm,jd,iso}) -> true to disable a day
   *   onSelect:    function(payload {jy,jm,jd,iso}) - fired on day pick
   *   numerals:    Persian digits (default from config)
   *   rtl:         RTL layout (default from config)
   *   showAdjacent: show leading/trailing days of neighbor months
   *   highlightToday, weekendDay, firstDayOfWeek (from config by default)
   */
  function Calendar(container, options) {
    if (!container) {
      throw new Error('Calendar requires a container element');
    }
    this.container = container;
    this.options = options || {};
    this._numeralsOpt = this.options.numerals;
    this.numerals = this._numeralsOpt !== undefined ? !!this._numeralsOpt : !!runtimeConfig.persianNumerals;
    this.rtl = this.options.rtl !== undefined ? !!this.options.rtl : isRtlConfigured();
    this.showAdjacent = this.options.showAdjacent !== undefined ? !!this.options.showAdjacent : !!runtimeConfig.showAdjacentDays;
    this.highlightToday = this.options.highlightToday !== undefined ? !!this.options.highlightToday : !!runtimeConfig.highlightToday;
    this.weekendIndex = this.options.weekendDay !== undefined
      ? weekendIndexFromValue(this.options.weekendDay)
      : weekendIndexFromConfig();
    this.min = normalizeValue(this.options.min);
    this.max = normalizeValue(this.options.max);

    var today = todayJalali();
    var view = this.options.view && this.options.view.jy ? this.options.view : null;
    this.view = view ? { jy: view.jy, jm: view.jm || 1 } : { jy: today.jy, jm: today.jm };
    this.today = today;
    this.selected = normalizeValue(this.options.selected);
    this.focusCell = null;

    this._onKeydown = this._handleKeydown.bind(this);
    this.render();
  }

  Calendar.prototype._handleSelect = function (cell, triggerEvent) {
    if (!this._isSelectable(cell)) {
      return;
    }
    this.selected = normalizeValue({ jy: cell.jy, jm: cell.jm, jd: cell.jd });
    this.render();

    var payload = { jy: cell.jy, jm: cell.jm, jd: cell.jd, iso: cell.iso };
    if (typeof this.options.onSelect === 'function') {
      this.options.onSelect(payload);
    }
    if (triggerEvent !== false && typeof document !== 'undefined'
      && typeof CustomEvent === 'function') {
      this.container.dispatchEvent(new CustomEvent('crm-persian-calendar:select', {
        bubbles: true,
        detail: payload
      }));
    }
  };

  Calendar.prototype._isSelectable = function (cell) {
    if (this.min && compareIso(cell.iso, this.min.iso) < 0) {
      return false;
    }
    if (this.max && compareIso(cell.iso, this.max.iso) > 0) {
      return false;
    }
    if (typeof this.options.disabled === 'function' && this.options.disabled(cell)) {
      return false;
    }
    return true;
  };

  Calendar.prototype.setView = function (jy, jm) {
    assertYear(jy);
    if (jm < 1 || jm > 12) {
      jm = ((jm - 1) % 12 + 12) % 12 + 1;
    }
    this.view = { jy: jy, jm: jm };
    this.render();
  };

  Calendar.prototype.setSelected = function (value) {
    this.selected = normalizeValue(value);
    if (this.selected) {
      this.view = { jy: this.selected.jalali.jy, jm: this.selected.jalali.jm };
    }
    this.render();
  };

  Calendar.prototype.prevMonth = function () {
    var jm = this.view.jm === 1 ? 12 : this.view.jm - 1;
    var jy = this.view.jm === 1 ? this.view.jy - 1 : this.view.jy;
    this.setView(jy, jm);
  };

  Calendar.prototype.nextMonth = function () {
    var jm = this.view.jm === 12 ? 1 : this.view.jm + 1;
    var jy = this.view.jm === 12 ? this.view.jy + 1 : this.view.jy;
    this.setView(jy, jm);
  };

  Calendar.prototype.prevYear = function () {
    this.setView(this.view.jy - 1, this.view.jm);
  };

  Calendar.prototype.nextYear = function () {
    this.setView(this.view.jy + 1, this.view.jm);
  };

  Calendar.prototype.goToday = function () {
    this.view = { jy: this.today.jy, jm: this.today.jm };
    this.render();
  };

  Calendar.prototype.destroy = function () {
    this.container.innerHTML = '';
    this.container.classList.remove('crm-pc-calendar', 'rtl');
    if (this._documentKeyTarget && this._documentKeyTarget.removeEventListener) {
      this._documentKeyTarget.removeEventListener('keydown', this._onKeydown);
    }
  };

  Calendar.prototype.render = function () {
    var self = this;
    var root = this.container;

    // Re-read live settings so a config or numerals change applies on the
    // next render without rebuilding the component.
    this.numerals = this._numeralsOpt !== undefined ? !!this._numeralsOpt : !!runtimeConfig.persianNumerals;

    root.innerHTML = '';
    root.classList.add('crm-pc-calendar');
    if (this.rtl) {
      root.classList.add('crm-pc-rtl');
    }
    root.setAttribute('dir', this.rtl ? 'rtl' : 'ltr');
    root.setAttribute('role', 'grid');
    root.setAttribute('aria-label', L.calendar());

    // ---- header ----
    var header = el('div', 'crm-pc-header');

    var prevBtn = el('button', 'crm-pc-nav crm-pc-nav-month', '');
    prevBtn.type = 'button';
    prevBtn.title = L.prevMonth();
    prevBtn.setAttribute('aria-label', L.prevMonth());
    prevBtn.innerHTML = this.rtl
      ? '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>'
      : '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i>';
    prevBtn.addEventListener('click', function () { self.prevMonth(); });

    var nextBtn = el('button', 'crm-pc-nav crm-pc-nav-month', '');
    nextBtn.type = 'button';
    nextBtn.title = L.nextMonth();
    nextBtn.setAttribute('aria-label', L.nextMonth());
    nextBtn.innerHTML = this.rtl
      ? '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i>'
      : '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';
    nextBtn.addEventListener('click', function () { self.nextMonth(); });

    var monthSelect = el('select', 'crm-pc-month-select');
    monthSelect.setAttribute('aria-label', L.selectMonth());
    MONTH_NAMES.forEach(function (name, index) {
      var option = el('option', '', name);
      option.value = String(index + 1);
      if (index + 1 === self.view.jm) {
        option.selected = true;
      }
      monthSelect.appendChild(option);
    });
    monthSelect.addEventListener('change', function () {
      self.setView(self.view.jy, parseInt(monthSelect.value, 10));
    });

    var yearSelect = el('select', 'crm-pc-year-select');
    yearSelect.setAttribute('aria-label', L.selectYear());
    this._fillYearOptions(yearSelect);
    yearSelect.addEventListener('change', function () {
      self.setView(parseInt(yearSelect.value, 10), self.view.jm);
    });

    var prevYearBtn = el('button', 'crm-pc-nav crm-pc-nav-year', '');
    prevYearBtn.type = 'button';
    prevYearBtn.title = L.prevYear();
    prevYearBtn.setAttribute('aria-label', L.prevYear());
    prevYearBtn.textContent = this.rtl ? '»' : '«';
    prevYearBtn.addEventListener('click', function () { self.prevYear(); });

    var nextYearBtn = el('button', 'crm-pc-nav crm-pc-nav-year', '');
    nextYearBtn.type = 'button';
    nextYearBtn.title = L.nextYear();
    nextYearBtn.setAttribute('aria-label', L.nextYear());
    nextYearBtn.textContent = this.rtl ? '«' : '»';
    nextYearBtn.addEventListener('click', function () { self.nextYear(); });

    var todayBtn = el('button', 'crm-pc-today-btn', L.today());
    todayBtn.type = 'button';
    todayBtn.addEventListener('click', function () { self.goToday(); });

    var monthYear = el('div', 'crm-pc-month-year');
    monthYear.appendChild(prevYearBtn);
    monthYear.appendChild(monthSelect);
    monthYear.appendChild(yearSelect);
    monthYear.appendChild(nextYearBtn);

    header.appendChild(prevBtn);
    header.appendChild(monthYear);
    header.appendChild(nextBtn);
    header.appendChild(todayBtn);

    // ---- weekday header ----
    var weekdayRow = el('div', 'crm-pc-weekdays');
    weekdayRow.setAttribute('role', 'row');
    WEEKDAY_NAMES_SHORT.forEach(function (name, index) {
      var cell = el('div', 'crm-pc-weekday', name);
      cell.setAttribute('role', 'columnheader');
      cell.title = WEEKDAY_NAMES[index];
      if (index === self.weekendIndex) {
        cell.classList.add('crm-pc-weekend');
      }
      weekdayRow.appendChild(cell);
    });

    // ---- day grid ----
    var grid = monthGrid(this.view.jy, this.view.jm, this.showAdjacent);
    var days = el('div', 'crm-pc-days');
    days.setAttribute('role', 'rowgroup');
    days.tabIndex = 0;

    var todayIso = jalaliToIso(this.today.jy, this.today.jm, this.today.jd);
    var selectedIso = this.selected ? this.selected.iso : null;
    var preferredFocus = null;
    if (this.focusCell && this.focusCell.jy === this.view.jy && this.focusCell.jm === this.view.jm) {
      preferredFocus = this.focusCell;
    }
    // When the preferred day cannot be selected (min/max), fall back to the
    // first selectable day of the month instead of leaving the grid unfocused.
    var preferredSelectable = false;
    if (preferredFocus) {
      try {
        preferredSelectable = this._isSelectable(cellOf(preferredFocus.jy, preferredFocus.jm, preferredFocus.jd, true));
      } catch (e) {
        preferredSelectable = false;
      }
    }
    var focusSet = false;

    function markFocus(dayCell) {
      dayCell.classList.add('crm-pc-day-focus');
      focusSet = true;
    }

    grid.weeks.forEach(function (week) {
      var row = el('div', 'crm-pc-week');
      row.setAttribute('role', 'row');
      week.forEach(function (cell) {
        var dayCell = el('div', 'crm-pc-day');
        dayCell.setAttribute('role', 'gridcell');

        if (cell === null) {
          dayCell.className += ' crm-pc-day-empty';
          row.appendChild(dayCell);
          return;
        }

        var selectable = self._isSelectable(cell);
        var classes = 'crm-pc-day';
        if (!cell.inMonth) {
          classes += ' crm-pc-adjacent';
        }
        if (cell.weekday === self.weekendIndex) {
          classes += ' crm-pc-day-weekend';
        }
        if (self.highlightToday && cell.iso === todayIso) {
          classes += ' crm-pc-day-today';
        }
        if (selectedIso && cell.iso === selectedIso) {
          classes += ' crm-pc-day-selected';
        }
        if (!selectable) {
          classes += ' crm-pc-day-disabled';
        }

        dayCell.className = classes;
        dayCell.textContent = self.numerals ? toPersianDigits(cell.jd) : String(cell.jd);
        dayCell.setAttribute('data-jy', String(cell.jy));
        dayCell.setAttribute('data-jm', String(cell.jm));
        dayCell.setAttribute('data-jd', String(cell.jd));
        dayCell.setAttribute('data-iso', cell.iso);
        dayCell.setAttribute('data-weekday', String(cell.weekday));
        dayCell.title = weekdayName(cell.weekday) + '، ' + cell.jd + ' ' + MONTH_NAMES[cell.jm - 1] + ' ' + cell.jy
          + ' (' + cell.iso + ')';

        if (selectable) {
          dayCell.setAttribute('aria-selected', selectedIso && cell.iso === selectedIso ? 'true' : 'false');
          dayCell.addEventListener('click', function () {
            self._handleSelect(cell, true);
          });
          if (!focusSet) {
            if (preferredFocus && cell.jy === preferredFocus.jy && cell.jm === preferredFocus.jm
              && cell.jd === preferredFocus.jd) {
              markFocus(dayCell);
              self.focusCell = cell;
            } else if ((!preferredFocus || !preferredSelectable) && cell.inMonth) {
              markFocus(dayCell);
              self.focusCell = cell;
            }
          }
        } else {
          dayCell.setAttribute('aria-disabled', 'true');
          dayCell.title += ' - ' + L.disabled();
        }

        row.appendChild(dayCell);
      });
      days.appendChild(row);
    });

    days.removeEventListener('keydown', this._onKeydown);
    days.addEventListener('keydown', this._onKeydown);
    this._documentKeyTarget = days;

    var monthLabel = el('div', 'crm-pc-month-label');
    monthLabel.textContent = MONTH_NAMES[this.view.jm - 1] + ' ' + (this.numerals ? toPersianDigits(this.view.jy) : this.view.jy);
    monthLabel.setAttribute('role', 'status');
    monthLabel.setAttribute('aria-live', 'polite');

    root.appendChild(header);
    root.appendChild(monthLabel);
    root.appendChild(weekdayRow);
    root.appendChild(days);
  };

  Calendar.prototype._fillYearOptions = function (yearSelect) {
    var viewYear = this.view.jy;
    var from = Math.max(MIN_JALALI_YEAR, viewYear - 12);
    var to = Math.min(MAX_JALALI_YEAR, viewYear + 12);
    var self = this;
    yearSelect.innerHTML = '';
    for (var year = from; year <= to; year += 1) {
      var option = el('option', '', this.numerals ? toPersianDigits(year) : String(year));
      option.value = String(year);
      if (year === viewYear) {
        option.selected = true;
      }
      yearSelect.appendChild(option);
    }
    // Keep a stable reference so navigation beyond the window rebuilds it.
    yearSelect.setAttribute('data-from', String(from));
    yearSelect.setAttribute('data-to', String(to));
    self._yearWindow = { from: from, to: to };
  };

  Calendar.prototype._handleKeydown = function (event) {
    var keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'PageUp', 'PageDown', 'Home', 'End'];
    if (keys.indexOf(event.key) === -1) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    var rtl = this.rtl;
    var cell = this.focusCell || this._firstSelectableCell();
    if (!cell) {
      return;
    }

    var jy = cell.jy;
    var jm = cell.jm;
    var jd = cell.jd;
    var monthLen = jalaliMonthLength(jy, jm);

    switch (event.key) {
      case 'ArrowLeft':
        jd -= rtl ? -1 : 1;
        break;
      case 'ArrowRight':
        jd += rtl ? -1 : 1;
        break;
      case 'ArrowUp':
        jd -= 7;
        break;
      case 'ArrowDown':
        jd += 7;
        break;
      case 'PageUp':
        jm -= 1;
        jd = 1;
        break;
      case 'PageDown':
        jm += 1;
        jd = 1;
        break;
      case 'Home':
        jd -= cell.weekday;
        break;
      case 'End':
        jd += 6 - cell.weekday;
        break;
      case 'Enter':
      case ' ':
        this._handleSelect(cell, true);
        return;
      default:
        return;
    }

    // Normalize overflow.
    if (jd < 1) {
      jm -= 1;
      if (jm < 1) {
        jm = 12;
        jy -= 1;
      }
      jd += jalaliMonthLength(jy, jm);
    } else if (jd > monthLen) {
      jd -= monthLen;
      jm += 1;
      if (jm > 12) {
        jm = 1;
        jy += 1;
      }
    }

    if (jy < MIN_JALALI_YEAR || jy > MAX_JALALI_YEAR) {
      return;
    }

    this.view = { jy: jy, jm: jm };
    var nextCell = {
      jy: jy,
      jm: jm,
      jd: jd,
      iso: jalaliToIso(jy, jm, jd),
      inMonth: true,
      weekday: jalaliWeekdayIndex(jy, jm, jd)
    };
    this.focusCell = nextCell;
    this.render();
    this._focusCellDom(jy, jm, jd);
  };

  Calendar.prototype._firstSelectableCell = function () {
    var grid = monthGrid(this.view.jy, this.view.jm, this.showAdjacent);
    var weeks = grid.weeks;
    for (var w = 0; w < weeks.length; w += 1) {
      for (var d = 0; d < weeks[w].length; d += 1) {
        var cell = weeks[w][d];
        if (cell && cell.inMonth && this._isSelectable(cell)) {
          return cell;
        }
      }
    }
    return null;
  };

  Calendar.prototype._focusCellDom = function (jy, jm, jd) {
    var selector = '.crm-pc-day[data-jy="' + jy + '"][data-jm="' + jm + '"][data-jd="' + jd + '"]';
    var node = this.container.querySelector(selector);
    if (node) {
      node.classList.add('crm-pc-day-focus');
      if (typeof node.focus === 'function') {
        // Days are not focusable themselves; move focus to the grid.
        var days = this.container.querySelector('.crm-pc-days');
        if (days) {
          days.focus();
        }
      }
    }
  };

  function weekendIndexFromValue(value) {
    if (typeof value === 'number') {
      return value;
    }
    var names = { saturday: 0, sunday: 1, monday: 2, tuesday: 3, wednesday: 4, thursday: 5, friday: 6, none: -1 };
    var key = String(value || '').toLowerCase();
    return names[key] !== undefined ? names[key] : 6;
  }

  // ==================================================================
  // 8. DatePicker
  // ==================================================================

  /**
   * Persian date picker bound to an <input>.
   *
   * The input displays the Jalali date; the value handed back to the
   * application stays Gregorian ISO-8601:
   *  - a hidden input carries `name="<original>"` with value 'YYYY-MM-DD'
   *    (form posts keep working unchanged),
   *  - the visible input keeps data-crm-persian-value="YYYY-MM-DD",
   *  - getIsoValue()/setIsoValue() expose the ISO value to JS consumers.
   *
   * @param {HTMLInputElement} input
   * @param {Object} [options] See Calendar options plus:
   *   format:     display pattern (default from config date_format)
   *   placeholder: placeholder text for the visible input
   *   clearable:  show the clear button (default true)
   *   readOnly:   render the Jalali value but never open the popover
   *   autoClose:  close the popover after selecting a day (default true)
   *   valueFormat: 'iso' (hidden mirror input, default) | 'display'
   *   onSelect:   function({iso, jalali})
   */
  function DatePicker(input, options) {
    if (!input || (typeof input !== 'object' && typeof input !== 'string')) {
      throw new Error('DatePicker requires an input element');
    }
    if (typeof input === 'string') {
      input = document.querySelector(input);
    }
    if (!input) {
      throw new Error('DatePicker input not found');
    }

    this.input = input;
    this.options = options || {};
    this._numeralsOpt = this.options.numerals;
    this.numerals = this._numeralsOpt !== undefined ? !!this._numeralsOpt : !!runtimeConfig.persianNumerals;
    this.rtl = this.options.rtl !== undefined ? !!this.options.rtl : isRtlConfigured();
    this.readOnly = !!this.options.readOnly || !!input.readOnly;
    this.clearable = this.options.clearable !== undefined ? !!this.options.clearable : true;
    this.autoClose = this.options.autoClose !== undefined ? !!this.options.autoClose : true;
    this.valueFormat = this.options.valueFormat || 'iso';
    this.min = normalizeValue(this.options.min);
    this.max = normalizeValue(this.options.max);
    this.formatPattern = this.options.format || runtimeConfig.dateFormat || FORMAT.SHORT;
    this._isOpen = false;
    this._mirror = null;
    this._isoValue = '';

    this._ensureMirrorInput();
    this._applyInitialValue();
    this._bind();
    // Mark as initialized BEFORE DOMContentLoaded so the module's auto-init
    // (init()) never attaches a second picker to the same input.
    this.input.setAttribute('data-crm-persian-ready', '1');
  }

  // Native input `value` accessor, kept so the value bridge can read and
  // write the internal value while an own `value` property shadows it.
  var INPUT_VALUE_DESC = (typeof HTMLInputElement === 'function')
    ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    : null;

  function nativeValue(input) {
    return INPUT_VALUE_DESC ? INPUT_VALUE_DESC.get.call(input) : input.value;
  }

  function setNativeValue(input, value) {
    if (INPUT_VALUE_DESC) {
      INPUT_VALUE_DESC.set.call(input, value);
    } else {
      input.value = value; // non-browser harness (tests)
    }
  }

  DatePicker.prototype._ensureMirrorInput = function () {
    var name = this.input.getAttribute('name') || '';

    if (this.valueFormat === 'iso' && name) {
      // Move the form field name to a hidden ISO mirror; the visible input
      // becomes the display-only field. The mirror is inserted next to the
      // input as soon as the input is attached to the DOM.
      this.input.setAttribute('data-crm-persian-name', name);
      this.input.removeAttribute('name');

      this._mirror = document.createElement('input');
      this._mirror.type = 'hidden';
      this._mirror.name = name;
      this._ensureMirrorInserted();
    }

    this._defineValueBridge();

    if (!this.input.getAttribute('placeholder') && this.options.placeholder) {
      this.input.setAttribute('placeholder', this.options.placeholder);
    }
    if (!this.input.getAttribute('autocomplete')) {
      this.input.setAttribute('autocomplete', 'off');
    }
    this.input.classList.add('crm-pc-input');
    this.input.setAttribute('dir', this.rtl ? 'rtl' : 'ltr');
    this.input.setAttribute('data-crm-persian-picker', 'date');
  };

  /**
   * Value bridge. TropaTT reads and writes date fields through every access
   * pattern (.value by id, [name=...] selectors, FormData, native submits).
   * Both the visible input and the hidden ISO mirror therefore get an own
   * `value` property: reads return the Gregorian ISO value, writes adopt it
   * and refresh the Jalali display. The form only ever submits the mirror,
   * whose internal value stays ISO.
   */
  DatePicker.prototype._defineValueBridge = function () {
    var self = this;
    var input = this.input;
    var mirror = this._mirror;

    this._isoValue = nativeValue(input) || '';
    if (mirror) {
      setNativeValue(mirror, this._isoValue);
    }

    try {
      if (mirror) {
        Object.defineProperty(mirror, 'value', {
          configurable: true,
          get: function () {
            return nativeValue(mirror);
          },
          set: function (value) {
            // The core prefills through [name=...] selectors, which resolve to
            // the mirror; adopt the value so the display follows.
            setNativeValue(mirror, value === null || value === undefined ? '' : String(value));
            self._adoptIso(nativeValue(mirror));
          }
        });
      }
      Object.defineProperty(input, 'value', {
        configurable: true,
        get: function () {
          return self._isoValue || '';
        },
        set: function (value) {
          self._adoptIso(value === null || value === undefined ? '' : String(value));
        }
      });
    } catch (e) {
      // Environment refuses shadowing: keep the classic behavior where
      // .value carries the display text and the mirror carries ISO.
    }

    if (input.form) {
      input.form.addEventListener('reset', function () {
        // After a reset the internal value reverts to the server-rendered
        // default (ISO); re-adopt it once the reset has been applied.
        root.setTimeout(function () {
          self._adoptIso(nativeValue(input));
        }, 0);
      });
    }
  };

  /** Adopt a Gregorian value written by the application; refresh display. */
  DatePicker.prototype._adoptIso = function (iso) {
    iso = iso || '';
    if (iso === (this._isoValue || '')) {
      return;
    }
    var norm = normalizeValue(iso);
    if (norm || iso === '') {
      this._setValue(norm, false);
    } else {
      // Unparseable programmatic value: keep it verbatim as the machine
      // value and show the raw text until a real value is set.
      this._isoValue = iso;
      if (this._mirror) {
        setNativeValue(this._mirror, iso);
      }
      setNativeValue(this.input, iso);
      this.input.setAttribute('data-crm-persian-value', iso);
    }
  };

  DatePicker.prototype._ensureMirrorInserted = function () {
    if (this._mirror && this._mirror.parentNode === null && this.input.parentNode) {
      this.input.parentNode.insertBefore(this._mirror, this.input.nextSibling);
    }
  };

  DatePicker.prototype._applyInitialValue = function () {
    // Precedence: explicit ISO attribute, a pre-filled hidden mirror (form
    // re-render), then the input's server-rendered value (a Gregorian ISO
    // date shown by the core app - re-displayed in Jalali without changing
    // what the form submits).
    var raw = this.input.getAttribute('data-crm-persian-value')
      || (this._mirror ? this._mirror.value : '')
      || this.input.value;
    var norm = normalizeValue(raw);
    if (norm) {
      this._setValue(norm, false);
    }
  };

  DatePicker.prototype._bind = function () {
    var self = this;

    if (this.readOnly) {
      this.input.readOnly = true;
      return;
    }

    this.input.addEventListener('focus', function () {
      self.open();
    });
    this.input.addEventListener('click', function (event) {
      event.preventDefault();
      self.open();
    });
    this.input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        self.close(true);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        self._commitTypedValue();
      }
    });
    this.input.addEventListener('blur', function () {
      // Re-parse a manually typed Jalali value; invalid text snaps back to
      // the last committed value so the form never submits garbage.
      self._commitTypedValue();
      // Give a click on the popover time to land before closing.
      root.setTimeout(function () {
        if (self._isOpen && !self._popoverFocused) {
          self.close(false);
        }
      }, 180);
    });
    this.input.addEventListener('input', function () {
      // The user is typing: drop the committed machine value without
      // re-rendering the display (that would wipe the text being typed).
      self.input.setAttribute('data-crm-persian-value', '');
      if (self._mirror) {
        setNativeValue(self._mirror, '');
      }
    });
  };

  DatePicker.prototype._commitTypedValue = function () {
    var typed = nativeValue(this.input);
    var parsed = parseJalali(typed);
    if (!parsed) {
      // Fall back to ISO / other accepted notations.
      var norm = normalizeValue(typed);
      if (norm) {
        parsed = norm.jalali;
      }
    }
    if (parsed) {
      this._setValue(normalizeValue(parsed), true);
      if (this._isOpen) {
        this._calendar.setView(parsed.jy, parsed.jm);
      }
    } else if (String(typed || '').trim() === '') {
      this.clear();
    } else {
      this._renderDisplay();
    }
  };

  DatePicker.prototype._valueIso = function (norm) {
    return norm ? norm.iso : '';
  };

  DatePicker.prototype._setValue = function (norm, triggerEvent) {
    this._value = norm;
    this._ensureMirrorInserted();
    var isoValue = this._valueIso(norm);
    this._isoValue = isoValue;
    if (this._mirror) {
      setNativeValue(this._mirror, isoValue);
    }
    this.input.setAttribute('data-crm-persian-value', isoValue);
    // Writes go through the native accessor: an own `value` property shadows
    // these assignments, and the getter hands the ISO value back to the app.
    setNativeValue(this.input, this.valueFormat === 'display' ? isoValue : this._displayText(norm));

    if (triggerEvent !== false) {
      this._fireChange(norm);
    }
  };

  DatePicker.prototype._displayText = function (norm) {
    var opts = { persianNumerals: this.numerals };
    return format(norm, this.formatPattern, opts);
  };

  DatePicker.prototype._renderDisplay = function () {
    if (this._value) {
      var isoValue = this._valueIso(this._value);
      this._isoValue = isoValue;
      setNativeValue(this.input, this._displayText(this._value));
      if (this._mirror) {
        setNativeValue(this._mirror, isoValue);
      }
      this.input.setAttribute('data-crm-persian-value', isoValue);
    }
  };

  DatePicker.prototype._fireChange = function (norm) {
    var detail = {
      iso: this._valueIso(norm),
      jalali: norm ? { jy: norm.jalali.jy, jm: norm.jalali.jm, jd: norm.jalali.jd } : null
    };

    if (typeof this.options.onSelect === 'function') {
      this.options.onSelect(detail);
    }

    if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
      this.input.dispatchEvent(new CustomEvent('crm-persian-calendar:change', {
        bubbles: true,
        detail: detail
      }));
      // Also emit a native change so existing TropaTT form handlers fire.
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  DatePicker.prototype.getIsoValue = function () {
    return this._value ? this._valueIso(this._value) : '';
  };

  DatePicker.prototype.getJalaliValue = function () {
    return this._value ? this._value.jalali : null;
  };

  DatePicker.prototype.setIsoValue = function (iso) {
    var norm = normalizeValue(iso);
    if (!norm) {
      this.clear();
      return;
    }
    this._setValue(norm, true);
    if (this._isOpen && this._calendar) {
      this._calendar.setSelected(norm);
    }
  };

  DatePicker.prototype.clear = function () {
    this._value = null;
    this._isoValue = '';
    setNativeValue(this.input, '');
    this.input.setAttribute('data-crm-persian-value', '');
    if (this._mirror) {
      setNativeValue(this._mirror, '');
    }
    if (typeof this.options.onSelect === 'function') {
      this.options.onSelect(null);
    }
    if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
      this.input.dispatchEvent(new CustomEvent('crm-persian-calendar:change', {
        bubbles: true,
        detail: { iso: '', jalali: null }
      }));
    }
  };

  DatePicker.prototype.open = function () {
    if (this._isOpen || this.readOnly) {
      return;
    }
    var self = this;

    // Live numerals/direction settings, in case the config changed after init.
    this.numerals = this._numeralsOpt !== undefined ? !!this._numeralsOpt : !!runtimeConfig.persianNumerals;
    this.rtl = this.options.rtl !== undefined ? !!this.options.rtl : isRtlConfigured();

    this._popover = document.createElement('div');
    this._popover.className = 'crm-pc-popover' + (this.rtl ? ' crm-pc-rtl' : '');
    this._popover.setAttribute('dir', this.rtl ? 'rtl' : 'ltr');
    this._popover.setAttribute('role', 'dialog');
    this._popover.setAttribute('aria-label', L.pickDate());

    var calendarHost = el('div', 'crm-pc-popover-calendar');
    this._popover.appendChild(calendarHost);

    var view = this._value ? { jy: this._value.jalali.jy, jm: this._value.jalali.jm } : undefined;
    this._calendar = new Calendar(calendarHost, {
      selected: this._value,
      min: this.min,
      max: this.max,
      disabled: this.options.disabled,
      numerals: this.numerals,
      rtl: this.rtl,
      showAdjacent: this.options.showAdjacent,
      weekendDay: this.options.weekendDay,
      view: view,
      onSelect: function (payload) {
        self._onCalendarSelect(payload);
      }
    });

    // Footer: clear button.
    if (this.clearable) {
      var footer = el('div', 'crm-pc-footer');
      var clearBtn = el('button', 'crm-pc-btn crm-pc-btn-ghost', L.clear());
      clearBtn.type = 'button';
      clearBtn.addEventListener('click', function () {
        self.clear();
        self.close(false);
      });
      footer.appendChild(clearBtn);
      this._popover.appendChild(footer);
    }

    document.body.appendChild(this._popover);
    this._positionPopover();
    this._isOpen = true;

    this._onDocPointerDown = function (event) {
      if (!self._popover || self._popover.contains(event.target) || event.target === self.input) {
        return;
      }
      self.close(false);
    };
    this._onDocKey = function (event) {
      if (event.key === 'Escape') {
        self.close(true);
      }
    };
    this._onDocScroll = function () {
      if (self._isOpen) {
        self._positionPopover();
      }
    };
    this._popover.addEventListener('pointerdown', function () {
      self._popoverFocused = true;
    });
    this._popover.addEventListener('pointerleave', function () {
      self._popoverFocused = false;
    });

    document.addEventListener('pointerdown', this._onDocPointerDown, true);
    document.addEventListener('keydown', this._onDocKey, true);
    root.addEventListener('scroll', this._onDocScroll, true);
    root.addEventListener('resize', this._onDocScroll);

    if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
      this.input.dispatchEvent(new CustomEvent('crm-persian-calendar:open', { bubbles: true }));
    }
  };

  DatePicker.prototype._onCalendarSelect = function (payload) {
    this._setValue(normalizeValue({ jy: payload.jy, jm: payload.jm, jd: payload.jd }), true);
    if (this.autoClose) {
      this.close(false);
    }
  };

  DatePicker.prototype._positionPopover = function () {
    if (!this._popover || !this.input) {
      return;
    }
    var rect = this.input.getBoundingClientRect();
    var popoverHeight = this._popover.offsetHeight || 360;
    var spaceBelow = root.innerHeight - rect.bottom;
    var top = rect.bottom + (typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0);
    var left = rect.left + (typeof window !== 'undefined' ? window.scrollX || window.pageXOffset || 0 : 0);

    if (spaceBelow < popoverHeight + 16 && rect.top > popoverHeight + 16) {
      top = top - rect.height - popoverHeight - 8; // above the input
      this._popover.classList.add('crm-pc-above');
    } else {
      this._popover.classList.remove('crm-pc-above');
    }

    this._popover.style.top = Math.max(8, top) + 'px';

    var width = this._popover.offsetWidth || 320;
    var maxLeft = (root.innerWidth || 1200) - width - 8;
    this._popover.style.left = Math.max(8, Math.min(left, maxLeft)) + 'px';
  };

  DatePicker.prototype.close = function (returnFocus) {
    if (!this._isOpen) {
      return;
    }
    this._isOpen = false;
    this._popoverFocused = false;

    if (this._popover && this._popover.parentNode) {
      this._popover.parentNode.removeChild(this._popover);
    }
    this._popover = null;
    if (this._calendar) {
      this._calendar = null;
    }

    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    document.removeEventListener('keydown', this._onDocKey, true);
    root.removeEventListener('scroll', this._onDocScroll, true);
    root.removeEventListener('resize', this._onDocScroll);

    if (returnFocus && typeof this.input.focus === 'function') {
      this.input.focus();
    }
    if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
      this.input.dispatchEvent(new CustomEvent('crm-persian-calendar:close', { bubbles: true }));
    }
  };

  DatePicker.prototype.destroy = function () {
    this.close(false);
    var name = this.input.getAttribute('data-crm-persian-name');
    if (this._mirror) {
      delete this._mirror.value; // drop the shadow, restore the accessor
      this._mirror.parentNode.removeChild(this._mirror);
      this._mirror = null;
    }
    if (name) {
      this.input.setAttribute('name', name);
      this.input.removeAttribute('data-crm-persian-name');
    }
    try {
      delete this.input.value; // drop the shadow, restore the accessor
    } catch (e) { /* non-configurable shadow - keep it */ }
    // Hand the Gregorian value back through the restored accessor (a
    // re-attached type=date input silently drops Jalali display text).
    setNativeValue(this.input, this._isoValue || '');
    var nativeType = this.input.getAttribute('data-crm-persian-native-type');
    if (nativeType) {
      this.input.type = nativeType;
      this.input.removeAttribute('data-crm-persian-native-type');
    }
    this.input.classList.remove('crm-pc-input');
    this.input.removeAttribute('data-crm-persian-picker');
    this.input.removeAttribute('data-crm-persian-value');
  };

  // ==================================================================
  // 9. DateTimePicker
  // ==================================================================

  /**
   * Persian date & time picker. Extends the date picker with an hour /
   * minute panel; the value handed back to the application is the
   * Gregorian ISO-8601 local date-time 'YYYY-MM-DDTHH:mm'.
   *
   * Extra options:
   *   hourFormat: '24h' | '12h' (default from config)
   *   minuteStep: 1 | 5 | 10 | 15 | 30 ... (default from config)
   *   timeFormat / datetimeFormat: display patterns
   */
  function DateTimePicker(input, options) {
    options = options || {};
    options.autoClose = options.autoClose !== undefined ? options.autoClose : false;
    DatePicker.call(this, input, options);

    this.hourFormat = options.hourFormat || runtimeConfig.hourFormat || '24h';
    this.minuteStep = Math.max(1, parseInt(options.minuteStep || runtimeConfig.minuteStep || 5, 10) || 1);
    // 12-hour mode rewrites the display pattern to 12-hour tokens with the
    // Persian meridiem unless the pattern already carries one.
    this.formatPattern = options.format || options.datetimeFormat
      || runtimeConfig.datetimeFormat
      || FORMAT.DATETIME;
    if (this.hourFormat === '12h'
      && this.formatPattern.indexOf('a') === -1
      && this.formatPattern.indexOf('A') === -1) {
      if (this.formatPattern.indexOf('H') !== -1) {
        this.formatPattern = this.formatPattern.replace(/HH/g, 'hh').replace(/H/g, 'h') + ' a';
      } else {
        this.formatPattern = this.formatPattern + ' - hh:mm a';
      }
    }
    this.input.setAttribute('data-crm-persian-picker', 'datetime');
    // Re-render the initial value with the datetime pattern.
    if (this._value) {
      this._setValue(this._value, false);
    }
  }

  DateTimePicker.prototype = Object.create(DatePicker.prototype);
  DateTimePicker.prototype.constructor = DateTimePicker;

  /**
   * The value handed to the application for a date-time picker is the full
   * local ISO-8601 date-time 'YYYY-MM-DDTHH:mm'.
   */
  DateTimePicker.prototype._valueIso = function (norm) {
    if (!norm) {
      return '';
    }
    if (!norm.time) {
      return norm.iso;
    }
    return norm.iso + 'T' + pad2(norm.time.h) + ':' + pad2(norm.time.m);
  };

  DateTimePicker.prototype._displayText = function (norm) {
    return format(norm, this.formatPattern, { persianNumerals: this.numerals });
  };

  DateTimePicker.prototype._onCalendarSelect = function (payload) {
    var time = this._value && this._value.time ? this._value.time : { h: 12, m: 0 };
    var merged = normalizeValue({
      jy: payload.jy, jm: payload.jm, jd: payload.jd, h: time.h, m: time.m
    });
    // Clamp into [min, max].
    merged = this._clamp(merged);
    this._setValue(merged, true);
    this._syncTimePanel();
  };

  DateTimePicker.prototype._clamp = function (norm) {
    if (!norm) {
      return norm;
    }
    var value = norm.iso + 'T' + pad2(norm.time ? norm.time.h : 0) + ':' + pad2(norm.time ? norm.time.m : 0);
    if (this.min) {
      var minValue = this.min.iso + 'T' + pad2(this.min.time ? this.min.time.h : 0) + ':' + pad2(this.min.time ? this.min.time.m : 0);
      if (value < minValue) {
        return this.min;
      }
    }
    if (this.max) {
      var maxValue = this.max.iso + 'T' + pad2(this.max.time ? this.max.time.h : 23) + ':' + pad2(this.max.time ? this.max.time.m : 59);
      if (value > maxValue) {
        return this.max;
      }
    }
    return norm;
  };

  DateTimePicker.prototype.open = function () {
    if (this._isOpen || this.readOnly) {
      return;
    }
    var self = this;

    DatePicker.prototype.open.call(this);

    if (!this._popover) {
      return;
    }

    // Insert the time panel above the footer.
    var timePanel = this._buildTimePanel();
    var footer = this._popover.querySelector('.crm-pc-footer');
    if (footer) {
      this._popover.insertBefore(timePanel, footer);
    } else {
      this._popover.appendChild(timePanel);
    }

    // DateTime: add OK button to the footer.
    if (!footer) {
      footer = el('div', 'crm-pc-footer');
      this._popover.appendChild(footer);
    }
    if (!footer.querySelector('.crm-pc-btn-ok')) {
      var okBtn = el('button', 'crm-pc-btn crm-pc-btn-primary crm-pc-btn-ok', L.ok());
      okBtn.type = 'button';
      okBtn.addEventListener('click', function () {
        self.close(false);
      });
      footer.appendChild(okBtn);
    }
    if (!footer.querySelector('.crm-pc-btn-now') && this.clearable) {
      var nowBtn = el('button', 'crm-pc-btn crm-pc-btn-ghost crm-pc-btn-now', L.now());
      nowBtn.type = 'button';
      nowBtn.addEventListener('click', function () {
        var now = new Date();
        self._setValue(normalizeValue(now), true);
        if (self._calendar) {
          self._calendar.setSelected(self._value);
        }
        self._syncTimePanel();
      });
      footer.insertBefore(nowBtn, footer.querySelector('.crm-pc-btn-ok'));
    }

    this._popover.classList.add('crm-pc-popover-datetime');
    this._positionPopover();
    this._syncTimePanel();
  };

  DateTimePicker.prototype._buildTimePanel = function () {
    var self = this;
    var panel = el('div', 'crm-pc-time');

    var hourLabel = el('span', 'crm-pc-time-label', L.hours());
    var hourSelect = el('select', 'crm-pc-time-select crm-pc-time-hours');
    hourSelect.setAttribute('aria-label', L.hours());
    var hours = this.hourFormat === '12h' ? 12 : 24;
    var start = this.hourFormat === '12h' ? 1 : 0;
    var i;

    for (i = 0; i < hours; i += 1) {
      var value = start + i;
      var option = el('option', '', this.numerals ? toPersianDigits(pad2(value)) : pad2(value));
      option.value = String(value);
      hourSelect.appendChild(option);
    }
    hourSelect.addEventListener('change', function () {
      self._onTimeChanged(parseInt(hourSelect.value, 10), null);
    });

    var minuteLabel = el('span', 'crm-pc-time-label', L.minutes());
    var minuteSelect = el('select', 'crm-pc-time-select crm-pc-time-minutes');
    minuteSelect.setAttribute('aria-label', L.minutes());
    for (i = 0; i < 60; i += this.minuteStep) {
      var minuteOption = el('option', '', this.numerals ? toPersianDigits(pad2(i)) : pad2(i));
      minuteOption.value = String(i);
      minuteSelect.appendChild(minuteOption);
    }
    minuteSelect.addEventListener('change', function () {
      self._onTimeChanged(null, parseInt(minuteSelect.value, 10));
    });

    var hourWrap = el('div', 'crm-pc-time-field');
    hourWrap.appendChild(hourLabel);
    hourWrap.appendChild(hourSelect);
    var minuteWrap = el('div', 'crm-pc-time-field');
    minuteWrap.appendChild(minuteLabel);
    minuteWrap.appendChild(minuteSelect);

    panel.appendChild(hourWrap);
    panel.appendChild(el('span', 'crm-pc-time-sep', ':'));
    panel.appendChild(minuteWrap);

    if (this.hourFormat === '12h') {
      var meridiemSelect = el('select', 'crm-pc-time-select crm-pc-time-meridiem');
      meridiemSelect.setAttribute('aria-label', 'AM/PM');
      var am = el('option', '', MERIDIEM_BEFORE);
      am.value = 'am';
      var pm = el('option', '', MERIDIEM_AFTER);
      pm.value = 'pm';
      meridiemSelect.appendChild(am);
      meridiemSelect.appendChild(pm);
      meridiemSelect.addEventListener('change', function () {
        var hour = self._value && self._value.time ? self._value.time.h : 12;
        var isPm = meridiemSelect.value === 'pm';
        var newHour = isPm ? (hour % 12) + 12 : hour % 12;
        self._onTimeChanged(newHour, null);
      });
      var meridiemWrap = el('div', 'crm-pc-time-field');
      meridiemWrap.appendChild(meridiemSelect);
      panel.appendChild(meridiemWrap);
      this._meridiemSelect = meridiemSelect;
    }

    this._hourSelect = hourSelect;
    this._minuteSelect = minuteSelect;

    return panel;
  };

  DateTimePicker.prototype._onTimeChanged = function (hour, minute) {
    var time = this._value && this._value.time ? { h: this._value.time.h, m: this._value.time.m } : { h: 12, m: 0 };
    if (hour !== null && hour !== undefined) {
      time.h = hour;
    }
    if (minute !== null && minute !== undefined) {
      time.m = minute;
    }
    if (!this._value) {
      var today = todayJalali();
      this._setValue(normalizeValue({ jy: today.jy, jm: today.jm, jd: today.jd, h: time.h, m: time.m }), true);
    } else {
      var merged = normalizeValue({
        jy: this._value.jalali.jy, jm: this._value.jalali.jm, jd: this._value.jalali.jd,
        h: time.h, m: time.m
      });
      this._setValue(this._clamp(merged), true);
    }
    this._syncTimePanel();
  };

  DateTimePicker.prototype._syncTimePanel = function () {
    if (!this._hourSelect || !this._value || !this._value.time) {
      return;
    }
    var hour = this._value.time.h;
    var minute = this._value.time.m;
    var minuteValue = Math.min(59, Math.round(minute / this.minuteStep) * this.minuteStep);

    if (this.hourFormat === '12h') {
      var displayHour = hour % 12;
      if (displayHour === 0) {
        displayHour = 12;
      }
      this._hourSelect.value = String(displayHour);
      if (this._meridiemSelect) {
        this._meridiemSelect.value = hour < 12 ? 'am' : 'pm';
      }
    } else {
      this._hourSelect.value = String(hour);
    }
    if (this._minuteSelect) {
      this._minuteSelect.value = String(minuteValue);
    }
  };

  // ==================================================================
  // 10. Autoformat
  // ==================================================================

  var autoformatActive = false;

  /**
   * Convert matched elements to their Jalali display. Supported markers:
   *  - [data-crm-persian-date]           text content or attr value = ISO date
   *  - [datetime]                        standard <time> element (attr kept)
   * The Gregorian machine value is preserved in data-crm-persian-original
   * and the datetime attribute is never modified.
   */
  function autoformatScan(scope) {
    if (typeof document === 'undefined') {
      return 0;
    }
    var rootEl = scope || document;
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') {
      return 0;
    }

    var selectors = runtimeConfig.autoformatSelectors && runtimeConfig.autoformatSelectors.length
      ? runtimeConfig.autoformatSelectors
      : DEFAULT_CONFIG.autoformatSelectors;

    var count = 0;
    var lists = [];
    try {
      selectors.forEach(function (selector) {
        try {
          lists.push(rootEl.querySelectorAll(selector));
        } catch (e) { /* invalid selector in config - skip it */ }
      });
    } catch (e) {
      return 0;
    }

    lists.forEach(function (nodes) {
      Array.prototype.forEach.call(nodes, function (node) {
        if (node.getAttribute('data-crm-persian-formatted') === '1') {
          return;
        }
        if (node.closest && node.closest('.crm-pc-popover, .crm-pc-calendar')) {
          return; // never touch our own widgets
        }

        var source = node.getAttribute('datetime')
          || node.getAttribute('data-crm-persian-date')
          || node.textContent || '';
        var norm = normalizeValue(source);
        if (!norm) {
          return;
        }

        node.setAttribute('data-crm-persian-formatted', '1');
        node.setAttribute('data-crm-persian-original', norm.iso);
        node.setAttribute('dir', isRtlConfigured() ? 'rtl' : 'ltr');

        var pattern = node.getAttribute('data-crm-persian-format')
          || (norm.time ? runtimeConfig.datetimeFormat : runtimeConfig.dateFormat)
          || FORMAT.SHORT;
        node.textContent = format(norm, pattern, { persianNumerals: runtimeConfig.persianNumerals !== false });
        count += 1;
      });
    });

    return count;
  }

  /** Enable the opt-in global autoformat (config autoformat_enabled). */
  function autoformatEnable() {
    if (typeof document === 'undefined' || autoformatActive) {
      return;
    }
    autoformatActive = true;
    autoformatScan(document);
    ensureDomObserver();
  }

  function autoformatDisable() {
    autoformatActive = false;
  }

  // ==================================================================
  // 11. Display bridge
  // ==================================================================
  // Every Gregorian date the UI renders flows through two formatters:
  // window.CRM.br1.formatDate (deadlines, stamps, lists) and
  // Date.prototype.toLocaleDateString/toLocaleTimeString (calendar page
  // labels, agenda, chat times). Wrapping those three at the source turns
  // the whole UI Jalali without touching a single core file.

  var displayBridgeActive = false;
  var originalBr1FormatDate = null;
  var originalToLocaleDateString = null;
  var originalToLocaleTimeString = null;

  function bridgeNumerals() {
    return runtimeConfig.persianNumerals !== false;
  }

  /** Jalali replacement for br1.formatDate; falls back to the original. */
  function br1FormatDateJalali(value) {
    try {
      if (value !== null && value !== undefined && value !== '') {
        // '2026-11-01T12:34:56.789Z' style stamps: drop the milliseconds so
        // normalizeValue accepts the rest of the ISO notation.
        var raw = value instanceof Date ? value : String(value).replace(/(\d{2}:\d{2}:\d{2})\.\d+/, '$1');
        var norm = normalizeValue(raw);
        if (norm) {
          var pattern = norm.time
            ? (runtimeConfig.datetimeFormat || FORMAT.DATETIME)
            : (runtimeConfig.dateFormat || FORMAT.SHORT);
          return format(norm, pattern, { persianNumerals: bridgeNumerals() });
        }
      }
    } catch (e) { /* not a date we understand - use the original output */ }
    return originalBr1FormatDate.apply(this, arguments);
  }

  function toLocaleDateStringJalali(locale, options) {
    if (!displayBridgeActive || !options || typeof options !== 'object'
      || !(options.year || options.month || options.day || options.weekday)) {
      return originalToLocaleDateString.apply(this, arguments);
    }
    try {
      var j = dateToJalali(this);
      if (!j || isNaN(this.getTime())) {
        throw new Error('Invalid Date');
      }
      var tokens = [];
      if (options.weekday) {
        tokens.push('WD');
      }
      if (options.day) {
        tokens.push(options.day === 'numeric' ? 'D' : 'DD');
      }
      if (options.month) {
        tokens.push(options.month === 'long' ? 'MMMM' : 'MMM');
      }
      if (options.year) {
        tokens.push(options.year === '2-digit' ? 'YY' : 'YYYY');
      }
      return format({ jy: j.jy, jm: j.jm, jd: j.jd }, tokens.join(' '), { persianNumerals: bridgeNumerals() });
    } catch (e) {
      return originalToLocaleDateString.apply(this, arguments);
    }
  }

  function toLocaleTimeStringJalali(locale, options) {
    if (!displayBridgeActive) {
      return originalToLocaleTimeString.apply(this, arguments);
    }
    try {
      if (options && options.second) {
        // Seconds are not part of the token language - keep ICU output.
        return originalToLocaleTimeString.apply(this, arguments);
      }
      var tokens = (options && options.hour12) ? 'hh:mm a' : 'HH:mm';
      var time = { jy: 1, jm: 1, jd: 1, h: this.getHours(), m: this.getMinutes() };
      return format(time, tokens, { persianNumerals: bridgeNumerals() });
    } catch (e) {
      return originalToLocaleTimeString.apply(this, arguments);
    }
  }

  function displayBridgeEnable() {
    if (displayBridgeActive || typeof Date === 'undefined') {
      return;
    }
    displayBridgeActive = true;

    if (root.CRM && root.CRM.br1 && typeof root.CRM.br1.formatDate === 'function'
      && !root.CRM.br1.formatDate.__persianCalendarBridge) {
      originalBr1FormatDate = root.CRM.br1.formatDate;
      var wrapped = br1FormatDateJalali;
      wrapped.__persianCalendarBridge = true;
      root.CRM.br1.formatDate = wrapped;
    }

    if (typeof Date.prototype.toLocaleDateString === 'function') {
      originalToLocaleDateString = Date.prototype.toLocaleDateString;
      Date.prototype.toLocaleDateString = toLocaleDateStringJalali;
    }
    if (typeof Date.prototype.toLocaleTimeString === 'function') {
      originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
      Date.prototype.toLocaleTimeString = toLocaleTimeStringJalali;
    }
  }

  function displayBridgeDisable() {
    if (!displayBridgeActive) {
      return;
    }
    displayBridgeActive = false;
    if (originalToLocaleDateString) {
      Date.prototype.toLocaleDateString = originalToLocaleDateString;
      originalToLocaleDateString = null;
    }
    if (originalToLocaleTimeString) {
      Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
      originalToLocaleTimeString = null;
    }
    if (originalBr1FormatDate && root.CRM && root.CRM.br1
      && root.CRM.br1.formatDate && root.CRM.br1.formatDate.__persianCalendarBridge) {
      root.CRM.br1.formatDate = originalBr1FormatDate;
    }
    originalBr1FormatDate = null;
  }

  // ==================================================================
  // 12. CRM calendar page (team events, meetings, deadlines)
  // ==================================================================
  // The calendar page renders its month grid and time heads from raw
  // getDate() numbers and i18n weekday keys that no formatter flows through.
  // Those remnants are re-stamped here after every render; everything else
  // on the page (titles, summary chips, agenda, event details) already goes
  // through the display bridge.

  var CALENDAR_WEEKDAYS_MON_FIRST = ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه', 'یکشنبه'];

  function isCalendarPage() {
    return typeof document !== 'undefined' && document.body
      && document.body.getAttribute('data-page') === 'calendar';
  }

  function enhanceCalendarView() {
    if (!isCalendarPage()) {
      return;
    }
    var i;

    // Month grid day numbers - the machine date is in the attribute.
    var dayNumbers = document.querySelectorAll('.crm-calendar-day-number[data-calendar-jump-date]');
    Array.prototype.forEach.call(dayNumbers, function (node) {
      var norm = normalizeValue(node.getAttribute('data-calendar-jump-date'));
      if (!norm) {
        return;
      }
      var text = numeralsEnabled() ? toPersianDigits(String(norm.jalali.jd)) : String(norm.jalali.jd);
      if (node.textContent !== text) {
        node.textContent = text;
      }
    });

    // Weekday header row: the core grid is Monday-first.
    var weekdayCells = document.querySelectorAll('.crm-calendar-weekdays .crm-calendar-weekday');
    if (weekdayCells.length === 7) {
      for (i = 0; i < 7; i += 1) {
        if (weekdayCells[i].textContent !== CALENDAR_WEEKDAYS_MON_FIRST[i]) {
          weekdayCells[i].textContent = CALENDAR_WEEKDAYS_MON_FIRST[i];
        }
      }
    }

    // Day/week view column heads: <span>weekday (bridge)</span><strong>day</strong>.
    var heads = document.querySelectorAll('.crm-calendar-time-head');
    if (heads.length) {
      var state = root.CRM && root.CRM.__calendarPageState;
      var anchor = state && state.anchor instanceof Date && !isNaN(state.anchor.getTime())
        ? state.anchor
        : new Date();
      var start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
      if (heads.length > 1) {
        // The core week grid starts on Monday.
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      }
      for (i = 0; i < heads.length; i += 1) {
        var strong = heads[i].querySelector('strong');
        if (!strong) {
          continue;
        }
        var cell = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        var day = dateToJalali(cell).jd;
        var text = numeralsEnabled() ? toPersianDigits(String(day)) : String(day);
        if (strong.textContent !== text) {
          strong.textContent = text;
        }
      }
    }
  }

  // ==================================================================
  // 13. Auto-init
  // ==================================================================

  var initialized = false;

  /**
   * Attach pickers to date inputs inside a scope. Two sources:
   *  - [data-crm-persian-picker] explicit opt-in declarations,
   *  - every input[type=date] / input[type=datetime-local], so the Jalali
   *    picker replaces the native Gregorian one app-wide. Opt out with
   *    data-crm-persian-skip="1".
   */
  function init(scope) {
    if (typeof document === 'undefined') {
      return [];
    }
    var rootEl = scope || document;
    var created = [];
    var nodes = rootEl.querySelectorAll('[data-crm-persian-picker], input[type="date"], input[type="datetime-local"]');
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute('data-crm-persian-ready') === '1') {
        return;
      }
      if (node.tagName !== 'INPUT' || node.disabled) {
        return;
      }
      if (node.getAttribute('data-crm-persian-skip') === '1') {
        return;
      }

      var declared = node.getAttribute('data-crm-persian-picker');
      var kind = declared ? String(declared).toLowerCase() : (node.type === 'datetime-local' ? 'datetime' : 'date');
      if (!declared) {
        node.setAttribute('data-crm-persian-picker', kind);
      }

      // A native date field cannot show Jalali text and would open the
      // Gregorian browser picker - switch to text and remember the type.
      if (node.type === 'date' || node.type === 'datetime-local') {
        node.setAttribute('data-crm-persian-native-type', node.type);
        node.type = 'text';
      }

      var options = readDataOptions(node);
      // Keep the native min/max constraints on the Jalali picker.
      if (!options.min && node.getAttribute('min')) {
        options.min = node.getAttribute('min');
      }
      if (!options.max && node.getAttribute('max')) {
        options.max = node.getAttribute('max');
      }

      var picker;
      try {
        picker = kind === 'datetime' || kind === 'date-time' || kind === 'datetime-local'
          ? new DateTimePicker(node, options)
          : new DatePicker(node, options);
        node.setAttribute('data-crm-persian-ready', '1');
        created.push(picker);
      } catch (e) {
        if (root.console && typeof root.console.warn === 'function') {
          root.console.warn('[crm.persian-calendar] failed to attach picker:', e);
        }
      }
    });
    return created;
  }

  function readDataOptions(node) {
    var options = {};
    var data = node.dataset || {};
    if (data.crmPersianMin) {
      options.min = data.crmPersianMin;
    }
    if (data.crmPersianMax) {
      options.max = data.crmPersianMax;
    }
    if (data.crmPersianFormat) {
      options.format = data.crmPersianFormat;
    }
    if (data.crmPersianNumerals !== undefined) {
      options.numerals = data.crmPersianNumerals === '1' || data.crmPersianNumerals === 'true';
    }
    if (data.crmPersianPlaceholder) {
      options.placeholder = data.crmPersianPlaceholder;
    }
    if (data.crmPersianClearable !== undefined) {
      options.clearable = data.crmPersianClearable === '1' || data.crmPersianClearable === 'true';
    }
    if (node.readOnly) {
      options.readOnly = true;
    }
    return options;
  }

  // ------------------------------------------------------------------
  // Shared DOM observer: dynamically rendered forms get pickers, dynamic
  // content gets autoformatted, the calendar page gets re-stamped.
  // ------------------------------------------------------------------

  var domObserver = null;
  var domPending = null;

  function domScan() {
    if (typeof document === 'undefined') {
      return;
    }
    init(document);
    if (autoformatActive) {
      autoformatScan(document);
    }
    enhanceCalendarView();
  }

  function ensureDomObserver() {
    if (domObserver || typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.body) {
      return;
    }
    domObserver = new MutationObserver(function () {
      if (domPending) {
        root.clearTimeout(domPending);
      }
      domPending = root.setTimeout(domScan, 120);
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ------------------------------------------------------------------
  // Persian vs Latin numerals. The module config sets the default;
  // an individual user can override it (per browser) with the toggle on
  // the module page - stored locally, never sent to the server.
  // ------------------------------------------------------------------

  var NUMERALS_STORAGE_KEY = 'crm_persian_numerals';

  function applyNumeralsOverride() {
    try {
      var stored = root.localStorage ? root.localStorage.getItem(NUMERALS_STORAGE_KEY) : null;
      if (stored === '0' || stored === '1') {
        runtimeConfig.persianNumerals = stored === '1';
      }
    } catch (e) { /* storage unavailable - the configured default stands */ }
  }

  function setPersianNumerals(enabled) {
    runtimeConfig.persianNumerals = !!enabled;
    try {
      if (root.localStorage) {
        root.localStorage.setItem(NUMERALS_STORAGE_KEY, enabled ? '1' : '0');
      }
    } catch (e) { /* keep the in-session value */ }
    if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
      document.dispatchEvent(new CustomEvent('crm-persian-calendar:numerals-change', { bubbles: true }));
    }
  }

  function numeralsEnabled() {
    return runtimeConfig.persianNumerals !== false;
  }

  function bootstrap() {
    if (initialized || typeof document === 'undefined') {
      return;
    }
    initialized = true;

    applyNumeralsOverride();

    // Pickers initialize immediately with compiled defaults; the server
    // config arrives in the background and is applied to future opens.
    ready();
    init(document);

    // Convert the UI display from the first paint on; the fetched config
    // refines formats and numerals afterwards.
    displayBridgeEnable();
    ensureDomObserver();

    ready().then(function () {
      applyNumeralsOverride(); // user preference wins over stored config
      if (runtimeConfig.autoformatEnabled) {
        autoformatEnable();
      }
      domScan();
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      root.setTimeout(bootstrap, 0);
    }
  }

  // ==================================================================
  // Public API
  // ==================================================================

  var api = {
    version: VERSION,
    moduleName: MODULE_NAME,

    // conversion
    toJalali: toJalali,
    toGregorian: toGregorian,
    isLeapJalali: isLeapJalali,
    jalaliMonthLength: jalaliMonthLength,
    isValidJalali: isValidJalali,
    monthGrid: monthGrid,
    todayJalali: todayJalali,
    jalaliToIso: jalaliToIso,
    isoToJalali: isoToJalali,
    jalaliToDate: jalaliToDate,
    dateToJalali: dateToJalali,
    weekdayIndexOfDate: weekdayIndexOfDate,
    jalaliWeekdayIndex: jalaliWeekdayIndex,
    minJalaliYear: MIN_JALALI_YEAR,
    maxJalaliYear: MAX_JALALI_YEAR,
    monthNames: MONTH_NAMES,
    weekdayNames: WEEKDAY_NAMES,
    weekdayNamesShort: WEEKDAY_NAMES_SHORT,
    monthName: monthName,
    weekdayName: weekdayName,

    // numerals
    toPersianDigits: toPersianDigits,
    toLatinDigits: toLatinDigits,
    setPersianNumerals: setPersianNumerals,

    // parsing / normalization
    normalizeValue: normalizeValue,
    parseJalali: parseJalali,

    // formatting
    format: format,
    formats: FORMAT,

    // config
    config: config,
    ready: ready,

    // components
    Calendar: Calendar,
    DatePicker: DatePicker,
    DateTimePicker: DateTimePicker,
    createCalendar: function (container, options) { return new Calendar(container, options); },
    createDatePicker: function (input, options) { return new DatePicker(input, options); },
    createDateTimePicker: function (input, options) { return new DateTimePicker(input, options); },
    init: init,

    // autoformat
    autoformat: {
      scan: autoformatScan,
      enable: autoformatEnable,
      disable: autoformatDisable,
      isActive: function () { return autoformatActive; }
    },

    // app-wide Jalali display (br1.formatDate + toLocaleDate/TimeString)
    displayBridge: {
      enable: displayBridgeEnable,
      disable: displayBridgeDisable,
      isActive: function () { return displayBridgeActive; }
    },

    // CRM calendar page enhancer (exposed for the module page and tests)
    enhanceCalendarView: enhanceCalendarView,

    // test hooks (not used by the UI)
    _internal: {
      div: div,
      mod: mod,
      jalCal: jalCal,
      g2d: g2d,
      d2g: d2g,
      j2d: j2d,
      d2j: d2j,
      applyTokens: applyTokens,
      mergeConfig: mergeConfig,
      nativeValue: nativeValue,
      setNativeValue: setNativeValue,
      resetForTests: function () {
        runtimeConfig = mergeConfig({}, DEFAULT_CONFIG);
        configFetchPromise = null;
        initialized = false;
        autoformatDisable();
        displayBridgeDisable();
      },
      DEFAULT_CONFIG: DEFAULT_CONFIG
    }
  };

  return api;
}));
