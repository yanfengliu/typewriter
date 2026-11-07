import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { KEY_ROWS, PAPER_WIDTH, PAPER_HEIGHT, PAPER_LEFT, PAPER_TOP, LETTER_PITCH, type MechanicalState, type SceneAPI, type ViewMode, type TutorialFocus, type TutorialFrame } from './contracts';

/** Inch-scaled rendering. The platen is the constraint on the sheet's inextensible path. */
export function createStudio(
  container: HTMLElement,
  paperCanvas: HTMLCanvasElement,
  onKey: (key: string, down: boolean) => void,
): SceneAPI {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.domElement.dataset.testid = 'scene';
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D typewriter. Drag to orbit, scroll to zoom, or click a key.');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 110);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.minDistance = 9;
  controls.maxDistance = 37;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.zoomSpeed = 0.65;
  controls.rotateSpeed = 0.6;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  const environmentMap = pmrem.fromScene(environment, 0.04);
  scene.environment = environmentMap.texture;
  scene.environmentIntensity = 0.6;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfffcf4, 0x8d8a76, 1.45));
  const keyLight = new THREE.DirectionalLight(0xfff6e6, 2.5);
  keyLight.position.set(-7, 16, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -17;
  keyLight.shadow.camera.right = 17;
  keyLight.shadow.camera.top = 16;
  keyLight.shadow.camera.bottom = -13;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 45;
  keyLight.shadow.normalBias = 0.025;
  keyLight.shadow.bias = -0.00008;
  keyLight.shadow.radius = 3;
  scene.add(keyLight);
  const fill = new THREE.DirectionalLight(0xd8e9e5, 1.0);
  fill.position.set(9, 7, -8);
  scene.add(fill);

  const enamel = new THREE.MeshStandardMaterial({ color: 0x31594b, roughness: 0.35, metalness: 0.35 });
  const darkEnamel = new THREE.MeshStandardMaterial({ color: 0x203d34, roughness: 0.38, metalness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc5cec8, roughness: 0.21, metalness: 0.94 });
  const brushed = new THREE.MeshStandardMaterial({ color: 0x8f9996, roughness: 0.39, metalness: 0.86 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x303936, roughness: 0.47, metalness: 0.8 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1a211e, roughness: 0.85, metalness: 0 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xeee6d2, roughness: 0.31, metalness: 0.08 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb6a276, roughness: 0.42, metalness: 0.75 });
  const ribbonBlack = new THREE.MeshStandardMaterial({ color: 0x202421, roughness: 0.97, side: THREE.DoubleSide });
  const ribbonRed = new THREE.MeshStandardMaterial({ color: 0x6e2425, roughness: 0.98, side: THREE.DoubleSide });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.ShadowMaterial({ opacity: 0.12, color: 0x5a5140 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.06;
  floor.receiveShadow = true;
  scene.add(floor);

  const machine = new THREE.Group();
  scene.add(machine);
  // These parents keep the working machine's local pivots intact when the tour
  // separates the actual assemblies. Only their translations are illustrative.
  const shell = new THREE.Group();
  const keyboard = new THREE.Group();
  const basketAssembly = new THREE.Group();
  const ribbonAssembly = new THREE.Group();
  const carriageAssembly = new THREE.Group();
  const escapementAssembly = new THREE.Group();
  machine.add(shell, keyboard, basketAssembly, ribbonAssembly, carriageAssembly, escapementAssembly);
  const covers: THREE.Object3D[] = [];
  function box(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number,
    material: THREE.Material = enamel, bevel = 0.07) {
    const geometry = bevel > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(bevel, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent: THREE.Object3D, radius: number, height: number, x: number, y: number, z: number,
    material: THREE.Material, axis: 'x' | 'y' | 'z' = 'y', segments = 40) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function rod(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius = 0.035, material = chrome) {
    const direction = b.clone().sub(a);
    const mesh = cylinder(parent, radius, direction.length(), 0, 0, 0, material, 'y', 12);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }
  function screw(parent: THREE.Object3D, x: number, y: number, z: number) {
    cylinder(parent, 0.074, 0.025, x, y, z, chrome, 'y', 16);
    box(parent, 0.093, 0.007, 0.012, x, y + 0.014, z, darkSteel, 0);
  }
  function textTexture(text: string, color: string, width = 256, height = 128, font = 'bold 72px Georgia') {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.font = font;
    context.fillStyle = color;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text, width / 2, height / 2 + 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  function label(parent: THREE.Object3D, text: string, w: number, h: number, x: number, y: number, z: number, horizontal = false, color = '#e8ddbd') {
    const texture = textTexture(text, color, 1024, 180, '66px Georgia');
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    mesh.position.set(x, y, z);
    if (horizontal) mesh.rotation.x = -Math.PI / 2;
    parent.add(mesh);
    return mesh;
  }

  // The heavy cast base, rubber feet, and rolled enamel shell.
  for (const x of [-4.65, 4.65]) for (const z of [-1.8, 4.0]) cylinder(shell, 0.43, 0.23, x, 0.115, z, rubber);
  box(shell, 11.7, 0.65, 8.0, 0, 0.54, 1.0, darkEnamel, 0.22);
  box(shell, 11.65, 0.11, 7.91, 0, 0.73, 1.0, chrome, 0.045);
  box(shell, 11.55, 0.24, 7.82, 0, 0.82, 1.0, enamel, 0.1);
  const keyboardBed = box(keyboard, 10.6, 0.13, 4.1, 0, 0.91, 2.65, darkEnamel);
  keyboardBed.rotation.x = 0.105;
  for (const x of [-5.38, 5.38]) {
    const side = box(shell, 0.74, 0.68, 6.75, x, 1.02, 0.7, enamel, 0.22);
    side.rotation.x = 0.07;
    covers.push(side);
    box(shell, 0.08, 0.06, 6.0, x + Math.sign(x) * 0.22, 1.29, 0.7, chrome, 0.025);
  }
  covers.push(box(shell, 10.8, 0.62, 0.73, 0, 1.31, -2.48, enamel, 0.2));
  for (const x of [-4.05, 4.05]) covers.push(box(shell, 2.27, 0.37, 2.6, x, 1.43, -1.04, enamel, 0.16));
  const shoulder = box(shell, 10.4, 0.35, 0.66, 0, 1.35, 0.55, enamel, 0.12);
  covers.push(shoulder);
  label(shell, 'A T E L I E R', 3.0, 0.48, 0, 0.55, 5.017);
  label(shell, 'M E C H A N I C A L   /   0 1', 2.65, 0.26, 0, 0.29, 5.017, false, '#b4b99f');
  label(shell, 'A T E L I E R', 2.4, 0.4, 0, 1.535, 0.56, true);
  for (const x of [-5.2, 5.2]) for (const z of [-2.25, 4.35]) screw(shell, x, z < 0 ? 1.58 : 1.0, z);

  // Keylevers have their own pivots; the keycaps are actual clickable geometry.
  const clickable: THREE.Object3D[] = [];
  const keys = new Map<string, { group: THREE.Group; y: number; lever: THREE.Mesh; pivot: THREE.Vector3; leverLength: number }>();
  function addKey(key: string, printed: string, x: number, y: number, z: number, width = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    keyboard.add(group);
    cylinder(group, 0.055, 0.36, 0, -0.18, 0, chrome, 'y', 12);
    if (width) {
      box(group, width, 0.18, 0.49, 0, 0, 0, chrome, 0.09);
      const cap = box(group, width - 0.07, 0.12, 0.43, 0, 0.06, 0, key === ' ' ? darkEnamel : ivory, 0.075);
      cap.userData.key = key; clickable.push(cap);
    } else {
      cylinder(group, 0.292, 0.16, 0, 0, 0, chrome);
      const cap = cylinder(group, 0.252, 0.08, 0, 0.09, 0, ivory);
      cap.userData.key = key; clickable.push(cap);
    }
    if (printed) {
      const texture = textTexture(printed, '#273a32', 192, 192, printed.length > 1 ? 'bold 33px Arial' : '53px Georgia');
      const face = new THREE.Mesh(new THREE.PlaneGeometry(width ? width * 0.85 : 0.40, 0.4), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
      face.rotation.x = -Math.PI / 2;
      face.position.y = 0.136;
      group.add(face);
      face.userData.key = key; clickable.push(face);
    }
    const tip = new THREE.Vector3(x, y - 0.32, z);
    const pivot = new THREE.Vector3(x * 0.86, 0.89, -0.25);
    const lever = rod(keyboard, tip, pivot, 0.032, darkSteel);
    keys.set(key, { group, y, lever, pivot, leverLength: tip.distanceTo(pivot) });
  }
  KEY_ROWS.forEach((row, r) => {
    const stagger = [0, 0.15, 0.31, 0.3][r];
    [...row].forEach((key, col) => addKey(key, key.toUpperCase(), (col - (row.length - 1) / 2) * 0.76 + stagger, 1.34 - r * 0.115, 1.25 + r * 0.84));
  });
  addKey('Backspace', '←', 4.92, 1.34, 1.25, 0.6);
  addKey('Tab', 'TAB', -4.95, 1.225, 2.09, 0.65);
  addKey('Shift', 'SHIFT', -4.65, 0.99, 3.77, 1.0);
  addKey('ShiftRight', 'SHIFT', 4.73, 0.99, 3.77, 0.95);
  addKey(' ', '', 0, 0.94, 4.59, 5.85);
  for (const x of [-3.7, 3.7]) box(keyboard, 0.32, 0.075, 0.4, x, 0.89, 4.59, chrome);

  // Fixed carriage rails and the mainspring/escapement visible with the cover removed.
  for (const z of [-2.27, -1.63]) cylinder(shell, 0.085, 12.5, 0, 1.80, z, chrome, 'x');
  cylinder(escapementAssembly, 0.58, 0.22, 4.18, 1.04, -1.78, darkSteel, 'z');
  cylinder(escapementAssembly, 0.49, 0.05, 4.18, 1.04, -1.64, gold, 'z');
  const escapement = new THREE.Group();
  escapement.position.set(0.1, 1.15, -1.35);
  escapementAssembly.add(escapement);
  cylinder(escapement, 0.39, 0.095, 0, 0, 0, brushed, 'z', 32);
  for (let i = 0; i < 20; i++) {
    const a = i * Math.PI * 2 / 20;
    const tooth = box(escapement, 0.09, 0.13, 0.12, Math.sin(a) * 0.4, Math.cos(a) * 0.4, 0, gold, 0.01);
    tooth.rotation.z = -a;
  }
  cylinder(escapement, 0.085, 0.17, 0, 0, 0.025, darkSteel, 'z', 20);
  // Separate pivoted dogs hand the toothed wheel from one stop to the next.
  // They belong to the fixed escapement frame, not the rotating wheel.
  const holdingDogs = new THREE.Group();
  holdingDogs.name = 'Two holding dogs';
  holdingDogs.position.copy(escapement.position);
  escapementAssembly.add(holdingDogs);
  box(holdingDogs, 0.12, 0.95, 0.10, 0.82, 0, -0.06, darkSteel, 0.025);
  const dogs: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const dog = new THREE.Group();
    dog.name = side > 0 ? 'Holding dog' : 'Receiving dog';
    dog.position.set(0.82, side * 0.36, 0.08);
    holdingDogs.add(dog); dogs.push(dog);
    rod(dog, new THREE.Vector3(), new THREE.Vector3(-0.42, -side * 0.11, 0), 0.042, brushed);
    const nose = box(dog, 0.14, 0.075, 0.10, -0.43, -side * 0.11, 0, gold, 0.014);
    nose.rotation.z = side * 0.25;
    cylinder(dog, 0.085, 0.14, 0, 0, 0, chrome, 'z', 18);
    cylinder(dog, 0.033, 0.155, 0, 0, 0, darkSteel, 'z', 12);
  }

  const carriage = new THREE.Group();
  carriageAssembly.add(carriage);
  box(carriage, 10.0, 0.22, 0.82, 0, 1.97, -1.94, darkEnamel, 0.08);
  for (const x of [-4.7, 4.7]) {
    box(carriage, 0.28, 0.91, 1.04, x, 2.22, -1.91, enamel, 0.1);
    screw(carriage, x, 2.69, -1.98);
  }
  const platen = new THREE.Group();
  platen.position.set(0, 2.46, -1.92);
  carriage.add(platen);
  cylinder(platen, 0.565, 9.25, 0, 0, 0, rubber, 'x', 80);
  cylinder(platen, 0.105, 10.85, 0, 0, 0, chrome, 'x');
  for (const x of [-5.16, 5.16]) {
    cylinder(platen, 0.44, 0.42, x, 0, 0, rubber, 'x');
    cylinder(platen, 0.34, 0.44, x, 0, 0, darkEnamel, 'x');
    cylinder(platen, 0.16, 0.46, x, 0, 0, chrome, 'x');
    for (let i = 0; i < 32; i++) {
      const a = i * Math.PI / 16;
      cylinder(platen, 0.024, 0.35, x, Math.cos(a) * 0.42, Math.sin(a) * 0.42, darkSteel, 'x', 6);
    }
  }
  // Return lever and line-space ratchet follow the carriage, not the housing.
  const returnLever = new THREE.Group();
  returnLever.position.set(-4.9, 2.51, -1.99);
  carriage.add(returnLever);
  rod(returnLever, new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.42, 0.23, 0.88), 0.065);
  rod(returnLever, new THREE.Vector3(-0.42, 0.23, 0.88), new THREE.Vector3(-1.15, 0.24, 0.94), 0.065);
  const returnHandle = box(returnLever, 0.95, 0.19, 0.4, -1.1, 0.25, 0.94, ivory, 0.065);
  returnHandle.userData.key = 'Enter'; clickable.push(returnHandle);
  cylinder(carriage, 0.45, 0.09, -4.83, 2.46, -1.92, gold, 'x');
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16;
    cylinder(carriage, 0.028, 0.1, -4.84, 2.46 + Math.cos(a) * 0.445, -1.92 + Math.sin(a) * 0.445, brushed, 'x', 6);
  }
  // Paper bail, its rollers, a visible scale, and the paper guide fingers.
  rod(carriage, new THREE.Vector3(-4.65, 2.36, -1.72), new THREE.Vector3(-4.35, 2.94, -1.46), 0.045);
  rod(carriage, new THREE.Vector3(4.65, 2.36, -1.72), new THREE.Vector3(4.35, 2.94, -1.46), 0.045);
  cylinder(carriage, 0.042, 8.7, 0, 2.94, -1.46, chrome, 'x', 18);
  for (const x of [-2.75, 2.75]) cylinder(carriage, 0.12, 0.33, x, 2.94, -1.46, rubber, 'x', 24);
  box(carriage, 8.9, 0.16, 0.11, 0, 2.12, -1.25, chrome, 0.025);
  for (let i = 0; i <= 80; i++) {
    const major = i % 10 === 0;
    box(carriage, 0.013, major ? 0.09 : 0.045, 0.009, -4 + i * 0.1, 2.14, -1.188, darkSteel, 0);
  }
  for (const x of [-0.23, 0.23]) {
    box(ribbonAssembly, 0.05, 0.48, 0.07, x, 2.21, -1.18, chrome, 0.012);
    box(ribbonAssembly, 0.16, 0.05, 0.065, x, 2.43, -1.18, chrome, 0.012);
  }

  // Continuous sheet: the outgoing front, lower half-wrap, and incoming rear tail.
  // s is arc length along the 11-inch sheet. It never changes the paper's UVs.
  const paperTexture = new THREE.CanvasTexture(paperCanvas);
  paperTexture.colorSpace = THREE.SRGBColorSpace;
  paperTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const paperMaterial = new THREE.MeshStandardMaterial({ map: paperTexture, color: 0xffffff, roughness: 0.96, side: THREE.FrontSide });
  const backMaterial = new THREE.MeshStandardMaterial({ color: 0xf3eddd, roughness: 0.97, side: THREE.BackSide });
  const rows = 144, cols = 8;
  const paperPositions = new Float32Array((rows + 1) * (cols + 1) * 3);
  const paperUV = new Float32Array((rows + 1) * (cols + 1) * 2);
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    const i = row * (cols + 1) + col;
    paperUV[i * 2] = col / cols;
    paperUV[i * 2 + 1] = 1 - row / rows;
    if (row < rows && col < cols) {
      const next = i + cols + 1;
      indices.push(i, next, i + 1, i + 1, next, next + 1);
    }
  }
  const paperGeometry = new THREE.BufferGeometry();
  paperGeometry.setAttribute('position', new THREE.BufferAttribute(paperPositions, 3).setUsage(THREE.DynamicDrawUsage));
  paperGeometry.setAttribute('uv', new THREE.BufferAttribute(paperUV, 2));
  paperGeometry.setIndex(indices);
  const paper = new THREE.Mesh(paperGeometry, paperMaterial);
  paper.castShadow = true; paper.receiveShadow = true;
  carriage.add(paper);
  const back = new THREE.Mesh(paperGeometry, backMaterial);
  back.castShadow = true; back.receiveShadow = true;
  carriage.add(back);
  let lastFeed = Number.NaN;
  function feedPaper(line: number) {
    if (Math.abs(line - lastFeed) < 0.0001) return;
    lastFeed = line;
    const radius = 0.575, topAtStrike = 1 + line / 6;
    for (let row = 0; row <= rows; row++) {
      const s = 11 * row / rows;
      const q = topAtStrike - s;
      let y: number, z: number;
      if (q >= 0) {
        // A very gentle free-sheet curl, parameterized by arc length.
        const curlRadius = 32;
        y = 2.46 + curlRadius * Math.sin(q / curlRadius);
        z = -1.92 + radius + curlRadius * (1 - Math.cos(q / curlRadius));
      } else if (q >= -Math.PI * radius) {
        const angle = q / radius;
        y = 2.46 + radius * Math.sin(angle);
        z = -1.92 + radius * Math.cos(angle);
      } else {
        // Incoming tail bends away from the operator, like a loose supported sheet.
        const tail = -q - Math.PI * radius;
        const bendRadius = 1.65, bendAngle = 1.3, bendLength = bendRadius * bendAngle;
        const bent = Math.min(tail, bendLength), straight = Math.max(0, tail - bendLength);
        y = 2.46 + bendRadius * Math.sin(bent / bendRadius) + straight * Math.cos(bendAngle);
        z = -1.92 - radius - bendRadius * (1 - Math.cos(bent / bendRadius)) - straight * Math.sin(bendAngle);
      }
      for (let col = 0; col <= cols; col++) {
        const i = (row * (cols + 1) + col) * 3;
        const x = (col / cols - 0.5) * 8.5;
        paperPositions[i] = x;
        paperPositions[i + 1] = y;
        paperPositions[i + 2] = z;
      }
    }
    paperGeometry.attributes.position.needsUpdate = true;
    paperGeometry.computeVertexNormals();
    paperGeometry.computeBoundingSphere();
    platen.rotation.x = line / 6 / radius;
  }
  feedPaper(0);

  // Two ribbon spools, ratchet hubs, and a two-color cloth strip on the vibrator.
  const spools: THREE.Group[] = [];
  for (const x of [-3.92, 3.92]) {
    const spool = new THREE.Group();
    spool.position.set(x, 1.76, -0.97);
    ribbonAssembly.add(spool); spools.push(spool);
    cylinder(spool, 0.88, 0.065, 0, -0.12, 0, darkSteel);
    cylinder(spool, 0.71, 0.19, 0, 0.0, 0, ribbonBlack);
    cylinder(spool, 0.87, 0.065, 0, 0.13, 0, darkSteel);
    cylinder(spool, 0.13, 0.13, 0, 0.19, 0, chrome);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const spoke = box(spool, 0.12, 0.03, 0.55, Math.sin(angle) * 0.45, 0.17, Math.cos(angle) * 0.45, brushed, 0.02);
      spoke.rotation.y = angle;
    }
    cylinder(spool, 0.068, 0.155, 0, 0.23, 0, gold, 'y', 20);
  }
  const ribbonPoints = [new THREE.Vector3(-3.35, 1.83, -0.50), new THREE.Vector3(-0.4, 2.24, -1.24), new THREE.Vector3(0.4, 2.24, -1.24), new THREE.Vector3(3.35, 1.83, -0.50)];
  const ribbonMeshes: THREE.Mesh[] = [];
  for (let band = 0; band < 2; band++) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5, 4, 6, 5, 5, 6, 7]);
    const mesh = new THREE.Mesh(geometry, band === 0 ? ribbonBlack : ribbonRed);
    mesh.castShadow = true;
    ribbonAssembly.add(mesh); ribbonMeshes.push(mesh);
  }
  let lastRibbonLift = Number.NaN;
  function liftRibbon(lift: number) {
    if (Math.abs(lift - lastRibbonLift) < 0.001) return;
    lastRibbonLift = lift;
    ribbonPoints[1].y = ribbonPoints[2].y = 2.24 + lift * 0.22;
    ribbonMeshes.forEach((mesh, band) => {
      const attr = mesh.geometry.attributes.position as THREE.BufferAttribute;
      ribbonPoints.forEach((p, i) => {
        attr.setXYZ(i * 2, p.x, p.y - band * 0.072, p.z);
        attr.setXYZ(i * 2 + 1, p.x, p.y - (band + 1) * 0.072, p.z);
      });
      attr.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
    });
  }
  liftRibbon(0);

  // The fan's individual bars rotate rigidly about pivots, into one common guide.
  const basket = new THREE.Group();
  basketAssembly.add(basket);
  const barKeys = KEY_ROWS.join('').split('');
  const typebars = new Map<string, { group: THREE.Group; rest: THREE.Quaternion; hit: THREE.Quaternion }>();
  const impactPoint = new THREE.Vector3(0, 2.46, -1.265);
  const yAxis = new THREE.Vector3(0, 1, 0);
  barKeys.forEach((key, index) => {
    const angle = (index / (barKeys.length - 1) - 0.5) * 2.25;
    const pivot = new THREE.Vector3(Math.sin(angle) * 2.48, 1.03, -1.02 + Math.cos(angle) * 0.65);
    const hitDirection = impactPoint.clone().sub(pivot);
    const length = hitDirection.length();
    const restDirection = new THREE.Vector3(-pivot.x * 0.85, 0.15, 1.12 - pivot.z).normalize();
    const group = new THREE.Group();
    group.position.copy(pivot);
    basket.add(group);
    const rest = new THREE.Quaternion().setFromUnitVectors(yAxis, restDirection);
    const hit = new THREE.Quaternion().setFromUnitVectors(yAxis, hitDirection.normalize());
    group.quaternion.copy(rest);
    box(group, 0.033, length - 0.16, 0.055, 0, (length - 0.16) / 2, 0, brushed, 0.008);
    box(group, 0.108, 0.18, 0.12, 0, length - 0.08, 0, darkSteel, 0.015);
    box(group, 0.085, 0.055, 0.022, 0, length - 0.035, 0.068, chrome, 0.005);
    box(group, 0.085, 0.055, 0.022, 0, length - 0.11, 0.068, chrome, 0.005);
    cylinder(basket, 0.052, 0.09, pivot.x, pivot.y, pivot.z, gold, 'z', 10);
    typebars.set(key, { group, rest, hit });
  });
  // Segment arc with holes, resting pad, and the universal bar.
  const segmentPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const angle = (i / 60 - 0.5) * 2.3;
    segmentPoints.push(new THREE.Vector3(Math.sin(angle) * 2.48, 1.0, -1.02 + Math.cos(angle) * 0.65));
  }
  const segmentCurve = new THREE.CatmullRomCurve3(segmentPoints);
  const segment = new THREE.Mesh(new THREE.TubeGeometry(segmentCurve, 60, 0.09, 8, false), brushed);
  basket.add(segment);
  cylinder(basket, 0.07, 4.5, 0, 1.11, 1.0, rubber, 'x');
  cylinder(basketAssembly, 0.045, 8.6, 0, 0.99, 0.05, brushed, 'x');

  // Small mechanical details give the cutaway a legible structure.
  const bellGroup = new THREE.Group();
  bellGroup.position.set(4.72, 1.6, -2.1);
  escapementAssembly.add(bellGroup);
  const bellShell = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  bellGroup.add(bellShell);
  cylinder(bellGroup, 0.045, 0.38, 0, 0.04, 0, chrome, 'y', 12);
  box(escapementAssembly, 0.06, 0.06, 1.1, 4.35, 1.52, -2.0, brushed);
  const selector = box(ribbonAssembly, 0.11, 0.12, 0.40, 5.38, 1.55, -0.11, chrome);
  selector.rotation.x = -0.25;
  cylinder(ribbonAssembly, 0.065, 0.015, 5.39, 1.38, 0.28, ribbonRed, 'y', 16);
  cylinder(ribbonAssembly, 0.065, 0.015, 5.39, 1.40, -0.45, ribbonBlack, 'y', 16);

  // A fresh texture is deliberately drawn from scratch, never from the user's
  // canvas. Rewinding a lesson removes its illustrative mark without saving it.
  const tutorialCanvas = document.createElement('canvas');
  tutorialCanvas.width = PAPER_WIDTH; tutorialCanvas.height = PAPER_HEIGHT;
  const tutorialContext = tutorialCanvas.getContext('2d')!;
  const tutorialTexture = new THREE.CanvasTexture(tutorialCanvas);
  tutorialTexture.colorSpace = THREE.SRGBColorSpace;
  tutorialTexture.anisotropy = paperTexture.anisotropy;
  const tutorialPaperMaterial = paperMaterial.clone();
  tutorialPaperMaterial.map = tutorialTexture;
  let tutorialInk: TutorialFrame['ink'] | undefined;
  function drawTutorialPaper(ink: TutorialFrame['ink']) {
    if (ink === tutorialInk) return;
    tutorialInk = ink;
    tutorialContext.fillStyle = '#f7f2e4';
    tutorialContext.fillRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT);
    if (ink) {
      tutorialContext.fillStyle = '#24271f';
      tutorialContext.font = 'bold 33.333px "Courier New", Courier, monospace';
      tutorialContext.textAlign = 'center'; tutorialContext.textBaseline = 'alphabetic';
      tutorialContext.fillText(ink, PAPER_LEFT + (32 + 0.5) * LETTER_PITCH, PAPER_TOP);
    }
    tutorialTexture.needsUpdate = true;
  }
  drawTutorialPaper('');

  const tutorialOverlay = document.createElement('div');
  tutorialOverlay.className = 'tutorial-scene-labels';
  tutorialOverlay.setAttribute('aria-hidden', 'true');
  tutorialOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;display:none;z-index:2;';
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const labelLeaders = document.createElementNS(svgNamespace, 'svg');
  labelLeaders.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;';
  tutorialOverlay.appendChild(labelLeaders);
  container.appendChild(tutorialOverlay);
  const tutorialDefinitions = [
    { id: 'shell', name: '01  Shell & frame', group: shell, offset: [0, 0, 0], anchor: [-4.8, 0.8, 3.7], side: 0, slot: 2, focuses: [] },
    { id: 'keys', name: '02  Keys & keylevers', group: keyboard, offset: [0, 0.4, 4.4], anchor: [0, 1.2, 3.2], side: 1, slot: 2, focuses: ['keys'] },
    { id: 'typebars', name: '03  Typebar basket', group: basketAssembly, offset: [-0.8, 2.7, 0.8], anchor: [-1.6, 1.35, 0.5], side: 0, slot: 1, focuses: ['typebars', 'shift'] },
    { id: 'ribbon', name: '04  Ribbon & spools', group: ribbonAssembly, offset: [-1.4, 5.1, -0.1], anchor: [-3.9, 2, -0.97], side: 0, slot: 0, focuses: ['ribbon'] },
    { id: 'carriage', name: '05  Carriage & platen', group: carriageAssembly, offset: [0.2, 6.4, -3.4], anchor: [3.8, 2.5, -1.9], side: 1, slot: 0, focuses: ['return'] },
    { id: 'escapement', name: '06  Escapement', group: escapementAssembly, offset: [6.1, 2.5, 0.1], anchor: [0.1, 1.15, -1.35], side: 1, slot: 1, focuses: ['escapement'] },
  ];
  const tutorialAssemblies = tutorialDefinitions.map(definition => {
    definition.group.name = definition.name.slice(4);
    const element = document.createElement('div');
    element.className = 'tutorial-part-label';
    element.dataset.tutorialPart = definition.id;
    element.textContent = definition.name;
    element.style.cssText = 'position:absolute;box-sizing:border-box;padding:6px 8px;border:1px solid #c8c4af;border-radius:5px;background:rgba(248,245,233,.94);color:#34473b;font:500 11px/1.25 system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 10px #263a2610;';
    tutorialOverlay.appendChild(element);
    const leader = document.createElementNS(svgNamespace, 'line');
    leader.setAttribute('stroke-width', '1');
    labelLeaders.appendChild(leader);
    const originals: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[]; teaching: THREE.Material | THREE.Material[] }[] = [];
    const materials = new Map<THREE.Material, THREE.Material>();
    function teachingMaterial(material: THREE.Material) {
      let clone = materials.get(material);
      if (!clone) { clone = material.clone(); materials.set(material, clone); }
      return clone;
    }
    definition.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material;
      originals.push({ mesh: object, material, teaching: Array.isArray(material) ? material.map(teachingMaterial) : teachingMaterial(material) });
    });
    return { ...definition, element, leader, originals, materials, offset: new THREE.Vector3(...definition.offset), anchor: new THREE.Vector3(...definition.anchor), bounds: new THREE.Box3().setFromObject(definition.group) };
  });
  // The resting fan's bounds do not include the raised slug at the common guide.
  tutorialAssemblies[2].bounds.expandByPoint(impactPoint);
  const guidePositions = new Float32Array(tutorialAssemblies.length * 6);
  const guideGeometry = new THREE.BufferGeometry();
  guideGeometry.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3).setUsage(THREE.DynamicDrawUsage));
  const guideMaterial = new THREE.LineBasicMaterial({ color: 0x9c956e, transparent: true, opacity: 0.36, depthTest: false, depthWrite: false });
  const assemblyGuides = new THREE.LineSegments(guideGeometry, guideMaterial);
  assemblyGuides.visible = false; assemblyGuides.frustumCulled = false;
  scene.add(assemblyGuides);
  const focusBoxes = [new THREE.BoxHelper(keyboard, 0xb68a35), new THREE.BoxHelper(basket, 0xb68a35)];
  for (const helper of focusBoxes) {
    helper.visible = false;
    helper.material.depthTest = false;
    helper.material.transparent = true;
    helper.material.opacity = 0.8;
    scene.add(helper);
  }
  const focusParts: Record<TutorialFocus, THREE.Object3D[]> = {
    overview: [], keys: [keys.get('a')!.group, keys.get('a')!.lever],
    typebars: [typebars.get('a')!.group], ribbon: [ribbonMeshes[0]],
    escapement: [escapement, holdingDogs], shift: [keys.get('Shift')!.group, basket],
    return: [returnLever, platen],
  };
  const tutorialDirections: Record<TutorialFocus, THREE.Vector3> = {
    overview: new THREE.Vector3(9, 16, 22).normalize(),
    keys: new THREE.Vector3(5, 17, 20).normalize(),
    typebars: new THREE.Vector3(3, 17, 15).normalize(),
    ribbon: new THREE.Vector3(5, 16, 19).normalize(),
    escapement: new THREE.Vector3(7, 12, 20).normalize(),
    shift: new THREE.Vector3(7, 15, 19).normalize(),
    return: new THREE.Vector3(-12, 10, 19).normalize(),
  };
  const tutorialFocusCenters: Record<TutorialFocus, THREE.Vector3> = {
    overview: new THREE.Vector3(0, 2.2, -0.8), keys: new THREE.Vector3(0, 1.1, 2.2),
    typebars: new THREE.Vector3(0, 1.9, -0.1), ribbon: new THREE.Vector3(0, 2.2, -0.9),
    escapement: new THREE.Vector3(0.6, 1.3, -1.1), shift: new THREE.Vector3(0, 1.5, 0.1),
    return: new THREE.Vector3(-2.2, 2.5, -1.6),
  };
  let tutorial: TutorialFrame | null = null;
  let explosion = 0;
  let tutorialCameraManual = false;
  const savedCamera = new THREE.Vector3();
  const savedTarget = new THREE.Vector3();
  const diagramBounds = new THREE.Box3();
  const shiftedBounds = new THREE.Box3();
  const diagramCenter = new THREE.Vector3();
  const cameraRight = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const scratch = new THREE.Vector3();
  const projected = new THREE.Vector3();
  let stageWidth = 1, stageHeight = 1;
  let cutaway = false;

  let mode: ViewMode = 'write';
  let disposed = false;
  let lastState: MechanicalState | undefined;
  let cameraMoving = true;
  let framedNarrow: boolean | undefined;
  const cameraGoal = new THREE.Vector3();
  const targetGoal = new THREE.Vector3();
  function frameTutorialCamera(instant = false) {
    if (!tutorial || tutorialCameraManual) return;
    diagramBounds.makeEmpty();
    for (const assembly of tutorialAssemblies) {
      shiftedBounds.copy(assembly.bounds).translate(assembly.group.position);
      if (assembly.group === carriageAssembly) shiftedBounds.translate(scratch.set(carriage.position.x, 0, 0));
      diagramBounds.union(shiftedBounds);
    }
    diagramBounds.getCenter(diagramCenter);
    targetGoal.copy(diagramCenter).lerp(tutorialFocusCenters[tutorial.focus], (1 - explosion) * 0.55);
    const direction = tutorialDirections[tutorial.focus];
    cameraRight.crossVectors(yAxis, direction).normalize();
    cameraUp.crossVectors(direction, cameraRight).normalize();
    const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanHorizontal = tanVertical * camera.aspect;
    let distance = 0;
    for (let corner = 0; corner < 8; corner++) {
      scratch.set(corner & 1 ? diagramBounds.max.x : diagramBounds.min.x, corner & 2 ? diagramBounds.max.y : diagramBounds.min.y, corner & 4 ? diagramBounds.max.z : diagramBounds.min.z).sub(targetGoal);
      const depth = scratch.dot(direction);
      distance = Math.max(distance, Math.abs(scratch.dot(cameraRight)) / tanHorizontal + depth, Math.abs(scratch.dot(cameraUp)) / tanVertical + depth);
    }
    // Close lessons retain context but let the active mechanism fill the stage.
    // The separated overview always fits, including the incoming paper tail.
    const focusZoom = tutorial.focus === 'overview' ? 1 : THREE.MathUtils.lerp(stageWidth < 600 ? 0.88 : 0.78, 1, explosion);
    cameraGoal.copy(direction).multiplyScalar(Math.max(12, distance * 1.08 * focusZoom)).add(targetGoal);
    cameraMoving = true;
    if (instant || tutorial.reducedMotion) {
      camera.position.copy(cameraGoal); controls.target.copy(targetGoal);
      cameraMoving = false; controls.update();
    }
  }
  function updateTutorialAppearance() {
    if (!tutorial) return;
    for (const assembly of tutorialAssemblies) {
      const active = tutorial.focus === 'overview' || assembly.focuses.includes(tutorial.focus);
      const ghost = tutorial.focus === 'escapement' && !active && explosion < 0.25;
      for (const [original, material] of assembly.materials) {
        material.transparent = original.transparent || ghost;
        material.opacity = original.opacity * (ghost ? 0.23 : 1);
        material.depthWrite = original.depthWrite && !ghost;
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissive.setHex(active ? 0xc49d45 : 0x000000);
          material.emissiveIntensity = active ? tutorial.focus === 'overview' ? 0.025 : 0.16 : 0;
        }
        material.needsUpdate = true;
      }
      assembly.element.dataset.active = String(active);
      assembly.element.style.borderColor = active ? '#a88d49' : '#c8c4af';
      assembly.element.style.background = active ? 'rgba(252,246,222,.96)' : 'rgba(248,245,233,.94)';
      assembly.leader.setAttribute('stroke', active ? '#a18847' : '#929b8b');
    }
    const paperGhost = tutorial.focus === 'escapement' && explosion < 0.25;
    tutorialPaperMaterial.transparent = paperGhost;
    tutorialPaperMaterial.opacity = paperGhost ? 0.23 : 1;
    tutorialPaperMaterial.depthWrite = !paperGhost;
    tutorialPaperMaterial.needsUpdate = true;
  }
  function updateTutorialDiagram() {
    if (!tutorial) return;
    const compact = stageWidth < 600;
    const labelWidth = compact ? 118 : 149;
    const margin = compact ? 8 : 16;
    const topInset = compact ? 40 : 60;
    const bottomInset = compact ? 45 : 65;
    const showAll = tutorial.focus === 'overview' || explosion > 0.35;
    const positions = guideGeometry.attributes.position as THREE.BufferAttribute;
    for (let index = 0; index < tutorialAssemblies.length; index++) {
      const assembly = tutorialAssemblies[index];
      scratch.copy(assembly.anchor);
      if (assembly.group === carriageAssembly) scratch.x += carriage.position.x;
      positions.setXYZ(index * 2, scratch.x, scratch.y, scratch.z);
      scratch.add(assembly.group.position);
      positions.setXYZ(index * 2 + 1, scratch.x, scratch.y, scratch.z);
      projected.copy(scratch).project(camera);
      const active = assembly.focuses.includes(tutorial.focus);
      const visible = (showAll || active) && projected.z > -1 && projected.z < 1;
      assembly.element.style.display = visible ? 'block' : 'none';
      assembly.leader.style.display = visible ? '' : 'none';
      if (!visible) continue;
      const left = assembly.side === 0 ? margin : stageWidth - labelWidth - margin;
      const top = topInset + assembly.slot * Math.max(0, (stageHeight - topInset - bottomInset - 30) / 2);
      assembly.element.style.width = `${labelWidth}px`;
      assembly.element.style.fontSize = compact ? '9px' : '11px';
      assembly.element.style.transform = `translate(${left}px,${top}px)`;
      assembly.leader.setAttribute('x1', String((projected.x + 1) * stageWidth / 2));
      assembly.leader.setAttribute('y1', String((1 - projected.y) * stageHeight / 2));
      assembly.leader.setAttribute('x2', String(assembly.side === 0 ? left + labelWidth : left));
      assembly.leader.setAttribute('y2', String(top + 13));
    }
    positions.needsUpdate = true;
    assemblyGuides.visible = explosion > 0.02;
    guideMaterial.opacity = explosion * 0.32;
    const parts = focusParts[tutorial.focus];
    for (let index = 0; index < focusBoxes.length; index++) {
      const helper = focusBoxes[index];
      helper.visible = index < parts.length;
      if (helper.visible) helper.setFromObject(parts[index]);
    }
  }
  function positionCamera(view: ViewMode, instant = false) {
    mode = view;
    if (tutorial) return;
    // Match the CSS viewport breakpoint: the mobile stage deliberately extends
    // 30px beyond either edge, so its own width is not the visible width.
    const narrow = window.matchMedia('(max-width:650px)').matches;
    framedNarrow = narrow;
    if (view === 'write') {
      cameraGoal.set(10.7, 10.7, 18.5);
      targetGoal.set(0.7, 1.72, -0.3);
    } else if (view === 'inspect') {
      cameraGoal.set(9.1, 18.45, 13.83);
      targetGoal.set(0.7, 1.8, -0.75);
    } else {
      cameraGoal.set(0, 6.4, 11.8);
      targetGoal.set(0, 3.15, -1.3);
    }
    if (narrow && view !== 'paper') {
      // Recenter on the keyboard and reserve space for both viewport edge crop
      // and the paper-status HUD, without changing the established view angle.
      cameraGoal.sub(targetGoal).multiplyScalar(view === 'write' ? 1.36 : 1.29);
      targetGoal.set(0, 1.65, 0.72);
      cameraGoal.add(targetGoal);
    }
    cameraMoving = true;
    if (instant) {
      camera.position.copy(cameraGoal);
      controls.target.copy(targetGoal);
      cameraMoving = false;
      controls.update();
    }
  }
  function resize() {
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    stageWidth = width; stageHeight = height;
    camera.aspect = width / height;
    camera.fov = tutorial ? width < 600 ? 42 : 36 : width / height < 0.85 ? 44 : 31;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    const narrow = window.matchMedia('(max-width:650px)').matches;
    // A crossing needs a new composition; ordinary same-layout resizing must
    // preserve an orbit or zoom the user deliberately chose.
    if (tutorial) frameTutorialCamera(true);
    else if (framedNarrow !== narrow) positionCamera(mode, true);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerStart: { x: number; y: number; id: number; key?: string } | undefined;
  let pointerKey: string | undefined;
  let keyReleaseTimer: ReturnType<typeof setTimeout> | undefined;
  function hitKey(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    scene.updateMatrixWorld(true);
    return raycaster.intersectObjects(clickable, false)[0]?.object.userData.key as string | undefined;
  }
  function releasePointerKey() {
    if (pointerKey) onKey(pointerKey === 'ShiftRight' ? 'Shift' : pointerKey, false);
    pointerKey = undefined;
    if (keyReleaseTimer) clearTimeout(keyReleaseTimer);
    keyReleaseTimer = undefined;
  }
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    if (tutorial) { pointerStart = undefined; return; }
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId, key: hitKey(event) };
    cameraMoving = false;
  }
  function pointerUp(event: PointerEvent) {
    if (tutorial) return;
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const start = pointerStart; pointerStart = undefined;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) return;
    const key = start.key;
    if (!key || key !== hitKey(event)) return;
    releasePointerKey();
    pointerKey = key;
    onKey(key === 'ShiftRight' ? 'Shift' : key, true);
    keyReleaseTimer = setTimeout(releasePointerKey, 100);
    container.focus({ preventScroll: true });
  }
  function pointerCancel() { pointerStart = undefined; releasePointerKey(); }
  function pointerMove(event: PointerEvent) { renderer.domElement.style.cursor = !tutorial && hitKey(event) ? 'pointer' : pointerStart ? 'grabbing' : 'grab'; }
  function orbitStart() { cameraMoving = false; if (tutorial) tutorialCameraManual = true; }
  controls.addEventListener('start', orbitStart);
  renderer.domElement.addEventListener('pointerdown', pointerDown);
  renderer.domElement.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerCancel);
  window.addEventListener('blur', pointerCancel);

  const frame = new THREE.Quaternion();
  const leverTip = new THREE.Vector3();
  function applyMechanicalPose(state: MechanicalState, dt: number, instant = false) {
    // Canvas glyph centers sit at 200px + column*20px on an 8.5in / 1700px sheet.
    carriage.position.x = (32.5 - state.carriage) * 0.1;
    basket.position.y = -state.shift * 0.075;
    feedPaper(state.feed);
    liftRibbon(state.ribbonLift);
    returnLever.rotation.y = state.returning ? -0.22 : instant ? 0 : THREE.MathUtils.damp(returnLever.rotation.y, 0, 15, dt);
    escapement.rotation.z = -state.carriage * Math.PI * 2 / 20;
    // The model releases the carriage only after contact. Driving the dogs from
    // that travel preserves the order, including when the lesson is scrubbed.
    const toothTravel = state.carriage - Math.floor(state.carriage);
    const handoff = THREE.MathUtils.smoothstep(toothTravel, 0, 0.2);
    dogs[0].rotation.z = state.returning ? -0.28 : -0.28 * (handoff - THREE.MathUtils.smoothstep(toothTravel, 0.55, 0.85));
    dogs[1].rotation.z = state.returning ? 0.24 : 0.24 * (1 - handoff + THREE.MathUtils.smoothstep(toothTravel, 0.65, 0.9));
    // Ribbon travel is in meters; each spindle angle is cloth travel / winding radius.
    spools[0].rotation.y = state.ribbonTravel / 0.018;
    spools[1].rotation.y = state.ribbonTravel / 0.020;
    bellGroup.rotation.z = Math.sin(state.bell * 60) * Math.min(0.07, state.bell * 0.07);
    for (const [key, visual] of keys) {
      const stateBar = state.bars.find(bar => bar.key === key);
      const held = stateBar?.pressed || (key.startsWith('Shift') && state.shifted) || (!tutorial && pointerKey === key);
      // A quick keydown/keyup can fall between display frames. The linkage still
      // carries the cap through its stroke while the driven typebar is moving.
      const depression = held ? 1 : THREE.MathUtils.clamp((stateBar?.angle ?? 0) * 3, 0, 1);
      const y = visual.y - depression * 0.15;
      visual.group.position.y = instant ? y : THREE.MathUtils.damp(visual.group.position.y, y, 35, dt);
      leverTip.copy(visual.group.position); leverTip.y -= 0.32;
      scratch.copy(visual.pivot).sub(leverTip);
      visual.lever.scale.y = scratch.length() / visual.leverLength;
      visual.lever.position.copy(leverTip).add(visual.pivot).multiplyScalar(0.5);
      visual.lever.quaternion.setFromUnitVectors(yAxis, scratch.normalize());
    }
    for (const [key, visual] of typebars) {
      const bar = state.bars.find(candidate => candidate.key === key);
      frame.slerpQuaternions(visual.rest, visual.hit, THREE.MathUtils.clamp(bar?.angle ?? 0, 0, 1));
      visual.group.quaternion.copy(frame);
    }
  }
  function setTutorial(next: TutorialFrame | null) {
    if (disposed) return;
    const previous = tutorial;
    if (next) {
      if (!previous) {
        releasePointerKey(); pointerStart = undefined;
        savedCamera.copy(camera.position); savedTarget.copy(controls.target);
        for (const cover of covers) cover.visible = false;
        for (const assembly of tutorialAssemblies) for (const item of assembly.originals) item.mesh.material = item.teaching;
        paper.material = tutorialPaperMaterial;
        tutorialOverlay.style.display = 'block';
        renderer.domElement.dataset.tutorial = 'true';
        renderer.domElement.setAttribute('aria-label', 'Typewriter teaching diagram. Drag to orbit or scroll to zoom.');
        controls.minDistance = 6; controls.maxDistance = 90;
        tutorialCameraManual = false;
        explosion = THREE.MathUtils.clamp(next.explosion, 0, 1);
      }
      tutorial = next;
      controls.enableDamping = !next.reducedMotion;
      drawTutorialPaper(next.ink);
      if (!previous || previous.focus !== next.focus || Math.abs(previous.explosion - next.explosion) > 0.15) {
        tutorialCameraManual = false;
        updateTutorialAppearance();
      }
      if (!previous) {
        applyMechanicalPose(next.state, 0, true);
        for (const assembly of tutorialAssemblies) assembly.group.position.copy(assembly.offset).multiplyScalar(explosion);
        resize();
      }
      return;
    }
    if (!previous) return;
    tutorial = null;
    explosion = 0;
    for (const assembly of tutorialAssemblies) {
      assembly.group.position.set(0, 0, 0);
      for (const item of assembly.originals) item.mesh.material = item.material;
    }
    paper.material = paperMaterial;
    for (const cover of covers) cover.visible = !cutaway;
    for (const helper of focusBoxes) helper.visible = false;
    assemblyGuides.visible = false;
    tutorialOverlay.style.display = 'none';
    delete renderer.domElement.dataset.tutorial;
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D typewriter. Drag to orbit, scroll to zoom, or click a key.');
    controls.minDistance = 9; controls.maxDistance = 37;
    // Flush gesture inertia before restoring the saved writing composition.
    controls.enableDamping = false; controls.update(); controls.enableDamping = true;
    camera.position.copy(savedCamera); controls.target.copy(savedTarget);
    cameraGoal.copy(savedCamera); targetGoal.copy(savedTarget);
    cameraMoving = false;
    camera.fov = camera.aspect < 0.85 ? 44 : 31;
    camera.updateProjectionMatrix();
    if (lastState) applyMechanicalPose(lastState, 0, true);
    controls.update();
  }
  function update(state: MechanicalState, dt: number) {
    if (disposed) return;
    lastState = state;
    applyMechanicalPose(tutorial?.state ?? state, dt, tutorial !== null);
    if (tutorial) {
      const previouslyGhosted = explosion < 0.25;
      const desiredExplosion = THREE.MathUtils.clamp(tutorial.explosion, 0, 1);
      explosion = tutorial.reducedMotion ? desiredExplosion : THREE.MathUtils.damp(explosion, desiredExplosion, 7, dt);
      for (const assembly of tutorialAssemblies) assembly.group.position.copy(assembly.offset).multiplyScalar(explosion);
      if (previouslyGhosted !== (explosion < 0.25)) updateTutorialAppearance();
      frameTutorialCamera();
    }
    if (cameraMoving) {
      const factor = tutorial?.reducedMotion ? 1 : 1 - Math.exp(-6 * dt);
      camera.position.lerp(cameraGoal, factor);
      controls.target.lerp(targetGoal, factor);
      if (camera.position.distanceTo(cameraGoal) < 0.015) cameraMoving = false;
    }
    controls.update();
    if (tutorial) { scene.updateMatrixWorld(true); updateTutorialDiagram(); }
    renderer.render(scene, camera);
  }

  return {
    update,
    setTutorial,
    setView(view) { positionCamera(view); },
    setCutaway(active) {
      cutaway = active;
      if (tutorial) return;
      for (const cover of covers) cover.visible = !active;
      if (active) positionCamera('inspect');
      else if (mode === 'inspect') positionCamera('write');
    },
    markPaperDirty() { paperTexture.needsUpdate = true; },
    resetCamera() { if (tutorial) { tutorialCameraManual = false; frameTutorialCamera(); } else positionCamera(mode); },
    dispose() {
      if (disposed) return;
      setTutorial(null);
      disposed = true;
      releasePointerKey();
      observer.disconnect();
      controls.removeEventListener('start', orbitStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerCancel);
      window.removeEventListener('blur', pointerCancel);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      for (const assembly of tutorialAssemblies) for (const material of assembly.materials.values()) material.dispose();
      tutorialPaperMaterial.dispose(); tutorialTexture.dispose(); tutorialOverlay.remove();
      environmentMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      lastState = undefined;
    },
  };
}
