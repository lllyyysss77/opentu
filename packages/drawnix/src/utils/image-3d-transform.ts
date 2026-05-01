import type { PlaitElement, Point, RectangleClient } from '@plait/core';
import { PlaitDrawElement } from '@plait/draw';

export interface Image3DTransform {
  rotateX: number;
  rotateY: number;
  perspective: number;
}

export const DEFAULT_IMAGE_3D_PERSPECTIVE = 800;
export const MAX_IMAGE_3D_ROTATION = 180;
export const IMAGE_3D_RESET_EPSILON = 0.01;
export const IMAGE_3D_SVG_EDGE_SCALE_EPSILON = 0.02;
export const IMAGE_3D_PROJECTION_NEAR_PLANE_EPSILON = 1;
export const IMAGE_3D_DEBUG_STORAGE_KEY = 'drawnix:image3d:debug';

export function isImage3DDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(IMAGE_3D_DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function debugImage3D(message: string, details?: unknown): void {
  if (!isImage3DDebugEnabled()) {
    return;
  }

  if (details === undefined) {
    console.debug(`[Image3D] ${message}`);
    return;
  }

  console.debug(`[Image3D] ${message}`, details);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundAngle(value: number): number {
  return Math.round(value * 100) / 100;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function sanitizeImage3DTransform(
  value: unknown
): Image3DTransform | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const transform = value as Partial<Image3DTransform>;
  const rotateX = roundAngle(
    clamp(asNumber(transform.rotateX, 0), -MAX_IMAGE_3D_ROTATION, MAX_IMAGE_3D_ROTATION)
  );
  const rotateY = roundAngle(
    clamp(asNumber(transform.rotateY, 0), -MAX_IMAGE_3D_ROTATION, MAX_IMAGE_3D_ROTATION)
  );
  const perspective = Math.max(
    1,
    asNumber(transform.perspective, DEFAULT_IMAGE_3D_PERSPECTIVE)
  );

  if (
    Math.abs(rotateX) <= IMAGE_3D_RESET_EPSILON &&
    Math.abs(rotateY) <= IMAGE_3D_RESET_EPSILON
  ) {
    return undefined;
  }

  return { rotateX, rotateY, perspective };
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export interface Image3DSvgOverlayGeometry {
  points: Point[];
  pointsAttribute: string;
  boundingBox: RectangleClient;
  textureTransform?: string;
}

function projectImage3DPoint(
  x: number,
  y: number,
  transform: Image3DTransform
): Point {
  const rotateX = degreesToRadians(transform.rotateX);
  const rotateY = degreesToRadians(transform.rotateY);
  const cosX = Math.cos(rotateX);
  const sinX = Math.sin(rotateX);
  const cosY = Math.cos(rotateY);
  const sinY = Math.sin(rotateY);
  const rotatedX = x * cosY;
  const rotatedZAfterY = -x * sinY;
  const rotatedY = y * cosX - rotatedZAfterY * sinX;
  const rotatedZ = y * sinX + rotatedZAfterY * cosX;
  const perspective = Math.max(
    IMAGE_3D_PROJECTION_NEAR_PLANE_EPSILON,
    transform.perspective
  );
  const denominator = Math.max(
    IMAGE_3D_PROJECTION_NEAR_PLANE_EPSILON,
    perspective - rotatedZ
  );
  const scale = perspective / denominator;

  return [roundAngle(rotatedX * scale), roundAngle(rotatedY * scale)];
}

export function getImage3DSvgOverlayGeometry(
  rectangle: RectangleClient,
  transform: Image3DTransform
): Image3DSvgOverlayGeometry {
  const centerX = rectangle.x + rectangle.width / 2;
  const centerY = rectangle.y + rectangle.height / 2;
  const halfWidth = rectangle.width / 2;
  const halfHeight = rectangle.height / 2;
  const localPoints = [
    projectImage3DPoint(-halfWidth, -halfHeight, transform),
    projectImage3DPoint(halfWidth, -halfHeight, transform),
    projectImage3DPoint(halfWidth, halfHeight, transform),
    projectImage3DPoint(-halfWidth, halfHeight, transform),
  ];
  const points = localPoints.map(
    ([x, y]) => [roundAngle(centerX + x), roundAngle(centerY + y)] as Point
  );
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const width = Math.max(IMAGE_3D_SVG_EDGE_SCALE_EPSILON, maxX - minX);
  const height = Math.max(IMAGE_3D_SVG_EDGE_SCALE_EPSILON, maxY - minY);
  const textureTransforms: string[] = [];

  if (Math.abs(transform.rotateY) > 90) {
    textureTransforms.push(
      `translate(${roundAngle(minX + width / 2)} ${roundAngle(
        minY + height / 2
      )}) scale(-1 1) translate(${-roundAngle(minX + width / 2)} ${-roundAngle(
        minY + height / 2
      )})`
    );
  }
  if (Math.abs(transform.rotateX) > 90) {
    textureTransforms.push(
      `translate(${roundAngle(minX + width / 2)} ${roundAngle(
        minY + height / 2
      )}) scale(1 -1) translate(${-roundAngle(minX + width / 2)} ${-roundAngle(
        minY + height / 2
      )})`
    );
  }

  return {
    points,
    pointsAttribute: points
      .map((point) => `${point[0]},${point[1]}`)
      .join(' '),
    boundingBox: {
      x: minX,
      y: minY,
      width,
      height,
    },
    textureTransform: textureTransforms.length
      ? textureTransforms.join(' ')
      : undefined,
  };
}

function isVideoLikeImage(element: PlaitElement & { url?: unknown }): boolean {
  if ((element as any).isVideo === true || typeof (element as any).videoType === 'string') {
    return true;
  }

  const url = typeof element.url === 'string' ? element.url.toLowerCase() : '';
  if (!url) {
    return false;
  }

  return (
    url.includes('#video') ||
    url.includes('#merged-video-') ||
    ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'].some((ext) =>
      url.includes(ext)
    )
  );
}

function isLegacyAudioImage(element: PlaitElement): boolean {
  return (
    (element as any).isAudio === true ||
    (element as any).audioType === 'music-card' ||
    (typeof (element as any).audioUrl === 'string' &&
      (element as any).audioUrl.length > 0)
  );
}

export function isOrdinary3DTransformImage(
  element: PlaitElement | null | undefined
): element is PlaitElement & { points: [Point, Point]; url: string } {
  if (!element) {
    return false;
  }

  return (
    PlaitDrawElement.isDrawElement(element) &&
    PlaitDrawElement.isImage(element) &&
    Array.isArray((element as any).points) &&
    (element as any).points.length >= 2 &&
    typeof (element as any).url === 'string' &&
    !isVideoLikeImage(element as any) &&
    !isLegacyAudioImage(element) &&
    (element as any).pptImagePlaceholder !== true
  );
}
