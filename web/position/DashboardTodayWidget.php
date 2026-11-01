<?php
declare(strict_types=1);

namespace Module\Crm\PersianCalendar\Position;

use Module\Crm\PersianCalendar\Service\JalaliCalendar;
use Module\Crm\PersianCalendar\Service\JalaliFormatter;
use Module\Crm\PersianCalendar\Support\ModuleSettings;

/**
 * "Today" widget for the dashboard.content.after slot.
 *
 * Server-rendered (works without JavaScript) and hydrated client-side by
 * web/assets/js/persian-calendar.js. Respects the module setting
 * `dashboard_widget_enabled` (default: on).
 */
final class DashboardTodayWidget
{
    public static function render(array $context): string
    {
        try {
            if (!ModuleSettings::enabled('dashboard_widget_enabled')) {
                return '';
            }

            $now = new \DateTimeImmutable('now');
            $j = JalaliCalendar::toJalali((int)$now->format('Y'), (int)$now->format('n'), (int)$now->format('j'));
            $weekdayIndex = JalaliCalendar::jalaliWeekdayIndex($j['jy'], $j['jm'], $j['jd']);
            $persianNumerals = ModuleSettings::enabled('persian_numerals');

            $short = JalaliFormatter::formatDate($now, '', ['persian_numerals' => $persianNumerals]);
            $long = JalaliFormatter::format($now, JalaliFormatter::FORMAT_LONG, ['persian_numerals' => $persianNumerals]);
            $weekday = JalaliCalendar::weekdayName($weekdayIndex);
            $gregorian = $now->format('Y-m-d');
            $monthLength = JalaliCalendar::monthLength($j['jy'], $j['jm']);
            $dayOfMonth = $j['jd'];
            $progressPct = (int)round($dayOfMonth / max($monthLength, 1) * 100);
        } catch (\Throwable $e) {
            \Api\System\Library\Support\AppLog::error(
                '[crm.persian-calendar] dashboard widget failed: ' . $e->getMessage()
            );
            return '';
        }

        $weekdayEsc = htmlspecialchars($weekday, ENT_QUOTES, 'UTF-8');
        $shortEsc = htmlspecialchars($short, ENT_QUOTES, 'UTF-8');
        $longEsc = htmlspecialchars($long, ENT_QUOTES, 'UTF-8');
        $gregorianEsc = htmlspecialchars($gregorian, ENT_QUOTES, 'UTF-8');
        $monthNameEsc = htmlspecialchars(JalaliCalendar::monthName($j['jm']), ENT_QUOTES, 'UTF-8');
        $monthLengthStr = $persianNumerals
            ? \Module\Crm\PersianCalendar\Service\PersianNumerals::toPersian((string)$monthLength)
            : (string)$monthLength;
        $dayStr = $persianNumerals
            ? \Module\Crm\PersianCalendar\Service\PersianNumerals::toPersian((string)$dayOfMonth)
            : (string)$dayOfMonth;

        return '<div class="crm-card crm-persian-today-widget" data-crm-persian-widget="dashboard-today">'
            . '<div class="crm-persian-today-head">'
            . '<span class="crm-persian-today-weekday" dir="rtl">' . $weekdayEsc . '</span>'
            . '<span class="crm-persian-today-badge" dir="rtl">' . htmlspecialchars($monthNameEsc, ENT_QUOTES, 'UTF-8') . '</span>'
            . '</div>'
            . '<div class="crm-persian-today-date" dir="rtl" title="' . $gregorianEsc . '">' . $shortEsc . '</div>'
            . '<div class="crm-persian-today-long" dir="rtl">' . $longEsc . '</div>'
            . '<div class="crm-persian-today-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' . $monthLengthStr . '" aria-valuenow="' . $dayStr . '" aria-label="' . $monthNameEsc . '">'
            . '<div class="crm-persian-today-progress-bar" style="width:' . $progressPct . '%"></div>'
            . '</div>'
            . '<div class="crm-persian-today-meta">'
            . '<span class="text-muted small" dir="ltr">' . $gregorianEsc . '</span>'
            . '<span class="text-muted small">' . $dayStr . ' / ' . $monthLengthStr . '</span>'
            . '</div>'
            . '</div>';
    }
}
