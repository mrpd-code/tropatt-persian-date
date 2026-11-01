<?php
declare(strict_types=1);

namespace Module\Crm\PersianCalendar\Service;

/**
 * Pure Jalali (Shamsi) <-> Gregorian conversion engine.
 *
 * Implements the standard 33-year break-cycle arithmetic used by the
 * de-facto reference implementations of the Solar Hijri calendar
 * (algorithm popularized by jalaali-js, MIT licensed). Pure integer
 * math, no external dependencies, no database, no I/O.
 *
 * All divisions truncate toward zero (PHP intdiv()) and all remainders
 * keep the sign of the dividend (PHP %) - this matches the JavaScript
 * reference implementation exactly and is validated by the shared test
 * vectors in tests/data/conversion_vectors.json.
 *
 * Supported Jalali year range: 1178 (Gregorian 1799) .. 3177 (3801).
 */
final class JalaliCalendar
{
    /** Rejected-year error code used by the API layer. */
    public const ERROR_INVALID_YEAR = 'INVALID_JALALI_YEAR';

    /**
     * Break years of the 33-year cycle calibration table.
     * Identical to the reference implementation (jalaali-js).
     */
    private const BREAKS = [
        -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
        1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
    ];

    public const MIN_JALALI_YEAR = 1178;
    public const MAX_JALALI_YEAR = 3177;

    /** Persian month names, 1-based index (1 = Farvardin). */
    public const MONTH_NAMES = [
        1 => 'فروردین',
        2 => 'اردیبهشت',
        3 => 'خرداد',
        4 => 'تیر',
        5 => 'مرداد',
        6 => 'شهریور',
        7 => 'مهر',
        8 => 'آبان',
        9 => 'آذر',
        10 => 'دی',
        11 => 'بهمن',
        12 => 'اسفند',
    ];

    /** Short Persian month names, 1-based. */
    public const MONTH_NAMES_SHORT = [
        1 => 'فروردین',
        2 => 'اردیبهشت',
        3 => 'خرداد',
        4 => 'تیر',
        5 => 'مرداد',
        6 => 'شهریور',
        7 => 'مهر',
        8 => 'آبان',
        9 => 'آذر',
        10 => 'دی',
        11 => 'بهمن',
        12 => 'اسفند',
    ];

    /**
     * Persian weekday names, 0-based with Saturday first
     * (0 = shanbe, 6 = jomeh) - the week layout of the Jalali calendar.
     */
    public const WEEKDAY_NAMES = [
        0 => 'شنبه',
        1 => 'یکشنبه',
        2 => 'دوشنبه',
        3 => 'سه‌شنبه',
        4 => 'چهارشنبه',
        5 => 'پنجشنبه',
        6 => 'جمعه',
    ];

    /** Short weekday names, 0-based with Saturday first. */
    public const WEEKDAY_NAMES_SHORT = [
        0 => 'ش',
        1 => 'ی',
        2 => 'د',
        3 => 'س',
        4 => 'چ',
        5 => 'پ',
        6 => 'ج',
    ];

    /**
     * Convert a Gregorian date to Jalali.
     *
     * @param int $gy Gregorian year
     * @param int $gm Gregorian month 1-12
     * @param int $gd Gregorian day 1-31
     * @return array{jy:int, jm:int, jd:int}
     * @throws \InvalidArgumentException when the input is not a valid date
     */
    public static function toJalali(int $gy, int $gm, int $gd): array
    {
        if (!checkdate($gm, $gd, $gy)) {
            throw new \InvalidArgumentException(sprintf('Invalid Gregorian date %04d-%02d-%02d', $gy, $gm, $gd));
        }

        $j = self::d2j(self::g2d($gy, $gm, $gd));

        return ['jy' => $j['jy'], 'jm' => $j['jm'], 'jd' => $j['jd']];
    }

    /**
     * Convert a Jalali date to Gregorian.
     *
     * @param int $jy Jalali year
     * @param int $jm Jalali month 1-12
     * @param int $jd Jalali day 1-31
     * @return array{gy:int, gm:int, gd:int}
     * @throws \InvalidArgumentException when the input is not a valid Jalali date
     */
    public static function toGregorian(int $jy, int $jm, int $jd): array
    {
        if (!self::isValid($jy, $jm, $jd)) {
            throw new \InvalidArgumentException(sprintf('Invalid Jalali date %04d/%02d/%02d', $jy, $jm, $jd));
        }

        $g = self::d2g(self::j2d($jy, $jm, $jd));

        return ['gy' => $g['gy'], 'gm' => $g['gm'], 'gd' => $g['gd']];
    }

    /**
     * Parse an ISO-8601 calendar date ('YYYY-MM-DD', date part only) and
     * return its Jalali equivalent. Timezone-naive on purpose: a stored
     * calendar date must convert without local-time shifts.
     *
     * @return array{jy:int, jm:int, jd:int}
     */
    public static function isoToJalali(string $isoDate): array
    {
        $normalized = trim($isoDate);
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $normalized, $m) !== 1) {
            throw new \InvalidArgumentException('Expected an ISO date (YYYY-MM-DD), got: ' . $normalized);
        }

        return self::toJalali((int)$m[1], (int)$m[2], (int)$m[3]);
    }

    /**
     * Convert a Jalali date to the ISO-8601 calendar date 'YYYY-MM-DD'
     * used by the existing TropaTT storage and API contracts.
     */
    public static function jalaliToIso(int $jy, int $jm, int $jd): string
    {
        $g = self::toGregorian($jy, $jm, $jd);

        return sprintf('%04d-%02d-%02d', $g['gy'], $g['gm'], $g['gd']);
    }

    /**
     * True when the given Jalali year is a leap year (Esfand has 30 days).
     */
    public static function isLeap(int $jy): bool
    {
        self::assertYear($jy);

        return self::jalCal($jy)['leap'] === 0;
    }

    /**
     * Number of days in a Jalali month (31 for months 1-6, 30 for 7-11,
     * 29/30 for Esfand depending on the leap year).
     */
    public static function monthLength(int $jy, int $jm): int
    {
        self::assertYear($jy);
        if ($jm < 1 || $jm > 12) {
            throw new \InvalidArgumentException('Jalali month must be 1-12, got: ' . $jm);
        }

        if ($jm <= 6) {
            return 31;
        }
        if ($jm <= 11) {
            return 30;
        }

        return self::isLeap($jy) ? 30 : 29;
    }

    /**
     * Validate a Jalali calendar date.
     */
    public static function isValid(int $jy, int $jm, int $jd): bool
    {
        try {
            self::assertYear($jy);
        } catch (\InvalidArgumentException) {
            return false;
        }

        if ($jm < 1 || $jm > 12 || $jd < 1) {
            return false;
        }

        return $jd <= self::monthLength($jy, $jm);
    }

    /**
     * Today's Jalali date, computed from the given timezone (server default
     * when omitted). Timezone is explicit so tests are deterministic.
     *
     * @return array{jy:int, jm:int, jd:int}
     */
    public static function today(?\DateTimeZone $timezone = null): array
    {
        $now = new \DateTimeImmutable('now', $timezone ?? new \DateTimeZone(date_default_timezone_get()));
        [$gy, $gm, $gd] = array_map('intval', explode('-', $now->format('Y-m-d')));

        return self::toJalali($gy, $gm, $gd);
    }

    /**
     * Persian weekday index (0 = Saturday/shanbe .. 6 = Friday/jomeh)
     * for a Gregorian date.
     */
    public static function weekdayIndex(int $gy, int $gm, int $gd): int
    {
        if (!checkdate($gm, $gd, $gy)) {
            throw new \InvalidArgumentException(sprintf('Invalid Gregorian date %04d-%02d-%02d', $gy, $gm, $gd));
        }

        // ISO-8601 weekday: 1 = Monday .. 7 = Sunday.
        $iso = (int)(new \DateTimeImmutable(sprintf('%04d-%02d-%02d', $gy, $gm, $gd)))->format('N');
        // Map onto the Persian week that starts on Saturday.
        return ($iso + 1) % 7;
    }

    /**
     * Persian weekday index for a Jalali date.
     */
    public static function jalaliWeekdayIndex(int $jy, int $jm, int $jd): int
    {
        $g = self::toGregorian($jy, $jm, $jd);

        return self::weekdayIndex($g['gy'], $g['gm'], $g['gd']);
    }

    /**
     * Persian month name (1-based month index).
     */
    public static function monthName(int $jm, bool $short = false): string
    {
        $names = $short ? self::MONTH_NAMES_SHORT : self::MONTH_NAMES;

        return $names[$jm] ?? '';
    }

    /**
     * Persian weekday name (0 = shanbe).
     */
    public static function weekdayName(int $index, bool $short = false): string
    {
        $names = $short ? self::WEEKDAY_NAMES_SHORT : self::WEEKDAY_NAMES;
        $index = $index % 7;

        return $names[$index] ?? '';
    }

    /**
     * Build a month grid exactly as the UI renders it: rows of 7 cells
     * starting on the configured first weekday (Saturday by default),
     * including optional leading/trailing days of adjacent months.
     *
     * @return array{
     *   jy:int, jm:int, leap:bool, month_length:int, first_weekday:int,
     *   weeks: list<list<array{jy:int, jm:int, jd:int, gy:int, gm:int, gd:int,
     *     iso:string, in_month:bool, weekday:int}>>,
     *   month_name:string, year_gregorian_start:string, year_gregorian_end:string
     * }
     */
    public static function monthGrid(int $jy, int $jm, bool $withAdjacent = true): array
    {
        self::assertYear($jy);
        if ($jm < 1 || $jm > 12) {
            throw new \InvalidArgumentException('Jalali month must be 1-12, got: ' . $jm);
        }

        $monthLength = self::monthLength($jy, $jm);
        $firstWeekday = self::jalaliWeekdayIndex($jy, $jm, 1);

        $prevJm = $jm === 1 ? 12 : $jm - 1;
        $prevJy = $jm === 1 ? $jy - 1 : $jy;
        $nextJm = $jm === 12 ? 1 : $jm + 1;
        $nextJy = $jm === 12 ? $jy + 1 : $jy;

        $cells = [];

        if ($withAdjacent) {
            $prevLength = self::monthLength($prevJy, $prevJm);
            for ($lead = $firstWeekday; $lead > 0; $lead--) {
                $jd = $prevLength - $lead + 1;
                $cells[] = ['jy' => $prevJy, 'jm' => $prevJm, 'jd' => $jd, 'in_month' => false];
            }
        } elseif ($firstWeekday > 0) {
            for ($lead = $firstWeekday; $lead > 0; $lead--) {
                $cells[] = null;
            }
        }

        for ($day = 1; $day <= $monthLength; $day++) {
            $cells[] = ['jy' => $jy, 'jm' => $jm, 'jd' => $day, 'in_month' => true];
        }

        if ($withAdjacent) {
            $trail = count($cells) % 7;
            if ($trail > 0) {
                for ($day = 1; $day <= 7 - $trail; $day++) {
                    $cells[] = ['jy' => $nextJy, 'jm' => $nextJm, 'jd' => $day, 'in_month' => false];
                }
            }
        } else {
            $trail = count($cells) % 7;
            if ($trail > 0) {
                for ($i = 0; $i < 7 - $trail; $i++) {
                    $cells[] = null;
                }
            }
        }

        $weeks = [];
        $week = [];
        foreach ($cells as $cell) {
            if ($cell === null) {
                $week[] = null;
            } else {
                $g = self::toGregorian($cell['jy'], $cell['jm'], $cell['jd']);
                $week[] = [
                    'jy' => $cell['jy'],
                    'jm' => $cell['jm'],
                    'jd' => $cell['jd'],
                    'gy' => $g['gy'],
                    'gm' => $g['gm'],
                    'gd' => $g['gd'],
                    'iso' => sprintf('%04d-%02d-%02d', $g['gy'], $g['gm'], $g['gd']),
                    'in_month' => $cell['in_month'],
                    'weekday' => count($week),
                ];
            }
            if (count($week) === 7) {
                $weeks[] = $week;
                $week = [];
            }
        }

        $firstDay = self::toGregorian($jy, $jm, 1);
        $lastDay = self::toGregorian($jy, $jm, $monthLength);

        return [
            'jy' => $jy,
            'jm' => $jm,
            'leap' => self::isLeap($jy),
            'month_length' => $monthLength,
            'first_weekday' => $firstWeekday,
            'weeks' => $weeks,
            'month_name' => self::monthName($jm),
            'year_gregorian_start' => sprintf('%04d-%02d-%02d', $firstDay['gy'], $firstDay['gm'], $firstDay['gd']),
            'year_gregorian_end' => sprintf('%04d-%02d-%02d', $lastDay['gy'], $lastDay['gm'], $lastDay['gd']),
        ];
    }

    // ------------------------------------------------------------------
    // Internal arithmetic (33-year break cycle, reference: jalaali-js)
    // ------------------------------------------------------------------

    /**
     * @return array{leap:int, gy:int, march:int}
     */
    private static function jalCal(int $jy): array
    {
        $breaks = self::BREAKS;
        $bl = count($breaks);
        $gy = $jy + 621;
        $leapJ = -14;
        $jp = $breaks[0];
        $jm = 0;
        $jump = 0;
        $leap = 0;

        if ($jy < $jp || $jy >= $breaks[$bl - 1]) {
            throw new \InvalidArgumentException(self::ERROR_INVALID_YEAR . ': ' . $jy);
        }

        for ($i = 1; $i < $bl; $i++) {
            $jm = $breaks[$i];
            $jump = $jm - $jp;
            if ($jy < $jm) {
                break;
            }
            $leapJ = $leapJ + intdiv($jump, 33) * 8 + intdiv($jump % 33, 4);
            $jp = $jm;
        }

        $n = $jy - $jp;
        $leapJ = $leapJ + intdiv($n, 33) * 8 + intdiv($n % 33 + 3, 4);
        if ($jump % 33 === 4 && $jump - $n === 4) {
            $leapJ++;
        }

        $leapG = intdiv($gy, 4) - intdiv((intdiv($gy, 100) + 1) * 3, 4) - 150;
        $march = 20 + $leapJ - $leapG;

        if ($jump - $n < 6) {
            $n = $n - $jump + intdiv($jump + 4, 33) * 33;
        }

        $leap = ($n + 1) % 33 - 1;
        $leap = $leap % 4;
        if ($leap === -1) {
            $leap = 4;
        }

        return ['leap' => $leap, 'gy' => $gy, 'march' => $march];
    }

    /**
     * Gregorian date to Julian Day Number (truncating integer division
     * keeps this identical to the JS reference implementation).
     */
    private static function g2d(int $gy, int $gm, int $gd): int
    {
        $d = intdiv(($gy + intdiv($gm - 8, 6) + 100100) * 1461, 4)
            + intdiv(153 * (($gm + 9) % 12) + 2, 5)
            + $gd - 34840408;
        $d = $d - intdiv(intdiv($gy + 100100 + intdiv($gm - 8, 6), 100) * 3, 4) + 752;

        return $d;
    }

    /**
     * Julian Day Number to Gregorian date.
     *
     * @return array{gy:int, gm:int, gd:int}
     */
    private static function d2g(int $jdn): array
    {
        $j = 4 * $jdn + 139361631;
        $j = $j + intdiv(intdiv(4 * $jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
        $i = intdiv($j % 1461, 4) * 5 + 308;
        $gd = intdiv($i % 153, 5) + 1;
        $gm = intdiv($i, 153) % 12 + 1;
        $gy = intdiv($j, 1461) - 100100 + intdiv(8 - $gm, 6);

        return ['gy' => $gy, 'gm' => $gm, 'gd' => $gd];
    }

    /**
     * Jalali date to Julian Day Number.
     */
    private static function j2d(int $jy, int $jm, int $jd): int
    {
        $r = self::jalCal($jy);

        return self::g2d($r['gy'], 3, $r['march']) + ($jm - 1) * 31 - intdiv($jm, 7) * ($jm - 7) + $jd - 1;
    }

    /**
     * Julian Day Number to Jalali date.
     *
     * @return array{jy:int, jm:int, jd:int}
     */
    private static function d2j(int $jdn): array
    {
        $gy = self::d2g($jdn)['gy'];
        $jy = $gy - 621;
        $r = self::jalCal($jy);
        $jdn1f = self::g2d($gy, 3, $r['march']);
        $k = $jdn - $jdn1f;

        if ($k >= 0) {
            if ($k <= 185) {
                return ['jy' => $jy, 'jm' => 1 + intdiv($k, 31), 'jd' => $k % 31 + 1];
            }
            $k -= 186;
        } else {
            $jy--;
            $k += 179;
            if ($r['leap'] === 1) {
                $k++;
            }
        }

        return ['jy' => $jy, 'jm' => 7 + intdiv($k, 30), 'jd' => $k % 30 + 1];
    }

    private static function assertYear(int $jy): void
    {
        if ($jy < self::MIN_JALALI_YEAR || $jy > self::MAX_JALALI_YEAR) {
            throw new \InvalidArgumentException(sprintf(
                'Jalali year must be between %d and %d, got: %d',
                self::MIN_JALALI_YEAR,
                self::MAX_JALALI_YEAR,
                $jy
            ));
        }
    }
}
