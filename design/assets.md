# Asset Pipeline

This file is the source of truth for brand assets, generated imagery, and how visual assets enter the app. It exists so future UI work uses named assets with rules instead of placing random decorative images into screens.

## Folder Contract

Assets are grouped by usage, not by the tool that created them.

| Folder | Purpose | Current assets |
| --- | --- | --- |
| `assets/textures/` | Very low opacity passive texture overlays | `spice-grain.png` |
| `assets/patterns/` | Repeatable or wallpaper-style background treatments | `mughal-pattern.png` |
| `assets/illustrations/` | Empty states, onboarding moments, light brand panels | `empty-menu.png` |
| `assets/icons/` | Custom food or brand-specific image icons only | `curry-bowl.png` |
| `assets/ambient/` | Warm light, glows, and non-data atmosphere | `warm-light.png` |
| `assets/lottie/` | Motion assets that are intentionally approved | currently empty |
| `assets/images/` | Expo app icon, splash, favicon, and logo files | existing app launch assets |

## Asset Registry

App code should import brand assets through `src/theme/assets.ts` or through the higher-level `FOOD_THEME` tokens in `src/theme/foodTheme.ts`.

Do not import these files directly from feature screens unless there is a technical reason. Centralizing them makes it easier to swap, optimize, or remove generated assets without hunting through the app.

## Current Generated Assets

### Empty Menu Illustration

- File: `assets/illustrations/empty-menu.png`
- Use for: empty states, light onboarding, calm brand panels.
- Avoid using as: dashboard hero, customer card background, or repeated list decoration.

### Spice Grain Texture

- File: `assets/textures/spice-grain.png`
- Use for: header ambience or passive background overlays at 2-3% opacity.
- Avoid using as: card background behind operational data.

### Curry Bowl Icon

- File: `assets/icons/curry-bowl.png`
- Use for: menu identity, food category moments, app-brand accents.
- Avoid using as: replacement for functional UI icons like search, edit, delete, or payment.

### Warm Light Ambient Graphic

- File: `assets/ambient/warm-light.png`
- Use for: rare brand panels where warmth matters more than dense data.
- Avoid using as: finance/customer/payment list background.

### Mughal Pattern

- File: `assets/patterns/mughal-pattern.png`
- Use for: empty states, soft header panels, passive container atmosphere.
- Avoid using as: global full-strength background.

## Production Rules

- Functional UI icons come from `lucide-react-native`.
- Custom generated assets are brand accents, not navigation primitives.
- Generated imagery must never sit behind names, prices, payment status, phone numbers, dates, or attendance data.
- Any texture must be visibly quieter than borders, text, and controls.
- Food accents should occupy less than 20% of any normal operational screen.
- Every new generated asset needs a stable filename, folder placement, intended use, explicit "do not use" rule in this file, and a token entry in `src/theme/foodTheme.ts` if it will be used by app UI.

## Import Example

```ts
import {FOOD_THEME} from '@/theme';

const source = FOOD_THEME.illustrations.emptyMenu;
const texture = FOOD_THEME.textures.spice;
```
