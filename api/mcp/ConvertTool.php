<?php
declare(strict_types=1);

namespace Module\Crm\PersianCalendar\Mcp;

use Api\System\Library\Container;
use Api\System\Library\Module\Mcp\ModuleMcpToolInterface;
use Api\System\Library\Module\ModuleExecutionContext;
use Module\Crm\PersianCalendar\Service\JalaliCalendar;
use Module\Crm\PersianCalendar\Service\JalaliFormatter;
use Module\Crm\PersianCalendar\Service\PersianNumerals;

/**
 * MCP tool: persian_calendar_convert
 *
 * Bidirectional Jalali <-> Gregorian conversion for AI agents.
 * Pure computation - no workspace data is involved.
 *
 * Direction rules:
 *  - 'j2g': the input is a Jalali date (jy/jm/jd, 'YYYY/MM/DD', 'YYYY-MM-DD'
 *    or 'D MonthName YYYY'; Persian digits accepted).
 *  - 'g2j': the input is a Gregorian ISO date ('YYYY-MM-DD').
 *  - 'auto' (default): 'YYYY/MM/DD' (or Persian digits) is Jalali,
 *    'YYYY-MM-DD' is Gregorian, explicit jy/jm/jd is Jalali.
 */
final class ConvertTool implements ModuleMcpToolInterface
{
    /**
     * @param array<string, mixed> $arguments
     * @return array<string, mixed>
     */
    public function execute(array $arguments, ModuleExecutionContext $context, Container $container): array
    {
        $date = trim((string)($arguments['date'] ?? ''));
        $jy = (int)($arguments['jy'] ?? 0);
        $jm = (int)($arguments['jm'] ?? 0);
        $jd = (int)($arguments['jd'] ?? 0);
        $direction = strtolower(trim((string)($arguments['direction'] ?? 'auto')));
        if (!in_array($direction, ['auto', 'g2j', 'j2g'], true)) {
            $direction = 'auto';
        }

        try {
            $latinDate = trim(PersianNumerals::toLatin($date));
            $looksJalaliBySeparator = $latinDate !== '' && str_contains($latinDate, '/');

            if ($direction === 'auto') {
                $direction = ($jy > 0 || $looksJalaliBySeparator) ? 'j2g' : 'g2j';
            }

            if ($direction === 'j2g') {
                if ($jy > 0 && $jm > 0 && $jd > 0) {
                    $parsed = ['jy' => $jy, 'jm' => $jm, 'jd' => $jd];
                } elseif ($latinDate !== '') {
                    $parsed = JalaliFormatter::parseJalali($latinDate);
                } else {
                    $parsed = null;
                }

                if ($parsed === null) {
                    return ['status' => 'error', 'message' => 'Provide a valid Jalali date (jy/jm/jd or date=YYYY/MM/DD).'];
                }

                $iso = JalaliCalendar::jalaliToIso($parsed['jy'], $parsed['jm'], $parsed['jd']);
                $weekdayIndex = JalaliCalendar::jalaliWeekdayIndex($parsed['jy'], $parsed['jm'], $parsed['jd']);

                return [
                    'status' => 'ok',
                    'direction' => 'j2g',
                    'input_jalali' => sprintf('%04d/%02d/%02d', $parsed['jy'], $parsed['jm'], $parsed['jd']),
                    'output_gregorian' => $iso,
                    'weekday' => JalaliCalendar::weekdayName($weekdayIndex),
                    'display' => JalaliFormatter::format($iso, JalaliFormatter::FORMAT_FULL),
                ];
            }

            if ($latinDate === '') {
                return ['status' => 'error', 'message' => 'Provide date=YYYY-MM-DD (Gregorian) or jy/jm/jd.'];
            }

            $j = JalaliCalendar::isoToJalali($latinDate);
            $weekdayIndex = JalaliCalendar::jalaliWeekdayIndex($j['jy'], $j['jm'], $j['jd']);

            return [
                'status' => 'ok',
                'direction' => 'g2j',
                'input_gregorian' => $latinDate,
                'output_jalali' => sprintf('%04d/%02d/%02d', $j['jy'], $j['jm'], $j['jd']),
                'jalali_parts' => ['year' => $j['jy'], 'month' => $j['jm'], 'day' => $j['jd']],
                'month_name' => JalaliCalendar::monthName($j['jm']),
                'weekday' => JalaliCalendar::weekdayName($weekdayIndex),
                'display' => JalaliFormatter::format($latinDate, JalaliFormatter::FORMAT_FULL),
            ];
        } catch (\Throwable $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }
    }
}
