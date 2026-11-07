import assert from 'node:assert/strict';
import test from 'node:test';
import { PaperStore } from '../src/paper';
import type { Impression } from '../src/contracts';

const STORAGE_KEY = 'atelier.typewriter.v1';
const mark = (char: string, column = 0): Impression => ({ char, column, line: 0, energy: .02, seed: column + 1, ribbon: 'black' });

class SharedStorage {
  data = new Map<string, string>();
  writes = 0;
  failWrite = false;
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.failWrite) throw new Error('Quota exceeded');
    this.writes++;
    this.data.set(key, value);
  }
}

// These tests exercise the real PaperStore persistence and append-only records.
// Canvas drawing is stubbed; glyph appearance is verified in the browser.
function withBrowser(run: (storage: SharedStorage) => void): void {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new SharedStorage();
  const context = () => ({
    createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData() {}, drawImage() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() {}, fillText() {}, fillRect() {}, save() {}, translate() {}, rotate() {}, restore() {},
  });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, setAttribute() {}, getContext: context }) } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try { run(storage); }
  finally {
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('a stale tab cannot overwrite a newer sheet or its archive on autosave or unload', () => withBrowser(storage => {
  const firstTab = new PaperStore();
  const staleTab = new PaperStore();
  const warnings: string[] = [];
  staleTab.onWarning = warning => warnings.push(warning);

  firstTab.append(mark('A'));
  firstTab.newSheet();
  firstTab.append(mark('B'));
  firstTab.save({ column: 1, line: 0 });
  const protectedRaw = storage.getItem(STORAGE_KEY);
  const successfulWrites = storage.writes;

  staleTab.append(mark('X'));
  staleTab.save({ column: 1, line: 0 }); // Debounced autosave.
  staleTab.save({ column: 1, line: 0 }); // beforeunload/pagehide saves again.
  assert.equal(storage.getItem(STORAGE_KEY), protectedRaw);
  assert.equal(storage.writes, successfulWrites);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Another tab changed.*download/);
  assert.equal(staleTab.current.impressions[0].char, 'X', 'local marks remain available to export');

  const restored = new PaperStore();
  assert.equal(restored.current.id, 2);
  assert.equal(restored.current.impressions[0].char, 'B');
  assert.equal(restored.archive[0].impressions[0].char, 'A');
}));

test('a conflict also protects an existing restored session and remains blocked', () => withBrowser(storage => {
  const seed = new PaperStore();
  seed.append(mark('A'));
  seed.save({ column: 1, line: 0 });
  const initialRaw = storage.getItem(STORAGE_KEY)!;
  const firstTab = new PaperStore();
  const staleTab = new PaperStore();
  firstTab.newSheet();
  staleTab.save({ column: 1, line: 0 });
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).archive.length, 1);

  // Once a conflict is detected, reverting storage must not silently re-enable
  // the stale writer and erase a later owner's deliberate state.
  storage.setItem(STORAGE_KEY, initialRaw);
  staleTab.append(mark('X', 1));
  staleTab.newSheet();
  assert.equal(storage.getItem(STORAGE_KEY), initialRaw);
  assert.deepEqual(staleTab.archive[0].impressions.map(i => i.char), ['A', 'X']);
}));

test('deleting shared storage is a conflict, not permission to recreate stale data', () => withBrowser(storage => {
  const paper = new PaperStore();
  const warnings: string[] = [];
  paper.onWarning = warning => warnings.push(warning);
  paper.append(mark('A'));
  paper.save({ column: 1, line: 0 });
  storage.data.delete(STORAGE_KEY);
  paper.save({ column: 1, line: 0 });
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.match(warnings[0], /Another tab changed/);
  assert.equal(paper.current.impressions.length, 1);
}));

test('successful saves advance the comparison value and quota failures remain retryable', () => withBrowser(storage => {
  const paper = new PaperStore();
  const warnings: string[] = [];
  paper.onWarning = warning => warnings.push(warning);
  paper.append(mark('A'));
  paper.save({ column: 1, line: 0 });
  const firstRaw = storage.getItem(STORAGE_KEY);
  paper.append(mark('B', 1));
  storage.failWrite = true;
  paper.save({ column: 2, line: 0 });
  assert.equal(storage.getItem(STORAGE_KEY), firstRaw);
  assert.match(warnings[0], /full or unavailable/);
  storage.failWrite = false;
  paper.save({ column: 2, line: 0 });
  paper.append(mark('C', 2));
  paper.save({ column: 3, line: 0 });
  const restored = new PaperStore();
  assert.deepEqual(restored.current.impressions.map(i => i.char), ['A', 'B', 'C']);
  assert.equal(restored.position.column, 3);
  assert.equal(warnings.length, 1);
}));

test('invalid saved data remains untouched and warns before writing new marks', () => withBrowser(storage => {
  const invalid = '{"version":9,"current":"unreadable"}';
  storage.setItem(STORAGE_KEY, invalid);
  const paper = new PaperStore();
  const warnings: string[] = [];
  paper.onWarning = warning => warnings.push(warning);
  paper.reportPendingWarning();
  paper.append(mark('A'));
  paper.save({ column: 1, line: 0 });
  assert.equal(storage.getItem(STORAGE_KEY), invalid);
  assert.match(warnings[0], /could not be read/);
  assert.equal(paper.current.impressions[0].char, 'A');
}));
