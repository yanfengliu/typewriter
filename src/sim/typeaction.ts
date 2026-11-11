// The type action: one key lever -> link -> sub-lever -> link -> typebar train per character key.
// Each train has a single degree of freedom once its two wire links are in place; all three parts are
// simulated as separate bodies so the links carry real, inspectable forces.

import { Body, System } from './solver';
import { Limit, PointCylinder, PointPlane, PointSpring, Rod } from './elements';
import { F, KeyGeom, P0, PLATEN_AXIS, PLATEN_R, STACK, UBAR_REST_F, X } from './layout';
import { addScaled } from './vec';

export const TRAIN = {
  // Key lever: 1.2 x 7 mm steel bar with stem and keytop, pivoting at the rear fulcrum wire.
  leverInertia: 5.5e-4,
  leverMass: 0.0195,
  // Sub-lever (bell crank): a small stamped plate.
  subInertia: 1.2e-6,
  // Typebar: 75 mm steel bar plus the type slug at its tip.
  barInertia: 1.49e-5,
  barMass: 0.0045,
  springK: 80,
  springPreload: 1.0,
  /** Felt rest pad, as an angular spring-damper on the typebar. */
  padK: 34,
  padC: 0.07,
  /** Rubber platen through paper and ribbon, at the type face. */
  platenK: 2.5e5,
  platenC: 12,
  /** Felt down-stop under the key lever (angular). */
  stopK: 900,
  stopC: 0.9,
};

export interface Train {
  geom: KeyGeom;
  lever: Body;
  sub: Body;
  bar: Body;
  link1: Rod;
  link2: Rod;
  spring: PointSpring;
  pad: Limit;
  stop: Limit;
  /** Type face against the platen: [lower-case glyph, upper-case glyph]. */
  hit: [PointCylinder, PointCylinder];
  ubar: PointPlane;
  awake: boolean;
  /** Per-glyph impact tracking for the imprint. */
  peak: [number, number];
  peakState: [ImpactState | null, ImpactState | null];
  /** Typebar angular velocity on the last substep it was clear of the paper (rad/s). */
  approach: number;
  /** Number of fingers currently on this key. */
  fingers: number;
}

export interface ImpactState {
  t: number;
  point: [number, number, number];
  carriage: number;
  platen: number;
  shift: number;
  lift: number;
  speed: number;
}

export function buildTrain(sys: System, k: KeyGeom, platenCarrier: Body, ubar: Body): Train {
  const lever = sys.addBody({
    name: `lever:${k.code}`, kind: 'hinge', origin: k.fulcrum, axis: X, inertia: TRAIN.leverInertia,
    mass: TRAIN.leverMass, com: [k.x, k.fulcrum[1], k.fulcrum[2] + 0.13], damping: 1.5e-3,
  });
  const sub = sys.addBody({ name: `sub:${k.code}`, kind: 'hinge', origin: k.subPivot, axis: X, inertia: TRAIN.subInertia, damping: 1e-6 });
  const bar = sys.addBody({
    name: `bar:${k.code}`, kind: 'hinge', origin: k.pivot, axis: k.axis, inertia: TRAIN.barInertia,
    mass: TRAIN.barMass, com: k.com, damping: 2e-6,
  });

  const link1 = sys.add(new Rod(lever, k.leverPin, sub, k.subIn, k.link1), `link1:${k.code}`);
  const link2 = sys.add(new Rod(sub, k.subOut, bar, k.heel, k.link2), `link2:${k.code}`);

  // Return spring: a coil spring from the lever up to a rail on the frame.
  const d = Math.hypot(k.springLever[1] - k.springAnchor[1], k.springLever[2] - k.springAnchor[2]);
  const spring = sys.addForce(new PointSpring(lever, k.springLever, null, k.springAnchor, TRAIN.springK, d - TRAIN.springPreload / TRAIN.springK), `spring:${k.code}`);

  const pad = sys.add(new Limit(bar, 0, 1), `pad:${k.code}`);
  pad.stiffness = TRAIN.padK;
  pad.dampingCoef = TRAIN.padC;

  const stop = sys.add(new Limit(lever, k.keyAngle * 1.05, -1), `keystop:${k.code}`);
  stop.stiffness = TRAIN.stopK;
  stop.dampingCoef = TRAIN.stopC;

  const mkHit = (p: [number, number, number], name: string) => {
    const c = sys.add(new PointCylinder(bar, p, platenCarrier, PLATEN_AXIS, X, PLATEN_R + STACK), name);
    c.stiffness = TRAIN.platenK;
    c.dampingCoef = TRAIN.platenC;
    return c;
  };
  const hit: [PointCylinder, PointCylinder] = [mkHit(k.glyphLower, `hitLower:${k.code}`), mkHit(k.glyphUpper, `hitUpper:${k.code}`)];

  // The shank must stay in front of the universal bar's face: near the platen it pushes the bar back.
  const ub = sys.add(new PointPlane(bar, k.ubarPoint, ubar, addScaled(P0, F, UBAR_REST_F), F), `ubar:${k.code}`);

  const t: Train = { geom: k, lever, sub, bar, link1, link2, spring, pad, stop, hit, ubar: ub, awake: true, peak: [0, 0], peakState: [null, null], approach: 0, fingers: 0 };
  setTrainAwake(t, false);
  return t;
}

/** A resting train costs nothing: its bodies are frozen at the rest pose and its constraints skipped. */
export function setTrainAwake(t: Train, awake: boolean): void {
  if (t.awake === awake) return;
  t.awake = awake;
  for (const b of [t.lever, t.sub, t.bar]) {
    b.awake = awake;
    if (!awake) { b.q = 0; b.v = 0; }
  }
  t.link1.enabled = t.link2.enabled = t.pad.enabled = t.stop.enabled = t.ubar.enabled = awake;
  t.hit[0].enabled = t.hit[1].enabled = awake;
  t.spring.enabled = awake;
}

/** True when the train has come back to rest and can be put to sleep. */
export function trainAtRest(t: Train): boolean {
  return t.fingers === 0 && Math.abs(t.bar.q) < 3e-3 && Math.abs(t.bar.v) < 0.08 && Math.abs(t.lever.v) < 2e-3;
}
