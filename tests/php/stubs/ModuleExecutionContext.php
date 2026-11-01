<?php
declare(strict_types=1);

/**
 * Minimal stand-in for Api\System\Library\Module\ModuleExecutionContext.
 * Guarded so it is a no-op when the real core class is loaded.
 */

namespace Api\System\Library\Module;

if (!class_exists(ModuleExecutionContext::class, false)) {
    final class ModuleExecutionContext
    {
        public function __construct(
            public readonly string $moduleName,
            public readonly int $organizationId,
            public readonly ?string $organizationPublicId,
            public readonly ?string $actorPublicId,
            public readonly string $source,
            public readonly string $correlationId,
        ) {}
    }
}
