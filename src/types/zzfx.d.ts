declare module "zzfx" {
  export const ZZFX: {
    volume: number;
    audioContext: AudioContext;
  };
  export function zzfx(...parameters: number[]): unknown;
}
