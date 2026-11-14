// A recording WebAudio boundary: validate real synthesis/envelope schedules without audio hardware.
export class AudioContextModel {
  constructor() {
    this.sampleRate = 8000;
    this.currentTime = 0;
    this.state = 'suspended';
    this.destination = {};
    this.nodes = [];
    this.parameters = [];
  }
  parameter() {
    const records = this.parameters;
    return {
      value: 0,
      setValueAtTime(value, time) {
        records.push({ value, time });
      },
      linearRampToValueAtTime(value, time) {
        records.push({ value, time });
      },
      exponentialRampToValueAtTime(value, time) {
        if (value <= 0) throw new Error('Exponential envelope must stay positive');
        records.push({ value, time });
      },
      setTargetAtTime(value, time) {
        records.push({ value, time });
      },
    };
  }
  node(kind) {
    const node = {
      kind,
      gain: this.parameter(),
      frequency: this.parameter(),
      Q: this.parameter(),
      pan: this.parameter(),
      threshold: this.parameter(),
      ratio: this.parameter(),
      connections: [],
      connect(target) {
        this.connections.push(target);
        return target;
      },
      disconnect() {
        this.connections.length = 0;
      },
      start(time = 0) {
        this.started = time;
      },
      stop(time = 0) {
        this.stopped = time;
      },
    };
    this.nodes.push(node);
    return node;
  }
  createGain() {
    return this.node('gain');
  }
  createBiquadFilter() {
    return this.node('filter');
  }
  createDynamicsCompressor() {
    return this.node('compressor');
  }
  createBufferSource() {
    return this.node('buffer');
  }
  createOscillator() {
    return this.node('oscillator');
  }
  createStereoPanner() {
    return this.node('panner');
  }
  createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: (channel) => data[channel] };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}
