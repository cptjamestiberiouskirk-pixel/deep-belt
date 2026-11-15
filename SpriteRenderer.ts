export interface SpriteActionConfig {
  imageUrl: string;
  totalFrames: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop?: boolean;
}

export interface SpriteAnimationState {
  currentAction: string;
  currentFrame: number;
  timer: number;
}

export class SpriteRenderer {
  private configs: Record<string, SpriteActionConfig>;

  constructor(configs: Record<string, SpriteActionConfig>) {
    this.configs = configs;
  }

  /**
   * Advances the animation state based on delta time.
   * Delta time is clamped to at most 0.05s to prevent load hitches from causing frame jumps.
   */
  getNextState(
    currentState: SpriteAnimationState,
    deltaTime: number,
  ): SpriteAnimationState {
    const config = this.configs[currentState.currentAction];
    if (!config) return currentState;

    const clampedDt = Math.max(0, Math.min(deltaTime, 0.05));
    const nextState = {...currentState};
    nextState.timer += clampedDt;
    const frameDuration = 1 / Math.max(1, config.fps);

    if (nextState.timer >= frameDuration) {
      const framesToAdvance = Math.floor(nextState.timer / frameDuration);
      nextState.timer %= frameDuration;
      nextState.currentFrame =
        (nextState.currentFrame + framesToAdvance) % Math.max(1, config.totalFrames);

      if (
        config.loop === false &&
        nextState.currentFrame < currentState.currentFrame
      ) {
        nextState.currentFrame = config.totalFrames - 1;
      }
    }
    return nextState;
  }

  /**
   * Draws the sprite to the canvas using preloaded images.
   * Uses fixed source cell (512x512) with no dynamic offsets.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    state: SpriteAnimationState,
    x: number,
    y: number,
    width: number,
    height: number,
    loadedImages: Record<string, HTMLImageElement | null>,
  ) {
    const config = this.configs[state.currentAction];
    if (!config) return;

    const img = loadedImages[config.imageUrl];

    if (!img || !img.complete || img.naturalWidth === 0) {
      return;
    }

    const framesPerRow = Math.max(1, Math.floor(img.width / config.frameWidth));
    const sourceX = (state.currentFrame % framesPerRow) * config.frameWidth;
    const sourceY =
      Math.floor(state.currentFrame / framesPerRow) * config.frameHeight;

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      config.frameWidth,
      config.frameHeight,
      x,
      y,
      width,
      height,
    );
  }
}

/**
 * Unified corridor character drawer for Player Captain, Vance, Osk, and Teal Officer.
 * Renders destination rectangle 220x220 at x = Math.round(centerX - 110), y = Math.round(floorY - 220)
 * Anchors feet exactly on floorY = 688.
 * Fixed 512x512 source cell (or image native dimensions for non-spritesheet images).
 * Sine breathing modulation <= 1.5% and 1px bob on idle, anchored from bottom-center so feet stay planted.
 */
export function drawCorridorCharacter(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null | undefined,
  centerX: number,
  floorY: number,
  frameIndex: number,
  isWalking: boolean,
  facing: 'left' | 'right',
  idleTime: number,
) {
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const is512Cell = img.naturalWidth >= 512 && img.naturalHeight >= 512;
  const sx = is512Cell ? frameIndex * 512 : 0;
  const sy = 0;
  const sw = is512Cell ? 512 : img.naturalWidth;
  const sh = is512Cell ? 512 : img.naturalHeight;

  // Height destH set to match Officer Vance (~180px - 200px tall), anchored at floorY = 688
  const destH = 200;
  // Destination width calculated from image/frame aspect ratio (for 322x832, destW will be ~77px)
  const destW = Math.round(destH * (sw / sh));
  const destX = Math.round(centerX - destW / 2);
  const destY = Math.round(floorY - destH);

  ctx.save();

  // Horizontal flip: flip cleanly about the character's horizontal center (centerX) when facing left
  if (facing === 'left') {
    ctx.translate(centerX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-centerX, 0);
  }

  if (isWalking) {
    ctx.drawImage(img, sx, sy, sw, sh, destX, destY, destW, destH);
  } else {
    // Procedural sine breathing:
    // Vertical scale modulation <= 1.5% (1.0 + Math.sin(idleTime * 2.5) * 0.015) anchored from bottom-center
    // Subtle 1px vertical bob (Math.round(Math.sin(idleTime * 2.5) * 1.0))
    const scaleY = 1.0 + Math.sin(idleTime * 2.5) * 0.015;
    const bobY = Math.round(Math.sin(idleTime * 2.5) * 1.0);

    ctx.translate(centerX, floorY);
    ctx.scale(1.0, scaleY);
    ctx.translate(-centerX, -floorY);

    ctx.drawImage(img, sx, sy, sw, sh, destX, destY - bobY, destW, destH);
  }

  ctx.restore();
}
