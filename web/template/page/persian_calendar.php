<?php declare(strict_types=1); ?>
<?php
/** @var array{jy:int, jm:int, jd:int} $today_jalali */
$canManage = (bool)($can_manage ?? false);
$todayFull = (string)($today_full ?? '');
$config = is_array($module_config ?? null) ? $module_config : [];
$routeKey = 'module_persian_calendar';
?>
<body data-page="module-persian-calendar" data-protected="1"><div class="crm-app"><aside class="crm-sidebar"><div class="crm-brand"><span class="crm-brand-mark"></span> TropaTT</div><nav class="nav flex-column crm-nav"></nav></aside>
<div class="crm-main-wrap"><header class="crm-topbar py-2"><div class="container-fluid"></div></header>
<main class="crm-content crm-admin-page crm-module-page"><?php crm_page_head([
  ['label' => $t('admin_module_detail.link_admin', 'Administration'), 'href' => 'index.php?route=admin'],
  ['label' => $t('admin_module_detail.link_modules', 'Modules'), 'href' => 'index.php?route=admin-modules'],
  ['label' => $t('module_persian_calendar.title', 'Persian Calendar'), 'active' => true],
], $t('module_persian_calendar.title', 'Persian Calendar'), $t('module_persian_calendar.subtitle', 'Jalali calendar and pickers for the TropaTT interface.'), '<a class="btn crm-btn-secondary" href="index.php?route=admin-modules" data-i18n="admin_module_detail.back_to_modules">' . htmlspecialchars($t('admin_module_detail.back_to_modules', 'Back to modules'), ENT_QUOTES, 'UTF-8') . '</a>'); ?>

<div class="crm-card crm-section-card mb-4">
  <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
    <div>
      <strong dir="rtl" style="font-size:1.35rem"><?= htmlspecialchars($todayFull, ENT_QUOTES, 'UTF-8') ?></strong>
      <div class="small text-muted mt-1"><?= htmlspecialchars($t('module_persian_calendar.today_is', 'Today'), ENT_QUOTES, 'UTF-8') ?>
        &middot; <span dir="ltr"><?= htmlspecialchars(date('Y-m-d'), ENT_QUOTES, 'UTF-8') ?></span></div>
    </div>
    <span class="badge rounded-pill" style="background:var(--crm-accent-bg);color:var(--crm-accent-strong)">crm.persian-calendar v1.0.0</span>
  </div>
</div>

<ul class="nav nav-tabs mb-4" id="persianDemoTabs" role="tablist">
  <li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#pcTabCalendar" type="button" role="tab"><?= htmlspecialchars($t('module_persian_calendar.tab_calendar', 'Calendar'), ENT_QUOTES, 'UTF-8') ?></button></li>
  <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pcTabPickers" type="button" role="tab"><?= htmlspecialchars($t('module_persian_calendar.tab_pickers', 'Pickers'), ENT_QUOTES, 'UTF-8') ?></button></li>
  <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pcTabConvert" type="button" role="tab"><?= htmlspecialchars($t('module_persian_calendar.tab_convert', 'Conversion'), ENT_QUOTES, 'UTF-8') ?></button></li>
  <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pcTabFormat" type="button" role="tab"><?= htmlspecialchars($t('module_persian_calendar.tab_format', 'Formatting'), ENT_QUOTES, 'UTF-8') ?></button></li>
  <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pcTabApi" type="button" role="tab"><?= htmlspecialchars($t('module_persian_calendar.tab_api', 'For developers'), ENT_QUOTES, 'UTF-8') ?></button></li>
</ul>

<div class="tab-content">

  <!-- ================= Calendar ================= -->
  <section class="tab-pane fade show active crm-persian-demo-section" id="pcTabCalendar" role="tabpanel">
    <div class="row g-4">
      <div class="col-lg-5">
        <div class="crm-card crm-section-card p-3">
          <div class="crm-section-head"><h2 class="h6 mb-0"><?= htmlspecialchars($t('module_persian_calendar.calendar_section_title', 'Jalali month calendar'), ENT_QUOTES, 'UTF-8') ?></h2></div>
          <p class="small text-muted mb-3"><?= htmlspecialchars($t('module_persian_calendar.calendar_section_hint', 'Navigate with buttons, selects, keyboard or the Today button.'), ENT_QUOTES, 'UTF-8') ?></p>
          <div id="demoCalendar" class="mb-2"></div>
          <div class="small text-muted" id="demoCalendarSelection"></div>
        </div>
      </div>
      <div class="col-lg-7">
        <div class="crm-card crm-section-card p-3">
          <div class="crm-section-head"><h2 class="h6 mb-0" dir="rtl"><?= htmlspecialchars(\Module\Crm\PersianCalendar\Service\JalaliCalendar::monthName($today_jalali['jm']), ENT_QUOTES, 'UTF-8') ?></h2></div>
          <table class="table crm-table mb-0" dir="rtl">
            <thead><tr>
              <?php foreach (\Module\Crm\PersianCalendar\Service\JalaliCalendar::WEEKDAY_NAMES_SHORT as $name): ?>
                <th class="text-center"><?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?></th>
              <?php endforeach; ?>
            </tr></thead>
            <tbody id="demoMonthGrid"></tbody>
          </table>
        </div>
      </div>
    </div>
  </section>

  <!-- ================= Pickers ================= -->
  <section class="tab-pane fade crm-persian-demo-section" id="pcTabPickers" role="tabpanel">
    <div class="row g-4">
      <div class="col-lg-6">
        <div class="crm-card crm-section-card p-3 mb-4">
          <div class="crm-section-head"><h2 class="h6 mb-0"><?= htmlspecialchars($t('module_persian_calendar.picker_date_label', 'Date picker'), ENT_QUOTES, 'UTF-8') ?></h2></div>
          <p class="small text-muted"><?= htmlspecialchars($t('module_persian_calendar.picker_date_hint', 'The field submits Gregorian ISO; the user sees Jalali.'), ENT_QUOTES, 'UTF-8') ?></p>
          <form id="demoDateForm" onsubmit="return false;">
            <input type="text" class="form-control mb-2" name="demo_due_at" id="demoDatePicker"
                   data-crm-persian-picker="date" value="<?= htmlspecialchars(date('Y-m-d'), ENT_QUOTES, 'UTF-8') ?>">
            <div class="d-flex flex-wrap gap-3 small">
              <span class="text-muted"><?= htmlspecialchars($t('module_persian_calendar.picker_value_label', 'Value returned to the application (ISO):'), ENT_QUOTES, 'UTF-8') ?>
                <code dir="ltr" id="demoDatePickerIso"><?= htmlspecialchars(date('Y-m-d'), ENT_QUOTES, 'UTF-8') ?></code></span>
            </div>
          </form>
        </div>

        <div class="crm-card crm-section-card p-3 mb-4">
          <div class="crm-section-head"><h2 class="h6 mb-0"><?= htmlspecialchars($t('module_persian_calendar.picker_restricted_label', 'Picker with min/max limits'), ENT_QUOTES, 'UTF-8') ?></h2></div>
          <p class="small text-muted"><?= htmlspecialchars($t('module_persian_calendar.picker_restricted_hint', 'Only the allowed range is selectable.'), ENT_QUOTES, 'UTF-8') ?></p>
          <input type="text" class="form-control mb-2" id="demoRestrictedPicker" placeholder="۱۴۰۵/۰۸/۰۵">
          <div class="small text-muted" dir="ltr"><?= htmlspecialchars(date('Y-m-d', strtotime('-10 days')), ENT_QUOTES, 'UTF-8') ?> … <?= htmlspecialchars(date('Y-m-d', strtotime('+20 days')), ENT_QUOTES, 'UTF-8') ?></div>
        </div>

        <div class="crm-card crm-section-card p-3">
          <div class="crm-section-head"><h2 class="h6 mb-0"><?= htmlspecialchars($t('module_persian_calendar.picker_readonly_label', 'Read-only display'), ENT_QUOTES, 'UTF-8') ?></h2></div>
          <p class="small text-muted"><?= htmlspecialchars($t('module_persian_calendar.picker_readonly_hint', 'Shows the Jalali value of an existing Gregorian date.'), ENT_QUOTES, 'UTF-8') ?></p>
          <input type="text" class="form-control" id="demoReadonlyPicker" readonly value="<?= htmlspecialchars(date('Y-m-d'), ENT_QUOTES, 'UTF-8') ?>">
        </div>
      </div>

      <div class="col-lg-6">
        <div class="crm-card crm-section-card p-3">
          <div class="crm-section-head"><h2 class="h6 mb-0"><?= htmlspecialchars($t('module_persian_calendar.picker_datetime_label', 'Date & time picker'), ENT_QUOTES, 'UTF-8') ?></h2></div>
          <p class="small text-muted"><?= htmlspecialchars($t('module_persian_calendar.picker_datetime_hint', 'Full local date-time; the form receives YYYY-MM-DDTHH:mm.'), ENT_QUOTES, 'UTF-8') ?></p>
          <input type="text" class="form-control mb-3" id="demoDateTimePicker" name="demo_reminder_at">
          <div class="d-flex flex-column gap-2 small">
            <span class="text-muted"><?= htmlspecialchars($t('module_persian_calendar.picker_value_label', 'Value returned to the application (ISO):'), ENT_QUOTES, 'UTF-8') ?>
              <code dir="ltr" id="demoDateTimeIso"></code></span>
            <span class="text-muted"><?= htmlspecialchars($t('module_persian_calendar.picker_display_label', 'Displayed (Jalali):'), ENT_QUOTES, 'UTF-8') ?>
              <span dir="rtl" id="demoDateTimeDisplay"></span></span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ================= Conversion ================= -->
  <section class="tab-pane fade crm-persian-demo-section" id="pcTabConvert" role="tabpanel">
    <div class="row g-4">
      <div class="col-lg-6">
        <div class="crm-card crm-section-card p-3 mb-4">
          <div class="crm-section-head"><h2 class="h6 mb-0">&larr; <?= htmlspecialchars($t('module_persian_calendar.convert_gregorian_input', 'Gregorian date'), ENT_QUOTES, 'UTF-8') ?></h2></div>
          <div class="input-group mb-2" dir="ltr">
            <input type="date" class="form-control" id="demoG2JInput" value="<?= htmlspecialchars(date('Y-m-d'), ENT_QUOTES, 'UTF-8') ?>">
            <button class="btn crm-btn-primary" type="button" id="demoG2JBtn"><?= htmlspecialchars($t('module_persian_calendar.convert_to_jalali', 'Convert to Jalali'), ENT_QUOTES, 'UTF-8') ?></button>
          </div>
          <div class="crm-persian-demo-result" dir="rtl" id="demoG2JResult"></div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="crm-card crm-section-card p-3 mb-4">
          <div class="crm-section-head"><h2 class="h6 mb-0">&rarr; <?= htmlspecialchars($t('module_persian_calendar.convert_jalali_input', 'Jalali date'), ENT_QUOTES, 'UTF-8') ?></h2></div>
          <div class="input-group mb-2" dir="rtl">
            <input type="text" class="form-control" id="demoJ2GInput" value="<?= htmlspecialchars('۱۴۰۵/۰۸/۰۹', ENT_QUOTES, 'UTF-8') ?>" inputmode="numeric">
            <button class="btn crm-btn-primary" type="button" id="demoJ2GBtn"><?= htmlspecialchars($t('module_persian_calendar.convert_to_gregorian', 'Convert to Gregorian'), ENT_QUOTES, 'UTF-8') ?></button>
          </div>
          <div class="crm-persian-demo-result" dir="ltr" id="demoJ2GResult"></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ================= Formatting ================= -->
  <section class="tab-pane fade crm-persian-demo-section" id="pcTabFormat" role="tabpanel">
    <div class="crm-card crm-section-card p-3">
      <div class="crm-section-head"><h2 class="h6 mb-0"><?= htmlspecialchars($t('module_persian_calendar.format_title', 'Formatting utilities'), ENT_QUOTES, 'UTF-8') ?></h2></div>
      <p class="small text-muted"><?= htmlspecialchars($t('module_persian_calendar.format_hint', 'Shared token patterns:'), ENT_QUOTES, 'UTF-8') ?></p>
      <table class="table crm-table">
        <thead><tr><th>Pattern</th><th><?= htmlspecialchars($t('module_persian_calendar.picker_display_label', 'Displayed (Jalali)'), ENT_QUOTES, 'UTF-8') ?></th></tr></thead>
        <tbody id="demoFormatRows"></tbody>
      </table>
    </div>
  </section>

  <!-- ================= Developers ================= -->
  <section class="tab-pane fade crm-persian-demo-section" id="pcTabApi" role="tabpanel">
    <div class="row g-4">
      <div class="col-lg-6">
        <div class="crm-card crm-section-card p-3">
          <div class="crm-section-head"><h2 class="h6 mb-0"><?= htmlspecialchars($t('module_persian_calendar.api_title', 'Using the module from other modules and pages'), ENT_QUOTES, 'UTF-8') ?></h2></div>
          <pre class="crm-persian-code" dir="ltr"><code>// Attach a picker to any input (auto-bound when the attribute is present):
&lt;input name="due_at" data-crm-persian-picker="date"&gt;
&lt;input name="reminder_at" data-crm-persian-picker="datetime"&gt;

// Or programmatically:
var PC = window.CRM.PersianCalendar;
var picker = PC.createDatePicker(document.querySelector('#due'), {
  min: '2026-01-01', max: '2026-12-31'
});
picker.setIsoValue('2026-10-31');     // user sees ۱۴۰۵/۰۸/۰۹
picker.getIsoValue();                 // '2026-10-31'

// Formatting everywhere in the UI:
PC.format('2026-10-31', 'YYYY/MM/DD');        // ۱۴۰۵/۰۸/۰۹
PC.format('2026-10-31', 'DD MMMM YYYY');      // ۹ آبان ۱۴۰۵
PC.format('2026-10-31', 'WD، DD MMMM YYYY');  // شنبه، ۹ آبان ۱۴۰۵

// Pure conversion:
PC.toJalali('2026-10-31');   // {jy: 1405, jm: 8, jd: 9}
PC.toGregorian(1405, 8, 9);  // {gy: 2026, gm: 10, gd: 31}
PC.jalaliToIso(1405, 8, 9);  // '2026-10-31'
PC.isLeapJalali(1403);       // true</code></pre>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="crm-card crm-section-card p-3 mb-4">
          <div class="crm-section-head"><h2 class="h6 mb-0"><?= htmlspecialchars($t('module_persian_calendar.numerals_title', 'Digit style for dates'), ENT_QUOTES, 'UTF-8') ?></h2></div>
          <label class="form-check form-switch mb-1">
            <input class="form-check-input" type="checkbox" role="switch" id="pcPersianNumeralsToggle">
            <span class="form-check-label" id="pcPersianNumeralsLabel"><?= htmlspecialchars($t('module_persian_calendar.numerals_persian', 'Persian digits (۱۲۳)'), ENT_QUOTES, 'UTF-8') ?></span>
          </label>
          <p class="small text-muted mb-0"><?= htmlspecialchars($t('module_persian_calendar.numerals_hint', 'Applies to every date in the interface; saved in this browser only.'), ENT_QUOTES, 'UTF-8') ?></p>
        </div>
        <div class="crm-card crm-section-card p-3 mb-4">
          <div class="crm-section-head"><h2 class="h6 mb-0"><?= htmlspecialchars($t('module_persian_calendar.config_title', 'Active configuration'), ENT_QUOTES, 'UTF-8') ?></h2></div>
          <table class="table crm-table mb-0">
            <tbody id="demoConfigRows"></tbody>
          </table>
          <p class="small text-muted mb-0 mt-2"><?= $canManage
            ? '<a href="index.php?route=admin-modules" data-i18n="admin_module_detail.link_modules">' . htmlspecialchars($t('admin_module_detail.link_modules', 'Modules'), ENT_QUOTES, 'UTF-8') . '</a>'
            : '' ?></p>
        </div>
        <div class="crm-card crm-section-card p-3">
          <div class="crm-section-head"><h2 class="h6 mb-0">REST API</h2></div>
          <pre class="crm-persian-code" dir="ltr"><code>GET /_module/crm.persian-calendar/config
GET /_module/crm.persian-calendar/today
GET /_module/crm.persian-calendar/convert/g2j?date=2026-03-21
GET /_module/crm.persian-calendar/convert/j2g?jy=1405&amp;jm=1&amp;jd=1
GET /_module/crm.persian-calendar/month?jy=1405&amp;jm=8
GET /_module/crm.persian-calendar/format?date=2026-10-31&amp;pattern=DD MMMM YYYY

// from the browser:
window.CRM.api.request(
  '_module/crm.persian-calendar/convert/g2j',
  { method: 'GET' }
).then(function (envelope) {
  console.log(envelope.data.jalali); // {jy: 1405, jm: 8, jd: 9}
});</code></pre>
        </div>
      </div>
    </div>
  </section>

</div>

</main></div></div>

<script nonce="<?= $csp_nonce ?>">
// Server-rendered configuration for this page; the library merges it before
// its first paint so the demo reflects the stored module settings instantly.
window.CRM = window.CRM || {};
window.CRM.PersianCalendarConfig = <?= json_encode([
  'default_calendar' => (string)($config['default_calendar'] ?? 'persian'),
  'date_format' => (string)($config['date_format'] ?? 'YYYY/MM/DD'),
  'datetime_format' => (string)($config['datetime_format'] ?? 'YYYY/MM/DD - HH:mm'),
  'time_format' => (string)($config['time_format'] ?? 'HH:mm'),
  'hour_format' => (string)($config['hour_format'] ?? '24h'),
  'persian_numerals' => (bool)($config['persian_numerals'] ?? true),
  'first_day_of_week' => (string)($config['first_day_of_week'] ?? 'saturday'),
  'minute_step' => (int)($config['minute_step'] ?? 5),
  'direction' => (string)($config['direction'] ?? 'rtl'),
  'highlight_today' => (bool)($config['highlight_today'] ?? true),
  'show_adjacent_days' => (bool)($config['show_adjacent_days'] ?? true),
  'weekend_day' => (string)($config['weekend_day'] ?? 'friday'),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
</script>
