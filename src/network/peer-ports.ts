export interface ConnectionPort {
  readonly peer: string;
  readonly open: boolean;
  on(event: 'data', listener: (value: unknown) => void): unknown;
  on(event: 'close' | 'error', listener: () => void): unknown;
  off(event: 'data', listener: (value: unknown) => void): unknown;
  off(event: 'close' | 'error', listener: () => void): unknown;
  send(value: unknown): void;
  close(): void;
}

export interface DiscoveryPeerPort {
  readonly id: string;
  connect(
    id: string,
    options: { reliable: true; serialization: 'json'; metadata: object },
  ): ConnectionPort | undefined;
  on(event: 'error', listener: (value: unknown) => void): unknown;
  off(event: 'error', listener: (value: unknown) => void): unknown;
  destroy(): void;
}
