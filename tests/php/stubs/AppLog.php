<?php
declare(strict_types=1);

/**
 * Silent stand-in for Api\System\Library\Support\AppLog so settings-read
 * failures stay quiet in tests. Guarded like the other stubs.
 */

namespace Api\System\Library\Support;

if (!class_exists(AppLog::class, false)) {
    final class AppLog
    {
        public static function error(string $message): void
        {
            // no-op in tests
        }
    }
}
