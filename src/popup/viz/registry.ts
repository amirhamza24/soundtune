import type { VisualizerStyle } from '../../shared/types';
import { BASE_LABELS, BASE_RENDERERS } from './renderers';
import type { Renderer } from './renderers';
import { dotwall, rain, ripple, tunnel } from './renderers2';

export const RENDERERS = { ...BASE_RENDERERS, tunnel, rain, ripple, dotwall } as Record<VisualizerStyle, Renderer>;

export const STYLE_LABELS = {
  ...BASE_LABELS,
  tunnel: 'Warp Tunnel',
  rain: 'Neon Rain',
  ripple: 'Water Ripples',
  dotwall: 'Dot Wall',
} as Record<VisualizerStyle, string>;
