import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_3D_PERSPECTIVE,
  getImage3DSvgOverlayGeometry,
  isOrdinary3DTransformImage,
  sanitizeImage3DTransform,
} from '../image-3d-transform';

describe('image 3D transform helpers', () => {
  it('sanitizes, clamps, and rounds transform values', () => {
    expect(
      sanitizeImage3DTransform({
        rotateX: 91.456,
        rotateY: -192.333,
        perspective: -10,
      })
    ).toEqual({
      rotateX: 91.46,
      rotateY: -180,
      perspective: 1,
    });
  });

  it('removes the transform when both rotations reset to zero', () => {
    expect(
      sanitizeImage3DTransform({
        rotateX: 0.001,
        rotateY: -0.001,
        perspective: DEFAULT_IMAGE_3D_PERSPECTIVE,
      })
    ).toBeUndefined();
  });

  it('builds projected SVG overlay geometry for both rotation axes', () => {
    const horizontal = getImage3DSvgOverlayGeometry(
      { x: 10, y: 20, width: 100, height: 80 },
      { rotateX: 0, rotateY: 60, perspective: 800 }
    );
    expect(horizontal.pointsAttribute).toBe(
      '33.57,17.71 83.72,22.05 83.72,97.95 33.57,102.29'
    );

    const vertical = getImage3DSvgOverlayGeometry(
      { x: 10, y: 20, width: 100, height: 80 },
      { rotateX: 60, rotateY: 0, perspective: 800 }
    );
    expect(vertical.points[0][0]).toBeGreaterThan(vertical.points[3][0]);
    expect(vertical.points[1][0]).toBeLessThan(vertical.points[2][0]);
    expect(vertical.boundingBox.height).toBeGreaterThan(0);
  });

  it('recognizes ordinary images and excludes special image-like elements', () => {
    const ordinaryImage = {
      id: 'image-1',
      type: 'image',
      url: 'https://example.com/image.png',
      points: [
        [0, 0],
        [120, 80],
      ],
    };

    expect(isOrdinary3DTransformImage(ordinaryImage as any)).toBe(true);
    expect(
      isOrdinary3DTransformImage({
        ...ordinaryImage,
        url: 'https://example.com/video.mp4',
      } as any)
    ).toBe(false);
    expect(
      isOrdinary3DTransformImage({
        ...ordinaryImage,
        isAudio: true,
      } as any)
    ).toBe(false);
    expect(
      isOrdinary3DTransformImage({
        ...ordinaryImage,
        pptImagePlaceholder: true,
      } as any)
    ).toBe(false);
  });
});
