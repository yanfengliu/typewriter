import { PAPER_WIDTH, PAPER_HEIGHT, PAPER_LEFT, PAPER_TOP, LETTER_PITCH, LINE_PITCH, COLUMNS, MAX_LINE, type Impression, type Sheet } from './contracts';

const STORAGE_KEY = 'atelier.typewriter.v1';
type Position = { column: number; line: number };
type Session = { version: 1; current: Sheet; archive: Sheet[]; position: Position };

function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}

function isImpression(value: unknown): value is Impression {
  if (!value || typeof value !== 'object') return false;
  const i = value as Impression;
  return typeof i.char === 'string' && i.char.length === 1 && Number.isFinite(i.column) && i.column >= 0 && i.column < COLUMNS && Number.isFinite(i.line) && i.line >= 0 && i.line <= MAX_LINE && Number.isFinite(i.energy) && i.energy >= 0 && Number.isFinite(i.seed) && (i.ribbon === 'black' || i.ribbon === 'red');
}

function isSheet(value: unknown): value is Sheet {
  if (!value || typeof value !== 'object') return false;
  const sheet = value as Sheet;
  return Number.isSafeInteger(sheet.id) && sheet.id > 0 && typeof sheet.created === 'string' && Array.isArray(sheet.impressions) && sheet.impressions.every(isImpression);
}

/** A sheet is an append-only list of impacts. Rendering never removes existing ink. */
export class PaperStore {
  readonly canvas = document.createElement('canvas');
  current: Sheet = { id: 1, created: new Date().toISOString(), impressions: [] };
  archive: Sheet[] = [];
  position: Position = { column: 0, line: 0 };
  onWarning: (message: string) => void = () => {};
  private readonly context: CanvasRenderingContext2D;
  private readonly blank: HTMLCanvasElement;
  private pendingWarning = '';
  private expectedStoredRaw: string | null = null;

  constructor() {
    this.canvas.width = PAPER_WIDTH;
    this.canvas.height = PAPER_HEIGHT;
    this.canvas.setAttribute('aria-label', 'Your paper, with permanent ink impressions');
    this.context = this.canvas.getContext('2d')!;
    this.blank = this.makeBlank();
    this.restore();
    this.render(this.current, this.canvas);
  }

  reportPendingWarning(): void { if (this.pendingWarning) this.onWarning(this.pendingWarning); }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.expectedStoredRaw = raw;
      if (!raw) return;
      const session: unknown = JSON.parse(raw);
      const s = session as Session;
      if (!s || s.version !== 1 || !isSheet(s.current) || !Array.isArray(s.archive) || !s.archive.every(isSheet) || !s.position || !Number.isFinite(s.position.column) || !Number.isFinite(s.position.line)) {
        this.pendingWarning = 'An older saved session could not be read. It has been kept in browser storage; download new pages before leaving.';
        this.storageBlocked = true;
        return;
      }
      this.current = s.current;
      this.archive = s.archive;
      this.position = { column: Math.max(0, Math.min(COLUMNS, s.position.column)), line: Math.max(0, Math.min(MAX_LINE, s.position.line)) };
    } catch {
      this.storageBlocked = true;
      this.pendingWarning = 'Browser saving is unavailable. Your paper stays in this tab; download it before leaving.';
    }
  }

  private storageBlocked = false;

  save(position: Position): void {
    this.position = { ...position };
    if (this.storageBlocked) return;
    try {
      // A stale tab must not replace another tab's newer sheet or archive.
      // This is optimistic conflict detection, not an atomic storage lock.
      if (localStorage.getItem(STORAGE_KEY) !== this.expectedStoredRaw) {
        this.storageBlocked = true;
        this.onWarning('Another tab changed the saved sheets. Saving in this tab has stopped to protect them. Your marks are still here; download every page in this tab before reloading.');
        return;
      }
      const raw = JSON.stringify({ version: 1, current: this.current, archive: this.archive, position: this.position } satisfies Session);
      localStorage.setItem(STORAGE_KEY, raw);
      this.expectedStoredRaw = raw;
    } catch {
      this.onWarning('Browser storage is full or unavailable. Every page is still in this tab; download your pages before leaving.');
    }
  }

  append(impression: Impression): void {
    const immutable = Object.freeze({ ...impression });
    this.current.impressions.push(immutable);
    this.drawImpression(this.context, immutable);
  }

  newSheet(): void {
    this.archive.push(this.current);
    this.current = { id: Math.max(this.current.id, ...this.archive.map(sheet => sheet.id)) + 1, created: new Date().toISOString(), impressions: [] };
    this.position = { column: 0, line: 0 };
    this.render(this.current, this.canvas);
    this.save(this.position);
  }

  render(sheet: Sheet, canvas = document.createElement('canvas')): HTMLCanvasElement {
    canvas.width = PAPER_WIDTH;
    canvas.height = PAPER_HEIGHT;
    const context = canvas.getContext('2d')!;
    context.drawImage(this.blank, 0, 0);
    for (const impression of sheet.impressions) this.drawImpression(context, impression);
    return canvas;
  }

  download(sheet = this.current): void {
    const canvas = sheet === this.current ? this.canvas : this.render(sheet);
    canvas.toBlob(blob => {
      if (!blob) { this.onWarning('The page could not be exported. Please try again.'); return; }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `atelier-sheet-${String(sheet.id).padStart(2, '0')}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  private makeBlank(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = PAPER_WIDTH;
    canvas.height = PAPER_HEIGHT;
    const ctx = canvas.getContext('2d')!;
    const rng = random(88318);
    const image = ctx.createImageData(PAPER_WIDTH, PAPER_HEIGHT);
    for (let p = 0; p < image.data.length; p += 4) {
      const grain = Math.floor(rng() * 7);
      image.data[p] = 249 - grain;
      image.data[p + 1] = 245 - grain;
      image.data[p + 2] = 232 - grain;
      image.data[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    ctx.strokeStyle = 'rgba(112,95,61,.035)';
    for (let i = 0; i < 5200; i++) {
      const x = rng() * PAPER_WIDTH, y = rng() * PAPER_HEIGHT;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1 + rng() * 8, y + rng() * 2); ctx.stroke();
    }
    return canvas;
  }

  private drawImpression(context: CanvasRenderingContext2D, impression: Impression): void {
    const rng = random(impression.seed);
    // Fiber dropout is removed from this single ink stamp, never from the paper beneath.
    const stamp = document.createElement('canvas');
    stamp.width = 56; stamp.height = 64;
    const ink = stamp.getContext('2d')!;
    const strength = Math.max(.22, Math.min(.96, .25 + .65 * Math.sqrt(impression.energy / .02)));
    ink.font = 'bold 33.333px "Courier New", Courier, monospace';
    ink.textAlign = 'center'; ink.textBaseline = 'alphabetic';
    ink.fillStyle = impression.ribbon === 'red' ? `rgba(137,37,28,${strength})` : `rgba(35,36,31,${strength})`;
    ink.fillText(impression.char, 28, 43);
    ink.globalCompositeOperation = 'destination-out';
    for (let n = 0; n < 42; n++) {
      ink.fillStyle = `rgba(0,0,0,${.1 + rng() * .55})`;
      ink.fillRect(12 + rng() * 30, 16 + rng() * 30, .25 + rng() * .75, .3 + rng());
    }
    context.save();
    context.globalCompositeOperation = 'multiply';
    context.translate(PAPER_LEFT + impression.column * LETTER_PITCH + 10 + (rng() - .5) * .65, PAPER_TOP + impression.line * LINE_PITCH + (rng() - .5) * .9);
    context.rotate((rng() - .5) * .018);
    context.drawImage(stamp, -28, -43);
    context.restore();
  }
}
