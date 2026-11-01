<?php
declare(strict_types=1);

/**
 * Persian Calendar module - Russian interface strings.
 * Namespace module_persian_calendar.* is served to the client
 * (window.CRM.messages) whenever the module assets are on the page.
 */
return [
    'module_persian_calendar' => [
        'title' => 'Персидский календарь',
        'subtitle' => 'Календарь джалали (шамси), выбор даты и даты-времени для интерфейса TropaTT.',
        'page_title' => 'Персидский календарь — TropaTT',

        'tab_calendar' => 'Календарь',
        'tab_pickers' => 'Выбор даты',
        'tab_convert' => 'Конвертация',
        'tab_format' => 'Форматирование',
        'tab_api' => 'Для разработчиков',

        'btn_today' => 'Сегодня',
        'btn_now' => 'Сейчас',
        'btn_clear' => 'Очистить',
        'btn_ok' => 'ОК',
        'prev_month' => 'Предыдущий месяц',
        'next_month' => 'Следующий месяц',
        'prev_year' => 'Предыдущий год',
        'next_year' => 'Следующий год',
        'select_month' => 'Выбор месяца',
        'select_year' => 'Выбор года',
        'hours' => 'Часы',
        'minutes' => 'Минуты',
        'pick_date' => 'Выбрать дату',
        'pick_datetime' => 'Выбрать дату и время',
        'open_calendar' => 'Открыть календарь',
        'day_disabled' => 'Недоступно для выбора',
        'calendar_label' => 'Персидский календарь',

        'calendar_section_title' => 'Календарь месяца джалали',
        'calendar_section_hint' => 'Навигация кнопками, выбором месяца и года, клавиатурой (стрелки, Enter, Page Up/Down) или кнопкой «Сегодня».',

        'picker_date_label' => 'Выбор даты',
        'picker_date_hint' => 'Поле формы отправляет григорианское значение ISO (YYYY-MM-DD); пользователь выбирает и видит дату джалали.',
        'picker_datetime_label' => 'Выбор даты и времени',
        'picker_datetime_hint' => 'Выбирает полную локальную дату-время; форма получает YYYY-MM-DDTHH:mm.',
        'picker_restricted_label' => 'Выбор с ограничением диапазона',
        'picker_restricted_hint' => 'Доступны только разрешённые даты; остальные отключены.',
        'picker_readonly_label' => 'Только для чтения',
        'picker_readonly_hint' => 'Показывает дату джалали для существующей григорианской даты без возможности изменения.',
        'picker_value_label' => 'Значение, возвращаемое приложению (ISO):',
        'picker_display_label' => 'Отображается (джалали):',

        'convert_title' => 'Конвертация григорианская ⇄ джалали',
        'convert_gregorian_input' => 'Григорианская дата',
        'convert_jalali_input' => 'Дата джалали',
        'convert_to_jalali' => 'Перевести в джалали',
        'convert_to_gregorian' => 'Перевести в григорианскую',
        'convert_result' => 'Результат',

        'format_title' => 'Утилиты форматирования',
        'format_hint' => 'window.CRM.PersianCalendar.format() с общими шаблонами:',

        'api_title' => 'Использование модуля из других модулей и страниц',
        'today_is' => 'Сегодня',

        'config_title' => 'Текущая конфигурация',

        'numerals_title' => 'Стиль цифр в датах',
        'numerals_persian' => 'Персидские цифры (۱۲۳)',
        'numerals_latin' => 'Латинские цифры (123)',
        'numerals_hint' => 'Применяется ко всем датам в интерфейсе; сохраняется только в этом браузере.',
    ],
];
