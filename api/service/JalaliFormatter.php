<?php
declare(strict_types=1);

namespace Module\Crm\PersianCalendar\Service;

/**
 * Jalali date/time formatter with a token mini-language shared 1:1 with the
 * JavaScript formatter (web/assets/js/persian-calendar.js), so the server
 * and the client always render identical strings.
 *
 * Supported tokens:
 *   YYYY  4-digit Jalali year          ۱۴۰۵
 *   YY    2-digit Jalali year          ۰۵
 *   MMMM  Persian month name           آبان
 *   MMM   short Persian month name     آبان
 *   MM    2-digit month                ۰۸
 *   M     month without padding        ۸
 *   DD    2-digit day                  ۰۹
 *   D     day without padding          ۹
 *   WD    full Persian weekday         شنبه
 *   W     one-letter weekday           ش
 *   HH    2-digit hour, 24h            ۱۴
 *   H     hour 24h without padding     ۱۴
 *   hh    2-digit hour, 12h            ۰۲
 *   h     hour 12h without padding     ۲
 *   mm    2-digit minute               ۳۰
 *   m     minute without padding       ۳۰
 *   ss    2-digit second               ۰۰
 *   a     Persian meridiem             ب.ظ / ق.ظ
 *   A     Persian meridiem wide        بعدازظهر / قبل‌ازظهر
 *
 * Any text wrapped in single quotes is emitted verbatim ('...' -> literal).
 *
 * Common presets are exposed as FORMAT_* constants and mirrored in JS.
 */
final class JalaliFormatter
{
    public const FORMAT_SHORT = 'YYYY/MM/DD';
    public const FORMAT_ISO = 'YYYY-MM-DD';
    public const FORMAT_LONG = 'DD MMMM YYYY';
    public const FORMAT_FULL = 'WD، DD MMMM YYYY';
    public const FORMAT_DATETIME = 'YYYY/MM/DD - HH:mm';
    public const FORMAT_TIME = 'HH:mm';
    public const FORMAT_TIME_12 = 'hh:mm a';

    private const MERIDIEM_BEFORE = 'ق.ظ';
    private const MERIDIEM_AFTER = 'ب.ظ';

    /**
     * Format a Gregorian date/time value into a Jalali string.
     *
     * @param \DateTimeInterface|string $value Gregorian date ('Y-m-d') or
     *        date-time ('Y-m-d H:i:s' / ISO-8601). Date-only values are
     *        timezone-naive by design.
     * @param string $pattern Token pattern (see class docs) or '' for the default.
     * @param array{persian_numerals?:bool} $opts
     */
    public static function format(\DateTimeInterface|string $value, string $pattern = '', array $opts = []): string
    {
        $persianNumerals = (bool)($opts['persian_numerals'] ?? true);

        $date = $value instanceof \DateTimeInterface
            ? $value
            : self::parseDateTime((string)$value);

        $j = JalaliCalendar::toJalali(
            (int)$date->format('Y'),
            (int)$date->format('n'),
            (int)$date->format('j')
        );

        $hour = (int)$date->format('G');
        $hour12 = $hour % 12;
        if ($hour12 === 0) {
            $hour12 = 12;
        }

        $replacements = [
            'YYYY' => (string)$j['jy'],
            'YY' => str_pad((string)($j['jy'] % 100), 2, '0', STR_PAD_LEFT),
            'MMMM' => JalaliCalendar::monthName($j['jm']),
            'MMM' => JalaliCalendar::monthName($j['jm'], true),
            'MM' => str_pad((string)$j['jm'], 2, '0', STR_PAD_LEFT),
            'M' => (string)$j['jm'],
            'DD' => str_pad((string)$j['jd'], 2, '0', STR_PAD_LEFT),
            'D' => (string)$j['jd'],
            'WD' => JalaliCalendar::weekdayName(JalaliCalendar::weekdayIndex(
                (int)$date->format('Y'), (int)$date->format('n'), (int)$date->format('j')
            )),
            'W' => JalaliCalendar::weekdayName(JalaliCalendar::weekdayIndex(
                (int)$date->format('Y'), (int)$date->format('n'), (int)$date->format('j')
            ), true),
            'HH' => $date->format('H'),
            'H' => (string)$hour,
            'hh' => str_pad((string)$hour12, 2, '0', STR_PAD_LEFT),
            'h' => (string)$hour12,
            'mm' => $date->format('i'),
            'm' => (string)(int)$date->format('i'),
            'ss' => $date->format('s'),
            'a' => $hour < 12 ? self::MERIDIEM_BEFORE : self::MERIDIEM_AFTER,
            'A' => $hour < 12 ? 'قبل‌ازظهر' : 'بعدازظهر',
        ];

        $pattern = $pattern !== '' ? $pattern : self::FORMAT_SHORT;
        // Persian typography never zero-pads the day of month before a month
        // name ("۹ آبان ۱۴۰۵"), so 'DD' followed by MMMM/MMM renders unpadded -
        // exactly as the specification examples show. Mirrors the JS formatter.
        $pattern = preg_replace('/DD(?=\s+MMMM?)/', 'D', $pattern) ?? $pattern;
        $result = self::applyTokens($pattern, $replacements);

        return $persianNumerals ? PersianNumerals::toPersian($result) : $result;
    }

    /**
     * Format only the date part (uses FORMAT_SHORT by default).
     */
    public static function formatDate(\DateTimeInterface|string $value, string $pattern = '', array $opts = []): string
    {
        return self::format($value, $pattern !== '' ? $pattern : self::FORMAT_SHORT, $opts);
    }

    /**
     * Format date and time (uses FORMAT_DATETIME by default).
     */
    public static function formatDateTime(\DateTimeInterface|string $value, string $pattern = '', array $opts = []): string
    {
        return self::format($value, $pattern !== '' ? $pattern : self::FORMAT_DATETIME, $opts);
    }

    /**
     * Format only the time part (uses FORMAT_TIME by default).
     */
    public static function formatTime(\DateTimeInterface|string $value, string $pattern = '', array $opts = []): string
    {
        return self::format($value, $pattern !== '' ? $pattern : self::FORMAT_TIME, $opts);
    }

    /**
     * Parse a human Jalali date string ('۱۴۰۵/۰۸/۰۹', '1405/8/9',
     * '1405-08-09', also with month name '۹ آبان ۱۴۰۵') into a Jalali date.
     *
     * @return array{jy:int, jm:int, jd:int}|null
     */
    public static function parseJalali(string $input): ?array
    {
        $normalized = trim(PersianNumerals::toLatin($input));
        $normalized = str_replace(['/', '.'], '-', $normalized);
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;

        if (preg_match('/^(\d{3,4})-(\d{1,2})-(\d{1,2})$/', $normalized, $m) === 1) {
            $jy = (int)$m[1];
            $jm = (int)$m[2];
            $jd = (int)$m[3];

            return JalaliCalendar::isValid($jy, $jm, $jd) ? ['jy' => $jy, 'jm' => $jm, 'jd' => $jd] : null;
        }

        // '۹ آبان ۱۴۰۵' / '9 Aban 1405' (month-name form).
        $monthNames = array_map(
            static fn(string $name): string => preg_quote($name, '/'),
            JalaliCalendar::MONTH_NAMES
        );
        $monthsPattern = implode('|', $monthNames);
        if (preg_match('/^(\d{1,2}) (' . $monthsPattern . ') (\d{3,4})$/u', $normalized, $m) === 1) {
            $jm = 0;
            foreach (JalaliCalendar::MONTH_NAMES as $index => $name) {
                if ($name === $m[2]) {
                    $jm = $index;
                    break;
                }
            }
            if ($jm > 0) {
                $jy = (int)$m[3];
                $jd = (int)$m[1];

                return JalaliCalendar::isValid($jy, $jm, $jd) ? ['jy' => $jy, 'jm' => $jm, 'jd' => $jd] : null;
            }
        }

        return null;
    }

    /**
     * Apply the token replacements, honoring single-quoted literals.
     *
     * @param array<string, string> $replacements Longest tokens first.
     */
    private static function applyTokens(string $pattern, array $replacements): string
    {
        $out = '';
        $len = strlen($pattern);
        $i = 0;

        while ($i < $len) {
            $char = $pattern[$i];

            if ($char === "'") {
                // Literal until the next single quote (or end).
                $end = strpos($pattern, "'", $i + 1);
                if ($end === false) {
                    $out .= substr($pattern, $i + 1);
                    break;
                }
                $out .= substr($pattern, $i + 1, $end - $i - 1);
                $i = $end + 1;
                continue;
            }

            $matched = false;
            // Try longest token that fits at the current position.
            for ($tokenLength = 4; $tokenLength >= 1; $tokenLength--) {
                $token = substr($pattern, $i, $tokenLength);
                if ($token === false || $token === '') {
                    continue;
                }
                if (isset($replacements[$token])) {
                    $out .= $replacements[$token];
                    $i += $tokenLength;
                    $matched = true;
                    break;
                }
            }

            if (!$matched) {
                $out .= $char;
                $i++;
            }
        }

        return $out;
    }

    private static function parseDateTime(string $value): \DateTimeImmutable
    {
        $trimmed = trim($value);

        $formats = [
            'Y-m-d H:i:s',
            'Y-m-d H:i',
            'Y-m-d\TH:i:s',
            'Y-m-d\TH:i',
            'Y-m-d\TH:i:sP',
            'Y-m-d\TH:iP',
            'Y-m-d',
        ];

        foreach ($formats as $format) {
            $date = \DateTimeImmutable::createFromFormat($format, $trimmed);
            if ($date instanceof \DateTimeImmutable) {
                return $date;
            }
        }

        throw new \InvalidArgumentException('Unparseable Gregorian date/time: ' . $value);
    }
}
