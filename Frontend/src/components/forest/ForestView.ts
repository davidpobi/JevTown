import { forestArtworkHeight, forestSceneAnchor, forestSceneHeight, forestSceneWidth } from "@/components/forest/sceneLayout";
import type { Forest, ForestTheme, ForestView, Point } from "@/game/forest/types";

type Options = { theme: ForestTheme; view: ForestView; debug: boolean };

type ForestAssets = {
  day: HTMLImageElement;
  night: HTMLImageElement;
  foreground: HTMLImageElement;
  blue: HTMLImageElement;
  yellow: HTMLImageElement;
  relic: HTMLImageElement;
};

const planPalette = {
  day: { backdrop: "#dce8d0", trail: "#c49a67", brush: "#315938", water: "#3a81a5", ruins: "#849174", bridge: "#855d3b", glow: "#8656df" },
  night: { backdrop: "#091321", trail: "#445747", brush: "#102c25", water: "#174a72", ruins: "#405345", bridge: "#5e422e", glow: "#c68cff" },
} as const;

const sceneScale = forestSceneHeight / forestArtworkHeight;
const sceneOffsetX = (forestSceneWidth - forestSceneWidth * sceneScale) / 2;
const scenePoint = (point: Point) => {
  const anchor = forestSceneAnchor(point);
  return { x: anchor.x * sceneScale + sceneOffsetX, y: anchor.y * sceneScale };
};
const sceneSize = (value: number) => value * sceneScale;

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.decoding = "async";
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Could not load ${src}.`));
  image.src = src;
});

const loadForestAssets = async (): Promise<ForestAssets> => {
  const [day, night, foreground, blue, yellow, relic] = await Promise.all([
    loadImage("/forest/day-scene.png"),
    loadImage("/forest/night-scene.png"),
    loadImage("/forest/foreground-overlay.png"),
    loadImage("/forest/jev-blue.png"),
    loadImage("/forest/jev-yellow.png"),
    loadImage("/forest/relic.png"),
  ]);
  return { day, night, foreground, blue, yellow, relic };
};

const drawPath = (ctx: CanvasRenderingContext2D, route: Point[], color: string) => {
  if (route.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = sceneSize(3);
  ctx.setLineDash([sceneSize(7), sceneSize(8)]);
  ctx.beginPath();
  route.forEach((point, index) => {
    const anchor = scenePoint(point);
    if (index === 0) ctx.moveTo(anchor.x, anchor.y);
    else ctx.lineTo(anchor.x, anchor.y);
  });
  ctx.stroke();
  ctx.restore();
};

const drawLabel = (ctx: CanvasRenderingContext2D, point: Point, name: string, color: string) => {
  const anchor = scenePoint(point);
  ctx.save();
  ctx.font = `600 ${sceneSize(13)}px Arial`;
  const labelWidth = ctx.measureText(name).width + sceneSize(18);
  ctx.fillStyle = "rgba(5, 14, 21, .78)";
  ctx.strokeStyle = color;
  ctx.lineWidth = sceneSize(2);
  ctx.roundRect(anchor.x - labelWidth / 2, anchor.y - sceneSize(72), labelWidth, sceneSize(25), sceneSize(5));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f8fdff";
  ctx.textAlign = "center";
  ctx.fillText(name, anchor.x, anchor.y - sceneSize(55));
  ctx.restore();
};

const drawAgent = (ctx: CanvasRenderingContext2D, point: Point, sprite: HTMLImageElement, name: string, color: string) => {
  const anchor = scenePoint(point);
  const size = sceneSize(104);
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, .34)";
  ctx.beginPath();
  ctx.ellipse(anchor.x, anchor.y + sceneSize(25), sceneSize(33), sceneSize(10), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(sprite, anchor.x - size / 2, anchor.y - size / 2 - 13, size, size);
  ctx.restore();
  drawLabel(ctx, point, name, color);
};

const drawScenic = (ctx: CanvasRenderingContext2D, forest: Forest, options: Options, assets: ForestAssets) => {
  const background = options.theme === "day" ? assets.day : assets.night;
  ctx.drawImage(background, sceneOffsetX, 0, forestSceneWidth * sceneScale, forestSceneHeight);

  forest.relics.forEach((relic, index) => {
    const id = `R${index + 1}`;
    if (forest.blue.relics.includes(id) || forest.yellow.relics.includes(id)) return;
    const anchor = scenePoint(relic);
    const size = sceneSize(82);
    ctx.save();
    ctx.globalAlpha = options.theme === "night" ? 1 : .94;
    ctx.drawImage(assets.relic, anchor.x - size / 2, anchor.y - size / 2, size, size);
    ctx.restore();
  });

  drawPath(ctx, [forest.blue.position, ...forest.blue.path.slice(0, 8)], "rgba(54, 169, 219, .82)");
  drawPath(ctx, [forest.yellow.position, ...forest.yellow.path.slice(0, 8)], "rgba(232, 182, 50, .82)");
  drawAgent(ctx, forest.blue.position, assets.blue, "Blue", "#36a9db");
  drawAgent(ctx, forest.yellow.position, assets.yellow, "Yellow", "#e8b632");

  ctx.drawImage(assets.foreground, sceneOffsetX, 0, forestSceneWidth * sceneScale, forestSceneHeight);

  if (options.debug) {
    ctx.save();
    ctx.font = "10px ui-monospace, monospace";
    forest.terrain.forEach((row, y) => row.forEach((_, x) => {
      const anchor = scenePoint({ x, y });
      ctx.fillStyle = "rgba(255, 255, 255, .9)";
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, sceneSize(3), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(`${x},${y}`, anchor.x + 5, anchor.y - 5);
    }));
    ctx.restore();
  }
};

const drawPlan = (ctx: CanvasRenderingContext2D, forest: Forest, options: Options) => {
  const palette = planPalette[options.theme];
  const tile = 52;
  const originX = (forestSceneWidth - forest.width * tile) / 2;
  const originY = (forestSceneHeight - forest.height * tile) / 2;
  const cellCenter = (point: Point) => ({ x: originX + point.x * tile + tile / 2, y: originY + point.y * tile + tile / 2 });

  ctx.fillStyle = palette.backdrop;
  ctx.fillRect(0, 0, forestSceneWidth, forestSceneHeight);
  forest.terrain.forEach((row, y) => row.forEach((terrain, x) => {
    const xPos = originX + x * tile;
    const yPos = originY + y * tile;
    ctx.fillStyle = terrain === "trail" ? palette.trail : terrain === "brush" ? palette.brush : terrain === "water" ? palette.water : terrain === "bridge" ? palette.bridge : palette.ruins;
    ctx.fillRect(xPos, yPos, tile, tile);
    ctx.strokeStyle = "rgba(255, 255, 255, .18)";
    ctx.strokeRect(xPos, yPos, tile, tile);
  }));

  forest.relics.forEach((relic, index) => {
    const id = `R${index + 1}`;
    if (forest.blue.relics.includes(id) || forest.yellow.relics.includes(id)) return;
    const point = cellCenter(relic);
    ctx.save();
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = palette.glow;
    ctx.translate(point.x, point.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-11, -11, 22, 22);
    ctx.restore();
  });

  ([
    [forest.blue.position, "#36a9db", "Blue"],
    [forest.yellow.position, "#e8b632", "Yellow"],
  ] as const).forEach(([point, color, name]) => {
    const center = cellCenter(point);
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 15, 17, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6ffff";
    ctx.fillRect(center.x - 8, center.y - 4, 5, 5);
    ctx.fillRect(center.x + 3, center.y - 4, 5, 5);
    ctx.font = "600 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(name, center.x, center.y - 25);
  });
};

export const createForestRenderer = async (host: HTMLElement) => {
  const canvas = document.createElement("canvas");
  canvas.width = forestSceneWidth;
  canvas.height = forestSceneHeight;
  canvas.style.cssText = "display:block;width:100%;height:auto";
  canvas.setAttribute("role", "img");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable in this browser.");

  const assets = await loadForestAssets();
  host.replaceChildren(canvas);

  const draw = (forest: Forest, options: Options) => {
    if (options.view === "plan") drawPlan(ctx, forest, options);
    else drawScenic(ctx, forest, options, assets);
  };

  return { draw, destroy: () => canvas.remove() };
};
