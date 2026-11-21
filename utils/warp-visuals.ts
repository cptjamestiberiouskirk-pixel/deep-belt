export function createWarpVisuals() {
  return {heading: 0, distance: 0, intensity: 0, entryAt: 0, exitAt: 0, exitIntensity: 0};
}

const stars = Array.from({length: 84}, (_, index) => ({
  phase: ((index * 41) % 89) / 89,
  lane: (((index * 73) % 89) - 44) / 44,
  depth: index % 3,
}));

/** Screen-space star trails in the plane of the ship's travel. */
export function drawWarpFlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  {heading, distance, intensity}: ReturnType<typeof createWarpVisuals>,
) {
  if (intensity < 0.01) return;

  const span = Math.hypot(width, height);
  const pathLength = span + 240;
  ctx.save();
  ctx.fillStyle = '#080f22';
  ctx.globalAlpha = 0.64 * intensity;
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate(heading);

  // The depth layers move aft at different speeds. They wrap beyond the
  // visible canvas, and fan out slightly as they pass around the ship.
  for (const {phase, lane, depth} of stars) {
    const progress = (phase + distance * (0.56 + depth * 0.24) / pathLength) % 1;
    const x = pathLength * (0.5 - progress);
    const baseY = (lane < 0 ? -1 : 1) * (45 + Math.abs(lane) * span * 0.48);
    const y = baseY * (0.8 + 0.35 * progress);
    const length = (25 + depth * 38) * intensity;
    ctx.lineWidth = 0.8 + depth * 0.38;
    ctx.globalAlpha = intensity * (0.22 + depth * 0.16);
    ctx.strokeStyle = depth === 2 ? '#d6ebff' : '#7798ba';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y - baseY * 0.35 * length / pathLength);
    ctx.stroke();
  }
  ctx.restore();
}
