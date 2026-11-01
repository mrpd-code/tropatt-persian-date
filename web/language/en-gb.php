<?php
declare(strict_types=1);

/**
 * Persian Calendar module - English interface strings.
 * Namespace module_persian_calendar.* is served to the client
 * (window.CRM.messages) whenever the module assets are on the page.
 */
return [
    'module_persian_calendar' => [
        'title' => 'Persian Calendar',
        'subtitle' => 'Jalali (Shamsi) calendar, date picker and date-time picker for the TropaTT interface.',
        'page_title' => 'Persian Calendar — TropaTT',

        'tab_calendar' => 'Calendar',
        'tab_pickers' => 'Pickers',
        'tab_convert' => 'Conversion',
        'tab_format' => 'Formatting',
        'tab_api' => 'For developers',

        'btn_today' => 'Today',
        'btn_now' => 'Now',
        'btn_clear' => 'Clear',
        'btn_ok' => 'OK',
        'prev_month' => 'Previous month',
        'next_month' => 'Next month',
        'prev_year' => 'Previous year',
        'next_year' => 'Next year',
        'select_month' => 'Select month',
        'select_year' => 'Select year',
        'hours' => 'Hours',
        'minutes' => 'Minutes',
        'pick_date' => 'Pick a date',
        'pick_datetime' => 'Pick date and time',
        'open_calendar' => 'Open calendar',
        'day_disabled' => 'Not selectable',
        'calendar_label' => 'Persian calendar',

        'calendar_section_title' => 'Jalali month calendar',
        'calendar_section_hint' => 'Navigate with the buttons, the month/year selects, the keyboard (arrows, Enter, Page Up/Down) or the Today button.',

        'picker_date_label' => 'Date picker',
        'picker_date_hint' => 'The form field submits the Gregorian ISO value (YYYY-MM-DD); the user picks and sees the Jalali date.',
        'picker_datetime_label' => 'Date & time picker',
        'picker_datetime_hint' => 'Selects a full local date-time; the form receives YYYY-MM-DDTHH:mm.',
        'picker_restricted_label' => 'Picker with min/max limits',
        'picker_restricted_hint' => 'Only the allowed range is selectable; outside days are disabled.',
        'picker_readonly_label' => 'Read-only display',
        'picker_readonly_hint' => 'Shows the Jalali value of an existing Gregorian date without allowing changes.',
        'picker_value_label' => 'Value returned to the application (ISO):',
        'picker_display_label' => 'Displayed (Jalali):',

        'convert_title' => 'Gregorian ⇄ Jalali conversion',
        'convert_gregorian_input' => 'Gregorian date',
        'convert_jalali_input' => 'Jalali date',
        'convert_to_jalali' => 'Convert to Jalali',
        'convert_to_gregorian' => 'Convert to Gregorian',
        'convert_result' => 'Result',

        'format_title' => 'Formatting utilities',
        'format_hint' => 'window.CRM.PersianCalendar.format() with the shared token patterns:',

        'api_title' => 'Using the module from other modules and pages',
        'today_is' => 'Today',

        'config_title' => 'Active configuration',

        'numerals_title' => 'Digit style for dates',
        'numerals_persian' => 'Persian digits (۱۲۳)',
        'numerals_latin' => 'Latin digits (123)',
        'numerals_hint' => 'Applies to every date in the interface; saved in this browser only.',
    ],
];
