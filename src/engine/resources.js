/** Dispose a scene subtree once per GPU resource, including geometries shared by children. */
export function disposeObjects(objects, scene) {
  const geometries = new Set();
  const materials = new Set();
  for (const root of objects) {
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          materials.add(material);
      }
    });
    scene.remove(root);
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
