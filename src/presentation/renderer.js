// Own the scene/data-buffer and paper post-processing passes.
import * as THREE from 'three';
import {
  createInkFrame,
  registerInkFrame,
  unregisterInkFrame,
  updateInkFrame,
} from './ink/materials.js';
import { createInkColors } from './ink/palette.js';
import { postVert, postFrag } from './ink/post-shaders.js';

export class InkRenderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(80, 1, 0.08, 420);
    this.inkFrame = createInkFrame();
    registerInkFrame(this.renderer, this.inkFrame);
    const depthTexture = new THREE.DepthTexture(2, 2);
    depthTexture.format = THREE.DepthFormat;
    depthTexture.type = THREE.FloatType;
    this.rt = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture,
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    this.post = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.rt.texture },
        tDepth: { value: depthTexture },
        uRes: { value: new THREE.Vector2(2, 2) },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uNear: { value: this.camera.near },
        uFar: { value: this.camera.far },
        uHurt: { value: 0 },
        uFlash: { value: 0 },
        uSlow: { value: 0 },
        uLowHp: { value: 0 },
        uLineSpacing: { value: 60 },
        uPaper: { value: new THREE.Vector3(0.965, 0.955, 0.905) },
        uInks: { value: createInkColors() },
        uInvProj: { value: new THREE.Matrix4() },
        uInvView: { value: new THREE.Matrix4() },
      },
      vertexShader: postVert,
      fragmentShader: postFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
    this._clear = new THREE.Color(1, 0, 0);
    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
  }
  resize() {
    const w = Math.max(2, window.innerWidth),
      h = Math.max(2, window.innerHeight);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    const rw = Math.floor(w * this.pixelRatio),
      rh = Math.floor(h * this.pixelRatio);
    this.rt.setSize(rw, rh);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const u = this.post.uniforms;
    u.uRes.value.set(rw, rh);
    u.uAspect.value = w / h;
    u.uLineSpacing.value = rh / 13.5;
  }
  render(time, fx = {}) {
    if (this.disposed) return;
    this.camera.updateMatrixWorld();
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
    updateInkFrame(this.inkFrame, this.camera, time);
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.setClearColor(this._clear, 0);
    r.clear(true, true, false);
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    const u = this.post.uniforms;
    u.uTime.value = time;
    u.uNear.value = this.camera.near;
    u.uFar.value = this.camera.far;
    u.uInvProj.value.copy(this.camera.projectionMatrixInverse);
    u.uInvView.value.copy(this.camera.matrixWorld);
    u.uHurt.value = fx.hurt || 0;
    u.uFlash.value = fx.flash || 0;
    u.uSlow.value = fx.slow || 0;
    u.uLowHp.value = fx.lowHp || 0;
    r.render(this.postScene, this.postCam);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    unregisterInkFrame(this.renderer);
    window.removeEventListener('resize', this.onResize);
    this.rt.dispose();
    this.postScene.traverse((object) => object.geometry?.dispose());
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
