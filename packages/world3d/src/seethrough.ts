// See-through: a stencil-masked character silhouette records the ids of static triangles in front
// of each focus. Mesh AABBs were too coarse for canopies, eaves and small props. A one-row texture
// eases each hit root into the existing whole-object ordered-dither cutout.
import * as THREE from "three";

export const SEE_THROUGH = {
  sampleSize: 96,
  minPixels: 6,
  holdSeconds: 0.35,
  /** visibility of an occluding object */
  fadeTo: 0.13,
  /** 1/s, easing into and out of a fade */
  fadeRate: 4,
  /** bounded texture/id table for one space */
  maxOccluders: 1024,
};

export const SEE_ATTR = "seeThru";
export const SEE_NEVER = 0;
/** An unassigned fadeable root; SceneSpace replaces this with SEE_ID0 + id. */
export const SEE_OCCLUDER = 1;
export const SEE_ID0 = 2;

/** Canopy parts that share their root's occluder id; all other parts remain SEE_NEVER. */
export const CANOPIES: Record<string, { parts: RegExp; above?: number }> = {
  great_tree: { parts: /^(canopy_green|leaf_green|leaf_dark)$/, above: 3.4 },
  willow: { parts: /^(leaf_green|leaf_pale|town_willow)$/ },
  willow_small: { parts: /^(leaf_green|leaf_pale|town_willow)$/ },
  bamboo_grove: { parts: /^(leaf_green|leaf_dark)$/ },
};

export interface SeeSpec {
  tag: number;
  /** the root's world y, used by the great tree's `above` rule */
  baseY?: number;
}

const GROUND_SETS = new Set(["tiles", "landscape"]);
const FLAT = /^(road_|pavement_|manhole|drain_grate|decal_)/;

/** Classifies an asset before SceneSpace assigns fadeable roots an id. */
export function seeSpecFor(set: string | undefined, name: string): SeeSpec {
  return { tag: (set && GROUND_SETS.has(set)) || FLAT.test(name) ? SEE_NEVER : SEE_OCCLUDER };
}

function partName(mesh: THREE.Mesh): string {
  const src = mesh.userData.outline && (mesh.parent as THREE.Mesh | null)?.isMesh ? (mesh.parent as THREE.Mesh) : mesh;
  const m = src.material as THREE.Material | THREE.Material[];
  return Array.isArray(m) ? "" : m.name;
}

/** Builds the per-vertex root id for a static mesh (world-space when copied into a batch). */
export function seeAttribute(geo: THREE.BufferGeometry, mesh: THREE.Mesh, spec: SeeSpec | undefined, rootAsset: string | undefined, world: boolean): THREE.BufferAttribute {
  const n = geo.getAttribute("position").count;
  const canopy = rootAsset ? CANOPIES[rootAsset] : undefined;
  if (!canopy) return new THREE.BufferAttribute(new Float32Array(n).fill(spec?.tag ?? SEE_NEVER), 1);

  const out = new Float32Array(n).fill(SEE_NEVER);
  if (!spec || spec.tag < SEE_ID0) return new THREE.BufferAttribute(out, 1);
  if (canopy.parts.test(partName(mesh))) out.fill(spec.tag);
  else if (canopy.above !== undefined) {
    const pos = geo.getAttribute("position");
    const v = new THREE.Vector3();
    const cut = (spec.baseY ?? 0) + canopy.above;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i);
      if (!world) v.applyMatrix4(mesh.matrixWorld);
      if (v.y > cut) out[i] = spec.tag;
    }
  }
  return new THREE.BufferAttribute(out, 1);
}

const fadeData = new Float32Array(SEE_THROUGH.maxOccluders).fill(1);
export const fadeTexture = new THREE.DataTexture(fadeData, SEE_THROUGH.maxOccluders, 1, THREE.RedFormat, THREE.FloatType);
fadeTexture.minFilter = THREE.NearestFilter;
fadeTexture.magFilter = THREE.NearestFilter;
fadeTexture.generateMipmaps = false;
fadeTexture.needsUpdate = true;

/** One uniform set shared by every patched material. */
export const seeUniforms = { stFade: { value: fadeTexture } };

export const SEE_VERT_PARS = /* glsl */ `
attribute float ${SEE_ATTR};
varying float vStId;
`;

export const SEE_VERT = /* glsl */ `
  vStId = ${SEE_ATTR};
`;

export const SEE_FRAG_PARS = /* glsl */ `
uniform sampler2D stFade;
varying float vStId;
float stBayer(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 4.0));
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[i.x + i.y * 4] + 0.5) / 16.0;
}
void stSeeThrough() {
  if (vStId < 1.5) return;
  float x = (floor(vStId + 0.5) - 1.5) / ${SEE_THROUGH.maxOccluders.toFixed(1)};
  float vis = texture2D(stFade, vec2(x, 0.5)).r;
  if (vis < 0.999 && vis <= stBayer(gl_FragCoord.xy)) discard;
}
`;

export const SEE_FRAG = /* glsl */ `
  stSeeThrough();
`;

function inject(src: string, anchor: string, add: string, before = false): string {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`see-through: no "${anchor}" in the shader`);
  return before ? src.slice(0, i) + add + src.slice(i) : src.slice(0, i + anchor.length) + add + src.slice(i + anchor.length);
}

export function seeThroughCompile(shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }) {
  Object.assign(shader.uniforms, seeUniforms);
  shader.vertexShader = inject(inject(shader.vertexShader, "void main() {", SEE_VERT_PARS, true), "#include <project_vertex>", SEE_VERT);
  shader.fragmentShader = inject(inject(shader.fragmentShader, "void main() {", SEE_FRAG_PARS, true), "#include <clipping_planes_fragment>", SEE_FRAG);
}

const patched = new WeakSet<THREE.Material>();

export function isSeeThrough(m: THREE.Material): boolean {
  return patched.has(m);
}

export function patchSeeThrough<M extends THREE.Material>(m: M): M {
  if (patched.has(m) || m.transparent) return m;
  m.onBeforeCompile = seeThroughCompile as THREE.Material["onBeforeCompile"];
  m.customProgramCacheKey = () => "see-through-objects";
  markSeeThrough(m);
  return m;
}

export function markSeeThrough(m: THREE.Material) {
  const d = m as THREE.Material & { defaultAttributeValues?: Record<string, number[]> };
  d.defaultAttributeValues = { ...(d.defaultAttributeValues ?? {}), [SEE_ATTR]: [SEE_NEVER] };
  patched.add(m);
}

export interface Occluder {
  id: number;
  asset: string;
}

/** A small crop of the actual camera projection, including portrait camera offsets. */
export function silhouetteProjection(camera: THREE.PerspectiveCamera, focus: THREE.Vector3, width: number, height: number): THREE.Matrix4 {
  const centre = focus.clone().add(new THREE.Vector3(0, 1, 0)).project(camera);
  const extent = new THREE.Vector3(0.6, 1.3, 0).add(focus).project(camera);
  const extent2 = new THREE.Vector3(-0.6, 0, 0).add(focus).project(camera);
  const halfW = Math.max(24, Math.abs(extent2.x - centre.x) * width / 2 + 24);
  const halfH = Math.max(24, Math.abs(extent.y - centre.y) * height / 2 + 24);
  const sx = width / (2 * halfW);
  const sy = height / (2 * halfH);
  return new THREE.Matrix4().set(sx, 0, 0, -centre.x * sx, 0, sy, 0, -centre.y * sy, 0, 0, 1, 0, 0, 0, 0, 1).multiply(camera.projectionMatrix);
}

/** Extracts root ids from the RGB id target. Id zero in the target means untouched. */
export function idHistogram(pixels: Uint8Array): Map<number, number> {
  const counts = new Map<number, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    const encoded = pixels[i] + 256 * pixels[i + 1];
    if (encoded) counts.set(encoded - 1, (counts.get(encoded - 1) ?? 0) + 1);
  }
  return counts;
}

const idMaterial = new THREE.ShaderMaterial({
  vertexShader: `attribute float ${SEE_ATTR}; varying float vId; void main() { vId = ${SEE_ATTR}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying float vId; void main() { if (vId < 1.5) discard; float n = floor(vId - 1.0); gl_FragColor = vec4(mod(n, 256.0) / 255.0, floor(n / 256.0) / 255.0, 0.0, 1.0); }`,
  depthWrite: true,
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.EqualStencilFunc,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilZPass: THREE.KeepStencilOp,
});
const idMaterials = new Map<THREE.Side, THREE.ShaderMaterial>([[THREE.FrontSide, idMaterial]]);
function idMaterialFor(side: THREE.Side): THREE.ShaderMaterial {
  let material = idMaterials.get(side);
  if (!material) {
    material = idMaterial.clone();
    material.side = side;
    idMaterials.set(side, material);
  }
  return material;
}
const proxyMaterial = new THREE.MeshBasicMaterial({
  colorWrite: false,
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.AlwaysStencilFunc,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilZPass: THREE.ReplaceStencilOp,
});

/** One small render per focus. Static meshes reuse the already batched geometry. */
interface DetectionPose {
  focus: THREE.Vector3;
  camera: THREE.Vector3;
  rotation: THREE.Quaternion;
  projection: number[];
}

interface PendingRead {
  buffer: WebGLBuffer;
  fence: WebGLSync;
  pixels: Uint8Array;
  generation: number;
}

export class SeeThroughDetector {
  private readonly target = new THREE.WebGLRenderTarget(SEE_THROUGH.sampleSize, SEE_THROUGH.sampleSize, { stencilBuffer: true, depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  private readonly latest: Map<number, number>[] = [];
  private readonly pending = new Map<number, PendingRead>();
  private readonly poses = new Map<number, DetectionPose>();
  private readonly gl?: WebGL2RenderingContext;
  private generation = 0;
  lastSampleMs = 0;
  lastReadMs = 0;
  private pboFailed = false;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera();
  private readonly proxy = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.1, 4, 8), proxyMaterial);
  private source?: THREE.Scene;
  private readonly size = new THREE.Vector2();

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    // WebGL2 only: a WebGL1 context has no fences or pixel-pack buffers, so it keeps the sync read.
    const gl = renderer.getContext?.() as Partial<WebGL2RenderingContext> | undefined;
    if (typeof gl?.fenceSync === "function" && typeof gl.clientWaitSync === "function" && typeof gl.getBufferSubData === "function") this.gl = gl as WebGL2RenderingContext;
    this.target.viewport.set(0, 0, SEE_THROUGH.sampleSize, SEE_THROUGH.sampleSize);
    this.target.scissor.set(0, 0, SEE_THROUGH.sampleSize, SEE_THROUGH.sampleSize);
    this.target.scissorTest = true;
    this.proxy.renderOrder = -1;
    this.scene.add(this.proxy);
  }

  /** Rebuild on space change; source geometry and batches are shared, never split. */
  private bind(source: THREE.Scene) {
    if (this.source === source) return;
    this.source = source;
    this.invalidate();
    for (const child of [...this.scene.children]) if (child !== this.proxy) this.scene.remove(child);
    source.updateMatrixWorld(true);
    source.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.outline || !mesh.geometry.hasAttribute(SEE_ATTR)) return;
      const tags = mesh.geometry.getAttribute(SEE_ATTR).array;
      if (!Array.from(tags).some((tag) => tag >= SEE_ID0)) return;
      const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const copy = new THREE.Mesh(mesh.geometry, idMaterialFor(sourceMaterial.side));
      copy.matrix.copy(mesh.matrixWorld);
      copy.matrixAutoUpdate = false;
      copy.frustumCulled = mesh.frustumCulled;
      this.scene.add(copy);
    });
  }

  /** Drop decisions from the previous space or a teleport, including in-flight GPU reads. */
  invalidate() {
    this.generation++;
    this.latest.length = 0;
    this.poses.clear();
    for (const read of this.pending.values()) this.release(read);
    this.pending.clear();
  }

  invalidateSlot(slot: number) {
    this.latest[slot] = new Map();
    this.poses.delete(slot);
    const read = this.pending.get(slot);
    if (read) this.release(read);
    this.pending.delete(slot);
  }

  private release(read: PendingRead) {
    this.gl?.deleteSync(read.fence);
    this.gl?.deleteBuffer(read.buffer);
  }

  /** Polls without waiting for the GPU; call once on every animation frame. */
  poll() {
    const gl = this.gl;
    if (!gl) return;
    for (const [slot, read] of this.pending) {
      const started = performance.now();
      const state = gl.clientWaitSync(read.fence, 0, 0);
      if (state === gl.TIMEOUT_EXPIRED) continue;
      this.pending.delete(slot);
      try {
        if (state === gl.WAIT_FAILED) {
          this.poses.delete(slot);
          this.pboFailed = true;
          continue;
        }
        const previous = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer | null;
        try {
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, read.buffer);
          gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, read.pixels);
        } finally {
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, previous);
        }
        if (read.generation === this.generation) this.latest[slot] = idHistogram(read.pixels);
      } finally {
        this.release(read);
        this.lastReadMs = performance.now() - started;
      }
    }
  }

  counts(slot: number): ReadonlyMap<number, number> {
    return this.latest[slot] ?? new Map();
  }

  private moved(slot: number, camera: THREE.PerspectiveCamera, focus: THREE.Vector3): boolean {
    const pose = this.poses.get(slot);
    if (!pose) return true;
    if (pose.focus.distanceToSquared(focus) > 1e-4 || pose.camera.distanceToSquared(camera.position) > 1e-4) return true;
    if (pose.rotation.angleTo(camera.quaternion) > 1e-3) return true;
    return pose.projection.some((v, i) => Math.abs(v - camera.projectionMatrix.elements[i]) > 1e-5);
  }

  private remember(slot: number, camera: THREE.PerspectiveCamera, focus: THREE.Vector3) {
    this.poses.set(slot, { focus: focus.clone(), camera: camera.position.clone(), rotation: camera.quaternion.clone(), projection: [...camera.projectionMatrix.elements] });
  }

  sample(source: THREE.Scene, camera: THREE.PerspectiveCamera, focus: THREE.Vector3, slot = 0): Map<number, number> {
    this.bind(source);
    if (this.pending.has(slot) || !this.moved(slot, camera, focus)) return this.latest[slot] ?? new Map();
    const started = performance.now();
    this.renderer.getDrawingBufferSize(this.size);
    camera.updateMatrixWorld();
    this.camera.copy(camera);
    this.camera.projectionMatrix.copy(silhouetteProjection(camera, focus, this.size.x, this.size.y));
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.proxy.position.copy(focus).add(new THREE.Vector3(0, 1, 0));
    const old = this.renderer.getRenderTarget();
    const viewport = this.renderer.getViewport(new THREE.Vector4());
    const scissor = this.renderer.getScissor(new THREE.Vector4());
    const scissorTest = this.renderer.getScissorTest();
    const clearColor = this.renderer.getClearColor(new THREE.Color());
    const clearAlpha = this.renderer.getClearAlpha();
    const autoClear = this.renderer.autoClear;
    try {
      this.renderer.autoClear = false;
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setRenderTarget(this.target);
      this.renderer.clear(true, true, true);
      this.renderer.render(this.scene, this.camera);
      const pixels = new Uint8Array(SEE_THROUGH.sampleSize ** 2 * 4);
      const gl = this.pboFailed ? undefined : this.gl;
      const buffer = gl?.createBuffer();
      let queued = false;
      if (gl && buffer) {
        const previous = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer | null;
        let fence: WebGLSync | null = null;
        try {
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
          gl.bufferData(gl.PIXEL_PACK_BUFFER, pixels.byteLength, gl.STREAM_READ);
          gl.readPixels(0, 0, SEE_THROUGH.sampleSize, SEE_THROUGH.sampleSize, gl.RGBA, gl.UNSIGNED_BYTE, 0);
          fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
        } catch (error) {
          gl.deleteBuffer(buffer);
          throw error;
        } finally {
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER, previous);
        }
        if (fence) {
          this.pending.set(slot, { buffer, fence, pixels, generation: this.generation });
          queued = true;
        }
        else gl.deleteBuffer(buffer);
      }
      if (!queued) {
        this.renderer.readRenderTargetPixels(this.target, 0, 0, SEE_THROUGH.sampleSize, SEE_THROUGH.sampleSize, pixels);
        this.latest[slot] = idHistogram(pixels);
        this.lastReadMs = performance.now() - started;
      }
      this.remember(slot, camera, focus);
    } finally {
      this.renderer.setRenderTarget(null);
      if (old) this.renderer.setRenderTarget(old);
      this.renderer.setViewport(viewport);
      this.renderer.setScissor(scissor);
      this.renderer.setScissorTest(scissorTest);
      this.renderer.setClearColor(clearColor, clearAlpha);
      this.renderer.autoClear = autoClear;
    }
    this.lastSampleMs = performance.now() - started;
    return this.latest[slot] ?? new Map();
  }
}

/** Drives the shared fade texture from pixel counts. */
export class SeeThroughControl {
  on = true;
  readonly vis = new Float32Array(SEE_THROUGH.maxOccluders).fill(1);
  private readonly want = new Uint8Array(SEE_THROUGH.maxOccluders);
  private readonly hold = new Float32Array(SEE_THROUGH.maxOccluders);

  reset() {
    this.vis.fill(1);
    this.want.fill(0);
    this.hold.fill(0);
    fadeData.fill(1);
    fadeTexture.needsUpdate = true;
  }

  update(dt: number, focus: readonly (THREE.Vector3 | null | undefined)[], occluders: readonly Occluder[], counts: ReadonlyMap<number, number> = new Map(), active = true) {
    if (occluders.length > SEE_THROUGH.maxOccluders) throw new Error(`see-through: ${occluders.length} occluders exceeds ${SEE_THROUGH.maxOccluders}`);
    const enabled = this.on && active;
    this.want.fill(0);
    for (const o of occluders) {
      if (o.id < 0 || o.id >= SEE_THROUGH.maxOccluders) throw new Error(`see-through: invalid occluder id ${o.id}`);
      const hit = enabled && (counts.get(o.id) ?? 0) >= SEE_THROUGH.minPixels;
      this.hold[o.id] = !enabled ? 0 : hit ? SEE_THROUGH.holdSeconds : Math.max(0, this.hold[o.id] - dt);
      if (hit || this.hold[o.id] > 0) this.want[o.id] = 1;
    }
    const k = dt > 0 ? 1 - Math.exp(-SEE_THROUGH.fadeRate * dt) : 1;
    for (let i = 0; i < this.vis.length; i++) {
      const target = this.want[i] ? SEE_THROUGH.fadeTo : 1;
      this.vis[i] += (target - this.vis[i]) * k;
      if (Math.abs(target - this.vis[i]) < 1e-3) this.vis[i] = target;
      fadeData[i] = this.vis[i];
    }
    fadeTexture.needsUpdate = true;
  }

  status(occluders: readonly Occluder[] = []) {
    return {
      on: this.on,
      faded: occluders.filter((o) => this.vis[o.id] < 0.999).map((o) => ({ id: o.id, asset: o.asset, vis: +this.vis[o.id].toFixed(3) })),
    };
  }
}
