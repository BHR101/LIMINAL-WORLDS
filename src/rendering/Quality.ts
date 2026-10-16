import type { GraphicsPreset } from '../core/Settings';

export interface QualityProfile {
  preset: GraphicsPreset;
  maxPixelRatio: number;
  shadowMapSize: number;
  softShadows: boolean;
  msaa: number;
  bloom: boolean;
  /** Reflection render-target size as a fraction of the screen. */
  reflectionScale: number;
  /** Rendered-portal texture size as a fraction of the screen. */
  portalScale: number;
  particles: number;
  cloudOctaves: number;
}

export const QUALITY: Record<GraphicsPreset, QualityProfile> = {
  performance: {
    preset: 'performance',
    maxPixelRatio: 1,
    shadowMapSize: 1024,
    softShadows: false,
    msaa: 0,
    bloom: false,
    reflectionScale: 0.25,
    portalScale: 0.5,
    particles: 600,
    cloudOctaves: 3,
  },
  balanced: {
    preset: 'balanced',
    maxPixelRatio: 1.5,
    shadowMapSize: 2048,
    softShadows: true,
    msaa: 2,
    bloom: true,
    reflectionScale: 0.5,
    portalScale: 0.75,
    particles: 1600,
    cloudOctaves: 4,
  },
  cinematic: {
    preset: 'cinematic',
    maxPixelRatio: 2,
    shadowMapSize: 4096,
    softShadows: true,
    msaa: 4,
    bloom: true,
    reflectionScale: 0.75,
    portalScale: 1,
    particles: 3000,
    cloudOctaves: 5,
  },
};
