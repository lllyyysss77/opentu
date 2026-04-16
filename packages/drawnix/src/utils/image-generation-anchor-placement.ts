import {
  RectangleClient,
  type PlaitBoard,
  type Point,
} from '@plait/core';

interface AnchorSize {
  width: number;
  height: number;
}

interface AnchorPlacementOptions {
  gap?: number;
  padding?: number;
  ignoreElementIds?: string[];
  ignoreTypes?: string[];
  maxSearchRadius?: number;
}

export function resolveImageGenerationBatchAnchorSeedPosition(
  origin: Point,
  size: AnchorSize,
  index: number,
  total: number,
  gap = 32
): Point {
  const columns = total <= 2 ? total : total <= 4 ? 2 : 3;
  const row = Math.floor(index / columns);
  const column = index % columns;

  return [
    origin[0] + column * (size.width + gap),
    origin[1] + row * (size.height + gap),
  ];
}

function hasElementPoints(
  value: unknown
): value is {
  id?: string;
  type?: string;
  points: [Point, Point];
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { points?: unknown }).points) &&
    (value as { points: unknown[] }).points.length === 2
  );
}

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
  padding: number
): boolean {
  return (
    left.x < right.x + right.width + padding &&
    left.x + left.width + padding > right.x &&
    left.y < right.y + right.height + padding &&
    left.y + left.height + padding > right.y
  );
}

function buildCandidatePositions(
  origin: Point,
  stepX: number,
  stepY: number,
  maxSearchRadius: number
): Point[] {
  const candidates: Point[] = [origin];

  for (let radius = 1; radius <= maxSearchRadius; radius += 1) {
    candidates.push(
      [origin[0] + stepX * radius, origin[1]],
      [origin[0], origin[1] + stepY * radius],
      [origin[0] + stepX * radius, origin[1] + stepY * radius],
      [origin[0] - stepX * radius, origin[1]],
      [origin[0] - stepX * radius, origin[1] + stepY * radius],
      [origin[0], origin[1] - stepY * radius],
      [origin[0] + stepX * radius, origin[1] - stepY * radius],
      [origin[0] - stepX * radius, origin[1] - stepY * radius]
    );
  }

  return candidates;
}

export function resolveImageGenerationAnchorAvailablePosition(
  board: PlaitBoard,
  desiredPosition: Point,
  size: AnchorSize,
  options: AnchorPlacementOptions = {}
): Point {
  const {
    gap = 40,
    padding = 16,
    ignoreElementIds = [],
    ignoreTypes = ['workzone'],
    maxSearchRadius = 6,
  } = options;

  const occupiedRects = board.children
    .filter(hasElementPoints)
    .filter(
      (element) =>
        !ignoreTypes.includes(element.type ?? '') &&
        !ignoreElementIds.includes(element.id ?? '')
    )
    .map((element) => ({
      ...RectangleClient.getRectangleByPoints(
        (element as unknown as { points: [Point, Point] }).points
      ),
      id: element.id,
      type: element.type,
    }));

  const stepX = size.width + gap;
  const stepY = size.height + gap;
  const candidates = buildCandidatePositions(
    desiredPosition,
    stepX,
    stepY,
    maxSearchRadius
  );

  for (const candidate of candidates) {
    const candidateRect = {
      x: candidate[0],
      y: candidate[1],
      width: size.width,
      height: size.height,
    };

    const overlaps = occupiedRects.some((rect) =>
      rectanglesOverlap(candidateRect, rect, padding)
    );

    if (!overlaps) {
      return candidate;
    }
  }

  return [desiredPosition[0], desiredPosition[1] + stepY * (maxSearchRadius + 1)];
}
