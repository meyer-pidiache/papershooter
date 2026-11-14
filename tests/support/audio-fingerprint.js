import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import baseline from '../fixtures/audio-baseline.json';

/** Record calls to the hardware boundary, not source layout or private recipe methods. */
export function assertAudioTrace(name, context) {
  const indexes = new Map(context.nodes.map((node, index) => [node, index]));
  const nodes = context.nodes.map((node) => ({
    kind: node.kind,
    type: node.type,
    loop: node.loop,
    loopEnd: node.loopEnd,
    started: node.started,
    stopped: node.stopped,
    values: Object.fromEntries(
      ['frequency', 'gain', 'Q', 'pan', 'threshold', 'ratio']
        .filter((key) => node[key])
        .map((key) => [key, node[key].value]),
    ),
    connections: node.connections.map((target) => indexes.get(target) ?? -1),
  }));
  const trace = { nodes, parameters: context.parameters };
  const fingerprint = {
    nodes: nodes.length,
    parameters: context.parameters.length,
    digest: createHash('sha256').update(JSON.stringify(trace)).digest('hex'),
  };
  if (process.env.RECORD_AUDIO_BASELINE === '1') {
    const path = 'tests/fixtures/audio-baseline.json';
    const values = JSON.parse(readFileSync(path, 'utf8'));
    values[name] = fingerprint;
    writeFileSync(path, JSON.stringify(values, null, 2) + '\n');
    writeFileSync(
      join(tmpdir(), `papershooter-audio-${name}-baseline.json`),
      JSON.stringify(trace),
    );
  } else {
    if (fingerprint.digest !== baseline[name]?.digest)
      writeFileSync(
        join(tmpdir(), `papershooter-audio-${name}-actual.json`),
        JSON.stringify(trace),
      );
    expect(fingerprint).toEqual(baseline[name]);
  }
}
