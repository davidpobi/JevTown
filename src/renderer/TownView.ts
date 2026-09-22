import type { Point, Town } from "@/game/types";

export type SceneTheme = "day" | "night";
export type MapView = "isometric" | "plan";

type SceneOptions = { theme: SceneTheme; view: MapView };

export type TownRenderer = {
  draw: (town: Town, options: SceneOptions) => void;
  destroy: () => void;
};

const canvasWidth = 900;
// The taller stage leaves enough room for the complete hard board and keeps
// the right-side match panel the same height as the scene.
const canvasHeight = 720;
const isoTileSize = 38;
const planTileSize = 42;
const sceneZoom = 1.25;
type TownDimensions = Pick<Town, "width" | "height">;
type ViewportOffset = { x: number; y: number };

const scenes = {
  day: {
    background: "#dce8d0",
    ground: "#b9d48f",
    path: "#d8c3a5",
    treeTrunk: "#70513c",
    treeBase: "#477452",
    treeHighlight: "#67955f",
    grid: "rgba(38, 51, 45, 0.13)",
  },
  night: {
    background: "#1c1c1c",
    ground: "#2a4b53",
    path: "#28303a",
    treeTrunk: "#554239",
    treeBase: "#1c423f",
    treeHighlight: "#35665a",
    grid: "rgba(243, 241, 237, 0.1)",
  },
} as const;

const projectedTileSize = (dimensions: TownDimensions, view: MapView) => {
  if (view === "plan") return Math.min(
    planTileSize * sceneZoom,
    (canvasWidth - 100) / dimensions.width,
    (canvasHeight - 120) / dimensions.height,
  );
  return Math.min(
    isoTileSize * sceneZoom,
    (canvasWidth - 120) / (dimensions.width + dimensions.height),
    (canvasHeight - 100) / ((dimensions.width + dimensions.height) * 0.5),
  );
};

const toIsometric = (point: Point, dimensions: TownDimensions, offset: ViewportOffset) => {
  const tileSize = projectedTileSize(dimensions, "isometric");
  const boardWidthBias = (dimensions.width - dimensions.height) * tileSize * 0.5;
  return {
    x: canvasWidth / 2 - boardWidthBias + (point.x - point.y) * tileSize + offset.x,
    y: (canvasHeight - (dimensions.width + dimensions.height) * tileSize * 0.5) / 2 + (point.x + point.y) * tileSize * 0.5 + offset.y,
  };
};

const toPlan = (point: Point, dimensions: TownDimensions) => {
  const tileSize = projectedTileSize(dimensions, "plan");
  return {
    x: (canvasWidth - dimensions.width * tileSize) / 2 + point.x * tileSize,
    y: (canvasHeight - dimensions.height * tileSize) / 2 + point.y * tileSize,
  };
};

const project = (point: Point, view: MapView, dimensions: TownDimensions, offset: ViewportOffset) =>
  view === "isometric" ? toIsometric(point, dimensions, offset) : toPlan(point, dimensions);

const drawTile = (
  context: CanvasRenderingContext2D,
  point: Point,
  fill: string,
  view: MapView,
  dimensions: TownDimensions,
  offset: ViewportOffset,
) => {
  const projected = project(point, view, dimensions, offset);
  const tileSize = projectedTileSize(dimensions, view);
  context.fillStyle = fill;
  context.beginPath();

  if (view === "plan") {
    context.rect(projected.x, projected.y, tileSize, tileSize);
  } else {
    context.moveTo(projected.x, projected.y);
    context.lineTo(projected.x + tileSize, projected.y + tileSize * 0.5);
    context.lineTo(projected.x, projected.y + tileSize);
    context.lineTo(projected.x - tileSize, projected.y + tileSize * 0.5);
    context.closePath();
  }

  context.fill();
};

const drawTree = (
  context: CanvasRenderingContext2D,
  point: { x: number; y: number },
  theme: SceneTheme,
  scale = 1,
) => {
  const palette = scenes[theme];
  context.fillStyle = palette.treeTrunk;
  context.fillRect(point.x - 4 * scale, point.y - 18 * scale, 8 * scale, 22 * scale);
  context.fillStyle = palette.treeBase;
  context.beginPath();
  context.arc(point.x, point.y - 24 * scale, 18 * scale, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = palette.treeHighlight;
  context.beginPath();
  context.arc(point.x - 8 * scale, point.y - 31 * scale, 11 * scale, 0, Math.PI * 2);
  context.arc(point.x + 9 * scale, point.y - 31 * scale, 11 * scale, 0, Math.PI * 2);
  context.fill();
};

const drawTreasure = (
  context: CanvasRenderingContext2D,
  point: { x: number; y: number },
  colour: string,
) => {
  context.fillStyle = "rgba(255, 213, 109, 0.28)";
  context.beginPath();
  context.arc(point.x, point.y - 7, 22, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = colour;
  context.fillRect(point.x - 10, point.y - 16, 20, 14);
  context.fillStyle = "#fff5c8";
  context.fillRect(point.x - 1, point.y - 16, 3, 14);
};

const drawTreasureSignal = (
  context: CanvasRenderingContext2D,
  point: { x: number; y: number },
  theme: SceneTheme,
) => {
  const y = point.y - 20 + Math.sin(Date.now() / 380 + point.x * 0.03) * 4;
  const fill = theme === "day" ? "#6a56bd" : "#c792ea";

  context.save();
  context.translate(point.x, y);
  context.rotate(Math.PI / 4);
  context.fillStyle = "rgba(255, 255, 255, 0.5)";
  context.fillRect(-11, -11, 22, 22);
  context.fillStyle = fill;
  context.fillRect(-7, -7, 14, 14);
  context.restore();
};

const drawRoute = (
  context: CanvasRenderingContext2D,
  from: Point,
  path: Point[],
  colour: string,
  view: MapView,
  dimensions: TownDimensions,
  offset: ViewportOffset,
) => {
  if (path.length === 0) return;

  // `project` returns a tile's top vertex in isometric view. Routes and actors
  // live at the centre of a walkable diamond, which keeps them visually clear
  // of a tree in the immediately preceding cell.
  const tileSize = projectedTileSize(dimensions, view);
  const xOffset = view === "plan" ? tileSize / 2 : 0;
  const yOffset = tileSize / 2;
  const start = project(from, view, dimensions, offset);
  context.beginPath();
  context.moveTo(start.x + xOffset, start.y - 4 + yOffset);

  for (const cell of path) {
    const point = project(cell, view, dimensions, offset);
    context.lineTo(point.x + xOffset, point.y - 4 + yOffset);
  }

  context.strokeStyle = colour;
  context.globalAlpha = 0.58;
  context.lineWidth = 4;
  context.setLineDash([7, 8]);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = 1;
};

const drawExplorer = (
  context: CanvasRenderingContext2D,
  point: { x: number; y: number },
  colour: string,
  view: MapView,
  dimensions: TownDimensions,
) => {
  const tileSize = projectedTileSize(dimensions, view);
  const x = point.x + (view === "plan" ? tileSize / 2 : 0);
  // Tree canopies intentionally spill upward into the cell above. Lift a
  // plan-view explorer within its own tile so an explorer beside the border
  // never reads as standing on a tree.
  const y = point.y + tileSize / 2 + (view === "plan" ? -16 : 0);
  context.fillStyle = "rgba(39, 51, 45, 0.2)";
  context.beginPath();
  context.ellipse(x, y + 6, 13, 5, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = colour;
  context.beginPath();
  context.arc(x, y - 8, 12, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(x - 4, y - 10, 2, 0, Math.PI * 2);
  context.arc(x + 4, y - 10, 2, 0, Math.PI * 2);
  context.fill();
};

export const createTownRenderer = async (
  host: HTMLElement,
): Promise<TownRenderer> => {
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "JevTown map");

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable in this browser.");
  host.replaceChildren(canvas);

  let latestTown: Town | null = null;
  let previousTown: Town | null = null;
  let latestOptions: SceneOptions | null = null;
  let transitionStartedAt = 0;
  let animationFrame = 0;
  let viewportOffset: ViewportOffset = { x: 0, y: 0 };
  let drag: { pointerId: number; x: number; y: number } | null = null;

  const paint = (town: Town, options: SceneOptions) => {
    const palette = scenes[options.theme];
    const dimensions = { width: town.width, height: town.height };
    const offset = options.view === "isometric" ? viewportOffset : { x: 0, y: 0 };
    canvas.style.cursor = options.view === "isometric" ? "grab" : "default";
    canvas.setAttribute("aria-label", options.view === "isometric" ? "JevTown isometric map. Drag to pan." : "JevTown map");
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.fillStyle = palette.background;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    const explorerPoint = (cell: Point) => {
      const point = project(cell, options.view, dimensions, offset);
      if (options.view === "plan") return point;

      // Border trees deliberately overhang their path tiles. Pull an explorer
      // slightly toward the field centre so a legal cell beside the perimeter
      // reads as being in the grass, rather than perched on the nearby canopy.
      const boardCentre = project(
        { x: (town.width - 1) / 2, y: (town.height - 1) / 2 },
        options.view,
        dimensions,
        offset,
      );
      const dx = boardCentre.x - point.x;
      const dy = boardCentre.y - point.y;
      const length = Math.hypot(dx, dy) || 1;
      const inset = projectedTileSize(dimensions, options.view) * 1.1;
      return { x: point.x + (dx / length) * inset, y: point.y + (dy / length) * inset };
    };

    for (let y = 0; y < town.height; y += 1) {
      for (let x = 0; x < town.width; x += 1) {
        const cell = { x, y };
        drawTile(
          context,
          cell,
          town.blocked[y][x] ? palette.path : palette.ground,
          options.view,
          dimensions,
          offset,
        );

        if (options.view === "plan") {
          const point = project(cell, options.view, dimensions, offset);
          const tileSize = projectedTileSize(dimensions, options.view);
          context.strokeStyle = palette.grid;
          context.strokeRect(point.x, point.y, tileSize, tileSize);
        }

        if (town.blocked[y][x]) {
          const point = project(cell, options.view, dimensions, offset);
          const tileSize = projectedTileSize(dimensions, options.view);
          drawTree(
            context,
            options.view === "plan"
              ? { x: point.x + tileSize / 2, y: point.y + tileSize / 2 }
              : point,
            options.theme,
            tileSize / (options.view === "plan" ? planTileSize : isoTileSize),
          );
        }
      }
    }

    // A visible cell is not a found treasure. The signal remains in place until
    // an explorer physically reaches it and the rules engine records collection.
    const collectedTreasures = new Set([
      ...town.blue.treasures,
      ...town.yellow.treasures,
    ]);
    const treasureColours = ["#f5b642", "#c98adb", "#87bde5"];

    town.treasures.forEach((treasure, index) => {
      const treasureId = `T${index + 1}`;
      const point = project(treasure, options.view, dimensions, offset);
      const tileSize = projectedTileSize(dimensions, options.view);
      const displayPoint = options.view === "plan"
        ? { x: point.x + tileSize / 2, y: point.y + tileSize / 2 }
        : { x: point.x, y: point.y + tileSize / 2 };

      if (collectedTreasures.has(treasureId)) {
        drawTreasure(context, displayPoint, treasureColours[index]);
      } else {
        drawTreasureSignal(context, displayPoint, options.theme);
      }
    });

    drawRoute(context, town.blue.position, town.blue.path, "#1685bc", options.view, dimensions, offset);
    drawRoute(context, town.yellow.position, town.yellow.path, "#c4861b", options.view, dimensions, offset);
    drawExplorer(context, explorerPoint(town.blue.position), "#37a8d8", options.view, dimensions);
    drawExplorer(context, explorerPoint(town.yellow.position), "#e9b832", options.view, dimensions);
  };

  const pointerCoordinates = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvasWidth / bounds.width),
      y: (event.clientY - bounds.top) * (canvasHeight / bounds.height),
    };
  };
  const onPointerDown = (event: PointerEvent) => {
    if (latestOptions?.view !== "isometric") return;
    const point = pointerCoordinates(event);
    drag = { pointerId: event.pointerId, ...point };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId || !latestTown || !latestOptions) return;
    const point = pointerCoordinates(event);
    viewportOffset = { x: viewportOffset.x + point.x - drag.x, y: viewportOffset.y + point.y - drag.y };
    drag = { ...drag, ...point };
    paint(latestTown, latestOptions);
    canvas.style.cursor = "grabbing";
  };
  const finishDrag = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = "grab";
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", finishDrag);
  canvas.addEventListener("pointercancel", finishDrag);

  const animate = () => {
    if (latestTown && latestOptions) {
      const duration = 420;
      const progress = previousTown && previousTown.seed === latestTown.seed
        ? Math.min((performance.now() - transitionStartedAt) / duration, 1)
        : 1;
      const interpolate = (from: Point, to: Point): Point => ({
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      });
      const visualTown = progress < 1 && previousTown
        ? {
          ...latestTown,
          blue: { ...latestTown.blue, position: interpolate(previousTown.blue.position, latestTown.blue.position) },
          yellow: { ...latestTown.yellow, position: interpolate(previousTown.yellow.position, latestTown.yellow.position) },
        }
        : latestTown;
      paint(visualTown, latestOptions);
    }
    animationFrame = window.requestAnimationFrame(animate);
  };
  animationFrame = window.requestAnimationFrame(animate);

  return {
    draw: (town, options) => {
      previousTown = latestTown;
      latestTown = town;
      latestOptions = options;
      transitionStartedAt = performance.now();
      paint(town, options);
    },
    destroy: () => {
      window.cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", finishDrag);
      canvas.removeEventListener("pointercancel", finishDrag);
      canvas.remove();
    },
  };
};
