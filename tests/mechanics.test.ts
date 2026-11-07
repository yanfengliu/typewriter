import assert from 'node:assert/strict';
import test from 'node:test';
import { TypewriterMachine } from '../src/mechanics';
import { COLUMNS, MAX_LINE, type Impression, type MachineEvent } from '../src/contracts';

function rig() {
  const machine = new TypewriterMachine();
  const events: MachineEvent[] = [];
  const impressions: Impression[] = [];
  machine.onEvent = event => {
    events.push(event);
    if (event.type === 'impression') impressions.push(event.impression);
  };
  const advance = (seconds = 0.3, hz = 120) => {
    for (let i = 0; i < Math.round(seconds * hz); i++) machine.step(1 / hz);
  };
  const tap = (key: string, seconds = 0.3) => { machine.press(key); machine.release(key); advance(seconds); };
  return { machine, events, impressions, advance, tap };
}

test('the typebar must contact the platen before either ink or carriage motion occurs', () => {
  const { machine, impressions, advance } = rig();
  machine.press('a');
  machine.release('a');
  advance(0.0125, 240);
  assert.equal(impressions.length, 0);
  assert.equal(machine.state.carriage, 0);
  assert.ok(machine.state.bars.find(bar => bar.key === 'a')!.angle > 0);
  advance();
  assert.equal(impressions.length, 1);
  assert.equal(impressions[0].column, 0);
  assert.ok(impressions[0].energy > 0);
  assert.equal(machine.state.carriage, 1);
  assert.equal(machine.state.carriageVelocity, 0);
  assert.equal(machine.state.bars.find(bar => bar.key === 'a')!.angle, 0);
});

test('held keys do not auto-repeat, and a release permits a fresh strike', () => {
  const { machine, impressions, advance } = rig();
  machine.press('x');
  advance();
  machine.press('x');
  advance();
  assert.equal(impressions.length, 1);
  machine.release('x');
  machine.press('x');
  advance();
  assert.equal(impressions.length, 2);
});

test('backspace and reverse feed permit overstrikes while retaining all previous impressions', () => {
  const { machine, impressions, tap } = rig();
  tap('x');
  const first = { ...impressions[0] };
  tap('Backspace');
  assert.equal(impressions.length, 1);
  assert.equal(machine.state.column, 0);
  tap('o');
  assert.deepEqual(impressions[0], first);
  assert.deepEqual(impressions.map(mark => [mark.char, mark.column, mark.line]), [['x', 0, 0], ['o', 0, 0]]);
  tap('Enter');
  tap('ArrowUp');
  tap('-');
  assert.deepEqual(impressions[2].line, 0);
  assert.equal(impressions[2].column, 0);
});

test('space and tab move the carriage without printing', () => {
  const { machine, impressions, tap } = rig();
  tap(' ');
  assert.equal(machine.state.column, 1);
  tap('Tab');
  assert.equal(machine.state.carriage, 8);
  tap('Tab');
  assert.equal(machine.state.carriage, 16);
  assert.equal(impressions.length, 0);
});

test('the bell precedes a hard right margin and there is no automatic wrap', () => {
  const { machine, impressions, events, tap } = rig();
  machine.restorePosition(COLUMNS - 9, 4);
  for (let i = 0; i < 12; i++) tap('a');
  assert.equal(impressions.length, 9);
  assert.equal(machine.state.column, COLUMNS);
  assert.equal(machine.state.carriage, COLUMNS);
  assert.equal(machine.state.line, 4);
  assert.equal(events.filter(event => event.type === 'sound' && event.sound === 'bell').length, 1);
  assert.ok(events.some(event => event.type === 'notice' && event.message.includes('Right margin')));
});

test('carriage return and line spacing are bounded, reversible physical motions', () => {
  const { machine, advance, tap } = rig();
  machine.restorePosition(COLUMNS, 2);
  machine.options.lineSpacing = 1.5;
  machine.press('Enter');
  machine.release('Enter');
  assert.equal(machine.state.returning, true);
  assert.equal(machine.state.carriage, COLUMNS);
  advance(0.05);
  assert.ok(machine.state.carriage > 0 && machine.state.carriage < COLUMNS);
  advance(0.5);
  assert.equal(machine.state.carriage, 0);
  assert.equal(machine.state.line, 3.5);
  assert.equal(machine.state.feed, 3.5);
  assert.equal(machine.state.returning, false);
  tap('ArrowUp');
  assert.equal(machine.state.line, 2);
  machine.restorePosition(0, MAX_LINE);
  tap('ArrowDown');
  assert.equal(machine.state.line, MAX_LINE);
  machine.restorePosition(0, 0);
  tap('ArrowUp');
  assert.equal(machine.state.line, 0);
});

test('two typebars colliding in the guide jam without phantom printing; release restores use', () => {
  const { machine, impressions, advance, tap } = rig();
  machine.press('a');
  machine.press('s');
  advance();
  assert.equal(machine.state.jammed, true);
  assert.equal(impressions.length, 0);
  assert.equal(machine.state.column, 0);
  machine.clearJam();
  advance();
  assert.equal(machine.state.jammed, false);
  assert.equal(impressions.length, 0);
  tap('b');
  assert.equal(impressions.length, 1);
  assert.equal(impressions[0].char, 'b');
});

test('ordinary ten-keystroke-per-second typing does not jam or lose characters', () => {
  const { machine, impressions, tap } = rig();
  for (const char of 'typewriter') tap(char, 0.1);
  assert.equal(machine.state.jammed, false);
  assert.equal(impressions.map(mark => mark.char).join(''), 'typewriter');
});

test('staggered incoming bars can collide with a returning slug, preserving any mark already made', () => {
  const { machine, impressions, advance } = rig();
  machine.press('a');
  machine.release('a');
  advance(0.0125, 240);
  machine.press('s');
  machine.release('s');
  advance();
  assert.equal(machine.state.jammed, true);
  assert.ok(impressions.length <= 1);
  if (impressions.length) assert.equal(impressions[0].char, 'a');
  const count = impressions.length;
  machine.clearJam();
  advance();
  assert.equal(impressions.length, count);
});

test('a released typebar can be struck again after the physical return without ghost contacts', () => {
  const { machine, impressions, tap } = rig();
  for (const char of 'aaaa') tap(char, 0.1);
  assert.equal(impressions.length, 4);
  assert.equal(machine.state.jammed, false);
  assert.deepEqual(impressions.map(mark => mark.column), [0, 1, 2, 3]);
});

test('higher strike force transfers more impact energy, while both light and firm strokes print', () => {
  const light = rig();
  light.machine.options.force = 0.55;
  light.tap('a');
  const firm = rig();
  firm.machine.options.force = 1.4;
  firm.tap('a');
  assert.equal(light.impressions.length, 1);
  assert.equal(firm.impressions.length, 1);
  assert.ok(firm.impressions[0].energy > light.impressions[0].energy);
  assert.ok(firm.impressions[0].energy < 0.027 + 0.01 * 1.4 ** 2);
  assert.equal(firm.machine.state.lastEnergy, firm.impressions[0].energy);
  const strike = firm.events.find(event => event.type === 'sound' && event.sound === 'strike');
  assert.ok(strike?.type === 'sound');
  assert.equal(strike.energy, firm.impressions[0].energy);
});

test('fixed stepping produces the same contact and settled state at different render rates', () => {
  const slow = rig();
  const fast = rig();
  slow.machine.press('a');
  fast.machine.press('a');
  slow.advance(0.5, 60);
  fast.advance(0.5, 144);
  assert.deepEqual(slow.impressions, fast.impressions);
  assert.equal(slow.machine.state.carriage, fast.machine.state.carriage);
  assert.equal(slow.machine.state.feed, fast.machine.state.feed);
});

test('paper motion is rejected while a typebar is traveling, keeping the strike coordinates stable', () => {
  const { machine, impressions, advance } = rig();
  machine.press('a');
  machine.press('Enter');
  machine.press('ArrowDown');
  advance();
  assert.equal(impressions[0].line, 0);
  assert.equal(machine.state.line, 0);
});

test('keyboard character case and ribbon are retained, while unsupported input has no typebar', () => {
  const { machine, impressions, events, tap } = rig();
  machine.setShift(true);
  machine.options.ribbon = 'red';
  tap('A');
  tap('!');
  tap('a');
  tap('1');
  tap('é');
  tap('Delete');
  assert.equal(impressions.map(mark => mark.char).join(''), 'A!A!');
  assert.equal(impressions[0].ribbon, 'red');
  assert.ok(machine.state.shift > 0.99);
  assert.ok(events.some(event => event.type === 'notice' && event.message.includes('typebar')));
});

test('restoration validates external state and initializes internal detents without printing', () => {
  const { machine, impressions, tap } = rig();
  machine.restorePosition(4, 2.5);
  tap('x');
  assert.equal(impressions[0].column, 4);
  assert.equal(impressions[0].line, 2.5);
  machine.restorePosition(Infinity, NaN);
  assert.equal(machine.state.carriage, 0);
  assert.equal(machine.state.feed, 0);
  machine.restorePosition(999, -3);
  assert.equal(machine.state.carriage, COLUMNS);
  assert.equal(machine.state.feed, 0);
  machine.newSheet();
  tap('x');
  assert.equal(impressions[1].column, 0);
  assert.equal(impressions[1].line, 0);
});
