<?php
declare(strict_types=1);

/**
 * Minimal stand-in for Api\System\Library\Container.
 * Guarded so it is a no-op when the real core class is loaded.
 */

namespace Api\System\Library;

if (!class_exists(Container::class, false)) {
    final class Container
    {
        /** @var array<string, mixed> */
        private array $entries = [];

        public function set(string $id, mixed $value): void
        {
            $this->entries[$id] = $value;
        }

        public function get(string $id): mixed
        {
            return $this->entries[$id] ?? null;
        }

        public function has(string $id): bool
        {
            return isset($this->entries[$id]);
        }
    }
}
