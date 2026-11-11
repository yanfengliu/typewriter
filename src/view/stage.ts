// Renderer, lights, desk and camera.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

function deskTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1024;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#4a3324';
  g.fillRect(0, 0, 1024, 1024);
  // long wood grain streaks
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const y = rnd() * 1024, w = 200 + rnd() * 800, x = rnd() * 1024 - 200;
    g.strokeStyle = `rgba(${rnd() < 0.5 ? '20,10,5' : '120,84,56'},${0.04 + rnd() * 0.08})`;
    g.lineWidth = 0.6 + rnd() * 2.2;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + w * 0.3, y + (rnd() - 0.5) * 6, x + w * 0.6, y + (rnd() - 0.5) * 6, x + w, y + (rnd() - 0.5) * 8);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly key: THREE.DirectionalLight;
  readonly desk: THREE.Mesh;

  constructor(readonly canvas: HTMLCanvasElement) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.localClippingEnabled = true;

    this.scene.background = new THREE.Color(0x191b20);
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    this.scene.environmentIntensity = 0.85;

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 20);
    this.camera.position.set(0.02, 0.5, 0.72);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.1, 0.02);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.06;
    this.controls.maxDistance = 2.5;
    this.controls.maxPolarAngle = Math.PI * 0.94;
    this.controls.zoomSpeed = 0.9;

    const key = (this.key = new THREE.DirectionalLight(0xfff1dd, 2.6));
    key.position.set(-0.45, 0.95, 0.55);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -0.42; sc.right = 0.42; sc.top = 0.42; sc.bottom = -0.42; sc.near = 0.2; sc.far = 2.4;
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.0015;
    key.shadow.radius = 3;
    this.scene.add(key, key.target);
    key.target.position.set(0, 0.08, 0);
    const rim = new THREE.DirectionalLight(0xbfd4ff, 0.9);
    rim.position.set(0.6, 0.5, -0.7);
    this.scene.add(rim, new THREE.HemisphereLight(0xdfe6ff, 0x3a2a20, 0.35));
    // A soft lamp on the camera, so close-ups and side views are never in the dark.
    const head = new THREE.DirectionalLight(0xffffff, 0.75);
    head.position.set(0.15, 0.25, 1);
    this.camera.add(head, head.target);
    head.target.position.set(0, 0, -1);
    this.scene.add(this.camera);

    this.desk = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ map: deskTexture(), roughness: 0.62, metalness: 0 }));
    this.desk.rotation.x = -Math.PI / 2;
    this.desk.receiveShadow = true;
    this.scene.add(this.desk);
    this.scene.fog = new THREE.Fog(0x191b20, 2.2, 5);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
