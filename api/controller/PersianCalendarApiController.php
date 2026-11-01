<?php
declare(strict_types=1);

namespace Module\Crm\PersianCalendar\Controller;

use Api\System\Library\Container;
use Api\System\Library\Http\JsonResponse;
use Module\Crm\PersianCalendar\Service\JalaliCalendar;
use Module\Crm\PersianCalendar\Service\JalaliFormatter;

/**
 * REST endpoints for the Persian calendar module.
 *
 * Mounted by the core under /_module/crm.persian-calendar/...
 * Every endpoint is pure presentation math: no tables, no writes,
 * nothing that touches how TropaTT stores dates.
 */
final class PersianCalendarApiController
{
    private const MODULE_NAME = 'crm.persian-calendar';

    /** Defaults mirrored from manifest.json config_defaults. */
    private const CONFIG_DEFAULTS = [
        'default_calendar' => 'persian',
        'date_format' => 'YYYY/MM/DD',
        'datetime_format' => 'YYYY/MM/DD - HH:mm',
        'time_format' => 'HH:mm',
        'hour_format' => '24h',
        'persian_numerals' => true,
        'first_day_of_week' => 'saturday',
        'minute_step' => 5,
        'direction' => 'rtl',
        'highlight_today' => true,
        'show_adjacent_days' => true,
        'weekend_day' => 'friday',
        'dashboard_widget_enabled' => true,
        'profile_panel_enabled' => true,
        'autoformat_enabled' => true,
        'autoformat_selectors' => ['[data-crm-persian-date]', '[datetime]'],
    ];

    public function __construct(private readonly Container $container) {}

    /**
     * Display configuration for the frontend library. Readable by every
     * authenticated user (it contains no secrets) so pickers and the
     * autoformatter can initialize without admin permissions.
     */
    public function config(array $params = []): JsonResponse
    {
        return JsonResponse::success('PERSIAN_CALENDAR_CONFIG', 'OK', [
            'config' => $this->moduleConfig(),
        ]);
    }

    /**
     * Today in both calendars plus ready-to-render localized strings.
     */
    public function today(array $params = []): JsonResponse
    {
        try {
            $tz = new \DateTimeZone(date_default_timezone_get());
            $now = new \DateTimeImmutable('now', $tz);
            $j = JalaliCalendar::today($tz);
        } catch (\Throwable $e) {
            return JsonResponse::error('PERSIAN_CALENDAR_ERROR', $e->getMessage(), 500);
        }

        $config = $this->moduleConfig();

        return JsonResponse::success('PERSIAN_CALENDAR_TODAY', 'OK', [
            'jalali' => ['jy' => $j['jy'], 'jm' => $j['jm'], 'jd' => $j['jd']],
            'gregorian_iso' => $now->format('Y-m-d'),
            'gregorian_datetime' => $now->format('Y-m-d H:i:s'),
            'weekday' => JalaliCalendar::weekdayName(JalaliCalendar::jalaliWeekdayIndex($j['jy'], $j['jm'], $j['jd'])),
            'month_name' => JalaliCalendar::monthName($j['jm']),
            'formatted' => [
                'date' => JalaliFormatter::formatDate($now, '', ['persian_numerals' => (bool)($config['persian_numerals'] ?? true)]),
                'long' => JalaliFormatter::format($now, JalaliFormatter::FORMAT_LONG, ['persian_numerals' => (bool)($config['persian_numerals'] ?? true)]),
                'full' => JalaliFormatter::format($now, JalaliFormatter::FORMAT_FULL, ['persian_numerals' => (bool)($config['persian_numerals'] ?? true)]),
                'datetime' => JalaliFormatter::formatDateTime($now, '', ['persian_numerals' => (bool)($config['persian_numerals'] ?? true)]),
            ],
        ]);
    }

    /**
     * Gregorian -> Jalali. ?date=YYYY-MM-DD
     */
    public function convertToJalali(array $params = []): JsonResponse
    {
        $date = trim((string)($this->queryParam($params, 'date') ?? ''));
        if ($date === '') {
            return JsonResponse::error('INVALID_PARAM', 'date (YYYY-MM-DD) is required', 400);
        }

        try {
            $j = JalaliCalendar::isoToJalali($date);
        } catch (\Throwable $e) {
            return JsonResponse::error('INVALID_PARAM', $e->getMessage(), 400);
        }

        $weekday = JalaliCalendar::weekdayName(JalaliCalendar::jalaliWeekdayIndex($j['jy'], $j['jm'], $j['jd']));

        return JsonResponse::success('PERSIAN_CALENDAR_G2J', 'OK', [
            'source_gregorian' => $date,
            'jalali' => ['jy' => $j['jy'], 'jm' => $j['jm'], 'jd' => $j['jd']],
            'jalali_label' => sprintf('%04d/%02d/%02d', $j['jy'], $j['jm'], $j['jd']),
            'jalali_long' => JalaliFormatter::format($date, JalaliFormatter::FORMAT_LONG),
            'weekday' => $weekday,
            'month_name' => JalaliCalendar::monthName($j['jm']),
        ]);
    }

    /**
     * Jalali -> Gregorian. ?jy=&jm=&jd= or ?date=1405/08/09 (Persian digits OK).
     */
    public function convertToGregorian(array $params = []): JsonResponse
    {
        $dateParam = trim((string)($this->queryParam($params, 'date') ?? ''));
        $jy = (int)($this->queryParam($params, 'jy') ?? 0);
        $jm = (int)($this->queryParam($params, 'jm') ?? 0);
        $jd = (int)($this->queryParam($params, 'jd') ?? 0);

        if ($dateParam !== '') {
            $parsed = JalaliFormatter::parseJalali($dateParam);
            if ($parsed === null) {
                return JsonResponse::error('INVALID_PARAM', 'Unparseable Jalali date: ' . $dateParam, 400);
            }
            $jy = $parsed['jy'];
            $jm = $parsed['jm'];
            $jd = $parsed['jd'];
        }

        if ($jy <= 0 || $jm <= 0 || $jd <= 0) {
            return JsonResponse::error('INVALID_PARAM', 'Provide date=YYYY/MM/DD or jy, jm, jd', 400);
        }

        try {
            $iso = JalaliCalendar::jalaliToIso($jy, $jm, $jd);
        } catch (\Throwable $e) {
            return JsonResponse::error('INVALID_PARAM', $e->getMessage(), 400);
        }

        $weekday = JalaliCalendar::weekdayName(JalaliCalendar::jalaliWeekdayIndex($jy, $jm, $jd));

        return JsonResponse::success('PERSIAN_CALENDAR_J2G', 'OK', [
            'source_jalali' => sprintf('%04d/%02d/%02d', $jy, $jm, $jd),
            'gregorian' => ['gy' => (int)substr($iso, 0, 4), 'gm' => (int)substr($iso, 5, 2), 'gd' => (int)substr($iso, 8, 2)],
            'gregorian_iso' => $iso,
            'jalali_long' => JalaliFormatter::format($iso, JalaliFormatter::FORMAT_LONG),
            'weekday' => $weekday,
        ]);
    }

    /**
     * Month grid: weeks of cells with Jalali + Gregorian values,
     * exactly as the calendar UI lays them out. ?jy=&jm=&with_adjacent=1
     */
    public function month(array $params = []): JsonResponse
    {
        $today = JalaliCalendar::today();
        $jy = (int)($this->queryParam($params, 'jy') ?? $today['jy']);
        $jm = (int)($this->queryParam($params, 'jm') ?? $today['jm']);
        $withAdjacent = filter_var(
            (string)($this->queryParam($params, 'with_adjacent') ?? '1'),
            FILTER_VALIDATE_BOOL
        );

        try {
            $grid = JalaliCalendar::monthGrid($jy, $jm, $withAdjacent);
        } catch (\Throwable $e) {
            return JsonResponse::error('INVALID_PARAM', $e->getMessage(), 400);
        }

        return JsonResponse::success('PERSIAN_CALENDAR_MONTH', 'OK', [
            'month' => $grid,
            'weekday_names' => array_values(JalaliCalendar::WEEKDAY_NAMES),
            'month_names' => array_values(JalaliCalendar::MONTH_NAMES),
        ]);
    }

    /**
     * Format a Gregorian date/time with a Jalali pattern.
     * ?date=YYYY-MM-DD[ HH:MM[:SS]]&pattern=DD MMMM YYYY&persian_numerals=1
     */
    public function format(array $params = []): JsonResponse
    {
        $date = trim((string)($this->queryParam($params, 'date') ?? ''));
        if ($date === '') {
            return JsonResponse::error('INVALID_PARAM', 'date is required', 400);
        }

        $pattern = trim((string)($this->queryParam($params, 'pattern') ?? JalaliFormatter::FORMAT_SHORT));
        // Byte-length sanity limit (works without the mbstring extension;
        // patterns are short ASCII token strings plus quoted literals).
        if (strlen($pattern) > 192) {
            return JsonResponse::error('INVALID_PARAM', 'pattern is too long', 400);
        }

        $persianNumerals = filter_var(
            (string)($this->queryParam($params, 'persian_numerals') ?? '1'),
            FILTER_VALIDATE_BOOL
        );

        try {
            $formatted = JalaliFormatter::format($date, $pattern, ['persian_numerals' => $persianNumerals]);
        } catch (\Throwable $e) {
            return JsonResponse::error('INVALID_PARAM', $e->getMessage(), 400);
        }

        return JsonResponse::success('PERSIAN_CALENDAR_FORMAT', 'OK', [
            'source' => $date,
            'pattern' => $pattern,
            'formatted' => $formatted,
        ]);
    }

    // ------------------------------------------------------------------

    /**
     * Read a parameter from the route params or the query string.
     */
    private function queryParam(array $params, string $key): mixed
    {
        if (array_key_exists($key, $params) && $params[$key] !== null && $params[$key] !== '') {
            return $params[$key];
        }

        try {
            $request = $this->container->get('request');
            $value = $request->query[$key] ?? null;

            return is_scalar($value) ? (string)$value : $value;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function moduleConfig(): array
    {
        try {
            /** @var \Api\System\Library\Module\ModuleConfig|null $moduleConfig */
            $moduleConfig = $this->container->has('module.config')
                ? $this->container->get('module.config')
                : null;
            if ($moduleConfig instanceof \Api\System\Library\Module\ModuleConfig) {
                $stored = $moduleConfig->getAll(self::MODULE_NAME);
                if ($stored !== []) {
                    return array_replace_recursive(self::CONFIG_DEFAULTS, $stored);
                }
            }
        } catch (\Throwable) {
            // Fall through to compiled defaults - the calendar must never
            // depend on a database round trip to render.
        }

        return self::CONFIG_DEFAULTS;
    }
}
