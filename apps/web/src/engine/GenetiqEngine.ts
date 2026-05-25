import {
  ArcRotateCamera,
  Animation,
  Color3,
  Color4,
  CubicEase,
  EasingFunction,
  Engine,
  GlowLayer,
  HemisphericLight,
  Matrix,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  PointLight,
  Quaternion,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  WebGPUEngine,
  type AbstractEngine,
  type PointerInfo,
} from "@babylonjs/core";
import type { Chromosome, Gene, Genome, RGB } from "@genetiq/core";
import { NUCLEOTIDE_COLORS, allGenes, geneVisual } from "@genetiq/core";

export interface CardScreenInfo {
  x: number;
  y: number;
  visible: boolean;
}

export interface EngineCallbacks {
  onPick?: (geneId: string | null) => void;
  onCard?: (info: CardScreenInfo) => void;
  onReady?: (backend: "webgpu" | "webgl2") => void;
}

interface SparseGene {
  gene: Gene;
  mesh: Mesh;
  mat: StandardMaterial;
  baseColor: Color3;
  baseScale: number;
  targetColor?: Color3;
  targetScale?: number;
  fadeOut?: boolean;
}

interface HelixParams {
  node: TransformNode;
  height: number;
  turns: number;
  phase: number;
  steps: number;
}

const HELIX_R = 0.72;
const DENSE_THRESHOLD = 350;
const DIM = 0.07;

// Oblivion / GMunk palette — restrained cyan-white holographic on black.
const C_BACKBONE_A: RGB = [0.45, 0.85, 1.0];
const C_BACKBONE_B: RGB = [0.7, 0.95, 1.0];
const C_RUNG: RGB = [0.55, 0.8, 0.95];
const C_HALO: RGB = [0.7, 0.97, 1.0];
const C_RETICLE: RGB = [0.3, 0.7, 0.85];
const BASE_COLORS: RGB[] = [
  NUCLEOTIDE_COLORS.A!,
  NUCLEOTIDE_COLORS.T!,
  NUCLEOTIDE_COLORS.G!,
  NUCLEOTIDE_COLORS.C!,
];

function toColor3(rgb: RGB): Color3 {
  return new Color3(rgb[0], rgb[1], rgb[2]);
}
function lerpColor(a: Color3, b: Color3, t: number): Color3 {
  return new Color3(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function orientYTo(dir: Vector3): Quaternion {
  const up = Vector3.Up();
  const axis = Vector3.Cross(up, dir);
  const angle = Math.acos(clamp(Vector3.Dot(up, dir), -1, 1));
  return axis.lengthSquared() < 1e-6 ? Quaternion.Identity() : Quaternion.RotationAxis(axis.normalize(), angle);
}

/**
 * Genetiq rendering engine, styled after minimal holographic film HUDs.
 * Chromosomes are cyan-white double helices; the focused one dims the rest and
 * reveals true two-tone base-pair rungs (A·T / G·C). Small genomes use
 * individually-lit genes (morphable); large ones use thin instances (LOD).
 */
export class GenetiqEngine {
  private engine!: AbstractEngine;
  private scene!: Scene;
  private camera!: ArcRotateCamera;
  private root!: TransformNode;
  private glow!: GlowLayer;
  private geneTemplate!: Mesh;
  private halo!: Mesh;

  private backboneMatA!: StandardMaterial;
  private backboneMatB!: StandardMaterial;
  private rungMat!: StandardMaterial;
  private denseGeneMat!: StandardMaterial;
  private reticleMat!: StandardMaterial;
  private pairMat!: StandardMaterial;
  private beadMat!: StandardMaterial;

  private sparseGenes: SparseGene[] = [];
  private denseMeshes: Mesh[] = [];
  private structureMeshes: Mesh[] = [];
  private detailMeshes: Mesh[] = [];
  private chromosomeNodes = new Map<string, TransformNode>();
  private chromosomeHelix = new Map<string, HelixParams>();
  private geneLookup = new Map<string, { node: TransformNode; localPos: Vector3; chrId: string }>();

  private dense = false;
  private focusedChrId: string | null = null;
  private selectedGeneId: string | null = null;
  private idleSpin = true;
  private elapsed = 0;
  private ringRadius = 12;
  private morphT = 0;
  private morphActive = false;
  private callbacks: EngineCallbacks = {};
  private pointerDown: { x: number; y: number } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  async init(callbacks: EngineCallbacks = {}): Promise<void> {
    this.callbacks = callbacks;
    let backend: "webgpu" | "webgl2" = "webgl2";
    if (await WebGPUEngine.IsSupportedAsync) {
      const webgpu = new WebGPUEngine(this.canvas, { antialias: true, stencil: true });
      await webgpu.initAsync();
      this.engine = webgpu;
      backend = "webgpu";
    } else {
      this.engine = new Engine(this.canvas, true, { stencil: true, preserveDrawingBuffer: true });
    }
    this.buildScene();
    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", this.handleResize);
    this.callbacks.onReady?.(backend);
  }

  private buildScene(): void {
    const scene = new Scene(this.engine);
    scene.clearColor = new Color4(0.015, 0.02, 0.03, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.015, 0.02, 0.03);
    scene.fogDensity = 0.0095;
    this.scene = scene;

    const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.25, 44, Vector3.Zero(), scene);
    camera.attachControl(this.canvas, true);
    camera.lowerRadiusLimit = 3;
    camera.upperRadiusLimit = 220;
    camera.wheelDeltaPercentage = 0.02;
    camera.pinchDeltaPercentage = 0.02;
    camera.minZ = 0.1;
    this.camera = camera;

    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), scene);
    hemi.intensity = 0.4;
    hemi.groundColor = new Color3(0.03, 0.04, 0.06);
    const key = new PointLight("key", new Vector3(18, 26, 18), scene);
    key.intensity = 0.35;

    this.glow = new GlowLayer("glow", scene, { blurKernelSize: 48 });
    this.glow.intensity = 0.85;

    this.root = new TransformNode("genomeRoot", scene);

    this.backboneMatA = this.emissiveMat("bbA", C_BACKBONE_A, 0.7);
    this.backboneMatB = this.emissiveMat("bbB", C_BACKBONE_B, 0.7);
    this.rungMat = this.emissiveMat("rung", C_RUNG, 0.3);
    this.reticleMat = this.emissiveMat("reticle", C_RETICLE, 0.7);
    this.reticleMat.alpha = 0.4;

    this.denseGeneMat = new StandardMaterial("denseGene", scene);
    this.denseGeneMat.disableLighting = true;
    this.denseGeneMat.emissiveColor = new Color3(1, 1, 1);

    this.pairMat = new StandardMaterial("pair", scene);
    this.pairMat.disableLighting = true;
    this.pairMat.emissiveColor = new Color3(1, 1, 1);

    this.beadMat = this.emissiveMat("bead", C_BACKBONE_B, 0.8);

    const tpl = MeshBuilder.CreateSphere("geneTpl", { diameter: 1, segments: 12 }, scene);
    tpl.setEnabled(false);
    tpl.isPickable = false;
    this.geneTemplate = tpl;

    const halo = MeshBuilder.CreateTorus("halo", { diameter: 1.7, thickness: 0.05, tessellation: 48 }, scene);
    halo.material = this.emissiveMat("haloMat", C_HALO, 1.5);
    halo.billboardMode = Mesh.BILLBOARDMODE_ALL;
    halo.isPickable = false;
    halo.setEnabled(false);
    this.halo = halo;

    scene.onPointerObservable.add((pi) => this.handlePointer(pi));
    scene.onBeforeRenderObservable.add(() => this.update());
  }

  private emissiveMat(name: string, color: RGB, emissive: number): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    const c = toColor3(color);
    m.diffuseColor = c.scale(0.25);
    m.emissiveColor = c.scale(emissive);
    m.specularColor = new Color3(0.08, 0.1, 0.12);
    return m;
  }

  setData(
    genome: Genome,
    opts: { mutatedGeneIds?: Set<string>; selectedGeneId?: string | null; resetCamera?: boolean } = {},
  ): void {
    this.clearGenome();
    this.morphActive = false;
    this.morphT = 0;
    this.selectedGeneId = opts.selectedGeneId ?? null;
    const mutated = opts.mutatedGeneIds ?? new Set<string>();

    const total = genome.chromosomes.reduce((n, c) => n + c.genes.length, 0);
    this.dense = total > DENSE_THRESHOLD;

    const chromosomes = genome.chromosomes;
    const count = Math.max(1, chromosomes.length);
    this.ringRadius = count === 1 ? 0 : Math.max(9, count * 1.6);

    chromosomes.forEach((chr, ci) => {
      const angle = (ci / count) * Math.PI * 2;
      const node = new TransformNode(`chr-${chr.id}`, this.scene);
      node.parent = this.root;
      node.position = new Vector3(Math.cos(angle) * this.ringRadius, 0, Math.sin(angle) * this.ringRadius);
      node.rotation.y = -angle;
      this.chromosomeNodes.set(chr.id, node);
      this.buildHelix(node, chr, ci, mutated);
    });

    this.buildReticle();
    this.setSelected(this.selectedGeneId);

    if (opts.resetCamera) {
      this.focusOverview();
    } else {
      const sel = this.selectedGeneId ? this.geneLookup.get(this.selectedGeneId) : null;
      this.setFocusChromosome(sel ? sel.chrId : null);
    }
  }

  private buildReticle(): void {
    const r = this.ringRadius || 10;
    const mat = this.reticleMat;
    for (const d of [r * 2 + 6, r * 2 + 13, r * 2 + 22]) {
      const ring = MeshBuilder.CreateTorus(`reticle-${d}`, { diameter: d, thickness: 0.03, tessellation: 120 }, this.scene);
      ring.parent = this.root;
      ring.position.y = -8;
      ring.material = mat;
      ring.isPickable = false;
      this.structureMeshes.push(ring);
    }
  }

  private helixPoint(p: HelixParams, f: number, angleOffset = 0): Vector3 {
    const t = f * p.turns * Math.PI * 2 + p.phase + angleOffset;
    const y = -p.height / 2 + f * p.height;
    return new Vector3(Math.cos(t) * HELIX_R, y, Math.sin(t) * HELIX_R);
  }

  private buildHelix(node: TransformNode, chr: Chromosome, ci: number, mutated: Set<string>): void {
    const height = clamp(7 + (Math.log10(Math.max(10, chr.length)) - 7) * 4.5, 6, 14);
    const turns = Math.max(2.5, height / 2.0);
    const steps = clamp(Math.round(turns * 10), 24, 120);
    const phase = ci * 0.7;
    const params: HelixParams = { node, height, turns, phase, steps };
    this.chromosomeHelix.set(chr.id, params);

    const pathA: Vector3[] = [];
    const pathB: Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      pathA.push(this.helixPoint(params, i / steps, 0));
      pathB.push(this.helixPoint(params, i / steps, Math.PI));
    }

    const tubeA = MeshBuilder.CreateTube(`bbA-${chr.id}`, { path: pathA, radius: 0.045, tessellation: 8, cap: Mesh.CAP_ALL }, this.scene);
    tubeA.parent = node;
    tubeA.isPickable = false;
    tubeA.material = this.backboneMatA;
    const tubeB = MeshBuilder.CreateTube(`bbB-${chr.id}`, { path: pathB, radius: 0.045, tessellation: 8, cap: Mesh.CAP_ALL }, this.scene);
    tubeB.parent = node;
    tubeB.isPickable = false;
    tubeB.material = this.backboneMatB;
    this.structureMeshes.push(tubeA, tubeB);

    // Simple base-pair rungs (low-detail). Detailed two-tone rungs appear on focus.
    const rungBase = MeshBuilder.CreateCylinder(`rungs-${chr.id}`, { height: 1, diameter: 1, tessellation: 6 }, this.scene);
    rungBase.parent = node;
    rungBase.isPickable = false;
    rungBase.material = this.rungMat;
    const matrices = new Float32Array((steps + 1) * 16);
    const rungColors = new Float32Array((steps + 1) * 4);
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const t = f * turns * Math.PI * 2 + phase;
      const y = -height / 2 + f * height;
      const dir = new Vector3(Math.cos(t), 0, Math.sin(t));
      Matrix.Compose(new Vector3(0.03, HELIX_R * 2, 0.03), orientYTo(dir), new Vector3(0, y, 0)).copyToArray(matrices, i * 16);
      const c = C_RUNG;
      rungColors[i * 4] = c[0];
      rungColors[i * 4 + 1] = c[1];
      rungColors[i * 4 + 2] = c[2];
      rungColors[i * 4 + 3] = 1;
    }

    const length = Math.max(1, chr.length);
    const placements = chr.genes.map((gene) => {
      const mid = (gene.start + gene.end) / 2;
      const f = clamp(mid / length, 0, 1);
      const side = gene.strand === "-" ? Math.PI : 0;
      const pos = this.helixPoint(params, f, side);
      const v = geneVisual(gene, { mutated: mutated.has(gene.id) });
      const ri = clamp(Math.round(f * steps), 0, steps);
      rungColors[ri * 4] = clamp(v.color[0] * 1.2, 0, 1);
      rungColors[ri * 4 + 1] = clamp(v.color[1] * 1.2, 0, 1);
      rungColors[ri * 4 + 2] = clamp(v.color[2] * 1.2, 0, 1);
      this.geneLookup.set(gene.id, { node, localPos: pos, chrId: chr.id });
      return { gene, pos, v };
    });
    rungBase.thinInstanceSetBuffer("matrix", matrices, 16, true);
    rungBase.thinInstanceSetBuffer("color", rungColors, 4, true);
    this.structureMeshes.push(rungBase);

    if (this.dense) this.buildDenseGenes(node, chr, placements);
    else for (const p of placements) this.buildSparseGene(node, p.gene, p.pos, p.v);
  }

  private buildSparseGene(node: TransformNode, gene: Gene, pos: Vector3, v: ReturnType<typeof geneVisual>): void {
    const mesh = this.geneTemplate.clone(`gene-${gene.id}`);
    mesh.setEnabled(true);
    mesh.parent = node;
    mesh.position = pos;
    const scale = gene.deleted ? 0.16 : 0.26 + v.size * 0.36;
    mesh.scaling.setAll(scale);
    mesh.isPickable = !gene.deleted;
    mesh.metadata = { geneId: gene.id };

    const color = toColor3(v.color);
    const mat = new StandardMaterial(`geneMat-${gene.id}`, this.scene);
    mat.diffuseColor = color.scale(0.4);
    mat.emissiveColor = color.scale(0.35 + v.emissive);
    mat.specularColor = new Color3(0.2, 0.2, 0.25);
    if (gene.deleted) mat.alpha = 0.4;
    mesh.material = mat;

    this.sparseGenes.push({ gene, mesh, mat, baseColor: mat.emissiveColor.clone(), baseScale: scale });
  }

  private buildDenseGenes(node: TransformNode, chr: Chromosome, placements: Array<{ gene: Gene; pos: Vector3; v: ReturnType<typeof geneVisual> }>): void {
    const n = placements.length;
    const matrices = new Float32Array(n * 16);
    const colors = new Float32Array(n * 4);
    const geneIds: string[] = [];
    const ident = Quaternion.Identity();
    placements.forEach((p, i) => {
      const s = p.gene.deleted ? 0.1 : 0.14 + p.v.size * 0.16;
      Matrix.Compose(new Vector3(s, s, s), ident, p.pos).copyToArray(matrices, i * 16);
      colors[i * 4] = p.v.color[0];
      colors[i * 4 + 1] = p.v.color[1];
      colors[i * 4 + 2] = p.v.color[2];
      colors[i * 4 + 3] = p.gene.deleted ? 0.4 : 1;
      geneIds.push(p.gene.id);
    });
    const base = this.geneTemplate.clone(`genes-${chr.id}`);
    base.setEnabled(true);
    base.parent = node;
    base.isPickable = true;
    base.thinInstanceEnablePicking = true;
    base.material = this.denseGeneMat;
    base.metadata = { geneIds };
    base.thinInstanceSetBuffer("matrix", matrices, 16, true);
    base.thinInstanceSetBuffer("color", colors, 4, true);
    this.glow.addExcludedMesh(base);
    this.denseMeshes.push(base);
  }

  /** Reveal true two-tone (A·T / G·C) base-pair rungs + backbone beads on a chromosome. */
  private enhanceChromosome(chromosomeId: string): void {
    const p = this.chromosomeHelix.get(chromosomeId);
    if (!p) return;
    const detailSteps = Math.min(240, p.steps * 2);

    const halfA = MeshBuilder.CreateCylinder(`detA-${chromosomeId}`, { height: 1, diameter: 1, tessellation: 6 }, this.scene);
    const halfB = halfA.clone(`detB-${chromosomeId}`);
    const beads = this.geneTemplate.clone(`beads-${chromosomeId}`);
    beads.setEnabled(true);
    for (const m of [halfA, halfB]) {
      m.parent = p.node;
      m.isPickable = false;
      m.material = this.pairMat;
      this.glow.addExcludedMesh(m);
    }
    beads.parent = p.node;
    beads.isPickable = false;
    beads.material = this.beadMat;

    const mA = new Float32Array((detailSteps + 1) * 16);
    const mB = new Float32Array((detailSteps + 1) * 16);
    const cA = new Float32Array((detailSteps + 1) * 4);
    const cB = new Float32Array((detailSteps + 1) * 4);
    const beadM = new Float32Array((detailSteps + 1) * 2 * 16);
    const ident = Quaternion.Identity();

    for (let i = 0; i <= detailSteps; i++) {
      const f = i / detailSteps;
      const t = f * p.turns * Math.PI * 2 + p.phase;
      const y = -p.height / 2 + f * p.height;
      const dir = new Vector3(Math.cos(t), 0, Math.sin(t));
      const q = orientYTo(dir);
      const half = new Vector3(0.035, HELIX_R, 0.035);
      Matrix.Compose(half, q, dir.scale(HELIX_R / 2).add(new Vector3(0, y, 0))).copyToArray(mA, i * 16);
      Matrix.Compose(half, q, dir.scale(-HELIX_R / 2).add(new Vector3(0, y, 0))).copyToArray(mB, i * 16);

      const baseIdx = ((Math.imul(i + 1, 2654435761) >>> 0) % 4);
      const compIdx = baseIdx ^ 1;
      const bc = BASE_COLORS[baseIdx]!;
      const cc = BASE_COLORS[compIdx]!;
      cA[i * 4] = bc[0]; cA[i * 4 + 1] = bc[1]; cA[i * 4 + 2] = bc[2]; cA[i * 4 + 3] = 1;
      cB[i * 4] = cc[0]; cB[i * 4 + 1] = cc[1]; cB[i * 4 + 2] = cc[2]; cB[i * 4 + 3] = 1;

      const bead = new Vector3(0.09, 0.09, 0.09);
      Matrix.Compose(bead, ident, dir.scale(HELIX_R).add(new Vector3(0, y, 0))).copyToArray(beadM, i * 2 * 16);
      Matrix.Compose(bead, ident, dir.scale(-HELIX_R).add(new Vector3(0, y, 0))).copyToArray(beadM, (i * 2 + 1) * 16);
    }

    halfA.thinInstanceSetBuffer("matrix", mA, 16, true);
    halfA.thinInstanceSetBuffer("color", cA, 4, true);
    halfB.thinInstanceSetBuffer("matrix", mB, 16, true);
    halfB.thinInstanceSetBuffer("color", cB, 4, true);
    beads.thinInstanceSetBuffer("matrix", beadM, 16, true);

    this.detailMeshes.push(halfA, halfB, beads);
  }

  private clearDetail(): void {
    for (const m of this.detailMeshes) m.dispose();
    this.detailMeshes = [];
  }

  private setFocusChromosome(chromosomeId: string | null): void {
    this.focusedChrId = chromosomeId;
    for (const [id, node] of this.chromosomeNodes) {
      const vis = chromosomeId === null || id === chromosomeId ? 1 : DIM;
      for (const m of node.getChildMeshes()) m.visibility = vis;
    }
    this.clearDetail();
    if (chromosomeId) this.enhanceChromosome(chromosomeId);
    this.halo.visibility = 1;
  }

  setSelected(geneId: string | null): void {
    this.selectedGeneId = geneId;
    this.idleSpin = geneId === null;
    const entry = geneId ? this.geneLookup.get(geneId) : null;
    if (entry) {
      this.halo.parent = entry.node;
      this.halo.position = entry.localPos.clone();
      this.halo.setEnabled(true);
    } else {
      this.halo.setEnabled(false);
      this.halo.parent = null;
    }
  }

  prepareMorph(target: Genome): void {
    if (this.dense) return;
    const bySymbol = new Map<string, Gene>();
    for (const g of allGenes(target)) bySymbol.set(g.symbol.toUpperCase(), g);
    for (const node of this.sparseGenes) {
      const match = bySymbol.get(node.gene.symbol.toUpperCase());
      if (match) {
        const v = geneVisual(match);
        node.targetColor = toColor3(v.color).scale(0.35 + v.emissive);
        node.targetScale = 0.26 + v.size * 0.36;
        node.fadeOut = false;
      } else {
        node.targetColor = node.baseColor.clone();
        node.targetScale = node.baseScale;
        node.fadeOut = true;
      }
    }
    this.morphActive = true;
  }
  setMorphT(t: number): void {
    this.morphT = clamp(t, 0, 1);
  }
  clearMorph(): void {
    this.morphActive = false;
    this.morphT = 0;
    for (const node of this.sparseGenes) {
      node.targetColor = undefined;
      node.targetScale = undefined;
      node.fadeOut = false;
    }
  }

  focusOverview(): void {
    this.setFocusChromosome(null);
    this.animateCamera(Vector3.Zero(), this.ringRadius * 2.3 + 14, Math.PI / 2.25, this.camera.alpha);
    this.idleSpin = true;
  }
  focusGene(geneId: string): void {
    const entry = this.geneLookup.get(geneId);
    if (!entry) return;
    this.idleSpin = false;
    this.setFocusChromosome(entry.chrId);
    const pos = Vector3.TransformCoordinates(entry.localPos, entry.node.getWorldMatrix());
    this.animateCamera(pos, 5, Math.PI / 2.5);
  }
  focusChromosome(chromosomeId: string): void {
    const node = this.chromosomeNodes.get(chromosomeId);
    if (!node) return;
    this.idleSpin = false;
    this.setFocusChromosome(chromosomeId);
    this.animateCamera(node.getAbsolutePosition().clone(), 12, Math.PI / 2.4);
  }

  private worldPosOf(geneId: string): Vector3 | null {
    const entry = this.geneLookup.get(geneId);
    if (!entry) return null;
    return Vector3.TransformCoordinates(entry.localPos, entry.node.getWorldMatrix());
  }

  private animateCamera(target: Vector3, radius: number, beta?: number, alpha?: number): void {
    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    const fps = 60;
    const frames = 50;
    Animation.CreateAndStartAnimation("camTarget", this.camera, "target", fps, frames, this.camera.target.clone(), target, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
    Animation.CreateAndStartAnimation("camRadius", this.camera, "radius", fps, frames, this.camera.radius, radius, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
    if (beta !== undefined) Animation.CreateAndStartAnimation("camBeta", this.camera, "beta", fps, frames, this.camera.beta, beta, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
    if (alpha !== undefined) Animation.CreateAndStartAnimation("camAlpha", this.camera, "alpha", fps, frames, this.camera.alpha, alpha, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
  }

  private update(): void {
    const dt = this.engine.getDeltaTime() / 1000;
    this.elapsed += dt;
    if (this.idleSpin) this.root.rotation.y += dt * 0.06;

    if (this.halo.isEnabled()) {
      this.halo.scaling.setAll(1 + Math.sin(this.elapsed * 4) * 0.07);
      this.halo.rotation.z += dt * 0.5;
    }

    if (this.morphActive && !this.dense) {
      const t = this.morphT;
      for (const g of this.sparseGenes) {
        if (g.targetScale !== undefined) {
          const s = g.fadeOut ? g.baseScale * (1 - t) : g.baseScale + (g.targetScale - g.baseScale) * t;
          g.mesh.scaling.setAll(Math.max(0.001, s));
        }
        if (g.targetColor) g.mat.emissiveColor = lerpColor(g.baseColor, g.targetColor, t);
      }
    }

    this.projectSelectedCard();
  }

  private projectSelectedCard(): void {
    if (!this.callbacks.onCard) return;
    const pos = this.selectedGeneId ? this.worldPosOf(this.selectedGeneId) : null;
    if (!pos) {
      this.callbacks.onCard({ x: 0, y: 0, visible: false });
      return;
    }
    const w = this.engine.getRenderWidth();
    const h = this.engine.getRenderHeight();
    const projected = Vector3.Project(pos, Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(w, h));
    const sx = projected.x * (this.canvas.clientWidth / w);
    const sy = projected.y * (this.canvas.clientHeight / h);
    this.callbacks.onCard({ x: sx, y: sy, visible: projected.z > 0 && projected.z < 1 });
  }

  private handlePointer(pi: PointerInfo): void {
    if (pi.type === PointerEventTypes.POINTERDOWN) {
      this.pointerDown = { x: this.scene.pointerX, y: this.scene.pointerY };
    } else if (pi.type === PointerEventTypes.POINTERUP) {
      if (!this.pointerDown) return;
      const dx = this.scene.pointerX - this.pointerDown.x;
      const dy = this.scene.pointerY - this.pointerDown.y;
      this.pointerDown = null;
      if (Math.hypot(dx, dy) > 6) return;
      const hit = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
      const meta = hit?.pickedMesh?.metadata as { geneId?: string; geneIds?: string[] } | undefined;
      let geneId: string | null = meta?.geneId ?? null;
      if (!geneId && meta?.geneIds && hit && hit.thinInstanceIndex >= 0) {
        geneId = meta.geneIds[hit.thinInstanceIndex] ?? null;
      }
      this.callbacks.onPick?.(geneId);
    }
  }

  private clearGenome(): void {
    this.halo.setEnabled(false);
    this.halo.parent = null;
    this.halo.visibility = 1;
    this.clearDetail();
    for (const g of this.sparseGenes) {
      g.mat.dispose();
      g.mesh.dispose();
    }
    this.sparseGenes = [];
    for (const m of this.denseMeshes) m.dispose();
    this.denseMeshes = [];
    for (const m of this.structureMeshes) m.dispose();
    this.structureMeshes = [];
    for (const node of this.chromosomeNodes.values()) node.dispose();
    this.chromosomeNodes.clear();
    this.chromosomeHelix.clear();
    this.geneLookup.clear();
    this.focusedChrId = null;
  }

  private handleResize = (): void => {
    this.engine.resize();
  };

  dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.scene?.dispose();
    this.engine?.dispose();
  }
}
