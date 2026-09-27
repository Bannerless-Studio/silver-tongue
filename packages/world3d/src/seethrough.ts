// See-through: every static object genuinely between the fixed camera and a focus (the player, the
// NPC they talk to, or a barking figure) fades as one object. CPU segment/mesh-AABB tests select occluders and
// a one-row texture carries their eased visibility into the shared toon and outline shaders. The
// shader uses an ordered-dither cutout: no blending, transparency sorting, un-batching or extra
// draw calls. Ground and decks are never tagged. Canopy assets keep their existing part filter, so
// leaves (and the great tree's high branches) fade while trunks stay opaque; standing in a canopy
// footprint remains an additional trigger.
import * as THREE from "three";

export const SEE_THROUGH = {
  /** expand the camera-to-focus segment by this much, so near-edge blockers count */
  radius: 0.6,
  /** stop this far in front of the focus, so nearby and underfoot geometry does not count */
  margin: 1.2,
  /** only geometry above this height over a focus's feet can occlude */
  lift: 1.3,
  /** the focus point above the feet (the camera's aim height, camera.ts) */
  aimHeight: 1.0,
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

export interface CanopyFootprint {
  min: [number, number];
  max: [number, number];
}

export interface OccluderBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Occluder {
  id: number;
  asset: string;
  /** union bounds, retained for the root's footprint/inside test */
  min: [number, number, number];
  max: [number, number, number];
  /** one tight world-space proxy per tagged source mesh */
  boxes: OccluderBox[];
  canopyFootprint?: CanopyFootprint;
}

export function underCanopy(c: CanopyFootprint, x: number, z: number): boolean {
  return x >= c.min[0] && x <= c.max[0] && z >= c.min[1] && z <= c.max[1];
}

/** Segment against an AABB expanded in XZ by `radius`; t is deliberately clamped to 0..1. */
export function segmentIntersectsAabb(from: THREE.Vector3, to: THREE.Vector3, min: readonly number[], max: readonly number[], radius = SEE_THROUGH.radius): boolean {
  let lo = 0;
  let hi = 1;
  for (let axis = 0; axis < 3; axis++) {
    const a = from.getComponent(axis);
    const d = to.getComponent(axis) - a;
    const pad = axis === 1 ? 0 : radius;
    const mn = min[axis] - pad;
    const mx = max[axis] + pad;
    if (Math.abs(d) < 1e-9) {
      if (a < mn || a > mx) return false;
      continue;
    }
    const t0 = (mn - a) / d;
    const t1 = (mx - a) / d;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
    if (lo > hi) return false;
  }
  return true;
}

const aimPoint = new THREE.Vector3();
const clippedPoint = new THREE.Vector3();
const clippedMin: [number, number, number] = [0, 0, 0];

function footprintContains(min: readonly number[], max: readonly number[], focus: THREE.Vector3): boolean {
  return focus.x >= min[0] && focus.x <= max[0] && focus.z >= min[2] && focus.z <= max[2];
}

/** Whether a tagged mesh of this root genuinely blocks this focus. */
export function occludes(o: Occluder, camera: THREE.Vector3, focus: THREE.Vector3): boolean {
  if (o.canopyFootprint && underCanopy(o.canopyFootprint, focus.x, focus.z)) return true;
  aimPoint.set(focus.x, focus.y + SEE_THROUGH.aimHeight, focus.z);
  clippedPoint.subVectors(aimPoint, camera);
  const distance = clippedPoint.length();
  if (distance <= SEE_THROUGH.margin) return false;
  clippedPoint.multiplyScalar((distance - SEE_THROUGH.margin) / distance).add(camera);
  const threshold = focus.y + SEE_THROUGH.lift;
  const insideRoot = !o.canopyFootprint && o.min[1] <= focus.y && footprintContains(o.min, o.max, focus);
  return o.boxes.some((box) => {
    if (box.max[1] <= threshold) return false;
    // Floors, decks, and other geometry occupied by the focus cannot hide that focus. Other mesh
    // proxies in the same root (a separate roof or front wall) remain eligible.
    if (insideRoot && box.min[1] <= focus.y && footprintContains(box.min, box.max, focus)) return false;
    clippedMin[0] = box.min[0];
    clippedMin[1] = Math.max(box.min[1], threshold);
    clippedMin[2] = box.min[2];
    return segmentIntersectsAabb(camera, clippedPoint, clippedMin, box.max);
  });
}

/** Drives the shared fade texture from the current space's precomputed root bounds. */
export class SeeThroughControl {
  on = true;
  readonly vis = new Float32Array(SEE_THROUGH.maxOccluders).fill(1);
  private readonly want = new Uint8Array(SEE_THROUGH.maxOccluders);
  private readonly cameraWorld = new THREE.Vector3();

  update(dt: number, camera: THREE.Camera, focus: readonly (THREE.Vector3 | null | undefined)[], occluders: readonly Occluder[], active = true) {
    if (occluders.length > SEE_THROUGH.maxOccluders) throw new Error(`see-through: ${occluders.length} occluders exceeds ${SEE_THROUGH.maxOccluders}`);
    camera.updateMatrixWorld();
    const want = this.want;
    want.fill(0);
    camera.getWorldPosition(this.cameraWorld);
    if (this.on && active)
      for (const o of occluders) {
        if (o.id < 0 || o.id >= SEE_THROUGH.maxOccluders) throw new Error(`see-through: invalid occluder id ${o.id}`);
        if (focus.some((p) => p && occludes(o, this.cameraWorld, p))) want[o.id] = 1;
      }
    const k = dt > 0 ? 1 - Math.exp(-SEE_THROUGH.fadeRate * dt) : 1;
    for (let i = 0; i < this.vis.length; i++) {
      const target = want[i] ? SEE_THROUGH.fadeTo : 1;
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
