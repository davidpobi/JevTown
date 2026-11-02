"use client";

export type SoundEvent = "start" | "discover" | "pickup" | "clash" | "steal" | "win";

type SoundProfile = "jevx" | "jevtown";

const soundParameters: Record<SoundProfile, Record<SoundEvent, number[]>> = {
  jevx: {
    start: [0.45, 0.02, 140, 0.01, 0.08, 0.2, 1, 1.3, 0.08],
    discover: [0.35, 0.04, 660, 0.01, 0.07, 0.18, 1, 1.9, 0.12],
    pickup: [0.46, 0.02, 330, 0.01, 0.08, 0.26, 1, 1.8, 0.18],
    clash: [0.58, 0.03, 105, 0.01, 0.09, 0.23, 3, 1.1, -0.18, 0, 0, 0, 0.18],
    steal: [0.48, 0.03, 300, 0.01, 0.08, 0.32, 2, 1.3, -0.24],
    win: [0.52, 0.02, 440, 0.02, 0.16, 0.6, 1, 1.8, 0.18, 0, 6],
  },
  jevtown: {
    start: [0.38, 0.04, 392, 0.01, 0.1, 0.23, 1, 1.5, 0.09],
    discover: [0.32, 0.03, 740, 0.01, 0.08, 0.22, 0, 1.4, 0.08],
    pickup: [0.45, 0.02, 523, 0.01, 0.1, 0.32, 1, 1.55, 0.12],
    clash: [0.48, 0.03, 145, 0.01, 0.07, 0.21, 2, 1.1, -0.12, 0, 0, 0, 0.1],
    steal: [0.42, 0.03, 260, 0.01, 0.08, 0.28, 0, 1.2, -0.16],
    win: [0.5, 0.02, 523, 0.02, 0.18, 0.62, 1, 1.45, 0.12, 0, 7],
  },
};

export class GameSound {
  private muted: boolean;
  private musicPlaying = false;
  private music: { stop: () => unknown; dispose: () => unknown } | null = null;
  private readonly storageKey: string;

  constructor(private readonly profile: SoundProfile) {
    this.storageKey = `${profile}:sound-muted`;
    this.muted = typeof window !== "undefined" && window.localStorage.getItem(this.storageKey) === "true";
  }

  isMuted() { return this.muted; }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (typeof window !== "undefined") window.localStorage.setItem(this.storageKey, String(muted));
    if (muted) this.stopMusic();
  }

  async play(event: SoundEvent) {
    if (this.muted || typeof window === "undefined") return;
    try {
      const { ZZFX, zzfx } = await import("zzfx");
      await ZZFX.audioContext.resume();
      ZZFX.volume = 0.22;
      zzfx(...soundParameters[this.profile][event]);
    } catch {
      // Sound is optional: unsupported or blocked audio must never affect play.
    }
  }

  async startMusic() {
    if (this.muted || this.musicPlaying || typeof window === "undefined") return;
    try {
      const Tone = await import("tone");
      await Tone.start();
      const isJevX = this.profile === "jevx";
      const bed = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: isJevX ? "fatsawtooth" : "triangle" },
        envelope: { attack: isJevX ? 1.2 : 0.42, decay: 0.28, sustain: 0.16, release: 1.1 },
      }).toDestination();
      const rhythm = isJevX
        ? new Tone.FMSynth({ harmonicity: 1.5, modulationIndex: 7, envelope: { attack: 0.01, decay: 0.12, sustain: 0.1, release: 0.38 } }).toDestination()
        : new Tone.PluckSynth({ attackNoise: 0.35, dampening: 2_800, resonance: 0.72 }).toDestination();
      const accent = new Tone.Synth({
        oscillator: { type: isJevX ? "sine" : "sine" },
        envelope: { attack: 0.03, decay: 0.12, sustain: 0.02, release: 0.6 },
      }).toDestination();
      bed.volume.value = isJevX ? -39 : -36;
      rhythm.volume.value = isJevX ? -29 : -32;
      accent.volume.value = isJevX ? -37 : -43;

      const bedSequence = new Tone.Sequence((time, chord) => {
        bed.triggerAttackRelease(chord, "1m", time);
      }, isJevX
        ? [["C2", "G2", "D#3"], ["A#1", "F2", "D3"], ["G1", "D2", "A#2"], ["D#2", "A#2", "G3"]]
        : [["C4", "E4", "G4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"], ["G3", "B3", "D4"]], "1m");
      const rhythmSequence = new Tone.Sequence((time, note) => {
        if (note) rhythm.triggerAttackRelease(note, isJevX ? "16n" : "8n", time);
      }, isJevX
        ? ["C2", null, "G2", null, "D#2", "G2", null, "A#1"]
        : ["C4", null, "E4", null, "A4", null, "G4", null], "4n");
      const accentSequence = new Tone.Sequence((time, note) => {
        if (note) accent.triggerAttackRelease(note, "8n", time);
      }, isJevX
        ? [null, "D#5", null, null, "G5", null, "A#5", null]
        : ["G5", null, null, "E5", null, "A5", null, null], "2n");

      Tone.getTransport().bpm.value = isJevX ? 82 : 88;
      bedSequence.start(0);
      rhythmSequence.start(0);
      accentSequence.start(0);
      Tone.getTransport().start();
      this.music = {
        stop: () => { bedSequence.stop(); rhythmSequence.stop(); accentSequence.stop(); },
        dispose: () => { bedSequence.dispose(); rhythmSequence.dispose(); accentSequence.dispose(); bed.dispose(); rhythm.dispose(); accent.dispose(); },
      };
      this.musicPlaying = true;
    } catch {
      // A blocked audio context or unavailable API leaves the game fully playable.
    }
  }

  stopMusic() {
    this.music?.stop();
    this.music?.dispose();
    this.music = null;
    this.musicPlaying = false;
  }

  dispose() { this.stopMusic(); }
}
