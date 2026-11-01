/**
 * Persian Calendar module - demo/playground page logic.
 * Loaded only on the module-persian-calendar route (manifest js_routes).
 *
 * Uses the global library web/assets/js/persian-calendar.js
 * (window.CRM.PersianCalendar) - kept separate so the library stays lean
 * and cacheable on every page while this wiring is page-specific.
 */
(function () {
  'use strict';

  function waitForLibrary(callback) {
    if (window.CRM && window.CRM.PersianCalendar) {
      callback(window.CRM.PersianCalendar);
      return;
    }
    setTimeout(function () {
      waitForLibrary(callback);
    }, 100);
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function t(key, fallback) {
    if (window.CRM && window.CRM.i18n && typeof window.CRM.i18n.t === 'function') {
      var value = window.CRM.i18n.t(key, fallback);
      if (value && value !== key) {
        return value;
      }
    }
    return fallback;
  }

  function isoPlusDays(iso, days) {
    var date = new Date(iso + 'T12:00:00');
    date.setDate(date.getDate() + days);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  waitForLibrary(function (PC) {
    var todayIso = PC.todayJalali();
    var todayIsoString = PC.jalaliToIso(todayIso.jy, todayIso.jm, todayIso.jd);

    // ---------------------------------------------------------------
    // 1. Inline calendar + month grid table
    // ---------------------------------------------------------------
    var calendarHost = document.getElementById('demoCalendar');
    if (calendarHost) {
      var calendar = PC.createCalendar(calendarHost, {
        selected: todayIsoString,
        onSelect: function (payload) {
          var label = PC.format(payload.iso, PC.formats.FULL);
          var selection = document.getElementById('demoCalendarSelection');
          if (selection) {
            selection.dir = 'rtl';
            selection.innerHTML = '<span dir="rtl">' + esc(label) + '</span> &middot; <code dir="ltr">' + esc(payload.iso) + '</code>';
          }
        }
      });

      // Mini month table (server-side skeleton, client fills days).
      var gridBody = document.getElementById('demoMonthGrid');
      if (gridBody) {
        var grid = PC.monthGrid(todayIso.jy, todayIso.jm, false);
        grid.weeks.forEach(function (week) {
          var row = document.createElement('tr');
          week.forEach(function (cell) {
            var td = document.createElement('td');
            td.className = 'text-center';
            if (cell) {
              td.textContent = PC.toPersianDigits(cell.jd);
              if (cell.iso === todayIsoString) {
                td.innerHTML = '<span class="badge rounded-pill" style="background:var(--crm-accent)">' + esc(PC.toPersianDigits(cell.jd)) + '</span>';
              }
            }
            row.appendChild(td);
          });
          gridBody.appendChild(row);
        });
      }

      // Keep the selects usable after month navigation (delegation not
      // needed - the Calendar rebuilds its own DOM on every render).
      void calendar;
    }

    // ---------------------------------------------------------------
    // 2. Pickers
    // ---------------------------------------------------------------
    var datePickerInput = document.getElementById('demoDatePicker');
    if (datePickerInput) {
      var datePicker = PC.createDatePicker(datePickerInput, {});
      var isoLabel = document.getElementById('demoDatePickerIso');

      var syncDateDemo = function () {
        if (isoLabel) {
          isoLabel.textContent = datePicker.getIsoValue();
        }
      };
      datePickerInput.addEventListener('crm-persian-calendar:change', syncDateDemo);
      syncDateDemo();
    }

    var restrictedInput = document.getElementById('demoRestrictedPicker');
    if (restrictedInput) {
      PC.createDatePicker(restrictedInput, {
        min: isoPlusDays(todayIsoString, -10),
        max: isoPlusDays(todayIsoString, 20)
      });
    }

    var readonlyInput = document.getElementById('demoReadonlyPicker');
    if (readonlyInput) {
      var readonlyPicker = PC.createDatePicker(readonlyInput, { readOnly: true });
      readonlyPicker.setIsoValue(todayIsoString);
    }

    var dateTimeInput = document.getElementById('demoDateTimePicker');
    if (dateTimeInput) {
      var dateTimePicker = PC.createDateTimePicker(dateTimeInput, {
        min: isoPlusDays(todayIsoString, -5) + 'T09:00',
        max: isoPlusDays(todayIsoString, 60) + 'T21:00'
      });
      dateTimePicker.setIsoValue(todayIsoString + 'T14:30');

      var dateTimeIso = document.getElementById('demoDateTimeIso');
      var dateTimeDisplay = document.getElementById('demoDateTimeDisplay');
      var syncDateTimeDemo = function () {
        if (dateTimeIso) {
          dateTimeIso.textContent = dateTimePicker.getIsoValue();
        }
        if (dateTimeDisplay) {
          dateTimeDisplay.textContent = dateTimeInput.value;
        }
      };
      dateTimeInput.addEventListener('crm-persian-calendar:change', syncDateTimeDemo);
      syncDateTimeDemo();
    }

    // ---------------------------------------------------------------
    // 3. Conversion playground
    // ---------------------------------------------------------------
    var g2jInput = document.getElementById('demoG2JInput');
    var g2jBtn = document.getElementById('demoG2JBtn');
    var g2jResult = document.getElementById('demoG2JResult');
    if (g2jInput && g2jBtn && g2jResult) {
      var runG2J = function () {
        var value = g2jInput.value;
        if (!value) {
          return;
        }
        var j = PC.toJalali(value);
        g2jResult.innerHTML = ''
          + '<span style="font-size:1.2rem">' + esc(PC.format(value, 'WD، DD MMMM YYYY')) + '</span>'
          + '<div class="small text-muted mt-1">' + esc(PC.format(value, 'YYYY/MM/DD'))
          + ' &middot; <code dir="ltr">' + esc(PC.toGregorian(j.jy, j.jm, j.jd).gy + '-' + String(PC.toGregorian(j.jy, j.jm, j.jd).gm).padStart(2, '0') + '-' + String(PC.toGregorian(j.jy, j.jm, j.jd).gd).padStart(2, '0')) + '</code></div>';
      };
      g2jBtn.addEventListener('click', runG2J);
      g2jInput.addEventListener('change', runG2J);
      runG2J();
    }

    var j2gInput = document.getElementById('demoJ2GInput');
    var j2gBtn = document.getElementById('demoJ2GBtn');
    var j2gResult = document.getElementById('demoJ2GResult');
    if (j2gInput && j2gBtn && j2gResult) {
      var runJ2G = function () {
        var parsed = PC.parseJalali(j2gInput.value);
        if (!parsed) {
          j2gResult.innerHTML = '<span class="text-danger">' + esc(t('module_persian_calendar.day_disabled', 'غیرقابل انتخاب')) + '</span>';
          return;
        }
        var iso = PC.jalaliToIso(parsed.jy, parsed.jm, parsed.jd);
        j2gResult.innerHTML = '<span style="font-size:1.2rem" dir="ltr">' + esc(iso) + '</span>'
          + '<div class="small text-muted mt-1">' + esc(PC.weekdayName(PC.jalaliWeekdayIndex(parsed.jy, parsed.jm, parsed.jd))) + '</div>';
      };
      j2gBtn.addEventListener('click', runJ2G);
      j2gInput.addEventListener('change', runJ2G);
      runJ2G();
    }

    // ---------------------------------------------------------------
    // 4. Formatting showcase
    // ---------------------------------------------------------------
    var formatRows = document.getElementById('demoFormatRows');
    if (formatRows) {
      var sample = todayIsoString + 'T14:30';
      [
        ['YYYY/MM/DD', 'date'],
        ['YYYY-MM-DD', 'date'],
        ['DD MMMM YYYY', 'date'],
        ['WD، DD MMMM YYYY', 'date'],
        ['YYYY/MM/DD - HH:mm', 'datetime'],
        ['hh:mm a', 'time'],
        ['HH:mm', 'time']
      ].forEach(function (row) {
        var tr = document.createElement('tr');
        var patternCell = document.createElement('td');
        patternCell.dir = 'ltr';
        patternCell.innerHTML = '<code>' + esc(row[0]) + '</code>';
        var valueCell = document.createElement('td');
        valueCell.dir = 'rtl';
        valueCell.textContent = PC.format(sample, row[0]);
        tr.appendChild(patternCell);
        tr.appendChild(valueCell);
        formatRows.appendChild(tr);
      });
    }

    // ---------------------------------------------------------------
    // 5. Configuration summary
    // ---------------------------------------------------------------
    var configRows = document.getElementById('demoConfigRows');
    if (configRows) {
      var config = PC.config();
      Object.keys(config).forEach(function (key) {
        var value = config[key];
        if (typeof value === 'boolean') {
          value = value ? 'true' : 'false';
        } else if (Array.isArray(value)) {
          value = value.join(', ');
        }
        var tr = document.createElement('tr');
        var keyCell = document.createElement('td');
        keyCell.dir = 'ltr';
        keyCell.innerHTML = '<code>' + esc(key) + '</code>';
        var valueCell = document.createElement('td');
        valueCell.dir = 'ltr';
        valueCell.textContent = String(value);
        tr.appendChild(keyCell);
        tr.appendChild(valueCell);
        configRows.appendChild(tr);
      });
    }
    // ---------------------------------------------------------------
    // 6. Persian vs Latin digits toggle (per-browser preference)
    // ---------------------------------------------------------------
    var numeralsToggle = document.getElementById('pcPersianNumeralsToggle');
    if (numeralsToggle) {
      var numeralsLabel = document.getElementById('pcPersianNumeralsLabel');
      var syncNumeralsUi = function () {
        var on = PC.config().persianNumerals !== false;
        numeralsToggle.checked = on;
        if (numeralsLabel) {
          numeralsLabel.textContent = on
            ? t('module_persian_calendar.numerals_persian', 'Persian digits (۱۲۳)')
            : t('module_persian_calendar.numerals_latin', 'Latin digits (123)');
        }
      };
      numeralsToggle.addEventListener('change', function () {
        PC.setPersianNumerals(numeralsToggle.checked);
        syncNumeralsUi();
      });
      document.addEventListener('crm-persian-calendar:numerals-change', syncNumeralsUi);
      syncNumeralsUi();
    }
  });
}());
