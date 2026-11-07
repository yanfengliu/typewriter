import { baseKey, COLUMNS, KEY_ROWS, MAX_LINE, SHIFT_MAP, type BarState, type MachineAPI, type MachineEvent, type MachineOptions, type MechanicalState } from './contracts';

/* A reduced mechanical model, not measured parameters for a specific machine.
 * Generalized typebar angle q = theta / SWEEP. The real angular equation is
 * I theta'' = -k theta - c theta' - m g L/2 cos(theta).
 * A key linkage delivers a finite impulse; keyboard hardware cannot sense force.
 * Paper contact has a restitution coefficient; its lost kinetic energy inks the
 * paper. A full-drop escapement releases only after that contact. The carriage
 * uses F = ma until the next rack detent dissipates its remaining kinetic energy.
 * Semi-implicit Euler runs at 240 Hz, independently of the rendering frame rate.
 */
const FIXED_DT = 1 / 240;
const SWEEP = 1.55; // radians from felt rest to platen contact
const INERTIA = 0.000018; // kg m², effective inertia including the key linkage
const TORSION = 0.012; // N m/rad, return spring
const DAMPING = 0.00004; // N m s/rad
const GRAVITY_MOMENT = 0.0036; // N m, m g L/2
const RESTITUTION = 0.16;
const PITCH = 0.00254; // metres: 10 characters per inch
const CARRIAGE_MASS = 1.35; // kg
const MAINSPRING_FORCE = 4.1; // N, locally constant over a single escapement step
const CARRIAGE_DRAG = 4; // N s/m
const GATE = 0.76;
const BELL_COLUMN = COLUMNS - 8;
const PRINTABLE = new Set(KEY_ROWS.join('').split(''));
const UPPER_FACES = Object.fromEntries(Object.entries(SHIFT_MAP).map(([upper, lower]) => [lower, upper]));

type Flight = { char: string; contacted: boolean; active: boolean };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const keyId = (key: string) => key === 'Space' || key === 'Spacebar' ? ' ' : baseKey(key);

export class TypewriterMachine implements MachineAPI {
  options: MachineOptions = { force: 0.95, lineSpacing: 1, ribbon: 'black' };
  onEvent: (event: MachineEvent) => void = () => {};
  state: MechanicalState = {
    column: 0, carriage: 0, carriageVelocity: 0, line: 0, feed: 0,
    shift: 0, shifted: false, ribbonLift: 0, ribbonTravel: 0,
    bars: KEY_ROWS.join('').split('').map(key => ({ key, angle: 0, velocity: 0, pressed: false })),
    jammed: false, returning: false, bell: 0, strikeCount: 0, lastEnergy: 0, phase: 'Ready',
  };
  private accumulator = 0;
  private carriageTarget = 0;
  private carriageDrive: 'spring' | 'hand' = 'spring';
  private feedVelocity = 0;
  private shiftVelocity = 0;
  private held = new Set<string>();
  private flights = new Map<string, Flight>();
  private sequence = 1;
  private bellArmed = true;

  press(key: string): void {
    if (key === 'Shift' || key === 'ShiftLeft' || key === 'ShiftRight') { this.setShift(true); return; }
    const id = keyId(key);
    if (this.held.has(id)) return; // No computer-style repeat on a held manual key.
    this.held.add(id);
    if (key === 'Escape') { this.clearJam(); return; }
    if (this.state.jammed) { this.notice('Typebars are jammed. Release them to continue.'); return; }
    if (this.state.returning || this.carriageMoving || this.feedMoving) {
      this.notice(this.state.returning ? 'The carriage is returning.' : 'Let the mechanism settle.');
      return;
    }
    if (key === 'Enter' || key === 'Backspace' || key === 'Tab' || key === 'ArrowUp' || key === 'ArrowDown' || id === ' ') {
      if (this.barsMoving) { this.notice('Let the typebar return before moving the paper.'); return; }
      if (key === 'Enter') {
        this.state.returning = true;
        this.moveCarriage(0, 'hand');
        this.setFeed(this.state.line + this.spacing);
        this.sound('return');
      } else if (key === 'Backspace') {
        this.moveCarriage(this.state.column - 1, 'hand');
        this.sound('space');
      } else if (key === 'Tab') {
        this.moveCarriage(Math.min(COLUMNS, (Math.floor(this.state.column / 8) + 1) * 8), 'spring');
        this.sound('space');
      } else if (key === 'ArrowUp' || key === 'ArrowDown') {
        this.setFeed(this.state.line + (key === 'ArrowDown' ? this.spacing : -this.spacing));
        this.sound('space');
      } else if (this.state.column < COLUMNS) {
        this.moveCarriage(this.state.column + 1, 'spring');
        this.sound('space');
      } else this.notice('Right margin reached. Return the carriage to continue.');
      return;
    }
    if (key.length !== 1 || !PRINTABLE.has(id)) {
      this.notice('This typewriter has a fixed Latin keyboard; that character has no typebar.');
      return;
    }
    if (this.state.column >= COLUMNS) { this.notice('Right margin reached. Return the carriage to continue.'); return; }
    const bar = this.state.bars.find(item => item.key === id)!;
    if (bar.angle > 0.015 || this.flights.get(id)?.active) {
      this.notice('That typebar is still returning.');
      return;
    }
    bar.pressed = true;
    const force = Number.isFinite(this.options.force) ? clamp(this.options.force, 0.55, 1.4) : 0.95;
    const linkageWork = 0.027 + 0.01 * force * force; // J of external work supplied at the key
    bar.velocity = Math.sqrt(2 * linkageWork / INERTIA) / SWEEP;
    const char = this.state.shifted ? UPPER_FACES[id] ?? id.toUpperCase() : key;
    this.flights.set(id, { char, contacted: false, active: true });
    this.state.phase = 'Typebar in flight';
  }

  release(key: string): void {
    if (key === 'Shift' || key === 'ShiftLeft' || key === 'ShiftRight') { this.setShift(false); return; }
    const id = keyId(key);
    this.held.delete(id);
    const bar = this.state.bars.find(item => item.key === id);
    if (bar) bar.pressed = false;
  }

  setShift(active: boolean): void { this.state.shifted = active; }

  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Suspend instead of fast-forwarding after an inactive browser tab.
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator + 1e-12 >= FIXED_DT) {
      this.integrate(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
  }

  clearJam(): void {
    if (!this.state.jammed) return;
    this.state.jammed = false;
    for (const bar of this.state.bars) {
      bar.pressed = false;
      // The operator separates the two bars; return springs supply the motion.
      if (bar.angle > 0) bar.velocity = Math.min(bar.velocity, -0.2);
      const flight = this.flights.get(bar.key);
      if (flight) flight.contacted = true; // A freed bar must not leave a phantom mark.
    }
    this.held.clear();
    this.state.phase = 'Typebars returning';
  }

  newSheet(): void {
    this.restorePosition(0, 0);
    this.state.strikeCount = 0;
    this.state.lastEnergy = 0;
  }

  restorePosition(column: number, line: number): void {
    const safeColumn = Number.isFinite(column) ? clamp(Math.round(column), 0, COLUMNS) : 0;
    const safeLine = Number.isFinite(line) ? clamp(line, 0, MAX_LINE) : 0;
    Object.assign(this.state, {
      column: safeColumn, carriage: safeColumn, carriageVelocity: 0, line: safeLine, feed: safeLine,
      jammed: false, returning: false, ribbonLift: 0, bell: 0, phase: safeColumn === COLUMNS ? 'Right margin' : 'Ready',
    });
    this.carriageTarget = safeColumn;
    this.feedVelocity = 0;
    this.accumulator = 0;
    this.bellArmed = safeColumn < BELL_COLUMN;
    this.held.clear();
    this.flights.clear();
    for (const bar of this.state.bars) { bar.angle = 0; bar.velocity = 0; bar.pressed = false; }
  }

  private get spacing(): number {
    return [1, 1.5, 2].includes(this.options.lineSpacing) ? this.options.lineSpacing : 1;
  }
  private get carriageMoving(): boolean { return Math.abs(this.state.carriage - this.carriageTarget) > 0.00001; }
  private get feedMoving(): boolean { return this.state.feed !== this.state.line; }
  private get barsMoving(): boolean { return this.state.bars.some(bar => bar.angle > 0.015 || this.flights.get(bar.key)?.active); }
  private notice(message: string): void { this.onEvent({ type: 'notice', message }); }
  private sound(sound: 'strike' | 'space' | 'return' | 'bell' | 'jam', energy?: number): void { this.onEvent({ type: 'sound', sound, energy }); }

  private moveCarriage(target: number, drive: 'spring' | 'hand'): void {
    this.carriageTarget = clamp(Math.round(target), 0, COLUMNS);
    this.carriageDrive = drive;
    this.state.column = this.carriageTarget;
    if (this.carriageTarget < BELL_COLUMN) this.bellArmed = true;
  }

  private setFeed(target: number): void {
    this.state.line = clamp(target, 0, MAX_LINE);
    if (target > MAX_LINE) this.notice('Bottom margin reached. Load a new sheet to continue below it.');
    if (target < 0) this.notice('Top of the sheet reached.');
  }

  private integrate(dt: number): void {
    const state = this.state;
    const contacts: BarState[] = [];
    if (!state.jammed) {
      for (const bar of state.bars) {
        const flight = this.flights.get(bar.key);
        if (!flight?.active) continue;
        const theta = bar.angle * SWEEP;
        const omega = bar.velocity * SWEEP;
        const torque = -TORSION * theta - DAMPING * omega - GRAVITY_MOMENT * Math.cos(theta);
        bar.velocity += torque / INERTIA / SWEEP * dt;
        bar.angle += bar.velocity * dt;
        if (bar.angle <= 0) {
          bar.angle = 0;
          bar.velocity = 0; // Felt basket stop absorbs the remaining energy.
          flight.active = false;
        } else if (bar.angle >= 1 && !flight.contacted) contacts.push(bar);
      }
      const inGate = state.bars.filter(bar => bar.angle >= GATE && this.flights.get(bar.key)?.active);
      // A shared narrow type guide admits one slug. Collision dissipates the
      // velocities and wedges the bars until the operator separates them.
      if (inGate.length > 1 && inGate.some(bar => bar.velocity > 0)) {
        state.jammed = true;
        for (const bar of inGate) { bar.angle = Math.min(bar.angle, 0.94); bar.velocity = 0; }
        this.sound('jam');
        this.notice('Two typebars met in the guide. Release the jam to continue.');
      } else {
        for (const bar of contacts) this.impact(bar);
      }
    }

    this.integrateCarriage(dt);
    const feedAcceleration = 42 * 42 * (state.line - state.feed) - 2 * 42 * this.feedVelocity;
    this.feedVelocity += feedAcceleration * dt;
    state.feed += this.feedVelocity * dt;
    if (Math.abs(state.line - state.feed) < 0.0005 && Math.abs(this.feedVelocity) < 0.01) {
      state.feed = state.line;
      this.feedVelocity = 0;
    }
    const shiftTarget = state.shifted ? 1 : 0;
    this.shiftVelocity += (45 * 45 * (shiftTarget - state.shift) - 90 * this.shiftVelocity) * dt;
    state.shift += this.shiftVelocity * dt;
    const ribbonTarget = state.bars.some(bar => bar.angle > 0.28) ? 1 : 0;
    state.ribbonLift += (ribbonTarget - state.ribbonLift) * (1 - Math.exp(-75 * dt));
    state.bell *= Math.exp(-4.5 * dt);
    if (state.returning && !this.carriageMoving && !this.feedMoving) state.returning = false;
    state.phase = state.jammed ? 'Typebars jammed' : state.returning ? 'Carriage return' : this.carriageMoving ? 'Escapement released' : this.feedMoving ? 'Platen feeding' : this.barsMoving ? 'Typebar in motion' : state.column === COLUMNS ? 'Right margin' : 'Ready';
  }

  private impact(bar: BarState): void {
    const flight = this.flights.get(bar.key)!;
    const omega = Math.max(0, bar.velocity * SWEEP);
    const energy = 0.5 * INERTIA * omega * omega * (1 - RESTITUTION * RESTITUTION);
    bar.angle = 1;
    bar.velocity = -Math.abs(bar.velocity) * RESTITUTION;
    flight.contacted = true;
    // These coordinates are sampled at contact before the escapement releases.
    const impression = Object.freeze({
      char: flight.char, column: this.state.carriage, line: this.state.feed,
      energy, seed: this.sequence++, ribbon: this.options.ribbon,
    });
    this.state.strikeCount++;
    this.state.lastEnergy = energy;
    this.state.ribbonTravel += 0.0007; // metres of fresh ribbon per impression
    this.onEvent({ type: 'impression', impression });
    this.sound('strike', energy);
    this.moveCarriage(this.state.column + 1, 'spring');
  }

  private integrateCarriage(dt: number): void {
    const state = this.state;
    const remaining = this.carriageTarget - state.carriage;
    if (Math.abs(remaining) <= 0.00001) { state.carriageVelocity = 0; return; }
    const direction = Math.sign(remaining);
    // Reverse travel/return is external work by the operator against the spring.
    const driveForce = this.carriageDrive === 'spring' ? MAINSPRING_FORCE : 10;
    const velocityMps = state.carriageVelocity * PITCH;
    const force = direction * driveForce - CARRIAGE_DRAG * velocityMps;
    state.carriageVelocity += force / CARRIAGE_MASS / PITCH * dt;
    const next = state.carriage + state.carriageVelocity * dt;
    if ((this.carriageTarget - next) * direction <= 0) {
      state.carriage = this.carriageTarget;
      state.carriageVelocity = 0;
    } else state.carriage = next;
    if (this.bellArmed && state.carriage >= BELL_COLUMN) {
      state.bell = 1;
      this.bellArmed = false;
      this.sound('bell');
    }
  }
}
