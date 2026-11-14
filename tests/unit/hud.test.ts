// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HUD } from '../../src/hud.js';
import { escapeHtml } from '../../src/presentation/html';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('HUD trust boundaries', () => {
  it('renders remote kill feed strings as text and preserves score styling', () => {
    const root = document.createElement('div');
    const hud = new HUD(root);
    hud.kill('<img src=x onerror=alert(1)>', 100);
    expect(root.querySelector('#killfeed img')).toBeNull();
    expect(root.querySelector('#killfeed')!.textContent).toContain('<img');
    expect(root.querySelector('#killfeed .pts')!.textContent).toBe('+100');
    for (let i = 0; i < 8; i++) hud.kill('player', 0);
    expect(root.querySelector('#killfeed')!.children).toHaveLength(6);
    vi.advanceTimersByTime(1800);
    expect(root.querySelector('#killfeed')!.children).toHaveLength(0);
  });
  it('escapes names before using trusted scoreboard templates', () => {
    expect(escapeHtml(`<img title="x">&'`)).toBe('&lt;img title=&quot;x&quot;&gt;&amp;&#39;');
  });
});
