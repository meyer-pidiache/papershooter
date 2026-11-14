import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, Scene } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SceneResources } from '../../src/engine/resources.js';

describe('application-owned scene resources', () => {
  it('transfers detached fragments without disposing resources shared by live siblings', () => {
    const resources = new SceneResources();
    const scene = new Scene(),
      root = new Group();
    const geometry = new BoxGeometry(),
      material = new MeshBasicMaterial();
    const a = new Mesh(geometry, material),
      b = new Mesh(geometry, material);
    root.add(a, b);
    scene.add(root);
    resources.track(root);
    const dropGeometry = vi.spyOn(geometry, 'dispose'),
      dropMaterial = vi.spyOn(material, 'dispose');
    scene.attach(a);
    resources.track(a);
    resources.release(root);
    expect(dropGeometry).not.toHaveBeenCalled();
    expect(dropMaterial).not.toHaveBeenCalled();
    resources.release(a);
    resources.release(a);
    expect(dropGeometry).toHaveBeenCalledOnce();
    expect(dropMaterial).toHaveBeenCalledOnce();
    expect(resources.resourceCount).toBe(0);
  });
  it('retains cached materials and refreshes replaced attachments without duplicate ownership', () => {
    const resources = new SceneResources();
    const geometry = new BoxGeometry(),
      a = new MeshBasicMaterial(),
      b = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, a);
    const releaseCache = resources.retain([a, a]);
    const dropA = vi.spyOn(a, 'dispose'),
      dropB = vi.spyOn(b, 'dispose');
    resources.track(mesh);
    resources.track(mesh);
    mesh.material = b;
    resources.track(mesh);
    expect(dropA).not.toHaveBeenCalled();
    releaseCache();
    releaseCache();
    expect(dropA).toHaveBeenCalledOnce();
    resources.release(mesh);
    expect(dropB).toHaveBeenCalledOnce();
    expect(resources.size).toBe(0);
  });
  it('releases instance buffers and detached tracked objects during idempotent teardown', () => {
    const resources = new SceneResources();
    const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 3);
    const instance = vi.spyOn(mesh, 'dispose');
    const geometry = vi.spyOn(mesh.geometry, 'dispose');
    const release = resources.retain([mesh.material as MeshBasicMaterial]);
    resources.track(mesh);
    resources.dispose();
    resources.dispose();
    release();
    expect(instance).toHaveBeenCalledOnce();
    expect(geometry).toHaveBeenCalledOnce();
    expect(resources.resourceCount).toBe(0);
    expect(() => resources.track(mesh)).toThrow('disposed');
    expect(() => resources.retain([])).toThrow('disposed');
  });
});
