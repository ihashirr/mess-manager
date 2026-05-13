# Layered Redesign Implementation

Visual changes must be applied in layers. Do not redesign multiple layers at once unless the user explicitly asks for a broad visual pass.

The goal is not to make a "food app". The goal is to make an operating system for food businesses: warm, operational, organized, and alive.

## Layer 1: Atmosphere And Textures

Purpose: make the app feel less flat without changing the product structure.

Allowed:

- `AtmosphereBackground`.
- Very low opacity saffron glow.
- Soft warm light.
- Optional spice grain or desi pattern at low opacity.

Rules:

- Keep readability unchanged.
- Do not put textures behind dense data.
- Do not add huge food wallpapers.
- Do not use heavy gradients.

## Layer 2: Icons And Food Accents

Purpose: add context where the user benefits from a food cue.

Allowed:

- Lucide icons for all functional actions.
- `FoodIconBadge` for menu, meal, kitchen, and serving context.
- Tiny curry bowl, lunch, dinner, steam, or chef/kitchen indicators.

Rules:

- Food accents must communicate state or context.
- Avoid random PNG decorations.
- Keep core navigation and critical actions standard and recognizable.

## Layer 3: Illustrations And Empty States

Purpose: make low-data states feel considered and warm.

Allowed:

- `FoodEmptyStateArt`.
- Empty menu illustration.
- Calm kitchen or bowl identity moments.

Rules:

- Use illustrations mostly in empty states.
- Do not use cartoon food.
- Do not place illustrations behind forms, customer rows, prices, receipts, or attendance grids.

## Layer 4: Motion And Micro Interactions

Purpose: make the product feel tactile and alive.

Allowed:

- Press scale.
- Card entrance.
- Steam loop.
- Success pulse.
- Kitchen activity pulse.
- Bottom nav state transitions.

Rules:

- Motion should feel like warm machinery and an active kitchen.
- Avoid gaming UI, Dribbble-style flourishes, and floating chaos.
- Animation must be token-driven through `FOOD_THEME.animation`.
- Dense data should remain stable.

## Layer 5: Contextual Ambient Effects

Purpose: add emotional context only where it supports the operation.

Good places:

- Production status.
- Menu readiness.
- Lunch/Dinner cards.
- Empty states.
- Queue or sync state if it affects today's service.

Bad places:

- Customer names.
- Payment lists.
- OCR review fields.
- Forms.
- Dense attendance rows.

Rules:

- Ambient effects must be contextual, not global decoration.
- Use one dominant accent at a time.
- Avoid overusing orange.
- Keep the screen closer to operations software than food delivery branding.

## Rollout Checklist

Before applying a visual change:

- Which layer is being changed?
- Is the change token-driven through `src/theme`?
- Does it improve operational clarity?
- Does it avoid huge wallpapers, random PNGs, over-orange styling, excessive gradients, and cartoon food?
- Can the change be shipped without redesigning unrelated layers?
