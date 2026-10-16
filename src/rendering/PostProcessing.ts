import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import type { QualityProfile } from './Quality';

const GradeShader = {
  name: 'LiminalGrade',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.35 },
    uGrain: { value: 0.025 },
    uSaturation: { value: 1 },
    uWarmth: { value: 0 },
    uFade: { value: 0 },
    uFadeColor: { value: new THREE.Color(0x000000) },
    uLetterbox: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uSaturation, uWarmth, uFade, uLetterbox, uAspect;
    uniform vec3 uFadeColor;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c *= vec3(1.0 + uWarmth * 0.08, 1.0, 1.0 - uWarmth * 0.08);
      vec2 q = vUv - 0.5;
      q.x *= uAspect;
      float vig = smoothstep(0.95, 0.25, length(q) * (0.85 + uVignette));
      c *= mix(1.0, vig, uVignette);
      c += (rand(vUv * 731.0 + fract(uTime)) - 0.5) * uGrain;
      float bar = step(vUv.y, uLetterbox) + step(1.0 - uLetterbox, vUv.y);
      c = mix(c, vec3(0.0), bar);
      c = mix(c, uFadeColor, uFade);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/** Bloom → optional depth of field → tone mapping → grade (vignette, fades, letterbox). */
export class PostProcessing {
  composer: EffectComposer;
  renderPass: RenderPass;
  bloom: UnrealBloomPass;
  bokeh: BokehPass;
  grade: ShaderPass;
  private output: OutputPass;

  constructor(
    private renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    quality: QualityProfile,
  ) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: quality.msaa,
    });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.35, 0.6, 1.0);
    this.bloom.enabled = quality.bloom;
    this.composer.addPass(this.bloom);

    this.bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.002, maxblur: 0.008 });
    this.bokeh.enabled = false;
    this.composer.addPass(this.bokeh);

    this.output = new OutputPass();
    this.composer.addPass(this.output);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  setQuality(q: QualityProfile): void {
    this.bloom.enabled = q.bloom;
    const rt = this.composer.renderTarget1;
    rt.samples = q.msaa;
    this.composer.renderTarget2.samples = q.msaa;
    rt.dispose();
    this.composer.renderTarget2.dispose();
  }

  setSize(w: number, h: number): void {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.grade.uniforms.uAspect.value = w / h;
  }

  render(dt: number): void {
    this.grade.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }

  get uniforms(): Record<string, THREE.IUniform> {
    return this.grade.uniforms;
  }
}
