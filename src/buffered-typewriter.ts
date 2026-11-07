import { baseKey, COLUMNS, KEY_ROWS, type MachineAPI, type MachineEvent, type MachineOptions } from './contracts';
import { TypewriterMachine } from './mechanics';

type Stroke = { key: string; shifted: boolean; options: MachineOptions };
const printable = new Set(KEY_ROWS.join(''));
const controls = new Set(['Enter', 'Backspace', 'Tab', 'ArrowUp', 'ArrowDown', ' ']);
const normalize = (key: string) => key === 'Space' || key === 'Spacebar' ? ' ' : key;

/** Retain input independently of animation speed; the mechanical model still deposits the ink. */
export class BufferedTypewriter implements MachineAPI {
  private readonly mechanism = new TypewriterMachine();
  readonly state = this.mechanism.state;
  options: MachineOptions = { ...this.mechanism.options };
  onEvent: (event: MachineEvent) => void = () => {};
  private readonly queue: Stroke[] = [];
  private readonly held = new Set<string>();
  private requestedShift = false;

  constructor() {
    this.mechanism.onEvent = event => this.onEvent(event);
  }

  get pendingCount(): number { return this.queue.length; }
  get busy(): boolean { return !this.mechanism.readyForInput; }
  get hasPendingInput(): boolean {
    return this.pendingCount > 0 || this.state.bars.some(bar => bar.velocity > 0);
  }
  get waitingAtMargin(): boolean {
    return !this.busy && this.state.column >= COLUMNS && this.queue.length > 0 && this.needsColumn(this.queue[0]);
  }

  press(input: string): void {
    const key = normalize(input);
    if (key === 'Shift' || key === 'ShiftLeft' || key === 'ShiftRight') { this.setShift(true); return; }
    if (key === 'Escape') { this.clearJam(); return; }
    const id = baseKey(key);
    if (this.held.has(id)) return;
    this.held.add(id);
    if (!controls.has(key) && !(key.length === 1 && printable.has(id))) {
      this.onEvent({ type: 'notice', message: 'This typewriter has a fixed Latin keyboard; that character has no typebar.' });
      return;
    }
    // Capture modifiers and settings now, not later when a released key finally prints.
    this.queue.push({ key, shifted: this.requestedShift, options: { ...this.options } });
    this.dispatch();
  }

  release(input: string): void {
    if (input === 'Shift' || input === 'ShiftLeft' || input === 'ShiftRight') { this.setShift(false); return; }
    this.held.delete(baseKey(normalize(input)));
  }

  setShift(active: boolean): void {
    this.requestedShift = active;
    if (!this.busy) this.mechanism.setShift(active);
  }

  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    let remaining = Math.min(dt, .25);
    // Dispatch between physics ticks so queue throughput does not depend on render rate.
    while (remaining > 1e-10) {
      this.dispatch();
      const slice = Math.min(remaining, 1 / 240);
      this.mechanism.step(slice);
      remaining -= slice;
    }
    this.dispatch();
  }

  clearJam(): void { this.mechanism.clearJam(); }

  newSheet(): void {
    // At a margin, moving to a fresh sheet must retain any still-unprinted letters.
    if (this.busy) return;
    this.mechanism.newSheet();
    this.held.clear();
  }

  restorePosition(column: number, line: number): void {
    this.queue.length = 0;
    this.held.clear();
    this.mechanism.restorePosition(column, line);
  }

  private needsColumn(stroke: Stroke): boolean { return stroke.key.length === 1; }

  private dispatch(): void {
    if (this.busy) return;
    if (!this.queue.length) { this.mechanism.setShift(this.requestedShift); return; }
    let index = 0;
    if (this.state.column >= COLUMNS && this.needsColumn(this.queue[0])) {
      // A hard margin still needs a manual return. Let that control unblock the
      // waiting letters without discarding them or automatically wrapping.
      index = this.queue.findIndex(stroke => stroke.key === 'Enter' || stroke.key === 'Backspace');
      if (index < 0) return;
    }
    const [stroke] = this.queue.splice(index, 1);
    Object.assign(this.mechanism.options, stroke.options);
    this.mechanism.setShift(stroke.shifted);
    this.mechanism.press(stroke.key);
    this.mechanism.release(stroke.key);
  }
}
