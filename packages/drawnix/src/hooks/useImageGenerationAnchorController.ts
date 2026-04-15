import { useMemo } from 'react';
import {
  getImageGenerationAnchorControllerResult,
  type ImageGenerationAnchorControllerOptions as UseImageGenerationAnchorControllerOptions,
  type ImageGenerationAnchorControllerResult,
} from '../utils/image-generation-anchor-controller';

export function useImageGenerationAnchorController(
  options: UseImageGenerationAnchorControllerOptions
): ImageGenerationAnchorControllerResult {
  return useMemo(() => getImageGenerationAnchorControllerResult(options), [options]);
}
