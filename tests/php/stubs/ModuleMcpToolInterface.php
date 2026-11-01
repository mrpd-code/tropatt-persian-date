<?php
declare(strict_types=1);

/**
 * Minimal stand-ins for the module-system contracts used by the MCP tools.
 * Guarded so they are no-ops when the real core classes are loaded.
 */

namespace Api\System\Library\Module\Mcp;

if (!interface_exists(ModuleMcpToolInterface::class, false)) {
    interface ModuleMcpToolInterface
    {
        /**
         * @param array<string, mixed> $arguments
         * @return array<string, mixed>
         */
        public function execute(
            array $arguments,
            \Api\System\Library\Module\ModuleExecutionContext $context,
            \Api\System\Library\Container $container
        ): array;
    }
}
