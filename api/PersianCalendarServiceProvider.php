<?php
declare(strict_types=1);

namespace Module\Crm\PersianCalendar;

use Api\System\Library\Container;
use Api\System\Library\Module\AbstractModuleServiceProvider;

/**
 * Service provider for the Persian (Jalali) calendar module.
 *
 * The module is presentation-only: it registers permissions, a navigation
 * entry and configuration defaults. It creates no tables, subscribes to no
 * domain events and never touches how TropaTT stores its Gregorian dates.
 */
final class PersianCalendarServiceProvider extends AbstractModuleServiceProvider
{
    public function register(Container $container): void
    {
        // No container bindings: every service of this module is a pure,
        // stateless computation (see api/service/*).
    }

    public function boot(Container $container): void
    {
        // No event subscriptions on purpose. Displaying Persian dates is a
        // render-time concern, not a domain-event concern.
    }

    /** @return array<int, string> */
    public function getPermissions(): array
    {
        return [
            'module.persian-calendar.view',
            'module.persian-calendar.manage',
        ];
    }

    /**
     * @return array<int, array{route: string, label: string, icon: string, permission: string|null, parent: string|null}>
     */
    public function getMenuItems(): array
    {
        return [
            [
                'route' => 'module-persian-calendar',
                'label' => 'Persian Calendar',
                'icon' => '<i class="fa-solid fa-calendar-day"></i>',
                'permission' => 'module.persian-calendar.view',
                'parent' => null,
            ],
        ];
    }

    /**
     * Mirrors manifest.json config_defaults. Used by the core when the
     * module is installed before any user configuration is stored.
     *
     * @return array<string, mixed>
     */
    public function getConfig(): array
    {
        return [
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
    }
}
