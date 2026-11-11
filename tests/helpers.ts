import { Typewriter, Mark } from '../src/sim/machine';
import { Typist } from '../src/sim/typist';
import { CHAR_PITCH, LINE_PITCH, PAPER } from '../src/sim/layout';

export interface Rig { tw: Typewriter; typist: Typist }

export function rig(): Rig {
  const tw = new Typewriter();
  return { tw, typist: new Typist(tw) };
}

/** Queue text: '\n' = carriage return, '\b' = backspace. */
export function queueText({ tw, typist }: Rig, text: string): void {
  for (const ch of text) {
    if (ch === ' ') typist.enqueue({ kind: 'space' });
    else if (ch === '\n') typist.enqueue({ kind: 'return' });
    else if (ch === '\b') typist.enqueue({ kind: 'backspace' });
    else {
      const k = tw.keys.find((q) => q.lower === ch || q.upper === ch);
      if (!k) throw new Error(`no key for ${JSON.stringify(ch)}`);
      typist.enqueue({ kind: 'char', code: k.code, shift: k.upper === ch });
    }
  }
}

/** Run until the queue is empty and the machine is at rest. Returns simulated seconds elapsed. */
export function settle({ tw, typist }: Rig, limit = 20): number {
  const t0 = tw.time;
  while ((typist.pending > 0 || !tw.idle) && tw.time - t0 < limit) {
    tw.advance(0.002);
    if (typist.lineLocked && typist.pending > 0 && tw.idle) break;
  }
  return tw.time - t0;
}

export const col = (m: Mark): number => m.u / CHAR_PITCH;
export const line = (m: Mark): number => (m.v - PAPER.topMargin) / LINE_PITCH;

/** Lay the marks out as text, the way a reader sees the sheet. */
export function page(marks: Mark[]): string[] {
  const rows = new Map<number, Map<number, string>>();
  for (const m of marks) {
    if (m.ink < 0.05) continue;
    const r = Math.round(line(m)), c = Math.round(col(m));
    if (!rows.has(r)) rows.set(r, new Map());
    rows.get(r)!.set(c, m.ch);
  }
  const out: string[] = [];
  for (const r of [...rows.keys()].sort((a, b) => a - b)) {
    const cells = rows.get(r)!;
    const last = Math.max(...cells.keys());
    let s = '';
    for (let c = 0; c <= last; c++) s += cells.get(c) ?? ' ';
    out[r] = s;
  }
  return out;
}

export const count = (tw: Typewriter, type: string): number => tw.events.filter((e) => e.type === type).length;
export const first = (tw: Typewriter, type: string) => tw.events.find((e) => e.type === type);
