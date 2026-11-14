import type { Object3D } from 'three';

export interface Disposable {
  dispose(): void;
}
type RenderObject = Object3D & {
  geometry?: Disposable;
  material?: Disposable | Disposable[];
  dispose?: () => void;
};

function attachedResources(object: Object3D): Set<Disposable> {
  const node = object as RenderObject;
  const result = new Set<Disposable>();
  if (node.geometry) result.add(node.geometry);
  if (node.material) {
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) result.add(material);
  }
  // InstancedMesh has its own instance-buffer lifetime in addition to geometry/materials.
  if (typeof node.dispose === 'function') result.add(node as Disposable);
  return result;
}

/** One application owns this registry. Reparenting a tracked node transfers its existing ownership. */
export class SceneResources {
  private readonly objects = new Map<Object3D, Set<Disposable>>();
  private readonly references = new Map<Disposable, number>();
  private readonly leases = new Set<() => void>();
  private closed = false;

  get size(): number {
    return this.objects.size;
  }
  get resourceCount(): number {
    return this.references.size;
  }

  private add(resource: Disposable): void {
    this.references.set(resource, (this.references.get(resource) ?? 0) + 1);
  }
  private drop(resource: Disposable): void {
    const remaining = (this.references.get(resource) ?? 0) - 1;
    if (remaining > 0) this.references.set(resource, remaining);
    else if (this.references.delete(resource)) resource.dispose();
  }

  /** Retain resources cached by an owner even when it currently has no rendered mesh. */
  retain(resources: Iterable<Disposable>): () => void {
    if (this.closed) throw new Error('Scene resources have been disposed');
    const unique = new Set(resources);
    for (const resource of unique) this.add(resource);
    const release = () => {
      if (!this.leases.delete(release)) return;
      for (const resource of unique) this.drop(resource);
    };
    this.leases.add(release);
    return release;
  }

  /** Register new meshes, or refresh their resource attachments after an intentional replacement. */
  track<T extends Object3D>(root: T): T {
    if (this.closed) throw new Error('Scene resources have been disposed');
    root.traverse((object) => {
      const previous = this.objects.get(object) ?? new Set<Disposable>();
      const next = attachedResources(object);
      for (const resource of next) if (!previous.has(resource)) this.add(resource);
      for (const resource of previous) if (!next.has(resource)) this.drop(resource);
      if (next.size) this.objects.set(object, next);
      else this.objects.delete(object);
    });
    return root;
  }

  release(root: Object3D): void {
    root.removeFromParent();
    root.traverse((object) => {
      const resources = this.objects.get(object);
      if (!resources) return;
      this.objects.delete(object);
      for (const resource of resources) this.drop(resource);
    });
  }

  dispose(): void {
    if (this.closed) return;
    for (const object of [...this.objects.keys()]) this.release(object);
    for (const release of [...this.leases]) release();
    this.closed = true;
  }
}

/** For an isolated collection whose resources are not shared with other owners. */
export function disposeObjects(objects: Object3D[], _scene?: Object3D): void {
  const resources = new SceneResources();
  for (const object of objects) resources.track(object);
  for (const object of objects) resources.release(object);
}
