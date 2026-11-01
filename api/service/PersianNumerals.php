<?php
declare(strict_types=1);

namespace Module\Crm\PersianCalendar\Service;

/**
 * Persian (Eastern Arabic) numeral localization helpers.
 *
 * Converts between Latin digits (0-9) and Persian digits (۰-۹),
 * and provides the localized Persian decimal separator (٫) and
 * thousands separator (٬).
 */
final class PersianNumerals
{
    public const LATIN = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    public const PERSIAN = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    /**
     * Convert every Latin digit in the string to its Persian equivalent.
     * Non-digit characters are left untouched.
     */
    public static function toPersian(string $value): string
    {
        return strtr($value, array_combine(self::LATIN, self::PERSIAN));
    }

    /**
     * Convert Persian (and Arabic-Indic) digits in the string to Latin digits.
     * Arabic-Indic digits (٠١٢...) are normalized as well so mixed input
     * from different keyboards still parses.
     */
    public static function toLatin(string $value): string
    {
        $map = [];

        foreach (self::PERSIAN as $index => $digit) {
            $map[$digit] = (string)$index;
        }
        // Arabic-Indic digits.
        foreach (['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as $index => $digit) {
            $map[$digit] = (string)$index;
        }

        return strtr($value, $map);
    }

    /**
     * True when the string contains at least one Persian digit.
     */
    public static function hasPersianDigits(string $value): bool
    {
        foreach (self::PERSIAN as $digit) {
            if (str_contains($value, $digit)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Zero-pad a number to the given width and optionally localize the digits.
     */
    public static function pad(int $value, int $width = 2, bool $persian = true): string
    {
        $padded = str_pad((string)$value, $width, '0', STR_PAD_LEFT);

        return $persian ? self::toPersian($padded) : $padded;
    }
}
