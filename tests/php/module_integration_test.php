<?php
declare(strict_types=1);

/**
 * Integration-style tests for the web/API layer of the Persian calendar
 * module: position renderers (server-rendered widgets), the REST controller
 * and the MCP tools. Runs against the real TropaTT core classes when the
 * repository is available next to the module, otherwise against bundled
 * stubs (kept minimal and faithful).
 *
 * Run:  php tests/php/module_integration_test.php [path/to/tropatt-upload]
 * The optional argument points at an extracted TropaTT `upload/` directory.
 * Without it, the position renderers and MCP tools are tested with stubs.
 */

use Api\System\Library\Container;
use Api\System\Library\Http\JsonResponse;
use Module\Crm\PersianCalendar\Controller\PersianCalendarApiController;
use Module\Crm\PersianCalendar\Mcp\ConvertTool;
use Module\Crm\PersianCalendar\Mcp\TodayTool;
use Module\Crm\PersianCalendar\Position\DashboardTodayWidget;
use Module\Crm\PersianCalendar\Position\ProfilePersianDatePanel;
use Module\Crm\PersianCalendar\Support\ModuleSettings;
use Module\Crm\PersianCalendar\Service\JalaliCalendar;

$moduleRoot = dirname(__DIR__, 2);
$tropattUpload = $argv[1] ?? '';
$coreLib = rtrim($tropattUpload, '/') . '/api/system/library';

// Core classes: real ones when a TropaTT checkout is provided, minimal
// compatible stub files otherwise (tests/php/stubs/ - no eval, so the core
// ModuleCodeValidator accepts this test file on installation).
$coreAvailable = is_file($coreLib . '/Container.php') || is_file($coreLib . '/container.php');
$usingStubs = !$coreAvailable;

if ($coreAvailable) {
    require $coreLib . (is_file($coreLib . '/Container.php') ? '/Container.php' : '/container.php');
    require $coreLib . '/http/JsonResponse.php';
    require $coreLib . '/module/mcp/ModuleMcpToolInterface.php';
    require $coreLib . '/module/ModuleExecutionContext.php';
} else {
    require __DIR__ . '/stubs/Container.php';
    require __DIR__ . '/stubs/JsonResponse.php';
    require __DIR__ . '/stubs/ModuleMcpToolInterface.php';
    require __DIR__ . '/stubs/ModuleExecutionContext.php';
}

// The settings logger is only needed when a settings read fails; keep the
// tests silent whether or not the real core was loaded.
require __DIR__ . '/stubs/AppLog.php';

// Module classes (through the real autoloading paths).
require $moduleRoot . '/api/service/JalaliCalendar.php';
require $moduleRoot . '/api/service/PersianNumerals.php';
require $moduleRoot . '/api/service/JalaliFormatter.php';
require $moduleRoot . '/api/controller/PersianCalendarApiController.php';
require $moduleRoot . '/api/mcp/TodayTool.php';
require $moduleRoot . '/api/mcp/ConvertTool.php';
require $moduleRoot . '/web/support/ModuleSettings.php';
require $moduleRoot . '/web/position/DashboardTodayWidget.php';
require $moduleRoot . '/web/position/ProfilePersianDatePanel.php';

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

/**
 * Read the code/data/status of a JsonResponse regardless of whether the
 * real core class (private properties + accessors) or the test stub
 * (public properties) is loaded.
 */
function responseCode(object $response): string
{
    if (method_exists($response, 'payload')) {
        return (string)($response->payload()['code'] ?? '');
    }
    return (string)$response->code;
}

/** @return array<string, mixed> */
function responseData(object $response): array
{
    if (method_exists($response, 'payload')) {
        return is_array($response->payload()['data'] ?? null) ? $response->payload()['data'] : [];
    }
    return is_array($response->data ?? null) ? $response->data : [];
}

function responseStatus(object $response): int
{
    if (method_exists($response, 'status')) {
        return $response->status();
    }
    return (int)$response->status;
}

// ----------------------------------------------------------------------
// ModuleSettings: defaults when no database is reachable
// ----------------------------------------------------------------------

check(ModuleSettings::get('date_format') === 'YYYY/MM/DD', 'settings default date format');
check(ModuleSettings::get('persian_numerals') === true, 'settings default numerals');
check(ModuleSettings::enabled('dashboard_widget_enabled') === true, 'settings widget default on');
check(ModuleSettings::enabled('autoformat_enabled') === true, 'settings autoformat default on');

// ----------------------------------------------------------------------
// Position renderers (server-rendered, no JavaScript required)
// ----------------------------------------------------------------------

$today = JalaliCalendar::today();
$todayIso = JalaliCalendar::jalaliToIso($today['jy'], $today['jm'], $today['jd']);

$widget = DashboardTodayWidget::render(['route' => 'dashboard']);
check(is_string($widget) && $widget !== '', 'dashboard widget renders');
check(str_contains($widget, 'crm-persian-today-widget'), 'dashboard widget css class');
check(str_contains($widget, 'data-crm-persian-widget="dashboard-today"'), 'dashboard widget marker');
check(str_contains($widget, 'dir="rtl"'), 'dashboard widget rtl direction');
check(str_contains($widget, JalaliCalendar::monthName($today['jm'])), 'dashboard widget contains month name');
check(str_contains($widget, $todayIso), 'dashboard widget contains gregorian iso');
check(str_contains($widget, 'role="progressbar"'), 'dashboard widget progressbar aria');
check(str_contains($widget, '25') || (int)$today['jd'] > 0, 'dashboard widget day data');

$panel = ProfilePersianDatePanel::render(['route' => 'profile']);
check(is_string($panel) && $panel !== '', 'profile panel renders');
check(str_contains($panel, 'crm-persian-mini-month'), 'profile panel mini month table');
check(str_contains($panel, 'aria-current="date"'), 'profile panel today marker');
check(substr_count($panel, '<th scope="col"') === 7, 'profile panel has 7 weekday headers');
check(str_contains($panel, JalaliCalendar::monthName($today['jm'])), 'profile panel month title');

// ----------------------------------------------------------------------
// REST controller (with a stubbed request container)
// ----------------------------------------------------------------------

$request = new class {
    public array $query = [];
    public string $rawBody = '';
};

$container = new Container();
$container->set('request', $request);

$controller = new PersianCalendarApiController($container);

$configResponse = $controller->config();
check(responseCode($configResponse) === 'PERSIAN_CALENDAR_CONFIG', 'controller config code');
check((responseData($configResponse)['config']['date_format'] ?? '') === 'YYYY/MM/DD', 'controller config default');
check((responseData($configResponse)['config']['persian_numerals'] ?? null) === true, 'controller config numerals');

$todayResponse = $controller->today();
check(responseCode($todayResponse) === 'PERSIAN_CALENDAR_TODAY', 'controller today code');
check((responseData($todayResponse)['jalali']['jy'] ?? 0) === $today['jy'], 'controller today jalali year');
check((responseData($todayResponse)['formatted']['date'] ?? '') !== '', 'controller today formatted date');

$request->query = ['date' => '2026-10-31'];
$g2j = $controller->convertToJalali();
check(responseCode($g2j) === 'PERSIAN_CALENDAR_G2J', 'controller g2j code');
check((responseData($g2j)['jalali']['jy'] ?? 0) === 1405, 'controller g2j year');
check((responseData($g2j)['jalali']['jm'] ?? 0) === 8, 'controller g2j month');
check((responseData($g2j)['jalali']['jd'] ?? 0) === 9, 'controller g2j day');
check((responseData($g2j)['weekday'] ?? '') === 'شنبه', 'controller g2j weekday');

$request->query = ['date' => '۱۴۰۵/۰۸/۰۹'];
$j2g = $controller->convertToGregorian();
check((responseData($j2g)['gregorian_iso'] ?? '') === '2026-10-31', 'controller j2g persian digits');

$request->query = ['jy' => '1405', 'jm' => '1', 'jd' => '1'];
$j2g2 = $controller->convertToGregorian();
check((responseData($j2g2)['gregorian_iso'] ?? '') === '2026-03-21', 'controller j2g nowruz');

$request->query = ['jy' => '1405', 'jm' => '8'];
$monthResponse = $controller->month();
check((responseData($monthResponse)['month']['month_length'] ?? 0) === 30, 'controller month length');
check(count(responseData($monthResponse)['month']['weeks'] ?? []) >= 4, 'controller month weeks');
check((responseData($monthResponse)['month']['month_name'] ?? '') === 'آبان', 'controller month name');
check(count(responseData($monthResponse)['weekday_names'] ?? []) === 7, 'controller weekday names');

$request->query = ['date' => '2026-10-31', 'pattern' => 'DD MMMM YYYY'];
$formatResponse = $controller->format();
check((responseData($formatResponse)['formatted'] ?? '') === '۹ آبان ۱۴۰۵', 'controller format long');

$request->query = ['date' => 'not-a-date'];
$badResponse = $controller->convertToJalali();
check(responseStatus($badResponse) === 400, 'controller invalid date rejected');

$request->query = ['jy' => '1405', 'jm' => '13'];
$badMonth = $controller->month();
check(responseStatus($badMonth) === 400, 'controller invalid month rejected');

// ----------------------------------------------------------------------
// MCP tools (pure computation contract)
// ----------------------------------------------------------------------

// A real ModuleExecutionContext when the core is available; a compatible
// stub otherwise (the tools only read its public properties).
if (class_exists(\Api\System\Library\Module\ModuleExecutionContext::class)) {
    $context = new \Api\System\Library\Module\ModuleExecutionContext(
        'crm.persian-calendar',
        0,
        null,
        null,
        'mcp',
        'integration-test'
    );
} else {
    $context = new class {
        public string $moduleName = 'crm.persian-calendar';
        public int $organizationId = 0;
        public ?string $organizationPublicId = null;
        public ?string $actorPublicId = null;
        public string $source = 'mcp';
        public string $correlationId = 'integration-test';
    };
}

$todayTool = new TodayTool();
$todayResult = $todayTool->execute([], $context, $container);
check(($todayResult['status'] ?? '') === 'ok', 'mcp today status');
check(($todayResult['jalali']['year'] ?? 0) === $today['jy'], 'mcp today jalali');
check(($todayResult['gregorian']['date'] ?? '') === $todayIso, 'mcp today gregorian');
check(($todayResult['display']['full'] ?? '') !== '', 'mcp today display');

$convertTool = new ConvertTool();
$conv = $convertTool->execute(['date' => '2026-10-31'], $context, $container);
check(($conv['direction'] ?? '') === 'g2j', 'mcp convert auto direction');
check(($conv['output_jalali'] ?? '') === '1405/08/09', 'mcp convert g2j output');

$conv2 = $convertTool->execute(['date' => '۱۴۰۵/۰۸/۰۹'], $context, $container);
check(($conv2['direction'] ?? '') === 'j2g', 'mcp convert jalali input direction');
check(($conv2['output_gregorian'] ?? '') === '2026-10-31', 'mcp convert j2g output');

$conv3 = $convertTool->execute(['jy' => 1403, 'jm' => 12, 'jd' => 30], $context, $container);
check(($conv3['output_gregorian'] ?? '') === '2025-03-20', 'mcp convert leap esfand');

$conv4 = $convertTool->execute(['date' => 'not-a-date', 'direction' => 'j2g'], $context, $container);
check(($conv4['status'] ?? '') === 'error', 'mcp convert rejects unparseable j2g input');

$conv4b = $convertTool->execute(['date' => '2026-03-21', 'direction' => 'j2g'], $context, $container);
check(($conv4b['output_gregorian'] ?? '') === '2647-06-11', 'mcp convert j2g interprets dash-separated date as Jalali');

$conv5 = $convertTool->execute([], $context, $container);
check(($conv5['status'] ?? '') === 'error', 'mcp convert requires input');

// ----------------------------------------------------------------------
echo "Module integration tests: {$checks} checks, " . count($failures) . " failures"
    . ($usingStubs ? ' (core classes stubbed)' : ' (real TropaTT core)') . "\n";
if ($failures !== []) {
    exit(1);
}
echo "ALL PASS\n";
exit(0);
