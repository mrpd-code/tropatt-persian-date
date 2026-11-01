<?php
declare(strict_types=1);

namespace Module\Crm\PersianCalendar\Position;

use Module\Crm\PersianCalendar\Service\JalaliCalendar;
use Module\Crm\PersianCalendar\Service\JalaliFormatter;
use Module\Crm\PersianCalendar\Support\ModuleSettings;

/**
 * Persian date reference panel for the profile.content.after slot.
 *
 * Shows today's Jalali date plus a compact month overview. Server-rendered
 * (works without JavaScript). Respects the module setting
 * `profile_panel_enabled` (default: on).
 */
final class ProfilePersianDatePanel
{
    public static function render(array $context): string
    {
        try {
            if (!ModuleSettings::enabled('profile_panel_enabled')) {
                return '';
            }

            $now = new \DateTimeImmutable('now');
            $j = JalaliCalendar::toJalali((int)$now->format('Y'), (int)$now->format('n'), (int)$now->format('j'));
            $persianNumerals = ModuleSettings::enabled('persian_numerals');
            $grid = JalaliCalendar::monthGrid($j['jy'], $j['jm'], false);

            $full = JalaliFormatter::format($now, JalaliFormatter::FORMAT_FULL, ['persian_numerals' => $persianNumerals]);
            $short = JalaliFormatter::formatDate($now, '', ['persian_numerals' => $persianNumerals]);
        } catch (\Throwable $e) {
            \Api\System\Library\Support\AppLog::error(
                '[crm.persian-calendar] profile panel failed: ' . $e->getMessage()
            );
            return '';
        }

        $num = static function (int $value) use ($persianNumerals): string {
            return $persianNumerals
                ? \Module\Crm\PersianCalendar\Service\PersianNumerals::toPersian((string)$value)
                : (string)$value;
        };

        $rows = '';
        foreach ($grid['weeks'] as $week) {
            $rows .= '<tr>';
            foreach ($week as $cell) {
                if ($cell === null) {
                    $rows .= '<td class="crm-persian-mini-empty"></td>';
                    continue;
                }
                $classes = ['crm-persian-mini-day'];
                $attributes = '';
                if ($cell['in_month']) {
                    if ($cell['jd'] === $j['jd']) {
                        $classes[] = 'crm-persian-mini-today';
                        $attributes = ' aria-current="date"';
                    } elseif ($cell['weekday'] === 6) {
                        // Friday is the weekend in the Persian calendar.
                        $classes[] = 'crm-persian-mini-weekend';
                    }
                    $title = htmlspecialchars($cell['iso'], ENT_QUOTES, 'UTF-8');
                    $rows .= '<td class="' . implode(' ', $classes) . '" title="' . $title . '"' . $attributes . '>'
                        . $num($cell['jd']) . '</td>';
                } else {
                    $rows .= '<td class="crm-persian-mini-empty"></td>';
                }
            }
            $rows .= '</tr>';
        }

        $weekdayHeaders = '';
        foreach (JalaliCalendar::WEEKDAY_NAMES_SHORT as $index => $shortName) {
            $weekdayHeaders .= '<th scope="col" class="crm-persian-mini-wd" title="'
                . htmlspecialchars(JalaliCalendar::weekdayName((int)$index), ENT_QUOTES, 'UTF-8')
                . '">' . htmlspecialchars($shortName, ENT_QUOTES, 'UTF-8') . '</th>';
        }

        $monthTitle = JalaliCalendar::monthName($j['jm']) . ' ' . $num($j['jy']);

        return '<div class="crm-card crm-section-card crm-persian-profile-panel" data-crm-persian-widget="profile-panel">'
            . '<div class="crm-section-head"><h2 class="h6 mb-0" dir="rtl">' . htmlspecialchars($monthTitle, ENT_QUOTES, 'UTF-8') . '</h2></div>'
            . '<div class="p-3">'
            . '<p class="mb-2" dir="rtl"><strong>' . htmlspecialchars($full, ENT_QUOTES, 'UTF-8') . '</strong></p>'
            . '<p class="small text-muted mb-3" dir="rtl">' . htmlspecialchars($short, ENT_QUOTES, 'UTF-8')
            . ' <span dir="ltr">(' . htmlspecialchars($now->format('Y-m-d'), ENT_QUOTES, 'UTF-8') . ')</span></p>'
            . '<table class="crm-persian-mini-month" dir="rtl" role="grid" aria-label="' . htmlspecialchars($monthTitle, ENT_QUOTES, 'UTF-8') . '">'
            . '<thead><tr>' . $weekdayHeaders . '</tr></thead>'
            . '<tbody>' . $rows . '</tbody>'
            . '</table>'
            . '</div>'
            . '</div>';
    }
}
