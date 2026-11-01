<?php
declare(strict_types=1);

namespace Module\Crm\PersianCalendar\Support;

/**
 * Read-only access to the module configuration from the web (render) side.
 *
 * Position renderers are stateless static callables without container
 * access, so this class lazily reads the `module_registry.config` column
 * once per request (static cache) and always falls back to the manifest
 * defaults. It degrades silently: a database problem can never break the
 * page that renders a Persian date.
 *
 * @internal web-side only; API-side code uses the module.config service.
 */
final class ModuleSettings
{
    private const MODULE_NAME = 'crm.persian-calendar';

    /** @var array<string, mixed>|null */
    private static ?array $cache = null;

    /** @var \PDO|null */
    private static ?\PDO $pdo = null;

    /**
     * Manifest defaults (must stay in sync with manifest.json).
     *
     * @return array<string, mixed>
     */
    public static function defaults(): array
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

    /**
     * Effective configuration: stored module config layered over defaults.
     *
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        $config = self::defaults();

        try {
            $stored = self::storedConfig();
            if ($stored !== []) {
                $config = array_replace_recursive($config, $stored);
            }
        } catch (\Throwable $e) {
            \Api\System\Library\Support\AppLog::error(
                '[crm.persian-calendar] settings read failed, using defaults: ' . $e->getMessage()
            );
        }

        self::$cache = $config;

        return $config;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $all = self::all();

        return $all[$key] ?? $default;
    }

    public static function enabled(string $key): bool
    {
        return filter_var((string)(self::get($key, true)), FILTER_VALIDATE_BOOL);
    }

    /**
     * Reset the per-request cache (used by tests).
     */
    public static function resetCache(): void
    {
        self::$cache = null;
        self::$pdo = null;
    }

    /**
     * @return array<string, mixed>
     */
    private static function storedConfig(): array
    {
        $pdo = self::pdo();
        if ($pdo === null) {
            return [];
        }

        $stmt = $pdo->prepare('SELECT config FROM module_registry WHERE module_name = :name LIMIT 1');
        $stmt->execute(['name' => self::MODULE_NAME]);
        $json = $stmt->fetchColumn();
        if (!is_string($json) || $json === '') {
            return [];
        }

        $decoded = json_decode($json, true);

        return is_array($decoded) ? $decoded : [];
    }

    private static function pdo(): ?\PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        // The web bootstrap (web/index.php) exposes crmWebApiDbConnect()
        // before any template renders. Guard for CLI/test contexts.
        if (!function_exists('crmWebApiDbConnect')) {
            return null;
        }

        try {
            // __DIR__ = modules/crm.persian-calendar/web/support
            // dirname(__DIR__, 4) = project root that contains web/ and modules/.
            $webBaseDir = dirname(__DIR__, 4) . '/web';
            $pdo = crmWebApiDbConnect($webBaseDir);
        } catch (\Throwable) {
            $pdo = null;
        }

        self::$pdo = $pdo;

        return $pdo;
    }
}
