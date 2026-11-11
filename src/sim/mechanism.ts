// Everything a keystroke sets in motion besides the type action itself: universal bar, ribbon vibrator,
// escapement (rocker, loose dog, fixed dog, escape wheel), mainspring-driven carriage, shift, space bar,
// backspace, line-space lever and bell.

import { Body, BodyDef, Constraint, Force, System } from './solver';
import { CoordSpring, FnConstraint, FnForce, Limit, PointPlane, Rod } from './elements';
import {
  AUX_FULCRUM, BACKSPACE, CARRIAGE_X0, CHAR_PITCH, ESC, F, GLYPH_PITCH, KEY_DIP, KEY_FULCRUM, LOCK, LOCK_ENGAGE, MARGIN, PLATEN_AXIS, PLATEN_R,
  RIBBON_LEVER, ROW_Y, ROW_Z, SHIFT, SPACE_BAR, TILT, TOOTH_PITCH, U, UBAR_TRAVEL, WHEEL_RATIO, X,
} from './layout';
import { Vec3, addScaled, scale } from './vec';

export const SPEC = {
  ubarMass: 0.01, ubarPreload: 0.6, ubarK: 60,
  rockerInertia: 2.5e-6, rockerPreload: 4e-3, rockerK: 0.02,
  dogMass: 0.0015, dogK: 150,
  wheelInertia: 1e-6,
  /** Carriage with platen, paper and the reflected inertia of the spring drum. */
  carriageMass: 1.3,
  /** Mainspring pull on the draw band at travel 0, and how it eases as the band winds on. */
  bandTension: 9, bandRate: 10,
  cradleMass: 1.0, cradleBalance: 0.7,
  platenInertia: 7.7e-5, detentTorque: 0.06, platenFriction: 0.005, lineTeeth: 24, ratchetR: 0.0145,
  leverEngage: 0.06, leverPerLine: 0.2,
  hammerInertia: 2e-6, hammerK: 0.02, hammerCock: 0.4, bellAt: -0.05, bellRamp: 0.0024,
  backspaceStroke: 1.3,
  /** Line-lock comb: its mass, return spring, the buffer spring the carriage pushes it through, and its slide. */
  lockMass: 0.025, lockReturnK: 40, lockReturnPreload: 0.15, lockBufferK: 800, lockDamping: 5, lockFriction: 0.03,
};

/** Where the lock comb comes to rest with the carriage standing at travel c (buffer against return spring). */
export function lockRest(c: number): number {
  const push = c - (MARGIN.right * CHAR_PITCH - LOCK.lead);
  return Math.max(0, Math.min(LOCK.travel, (SPEC.lockBufferK * push - SPEC.lockReturnPreload) / (SPEC.lockBufferK + SPEC.lockReturnK)));
}

export interface Core {
  ubar: Body; rocker: Body; looseDog: Body; wheel: Body;
  carriage: Body; cradle: Body; platen: Body;
  ribbonLever: Body; vibrator: Body;
  shift: Body; space: Body; backspace: Body; lineLever: Body; hammer: Body; lockBar: Body;
  ubarStop: Limit; rockerStop: Limit; trip: PointPlane;
  toothLoose: FnConstraint; toothFixed: FnConstraint; ratchet: FnConstraint; holdLoose: FnConstraint; holdFixed: FnConstraint;
  marginLeft: Limit; marginRight: Limit;
  cradleDown: Limit; cradleUp: Limit; shiftRail: PointPlane;
  spacePush: PointPlane; spaceLock: Limit; lockBlock: Limit; lockBuffer: FnForce; backPush: FnConstraint; pawl: FnConstraint; bellCam: FnConstraint; bellStop: Limit;
  ribbonLink1: Rod; ribbonLink2: Rod;
  mainspring: FnForce;
  state: CoreState;
  groups: Record<GroupName, Group>;
  /** Points used by actuators and by the viewer (assembly coords). */
  points: { spaceTop: Vec3; shiftTopL: Vec3; shiftTopR: Vec3; backTop: Vec3; leverHandle: Vec3; leverPivot: Vec3; hammerPivot: Vec3; rockerArm: Vec3; spaceTip: Vec3; ubarTip: Vec3; ubarPin: Vec3; vibratorPin: Vec3; shoe: Vec3 };
  limits: { shiftMax: number; spaceMax: number; backMax: number; leverMax: () => number; cLeft: number; cRight: number; cBell: number };
  /** How far the carriage's lug has squeezed the lock comb's buffer spring (m, 0 when they are apart). */
  lockSqueeze: () => number;
}

/** Discrete state of latches and ratchets (everything else is in the bodies' q and v). */
export interface CoreState {
  looseIn: boolean; fixedIn: boolean; toothLoose: number; toothFixed: number;
  /** Pinion-ratchet index: whole letter spaces the carriage has been pushed back relative to the wheel. */
  ratchet: number;
  /** Tooth the retaining pawl has dropped behind. */
  backTooth: number;
  pawlIn: boolean; pawlLatch: number;
  backIn: boolean; backLatch: number;
  bellArmed: boolean;
  lineSpacing: number;
}

export type GroupName = 'esc' | 'shift' | 'feed' | 'space' | 'back' | 'bell';

/** A set of parts that rests (and is skipped by the solver) together, e.g. the shift mechanism. */
export interface Group { name: GroupName; bodies: Body[]; cons: Constraint[]; forces: Force[]; awake: boolean; quiet: number }

export function buildCore(sys: System): Core {
  const groups = {} as Record<GroupName, Group>;
  for (const name of ['esc', 'shift', 'feed', 'space', 'back', 'bell'] as GroupName[]) groups[name] = { name, bodies: [], cons: [], forces: [], awake: true, quiet: 0 };
  let cur: Group = groups.esc;
  const G = {
    use: (n: GroupName) => { cur = groups[n]; },
    b: (def: BodyDef): Body => { const b = sys.addBody(def); cur.bodies.push(b); return b; },
    c: <T extends Constraint>(c: T, name = ''): T => { sys.add(c, name); cur.cons.push(c); return c; },
    f: <T extends Force>(f: T, name = ''): T => { sys.addForce(f, name); cur.forces.push(f); return f; },
  };
  const st: CoreState = {
    looseIn: true, fixedIn: false, toothLoose: MARGIN.left, toothFixed: 0, ratchet: 0, backTooth: MARGIN.left,
    pawlIn: false, pawlLatch: 0, backIn: false, backLatch: 0, bellArmed: true, lineSpacing: 1,
  };
  const cLeft = MARGIN.left * CHAR_PITCH, cRight = MARGIN.right * CHAR_PITCH, cBell = (MARGIN.right - MARGIN.bellBefore) * CHAR_PITCH;

  // --- Universal bar and ribbon vibrator ---------------------------------------------------------
  const ubar = G.b({ name: 'ubar', kind: 'slide', axis: scale(F, -1), inertia: SPEC.ubarMass, damping: 0.05 });
  G.f(new CoordSpring(ubar, SPEC.ubarK, 0, -SPEC.ubarPreload), 'ubarSpring');
  const ubarStop = G.c(new Limit(ubar, 0, 1), 'ubarStop');
  ubarStop.restitution = 0.1;
  // Overthrow stops: without them the bar and rocker would be flung past their working stroke by the typebar.
  G.c(new Limit(ubar, UBAR_TRAVEL + 0.0004, -1), 'ubarOverthrow');

  const ribbonLever = G.b({ name: 'ribbonLever', kind: 'hinge', origin: RIBBON_LEVER.pivot, axis: [-1, 0, 0], inertia: 4e-7 });
  const vibrator = G.b({ name: 'vibrator', kind: 'slide', axis: U, inertia: 0.0015, mass: 0.0015, damping: 0.02 });
  const ubarPin = addScaled(RIBBON_LEVER.up, F, 0.004);
  const vibratorPin = addScaled(RIBBON_LEVER.lift, U, 0.006);
  const ribbonLink1 = G.c(new Rod(ubar, ubarPin, ribbonLever, RIBBON_LEVER.up, 0.004), 'ribbonLink1');
  const ribbonLink2 = G.c(new Rod(ribbonLever, RIBBON_LEVER.lift, vibrator, vibratorPin, 0.006), 'ribbonLink2');

  // --- Escapement --------------------------------------------------------------------------------
  const rocker = G.b({ name: 'rocker', kind: 'hinge', origin: ESC.rockerPivot, axis: [-1, 0, 0], inertia: SPEC.rockerInertia, damping: 1e-5 });
  G.f(new CoordSpring(rocker, SPEC.rockerK, 0, -SPEC.rockerPreload), 'rockerSpring');
  const rockerStop = G.c(new Limit(rocker, 0, 1), 'rockerStop');
  rockerStop.restitution = 0.1;
  G.c(new Limit(rocker, (UBAR_TRAVEL - ESC.tripGap) / ESC.pushR + 0.02, -1), 'rockerOverthrow');
  const rockerFace: Vec3 = [0, ESC.rockerPivot[1] + ESC.pushR, ESC.rockerPivot[2] + 0.0015];
  const ubarTip: Vec3 = [0, rockerFace[1], rockerFace[2] + ESC.tripGap];
  const trip = G.c(new PointPlane(ubar, ubarTip, rocker, rockerFace, [0, 0, 1]), 'trip');

  const looseDog = G.b({ name: 'looseDog', parent: rocker, kind: 'slide', axis: X, inertia: SPEC.dogMass });
  G.f(new CoordSpring(looseDog, SPEC.dogK, -ESC.looseBack - 0.004), 'dogSpring');
  const dogBack = G.c(new Limit(looseDog, -ESC.looseBack, 1), 'dogBackStop');
  const dogHold = G.c(new Limit(looseDog, 0, -1), 'dogHoldStop');
  dogBack.restitution = 0.1;
  dogHold.restitution = 0;

  const wheel = G.b({ name: 'wheel', kind: 'hinge', origin: ESC.wheelCenter, axis: [0, 0, 1], inertia: SPEC.wheelInertia, friction: 2.5e-4, damping: 2e-6 });
  const carriage = G.b({ name: 'carriage', kind: 'slide', axis: [-1, 0, 0], inertia: SPEC.carriageMass, friction: 0.25, damping: 0.5 });
  carriage.q = cLeft;
  wheel.q = (cLeft * WHEEL_RATIO) / ESC.wheelR;
  const mainspring = G.f(new FnForce(
    () => { carriage.f += SPEC.bandTension - SPEC.bandRate * carriage.q; },
    () => -SPEC.bandTension * carriage.q + 0.5 * SPEC.bandRate * carriage.q * carriage.q,
  ), 'mainspring');

  // Tooth k of the escape wheel has its working face at (R·ε - k·pitch), measured along the rim from where the
  // loose dog holds a tooth.
  const rim = () => ESC.wheelR * wheel.q;
  const toothLoose = G.c(new FnConstraint((c) => {
    if (!st.looseIn) return 1;
    c.coord(looseDog, 1);
    c.coord(wheel, -ESC.wheelR);
    return looseDog.q - (rim() - st.toothLoose * TOOTH_PITCH);
  }), 'toothLoose');
  const toothFixed = G.c(new FnConstraint((c) => {
    if (!st.fixedIn) return 1;
    c.coord(wheel, -ESC.wheelR);
    return ESC.drop - (rim() - st.toothFixed * TOOTH_PITCH);
  }), 'toothFixed');
  // Retaining pawl: a light spring pawl rides the teeth and drops in behind each one, so the wheel cannot be
  // carried backward (by the dog's spring or the pinion ratchet's drag) while the carriage is being returned.
  const backCheck = G.c(new FnConstraint((c) => {
    c.coord(wheel, ESC.wheelR);
    return rim() - (st.backTooth * TOOTH_PITCH - ESC.backlash);
  }), 'backCheck');
  // The rack turns the pinion, which drives the wheel through a one-way ratchet (free on carriage return).
  const ratchet = G.c(new FnConstraint((c) => {
    c.coord(wheel, ESC.wheelR);
    c.coord(carriage, -WHEEL_RATIO);
    return rim() - st.ratchet * TOOTH_PITCH - carriage.q * WHEEL_RATIO;
  }), 'ratchet');
  // The chain rack -> pinion ratchet -> wheel tooth -> dog -> dog stop ends on the frame, so while a dog is in the
  // wheel the carriage itself cannot pass the held tooth. Stating that directly stops the 1.3 kg carriage in one
  // solver pass; left to the chain alone it would leak through the gram-sized wheel and dog over many substeps.
  const holdLoose = G.c(new FnConstraint((c) => {
    if (!st.looseIn) return 1;
    c.coord(carriage, -WHEEL_RATIO);
    return (st.toothLoose - st.ratchet) * TOOTH_PITCH - carriage.q * WHEEL_RATIO;
  }), 'holdLoose');
  const holdFixed = G.c(new FnConstraint((c) => {
    if (!st.fixedIn) return 1;
    c.coord(carriage, -WHEEL_RATIO);
    return ESC.drop + (st.toothFixed - st.ratchet) * TOOTH_PITCH - carriage.q * WHEEL_RATIO;
  }), 'holdFixed');
  holdLoose.restitution = 0.05;
  toothLoose.restitution = toothFixed.restitution = backCheck.restitution = ratchet.restitution = 0;

  // The return stop sits a hair beyond the first column, so the carriage settles forward onto the dog.
  const marginLeft = G.c(new Limit(carriage, cLeft - ESC.marginOverrun, 1), 'marginLeft');
  const marginRight = G.c(new Limit(carriage, cRight, -1), 'marginRight');
  marginLeft.restitution = 0.2;
  marginRight.restitution = 0.1;

  // --- Line lock: a comb under the key levers that the carriage pushes sideways at the end of the line ---
  // Over the last 2.3 mm of travel a lug on the carriage meets a buffer spring on the comb and takes the comb
  // along; its teeth come to stand under the key levers (and a finger on its post over the space lever's tail).
  // The buffer is what lets the carriage finish its step while a key is still down in its slot, holding the comb.
  const lockBar = G.b({ name: 'lockBar', kind: 'slide', axis: [-1, 0, 0], inertia: SPEC.lockMass, damping: SPEC.lockDamping, friction: SPEC.lockFriction });
  G.f(new CoordSpring(lockBar, SPEC.lockReturnK, 0, -SPEC.lockReturnPreload), 'lockReturn');
  G.c(new Limit(lockBar, 0, 1), 'lockRest').restitution = 0.1;
  G.c(new Limit(lockBar, LOCK.travel, -1), 'lockOverthrow');
  const lockFrom = cRight - LOCK.lead;
  const squeeze = () => carriage.q - lockFrom - lockBar.q;
  const lockBuffer = G.f(new FnForce(
    () => { const d = squeeze(); if (d > 0) { lockBar.f += SPEC.lockBufferK * d; carriage.f -= SPEC.lockBufferK * d; } },
    () => { const d = squeeze(); return d > 0 ? 0.5 * SPEC.lockBufferK * d * d : 0; },
  ), 'lockBuffer');
  // A key lever that is down in its slot stands in the comb's way (switched by the machine, see lockLogic).
  const lockBlock = G.c(new Limit(lockBar, LOCK_ENGAGE - 2e-5, -1), 'lockBlock');
  lockBlock.enabled = false;

  // --- Carriage: shift cradle, platen, line-space lever ------------------------------------------
  G.use('shift');
  const cradle = G.b({ name: 'cradle', parent: carriage, kind: 'slide', axis: U, inertia: SPEC.cradleMass, mass: SPEC.cradleMass, damping: 3 });
  G.f(new CoordSpring(cradle, 30, 0, SPEC.cradleBalance * SPEC.cradleMass * sys.gravity * Math.cos(TILT)), 'shiftBalance');
  const cradleDown = G.c(new Limit(cradle, 0, 1), 'cradleDown');
  const cradleUp = G.c(new Limit(cradle, GLYPH_PITCH, -1), 'cradleUp');
  cradleDown.restitution = cradleUp.restitution = 0.05;

  G.use('feed');
  const platen = G.b({ name: 'platen', parent: cradle, kind: 'hinge', origin: PLATEN_AXIS, axis: [-1, 0, 0], inertia: SPEC.platenInertia, friction: SPEC.platenFriction, damping: 2e-4 });
  G.f(new FnForce(() => { platen.f -= SPEC.detentTorque * Math.sin(SPEC.lineTeeth * platen.q); }), 'detent');

  const leverPivot: Vec3 = [CARRIAGE_X0 - 0.15, PLATEN_AXIS[1] + 0.004, PLATEN_AXIS[2] + 0.04];
  const leverHandle: Vec3 = [leverPivot[0] - 0.04, leverPivot[1] + 0.012, leverPivot[2] + 0.045];
  const lineLever = G.b({ name: 'lineLever', parent: cradle, kind: 'hinge', origin: leverPivot, axis: U, inertia: 4e-5, damping: 2e-4 });
  G.f(new CoordSpring(lineLever, 0.02, 0, -0.015), 'leverSpring');
  const leverMax = () => SPEC.leverEngage + st.lineSpacing * SPEC.leverPerLine;
  G.c(new Limit(lineLever, 0, 1), 'leverRest').restitution = 0.1;
  G.c(new FnConstraint((c) => { c.coord(lineLever, -1); return leverMax() - lineLever.q; }), 'leverStop');
  const pawlR = ((2 * Math.PI * SPEC.ratchetR) / SPEC.lineTeeth) / SPEC.leverPerLine;
  const pawl = G.c(new FnConstraint((c) => {
    if (!st.pawlIn) return 1;
    c.coord(platen, SPEC.ratchetR);
    c.coord(lineLever, -pawlR);
    return SPEC.ratchetR * (platen.q - st.pawlLatch) - pawlR * (lineLever.q - SPEC.leverEngage);
  }), 'pawl');
  // Overthrow stop: at the end of its stroke the pawl is wedged in the ratchet, so the platen cannot coast past the line.
  const linePitch = (2 * Math.PI * SPEC.ratchetR) / SPEC.lineTeeth;
  G.c(new FnConstraint((c) => {
    if (!st.pawlIn || lineLever.q < leverMax() - 0.03) return 1;
    c.coord(platen, -SPEC.ratchetR);
    return (st.lineSpacing + 0.1) * linePitch - SPEC.ratchetR * (platen.q - st.pawlLatch);
  }), 'overthrow');

  // --- Shift: a first-class lever whose rear rail lifts the cradle --------------------------------
  G.use('shift');
  const auxPivot: Vec3 = [0, AUX_FULCRUM.y, AUX_FULCRUM.z];
  const shift = G.b({ name: 'shift', kind: 'hinge', origin: auxPivot, axis: X, inertia: 6e-4, damping: 4e-3 });
  G.f(new CoordSpring(shift, 0.05, 0, -0.012), 'shiftSpring');
  const shiftFront = ROW_Z[3] - AUX_FULCRUM.z;
  const shiftMax = SHIFT.dip / shiftFront;
  G.c(new Limit(shift, 0, 1), 'shiftRest').restitution = 0.1;
  G.c(new Limit(shift, shiftMax, -1), 'shiftBottom').restitution = 0.1;
  const shoe: Vec3 = [CARRIAGE_X0, SHIFT.railY + 0.0003 * U[1], SHIFT.railZ + 0.0003 * U[2]];
  const shiftRail = G.c(new PointPlane(cradle, shoe, shift, [0, SHIFT.railY, SHIFT.railZ], U), 'shiftRail');

  // --- Space bar: its rear tip lifts the rocker's forward arm -------------------------------------
  G.use('space');
  const space = G.b({ name: 'space', kind: 'hinge', origin: auxPivot, axis: X, inertia: 3e-4, damping: 3e-3 });
  G.f(new CoordSpring(space, 0.2, 0, -0.03), 'spaceSpring');
  const spaceMax = SPACE_BAR.dip / (SPACE_BAR.z - AUX_FULCRUM.z);
  G.c(new Limit(space, 0, 1), 'spaceRest').restitution = 0.1;
  G.c(new Limit(space, spaceMax, -1), 'spaceBottom').restitution = 0.1;
  const rockerArm: Vec3 = [0, ESC.rockerPivot[1], ESC.rockerPivot[2] + ESC.spaceArm];
  const spaceTip: Vec3 = [0, rockerArm[1] - 0.0005, rockerArm[2]];
  const spacePush = G.c(new PointPlane(space, spaceTip, rocker, rockerArm, [0, -1, 0]), 'spacePush');
  const spaceLock = G.c(new Limit(space, spaceMax * LOCK.spaceDip, -1), 'lineLock:Space');
  spaceLock.restitution = 0.1;
  spaceLock.enabled = false;

  // --- Backspace: a pawl shoves the rack back a little more than one tooth -------------------------
  G.use('back');
  const backFulcrum: Vec3 = [BACKSPACE.x, KEY_FULCRUM.y, KEY_FULCRUM.z];
  const backTop: Vec3 = [BACKSPACE.x, ROW_Y[BACKSPACE.row], ROW_Z[BACKSPACE.row]];
  const backspace = G.b({ name: 'backspace', kind: 'hinge', origin: backFulcrum, axis: X, inertia: 5.5e-4, damping: 4e-3 });
  G.f(new CoordSpring(backspace, 0.3, 0, -0.08), 'backSpring');
  const backMax = KEY_DIP / (backTop[2] - backFulcrum[2]);
  G.c(new Limit(backspace, 0, 1), 'backRest').restitution = 0.1;
  G.c(new Limit(backspace, backMax, -1), 'backBottom').restitution = 0.1;
  const backEngage = 0.25 * backMax;
  const backGain = (SPEC.backspaceStroke * CHAR_PITCH) / (backMax - backEngage);
  const backPush = G.c(new FnConstraint((c) => {
    if (!st.backIn) return 1;
    c.coord(carriage, -1);
    c.coord(backspace, -backGain);
    return st.backLatch - backGain * (backspace.q - backEngage) - carriage.q;
  }), 'backPush');
  // At the bottom of its stroke the pawl is wedged between the rack tooth and a stop on the frame, so the
  // carriage cannot run on past it under its own momentum (the tooth gap is a little wider than the pawl).
  // Without this a firm backspace, or one near the end of the line where the mainspring pulls least, let the
  // carriage coast a second tooth back. On the way up the pawl rides out of the rack, so it never traps it.
  G.c(new FnConstraint((c) => {
    if (!st.backIn || backspace.q < 0.9 * backMax) return 1;
    c.coord(carriage, 1);
    return carriage.q - (st.backLatch - backGain * (backMax - backEngage)) + BACKSPACE.play;
  }), 'backWedge');

  // --- Bell: a cam on the carriage cocks the hammer, then lets it fly ------------------------------
  G.use('bell');
  const hammerPivot: Vec3 = [-0.085, 0.075, -0.088];
  const hammer = G.b({ name: 'hammer', kind: 'hinge', origin: hammerPivot, axis: [0, 0, 1], inertia: SPEC.hammerInertia, damping: 1.2e-4 });
  G.f(new CoordSpring(hammer, SPEC.hammerK), 'hammerSpring');
  const bellStop = G.c(new Limit(hammer, SPEC.bellAt, 1), 'bell');
  bellStop.restitution = 0.5;
  const camGain = SPEC.hammerCock / SPEC.bellRamp;
  const bellCam = G.c(new FnConstraint((c) => {
    const x = carriage.q - (cBell - SPEC.bellRamp);
    if (!st.bellArmed || x <= 0 || x >= SPEC.bellRamp) return 1;
    c.coord(hammer, 1);
    c.coord(carriage, -camGain);
    return hammer.q - camGain * x;
  }), 'bellCam');

  return {
    ubar, rocker, looseDog, wheel, carriage, cradle, platen, ribbonLever, vibrator, shift, space, backspace, lineLever, hammer, lockBar,
    ubarStop, rockerStop, trip, toothLoose, toothFixed, ratchet, holdLoose, holdFixed, marginLeft, marginRight, cradleDown, cradleUp, shiftRail,
    spacePush, spaceLock, lockBlock, lockBuffer, backPush, pawl, bellCam, bellStop, ribbonLink1, ribbonLink2, mainspring, state: st, groups,
    points: { spaceTop: [0, SPACE_BAR.y, SPACE_BAR.z], shiftTopL: [-SHIFT.x, ROW_Y[3], ROW_Z[3]], shiftTopR: [SHIFT.x, ROW_Y[3], ROW_Z[3]], backTop, leverHandle, leverPivot, hammerPivot, rockerArm, spaceTip, ubarTip, ubarPin, vibratorPin, shoe },
    limits: { shiftMax, spaceMax, backMax, leverMax, cLeft, cRight, cBell },
    lockSqueeze: () => Math.max(0, squeeze()),
  };
}

export interface CoreEvent { type: 'trip' | 'ratchet' | 'lineClick' | 'bellArm'; value: number }

/** Discrete logic run before every substep: which dog is in the wheel, ratchet and pawl latching, bell arming. */
export function coreLogic(core: Core, emit: (e: CoreEvent) => void): void {
  const st = core.state;
  const rim = ESC.wheelR * core.wheel.q;
  const dogTravel = ESC.dogR * core.rocker.q;

  const looseIn = dogTravel < ESC.looseOut;
  if (looseIn && !st.looseIn) st.toothLoose = Math.ceil((rim - core.looseDog.q) / TOOTH_PITCH - 1e-6);
  if (!looseIn && st.looseIn) emit({ type: 'trip', value: dogTravel });
  st.looseIn = looseIn;
  const fixedIn = dogTravel > ESC.fixedIn;
  if (fixedIn && !st.fixedIn) st.toothFixed = Math.ceil((rim - ESC.drop) / TOOTH_PITCH - 1e-6);
  st.fixedIn = fixedIn;

  const passed = Math.floor((rim + ESC.backlash) / TOOTH_PITCH + 1e-9);
  if (passed > st.backTooth) st.backTooth = passed;

  // Pinion ratchet: the pawl drops into the next tooth each time the carriage is pushed back a full space.
  while (rim - (st.ratchet + 1) * TOOTH_PITCH - core.carriage.q * WHEEL_RATIO >= 0) { st.ratchet++; emit({ type: 'ratchet', value: core.carriage.v }); }

  // Line-space pawl: picks up the ratchet tooth in front of it as the lever leaves rest.
  const lever = core.lineLever.q;
  if (!st.pawlIn && lever > SPEC.leverEngage && core.lineLever.v > 0) {
    const pitch = (2 * Math.PI) / SPEC.lineTeeth;
    st.pawlIn = true;
    st.pawlLatch = Math.round(core.platen.q / pitch) * pitch;
  } else if (st.pawlIn && lever < SPEC.leverEngage * 0.9) st.pawlIn = false;

  // Backspace pawl engages the rack where the carriage currently stands.
  const backEngage = 0.25 * core.limits.backMax;
  if (!st.backIn && core.backspace.q > backEngage) { st.backIn = true; st.backLatch = core.carriage.q; }
  else if (st.backIn && core.backspace.q < backEngage * 0.9) st.backIn = false;

  // The bell trip is a one-way pawl: it re-arms only once the carriage is back before the ramp.
  const beforeRamp = core.carriage.q < core.limits.cBell - SPEC.bellRamp - 0.0004;
  if (!st.bellArmed && beforeRamp) st.bellArmed = true;
  if (st.bellArmed && core.carriage.q >= core.limits.cBell) { st.bellArmed = false; emit({ type: 'bellArm', value: core.hammer.q }); }
}
