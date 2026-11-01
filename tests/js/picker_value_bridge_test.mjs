/**
 * Picker value-bridge tests with a minimal fake DOM (no dependencies).
 *
 * Covers the contract the TropaTT core relies on when the Jalali picker
 * replaces a native date field:
 *  - .value reads/writes on the visible input carry the Gregorian ISO value
 *    (br1.js reads date fields by id!),
 *  - [name=...] resolves to the hidden mirror and stays ISO (FormData and
 *    querySelector-based flows),
 *  - prefills written into the mirror refresh the Jalali display,
 *  - init() auto-attaches to input[type=date]/[datetime-local], converts the
 *    type to text, keeps min/max, and is idempotent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------
// Fake DOM (just enough surface for DatePicker/DateTimePicker/init)
// ---------------------------------------------------------------------

class FakeClassList {
  constructor() { this.items = new Set(); }
  add(c) { this.items.add(c); }
  remove(c) { this.items.delete(c); }
  contains(c) { return this.items.has(c); }
}

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = new FakeClassList();
    this.dataset = {};
    this._attrs = new Map();
    this._listeners = new Map();
    this._value = '';
    this._type = 'text';
    this.readOnly = false;
    this.disabled = false;
  }

  get type() { return this._type; }
  set type(v) { this._type = v; }

  getAttribute(name) { return this._attrs.has(name) ? this._attrs.get(name) : null; }
  setAttribute(name, value) { this._attrs.set(name, String(value)); }
  removeAttribute(name) { this._attrs.delete(name); }

  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const list = this._listeners.get(type) || [];
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  dispatchEvent(event) {
    for (const fn of this._listeners.get(event.type) || []) fn.call(this, event);
    return true;
  }

  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  insertBefore(child, ref) {
    child.parentNode = this;
    const i = this.children.indexOf(ref);
    if (i >= 0) this.children.splice(i, 0, child); else this.children.push(child);
    return child;
  }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  contains(node) {
    for (const child of this.children) {
      if (child === node || child.contains(node)) return true;
    }
    return false;
  }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { top: 0, bottom: 40, left: 0, right: 200 }; }
  focus() {}
  get form() { return this._form || null; }
}

class HTMLInputElement extends FakeElement {}
Object.defineProperty(HTMLInputElement.prototype, 'value', {
  configurable: true,
  get() { return this._value; },
  set(v) { this._value = v === null || v === undefined ? '' : String(v); }
});

globalThis.HTMLInputElement = HTMLInputElement;
globalThis.CustomEvent = class CustomEvent {
  constructor(type, opts) { this.type = type; Object.assign(this, opts || {}); }
};
globalThis.Event = class Event {
  constructor(type, opts) { this.type = type; Object.assign(this, opts || {}); }
};
globalThis.document = {
  readyState: 'loading', // keep the library's auto-bootstrap dormant
  addEventListener() {},
  removeEventListener() {},
  createElement: (tag) => new FakeElement(tag),
  body: new FakeElement('body'),
  dispatchEvent() {}
};

const PC = require('../../web/assets/js/persian-calendar.js');

function namedInput(overrides) {
  const parent = new FakeElement('div');
  const input = new HTMLInputElement('input');
  input._type = 'date';
  input._value = '2026-10-31';
  input.setAttribute('name', 'due_at');
  input.setAttribute('min', '2026-11-01');
  for (const [k, v] of Object.entries(overrides || {})) {
    if (k === 'value') input._value = v;
    else if (k === 'type') input._type = v;
    else input.setAttribute(k, v);
  }
  parent.appendChild(input);
  return { parent, input };
}

function nativeValue(el) {
  return PC._internal.nativeValue(el);
}

// ---------------------------------------------------------------------
// Value bridge
// ---------------------------------------------------------------------

test('attach: display shows Jalali, .value still answers ISO', () => {
  const { parent, input } = namedInput();
  const picker = new PC.DatePicker(input, {});

  assert.equal(input.type, 'date'); // untouched by direct construction
  assert.equal(input.value, '2026-10-31', 'the app keeps reading ISO through .value');
  assert.equal(nativeValue(input), '۱۴۰۵/۰۸/۰۹', 'the user sees the Jalali display');

  const mirror = parent.children.find((c) => c !== input);
  assert.ok(mirror, 'hidden mirror exists');
  assert.equal(mirror.name, 'due_at', 'the mirror carries the form field name');
  assert.equal(mirror.value, '2026-10-31');
  assert.equal(input.getAttribute('name'), null, 'visible input no longer submits');

  assert.equal(picker.getIsoValue(), '2026-10-31');
  assert.equal(picker.getJalaliValue().jm, 8);
});

test('core prefill by [name=...] (mirror write) refreshes the display', () => {
  const { input } = namedInput();
  const picker = new PC.DatePicker(input, {});
  const mirror = input.parentNode.children.find((c) => c !== input);

  // br1.js opens the event modal like this: form.querySelector('[name=...]').value = iso
  mirror.value = '2026-03-21';

  assert.equal(mirror.value, '2026-03-21');
  assert.equal(input.value, '2026-03-21', 'reads through .value stay ISO');
  assert.equal(nativeValue(input), '۱۴۰۵/۰۱/۰۱', 'display follows the mirror prefill');
  assert.equal(picker.getJalaliValue().jd, 1);
});

test('core write by id (visible .value =) adopts ISO and syncs the mirror', () => {
  const { input } = namedInput();
  const picker = new PC.DatePicker(input, {});
  const mirror = input.parentNode.children.find((c) => c !== input);

  input.value = '2027-01-05';

  assert.equal(input.value, '2027-01-05');
  assert.equal(mirror.value, '2027-01-05');
  assert.equal(picker.getIsoValue(), '2027-01-05');
  assert.equal(picker.getJalaliValue().jm, 10, '2027-01-05 is Dey 1405');
});

test('clearing through .value empties display and mirror', () => {
  const { input } = namedInput();
  const picker = new PC.DatePicker(input, {});
  const mirror = input.parentNode.children.find((c) => c !== input);

  input.value = '';
  assert.equal(input.value, '');
  assert.equal(mirror.value, '');
  assert.equal(nativeValue(input), '');
  assert.equal(picker.getIsoValue(), '');
});

test('typed Jalali text commits as ISO (parseJalali disambiguation)', () => {
  const { input } = namedInput({ value: '' });
  const picker = new PC.DatePicker(input, {});

  // Typed text lands in the internal value; commit parses it.
  PC._internal.setNativeValue(input, '1405/8/9');
  picker._commitTypedValue();
  assert.equal(input.value, '2026-10-31', '1405/8/9 is Jalali for 2026-10-31');

  // Pasting a Gregorian ISO value into the input keeps its Gregorian meaning.
  PC._internal.setNativeValue(input, '2026-10-15');
  picker._commitTypedValue();
  assert.equal(input.value, '2026-10-15');
  assert.equal(picker.getJalaliValue().jd, 23, '2026-10-15 = 1405/08/23');
});

test('destroy() removes the bridge and restores the field', () => {
  const { input } = namedInput();
  const picker = new PC.DatePicker(input, {});
  const mirror = input.parentNode.children.find((c) => c !== input);

  picker.destroy();

  assert.equal(mirror.parentNode, null);
  assert.equal(input.getAttribute('name'), 'due_at');
  assert.equal(input.value, '2026-10-31', 'plain accessor again after destroy');
});

// ---------------------------------------------------------------------
// init(): auto-attach to native date inputs
// ---------------------------------------------------------------------

test('init() converts and attaches to input[type=date], honors min, is idempotent', () => {
  const { parent, input } = namedInput();
  const scope = {
    querySelectorAll: () => [input]
  };

  const created = PC.init(scope);
  assert.equal(created.length, 1);

  assert.equal(input.type, 'text', 'native picker replaced');
  assert.equal(input.getAttribute('data-crm-persian-native-type'), 'date');
  assert.equal(input.getAttribute('data-crm-persian-ready'), '1');
  assert.equal(input.value, '2026-10-31', '.value still ISO after auto-attach');
  assert.equal(created[0].min.iso, '2026-11-01', 'native min constraint adopted');

  // Second pass must not attach twice.
  assert.equal(PC.init(scope).length, 0);

  // The mirror name flow survives auto-attach.
  const mirror = parent.children.find((c) => c !== input);
  assert.equal(mirror && mirror.name, 'due_at');
});

test('init() skips opt-outs, disabled fields and non-inputs', () => {
  const skipped = new HTMLInputElement('input');
  skipped._type = 'date';
  skipped.setAttribute('data-crm-persian-skip', '1');

  const disabled = new HTMLInputElement('input');
  disabled._type = 'date';
  disabled.disabled = true;

  const marked = new HTMLInputElement('input');
  marked._type = 'text';
  marked.setAttribute('data-crm-persian-picker', 'date');
  marked.setAttribute('data-crm-persian-ready', '1'); // already attached elsewhere

  const scope = { querySelectorAll: () => [skipped, disabled, marked] };
  assert.equal(PC.init(scope).length, 0);
});

test('init() attaches a datetime picker to input[type=datetime-local]', () => {
  const input = new HTMLInputElement('input');
  input._type = 'datetime-local';
  input._value = '2026-10-31T14:30';
  const scope = { querySelectorAll: () => [input] };

  const created = PC.init(scope);
  assert.equal(created.length, 1);
  assert.equal(input.getAttribute('data-crm-persian-picker'), 'datetime');
  assert.equal(input.value, '2026-10-31T14:30', 'ISO date-time preserved');
  assert.equal(created[0].getIsoValue(), '2026-10-31T14:30');
});
