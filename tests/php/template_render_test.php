<?php
declare(strict_types=1);

/**
 * Render test for the module's demo page template. Simulates the variables
 * the core Web\Controller provides and verifies the template emits valid
 * HTML without errors, including the CSP-nonce inline script.
 *
 * Run:  php tests/php/template_render_test.php
 */

use Module\Crm\PersianCalendar\Service\JalaliCalendar;
use Module\Crm\PersianCalendar\Service\JalaliFormatter;

$moduleRoot = dirname(__DIR__, 2);
require $moduleRoot . '/api/service/JalaliCalendar.php';
require $moduleRoot . '/api/service/PersianNumerals.php';
require $moduleRoot . '/api/service/JalaliFormatter.php';

if (!function_exists('crm_page_head')) {
    function crm_page_head(array $breadcrumbs, string $title, string $subtitle = '', string $actionsHtml = '', string $className = ''): void
    {
        echo '<div class="crm-page-head"><h1>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h1></div>';
    }
}

$csp_nonce = 'test-nonce-123';
$t = static fn(string $key, string $default = ''): string => $default;
$route = 'module-persian-calendar';
$can_manage = true;
$locale = 'fa-ir';
$direction = 'rtl';
$base_path = '';
$module_css_files = [];
$module_js_files = [];
$module_css_routes = [];
$module_js_routes = [];
$today_jalali = JalaliCalendar::today();
$today_full = JalaliFormatter::format(new DateTimeImmutable('now'), JalaliFormatter::FORMAT_FULL);
$module_config = [
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
    'autoformat_enabled' => false,
    'autoformat_selectors' => ['[data-crm-persian-date]'],
];

ob_start();
$errorCount = 0;
set_error_handler(static function (int $no, string $str) use (&$errorCount): bool {
    $errorCount++;
    fwrite(STDERR, "PHP notice/warning in template: {$str}\n");
    return true;
});

try {
    require $moduleRoot . '/web/template/page/persian_calendar.php';
} catch (Throwable $e) {
    restore_error_handler();
    fwrite(STDERR, "TEMPLATE ERROR: " . $e->getMessage() . "\n");
    exit(1);
}
restore_error_handler();

$html = (string)ob_get_clean();

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

check($errorCount === 0, 'template renders without notices/warnings');
check(strlen($html) > 5000, 'template output is substantial');
check(str_contains($html, 'data-page="module-persian-calendar"'), 'template body marker');
check(substr_count($html, '<body') === 1, 'template single body');
check(str_contains($html, 'id="demoCalendar"'), 'calendar host present');
check(str_contains($html, 'data-crm-persian-picker="date"'), 'date picker input present');
check(str_contains($html, 'id="demoDateTimePicker"'), 'datetime picker input present');
check(str_contains($html, 'id="demoRestrictedPicker"'), 'restricted picker input present');
check(str_contains($html, 'id="demoReadonlyPicker"'), 'readonly picker input present');
check(str_contains($html, 'nonce="test-nonce-123"'), 'inline script carries CSP nonce');
check(str_contains($html, 'window.CRM.PersianCalendarConfig'), 'config bootstrap script present');
check(str_contains($html, 'crm-persian-code'), 'developer code samples present');
check(str_contains($html, 'PC.format('), 'formatting examples present');
check(str_contains($html, 'data-bs-toggle="tab"') && substr_count($html, 'data-bs-target') === 5, 'five tabs present');
check(substr_count($html, '<script') === substr_count($html, '</script>'), 'script tags balanced');
check(substr_count($html, '<table') === substr_count($html, '</table>'), 'table tags balanced');
check(str_contains($html, JalaliFormatter::format(new DateTimeImmutable('now'), JalaliFormatter::FORMAT_FULL)), 'today full date rendered');
check(str_contains($html, JalaliCalendar::monthName($today_jalali['jm'])), 'current month name rendered');

echo "Template render tests: {$checks} checks, " . count($failures) . " failures\n";
if ($failures !== []) {
    exit(1);
}
echo "ALL PASS\n";
exit(0);
