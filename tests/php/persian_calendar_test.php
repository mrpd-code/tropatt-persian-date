<?php
declare(strict_types=1);

/**
 * Persian Calendar module - PHP unit tests (pure, no database, no HTTP).
 *
 * Run on any PHP >= 8.1:
 *   php tests/php/persian_calendar_test.php
 * Exit code 0 = all assertions passed.
 */

use Module\Crm\PersianCalendar\Service\JalaliCalendar;
use Module\Crm\PersianCalendar\Service\JalaliFormatter;
use Module\Crm\PersianCalendar\Service\PersianNumerals;

require __DIR__ . '/../../api/service/JalaliCalendar.php';
require __DIR__ . '/../../api/service/PersianNumerals.php';
require __DIR__ . '/../../api/service/JalaliFormatter.php';

$vectorsPath = __DIR__ . '/../data/conversion_vectors.json';
$vectors = is_file($vectorsPath)
    ? (json_decode((string)file_get_contents($vectorsPath), true) ?: [])
    : [];
$leapPath = __DIR__ . '/../data/leap_years.json';
$leapFixture = is_file($leapPath)
    ? (json_decode((string)file_get_contents($leapPath), true) ?: [])
    : ['leaps_1300_1500' => []];

$failures = [];
$checks = 0;

function check(bool $ok, string $message): void
{
    global $failures, $checks;
    $checks++;
    if (!$ok) {
        $failures[] = $message;
        fwrite(STDERR, "FAIL: {$message}\n");
    }
}

// ----------------------------------------------------------------------
// Specification examples
// ----------------------------------------------------------------------

check(JalaliCalendar::toJalali(2026, 3, 21) === ['jy' => 1405, 'jm' => 1, 'jd' => 1], '2026-03-21 -> 1405/01/01');
check(JalaliCalendar::toJalali(2026, 10, 31) === ['jy' => 1405, 'jm' => 8, 'jd' => 9], '2026-10-31 -> 1405/08/09');
check(JalaliCalendar::toGregorian(1405, 1, 1) === ['gy' => 2026, 'gm' => 3, 'gd' => 21], '1405/01/01 -> 2026-03-21');
check(JalaliCalendar::toGregorian(1405, 8, 9) === ['gy' => 2026, 'gm' => 10, 'gd' => 31], '1405/08/09 -> 2026-10-31');
check(JalaliCalendar::isoToJalali('2026-10-31') === ['jy' => 1405, 'jm' => 8, 'jd' => 9], 'isoToJalali');
check(JalaliCalendar::jalaliToIso(1405, 8, 9) === '2026-10-31', 'jalaliToIso');

// Nowruz anchors (verified against the ICU Persian calendar oracle).
foreach ([
    1399 => '2020-03-20', 1400 => '2021-03-21', 1401 => '2022-03-21',
    1402 => '2023-03-21', 1403 => '2024-03-20', 1404 => '2025-03-21',
    1405 => '2026-03-21', 1406 => '2027-03-21', 1407 => '2028-03-20',
    1408 => '2029-03-20', 1409 => '2030-03-21', 1410 => '2031-03-21',
] as $jy => $iso) {
    check(JalaliCalendar::jalaliToIso($jy, 1, 1) === $iso, "Nowruz {$jy} = {$iso}");
}

// Year boundary: leap Esfand.
check(JalaliCalendar::isLeap(1403) === true, '1403 is leap');
check(JalaliCalendar::isLeap(1402) === false, '1402 is not leap');
check(JalaliCalendar::isLeap(1408) === true, '1408 is leap');
check(JalaliCalendar::monthLength(1403, 12) === 30, 'Esfand 1403 has 30 days');
check(JalaliCalendar::monthLength(1404, 12) === 29, 'Esfand 1404 has 29 days');
check(JalaliCalendar::jalaliToIso(1403, 12, 30) === '2025-03-20', 'Esfand 30 1403 -> 2025-03-20');
check(JalaliCalendar::isoToJalali('2025-03-21') === ['jy' => 1404, 'jm' => 1, 'jd' => 1], '2025-03-21 -> Nowruz 1404');

// ----------------------------------------------------------------------
// Shared vectors: g2j, j2g, weekday
// ----------------------------------------------------------------------

foreach ($vectors as $vector) {
    [$gy, $gm, $gd] = array_map('intval', explode('-', $vector['g']));
    $got = JalaliCalendar::toJalali($gy, $gm, $gd);
    check($got === ['jy' => $vector['j'][0], 'jm' => $vector['j'][1], 'jd' => $vector['j'][2]],
        "g2j {$vector['g']}");
    $iso = JalaliCalendar::jalaliToIso($vector['j'][0], $vector['j'][1], $vector['j'][2]);
    check($iso === $vector['g'], "j2g {$vector['g']}");
    check(JalaliCalendar::jalaliWeekdayIndex($vector['j'][0], $vector['j'][1], $vector['j'][2]) === $vector['w'],
        "weekday {$vector['g']}");
}

// ----------------------------------------------------------------------
// Round trip over every day of 1340..1470
// ----------------------------------------------------------------------

$roundTripped = 0;
for ($jy = 1340; $jy <= 1470; $jy++) {
    for ($jm = 1; $jm <= 12; $jm++) {
        $length = JalaliCalendar::monthLength($jy, $jm);
        for ($jd = 1; $jd <= $length; $jd++) {
            $iso = JalaliCalendar::jalaliToIso($jy, $jm, $jd);
            [$gy, $gm, $gd] = array_map('intval', explode('-', $iso));
            check(JalaliCalendar::toJalali($gy, $gm, $gd) === ['jy' => $jy, 'jm' => $jm, 'jd' => $jd],
                "round-trip {$jy}/{$jm}/{$jd}");
            $roundTripped++;
        }
    }
}
check($roundTripped > 45000, "round-trip sweep covers > 45000 days (got {$roundTripped})");

// ----------------------------------------------------------------------
// Leap year reference list
// ----------------------------------------------------------------------

$computed = [];
for ($jy = 1300; $jy <= 1500; $jy++) {
    if (JalaliCalendar::isLeap($jy)) {
        $computed[] = $jy;
    }
}
check($computed === $leapFixture['leaps_1300_1500'], 'leap year list 1300-1500');

// ----------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------

check(JalaliCalendar::isValid(1405, 13, 1) === false, 'month 13 invalid');
check(JalaliCalendar::isValid(1405, 1, 32) === false, 'day 32 invalid');
check(JalaliCalendar::isValid(1405, 7, 31) === false, 'Mehr day 31 invalid');
check(JalaliCalendar::isValid(1405, 12, 30) === false, 'Esfand 30 in non-leap invalid');
check(JalaliCalendar::isValid(1403, 12, 30) === true, 'Esfand 30 in leap valid');

try {
    JalaliCalendar::toGregorian(1405, 13, 1);
    check(false, 'toGregorian(1405,13,1) must throw');
} catch (InvalidArgumentException) {
    check(true, 'toGregorian(1405,13,1) throws');
}

try {
    JalaliCalendar::toJalali(2026, 2, 30);
    check(false, 'toJalali(2026-02-30) must throw');
} catch (InvalidArgumentException) {
    check(true, 'toJalali(2026-02-30) throws');
}

// ----------------------------------------------------------------------
// Month grid
// ----------------------------------------------------------------------

$grid = JalaliCalendar::monthGrid(1405, 8, true);
check($grid['month_length'] === 30, 'grid month length');
check($grid['month_name'] === 'آبان', 'grid month name');
check(count($grid['weeks']) >= 4 && count($grid['weeks']) <= 6, 'grid week count');
$firstCell = null;
foreach ($grid['weeks'] as $week) {
    foreach ($week as $cell) {
        if ($cell !== null && $cell['in_month'] && $firstCell === null) {
            $firstCell = $cell;
        }
    }
}
check($firstCell !== null && $firstCell['weekday'] === $grid['first_weekday'], 'first in-month cell aligns with first_weekday');
foreach ($grid['weeks'] as $weekIndex => $week) {
    foreach ($week as $columnIndex => $cell) {
        if ($cell !== null) {
            check($cell['weekday'] === $columnIndex, "cell weekday column at week {$weekIndex} col {$columnIndex}");
        }
    }
}

$plain = JalaliCalendar::monthGrid(1403, 12, false);
$dayCount = 0;
foreach ($plain['weeks'] as $week) {
    foreach ($week as $cell) {
        if ($cell !== null && $cell['in_month']) {
            $dayCount++;
        }
    }
}
check($dayCount === 30, 'leap Esfand 1403 grid has 30 days');

// ----------------------------------------------------------------------
// Weekday helpers
// ----------------------------------------------------------------------

check(JalaliCalendar::weekdayIndex(2026, 10, 31) === 0, '2026-10-31 is shanbe');
check(JalaliCalendar::weekdayName(0) === 'شنبه', 'weekday name shanbe');
check(JalaliCalendar::weekdayName(6) === 'جمعه', 'weekday name jomeh');
check(JalaliCalendar::monthName(1) === 'فروردین', 'month name farvardin');
check(JalaliCalendar::monthName(12) === 'اسفند', 'month name esfand');

// ----------------------------------------------------------------------
// Numerals
// ----------------------------------------------------------------------

check(PersianNumerals::toPersian('1405/08/09') === '۱۴۰۵/۰۸/۰۹', 'numerals toPersian');
check(PersianNumerals::toLatin('۱۴۰۵/۰۸/۰۹') === '1405/08/09', 'numerals toLatin');
check(PersianNumerals::toLatin('١٤٠٥') === '1405', 'numerals arabic-indic to latin');
check(PersianNumerals::hasPersianDigits('۱۲۳') === true, 'hasPersianDigits true');
check(PersianNumerals::hasPersianDigits('123') === false, 'hasPersianDigits false');
check(PersianNumerals::pad(9, 2, true) === '۰۹', 'pad persian');
check(PersianNumerals::pad(9, 2, false) === '09', 'pad latin');

// ----------------------------------------------------------------------
// Formatter
// ----------------------------------------------------------------------

check(JalaliFormatter::format('2026-10-31', 'YYYY/MM/DD') === '۱۴۰۵/۰۸/۰۹', 'format YYYY/MM/DD');
check(JalaliFormatter::format('2026-10-31', 'YYYY-MM-DD') === '۱۴۰۵-۰۸-۰۹', 'format YYYY-MM-DD');
check(JalaliFormatter::format('2026-10-31', 'DD MMMM YYYY') === '۹ آبان ۱۴۰۵', 'format DD MMMM YYYY');
check(JalaliFormatter::format('2026-10-31', JalaliFormatter::FORMAT_FULL) === 'شنبه، ۹ آبان ۱۴۰۵', 'format FULL');
check(JalaliFormatter::format('2026-10-31 14:30:00', 'YYYY/MM/DD - HH:mm') === '۱۴۰۵/۰۸/۰۹ - ۱۴:۳۰', 'format datetime');
check(JalaliFormatter::format('2026-10-31 02:30:00', 'hh:mm a') === '۰۲:۳۰ ق.ظ', 'format 12h before noon');
check(JalaliFormatter::format('2026-10-31 14:30:00', 'hh:mm a') === '۰۲:۳۰ ب.ظ', 'format 12h after noon');
check(JalaliFormatter::format('2026-10-31', 'YYYY/MM/DD', ['persian_numerals' => false]) === '1405/08/09', 'format latin numerals');
check(JalaliFormatter::format('2026-03-21', 'WD، DD MMMM YYYY') === 'شنبه، ۱ فروردین ۱۴۰۵', 'format nowruz full');

check(JalaliFormatter::formatDate('2026-10-31') === '۱۴۰۵/۰۸/۰۹', 'formatDate default');
check(JalaliFormatter::formatDateTime('2026-10-31 14:30:00') === '۱۴۰۵/۰۸/۰۹ - ۱۴:۳۰', 'formatDateTime default');
check(JalaliFormatter::formatTime('2026-10-31 14:30:00') === '۱۴:۳۰', 'formatTime default');

// ----------------------------------------------------------------------
// Parser
// ----------------------------------------------------------------------

check(JalaliFormatter::parseJalali('۱۴۰۵/۰۸/۰۹') === ['jy' => 1405, 'jm' => 8, 'jd' => 9], 'parse persian digits');
check(JalaliFormatter::parseJalali('1405/8/9') === ['jy' => 1405, 'jm' => 8, 'jd' => 9], 'parse latin digits');
check(JalaliFormatter::parseJalali('1405-08-09') === ['jy' => 1405, 'jm' => 8, 'jd' => 9], 'parse dashes');
check(JalaliFormatter::parseJalali('۹ آبان ۱۴۰۵') === ['jy' => 1405, 'jm' => 8, 'jd' => 9], 'parse month name');
check(JalaliFormatter::parseJalali('1 فروردین 1405') === ['jy' => 1405, 'jm' => 1, 'jd' => 1], 'parse farvardin');
check(JalaliFormatter::parseJalali('1405/13/09') === null, 'parse invalid month');
check(JalaliFormatter::parseJalali('not a date') === null, 'parse garbage');

// ----------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------

echo "Persian Calendar PHP tests: {$checks} checks, " . count($failures) . " failures\n";
if ($failures !== []) {
    exit(1);
}
echo "ALL PASS\n";
exit(0);
