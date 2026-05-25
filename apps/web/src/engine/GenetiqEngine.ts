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
  MeshBuilder,
  PointerEventTypes,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  WebGPUEngine,
  type AbstractEngine,
  type Mesh,
  type PointerInfo,
} from "@babylonjs/core";
import type { Genome, RGB } from "@genetiq/core";
import { geneVisual } from "@genetiq/core";

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

interface GeneVisual {
  geneId: string;
  mesh: Mesh;
  basePos: Vector3;
  baseScale: number;
  phase: number;
}

const RING_RADIUS = 16;
const SPINE_HEIGHT = 11;
const HELIX_RADIUS = 1.35;
const HELIX_TURNS = 2.4;

function toColor3(rgb: RGB): Color3 {
  return new Color3(rgb[0], rgb[1], rgb[2]);
}

/**
 * The Genetiq rendering engine. Renders a genome as a ring of helical
 * chromosome spines studded with glowing genes, drives a cinematic camera
 * that reframes on selection, and reports picks/screen positions back to Vue.
 */
export class GenetiqEngine {
  private engine!: AbstractEngine;
  private scene!: Scene;
  private camera!: ArcRotateCamera;
  private root!: TransformNode;
  private glow!: GlowLayer;
  private geneTemplate!: Mesh;

  private genes: GeneVisual[] = [];
  private chromosomeNodes = new Map<string, TransformNode>();
  private selectedGeneId: string | null = null;
  private idleSpin = true;
  private elapsed = 0;
  private callbacks: EngineCallbacks = {};

  private pointerDown: { x: number; y: number } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  async init(callbacks: EngineCallbacks = {}): Promise<void> {
    this.callbacks = callbacks;

    let backend: "webgpu" | "webgl2" = "webgl2";
    if (await WebGPUEngine.IsSupportedAsync) {
      const webgpu = new WebGPUEngine(this.canvas, {
        antialias: true,
        stencil: true,
      });
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
    scene.fogDensity = 0.012;
    this.scene = scene;

    const camera = new ArcRotateCamera(
      "camera",
      Math.PI / 2,
      Math.PI / 2.4,
      48,
      Vector3.Zero(),
      scene,
    );
    camera.attachControl(this.canvas, true);
    camera.lowerRadiusLimit = 6;
    camera.upperRadiusLimit = 120;
    camera.wheelDeltaPercentage = 0.02;
    camera.minZ = 0.1;
    camera.useAutoRotationBehavior = false;
    this.camera = camera;

    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), scene);
    hemi.intensity = 0.55;
    hemi.groundColor = new Color3(0.04, 0.05, 0.1);

    const key = new PointLight("key", new Vector3(20, 24, 20), scene);
    key.intensity = 0.5;

    this.glow = new GlowLayer("glow", scene, { blurKernelSize: 48 });
    this.glow.intensity = 1.1;

    this.root = new TransformNode("genomeRoot", scene);

    const tpl = MeshBuilder.CreateSphere("geneTpl", { diameter: 1, segments: 14 }, scene);
    tpl.setEnabled(false);
    tpl.isPickable = false;
    this.geneTemplate = tpl;

    scene.onPointerObservable.add((pi) => this.handlePointer(pi));
    scene.onBeforeRenderObservable.add(() => this.update());
  }

  setData(
    genome: Genome,
    opts: { mutatedGeneIds?: Set<string>; selectedGeneId?: string | null; resetCamera?: boolean } = {},
  ): void {
    this.clearGenome();
    this.selectedGeneId = opts.selectedGeneId ?? null;
    const mutated = opts.mutatedGeneIds ?? new Set<string>();

    const chromosomes = genome.chromosomes;
    const count = Math.max(1, chromosomes.length);

    chromosomes.forEach((chr, ci) => {
      const angle = (ci / count) * Math.PI * 2;
      const node = new TransformNode(`chr-${chr.id}`, this.scene);
      node.parent = this.root;
      node.position = new Vector3(Math.cos(angle) * RING_RADIUS, 0, Math.sin(angle) * RING_RADIUS);
      this.chromosomeNodes.set(chr.id, node);

      // Spine: a slim emissive cylinder evoking the chromosome backbone.
      const spine = MeshBuilder.CreateCylinder(
        `spine-${chr.id}`,
        { height: SPINE_HEIGHT, diameter: 0.16, tessellation: 8 },
        this.scene,
      );
      spine.parent = node;
      spine.isPickable = false;
      const spineMat = new StandardMaterial(`spineMat-${chr.id}`, this.scene);
      spineMat.diffuseColor = new Color3(0.12, 0.16, 0.26);
      spineMat.emissiveColor = new Color3(0.06, 0.12, 0.22);
      spineMat.alpha = 0.85;
      spine.material = spineMat;

      const length = Math.max(1, chr.length);
      for (const gene of chr.genes) {
        const mid = (gene.start + gene.end) / 2;
        const f = Math.min(1, Math.max(0, mid / length));
        const y = -SPINE_HEIGHT / 2 + f * SPINE_HEIGHT;
        const theta = f * HELIX_TURNS * Math.PI * 2 + ci * 0.6;
        const localPos = new Vector3(
          Math.cos(theta) * HELIX_RADIUS,
          y,
          Math.sin(theta) * HELIX_RADIUS,
        );

        const v = geneVisual(gene, {
          selected: gene.id === this.selectedGeneId,
          mutated: mutated.has(gene.id),
        });

        const mesh = this.geneTemplate.clone(`gene-${gene.id}`);
        mesh.setEnabled(true);
        mesh.parent = node;
        mesh.position = localPos;
        const scale = 0.45 + v.size * 0.45;
        mesh.scaling.setAll(gene.deleted ? scale * 0.4 : scale);
        mesh.isPickable = !gene.deleted;
        mesh.metadata = { geneId: gene.id };

        const mat = new StandardMaterial(`geneMat-${gene.id}`, this.scene);
        const color = toColor3(v.color);
        mat.diffuseColor = color.scale(0.4);
        mat.emissiveColor = color.scale(0.35 + v.emissive);
        mat.specularColor = new Color3(0.2, 0.2, 0.25);
        if (gene.deleted) mat.alpha = 0.35;
        mesh.material = mat;

        this.genes.push({
          geneId: gene.id,
          mesh,
          basePos: localPos.clone(),
          baseScale: mesh.scaling.x,
          phase: (gene.start % 1000) / 1000 * Math.PI * 2,
        });
      }
    });

    if (opts.resetCamera) this.focusOverview();
    if (this.selectedGeneId) {
      this.idleSpin = false;
    } else {
      this.idleSpin = true;
    }
  }

  setSelected(geneId: string | null): void {
    this.selectedGeneId = geneId;
    this.idleSpin = geneId === null;
  }

  focusOverview(): void {
    this.animateCamera(Vector3.Zero(), 48, Math.PI / 2.4, this.camera.alpha);
    this.idleSpin = true;
  }

  focusGene(geneId: string): void {
    const target = this.genes.find((g) => g.geneId === geneId);
    if (!target) return;
    this.idleSpin = false;
    const pos = target.mesh.getAbsolutePosition();
    this.animateCamera(pos.clone(), 9, Math.PI / 2.6);
  }

  focusChromosome(chromosomeId: string): void {
    const node = this.chromosomeNodes.get(chromosomeId);
    if (!node) return;
    this.idleSpin = false;
    this.animateCamera(node.getAbsolutePosition().clone(), 18, Math.PI / 2.5);
  }

  private animateCamera(target: Vector3, radius: number, beta?: number, alpha?: number): void {
    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    const fps = 60;
    const frames = 48;
    Animation.CreateAndStartAnimation(
      "camTarget", this.camera, "target", fps, frames,
      this.camera.target.clone(), target, Animation.ANIMATIONLOOPMODE_CONSTANT, ease,
    );
    Animation.CreateAndStartAnimation(
      "camRadius", this.camera, "radius", fps, frames,
      this.camera.radius, radius, Animation.ANIMATIONLOOPMODE_CONSTANT, ease,
    );
    if (beta !== undefined) {
      Animation.CreateAndStartAnimation(
        "camBeta", this.camera, "beta", fps, frames,
        this.camera.beta, beta, Animation.ANIMATIONLOOPMODE_CONSTANT, ease,
      );
    }
    if (alpha !== undefined) {
      Animation.CreateAndStartAnimation(
        "camAlpha", this.camera, "alpha", fps, frames,
        this.camera.alpha, alpha, Animation.ANIMATIONLOOPMODE_CONSTANT, ease,
      );
    }
  }

  private update(): void {
    const dt = this.engine.getDeltaTime() / 1000;
    this.elapsed += dt;

    if (this.idleSpin) this.root.rotation.y += dt * 0.08;

    for (const g of this.genes) {
      const selected = g.geneId === this.selectedGeneId;
      const pulse = 1 + Math.sin(this.elapsed * 2 + g.phase) * 0.05;
      const sel = selected ? 1.5 + Math.sin(this.elapsed * 6) * 0.12 : 1;
      g.mesh.scaling.setAll(g.baseScale * pulse * sel);
    }

    this.projectSelectedCard();
  }

  private projectSelectedCard(): void {
    if (!this.callbacks.onCard) return;
    const target = this.selectedGeneId
      ? this.genes.find((g) => g.geneId === this.selectedGeneId)
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
    // Convert render-buffer pixels to CSS pixels regardless of device ratio.
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
      if (Math.hypot(dx, dy) > 6) return; // drag, not a click

      const hit = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
      const geneId = (hit?.pickedMesh?.metadata as { geneId?: string } | undefined)?.geneId ?? null;
      this.callbacks.onPick?.(geneId);
    }
  }

  private clearGenome(): void {
    for (const g of this.genes) {
      g.mesh.material?.dispose();
      g.mesh.dispose();
    }
    this.genes = [];
    for (const node of this.chromosomeNodes.values()) {
      node.getChildMeshes().forEach((m) => {
        m.material?.dispose();
        m.dispose();
      });
      node.dispose();
    }
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
