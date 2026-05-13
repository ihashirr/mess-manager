# Theme Layer

`src/theme` is the execution layer for the visual identity.

Use it for:

- Brand colors and visual identity constants.
- Approved generated asset imports.
- Food design tokens through `FOOD_THEME`.
- Motion timing, scale, opacity, and haptic contracts.
- Atmosphere rules for cards, backgrounds, texture, and food accents.

The reusable atmosphere primitives are exported from `src/components/ui` as `AtmosphereBackground`, `WarmGlow`, and `SpiceTextureOverlay`. Most screens should use `AtmosphereBackground` through the shared `Screen` component's `atmosphere` prop.

The existing `src/constants/Theme.ts` remains exported for compatibility. New shared UI work should import from `src/theme` so the app moves toward one visual system without breaking current screens.

## Food Tokens

Use `FOOD_THEME` for food-specific colors, generated asset references, icon mappings, meal colors, ambient overlays, animation durations, and atmosphere gradients.

```ts
import {FOOD_THEME} from '@/theme';

const lunchColor = FOOD_THEME.mealColors.lunch;
const spiceTexture = FOOD_THEME.textures.spice;
const MenuIcon = FOOD_THEME.iconMap.menu;
```

```tsx
<Screen atmosphere={{spiceGrain: true, intensity: 'subtle'}}>
	{/* screen content */}
</Screen>
```

```tsx
<WarmGlow intensity="subtle" />
<SpiceTextureOverlay warmLighting spiceGrain={false} desiPattern={false} />
```
