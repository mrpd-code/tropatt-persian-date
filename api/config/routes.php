<?php
declare(strict_types=1);

use Module\Crm\PersianCalendar\Controller\PersianCalendarApiController;

/**
 * REST API routes of the Persian calendar module.
 *
 * The core mounts these under /_module/crm.persian-calendar/...
 * (browser calls go through window.CRM.api.request(
 *   '_module/crm.persian-calendar/<route>')).
 *
 * Every endpoint is read-only math. `workspace_required` stays false:
 * calendar conversion has no tenant data.
 */
return [
    ['methods' => ['GET'], 'route' => '/config', 'controller' => PersianCalendarApiController::class, 'action' => 'config', 'auth' => true],
    ['methods' => ['GET'], 'route' => '/today', 'controller' => PersianCalendarApiController::class, 'action' => 'today', 'auth' => true],
    ['methods' => ['GET'], 'route' => '/convert/g2j', 'controller' => PersianCalendarApiController::class, 'action' => 'convertToJalali', 'auth' => true],
    ['methods' => ['GET'], 'route' => '/convert/j2g', 'controller' => PersianCalendarApiController::class, 'action' => 'convertToGregorian', 'auth' => true],
    ['methods' => ['GET'], 'route' => '/month', 'controller' => PersianCalendarApiController::class, 'action' => 'month', 'auth' => true],
    ['methods' => ['GET'], 'route' => '/format', 'controller' => PersianCalendarApiController::class, 'action' => 'format', 'auth' => true],
];
