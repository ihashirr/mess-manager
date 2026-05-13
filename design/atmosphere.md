# Atmosphere Rules

Atmosphere is the visual warmth around the operational UI: backgrounds, cards, texture, light, spacing, and food accents. This file prevents "make it prettier" changes from turning the app into a restaurant flyer.

Reusable atmosphere values live in `FOOD_THEME.ambient` and `FOOD_THEME.gradients` from `src/theme/foodTheme.ts`.

The reusable implementation lives in `src/components/ui/AtmosphereBackground.tsx`:

- `AtmosphereBackground`: complete background shell for screens or panels.
- `WarmGlow`: subtle saffron/turmeric radial light.
- `SpiceTextureOverlay`: optional warm light, spice grain, and desi pattern layers.

Screens should use those primitives or the `Screen` wrapper's `atmosphere` prop instead of adding local background PNGs or one-off glow views.

## Atmosphere Goal

The app should feel like a serious home-meal operations tool with South Asian warmth. The user should first see customers, money, meals, and queue status. Food identity should support that, not compete with it.

This is an operating system for food businesses, not a food delivery app or restaurant brand surface.

## Backgrounds

- Default app canvas: warm off-white.
- Operational screens should stay mostly flat and readable.
- Header areas may use a subtle warm gradient or a 2-3% pattern overlay.
- Avoid dark, cinematic, or high-saturation backgrounds on core screens.
- New warm backgrounds should be added as named gradients in `FOOD_THEME.gradients`.
- Never use huge food wallpapers.
- Never use large food photos behind cards.

## AtmosphereBackground Usage

- Default app usage: subtle saffron radial glow plus soft warm light.
- Spice grain and desi pattern overlays are opt-in.
- Use `intensity="subtle"` for operational screens.
- Use `intensity="medium"` only for empty states, menu ambience, or low-density brand panels.
- Use `atmosphere={false}` only for screens that require a completely flat system canvas.
- Never use `strong` behind dense cards, forms, OCR review, payment lists, or customer rows.

## WarmGlow Usage

- Use `WarmGlow` for low-density headers, production areas, or empty states.
- Keep intensity subtle unless there is no dense data on the surface.
- Do not stack multiple warm glows on the same screen.
- Do not use glow as a replacement for hierarchy, borders, or spacing.

## SpiceTextureOverlay Usage

- Warm light can be used as passive atmosphere.
- Spice grain and desi pattern overlays are opt-in only.
- Use overlays behind screen canvas or low-density panels, not directly inside data cards.
- Texture opacity must remain token-driven and ultra low.

## Cards

- Cards are for operational information, not decoration.
- Use white cards for customer, payment, finance, receipt, and attendance data.
- Use soft borders before heavy shadows.
- Use shadows only to separate important surfaces from the canvas.
- Avoid placing cards inside cards unless it is an actual nested tool or modal.

## Texture Use

Allowed:

- Empty states.
- Header ambience.
- Passive summary panels with very little text.
- Rare brand panels.

Not allowed:

- Behind customer names.
- Behind prices or totals.
- Behind forms.
- Behind OCR text.
- Behind dense attendance rows.

Texture references must come from `FOOD_THEME.textures`.

## Food Accent Use

Food accents should be functional:

- Bowl or utensil icon for menu context.
- Steam accent for today's menu.
- Spice texture for warm passive atmosphere.
- Tiffin or thali illustration for empty states.

Food accents should not be used as filler. If a screen already has dense operational data, keep the food layer minimal.

Avoid random PNG decorations, orange everywhere, excessive gradients, and cartoon food.

Reusable implementation primitives live in `src/components/ui/FoodAccents.tsx`:

- `FoodEmptyStateArt` for empty states only.
- `FoodIconBadge` for small curry bowl, lunch, dinner, or kitchen context.
- `SteamLoop` for menu and meal-context micro-motion.
- `KitchenActivityPulse` for production and serving activity.

## Screen Guidance

### Home

Use warmth in the header and summary panel. Keep the daily operational numbers dominant.

### Customers

Customer cards must stay clean, readable, and tappable. Food visuals should be nearly absent except for meal chips or small icons.

### Payments

Payments should feel closest to a finance app. Use strong number hierarchy and minimal decoration.

### Menu

This screen can carry the most food identity, but it still needs production clarity for lunch, dinner, counts, and dates.

### Finance / OCR

Treat this as a review tool. No decorative food imagery behind receipt fields or extracted data.

## Atmosphere Check

Before shipping a visual change, ask:

- Does the user understand the operational state faster?
- Are names, prices, counts, dates, and statuses still the loudest elements?
- Is the food identity subtle enough that the screen cannot be mistaken for a restaurant flyer?
- Is this asset or texture reused through the asset registry?
- Is the color, gradient, icon, animation, or overlay coming from `FOOD_THEME`?
