import { Page, Locator, expect } from '@playwright/test';
 
/**
 * OSF analytics charts are Chart.js <canvas> charts (PrimeNG p-chart), so the
 * tooltip is painted onto the canvas — there is no tooltip element in the DOM.
 *
 * This probe wraps a few CanvasRenderingContext2D methods so a test can:
 *   - find where each point (arc) / bar (rect) was drawn, to hover it
 *   - read the text Chart.js paints for the tooltip (title + "Label: value")
 *
 * Call installChartProbe(page) BEFORE the first navigation.
 */
export async function installChartProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Shape = { x: number; y: number; w: number; h: number };
    type Probe = { texts: string[]; arcs: Shape[]; rects: Shape[] };
 
    const proto = CanvasRenderingContext2D.prototype;
    const probe = (ctx: CanvasRenderingContext2D): Probe => {
      const c = ctx.canvas as HTMLCanvasElement & { __pwProbe?: Probe };
      return (c.__pwProbe ??= { texts: [], arcs: [], rects: [] });
    };
    // Map user-space coords to canvas device pixels using the current transform.
    const toDevice = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      const m = ctx.getTransform();
      return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
    };
 
    // Chart.js clears the whole canvas at the start of every frame.
    const clearRect = proto.clearRect;
    proto.clearRect = function (...args: Parameters<typeof clearRect>) {
      const p = probe(this);
      p.texts = [];
      p.arcs = [];
      p.rects = [];
      return clearRect.apply(this, args);
    };
 
    const fillText = proto.fillText;
    proto.fillText = function (...args: Parameters<typeof fillText>) {
      probe(this).texts.push(String(args[0]));
      return fillText.apply(this, args);
    };
 
    // Line-chart points are drawn as circles.
    const arc = proto.arc;
    proto.arc = function (...args: Parameters<typeof arc>) {
      const c = toDevice(this, args[0], args[1]);
      probe(this).arcs.push({ x: c.x, y: c.y, w: 0, h: 0 });
      return arc.apply(this, args);
    };
 
    // Bars are drawn as rect paths.
    const rect = proto.rect;
    proto.rect = function (...args: Parameters<typeof rect>) {
      const [x, y, w, h] = args;
      const a = toDevice(this, x, y);
      const b = toDevice(this, x + w, y + h);
      probe(this).rects.push({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y });
      return rect.apply(this, args);
    };
 
    // Chart.js also uses rect() + clip() for scale/chart-area clipping;
    // a rect that is immediately clipped is not a bar, so drop it.
    const clip = proto.clip;
    proto.clip = function (...args: any[]) {
      probe(this).rects.pop();
      return (clip as any).apply(this, args);
    };
  });
}
 
export type ChartPosition = { x: number; y: number };
export type TooltipReading = { title: string; label: string; value: number };
 
type Kind = 'point' | 'bar';
 
/** Hover positions (CSS px, relative to the canvas) of every point or bar, in data order. */
async function readPositions(canvas: Locator, kind: Kind): Promise<ChartPosition[]> {
  return canvas.evaluate((el, kind) => {
    const c = el as HTMLCanvasElement & {
      __pwProbe?: { arcs: any[]; rects: any[] };
    };
    const shapes = (kind === 'point' ? c.__pwProbe?.arcs : c.__pwProbe?.rects) ?? [];
    const sx = c.clientWidth / c.width;
    const sy = c.clientHeight / c.height;
    // Centre of each shape, rounded so animation jitter settles quickly.
    return shapes.map((s) => ({
      x: Math.round((s.x + s.w / 2) * sx),
      y: Math.round((s.y + s.h / 2) * sy),
    }));
  }, kind);
}
 
/** Positions once the chart has finished its draw animation. */
export async function getChartPositions(
  canvas: Locator,
  kind: Kind,
  expectedCount: number,
): Promise<ChartPosition[]> {
  let previous = '';
  let positions: ChartPosition[] = [];
  await expect
    .poll(
      async () => {
        positions = await readPositions(canvas, kind);
        const snapshot = JSON.stringify(positions);
        const stable = positions.length === expectedCount && snapshot === previous;
        previous = snapshot;
        return stable;
      },
      { message: `chart ${kind}s did not settle at ${expectedCount} elements`, intervals: [250] },
    )
    .toBe(true)
    .catch(async (e) => {
      const probed = await canvas.evaluate((el) => '__pwProbe' in el).catch(() => false);
      throw new Error(
        `Expected ${expectedCount} ${kind}(s) on the chart but found ${positions.length}: ` +
          JSON.stringify(positions) +
          (probed
            ? ''
            : '\nThe canvas was never recorded: call installChartProbe(page) before the first page.goto.') +
          `\n${e.message}`,
      );
    });
  return positions;
}
 
/**
 * Hover a position on the canvas and return the tooltip Chart.js paints.
 * Tooltip body lines look like "Visits: 3"; the title is the line drawn just before.
 */
export async function readTooltipAt(
  canvas: Locator,
  position: ChartPosition,
): Promise<TooltipReading> {
  const latestTooltip = async (): Promise<TooltipReading | null> => {
    const texts: string[] = await canvas.evaluate((el) => (el as any).__pwProbe?.texts ?? []);
    for (let i = texts.length - 1; i > 0; i--) {
      const m = texts[i].match(/^(.*): ([\d,.]+)$/);
      if (m) {
        return { title: texts[i - 1], label: m[1], value: Number(m[2].replace(/,/g, '')) };
      }
    }
    return null;
  };
 
  // Move off the chart first so the previous tooltip is gone and can't be
  // mistaken for the new one.
  await canvas.page().mouse.move(0, 0);
  await expect
    .poll(latestTooltip, { message: 'previous tooltip did not clear' })
    .toBeNull();
 
  await canvas.hover({ position });
 
  let reading: TooltipReading | null = null;
  await expect
    .poll(
      async () => (reading = await latestTooltip()) !== null,
      { message: `no tooltip drawn at (${position.x}, ${position.y})` },
    )
    .toBe(true);
  return reading!;
}
 
/**
 * Read tooltips for the given data indices (default: all) of a chart.
 * `count` is the number of points/bars expected (i.e. the API array length).
 * Zero-height bars can't be hovered, so callers should skip them for bar charts.
 */
export async function readChartTooltips(
  canvas: Locator,
  kind: Kind,
  count: number,
  indices: number[] = [...Array(count).keys()],
): Promise<Map<number, TooltipReading>> {
  const positions = await getChartPositions(canvas, kind, count);
  const readings = new Map<number, TooltipReading>();
  for (const i of indices) {
    readings.set(i, await readTooltipAt(canvas, positions[i]));
  }
  return readings;
}
 