// Names and plain-language explanations for every kind of part, shown when you point at or click one.

export interface PartInfo { name: string; what: string; how: string }

export const PART_INFO: Record<string, PartInfo> = {
  keyLever: {
    name: 'Key lever',
    what: 'A long steel lever with the keytop on a stem at the front. It pivots on a wire at the very back of the machine.',
    how: 'Your finger pushes the front down about 14 mm. Half-way along, a short wire link hangs from it and pulls the sub-lever. The lever itself moves only about 3–4°: all the speed comes from the leverage that follows.',
  },
  keySpring: {
    name: 'Key return spring',
    what: 'A small coil spring from each key lever up to a rail on the frame.',
    how: 'It lifts the key lever back up after the stroke and, through the links, helps lay the typebar back on its rest.',
  },
  link1: {
    name: 'Key link',
    what: 'A short wire joining the key lever to the forward arm of the sub-lever.',
    how: 'It is pulled downward (in tension) when the key goes down. Because it is rigid, the sub-lever must turn exactly as far as the key lever dictates.',
  },
  subLever: {
    name: 'Sub-lever (bell crank)',
    what: 'An L-shaped lever pivoting on a rod under the type basket.',
    how: 'Its short forward arm is pulled down by the key link; its long upright arm therefore swings forward much further. This is the first stage of motion multiplication: a few degrees of key lever become about 30° here.',
  },
  link2: {
    name: 'Typebar draw link',
    what: 'A wire from the top of the sub-lever to the heel of the typebar, just below its pivot.',
    how: 'It pulls the heel forward. The heel is only about 10 mm from the pivot, so a 15 mm pull swings the 75 mm typebar through 100°: the second, larger multiplication. In total the type face moves about nine times as far, and as fast, as your fingertip.',
  },
  typebar: {
    name: 'Typebar',
    what: 'A steel bar with a type slug at its end carrying two characters: lower case below, upper case above.',
    how: 'It swings up out of the basket and is thrown against the paper. The blow is ballistic: the ink mark depends on the momentum the bar arrives with, which is why a slow press prints nothing but a quick tap prints cleanly. It then rebounds and falls back by gravity and the key spring.',
  },
  segment: {
    name: 'Segment',
    what: 'A slotted arc of cast iron. Every typebar pivots on one curved wire lying in it.',
    how: 'The pivots sit on a circle whose centre is the printing point, and each slot points at that centre. That is why 44 bars coming from 44 directions all strike exactly the same spot.',
  },
  restPad: {
    name: 'Typebar rest',
    what: 'A felt-covered arc the type heads lie on.',
    how: 'It catches the returning typebar softly and sets its rest position (and so the rest height of the key).',
  },
  typeGuide: {
    name: 'Type guide',
    what: 'A small fork fixed at the printing point.',
    how: 'The type slug passes between its prongs in the last few millimetres, so every character lands squarely even if the bar has side play.',
  },
  ubar: {
    name: 'Universal bar',
    what: 'A light arc-shaped bar lying just behind the plane the typebars arrive in.',
    how: '"Universal" because any typebar moves it. In the last fifth of its swing the bar\'s shank pushes it back about 4.6 mm. That one motion does two jobs: it lifts the ribbon and it trips the escapement.',
  },
  rocker: {
    name: 'Dog rocker (with fixed dog)',
    what: 'A small rocking frame under the escape wheel carrying two "dogs" that can block the wheel\'s teeth.',
    how: 'Pushed by the universal bar (or the space bar) it rocks back, sliding the fixed dog into the wheel and the loose dog out. When it rocks home again the dogs swap back. The carriage can never run free: one dog or the other is always in the wheel.',
  },
  looseDog: {
    name: 'Loose dog',
    what: 'The dog that normally holds the escape wheel. It can slide a short way on the rocker against a light spring.',
    how: 'While the fixed dog holds the wheel, the freed loose dog springs back by a third of a tooth. On the return it therefore drops in behind the next tooth, and the wheel turns one tooth before that tooth is caught: exactly one letter space.',
  },
  dogSpring: { name: 'Loose-dog spring', what: 'A hair spring pulling the loose dog backward on the rocker.', how: 'It resets the loose dog behind the next tooth while the fixed dog is holding the wheel.' },
  retainingPawl: { name: 'Retaining pawl', what: 'A light pawl riding the escape wheel\'s teeth.', how: 'It stops the wheel being dragged backward while the carriage is pushed home, so the carriage always settles on the correct tooth.' },
  escapeWheel: {
    name: 'Escape wheel',
    what: 'A 16-tooth ratchet wheel geared to the carriage: one tooth is one letter space (1/10 inch).',
    how: 'The mainspring is always trying to turn it by pulling the carriage. The dogs let it advance one tooth per keystroke, the same idea as a clock escapement letting a spring down one tick at a time.',
  },
  pinion: {
    name: 'Pinion and ratchet',
    what: 'A small gear meshing with the rack under the carriage, driving the escape wheel through a one-way ratchet.',
    how: 'When the carriage pulls left the pinion drives the wheel against the dog. When you push the carriage back to the right the ratchet clicks over freely, which is the zipping sound of a carriage return.',
  },
  mainspring: {
    name: 'Mainspring drum',
    what: 'A clock spring coiled in a drum, with a draw band running to the far end of the carriage.',
    how: 'It pulls the carriage to the left with about 9 N at all times. This is the energy store for letter spacing: your finger never moves the carriage. You wind the spring every time you push the carriage back for a new line.',
  },
  drawBand: { name: 'Draw band', what: 'The cord from the mainspring drum to the carriage.', how: 'It carries the spring\'s pull. It winds onto the drum as the carriage moves left and is pulled off again by the carriage return.' },
  rails: { name: 'Carriage rails', what: 'Two polished rods the carriage rides on.', how: 'They let the 1.3 kg carriage slide sideways with very little friction.' },
  truck: {
    name: 'Carriage',
    what: 'The sliding frame that carries the platen and paper, with the toothed rack underneath and the margin stops in front.',
    how: 'The paper moves, not the printing point. After each letter the carriage steps one tooth to the left so the next letter lands to the right of the last.',
  },
  cradle: {
    name: 'Shift cradle',
    what: 'The part of the carriage holding the platen. It can rise 6.8 mm on the carriage.',
    how: 'Shift lifts it (and the platen and paper) so that the upper character on each type slug meets the paper instead of the lower one. Balance springs carry most of its weight, which is why Shift is heavy but not impossible.',
  },
  platen: {
    name: 'Platen',
    what: 'The hard rubber roller the paper wraps around. Its circumference is exactly 4 inches: 24 lines.',
    how: 'It is the anvil the type strikes against, and turning it feeds the paper. A spring detent clicks it into one of 24 positions so lines are evenly spaced.',
  },
  lineLever: {
    name: 'Carriage return lever',
    what: 'The long chrome lever at the left end of the carriage.',
    how: 'The first part of your push swings the lever: its pawl turns the platen ratchet one tooth (one line). When the lever reaches its stop the rest of the push shoves the whole carriage back to the right, winding the mainspring.',
  },
  shiftFrame: {
    name: 'Shift frame',
    what: 'Two key levers joined at the back by a rail. Unlike the character keys it pivots in the middle.',
    how: 'Pressing either Shift key lowers the front and raises the rail at the back, which lifts the carriage cradle resting on it.',
  },
  spaceBar: {
    name: 'Space bar',
    what: 'A wide bar on two levers pivoting in the middle of the machine.',
    how: 'Its rear end lifts an arm of the dog rocker directly. The escapement trips exactly as for a letter, but no typebar moves, so the carriage steps without printing.',
  },
  backspace: { name: 'Backspace key', what: 'A key lever linked to a pawl on the carriage rack.', how: 'The pawl pushes the rack back a little more than one tooth; the carriage then settles forward onto the previous tooth.' },
  vibrator: {
    name: 'Ribbon vibrator',
    what: 'A light fork holding the ribbon just in front of the paper.',
    how: 'At rest it holds the ribbon below the writing line so you can read what you typed. It jumps up 12 mm in the last instant before the type lands, then drops again.',
  },
  ribbonLever: { name: 'Ribbon lift lever', what: 'A small bell crank behind the type basket.', how: 'The universal bar pushes its upright arm back; its long forward arm lifts the vibrator, multiplying 4.6 mm of bar travel into 12 mm of ribbon lift.' },
  ribbonLink: { name: 'Ribbon link', what: 'A short wire in the ribbon lift linkage.', how: 'It passes the universal bar\'s motion to the lift lever and on to the vibrator.' },
  ribbon: { name: 'Ink ribbon', what: 'A cloth band soaked in ink, running from spool to spool through the vibrator.', how: 'The type face never touches the paper directly: it squeezes the ribbon against it and the ink transfers in the shape of the character.' },
  spool: { name: 'Ribbon spool', what: 'One of two spools the ribbon winds between.', how: 'The ribbon creeps along a little with every letter space so each blow lands on fresh ink.' },
  spoolCup: { name: 'Spool cups and guides', what: 'The seats for the ribbon spools and the posts that guide the ribbon toward the printing point.', how: 'They hold the ribbon path steady.' },
  bell: { name: 'Bell', what: 'A small brass bell under the carriage.', how: 'It warns you, eight spaces before the right margin, that the line is nearly full.' },
  bellHammer: { name: 'Bell hammer', what: 'A sprung clapper beside the bell.', how: 'A cam on the carriage pushes it back as the carriage passes, then lets go. The hammer springs forward, strikes the bell once and rests clear of it.' },
  paper: { name: 'Paper', what: 'A letter-size sheet wrapped around the platen.', how: 'Every mark on it is placed by the physics: where the carriage, platen and shift actually were at the instant of the blow, and as dark as the blow was hard.' },
  shell: { name: 'Body shell', what: 'Enamelled steel panels.', how: 'They keep dust and fingers out of the mechanism. Make them glass or hide them to look inside.' },
  frame: { name: 'Frame', what: 'The cast side plates, base and cross rods everything is mounted on.', how: 'It holds every pivot in a fixed relationship; the fulcrum rods are the axes the levers turn on.' },
  springRail: { name: 'Spring rail', what: 'A rod across the frame that the key return springs hook onto.', how: 'It is the fixed anchor the springs pull against.' },
};

export const info = (kind: string): PartInfo => PART_INFO[kind] ?? { name: kind, what: '', how: '' };
