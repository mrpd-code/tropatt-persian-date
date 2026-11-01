<?php
declare(strict_types=1);

namespace Module\Crm\PersianCalendar\Mcp;

use Api\System\Library\Container;
use Api\System\Library\Module\Mcp\ModuleMcpToolInterface;
use Api\System\Library\Module\ModuleExecutionContext;
use Module\Crm\PersianCalendar\Service\JalaliCalendar;
use Module\Crm\PersianCalendar\Service\JalaliFormatter;

/**
 * MCP tool: persian_calendar_today
 *
 * Gives AI agents the current date in both calendars with the localized
 * Persian names. Pure computation - no workspace data is involved.
 */
final class TodayTool implements ModuleMcpToolInterface
{
    /**
     * @param array<string, mixed> $arguments
     * @return array<string, mixed>
     */
    public function execute(array $arguments, ModuleExecutionContext $context, Container $container): array
    {
        $timezone = new \DateTimeZone(date_default_timezone_get());
        $now = new \DateTimeImmutable('now', $timezone);
        $j = JalaliCalendar::today($timezone);
        $weekdayIndex = JalaliCalendar::jalaliWeekdayIndex($j['jy'], $j['jm'], $j['jd']);

        return [
            'status' => 'ok',
            'jalali' => [
                'year' => $j['jy'],
                'month' => $j['jm'],
                'day' => $j['jd'],
                'month_name' => JalaliCalendar::monthName($j['jm']),
                'weekday' => JalaliCalendar::weekdayName($weekdayIndex),
            ],
            'gregorian' => [
                'date' => $now->format('Y-m-d'),
                'datetime' => $now->format('Y-m-d H:i:s'),
            ],
            'display' => [
                'short' => JalaliFormatter::formatDate($now),
                'long' => JalaliFormatter::format($now, JalaliFormatter::FORMAT_LONG),
                'full' => JalaliFormatter::format($now, JalaliFormatter::FORMAT_FULL),
            ],
        ];
    }
}
