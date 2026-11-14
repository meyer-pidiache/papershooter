# 0008: Own shared scene resources for the application lifetime

Date: 2026-11-14. Status: accepted.

Removing an object from a Three.js scene does not dispose its GPU resources. Traversing only the
remaining scene at shutdown also misses earlier detached objects. Disposing every detached fragment
independently can prematurely retire materials or geometry still used by live siblings.

Use one typed `SceneResources` registry per application. Track resources by mesh identity and count
references to geometries, materials and instance-buffer owners. Register new attachments at creation
or replacement. Retire current subtrees at despawn/expiry/reset; moving a tracked node to debris
keeps its existing ownership. Cached materials use explicit idempotent leases until their owner is
disposed. The final registry teardown releases all remaining registrations, including detached ones.

This makes procedural models and fragment transfer safe without cloning every shared material or
deferring all cleanup until a level ends. Registration happens at construction/retirement, not on
each animation frame. Renderer render targets and WebAudio contexts remain owned by their adapters.
Future textures or other cached resources must acquire explicit ownership rather than assuming that
traversing a material discovers every external resource.

Tests observe disposal of real Three.js objects across fragment transfer, shared siblings, material
replacement, repeated pickup collection, grenade expiry/reset, corpse transfer and debris eviction.
Real renderer memory counters and long-session GPU profiling remain acceptance checks; a disposal
event alone does not measure driver memory.

Reference: [Three.js resource disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html).
