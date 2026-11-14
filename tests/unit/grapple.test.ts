import { describe, expect, it, vi } from 'vitest';
import { Object3D, Scene, Vector3 } from 'three';
import { makeBody, World } from '../../src/engine/physics.js';
import { Grapple } from '../../src/gameplay/player/grapple.js';
import { findGrappleTarget } from '../../src/gameplay/player/grapple-target.js';
import { GrappleVisuals } from '../../src/presentation/grapple.js';
import type {
  GrappleEnemy,
  GrappleFeedback,
  GrappleMover,
  GrappleQueries,
  GrappleVisualPort,
} from '../../src/gameplay/player/grapple-contracts.js';

function fixture() {
  const body = makeBody(new Vector3(), 0.35, 1.75, 0.55);
  const pose = {
    eye: new Vector3(0, 1.6, 0),
    center: new Vector3(0, 1, 0),
    forward: new Vector3(0, 0, -1),
    right: new Vector3(1, 0, 0),
  };
  const world = new World();
  const landmarks: { rings: Vector3[]; grappleMovers: GrappleMover[] } = {
    rings: [],
    grappleMovers: [],
  };
  const enemies: GrappleEnemy[] = [];
  const queries: GrappleQueries = {
    raycastEnemy: vi.fn(() => null),
    enemies: () => enemies,
    landmarks: () => landmarks,
    yank: vi.fn(),
  };
  const feedback: GrappleFeedback = {
    target: vi.fn(),
    outOfBreath: vi.fn(),
    missed: vi.fn(),
    fired: vi.fn(),
    yanked: vi.fn(),
    attached: vi.fn(),
    stopped: vi.fn(),
    released: vi.fn(),
    exhausted: vi.fn(),
  };
  const view: GrappleVisualPort = { draw: vi.fn(), hide: vi.fn() };
  const grapple = new Grapple(body, pose, {
    world: world,
    queries: queries,
    view: view,
    feedback: feedback,
  });
  return { body, pose, world, queries, landmarks, enemies, feedback, view, grapple };
}

describe('independent grapple state and targeting', () => {
  it('ignores unhookable surfaces and rejects rings and assisted enemies behind a wall', () => {
    const { pose, world, queries, landmarks, enemies } = fixture();
    world.addBox({ x: -5, y: 0, z: -10 }, { x: 5, y: 10, z: -9 }, { noGrapple: true });
    expect(findGrappleTarget(pose, world, queries)).toBeNull();
    world.boxes[0].data.noGrapple = false;
    landmarks.rings.push(new Vector3(0, 1.6, -15));
    enemies.push({ alive: true, state: 'hunt', center: new Vector3(0, 1.6, -15) });
    const target = findGrappleTarget(pose, world, queries);
    expect(target?.enemy).toBeNull();
    expect(target?.point.z).toBeCloseTo(-8.88);
  });
  it('prefers moving props over assisted enemies and preserves exact-enemy precedence', () => {
    const f = fixture();
    const mover = { mesh: new Object3D(), radius: 1 };
    mover.mesh.position.set(0, 1.6, -10);
    f.landmarks.grappleMovers.push(mover);
    const enemy = { alive: true, state: 'hunt', center: new Vector3(0, 1.6, -8) };
    f.enemies.push(enemy);
    expect(findGrappleTarget(f.pose, f.world, f.queries)?.mover).toBe(mover);
    vi.mocked(f.queries.raycastEnemy).mockReturnValue({ enemy, point: enemy.center, dist: 8 });
    expect(findGrappleTarget(f.pose, f.world, f.queries)?.enemy).toBe(enemy);
  });
  it('yanks a live enemy once at hook arrival and returns to idle', () => {
    const f = fixture(),
      enemy = { alive: true, state: 'hunt', center: new Vector3(0, 1.6, -5) };
    vi.mocked(f.queries.raycastEnemy).mockReturnValue({ enemy, point: enemy.center, dist: 5 });
    f.grapple.update(0.01, true, true, 0);
    f.grapple.update(0.1, false, true, 0);
    expect(f.queries.yank).toHaveBeenCalledExactlyOnceWith(enemy, f.pose.center);
    expect(f.grapple.state.state).toBe('idle');
    expect(f.feedback.yanked).toHaveBeenCalledOnce();
    expect(f.view.hide).toHaveBeenCalledOnce();
  });
  it('does not yank a target that dies before hook arrival', () => {
    const f = fixture(),
      enemy = { alive: true, state: 'hunt', center: new Vector3(0, 1.6, -5) };
    vi.mocked(f.queries.raycastEnemy).mockReturnValue({ enemy, point: enemy.center, dist: 5 });
    f.grapple.update(0.01, true, true, 0);
    enemy.alive = false;
    f.grapple.update(0.1, false, true, 0);
    expect(f.queries.yank).not.toHaveBeenCalled();
    expect(f.grapple.state.state).toBe('idle');
  });
  it('rejects an exhausted launch and detaches on depletion before recovering on the ground', () => {
    const f = fixture();
    f.grapple.stamina = 0.1;
    f.grapple.update(0.01, true, true, 0);
    expect(f.feedback.outOfBreath).toHaveBeenCalledOnce();
    f.grapple.state.state = 'on';
    f.grapple.stamina = 0.001;
    f.grapple.recover(1);
    expect(f.feedback.exhausted).toHaveBeenCalledOnce();
    expect(f.grapple.state.state).toBe('idle');
    f.body.onGround = true;
    f.grapple.recover(1);
    expect(f.grapple.stamina).toBeCloseTo(0.4);
  });
  it('reports an empty aim and selects a visible ring when available', () => {
    const f = fixture();
    f.grapple.update(0.01, true, true, 0);
    expect(f.feedback.missed).toHaveBeenCalledOnce();
    f.landmarks.rings.push(new Vector3(0, 2, -8));
    expect(findGrappleTarget(f.pose, f.world, f.queries)?.dist).toBe(8);
  });
  it('adapts rope geometry to a narrow draw/hide port', () => {
    const scene = new Scene(),
      view: GrappleVisualPort = new GrappleVisuals(scene);
    view.draw(new Vector3(), new Vector3(0, 5, 0));
    expect(scene.children.every((mesh) => mesh.visible)).toBe(true);
    view.hide();
    expect(scene.children.every((mesh) => !mesh.visible)).toBe(true);
    scene.traverse((node) => {
      if ('geometry' in node) (node.geometry as { dispose(): void }).dispose();
      if ('material' in node) (node.material as { dispose(): void }).dispose();
    });
  });
});
