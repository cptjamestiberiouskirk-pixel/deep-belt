import type {DialogueChannel, DialogueClip} from '../content/dialogue-audio';

export const EFFECT_CUES = [
  'laser-start',
  'laser-loop',
  'ore-yield',
  'laser-overheat',
  'asteroid-fracture',
  'engine-loop',
  'align',
  'warp-entry',
  'warp-loop',
  'warp-exit',
  'jump-gate',
  'dock-clamp',
  'undock',
  'station-door',
  'station-roomtone',
  'lock-search',
  'lock-confirm',
  'laser-weapon',
  'cannon',
  'rockets',
  'shield-hit',
  'hull-hit',
  'shield-boost',
  'enemy-explosion',
  'ship-destruction',
  'wreck-open',
  'salvage',
  'refine',
  'fabricate',
  'module-fit',
  'deploy-structure',
  'scan-start',
  'scan-found',
  'rift-open',
  'rift-alarm',
  'rift-collapse',
  'rift-hack',
  'warden-pulse',
  'ui-tick',
  'ui-confirm',
  'ui-warning',
  'mission-accept',
  'progression',
] as const;

export type EffectCue = typeof EFFECT_CUES[number];
export const SHIP_LINES = {
  warpEngaged: 'ship-01',
  warpComplete: 'ship-02',
  autopilotEngaged: 'ship-03',
  autopilotDisengaged: 'ship-04',
  waypointReached: 'ship-05',
  dockingComplete: 'ship-06',
  undocking: 'ship-07',
  jumpGateActivated: 'ship-08',
  jumpComplete: 'ship-09',
  targetLocked: 'ship-10',
  targetLockLost: 'ship-11',
  insufficientCapacitor: 'ship-12',
  cargoHoldFull: 'ship-13',
} as const;

export type ShipLine = keyof typeof SHIP_LINES;
type VoiceCue = DialogueClip | typeof SHIP_LINES[ShipLine];
type AudioCue = EffectCue | VoiceCue;
type EffectChannel = 'mining' | 'mining-start' | 'engine' | 'station' | 'warp-align' | 'warp-entry' | 'warp-cruise';

export type EffectOptions = {
  volume?: number;
  channel?: EffectChannel;
  loop?: boolean;
  duration?: number;
};

type ActiveEffect = {
  source?: AudioBufferSourceNode;
  gain?: GainNode;
};

export class SoundEffects {
  private readonly buffers = new Map<AudioCue, Promise<AudioBuffer | null>>();
  private readonly failed = new Set<AudioCue>();
  private readonly active = new Map<EffectChannel, ActiveEffect>();

  private load(ctx: AudioContext, cue: AudioCue, voice = false) {
    let buffer = this.buffers.get(cue);
    if (!buffer) {
      const path = voice ? `assets/audio/voice/${cue}.mp3` : `assets/audio/effects/${cue}.wav`;
      buffer = fetch(path)
        .then(response => {
          if (!response.ok) throw new Error('Sound asset could not be loaded');
          return response.arrayBuffer();
        })
        .then(bytes => ctx.decodeAudioData(bytes))
        .catch(() => {
          this.failed.add(cue);
          return null;
        });
      this.buffers.set(cue, buffer);
    }
    return buffer;
  }

  private voiceTail: Promise<void> = Promise.resolve();
  private voiceSession = 0;
  private speaking: AudioBufferSourceNode | null = null;
  private dialogue = new Map<DialogueChannel, AbortController>();
  private warningTimes = new Map<ShipLine, number>();

  speak(ctx: AudioContext, out: AudioNode, line: ShipLine) {
    const now = performance.now();
    if (line === 'insufficientCapacitor' || line === 'cargoHoldFull') {
      if (now - (this.warningTimes.get(line) ?? -Infinity) < 5000) return;
      this.warningTimes.set(line, now);
    }
    this.queueVoice(ctx, out, SHIP_LINES[line], now + 8000);
  }

  sayDialogue(ctx: AudioContext, out: AudioNode, clip: DialogueClip, channel: DialogueChannel) {
    this.stopDialogue(channel);
    const controller = new AbortController();
    this.dialogue.set(channel, controller);
    this.queueVoice(ctx, out, clip, Infinity, controller.signal);
  }

  stopDialogue(channel: DialogueChannel) {
    this.dialogue.get(channel)?.abort();
    this.dialogue.delete(channel);
  }

  private queueVoice(ctx: AudioContext, out: AudioNode, cue: VoiceCue, expires: number, signal?: AbortSignal) {
    const session = this.voiceSession;
    const buffer = this.load(ctx, cue, true);
    this.voiceTail = this.voiceTail.then(async () => {
      const audio = await buffer;
      if (!audio || session !== this.voiceSession || signal?.aborted || performance.now() > expires) return;
      const source = ctx.createBufferSource();
      source.buffer = audio;
      source.connect(out);
      this.speaking = source;
      const stop = () => source.stop();
      signal?.addEventListener('abort', stop, {once: true});
      try {
        await new Promise<void>(resolve => {
          source.onended = () => resolve();
          source.start();
        });
      } finally {
        signal?.removeEventListener('abort', stop);
        source.disconnect();
        if (this.speaking === source) this.speaking = null;
      }
    }).catch(() => {});
  }

  stopVoice() {
    this.stopDialogue('character');
    this.stopDialogue('coach');
    this.voiceSession++;
    this.speaking?.stop();
    this.speaking = null;
    this.voiceTail = Promise.resolve();
    this.warningTimes.clear();
  }

  has(channel: EffectChannel) {
    return this.active.has(channel);
  }

  setVolume(channel: EffectChannel, volume: number) {
    const gain = this.active.get(channel)?.gain;
    if (gain) gain.gain.setTargetAtTime(volume, gain.context.currentTime, 0.08);
  }

  play(ctx: AudioContext, out: AudioNode, cue: EffectCue, options: EffectOptions = {}) {
    if (this.failed.has(cue)) return false;
    const {channel, loop = false, volume = 0.65, duration} = options;
    if (channel && this.active.has(channel)) return true;
    const effect: ActiveEffect = {};
    if (channel) this.active.set(channel, effect);
    const expires = performance.now() + 1600;

    void this.load(ctx, cue).then(buffer => {
      if (channel && this.active.get(channel) !== effect) return;
      if (!buffer || (!loop && performance.now() > expires)) {
        if (channel) this.active.delete(channel);
        return;
      }

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = loop;
      if (duration) source.playbackRate.value = buffer.duration / duration;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(out);
      effect.source = source;
      effect.gain = gain;

      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (channel && this.active.get(channel) === effect) this.active.delete(channel);
      };
      source.start();
    });
    return true;
  }

  stop(channel: EffectChannel, fade = 0.06) {
    const effect = this.active.get(channel);
    this.active.delete(channel);
    if (!effect?.source || !effect.gain) return;
    const now = effect.source.context.currentTime;
    const level = effect.gain.gain;
    level.cancelScheduledValues(now);
    level.setValueAtTime(level.value, now);
    level.linearRampToValueAtTime(0, now + fade);
    effect.source.stop(now + fade);
  }
}
