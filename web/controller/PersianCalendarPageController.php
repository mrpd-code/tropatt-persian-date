<?php
declare(strict_types=1);

namespace Module\Crm\PersianCalendar\Controller;

use Module\Crm\PersianCalendar\Service\JalaliCalendar;
use Module\Crm\PersianCalendar\Service\JalaliFormatter;
use Module\Crm\PersianCalendar\Support\ModuleSettings;
use Web\System\Core\Controller;

/**
 * Module page: interactive playground + usage examples for the Persian
 * calendar, date picker and date-time picker. Doubles as the manual test
 * surface for every component of the module.
 */
final class PersianCalendarPageController extends Controller
{
    public function index(): void
    {
        $sessionCookieName = trim((string)(getenv('CRM_API_SESSION_COOKIE') ?: 'crm_api_session'));
        $sessionToken = trim((string)($_COOKIE[$sessionCookieName] ?? ''));
        $canView = function_exists('crmWebApiCheckAnyPermission')
            && crmWebApiCheckAnyPermission(
                $sessionToken,
                ['module.persian-calendar.view', 'module.persian-calendar.manage'],
                $this->baseDir
            );
        if (!$canView) {
            http_response_code(403);
            header('Content-Type: text/html; charset=utf-8');
            echo \Web\System\I18n\EarlyResponse::forbiddenPage($this->baseDir);
            return;
        }

        $canManage = function_exists('crmWebApiCheckAnyPermission')
            && crmWebApiCheckAnyPermission($sessionToken, ['module.persian-calendar.manage'], $this->baseDir);

        $now = new \DateTimeImmutable('now');
        $todayJalali = JalaliCalendar::toJalali((int)$now->format('Y'), (int)$now->format('n'), (int)$now->format('j'));

        $this->render(__DIR__ . '/../template/page/persian_calendar.php', [
            'title' => 'Persian Calendar',
            'route' => 'module-persian-calendar',
            'can_manage' => $canManage,
            'today_jalali' => $todayJalali,
            'today_full' => JalaliFormatter::format($now, JalaliFormatter::FORMAT_FULL),
            'module_config' => ModuleSettings::all(),
        ]);
    }
}
