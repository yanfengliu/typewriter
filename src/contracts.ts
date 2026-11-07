/** Shared interfaces between the mechanical model, paper, and 3D studio. */
export type RibbonColor = 'black' | 'red';
export interface Impression { char: string; column: number; line: number; energy: number; seed: number; ribbon: RibbonColor; }
export interface Sheet { id: number; created: string; impressions: Impression[]; }
export interface BarState { key: string; angle: number; velocity: number; pressed: boolean; }
export interface MechanicalState {
  column: number; carriage: number; carriageVelocity: number; line: number; feed: number;
  shift: number; shifted: boolean; ribbonLift: number; ribbonTravel: number;
  bars: BarState[]; jammed: boolean; returning: boolean; bell: number;
  strikeCount: number; lastEnergy: number; phase: string;
}
export interface MachineOptions { force: number; lineSpacing: number; ribbon: RibbonColor; }
export type MachineEvent = { type: 'impression'; impression: Impression } | { type: 'sound'; sound: 'strike' | 'space' | 'return' | 'bell' | 'jam'; energy?: number } | { type: 'notice'; message: string };
export interface MachineAPI {
  state: MechanicalState;
  options: MachineOptions;
  onEvent: (event: MachineEvent) => void;
  press(key: string): void;
  release(key: string): void;
  setShift(active: boolean): void;
  step(dt: number): void;
  clearJam(): void;
  newSheet(): void;
  restorePosition(column: number, line: number): void;
}
export type ViewMode = 'write' | 'inspect' | 'paper';
export type TutorialFocus = 'overview' | 'keys' | 'typebars' | 'ribbon' | 'escapement' | 'shift' | 'return';
/** A separate teaching diagram; never writes to the user's mechanical state or paper. */
export interface TutorialFrame {
  focus: TutorialFocus;
  progress: number;
  explosion: number;
  state: MechanicalState;
  ink: '' | 'a' | 'A';
  reducedMotion: boolean;
}
export interface SceneAPI {
  update(state: MechanicalState, dt: number): void;
  setView(mode: ViewMode): void;
  setCutaway(active: boolean): void;
  markPaperDirty(): void;
  resetCamera(): void;
  setTutorial(frame: TutorialFrame | null): void;
  dispose(): void;
}
export const COLUMNS = 66;
export const MAX_LINE = 55;
export const PAPER_WIDTH = 1700;
export const PAPER_HEIGHT = 2200;
export const PAPER_LEFT = 190;
export const PAPER_TOP = 200;
export const LETTER_PITCH = 20;
export const LINE_PITCH = 100 / 3;
export const KEY_ROWS = ['1234567890-=', 'qwertyuiop[]', "asdfghjkl;'", 'zxcvbnm,./'];
export const SHIFT_MAP: Record<string, string> = { '!':'1', '@':'2', '#':'3', '$':'4', '%':'5', '^':'6', '&':'7', '*':'8', '(':'9', ')':'0', '_':'-', '+':'=', '{':'[', '}':']', ':':';', '"':"'", '<':',', '>':'.', '?':'/' };
export function baseKey(key: string): string { return SHIFT_MAP[key] ?? key.toLowerCase(); }
