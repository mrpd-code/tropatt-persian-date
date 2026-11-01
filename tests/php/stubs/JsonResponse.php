<?php
declare(strict_types=1);

/**
 * Minimal stand-in for Api\System\Library\Http\JsonResponse with the same
 * accessors the real class exposes (status(), payload()).
 * Guarded so it is a no-op when the real core class is loaded.
 */

namespace Api\System\Library\Http;

if (!class_exists(JsonResponse::class, false)) {
    final class JsonResponse
    {
        public function __construct(
            public readonly int $status,
            public readonly bool $success,
            public readonly string $code,
            public readonly string $message,
            public readonly array|null $data,
            public readonly array $errors,
        ) {}

        public static function success(string $code, string $message, array $data = [], int $status = 200): self
        {
            return new self($status, true, $code, $message, $data, []);
        }

        public static function error(string $code, string $message, int $status = 400): self
        {
            return new self($status, false, $code, $message, null, [$message]);
        }

        public function status(): int
        {
            return $this->status;
        }

        /** @return array<string, mixed> */
        public function payload(): array
        {
            return [
                'success' => $this->success,
                'code' => $this->code,
                'message' => $this->message,
                'data' => $this->data,
                'errors' => $this->errors,
                'meta' => [],
            ];
        }
    }
}
