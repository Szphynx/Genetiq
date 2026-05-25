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

interface GeneNode {
  gene: Gene;
  mesh: Mesh;
  mat: StandardMaterial;
  baseColor: Color3;
  baseEmissive: number;
  baseScale: number;
  phase: number;
  // Morph endpoints (filled by prepareMorph).
  targetColor?: Color3;
  targetScale?: number;
  fadeOut?: boolean;
}

const HELIX_R = 0.72;
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

/**
 * The Genetiq rendering engine. Each chromosome is a glowing double helix —
 * two twisting backbones joined by base-pair rungs — with genes as bright
 * nodes on the ladder. Drives a cinematic camera, supports live morphing
 * between two genomes, and reports picks/screen positions back to Vue.
 */
export class GenetiqEngine {
  private engine!: AbstractEngine;
  private scene!: Scene;
  private camera!: ArcRotateCamera;
  private root!: TransformNode;
  private glow!: GlowLayer;
  private geneTemplate!: Mesh;

  private backboneMatA!: StandardMaterial;
  private backboneMatB!: StandardMaterial;
  private rungMat!: StandardMaterial;

  private genes: GeneNode[] = [];
  private structureMeshes: Mesh[] = [];
  private chromosomeNodes = new Map<string, TransformNode>();

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
    scene.clearColor = new Color4(0.02, 0.03, 0.06, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.02, 0.03, 0.06);
    scene.fogDensity = 0.011;
    this.scene = scene;

    const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.3, 44, Vector3.Zero(), scene);
    camera.attachControl(this.canvas, true);
    camera.lowerRadiusLimit = 3;
    camera.upperRadiusLimit = 160;
    camera.wheelDeltaPercentage = 0.02;
    camera.pinchDeltaPercentage = 0.02;
    camera.minZ = 0.1;
    this.camera = camera;

    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), scene);
    hemi.intensity = 0.5;
    hemi.groundColor = new Color3(0.04, 0.05, 0.1);
    const key = new PointLight("key", new Vector3(20, 26, 20), scene);
    key.intensity = 0.45;

    this.glow = new GlowLayer("glow", scene, { blurKernelSize: 56 });
    this.glow.intensity = 1.25;

    this.root = new TransformNode("genomeRoot", scene);

    this.backboneMatA = this.makeEmissiveMat("bbA", new Color3(0.18, 0.55, 0.95), 0.55);
    this.backboneMatB = this.makeEmissiveMat("bbB", new Color3(0.75, 0.3, 0.95), 0.55);
    this.rungMat = this.makeEmissiveMat("rung", new Color3(0.6, 0.7, 0.9), 0.35);

    const tpl = MeshBuilder.CreateSphere("geneTpl", { diameter: 1, segments: 14 }, scene);
    tpl.setEnabled(false);
    tpl.isPickable = false;
    this.geneTemplate = tpl;

    scene.onPointerObservable.add((pi) => this.handlePointer(pi));
    scene.onBeforeRenderObservable.add(() => this.update());
  }

  private makeEmissiveMat(name: string, color: Color3, emissive: number): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = color.scale(0.3);
    m.emissiveColor = color.scale(emissive);
    m.specularColor = new Color3(0.1, 0.1, 0.15);
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

    const chromosomes = genome.chromosomes;
    const count = Math.max(1, chromosomes.length);
    this.ringRadius = count === 1 ? 0 : Math.max(9, count * 1.6);

    chromosomes.forEach((chr, ci) => {
      const angle = (ci / count) * Math.PI * 2;
      const node = new TransformNode(`chr-${chr.id}`, this.scene);
      node.parent = this.root;
      node.position = new Vector3(
        Math.cos(angle) * this.ringRadius,
        0,
        Math.sin(angle) * this.ringRadius,
      );
      node.rotation.y = -angle; // face helices outward-consistently
      this.chromosomeNodes.set(chr.id, node);
      this.buildHelix(node, chr, ci, mutated);
    });

    if (opts.resetCamera) this.focusOverview();
    this.idleSpin = this.selectedGeneId === null;
  }

  private buildHelix(node: TransformNode, chr: Chromosome, ci: number, mutated: Set<string>): void {
    const height = clamp(7 + (Math.log10(Math.max(10, chr.length)) - 7) * 4.5, 6, 14);
    const turns = Math.max(2.5, height / 2.0);
    const steps = clamp(Math.round(turns * 10), 24, 100);
    const phase = ci * 0.7;

    const pathA: Vector3[] = [];
    const pathB: Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const t = f * turns * Math.PI * 2 + phase;
      const y = -height / 2 + f * height;
      pathA.push(new Vector3(Math.cos(t) * HELIX_R, y, Math.sin(t) * HELIX_R));
      pathB.push(new Vector3(Math.cos(t + Math.PI) * HELIX_R, y, Math.sin(t + Math.PI) * HELIX_R));
    }

    const tubeA = MeshBuilder.CreateTube(
      `bbA-${chr.id}`,
      { path: pathA, radius: 0.05, tessellation: 8, cap: Mesh.CAP_ALL },
      this.scene,
    );
    tubeA.parent = node;
    tubeA.isPickable = false;
    tubeA.material = this.backboneMatA;
    const tubeB = MeshBuilder.CreateTube(
      `bbB-${chr.id}`,
      { path: pathB, radius: 0.05, tessellation: 8, cap: Mesh.CAP_ALL },
      this.scene,
    );
    tubeB.parent = node;
    tubeB.isPickable = false;
    tubeB.material = this.backboneMatB;
    this.structureMeshes.push(tubeA, tubeB);

    // Base-pair rungs as a single thin-instanced ladder.
    const rungBase = MeshBuilder.CreateCylinder(
      `rungs-${chr.id}`,
      { height: 1, diameter: 1, tessellation: 6 },
      this.scene,
    );
    rungBase.parent = node;
    rungBase.isPickable = false;
    rungBase.material = this.rungMat;

    const matrices = new Float32Array((steps + 1) * 16);
    const colors = new Float32Array((steps + 1) * 4);
    const up = Vector3.Up();
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const t = f * turns * Math.PI * 2 + phase;
      const y = -height / 2 + f * height;
      const dir = new Vector3(Math.cos(t), 0, Math.sin(t));
      const axis = Vector3.Cross(up, dir);
      const angle = Math.acos(clamp(Vector3.Dot(up, dir), -1, 1));
      const q =
        axis.lengthSquared() < 1e-6 ? Quaternion.Identity() : Quaternion.RotationAxis(axis.normalize(), angle);
      Matrix.Compose(new Vector3(0.04, HELIX_R * 2, 0.04), q, new Vector3(0, y, 0)).copyToArray(
        matrices,
        i * 16,
      );
      const c = BASE_COLORS[i % BASE_COLORS.length]!;
      colors[i * 4] = c[0];
      colors[i * 4 + 1] = c[1];
      colors[i * 4 + 2] = c[2];
      colors[i * 4 + 3] = 1;
    }

    // Genes: bright nodes on the ladder; also recolour their nearest rung.
    const length = Math.max(1, chr.length);
    for (const gene of chr.genes) {
      const mid = (gene.start + gene.end) / 2;
      const f = clamp(mid / length, 0, 1);
      const t = f * turns * Math.PI * 2 + phase;
      const y = -height / 2 + f * height;
      const side = gene.strand === "-" ? Math.PI : 0;
      const pos = new Vector3(Math.cos(t + side) * HELIX_R, y, Math.sin(t + side) * HELIX_R);

      const v = geneVisual(gene, {
        selected: gene.id === this.selectedGeneId,
        mutated: mutated.has(gene.id),
      });
      const color = toColor3(v.color);

      const mesh = this.geneTemplate.clone(`gene-${gene.id}`);
      mesh.setEnabled(true);
      mesh.parent = node;
      mesh.position = pos;
      const scale = gene.deleted ? 0.18 : 0.3 + v.size * 0.4;
      mesh.scaling.setAll(scale);
      mesh.isPickable = !gene.deleted;
      mesh.metadata = { geneId: gene.id };

      const mat = new StandardMaterial(`geneMat-${gene.id}`, this.scene);
      mat.diffuseColor = color.scale(0.45);
      mat.emissiveColor = color.scale(0.4 + v.emissive);
      mat.specularColor = new Color3(0.25, 0.25, 0.3);
      if (gene.deleted) mat.alpha = 0.4;
      mesh.material = mat;

      this.genes.push({
        gene,
        mesh,
        mat,
        baseColor: mat.emissiveColor.clone(),
        baseEmissive: 0.4 + v.emissive,
        baseScale: scale,
        phase: ((gene.start % 1000) / 1000) * Math.PI * 2,
      });

      // brighten the rung where the gene sits
      const ri = clamp(Math.round(f * steps), 0, steps);
      colors[ri * 4] = clamp(v.color[0] * 1.2, 0, 1);
      colors[ri * 4 + 1] = clamp(v.color[1] * 1.2, 0, 1);
      colors[ri * 4 + 2] = clamp(v.color[2] * 1.2, 0, 1);
    }

    rungBase.thinInstanceSetBuffer("matrix", matrices, 16, true);
    rungBase.thinInstanceSetBuffer("color", colors, 4, true);
    this.structureMeshes.push(rungBase);
  }

  setSelected(geneId: string | null): void {
    this.selectedGeneId = geneId;
    this.idleSpin = geneId === null;
  }

  // --- Morphing -------------------------------------------------------------

  /** Stage a live morph toward another genome (matched by gene symbol). */
  prepareMorph(target: Genome): void {
    const bySymbol = new Map<string, Gene>();
    for (const g of allGenes(target)) bySymbol.set(g.symbol.toUpperCase(), g);
    for (const node of this.genes) {
      const match = bySymbol.get(node.gene.symbol.toUpperCase());
      if (match) {
        const v = geneVisual(match);
        node.targetColor = toColor3(v.color).scale(0.4 + v.emissive);
        node.targetScale = 0.3 + v.size * 0.4;
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
    this.morphActive = this.morphT > 0.0001 || this.morphActive;
  }

  clearMorph(): void {
    this.morphActive = false;
    this.morphT = 0;
    for (const node of this.genes) {
      node.targetColor = undefined;
      node.targetScale = undefined;
      node.fadeOut = false;
    }
  }

  // --- Camera ---------------------------------------------------------------

  focusOverview(): void {
    this.animateCamera(Vector3.Zero(), this.ringRadius * 2.3 + 14, Math.PI / 2.3, this.camera.alpha);
    this.idleSpin = true;
  }

  focusGene(geneId: string): void {
    const target = this.genes.find((g) => g.gene.id === geneId);
    if (!target) return;
    this.idleSpin = false;
    this.animateCamera(target.mesh.getAbsolutePosition().clone(), 5.5, Math.PI / 2.5);
  }

  focusChromosome(chromosomeId: string): void {
    const node = this.chromosomeNodes.get(chromosomeId);
    if (!node) return;
    this.idleSpin = false;
    this.animateCamera(node.getAbsolutePosition().clone(), 13, Math.PI / 2.4);
  }

  private animateCamera(target: Vector3, radius: number, beta?: number, alpha?: number): void {
    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    const fps = 60;
    const frames = 48;
    Animation.CreateAndStartAnimation("camTarget", this.camera, "target", fps, frames, this.camera.target.clone(), target, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
    Animation.CreateAndStartAnimation("camRadius", this.camera, "radius", fps, frames, this.camera.radius, radius, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
    if (beta !== undefined) {
      Animation.CreateAndStartAnimation("camBeta", this.camera, "beta", fps, frames, this.camera.beta, beta, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
    }
    if (alpha !== undefined) {
      Animation.CreateAndStartAnimation("camAlpha", this.camera, "alpha", fps, frames, this.camera.alpha, alpha, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
    }
  }

  private update(): void {
    const dt = this.engine.getDeltaTime() / 1000;
    this.elapsed += dt;
    if (this.idleSpin) this.root.rotation.y += dt * 0.07;

    const t = this.morphT;
    for (const g of this.genes) {
      const selected = g.gene.id === this.selectedGeneId;
      const pulse = 1 + Math.sin(this.elapsed * 2 + g.phase) * 0.05;
      const sel = selected ? 1.5 + Math.sin(this.elapsed * 6) * 0.12 : 1;

      let targetScale = g.baseScale;
      if (this.morphActive && g.targetScale !== undefined) {
        const ms = g.fadeOut ? g.baseScale * (1 - t) : g.baseScale + (g.targetScale - g.baseScale) * t;
        targetScale = ms;
      }
      g.mesh.scaling.setAll(Math.max(0.001, targetScale) * pulse * sel);

      if (this.morphActive && g.targetColor) {
        g.mat.emissiveColor = lerpColor(g.baseColor, g.targetColor, t);
      } else if (g.mat.emissiveColor !== g.baseColor) {
        g.mat.emissiveColor = g.baseColor;
      }
    }

    this.projectSelectedCard();
  }

  private projectSelectedCard(): void {
    if (!this.callbacks.onCard) return;
    const target = this.selectedGeneId
      ? this.genes.find((g) => g.gene.id === this.selectedGeneId)
      : null;
    if (!target) {
      this.callbacks.onCard({ x: 0, y: 0, visible: false });
      return;
    }
    const w = this.engine.getRenderWidth();
    const h = this.engine.getRenderHeight();
    const projected = Vector3.Project(
      target.mesh.getAbsolutePosition(),
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      this.camera.viewport.toGlobal(w, h),
    );
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
      const geneId = (hit?.pickedMesh?.metadata as { geneId?: string } | undefined)?.geneId ?? null;
      this.callbacks.onPick?.(geneId);
    }
  }

  private clearGenome(): void {
    for (const g of this.genes) {
      g.mat.dispose();
      g.mesh.dispose();
    }
    this.genes = [];
    for (const m of this.structureMeshes) m.dispose();
    this.structureMeshes = [];
    for (const node of this.chromosomeNodes.values()) node.dispose();
    this.chromosomeNodes.clear();
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
