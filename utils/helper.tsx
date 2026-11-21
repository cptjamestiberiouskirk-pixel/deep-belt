// tslint:disable
/* eslint-disable */
import React, {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import type {DialogueChannel, DialogueClip} from '../content/dialogue-audio';
import {SoundEffects, type EffectCue, type EffectOptions, type ShipLine} from './sound-effects';

/**  --- Overlay component ---
 * A full-screen UI overlay component used to display game states
 * such as Start Menus, Pause Screens, Game Over, and Victory screens.
 * It renders a semi-transparent background with a title, optional description,
 * and a primary action button.
 */

type OverlayTone = 'neutral' | 'danger' | 'victory';

interface OverlayProps {
  title: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
  icon?: React.ReactNode;
  tone?: OverlayTone;
  autoFocus?: boolean;
}

const TONE_CLASS: Record<OverlayTone, string> = {
  neutral: 'bg-[#0A0E1A]/80 backdrop-blur-sm',
  danger: 'bg-[#0A0E1A]/85 backdrop-blur-sm',
  victory: 'bg-[#0A0E1A]/85 backdrop-blur-sm',
};

const BUTTON_CLASS: Record<OverlayTone, string> = {
  neutral: 'bg-[#2EC4B6] hover:bg-[#3bf1e0] text-[#0A0E1A]',
  danger: 'bg-[#FF5A5F] hover:bg-[#ff7579] text-[#0A0E1A]',
  victory: 'bg-[#8BD17C] hover:bg-[#9ee48f] text-[#0A0E1A]',
};

/**
 * @param title - The main, large heading text to display (e.g., "GAME OVER").
 * @param description - Optional subtitle text to display below the title (e.g., "Final Score: 42").
 * @param actionLabel - The text to display inside the primary action button (e.g., "PLAY AGAIN").
 * @param onAction - Callback function executed when the user clicks the primary action button.
 * @param icon - Optional React node (like a Lucide icon) rendered inside the action button next to the label.
 * @param tone - The visual theme of the overlay which dictates background and hover colors. Defaults to 'neutral'. ('neutral' | 'danger' | 'victory')
 */
/** Focuses the referenced element on mount to ensure Enter works. */
export function useAutoFocus<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    // Only focus if enabled is true
    if (enabled && ref.current) {
      ref.current.focus();
    }
  }, [enabled]);
  return ref;
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return (
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    !el.closest('[inert]')
  );
}

function getActiveTvScope(): HTMLElement | null {
  const scopes = Array.from(
    document.querySelectorAll<HTMLElement>('[data-tv-scope]'),
  ).filter(isVisible);
  return scopes.length ? scopes[scopes.length - 1] : null;
}

/**
 * Auto-focuses the primary action button inside an overlay on mount and enables
 * D-pad arrow key focus navigation across focusable controls while cooperating
 * with `tv.tsx` (`useTvFocusRover`, `useTvModalStack`, and `TvScrollArea`).
 */
export function useOverlayFocusNavigation(
  containerRef: RefObject<HTMLDivElement | null>,
  autoFocus = true,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (autoFocus && container) {
      const activeScope = getActiveTvScope();
      const isBlockedByExternalScope =
        activeScope != null &&
        !container.contains(activeScope) &&
        !activeScope.contains(container);
      const active = document.activeElement;
      const alreadyFocusedInside =
        active instanceof HTMLElement &&
        active !== document.body &&
        container.contains(active);
      if (!isBlockedByExternalScope && !alreadyFocusedInside) {
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [data-tv-focusable]',
          ),
        );
        const target =
          container.querySelector<HTMLElement>(
            '[data-testid="start-button"]',
          ) ??
          focusables.find(isVisible) ??
          focusables[0];
        target?.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const currentContainer = containerRef.current;
      if (!currentContainer) return;
      const isNext =
        e.key === 'ArrowDown' ||
        e.key === 'ArrowRight' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowRight';
      const isPrev =
        e.key === 'ArrowUp' ||
        e.key === 'ArrowLeft' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowLeft';
      if (!isNext && !isPrev) return;

      const activeScope = getActiveTvScope();
      if (
        activeScope != null &&
        !currentContainer.contains(activeScope) &&
        !activeScope.contains(currentContainer)
      ) {
        return;
      }
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        !(active instanceof HTMLCanvasElement) &&
        !currentContainer.contains(active)
      ) {
        return;
      }

      const scopeRoot =
        activeScope != null && currentContainer.contains(activeScope)
          ? activeScope
          : currentContainer;
      const items = Array.from(
        scopeRoot.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [data-tv-focusable]',
        ),
      ).filter(isVisible);
      if (!items.length) return;

      const index = active instanceof HTMLElement ? items.indexOf(active) : -1;
      const step = isNext ? 1 : -1;
      const next =
        index < 0
          ? items[0]
          : items[(index + step + items.length) % items.length];
      e.preventDefault();
      next.focus();
      next.scrollIntoView({block: 'nearest'});
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, autoFocus]);
}

export function Overlay({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  tone = 'neutral',
  autoFocus = true,
}: OverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useOverlayFocusNavigation(containerRef, autoFocus);

  const titleBandBg = tone === 'danger' ? '#FF5A5F' : tone === 'victory' ? '#8BD17C' : '#2EC4B6';

  return (
    <div
      ref={containerRef}
      data-overlay-container=""
      className={`absolute inset-0 ${TONE_CLASS[tone]} overflow-y-auto touch-auto z-50`}>
      <div className="min-h-full flex flex-col items-center justify-center p-4">
        <div
          style={{
            background: 'var(--panel, #1A2133)',
            border: '3px solid var(--ink, #0A0E1A)',
            borderRadius: '14px',
            boxShadow: '4px 4px 0 #0A0E1A',
            maxWidth: '480px',
            width: '100%',
            overflow: 'hidden',
          }}>
          <div
            style={{
              height: '32px',
              background: titleBandBg,
              color: 'var(--ink, #0A0E1A)',
              fontFamily: "'Fredoka', cursive, sans-serif",
              fontWeight: 700,
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              borderBottom: '3px solid var(--ink, #0A0E1A)',
            }}>
            {title}
          </div>
          <div style={{padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'}}>
            {description && (
              <p style={{fontFamily: "'Inter', sans-serif", fontSize: '14px', color: 'var(--text, #F6EED8)', textAlign: 'center', margin: 0}}>
                {description}
              </p>
            )}
            <button
              autoFocus={autoFocus}
              onClick={onAction}
              data-testid="start-button"
              style={{
                borderRadius: '12px',
                border: '3px solid var(--ink, #0A0E1A)',
                minWidth: '44px',
                minHeight: '36px',
                background: titleBandBg,
                color: 'var(--ink, #0A0E1A)',
                boxShadow: '3px 3px 0 var(--ink, #0A0E1A)',
                fontFamily: "'Fredoka', cursive, sans-serif",
                fontWeight: 700,
                fontSize: '16px',
                padding: '8px 20px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}>
              {icon}
              <span>{actionLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface MenuOverlayProps {
  children: React.ReactNode;
  tone?: OverlayTone;
  zIndex?: number;
  autoFocus?: boolean;
}

/**
 * A highly resilient menu wrapper that statically decouples scrolling from flexbox alignment.
 * It strictly avoids the clipping bug on mobile by preventing flex justify-center from being assigned
 * to the overflow-y-auto boundary. Plugs seamlessly into the AI's generation workflows.
 * The inner children should provide their own box styling (e.g., w-full max-w-md bg-slate-900 rounded).
 */
export function MenuOverlay({
  children,
  tone = 'neutral',
  zIndex = 40,
  autoFocus = true,
}: MenuOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useOverlayFocusNavigation(containerRef, autoFocus);

  return (
    <div
      ref={containerRef}
      data-overlay-container=""
      className={`absolute inset-0 ${TONE_CLASS[tone]} overflow-y-auto touch-auto`}
      style={{zIndex}}>
      <div className="min-h-full flex flex-col items-center p-4">
        <div className="m-auto w-full max-w-md flex flex-col items-center">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Actions that can be triggered by the user. */
export type InputAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'confirm'
  | 'cancel'
  | 'tap';

/** Represents the state of the pointer (mouse or touch). */
export interface PointerState {
  /** The X coordinate of the pointer. */
  x: number;
  /** The Y coordinate of the pointer. */
  y: number;
  /** Whether the pointer is currently pressed down. */
  down: boolean;
}

/** A snapshot of the input state at a specific frame. */
export interface InputSnapshot {
  /** Map of actions to their active state. */
  actions: Record<InputAction, boolean>;
  /** The current state of the pointer. */
  pointer: PointerState;
}

interface LogicalSize {
  width: number;
  height: number;
}

interface AndroidTvWindow extends Window {
  /** Injected by Android TV WebView when the host handles the Back key. */
  canHandleBackKey?: boolean;
}

const ACTION_KEYS: Record<string, InputAction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  Enter: 'confirm',
  ' ': 'confirm',
  Space: 'confirm',
  Escape: 'cancel',
};

/**
 * Initializes all input actions to a default 'false' state.
 */
const createEmptyActions = (): Record<InputAction, boolean> => ({
  left: false,
  right: false,
  up: false,
  down: false,
  confirm: false,
  cancel: false,
  tap: false,
});

/**
 * Calculates the pointer's logical X/Y coordinates on the canvas.
 */
const getPointerPosition = (
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  logicalSize?: LogicalSize,
): {x: number; y: number} => {
  const rect = canvas.getBoundingClientRect();
  const width = logicalSize?.width ?? rect.width;
  const height = logicalSize?.height ?? rect.height;
  const x = (event.clientX - rect.left) * (width / rect.width);
  const y = (event.clientY - rect.top) * (height / rect.height);
  return {x, y};
};

/**
 * Hook to capture and manage user input (keyboard and pointer).
 * @param canvasRef Reference to the game canvas element.
 * @param enabled Whether input capture is enabled.
 * @param logicalSize Optional logical size of the canvas for coordinate scaling.
 * @returns A mutable ref containing the current input snapshot.
 */
export const useInput = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  enabled = true,
  logicalSize?: LogicalSize,
): MutableRefObject<InputSnapshot> => {
  const inputRef = useRef<InputSnapshot>({
    actions: createEmptyActions(),
    pointer: {x: 0, y: 0, down: false},
  });

  useEffect(() => {
    if (!enabled) {
      inputRef.current.actions = createEmptyActions();
      inputRef.current.pointer = {x: 0, y: 0, down: false};
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = ACTION_KEYS[event.key] ?? ACTION_KEYS[event.code];
      if (!action) return;
      const isArrowOrSpace =
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(
          event.key,
        ) ||
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          event.code,
        );
      const isEscapeWithHandshake =
        (event.key === 'Escape' || event.code === 'Escape') &&
        Boolean((window as AndroidTvWindow).canHandleBackKey);
      if (isEscapeWithHandshake) {
        event.preventDefault();
      } else if (isArrowOrSpace) {
        const active = document.activeElement;
        const isUiControlFocused =
          active instanceof HTMLElement &&
          active.matches(
            'button:not([disabled]), [data-tv-focusable], input, select, textarea',
          );
        const hasVisibleOverlayOrModal = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-overlay-container], [data-tv-scope]',
          ),
        ).some(isVisible);
        if (!isUiControlFocused && !hasVisibleOverlayOrModal) {
          event.preventDefault();
        }
      }
      inputRef.current.actions[action] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = ACTION_KEYS[event.key] ?? ACTION_KEYS[event.code];
      if (!action) return;
      inputRef.current.actions[action] = false;
    };

    const canvas = canvasRef.current;
    const handlePointerDown = (event: PointerEvent) => {
      if (!canvas) return;
      if (typeof canvas.setPointerCapture === 'function') {
        canvas.setPointerCapture(event.pointerId);
      }
      inputRef.current.pointer = {
        ...getPointerPosition(event, canvas, logicalSize),
        down: true,
      };
      inputRef.current.actions.tap = true;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!canvas) return;
      inputRef.current.pointer = {
        ...getPointerPosition(event, canvas, logicalSize),
        down: inputRef.current.pointer.down,
      };
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!canvas) return;
      if (
        typeof canvas.releasePointerCapture === 'function' &&
        canvas.hasPointerCapture(event.pointerId)
      ) {
        canvas.releasePointerCapture(event.pointerId);
      }
      inputRef.current.pointer = {
        ...getPointerPosition(event, canvas, logicalSize),
        down: false,
      };
      inputRef.current.actions.tap = false;
    };

    const handleBlur = () => {
      inputRef.current.actions = createEmptyActions();
      if (inputRef.current.pointer) {
        inputRef.current.pointer.down = false;
      }
      inputRef.current.actions.tap = false;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBlur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (canvas) {
      canvas.addEventListener('pointerdown', handlePointerDown);
      canvas.addEventListener('pointermove', handlePointerMove);
      canvas.addEventListener('pointerup', handlePointerUp);
      canvas.addEventListener('pointercancel', handlePointerUp);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (canvas) {
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
        canvas.removeEventListener('pointercancel', handlePointerUp);
      }
    };
  }, [canvasRef, enabled]);

  return inputRef;
};

/**
 * audio.ts — procedural sound effects via the Web Audio API.
 *
 * No asset files, no network: every sound is synthesized on the fly. Import the
 * shared `gameAudio` singleton, insert required SFX methods, and call them:
 *
 *   import { gameAudio } from './utils/helper';
 *
 *   // After inserting playArcadeLaser:
 *   gameAudio.playArcadeLaser();         // on shoot
 *
 * Autoplay: browsers block audio until the first user gesture. This module
 * unlocks itself on the first pointer/key/touch event, and every play call also
 * resumes the context — so it is safe to call any method at any time; calls made
 * before the first interaction simply no-op instead of throwing.
 *
 * Volume & mute are global (master): gameAudio.setVolume(0.4),
 * gameAudio.toggleMute().
 */

interface Beat {
  ctx: AudioContext;
  out: GainNode;
  now: number;
}

interface MiningLaserSession {
  masterGain: GainNode;
  tremoloGain: GainNode;
  hpFilter: BiquadFilterNode;
  lpFilter: BiquadFilterNode;
  startupOsc?: OscillatorNode;
  startupGain?: GainNode;
  sawOsc: OscillatorNode;
  sqrOsc: OscillatorNode;
  coreFilter: BiquadFilterNode;
  coreGain: GainNode;
  shimmerOsc: OscillatorNode;
  shimmerLfo: OscillatorNode;
  shimmerLfoGain: GainNode;
  shimmerGain: GainNode;
  crackleSource: AudioBufferSourceNode;
  crackleFilter: BiquadFilterNode;
  crackleGain: GainNode;
  tremoloLfo: OscillatorNode;
  tremoloLfoGain: GainNode;
  isStopping: boolean;
  stopTimeout?: any;
}

class GameAudio {
  private readonly effects = new SoundEffects();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  public sfxGain: GainNode | null = null;
  public musicGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private shipVoiceInput: BiquadFilterNode | null = null;
  private voiceVolume = 0.72;
  private miningBus: GainNode | null = null;

  public get sfxGainNode(): GainNode | null {
    return this.sfxGain;
  }
  public get musicGainNode(): GainNode | null {
    return this.musicGain;
  }

  // Bus volume levels (defaults: music 60%, SFX 30%)
  private musicVolume = 0.60;
  private sfxVolume = 0.30;
  private sfxMuted = false;
  private musicMuted = false;

  // Single reused audio elements for ambient loops
  private spaceAudio: HTMLAudioElement | null = null;
  private stationAudio: HTMLAudioElement | null = null;
  private spaceGain: GainNode | null = null;
  private stationGain: GainNode | null = null;
  private isMusicActive = false;
  private isDockedState = false;
  private isRiftState = false;
  private spaceWeight = 1.0;
  private stationWeight = 0.0;
  private crossfadeRafId: number | null = null;
  private riftDroneSession: {
    masterGain: GainNode;
    nodes: Array<{ stop?: () => void; disconnect: () => void }>;
  } | null = null;

  // Deterministic pitch cycling: -5% (0.95x), 0% (1.00x), +5% (1.05x)
  private pitchIndices: Record<string, number> = {};

  // Continuous sound references
  private miningSession: MiningLaserSession | null = null;

  private hullHumGain: GainNode | null = null;
  private hullHumOsc: OscillatorNode | null = null;
  private isHullHumActive = false;

  private warpSpoolGain: GainNode | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedMusic =
          localStorage.getItem('musicVolume') ??
          localStorage.getItem('deep_belt_music_volume');
        if (savedMusic !== null) {
          const val = parseFloat(savedMusic);
          if (!isNaN(val)) this.musicVolume = Math.max(0, Math.min(1, val));
        }
        const savedVoice = localStorage.getItem('deep_belt_voice_volume');
        if (savedVoice !== null && Number.isFinite(Number(savedVoice))) {
          this.voiceVolume = Math.max(0, Math.min(1, Number(savedVoice)));
        }
        const savedSfx =
          localStorage.getItem('sfxVolume') ??
          localStorage.getItem('deep_belt_sfx_volume');
        if (savedSfx !== null) {
          const val = parseFloat(savedSfx);
          if (!isNaN(val)) this.sfxVolume = Math.max(0, Math.min(1, val));
        }
      } catch (_) {}

      this.attachUnlock();
    }
  }

  /**
   * Deterministic Pitch Cycling:
   * Repeated SFX cycle base frequency through -5% (0.95x), 0% (1.00x), +5% (1.05x)
   * looping deterministically 0 -> 1 -> 2 -> 0 -> 1 -> 2. No random rolls!
   */
  public getNextPitch(key = 'default'): number {
    const cycle = [0.95, 1.00, 1.05];
    const cur = this.pitchIndices[key] ?? 0;
    const mult = cycle[cur];
    this.pitchIndices[key] = (cur + 1) % 3;
    return mult;
  }

  // --- Context lifecycle ---
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    const Ctor =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext?: typeof AudioContext})
        .webkitAudioContext;
    if (!Ctor) {
      console.warn('[audio] Web Audio API not supported');
      return null;
    }

    this.ctx = new Ctor();

    // Master destination gain
    this.master = this.ctx.createGain();
    this.master.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.master.connect(this.ctx.destination);

    // SFX master bus (default 30%)
    this.sfxGain = this.ctx.createGain();
    const effectiveSfx = this.sfxMuted ? 0 : this.sfxVolume;
    this.sfxGain.gain.setValueAtTime(effectiveSfx, this.ctx.currentTime);
    this.sfxGain.connect(this.master);

    // A narrow radio band gives the ship computer its own tone.
    this.voiceGain = this.ctx.createGain();
    this.voiceGain.gain.value = this.voiceVolume * 0.85;
    this.voiceGain.connect(this.master);
    this.shipVoiceInput = this.ctx.createBiquadFilter();
    this.shipVoiceInput.type = 'highpass';
    this.shipVoiceInput.frequency.value = 160;
    const voiceLowpass = this.ctx.createBiquadFilter();
    voiceLowpass.type = 'lowpass';
    voiceLowpass.frequency.value = 5200;
    this.shipVoiceInput.connect(voiceLowpass);
    voiceLowpass.connect(this.voiceGain);

    // Music master bus (default 60%)
    this.musicGain = this.ctx.createGain();
    const effectiveMusic = this.musicMuted ? 0 : this.musicVolume;
    this.musicGain.gain.setValueAtTime(effectiveMusic, this.ctx.currentTime);
    this.musicGain.connect(this.master);

    // Mining laser sub-bus (connected to SFX bus)
    this.miningBus = this.ctx.createGain();
    this.miningBus.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.miningBus.connect(this.sfxGain);

    this.initMusicWebAudio();
    this.attachUnlock();
    return this.ctx;
  }

  private attachUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      void this.ctx?.resume().catch(() => {});
      this.initMusicElements();
      if (this.isMusicActive) {
        if (this.spaceAudio && this.spaceAudio.paused)
          this.spaceAudio.play().catch(() => {});
        if (this.stationAudio && this.stationAudio.paused)
          this.stationAudio.play().catch(() => {});
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  resume() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
  }

  private begin(): Beat | null {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain || this.sfxMuted) return null;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return {ctx, out: this.sfxGain, now: ctx.currentTime};
  }

  playEffect(cue: EffectCue, options?: EffectOptions) {
    if (this.sfxMuted || this.sfxVolume === 0) return true;
    const beat = this.begin();
    return beat ? this.effects.play(beat.ctx, beat.out, cue, options) : false;
  }

  speak(line: ShipLine) {
    if (this.voiceVolume === 0) return;
    const ctx = this.ensure();
    if (!ctx || !this.shipVoiceInput) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    this.effects.speak(ctx, this.shipVoiceInput, line);
  }

  sayDialogue(clip: DialogueClip, channel: DialogueChannel) {
    const ctx = this.ensure();
    if (!ctx || !this.voiceGain || this.voiceVolume === 0) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    this.effects.sayDialogue(ctx, this.voiceGain, clip, channel);
  }

  stopDialogue(channel: DialogueChannel) {
    this.effects.stopDialogue(channel);
  }

  getVoiceVolume() {
    return this.voiceVolume;
  }

  setVoiceVolume(volume: number) {
    this.voiceVolume = Math.max(0, Math.min(1, volume));
    try {
      localStorage.setItem('deep_belt_voice_volume', String(this.voiceVolume));
    } catch (_) {}
    if (this.ctx && this.voiceGain) {
      this.voiceGain.gain.setTargetAtTime(this.voiceVolume * 0.85, this.ctx.currentTime, 0.03);
    }
    if (this.voiceVolume === 0) this.effects.stopVoice();
  }

  setStationAmbience(active: boolean) {
    if (active && !this.sfxMuted && this.sfxVolume > 0) {
      this.playEffect('station-roomtone', {channel: 'station', loop: true, volume: 0.10});
    } else {
      this.effects.stop('station', 0.25);
    }
  }

  // --- Volume & Mute Controls ---
  getMusicVolume(): number {
    return this.musicVolume;
  }
  getSfxVolume(): number {
    return this.sfxVolume;
  }
  getMusicMuted(): boolean {
    return this.musicMuted;
  }
  getSfxMuted(): boolean {
    return this.sfxMuted;
  }
  getMuteState(): boolean {
    return this.sfxMuted;
  }

  setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem('musicVolume', String(this.musicVolume));
      localStorage.setItem('deep_belt_music_volume', String(this.musicVolume));
    } catch (_) {}
    if (this.ctx && this.musicGain) {
      const target = this.musicMuted ? 0 : this.musicVolume;
      this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
    this.applyAudioElementVolumes();
  }

  setSfxVolume(v: number) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem('sfxVolume', String(this.sfxVolume));
      localStorage.setItem('deep_belt_sfx_volume', String(this.sfxVolume));
    } catch (_) {}
    if (this.ctx && this.sfxGain) {
      const target = this.sfxMuted ? 0 : this.sfxVolume;
      this.sfxGain.gain.setValueAtTime(target, this.ctx.currentTime);
    }
  }

  toggleMusicMute(): boolean {
    this.musicMuted = !this.musicMuted;
    if (this.ctx && this.musicGain) {
      const target = this.musicMuted ? 0 : this.musicVolume;
      this.musicGain.gain.setValueAtTime(target, this.ctx.currentTime);
    }
    this.applyAudioElementVolumes();
    return this.musicMuted;
  }

  toggleSfxMute(): boolean {
    this.sfxMuted = !this.sfxMuted;
    if (this.ctx && this.sfxGain) {
      const target = this.sfxMuted ? 0 : this.sfxVolume;
      this.sfxGain.gain.setValueAtTime(target, this.ctx.currentTime);
    }
    return this.sfxMuted;
  }

  toggleMute(): boolean {
    return this.toggleSfxMute();
  }

  setMuted(muted: boolean) {
    this.sfxMuted = muted;
    if (this.ctx && this.sfxGain) {
      this.sfxGain.gain.setValueAtTime(
        muted ? 0 : this.sfxVolume,
        this.ctx.currentTime,
      );
    }
  }

  setVolume(v: number) {
    this.setSfxVolume(v);
  }

  // --- AMBIENT MUSIC & CROSSFADE ---
  private initMusicElements() {
    if (typeof window === 'undefined') return;
    if (!this.spaceAudio) {
      this.spaceAudio = new Audio('assets/audio/bgm_space_ambient.mp3');
      this.spaceAudio.loop = true;
      this.spaceAudio.preload = 'auto';
    }
    if (!this.stationAudio) {
      this.stationAudio = new Audio('assets/audio/bgm_station_ambient.mp3');
      this.stationAudio.loop = true;
      this.stationAudio.preload = 'auto';
    }
  }

  private initMusicWebAudio() {
    if (!this.ctx || !this.musicGain) return;
    this.initMusicElements();
    if (!this.spaceGain && this.spaceAudio && this.stationAudio) {
      try {
        this.spaceGain = this.ctx.createGain();
        this.stationGain = this.ctx.createGain();
        this.spaceGain.gain.setValueAtTime(
          this.spaceWeight,
          this.ctx.currentTime,
        );
        this.stationGain.gain.setValueAtTime(
          this.stationWeight,
          this.ctx.currentTime,
        );

        const spaceSource = this.ctx.createMediaElementSource(this.spaceAudio);
        const stationSource = this.ctx.createMediaElementSource(
          this.stationAudio,
        );

        spaceSource.connect(this.spaceGain);
        stationSource.connect(this.stationGain);

        this.spaceGain.connect(this.musicGain);
        this.stationGain.connect(this.musicGain);
      } catch (_) {
        // Fallback: use direct HTMLAudioElement volume interpolation
        this.spaceGain = null;
        this.stationGain = null;
      }
    }
  }

  private applyAudioElementVolumes() {
    const effectiveMusic = this.musicMuted ? 0 : this.musicVolume;
    if (this.spaceAudio) {
      const vol = this.spaceGain
        ? this.isMusicActive
          ? 1.0
          : 0.0
        : Math.max(0, Math.min(1, this.spaceWeight * effectiveMusic));
      this.spaceAudio.volume = vol;
    }
    if (this.stationAudio) {
      const vol = this.stationGain
        ? this.isMusicActive
          ? 1.0
          : 0.0
        : Math.max(0, Math.min(1, this.stationWeight * effectiveMusic));
      this.stationAudio.volume = vol;
    }
  }

  public setMusicPlaying(playing: boolean) {
    this.isMusicActive = playing;
    this.initMusicElements();
    this.ensure();

    if (playing && !this.isRiftState) {
      if (this.spaceAudio && this.spaceAudio.paused) {
        this.spaceAudio.play().catch(() => {});
      }
      if (this.stationAudio && this.stationAudio.paused) {
        this.stationAudio.play().catch(() => {});
      }
    } else {
      if (this.spaceAudio && !this.spaceAudio.paused) {
        this.spaceAudio.pause();
      }
      if (this.stationAudio && !this.stationAudio.paused) {
        this.stationAudio.pause();
      }
    }
    this.applyAudioElementVolumes();
  }

  public setDocked(docked: boolean) {
    if (this.isDockedState === docked) return;
    this.isDockedState = docked;
    if (!this.isRiftState) {
      this.startMusicCrossfade(docked ? 'station' : 'space');
    }
  }

  public setRiftMusic(isRift: boolean) {
    if (this.isRiftState === isRift) return;
    this.isRiftState = isRift;
    if (isRift) {
      if (this.spaceAudio && !this.spaceAudio.paused) this.spaceAudio.pause();
      if (this.stationAudio && !this.stationAudio.paused) this.stationAudio.pause();
      this.startRiftDrone();
    } else {
      this.stopRiftDrone();
      if (this.isMusicActive) {
        this.setMusicPlaying(true);
        this.startMusicCrossfade(this.isDockedState ? 'station' : 'space');
      }
    }
  }

  private startRiftDrone() {
    this.stopRiftDrone();
    const ctx = this.ensure();
    if (!ctx || !this.musicGain) return;
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(0.45, now + 1.2);
    masterGain.connect(this.musicGain);

    // Deep sub drone: 40 Hz sine + 80 Hz triangle through 160 Hz lowpass
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(40, now);

    const subOsc2 = ctx.createOscillator();
    subOsc2.type = 'triangle';
    subOsc2.frequency.setValueAtTime(80, now);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(160, now);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.35, now);

    subOsc.connect(lp);
    subOsc2.connect(lp);
    lp.connect(subGain);
    subGain.connect(masterGain);

    // Atmospheric sweeping subspace drone: 55 Hz with slow LFO
    const midOsc = ctx.createOscillator();
    midOsc.type = 'sawtooth';
    midOsc.frequency.setValueAtTime(55, now);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(3.5, now);
    bp.frequency.setValueAtTime(180, now);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(80, now);
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);

    const midGain = ctx.createGain();
    midGain.gain.setValueAtTime(0.15, now);

    midOsc.connect(bp);
    bp.connect(midGain);
    midGain.connect(masterGain);

    subOsc.start(now);
    subOsc2.start(now);
    midOsc.start(now);
    lfo.start(now);

    this.riftDroneSession = {
      masterGain,
      nodes: [subOsc, subOsc2, lp, subGain, midOsc, bp, lfo, lfoGain, midGain, masterGain],
    };
  }

  private stopRiftDrone() {
    if (!this.riftDroneSession) return;
    const session = this.riftDroneSession;
    this.riftDroneSession = null;
    try {
      const now = this.ctx?.currentTime || 0;
      session.masterGain.gain.cancelScheduledValues(now);
      session.masterGain.gain.setValueAtTime(session.masterGain.gain.value, now);
      session.masterGain.gain.linearRampToValueAtTime(0.0001, now + 1.0);
      setTimeout(() => {
        session.nodes.forEach((n) => {
          try { n.stop?.(); } catch (_) {}
          try { n.disconnect(); } catch (_) {}
        });
      }, 1100);
    } catch (_) {}
  }

  public updateMusic(playing: boolean, docked: boolean, isRift = false) {
    this.setRiftMusic(isRift);
    this.setMusicPlaying(playing && !isRift);
    this.setDocked(docked);
  }

  private startMusicCrossfade(target: 'space' | 'station') {
    this.initMusicElements();
    this.ensure();

    const startSpace = this.spaceWeight;
    const startStation = this.stationWeight;
    const targetSpace = target === 'space' ? 1.0 : 0.0;
    const targetStation = target === 'station' ? 1.0 : 0.0;

    const startTime = performance.now();
    const duration = 1000; // exactly 1.0 second (1000 ms)

    if (this.crossfadeRafId !== null) {
      cancelAnimationFrame(this.crossfadeRafId);
      this.crossfadeRafId = null;
    }

    // Schedule smooth 1.0s WebAudio gain ramp if connected
    if (this.ctx && this.spaceGain && this.stationGain) {
      const now = this.ctx.currentTime;
      this.spaceGain.gain.cancelScheduledValues(now);
      this.stationGain.gain.cancelScheduledValues(now);
      this.spaceGain.gain.setValueAtTime(startSpace, now);
      this.stationGain.gain.setValueAtTime(startStation, now);
      this.spaceGain.gain.linearRampToValueAtTime(targetSpace, now + 1.0);
      this.stationGain.gain.linearRampToValueAtTime(targetStation, now + 1.0);
    }

    // HTMLAudioElement volume interpolation over 1000 ms
    const step = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1.0, elapsed / duration);

      this.spaceWeight = startSpace + (targetSpace - startSpace) * progress;
      this.stationWeight =
        startStation + (targetStation - startStation) * progress;
      this.applyAudioElementVolumes();

      if (progress < 1.0) {
        this.crossfadeRafId = requestAnimationFrame(step);
      } else {
        this.crossfadeRafId = null;
        this.spaceWeight = targetSpace;
        this.stationWeight = targetStation;
        this.applyAudioElementVolumes();
      }
    };

    this.crossfadeRafId = requestAnimationFrame(step);
  }

  // --- Synthesis helpers ---
  private blip(
    b: Beat,
    at: number,
    o: {
      freq: number;
      freqTo?: number;
      dur: number;
      type?: OscillatorType;
      gain?: number;
      glide?: 'exp' | 'lin';
    },
  ) {
    const {ctx, out} = b;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.freq, at);
    if (o.freqTo !== undefined) {
      if ((o.glide ?? 'exp') === 'lin') {
        osc.frequency.linearRampToValueAtTime(o.freqTo, at + o.dur);
      } else {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, o.freqTo),
          at + o.dur,
        );
      }
    }

    const peak = o.gain ?? 0.15;
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);

    osc.connect(g);
    g.connect(out);
    osc.start(at);
    osc.stop(at + o.dur + 0.02);
  }

  private noiseBurst(
    b: Beat,
    at: number,
    o: {dur: number; gain?: number; from?: number; to?: number},
  ) {
    const {ctx, out} = b;
    const len = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(o.from ?? 1000, at);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(1, o.to ?? 80),
      at + o.dur,
    );

    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.18, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start(at);
    src.stop(at + o.dur);
  }

  // --- PROCEDURAL WEB AUDIO SYNTH SFX ---

  /**
   * 1. Lock Beep: High-precision crisp two-tone digital chirp (880 Hz to 1760 Hz, short 80ms decay).
   */
  playLockBeep() {
    if (this.playEffect('lock-search', {volume: 0.32})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('lock_beep');
    const {ctx, out} = b;
    const now = b.now;

    // Tone 1: 880 Hz * p for 40ms
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880 * p, now);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.20, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc1.connect(g1);
    g1.connect(out);
    osc1.start(now);
    osc1.stop(now + 0.042);

    // Tone 2: 1760 Hz * p for 40ms, total 80ms decay
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760 * p, now + 0.04);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.18, now + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc2.connect(g2);
    g2.connect(out);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.082);
  }

  lockBeep() {
    this.playLockBeep();
  }

  playTargetLockBeeps() {
    this.playLockBeep();
  }

  playTargetLockComplete() {
    if (this.playEffect('lock-confirm', {volume: 0.35})) return;
    this.playLockBeep();
  }

  targetLock() {
    this.playLockBeep();
  }

  /**
   * 2. Warp Whoosh: Resonant filtered whoosh / frequency sweep (e.g. bandpass filtered noise or sweeping low-sine 80Hz -> 500Hz -> 100Hz over 1.2s).
   */
  playWarpWhoosh() {
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('warp_whoosh');
    const {ctx, out} = b;
    const now = b.now;
    const dur = 1.2;

    // Resonant bandpass filtered noise sweep
    const bufLen = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bpFilter = ctx.createBiquadFilter();
    bpFilter.type = 'bandpass';
    bpFilter.Q.setValueAtTime(4.5, now);
    bpFilter.frequency.setValueAtTime(120 * p, now);
    bpFilter.frequency.exponentialRampToValueAtTime(900 * p, now + 0.6);
    bpFilter.frequency.exponentialRampToValueAtTime(180 * p, now + dur);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.25, now + 0.55);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    noise.connect(bpFilter);
    bpFilter.connect(noiseGain);
    noiseGain.connect(out);
    noise.start(now);
    noise.stop(now + dur + 0.05);

    // Sweeping low-sine 80Hz -> 500Hz -> 100Hz over 1.2s
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80 * p, now);
    osc.frequency.exponentialRampToValueAtTime(500 * p, now + 0.6);
    osc.frequency.exponentialRampToValueAtTime(100 * p, now + dur);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.exponentialRampToValueAtTime(0.22, now + 0.55);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(oscGain);
    oscGain.connect(out);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  warpWhoosh() {
    this.playWarpWhoosh();
  }

  playWarpSpool() {
    this.playWarpWhoosh();
  }

  warpSpool() {
    this.playWarpWhoosh();
  }

  playWarpDrop() {
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('warp_drop');
    const now = b.now;
    this.noiseBurst(b, now, {dur: 0.12, gain: 0.16, from: 800 * p, to: 40 * p});
    this.blip(b, now, {
      type: 'sine',
      freq: 90 * p,
      freqTo: 28 * p,
      dur: 0.15,
      gain: 0.22,
    });
  }

  warpDrop() {
    this.playWarpDrop();
  }

  // --- PROCEDURAL WARP AUDIO SYNTHESIS PIPELINE ---
  private warpHighpass: BiquadFilterNode | null = null;
  private activeWarpNodes: Array<{ stop?: () => void; disconnect: () => void }> = [];
  private warpCruiseSession: {
    masterGain: GainNode;
    nodes: Array<{ stop?: () => void; disconnect: () => void }>;
  } | null = null;

  private getWarpOutput(): AudioNode | null {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return null;
    if (!this.warpHighpass) {
      this.warpHighpass = ctx.createBiquadFilter();
      this.warpHighpass.type = 'highpass';
      this.warpHighpass.frequency.setValueAtTime(80, ctx.currentTime);
      this.warpHighpass.connect(this.sfxGain);
    }
    return this.warpHighpass;
  }

  startWarpAlignSound(spoolDurationSec = 3.0) {
    this.stopAllWarpSounds();
    if (this.playEffect('align', {channel: 'warp-align', duration: Math.max(0.5, spoolDurationSec), volume: 0.58})) return;
    const ctx = this.ensure();
    if (!ctx || this.sfxMuted) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const out = this.getWarpOutput();
    if (!out) return;

    const now = ctx.currentTime;
    const dur = Math.max(0.5, spoolDurationSec);

    // Charge whine: Sawtooth + Sine oscillator ramping from 300 Hz to 1400 Hz over spool time,
    // through a Bandpass filter (Q = 1.0), gain ramping 0 -> 0.14
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.0, now);
    bp.frequency.setValueAtTime(300, now);
    bp.frequency.exponentialRampToValueAtTime(1400, now + dur);

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(300, now);
    saw.frequency.exponentialRampToValueAtTime(1400, now + dur);

    const sin = ctx.createOscillator();
    sin.type = 'sine';
    sin.frequency.setValueAtTime(300, now);
    sin.frequency.exponentialRampToValueAtTime(1400, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + dur);

    saw.connect(bp);
    sin.connect(bp);
    bp.connect(gain);
    gain.connect(out);

    saw.start(now);
    sin.start(now);
    saw.stop(now + dur + 0.05);
    sin.stop(now + dur + 0.05);

    const nodes = [saw, sin, bp, gain];
    this.activeWarpNodes.push(...nodes);
    setTimeout(() => {
      this.activeWarpNodes = this.activeWarpNodes.filter((n) => !nodes.includes(n as any));
    }, (dur + 0.1) * 1000);
  }

  startWarpEntrySound() {
    this.effects.stop('warp-align');
    this.speak('warpEngaged');
    if (this.playEffect('warp-entry', {channel: 'warp-entry', volume: 0.72})) return;
    const ctx = this.ensure();
    if (!ctx || this.sfxMuted) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const out = this.getWarpOutput();
    if (!out) return;

    const now = ctx.currentTime;
    const dur = 0.9;

    // 0.9s entry burst: Swept noise through bandpass filter (sweeping 200 -> 1200 -> 300 Hz) + sub Sine oscillator (sweeping 140 -> 80 Hz), gain 0.22
    const bufLen = Math.floor(ctx.sampleRate * dur);
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.5, now);
    bp.frequency.setValueAtTime(200, now);
    bp.frequency.exponentialRampToValueAtTime(1200, now + 0.35);
    bp.frequency.exponentialRampToValueAtTime(300, now + dur);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(80, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    noise.connect(bp);
    bp.connect(gain);
    sub.connect(gain);
    gain.connect(out);

    noise.start(now);
    sub.start(now);
    noise.stop(now + dur);
    sub.stop(now + dur);

    const nodes = [noise, bp, sub, gain];
    this.activeWarpNodes.push(...nodes);
    setTimeout(() => {
      this.activeWarpNodes = this.activeWarpNodes.filter((n) => !nodes.includes(n as any));
    }, (dur + 0.05) * 1000);
  }

  startWarpCruiseLoop() {
    if (this.playEffect('warp-loop', {channel: 'warp-cruise', loop: true, volume: 0.27})) return;
    // Only one cruise loop can play at a time
    if (this.warpCruiseSession) {
      try {
        this.warpCruiseSession.masterGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
        this.warpCruiseSession.nodes.forEach((n) => {
          try { n.stop?.(); } catch (_) {}
          try { n.disconnect(); } catch (_) {}
        });
      } catch (_) {}
      this.warpCruiseSession = null;
    }

    const ctx = this.ensure();
    if (!ctx || this.sfxMuted) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const out = this.getWarpOutput();
    if (!out) return;

    const now = ctx.currentTime;

    // Looped noise through bandpass 900 Hz (Q = 0.6) and lowpass 4000 Hz, base gain 0.08, modulated with a subtle 0.4 Hz swell LFO, fading in over 0.4s
    const bufLen = Math.floor(ctx.sampleRate * 2.0);
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900, now);
    bp.Q.setValueAtTime(0.6, now);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4000, now);

    // Subtle 0.4 Hz swell LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.4, now);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.025, now);

    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(0.08, now);

    lfo.connect(lfoGain);
    lfoGain.connect(modGain.gain);

    // Master cruise gain with 0.4s fade-in
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(1.0, now + 0.4);

    noise.connect(bp);
    bp.connect(lp);
    lp.connect(modGain);
    modGain.connect(masterGain);
    masterGain.connect(out);

    noise.start(now);
    lfo.start(now);

    this.warpCruiseSession = {
      masterGain,
      nodes: [noise, bp, lp, lfo, lfoGain, modGain, masterGain],
    };
  }

  playWarpExitSound() {
    this.effects.stop('warp-entry', 0.12);
    this.effects.stop('warp-cruise', 0.28);
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Cruise noise loop cross-fades out over 0.3s and disconnects
    if (this.warpCruiseSession) {
      const session = this.warpCruiseSession;
      this.warpCruiseSession = null;
      try {
        session.masterGain.gain.cancelScheduledValues(now);
        const curG = Math.max(0.0001, session.masterGain.gain.value);
        session.masterGain.gain.setValueAtTime(curG, now);
        session.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
        setTimeout(() => {
          session.nodes.forEach((n) => {
            try { n.stop?.(); } catch (_) {}
            try { n.disconnect(); } catch (_) {}
          });
        }, 350);
      } catch (_) {}
    }

    if (this.sfxMuted) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const out = this.getWarpOutput();
    if (!out) return;

    if (this.playEffect('warp-exit', {volume: 0.72})) return;
    const dur = 0.7;

    // 0.7s exit swoosh: Noise through bandpass filter (sweeping 1600 -> 300 Hz) + Sine oscillator (sweeping 700 -> 180 Hz), gain 0.16
    const bufLen = Math.floor(ctx.sampleRate * dur);
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(2.0, now);
    bp.frequency.setValueAtTime(1600, now);
    bp.frequency.exponentialRampToValueAtTime(300, now + dur);

    const sine = ctx.createOscillator();
    sine.type = 'sine';
    sine.frequency.setValueAtTime(700, now);
    sine.frequency.exponentialRampToValueAtTime(180, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    noise.connect(bp);
    bp.connect(gain);
    sine.connect(gain);
    gain.connect(out);

    noise.start(now);
    sine.start(now);
    noise.stop(now + dur);
    sine.stop(now + dur);

    const nodes = [noise, bp, sine, gain];
    this.activeWarpNodes.push(...nodes);
    setTimeout(() => {
      this.activeWarpNodes = this.activeWarpNodes.filter((n) => !nodes.includes(n as any));
    }, (dur + 0.05) * 1000);
  }

  stopVoice() {
    this.effects.stopVoice();
  }

  stopAllWarpSounds() {
    this.effects.stop('warp-align');
    this.effects.stop('warp-entry');
    this.effects.stop('warp-cruise');
    if (this.warpCruiseSession) {
      try {
        this.warpCruiseSession.nodes.forEach((n) => {
          try { n.stop?.(); } catch (_) {}
          try { n.disconnect(); } catch (_) {}
        });
      } catch (_) {}
      this.warpCruiseSession = null;
    }

    if (this.activeWarpNodes.length > 0) {
      this.activeWarpNodes.forEach((n) => {
        try { n.stop?.(); } catch (_) {}
        try { n.disconnect(); } catch (_) {}
      });
      this.activeWarpNodes = [];
    }
  }

  /**
   * 3. Dock Clamp: Heavy mechanical pneumatic latch / metallic click (low thud 90Hz -> 40Hz with sharp transient attack, 200ms).
   */
  playDockClamp() {
    if (this.playEffect('dock-clamp', {volume: 0.72})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('dock_clamp');
    const {ctx, out} = b;
    const now = b.now;
    const dur = 0.20; // 200ms

    // Sharp transient attack (metallic click / latch transient)
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1800 * p, now);
    clickOsc.frequency.exponentialRampToValueAtTime(250 * p, now + 0.03);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.35, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    clickOsc.connect(clickGain);
    clickGain.connect(out);
    clickOsc.start(now);
    clickOsc.stop(now + 0.04);

    // Short noise latch snap
    this.noiseBurst(b, now, {
      dur: 0.04,
      gain: 0.25,
      from: 3500 * p,
      to: 400 * p,
    });

    // Heavy mechanical low thud 90Hz -> 40Hz over 200ms
    const thudOsc = ctx.createOscillator();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(90 * p, now);
    thudOsc.frequency.exponentialRampToValueAtTime(40 * p, now + dur);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.38, now);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    thudOsc.connect(thudGain);
    thudGain.connect(out);
    thudOsc.start(now);
    thudOsc.stop(now + dur + 0.02);
  }

  dockClamp() {
    this.playDockClamp();
  }

  /**
   * 4. Gate Jump: Hyperspace cosmic surge (deep sub-bass resonance swelling with high-Q phase/filter sweep, 1.5s).
   */
  playGateJump() {
    if (this.playEffect('jump-gate', {volume: 0.72})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('gate_jump');
    const {ctx, out} = b;
    const now = b.now;
    const dur = 1.5;

    // Deep sub-bass resonance swelling
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(45 * p, now);
    subOsc.frequency.exponentialRampToValueAtTime(80 * p, now + 0.9);
    subOsc.frequency.exponentialRampToValueAtTime(35 * p, now + dur);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.01, now);
    subGain.gain.exponentialRampToValueAtTime(0.32, now + 1.1);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    subOsc.connect(subGain);
    subGain.connect(out);
    subOsc.start(now);
    subOsc.stop(now + dur + 0.05);

    // High-Q phase/filter sweep noise surge
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(8.0, now);
    filter.frequency.setValueAtTime(90 * p, now);
    filter.frequency.exponentialRampToValueAtTime(2400 * p, now + 1.1);
    filter.frequency.exponentialRampToValueAtTime(350 * p, now + dur);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.01, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.28, now + 1.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(out);
    noise.start(now);
    noise.stop(now + dur + 0.05);

    // Cosmic snap at arrival
    this.blip(b, now + 1.45, {
      type: 'triangle',
      freq: 1400 * p,
      freqTo: 100 * p,
      dur: 0.12,
      gain: 0.25,
    });
  }

  jumpGate() {
    this.playGateJump();
  }

  playJumpGate() {
    this.playGateJump();
  }

  /**
   * 5. UI Click: Crisp high-frequency micro-click (short 20-30ms burst/blip).
   */
  playUiClick() {
    if (this.playEffect('ui-tick', {volume: 0.27})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('ui_click');
    const now = b.now;
    this.blip(b, now, {
      type: 'sine',
      freq: 2400 * p,
      freqTo: 1600 * p,
      dur: 0.025,
      gain: 0.15,
    });
  }

  playCrispClick() {
    this.playUiClick();
  }

  // --- CONTINUOUS MINING LASER SYNTH PIPELINE ---
  startMiningLaserHum() {
    const isPlaying = this.effects.has('mining');
    if (this.playEffect('laser-loop', {channel: 'mining', loop: true, volume: 0.24})) {
      if (!isPlaying) this.playEffect('laser-start', {channel: 'mining-start', volume: 0.54});
      return;
    }
    const ctx = this.ensure();
    if (!ctx || this.sfxMuted) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

    const miningOut = this.miningBus || this.sfxGain;
    if (!miningOut) return;

    const now = ctx.currentTime;

    if (this.miningSession) {
      if (this.miningSession.isStopping) {
        clearTimeout(this.miningSession.stopTimeout);
        this.miningSession.isStopping = false;
        this.miningSession.masterGain.gain.cancelScheduledValues(now);
        this.miningSession.masterGain.gain.setValueAtTime(
          Math.max(0.001, this.miningSession.masterGain.gain.value),
          now,
        );
        this.miningSession.masterGain.gain.linearRampToValueAtTime(1.0, now + 0.1);
        this.updateMiningLaserProgress(0);
        return;
      }
      this.updateMiningLaserProgress(0);
      return;
    }

    // Master filtering: Highpass at 250 Hz + Lowpass at 5000 Hz
    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(250, now);

    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(5000, now);

    hpFilter.connect(lpFilter);
    lpFilter.connect(miningOut);

    // Tremolo: 3.5 Hz LFO modulating gain with depth 0.25
    const tremoloGain = ctx.createGain();
    tremoloGain.gain.setValueAtTime(0.75, now);
    tremoloGain.connect(hpFilter);

    const tremoloLfo = ctx.createOscillator();
    tremoloLfo.type = 'sine';
    tremoloLfo.frequency.setValueAtTime(3.5, now);

    const tremoloLfoGain = ctx.createGain();
    tremoloLfoGain.gain.setValueAtTime(0.25, now);
    tremoloLfo.connect(tremoloLfoGain);
    tremoloLfoGain.connect(tremoloGain.gain);
    tremoloLfo.start(now);

    // Master laser gain (for fade in / out)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.exponentialRampToValueAtTime(1.0, now + 0.05);
    masterGain.connect(tremoloGain);

    // 1. Startup whine: Sine ramping 400 Hz -> 900 Hz over 0.25s
    const startupOsc = ctx.createOscillator();
    startupOsc.type = 'sine';
    startupOsc.frequency.setValueAtTime(400, now);
    startupOsc.frequency.exponentialRampToValueAtTime(900, now + 0.25);

    const startupGain = ctx.createGain();
    startupGain.gain.setValueAtTime(0.18, now);
    startupGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    startupOsc.connect(startupGain);
    startupGain.connect(masterGain);
    startupOsc.start(now);
    startupOsc.stop(now + 0.26);

    // 2. Dual core oscillators: Sawtooth at 440 Hz + Square at 660 Hz through Bandpass at 800 Hz (Q = 0.9), gain = 0.18
    const sawOsc = ctx.createOscillator();
    sawOsc.type = 'sawtooth';
    sawOsc.frequency.setValueAtTime(440, now);

    const sqrOsc = ctx.createOscillator();
    sqrOsc.type = 'square';
    sqrOsc.frequency.setValueAtTime(660, now);

    const coreFilter = ctx.createBiquadFilter();
    coreFilter.type = 'bandpass';
    coreFilter.frequency.setValueAtTime(800, now);
    coreFilter.Q.setValueAtTime(0.9, now);

    const coreGain = ctx.createGain();
    coreGain.gain.setValueAtTime(0.18, now);

    sawOsc.connect(coreFilter);
    sqrOsc.connect(coreFilter);
    coreFilter.connect(coreGain);
    coreGain.connect(masterGain);

    sawOsc.start(now);
    sqrOsc.start(now);

    // 3. Shimmer: Sine at 1320 Hz with 6 Hz vibrato LFO (frequency modulation), gain = 0.05
    const shimmerOsc = ctx.createOscillator();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.setValueAtTime(1320, now);

    const shimmerLfo = ctx.createOscillator();
    shimmerLfo.type = 'sine';
    shimmerLfo.frequency.setValueAtTime(6.0, now);

    const shimmerLfoGain = ctx.createGain();
    shimmerLfoGain.gain.setValueAtTime(25.0, now); // vibrato depth
    shimmerLfo.connect(shimmerLfoGain);
    shimmerLfoGain.connect(shimmerOsc.frequency);

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0.05, now);

    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(masterGain);

    shimmerLfo.start(now);
    shimmerOsc.start(now);

    // 4. Crackle / Sizzle: Bandpass at 2500 Hz with white noise, gain scaling 0.05 -> 0.10
    const bufLen = Math.floor(ctx.sampleRate * 2.0);
    const noiseBuffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const crackleSource = ctx.createBufferSource();
    crackleSource.buffer = noiseBuffer;
    crackleSource.loop = true;

    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'bandpass';
    crackleFilter.frequency.setValueAtTime(2500, now);
    crackleFilter.Q.setValueAtTime(2.0, now);

    const crackleGain = ctx.createGain();
    crackleGain.gain.setValueAtTime(0.05, now);

    crackleSource.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(masterGain);

    crackleSource.start(now);

    this.miningSession = {
      masterGain,
      tremoloGain,
      hpFilter,
      lpFilter,
      startupOsc,
      startupGain,
      sawOsc,
      sqrOsc,
      coreFilter,
      coreGain,
      shimmerOsc,
      shimmerLfo,
      shimmerLfoGain,
      shimmerGain,
      crackleSource,
      crackleFilter,
      crackleGain,
      tremoloLfo,
      tremoloLfoGain,
      isStopping: false,
    };
  }

  updateMiningLaserProgress(progress: number) {
    this.effects.setVolume('mining', 0.24 + Math.max(0, Math.min(1, progress)) * 0.14);
    if (!this.miningSession || this.miningSession.isStopping || !this.ctx) return;
    const p = Math.max(0, Math.min(1.0, progress));
    const now = this.ctx.currentTime;
    // Crackle gain scales 0.05 -> 0.10 as cycle progress increases
    const crackleVol = 0.05 + p * 0.05;
    this.miningSession.crackleGain.gain.setTargetAtTime(crackleVol, now, 0.08);
  }

  stopMiningLaserHum() {
    this.effects.stop('mining-start');
    this.effects.stop('mining', 0.24);
    if (!this.miningSession || !this.ctx) return;
    if (this.miningSession.isStopping) return;

    const session = this.miningSession;
    session.isStopping = true;
    const now = this.ctx.currentTime;

    // Pitch multipliers ramp down by x0.8 over 0.25s, gain fades to 0 over 0.25s
    session.masterGain.gain.cancelScheduledValues(now);
    const curGain = Math.max(0.001, session.masterGain.gain.value);
    session.masterGain.gain.setValueAtTime(curGain, now);
    session.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);

    try {
      session.sawOsc.frequency.cancelScheduledValues(now);
      session.sawOsc.frequency.setValueAtTime(session.sawOsc.frequency.value, now);
      session.sawOsc.frequency.exponentialRampToValueAtTime(
        Math.max(1, session.sawOsc.frequency.value * 0.8),
        now + 0.25,
      );

      session.sqrOsc.frequency.cancelScheduledValues(now);
      session.sqrOsc.frequency.setValueAtTime(session.sqrOsc.frequency.value, now);
      session.sqrOsc.frequency.exponentialRampToValueAtTime(
        Math.max(1, session.sqrOsc.frequency.value * 0.8),
        now + 0.25,
      );

      session.shimmerOsc.frequency.cancelScheduledValues(now);
      session.shimmerOsc.frequency.setValueAtTime(session.shimmerOsc.frequency.value, now);
      session.shimmerOsc.frequency.exponentialRampToValueAtTime(
        Math.max(1, session.shimmerOsc.frequency.value * 0.8),
        now + 0.25,
      );
    } catch (_) {}

    session.stopTimeout = setTimeout(() => {
      try {
        session.sawOsc.stop();
        session.sqrOsc.stop();
        session.shimmerOsc.stop();
        session.shimmerLfo.stop();
        session.tremoloLfo.stop();
        session.crackleSource.stop();

        session.sawOsc.disconnect();
        session.sqrOsc.disconnect();
        session.coreFilter.disconnect();
        session.coreGain.disconnect();
        session.shimmerOsc.disconnect();
        session.shimmerLfo.disconnect();
        session.shimmerLfoGain.disconnect();
        session.shimmerGain.disconnect();
        session.crackleSource.disconnect();
        session.crackleFilter.disconnect();
        session.crackleGain.disconnect();
        session.masterGain.disconnect();
        session.tremoloGain.disconnect();
        session.tremoloLfo.disconnect();
        session.tremoloLfoGain.disconnect();
        session.hpFilter.disconnect();
        session.lpFilter.disconnect();
      } catch (_) {}
      if (this.miningSession === session) {
        this.miningSession = null;
      }
    }, 260);
  }

  playMiningCycleComplete() {
    if (this.playEffect('ore-yield', {volume: 0.55})) return;
    const ctx = this.ensure();
    if (!ctx || this.sfxMuted) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

    const out = this.miningBus || this.sfxGain;
    if (!out) return;

    const now = ctx.currentTime;
    const pitch = this.getNextPitch('mining_tick');

    const transientOsc = ctx.createOscillator();
    transientOsc.type = 'triangle';
    transientOsc.frequency.setValueAtTime(440 * pitch, now);
    transientOsc.frequency.exponentialRampToValueAtTime(90 * pitch, now + 0.05);

    const transientGain = ctx.createGain();
    transientGain.gain.setValueAtTime(0.30, now);
    transientGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    transientOsc.connect(transientGain);
    transientGain.connect(out);
    transientOsc.start(now);
    transientOsc.stop(now + 0.08);

    const clunkOsc = ctx.createOscillator();
    clunkOsc.type = 'sine';
    clunkOsc.frequency.setValueAtTime(145 * pitch, now);
    clunkOsc.frequency.exponentialRampToValueAtTime(44 * pitch, now + 0.22);

    const clunkGain = ctx.createGain();
    clunkGain.gain.setValueAtTime(0.36, now);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    clunkOsc.connect(clunkGain);
    clunkGain.connect(out);
    clunkOsc.start(now);
    clunkOsc.stop(now + 0.25);

    const ringOsc = ctx.createOscillator();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(680 * pitch, now + 0.01);
    ringOsc.frequency.exponentialRampToValueAtTime(520 * pitch, now + 0.26);

    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(0.001, now);
    ringGain.gain.setValueAtTime(0.14, now + 0.01);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    ringOsc.connect(ringGain);
    ringGain.connect(out);
    ringOsc.start(now + 0.01);
    ringOsc.stop(now + 0.30);

    const crumbleBursts = [
      {t: 0.03, dur: 0.07, f1: 3200, f2: 1400, gain: 0.16},
      {t: 0.09, dur: 0.09, f1: 2600, f2: 900, gain: 0.20},
      {t: 0.17, dur: 0.11, f1: 3800, f2: 1200, gain: 0.15},
      {t: 0.27, dur: 0.12, f1: 2200, f2: 700, gain: 0.12},
      {t: 0.37, dur: 0.10, f1: 1800, f2: 600, gain: 0.08},
    ];

    crumbleBursts.forEach((b) => {
      const at = now + b.t;
      const len = Math.max(1, Math.floor(ctx.sampleRate * b.dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.2 ? 1.0 : 0.2);
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 3.0;
      filter.frequency.setValueAtTime(b.f1 * pitch, at);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(50, b.f2 * pitch),
        at + b.dur,
      );

      const g = ctx.createGain();
      g.gain.setValueAtTime(b.gain, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + b.dur);

      src.connect(filter);
      filter.connect(g);
      g.connect(out);

      src.start(at);
      src.stop(at + b.dur + 0.01);
    });

    const sparklePips = [
      {t: 0.07, freq: 2400},
      {t: 0.15, freq: 3100},
      {t: 0.25, freq: 1950},
      {t: 0.36, freq: 2800},
    ];
    sparklePips.forEach((pItem) => {
      const at = now + pItem.t;
      const sOsc = ctx.createOscillator();
      sOsc.type = 'sine';
      sOsc.frequency.setValueAtTime(pItem.freq * pitch, at);
      const sGain = ctx.createGain();
      sGain.gain.setValueAtTime(0.06, at);
      sGain.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
      sOsc.connect(sGain);
      sGain.connect(out);
      sOsc.start(at);
      sOsc.stop(at + 0.06);
    });
  }

  cycleClick() {
    this.playMiningCycleComplete();
  }

  // --- OTHER ROUTED PROCEDURAL SFX ---
  playAlert() {
    const b = this.begin();
    if (!b) return;
    const {ctx, out} = b;
    const now = b.now;
    const p = this.getNextPitch('alert');

    const alertBus = ctx.createGain();
    alertBus.gain.setValueAtTime(0.35, now);
    alertBus.connect(out);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(440 * p, now);
    osc1.frequency.exponentialRampToValueAtTime(330 * p, now + 0.18);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.25, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc1.connect(g1);
    g1.connect(alertBus);
    osc1.start(now);
    osc1.stop(now + 0.22);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(440 * p, now + 0.22);
    osc2.frequency.exponentialRampToValueAtTime(330 * p, now + 0.4);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.25, now + 0.22);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc2.connect(g2);
    g2.connect(alertBus);
    osc2.start(now + 0.22);
    osc2.stop(now + 0.44);
  }

  playLaserHeatWarn() {
    if (this.playEffect('laser-overheat', {volume: 0.55})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('laser_heat_warn');
    const {ctx, out} = b;
    const now = b.now;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880 * p, now);
    osc1.frequency.exponentialRampToValueAtTime(1200 * p, now + 0.08);

    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.25, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc1.connect(g1);
    g1.connect(out);
    osc1.start(now);
    osc1.stop(now + 0.085);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1100 * p, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(1500 * p, now + 0.18);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.25, now + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc2.connect(g2);
    g2.connect(out);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.185);
  }

  playFailBuzz() {
    this.playErrorBuzz();
  }

  alert() {
    this.playAlert();
  }

  playMissionAccept() {
    if (this.playEffect('mission-accept', {volume: 0.52})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('mission_accept');
    this.blip(b, b.now, {
      type: 'sine',
      freq: 330 * p,
      freqTo: 220 * p,
      dur: 0.12,
      gain: 0.14,
    });
    this.blip(b, b.now + 0.04, {
      type: 'triangle',
      freq: 440 * p,
      freqTo: 293.66 * p,
      dur: 0.16,
      gain: 0.08,
    });
  }

  missionAccept() {
    this.playMissionAccept();
  }

  playMissionComplete() {
    if (this.playEffect('progression', {volume: 0.6})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('mission_complete');
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((f, idx) => {
      const t = b.now + idx * 0.085;
      this.blip(b, t, {type: 'sine', freq: f * p, dur: 0.32, gain: 0.1});
      this.blip(b, t, {
        type: 'triangle',
        freq: f * 2 * p,
        dur: 0.16,
        gain: 0.04,
      });
    });
  }

  missionComplete() {
    this.playMissionComplete();
  }

  playWreckOpen() {
    if (this.playEffect('wreck-open', {volume: 0.6})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('wreck_open');
    this.blip(b, b.now, {type: 'sine', freq: 2450 * p, dur: 0.035, gain: 0.12});
    this.blip(b, b.now, {
      type: 'triangle',
      freq: 3820 * p,
      dur: 0.04,
      gain: 0.08,
    });
    this.noiseBurst(b, b.now, {
      dur: 0.025,
      gain: 0.09,
      from: 5200 * p,
      to: 1900 * p,
    });

    const ringFreq = 1680 * p;
    this.blip(b, b.now + 0.008, {
      type: 'sine',
      freq: ringFreq,
      dur: 0.28,
      gain: 0.14,
    });
    this.blip(b, b.now + 0.012, {
      type: 'sine',
      freq: ringFreq * 1.58,
      dur: 0.22,
      gain: 0.06,
    });
  }

  wreckOpen() {
    this.playWreckOpen();
  }

  playMilestoneChime() {
    if (this.playEffect('progression', {volume: 0.6})) return;
    const b = this.begin();
    if (!b) return;
    const {ctx, out} = b;
    const now = b.now;
    const p = this.getNextPitch('milestone_chime');
    const chimeBus = ctx.createGain();
    chimeBus.gain.setValueAtTime(0.35, now);
    chimeBus.connect(out);

    const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    freqs.forEach((freq, idx) => {
      const at = now + idx * 0.035;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * p, at);

      const peak = 0.16;
      g.gain.setValueAtTime(0.001, at);
      g.gain.linearRampToValueAtTime(peak, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);

      osc.connect(g);
      g.connect(chimeBus);
      osc.start(at);
      osc.stop(at + 1.22);

      const hOsc = ctx.createOscillator();
      const hG = ctx.createGain();
      hOsc.type = 'triangle';
      hOsc.frequency.setValueAtTime(freq * 2 * p, at);
      hG.gain.setValueAtTime(0.001, at);
      hG.gain.linearRampToValueAtTime(peak * 0.35, at + 0.01);
      hG.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);

      hOsc.connect(hG);
      hG.connect(chimeBus);
      hOsc.start(at);
      hOsc.stop(at + 0.72);
    });
  }

  milestoneChime() {
    this.playMilestoneChime();
  }

  playBlip() {
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('blip');
    this.blip(b, b.now, {type: 'sine', freq: 987.77 * p, dur: 0.045, gain: 0.12});
  }

  playSkillComplete() {
    if (this.playEffect('progression', {volume: 0.55})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('skill_complete');
    const note1 = 587.33 * p;
    const note2 = 880.0 * p;
    const now = b.now;

    this.blip(b, now, {type: 'sine', freq: note1, dur: 0.35, gain: 0.08});
    this.blip(b, now, {
      type: 'triangle',
      freq: note1 * 2,
      dur: 0.18,
      gain: 0.03,
    });

    const t2 = now + 0.16;
    this.blip(b, t2, {type: 'sine', freq: note2, dur: 0.65, gain: 0.09});
    this.blip(b, t2, {
      type: 'triangle',
      freq: note2 * 2,
      dur: 0.3,
      gain: 0.03,
    });

    for (let i = 0; i < 4; i++) {
      const tailTime = t2 + 0.08 + i * 0.12;
      this.blip(b, tailTime, {
        type: 'sine',
        freq: note2 * (1 + (i + 1) * 0.25) * p,
        dur: 0.35 - i * 0.05,
        gain: 0.025 / (i + 1),
      });
    }
  }

  skillComplete() {
    this.playSkillComplete();
  }

  playOverviewSelect() {
    if (this.playEffect('ui-tick', {volume: 0.25})) return;
    this.playUiClick();
  }

  overviewSelect() {
    this.playUiClick();
  }

  playModuleActivate() {
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('module_act');
    this.blip(b, b.now, {
      type: 'sine',
      freq: 140 * p,
      freqTo: 42 * p,
      dur: 0.08,
      gain: 0.18,
    });
    this.blip(b, b.now, {type: 'triangle', freq: 2400 * p, dur: 0.01, gain: 0.08});
  }

  moduleActivate() {
    this.playModuleActivate();
  }

  playInteriorDoor() {
    if (this.playEffect('station-door', {volume: 0.52})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('interior_door');
    this.noiseBurst(b, b.now, {
      dur: 0.14,
      gain: 0.12,
      from: 2400 * p,
      to: 900 * p,
    });
    const t2 = b.now + 0.11;
    this.blip(b, t2, {
      type: 'sine',
      freq: 120 * p,
      freqTo: 45 * p,
      dur: 0.1,
      gain: 0.14,
    });
    this.noiseBurst(b, t2, {dur: 0.08, gain: 0.08, from: 350 * p, to: 80 * p});
  }

  doorHiss() {
    this.playInteriorDoor();
  }

  playDialogueAdvance() {
    if (this.playEffect('ui-tick', {volume: 0.24})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('dialogue_advance');
    this.blip(b, b.now, {type: 'sine', freq: 1120 * p, dur: 0.016, gain: 0.07});
  }

  dialogueClick() {
    this.playDialogueAdvance();
  }

  playPurchaseConfirmed() {
    if (this.playEffect('ui-confirm', {volume: 0.45})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('purchase_confirmed');
    const freqs = [587.33, 739.99, 880.0, 1174.66];
    freqs.forEach((f, i) => {
      const t = b.now + i * 0.055;
      this.blip(b, t, {type: 'sine', freq: f * p, dur: 0.35, gain: 0.08});
      this.blip(b, t, {
        type: 'triangle',
        freq: f * 2 * p,
        dur: 0.12,
        gain: 0.03,
      });
    });
  }

  purchaseChime() {
    this.playPurchaseConfirmed();
  }

  startHullHum() {
    if (this.isHullHumActive) return;
    if (this.playEffect('engine-loop', {channel: 'engine', loop: true, volume: 0.12})) return;
    const b = this.begin();
    if (!b) return;
    this.isHullHumActive = true;
    const {ctx, out} = b;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.028, ctx.currentTime + 0.8);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(48, ctx.currentTime);

    osc.connect(gain);
    gain.connect(out);
    osc.start();

    this.hullHumGain = gain;
    this.hullHumOsc = osc;
  }

  stopHullHum() {
    this.effects.stop('engine', 0.28);
    if (!this.isHullHumActive || !this.hullHumGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.hullHumGain.gain.cancelScheduledValues(now);
    this.hullHumGain.gain.setValueAtTime(this.hullHumGain.gain.value, now);
    this.hullHumGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    const o = this.hullHumOsc;
    setTimeout(() => {
      try {
        o?.stop();
      } catch (_) {}
    }, 350);

    this.hullHumGain = null;
    this.hullHumOsc = null;
    this.isHullHumActive = false;
  }

  playCannonFire() {
    if (this.playEffect('cannon', {volume: 0.68})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('cannon_fire');
    this.blip(b, b.now, {
      type: 'sine',
      freq: 160 * p,
      freqTo: 35 * p,
      dur: 0.12,
      gain: 0.28,
    });
    this.noiseBurst(b, b.now, {
      dur: 0.07,
      gain: 0.22,
      from: 1800 * p,
      to: 200 * p,
    });
    const tTail = b.now + 0.04;
    this.blip(b, tTail, {
      type: 'triangle',
      freq: 720 * p,
      freqTo: 480 * p,
      dur: 0.14,
      gain: 0.12,
    });
  }

  cannonFire() {
    this.playCannonFire();
  }

  playShieldHit() {
    if (this.playEffect('shield-hit', {volume: 0.52})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('shield_hit');
    this.blip(b, b.now, {
      type: 'sine',
      freq: 280 * p,
      freqTo: 90 * p,
      dur: 0.16,
      gain: 0.18,
    });
    this.noiseBurst(b, b.now, {
      dur: 0.18,
      gain: 0.16,
      from: 2200 * p,
      to: 350 * p,
    });
    this.blip(b, b.now + 0.02, {
      type: 'sawtooth',
      freq: 440 * p,
      freqTo: 110 * p,
      dur: 0.09,
      gain: 0.08,
    });
  }

  shieldHit() {
    this.playShieldHit();
  }

  playHullHit() {
    if (this.playEffect('hull-hit', {volume: 0.65})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('hull_hit');
    this.noiseBurst(b, b.now, {
      dur: 0.15,
      gain: 0.26,
      from: 800 * p,
      to: 80 * p,
    });
    this.blip(b, b.now, {
      type: 'triangle',
      freq: 220 * p,
      freqTo: 45 * p,
      dur: 0.2,
      gain: 0.24,
    });
    this.blip(b, b.now + 0.03, {
      type: 'square',
      freq: 110 * p,
      freqTo: 55 * p,
      dur: 0.08,
      gain: 0.1,
    });
  }

  hullHit() {
    this.playHullHit();
  }

  playExplosion() {
    if (this.playEffect('enemy-explosion', {volume: 0.7})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('explosion');
    this.noiseBurst(b, b.now, {
      dur: 0.65,
      gain: 0.32,
      from: 600 * p,
      to: 40 * p,
    });
    this.blip(b, b.now, {
      type: 'sine',
      freq: 95 * p,
      freqTo: 22 * p,
      dur: 0.55,
      gain: 0.35,
    });
    this.blip(b, b.now + 0.05, {
      type: 'triangle',
      freq: 140 * p,
      freqTo: 30 * p,
      dur: 0.4,
      gain: 0.2,
    });
  }

  explosion() {
    this.playExplosion();
  }

  playConfirmSelect() {
    if (this.playEffect('ui-confirm', {volume: 0.43})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('confirm_select');
    this.blip(b, b.now, {type: 'sine', freq: 523.25 * p, dur: 0.1, gain: 0.08});
    this.blip(b, b.now + 0.08, {
      type: 'sine',
      freq: 783.99 * p,
      dur: 0.15,
      gain: 0.1,
    });
  }

  playConfirmChime() {
    this.playConfirmSelect();
  }

  playErrorBuzz() {
    if (this.playEffect('ui-warning', {volume: 0.43})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('error_buzz');
    this.blip(b, b.now, {
      type: 'sawtooth',
      freq: 150 * p,
      dur: 0.2,
      gain: 0.08,
    });
    this.blip(b, b.now + 0.08, {
      type: 'sawtooth',
      freq: 159 * p,
      dur: 0.2,
      gain: 0.08,
    });
  }

  playArcadeLaser() {
    if (this.playEffect('laser-weapon', {volume: 0.57})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('arcade_laser');
    const dur = 0.2;

    const osc = b.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800 * p, b.now);
    osc.frequency.exponentialRampToValueAtTime(80 * p, b.now + dur);

    const filter = b.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(2000 * p, b.now);
    filter.frequency.exponentialRampToValueAtTime(100 * p, b.now + dur);

    const gain = b.ctx.createGain();
    gain.gain.setValueAtTime(0.12, b.now);
    gain.gain.exponentialRampToValueAtTime(0.0001, b.now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(b.out);

    osc.start(b.now);
    osc.stop(b.now + dur);
  }

  playVictoryFanfare() {
    const b = this.begin();
    if (!b) return;
    const v = this.getNextPitch('fanfare');
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.1, { type: 'sawtooth', freq: freq * v, dur: 0.4, gain: 0.06 });
      this.blip(b, b.now + i * 0.1, { type: 'sine', freq: freq * v, dur: 0.4, gain: 0.04 });
    });
    const chordTime = notes.length * 0.1;
    notes.forEach((freq) => {
      this.blip(b, b.now + chordTime, { type: 'triangle', freq: freq * v, dur: 0.8, gain: 0.06 });
    });
  }

  playCoinPickup() {
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('coin_pickup');
    this.blip(b, b.now, {
      type: 'square',
      freq: 987.77 * p,
      dur: 0.1,
      gain: 0.08,
    });
    this.blip(b, b.now + 0.08, {
      type: 'square',
      freq: 1318.51 * p,
      dur: 0.2,
      gain: 0.08,
    });
  }

  playPowerupChime() {
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('powerup_chime');
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.06, {
        type: 'sine',
        freq: freq * p,
        dur: 0.15,
        gain: 0.06,
      });
    });
  }

  playChiptuneExplosion() {
    if (this.playEffect('asteroid-fracture', {volume: 0.67})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('chip_explosion');
    this.noiseBurst(b, b.now, {
      dur: 0.4,
      gain: 0.2,
      from: 1000 * p,
      to: 100 * p,
    });
    this.blip(b, b.now, {
      type: 'triangle',
      freq: 160 * p,
      freqTo: 30 * p,
      dur: 0.35,
      gain: 0.25,
    });
  }

  playShieldBlock() {
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('shield_block');
    this.blip(b, b.now, {
      type: 'sine',
      freq: 100 * p,
      freqTo: 30 * p,
      dur: 0.2,
      gain: 0.2,
    });
    this.noiseBurst(b, b.now, {
      dur: 0.15,
      gain: 0.12,
      from: 500 * p,
      to: 100 * p,
    });
  }

  // --- P4 PROCEDURAL COLONY & LOGISTICS SFX ---
  /**
   * Heavy industrial clamp (lowpass filtered noise burst + punchy square/sine drop 120->40 Hz, duration 0.4s).
   */
  playHubDeploySound() {
    if (this.playEffect('deploy-structure', {volume: 0.64})) return;
    const b = this.begin();
    if (!b) return;
    const p = 1.0 + (Math.random() * 0.1 - 0.05); // +/- 5% pitch
    const { ctx, out } = b;
    const now = b.now;
    const dur = 0.4;

    // Lowpass filtered noise burst
    this.noiseBurst(b, now, {
      dur: 0.25,
      gain: 0.28,
      from: 1200 * p,
      to: 90 * p,
    });

    // Punchy square/sine drop 120 -> 40 Hz
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(120 * p, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, 40 * p), now + dur);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120 * p, now);
    sub.frequency.exponentialRampToValueAtTime(Math.max(1, 38 * p), now + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(350 * p, now);
    lp.frequency.exponentialRampToValueAtTime(100 * p, now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(lp);
    sub.connect(lp);
    lp.connect(g);
    g.connect(out);

    osc.start(now);
    sub.start(now);
    osc.stop(now + dur + 0.02);
    sub.stop(now + dur + 0.02);
  }

  /**
   * Crisp mechanical placement latch click (high-passed click + sine 800->300 Hz, duration 0.08s).
   */
  playStructurePlaceSound() {
    if (this.playEffect('deploy-structure', {volume: 0.64})) return;
    const b = this.begin();
    if (!b) return;
    const p = 1.0 + (Math.random() * 0.1 - 0.05); // +/- 5% pitch
    const { ctx, out } = b;
    const now = b.now;
    const dur = 0.08;

    // High-passed click
    const len = Math.max(1, Math.floor(ctx.sampleRate * 0.025));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2400 * p, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    src.connect(hp);
    hp.connect(noiseGain);
    noiseGain.connect(out);
    src.start(now);
    src.stop(now + 0.03);

    // Sine pitch drop 800 -> 300 Hz
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 * p, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, 300 * p), now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  /**
   * 1.2s ascending low-end thrust rumble (filtered white noise + sine pitch swell 60->160 Hz, duration 1.2s).
   */
  playRocketLaunchSound() {
    if (this.playEffect('rockets', {volume: 0.7})) return;
    const b = this.begin();
    if (!b) return;
    const p = 1.0 + (Math.random() * 0.1 - 0.05); // +/- 5% pitch
    const { ctx, out } = b;
    const now = b.now;
    const dur = 1.2;

    // Filtered white noise rumble
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(140 * p, now);
    lp.frequency.exponentialRampToValueAtTime(650 * p, now + 0.9);
    lp.frequency.exponentialRampToValueAtTime(200 * p, now + dur);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.01, now);
    nGain.gain.linearRampToValueAtTime(0.35, now + 0.4);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(lp);
    lp.connect(nGain);
    nGain.connect(out);
    noise.start(now);
    noise.stop(now + dur);

    // Sine pitch swell 60 -> 160 Hz
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60 * p, now);
    osc.frequency.linearRampToValueAtTime(160 * p, now + 0.8);
    osc.frequency.exponentialRampToValueAtTime(80 * p, now + dur);

    const oGain = ctx.createGain();
    oGain.gain.setValueAtTime(0.01, now);
    oGain.gain.linearRampToValueAtTime(0.32, now + 0.35);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(oGain);
    oGain.connect(out);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  /**
   * Crystal cargo chime (dual sine arpeggio 520 Hz -> 780 Hz, gain 0.15, duration 0.3s).
   */
  playDepotCollectSound() {
    const b = this.begin();
    if (!b) return;
    const p = 1.0 + (Math.random() * 0.1 - 0.05); // +/- 5% pitch
    const { ctx, out } = b;
    const now = b.now;

    // Note 1: 520 Hz
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(520 * p, now);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.15, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(g1);
    g1.connect(out);
    osc1.start(now);
    osc1.stop(now + 0.26);

    // Note 2: 780 Hz (arpeggio offset 0.07s, duration 0.3s total)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(780 * p, now + 0.07);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.15, now + 0.07);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    osc2.connect(g2);
    g2.connect(out);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.31);
  }

  // --- P5 CINDER RIFT SFX SUITE ---
  /**
   * Subspace tearing distortion (frequency modulation + distortion wave + lowpass sweep 1200->70 Hz).
   */
  playRiftOpenSound() {
    if (this.playEffect('rift-open', {volume: 0.7})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('rift_open');
    const { ctx, out } = b;
    const now = b.now;
    const dur = 1.1;

    // Subspace tearing noise with resonant lowpass sweep
    this.noiseBurst(b, now, {
      dur: 0.9,
      gain: 0.30,
      from: 2800 * p,
      to: 65 * p,
    });

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(420 * p, now);
    saw.frequency.exponentialRampToValueAtTime(60 * p, now + dur);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(3.0, now);
    bp.frequency.setValueAtTime(800 * p, now);
    bp.frequency.exponentialRampToValueAtTime(80 * p, now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    saw.connect(bp);
    bp.connect(g);
    g.connect(out);

    saw.start(now);
    saw.stop(now + dur + 0.02);
  }

  /**
   * Pulsing dual-tone hazard alarm (100 Hz & 300 Hz).
   */
  playDecayAlarmSound() {
    if (this.playEffect('rift-alarm', {volume: 0.46})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('decay_alarm');
    const { ctx, out } = b;
    const now = b.now;

    for (let pulse = 0; pulse < 2; pulse++) {
      const at = now + pulse * 0.16;
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(100 * p, at);

      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(300 * p, at);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(800, at);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.24, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.12);

      osc1.connect(lp);
      osc2.connect(lp);
      lp.connect(g);
      g.connect(out);

      osc1.start(at);
      osc2.start(at);
      osc1.stop(at + 0.13);
      osc2.stop(at + 0.13);
    }
  }

  /**
   * Electronic telemetry upload stream packet sound.
   */
  playHackLoopSound() {
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('hack_loop');
    this.blip(b, b.now, {
      type: 'triangle',
      freq: (800 + Math.random() * 600) * p,
      dur: 0.04,
      gain: 0.08,
    });
  }

  /**
   * Electronic telemetry upload stream completion chirp.
   */
  playHackDoneSound() {
    if (this.playEffect('rift-hack', {volume: 0.54})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('hack_done');
    const notes = [600, 800, 1200, 1600];
    notes.forEach((freq, idx) => {
      this.blip(b, b.now + idx * 0.04, {
        type: 'sine',
        freq: freq * p,
        dur: 0.12,
        gain: 0.15,
      });
    });
  }

  /**
   * Resonant crystalline mineral pickup chime (440 -> 880 Hz).
   */
  playPristineScoopSound() {
    if (this.playEffect('salvage', {volume: 0.46})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('pristine_scoop');
    const { ctx, out } = b;
    const now = b.now;

    // Note 1: 440 Hz -> 880 Hz sweep
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440 * p, now);
    osc.frequency.exponentialRampToValueAtTime(880 * p, now + 0.12);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.46);

    // Shimmering high overtone chime
    const overtone = ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(1760 * p, now + 0.06);

    const og = ctx.createGain();
    og.gain.setValueAtTime(0.12, now + 0.06);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    overtone.connect(og);
    og.connect(out);
    overtone.start(now + 0.06);
    overtone.stop(now + 0.56);
  }

  /**
   * Low-frequency seismic shockwave detonation (40 Hz thump).
   */
  playWardenPulseSound() {
    if (this.playEffect('warden-pulse', {volume: 0.68})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('warden_pulse');
    const { ctx, out } = b;
    const now = b.now;
    const dur = 0.55;

    // Concussive snap
    this.noiseBurst(b, now, {
      dur: 0.18,
      gain: 0.35,
      from: 1400 * p,
      to: 50 * p,
    });

    // 40 Hz seismic sub-bass thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(40 * p, now);
    osc.frequency.exponentialRampToValueAtTime(25 * p, now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  /**
   * Subspace horizon collapse implosion rumble.
   */
  playCollapseRumbleSound() {
    if (this.playEffect('rift-collapse', {volume: 0.75})) return;
    const b = this.begin();
    if (!b) return;
    const p = this.getNextPitch('collapse_rumble');
    const { ctx, out } = b;
    const now = b.now;
    const dur = 1.6;

    // Sub implosion rumble
    this.noiseBurst(b, now, {
      dur: 1.4,
      gain: 0.40,
      from: 500 * p,
      to: 30 * p,
    });

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(70 * p, now);
    sub.frequency.exponentialRampToValueAtTime(28 * p, now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.50, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    sub.connect(g);
    g.connect(out);
    sub.start(now);
    sub.stop(now + dur + 0.02);
  }
}

/** Shared singleton — import and use anywhere. */
export const gameAudio = new GameAudio();
export const soundManager = gameAudio;

// ============================================================================
// GENERAL UTILITIES & MATH HELPERS
// ============================================================================

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const formatTime = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(clamped / 60);
  const remaining = clamped % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

export const prepareCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const scale = window.devicePixelRatio || 1;
  const displayWidth = Math.floor(width * scale);
  const displayHeight = Math.floor(height * scale);

  if (
    ctx.canvas.width !== displayWidth ||
    ctx.canvas.height !== displayHeight
  ) {
    ctx.canvas.width = displayWidth;
    ctx.canvas.height = displayHeight;
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
};

export const createFixedStepper = (stepMs: number, maxSubSteps = 5) => {
  let lastTime = 0;
  let accumulator = 0;

  return (time: number, onStep: (deltaSeconds: number) => void): void => {
    if (lastTime === 0) {
      lastTime = time;
      return;
    }

    const frameMs = Math.min(time - lastTime, stepMs * maxSubSteps);
    lastTime = time;
    accumulator += frameMs;

    let steps = 0;
    while (accumulator >= stepMs && steps < maxSubSteps) {
      onStep(stepMs / 1000);
      accumulator -= stepMs;
      steps += 1;
    }
  };
};

/**
 * A 2D coordinate representing a position in the game world.
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * An entity within the game.
 */
export interface Entity extends Position {
  id: string;
  type: string;
  width: number;
  height: number;
  vx: number;
  vy: number;
  [key: string]: any; // Allow flexible properties
}

/**
 * The current phase of the game.
 */
export type GamePhase =
  | 'START'
  | 'PLAYING'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'VICTORY'
  | 'LEVEL_COMPLETE';

/**
 * The overall state of the game.
 */
export interface GameState {
  status: GamePhase;
  score: number;
  level: number;
  timer?: number;
  moves?: number;
  lives?: number;
  [key: string]: any; // Allow flexible properties
}

/**
 * The music track to be used in the game.
 */
export interface MusicTrack {
  name: string;
  url: string;
  description: string;
}

/**
 * Configuration for a sprite sheet.
 */
export interface SpriteConfig {
  url: string;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
}

/**
 * Preloads all assets defined in the manifest.
 * Returns a dictionary of loaded images (keyed by manifest ID) and a loading state.
 *
 * WARNING: Generated sprites already have transparent backgrounds removed server-side.
 * Do not run client-side `ctx.getImageData()` loops to strip backgrounds. If you ever
 * call `ctx.getImageData()`, wrap it in `try / catch` and fall back to raw `ctx.drawImage()`
 * in case an external asset fell back to `no-cors` loading.
 */
export function useAssets(manifest: Record<string, string>) {
  const [assets, setAssets] = useState<Record<string, HTMLImageElement | null>>(
    {},
  );
  const [isReady, setIsReady] = useState(false);

  // Stringify the manifest to prevent infinite re-renders if an inline object is passed
  const manifestStr = JSON.stringify(manifest);

  useEffect(() => {
    const currentManifest = JSON.parse(manifestStr) as Record<string, string>;
    const urls = Object.entries(currentManifest);
    if (urls.length === 0) {
      setIsReady(true);
      return;
    }

    let loadedCount = 0;
    const loadedAssets: Record<string, HTMLImageElement | null> = {};

    urls.forEach(([id, url]) => {
      const img = new Image();
      let retriedWithoutCors = false;
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedAssets[id] = img; // Keyed by manifest ID for easy lookup
        loadedCount++;
        if (loadedCount === urls.length) {
          setAssets(loadedAssets);
          setIsReady(true);
        }
      };
      img.onerror = () => {
        if (!retriedWithoutCors) {
          retriedWithoutCors = true;
          img.removeAttribute('crossorigin');
          img.src = url;
          return;
        }
        console.warn(`[AssetPreloader] Failed to load asset: ${id} at ${url}`);
        loadedAssets[id] = null;
        loadedCount++;
        if (loadedCount === urls.length) {
          setAssets(loadedAssets);
          setIsReady(true);
        }
      };
      img.src = url;
    });
  }, [manifestStr]);

  return {assets, isReady};
}

/**
 * Safely draws an entire image asset on the canvas. If the asset failed to load,
 * falls back to rendering a primitive geometric shape to prevent crashing.
 *
 * Note: Draws from top-left (consistent with standard Canvas drawImage).
 *
 * WARNING: This draws the WHOLE source image (5-arg drawImage) and does not support
 * frame extraction. For animated spritesheets, use the `html-sprite-renderer` skill
 * (`SpriteRenderer` class) instead.
 */
export function drawAsset(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  fallbackDraw: (ctx: CanvasRenderingContext2D) => void,
) {
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    fallbackDraw(ctx);
  }
}

/**
 * Robust background drawing function.
 * If a background image is provided, it draws it covering the full canvas width and height.
 * If camera coordinates are provided, it can optionally do parallax scrolling.
 * If the image fails to load, it falls back to a solid color.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bgImg: HTMLImageElement | null | undefined,
  canvasWidth: number,
  canvasHeight: number,
  fallbackColor = '#222222',
  camX = 0,
  camY = 0,
) {
  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    // Seamless mirrored-edge parallax wrapping
    const parallaxFactor = 0.12;
    const pw = canvasWidth * 2;
    const ph = canvasHeight * 2;
    const bgX = (((camX * parallaxFactor) % pw) + pw) % pw;
    const bgY = (((camY * parallaxFactor) % ph) + ph) % ph;

    const ox = -bgX;
    const oy = -bgY;

    // Draw seamless 2x2 mirrored quad
    for (let dy = 0; dy <= ph; dy += canvasHeight) {
      for (let dx = 0; dx <= pw; dx += canvasWidth) {
        const x = ox + dx;
        const y = oy + dy;
        if (x + canvasWidth >= 0 && x <= canvasWidth && y + canvasHeight >= 0 && y <= canvasHeight) {
          const flipX = (Math.floor(dx / canvasWidth) % 2) === 1;
          const flipY = (Math.floor(dy / canvasHeight) % 2) === 1;
          ctx.save();
          if (flipX || flipY) {
            ctx.translate(x + (flipX ? canvasWidth : 0), y + (flipY ? canvasHeight : 0));
            ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
            ctx.drawImage(bgImg, 0, 0, canvasWidth, canvasHeight);
          } else {
            ctx.drawImage(bgImg, x, y, canvasWidth, canvasHeight);
          }
          ctx.restore();
        }
      }
    }
  } else {
    // Fallback to solid color
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
}

/**
 * Detect mobile/touch devices.
 * Checks user agent, pointer capability, and viewport width.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    const ua =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
    const touch =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;
    const small = window.innerWidth < 768;
    return ua || touch || small;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(
        window.innerWidth < 768 ||
          window.matchMedia('(pointer: coarse)').matches ||
          'ontouchstart' in window ||
          navigator.maxTouchPoints > 0,
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
