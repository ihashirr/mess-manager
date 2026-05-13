# Visual Identity System: Desi Zaiqa / Mess Manager

## Execution Contract

This file defines the brand direction. It should not be used as permission to freely restyle screens.

The visual system is implemented through four layers:

- `design/VISUAL_IDENTITY.md`: brand direction, color mood, typography mood, iconography direction.
- `design/assets.md`: approved asset folders, generated asset usage, and import rules.
- `design/motion.md`: timing, press feedback, haptics, and animation limits.
- `design/atmosphere.md`: background, texture, card, and food-accent rules.
- `design/layers.md`: the required rollout order for visual implementation.

App code should import approved visual constants and assets from `src/theme`.

Food-specific identity must be implemented through `FOOD_THEME`, including accent colors, texture references, ambient overlays, meal colors, icon mappings, animation durations, and atmosphere gradients.

**Concept**: Modern Operational Warmth  
**Tone**: Trustworthy, clean, functional, and warm. This is a serious business tool for a home-based meal subscription operator, blending the utility of a fintech app with the warmth of traditional South Asian hospitality.

## Product Framing

Mess Manager is not a generic "food app". It is an operating system for home-cooked food businesses.

That means:

- Operational state is more important than decoration.
- Food identity exists to make the system feel warm and alive.
- Visual warmth must never slow down reading customers, payments, meals, dates, queue state, or finance data.
- The app should feel like organized kitchen operations, not a restaurant flyer or delivery marketplace.

---

## 1. Color Direction

To avoid the "cheap restaurant flyer" look, we use a dominant clean neutral palette inspired by modern fintech (Revolut/Apple Wallet) and use rich, traditional food tones strictly as high-intent accents.

*   **Primary App Color**: Deep Charcoal / Ink (`#1A1A1A`) - Used for primary text, primary buttons, and high-contrast headers.
*   **Neutral Background System**: 
    *   App Background: Very Light Warm Gray (`#F9F8F6`) - Prevents the app from feeling cold.
    *   Card Background: Pure White (`#FFFFFF`).
    *   Secondary Backgrounds: Soft Cream (`#F1EFEA`).
*   **Food Warmth Accents** (Used sparingly for active states and highlights):
    *   **Saffron Orange** (`#E27A3F` or `#D96B27`): Used for primary active tags, highlighted subscriptions, or "Today's Menu".
    *   **Turmeric Gold** (`#D9A036`): Used for warnings or expiring subscriptions.
    *   **Cumin Brown** (`#5C4033`): Used for subtle borders or secondary accents instead of harsh grays.
*   **Semantic Colors**:
    *   Success: Deep Mint Green (`#2E7D32`) - Not neon.
    *   Warning: Turmeric Gold (`#D9A036`).
    *   Danger/Alert: Chili Red (`#C62828`).

## 2. Texture Ideas

Textures must never interfere with data readability. They should appear only in "passive" areas.

*   **Style**: Ultra-low opacity (2-3%) grain or linen texture.
*   **Where to use**: 
    *   Inside the main top header background.
    *   On the background of empty state screens.
*   **Where NOT to use**: 
    *   Never on operational cards containing customer names, payments, or attendance data.
    *   Never behind dense numbers or prices.

## 3. Illustration Style

*   **Direction**: Minimalist line art or flat vector with generous negative space.
*   **Vibe**: "Modern Home Kitchen" rather than "Street Food Stall."
*   **Usage**: 
    *   **Empty States**: A single, clean line-art empty thali or an organized stack of tiffins with a soft cream background.
    *   **Onboarding/Modals**: Minimalist scene of a kitchen counter with spices arranged neatly.
*   **Avoid**: Cartoonish characters, heavy gradients, or 3D renders that look like marketing ads.

## 4. Iconography Direction

*   **Style**: 2px stroke weight, rounded corners (2px or 4px), outline style for inactive states, and filled style for active/selected states.
*   **Functional Icons**: Standard UI icons (Search, Calendar, User, Settings) should be highly legible and standard (Lucide or Iconoir style).
*   **Food Specific Accents**: 
    *   A clean, geometric bowl for "Menu".
    *   A simple tiffin box for "Subscriptions".
    *   A stylized coin/note for "Payments".
*   **Coloring**: Keep icons neutral (Charcoal) and only colorize the background chip/container of the icon to indicate state (e.g., a small green circle behind a payment checkmark).

## 5. Background Treatment

*   **App Screen Backgrounds**: Flat `#F9F8F6` to provide a soft contrast against pure white cards.
*   **Header Backgrounds**: Can use a subtle gradient from `#F1EFEA` to `#F9F8F6` with a very faint spice grain overlay to create depth.
*   **Visual Depth**: Achieved through soft, natural shadows on cards rather than complex background layers or colored blobs.

## 6. Card Atmosphere

This is the core of the UI. Cards must feel organized and easy to tap.

*   **General Rules**: Border radius of `16px`, padding of `16px` or `20px`, pure white background.
*   **Shadows**: Soft, diffused shadows (`rgba(0,0,0,0.04)` with a blur of `10px`). No heavy dark shadows.
*   **Customer Cards**: Bold customer name at top left, subscription status (Active/Expiring) in a small pill tag at top right. Clean horizontal row at the bottom for quick actions (Call, Log Meal).
*   **Payment Cards**: Large, bold currency numbers (e.g., **350 DHS**) using Apple Wallet clarity. High-contrast labels.
*   **Queue/Offline Cards**: Subtle dotted border instead of a shadow to indicate "pending" or "unsynced" state.

## 7. Food Accent System

Use food elements as *functional indicators*, not decorations.

*   **Spoon/Fork**: Use as small indicators next to meal logs (e.g., Lunch icon vs Dinner icon).
*   **Steam**: A very small 2-line clean vector above the "Today's Special" label.
*   **Frequency**: Accents should appear on less than 20% of the screen area. If the user can squint and the app looks like a delivery flyer, there are too many accents.

## 7.1 Hard Avoids

These break the product direction:

*   Huge food wallpapers.
*   Random PNG decorations.
*   Orange on every surface.
*   Too many gradients.
*   Cartoon food.
*   Large food photos behind cards.
*   Floating decorative shapes that do not communicate state.

## 8. Motion Direction

Motion should reinforce operational warmth: subtle tactile feedback, active kitchen feeling, organized movement, and warm machinery. It must not feel like gaming UI, Dribbble motion, or floating chaos.

*   **Button Press**: Quick scale down to `0.97` on press, instantly popping back up on release.
*   **Card Transitions**: Slight slide up and fade in (`duration: 200ms`, standard easing).
*   **Payment Success**: A clean circle-draw animation for the checkmark, followed by a subtle haptic "pop".

## 9. Typography Mood

*   **Primary Typeface**: **Inter** or **Outfit** (Clean, highly legible sans-serif for numbers and English).
*   **Urdu Labels**: Use a clean, legible Naskh or semi-bold standard font for Urdu (like Noto Sans Arabic/Urdu). Avoid overly ornate Nastaliq for operational buttons to preserve readability.
*   **Hierarchy**:
    *   Titles: Bold, Charcoal, `20px` - `24px`.
    *   Body/Labels: Medium/Regular, `14px` - `16px`.
    *   Numbers (Prices): Bold, monospaced or tabular figures so numbers don't jump when updating.

---

## Screen Examples

### 1. Customers Screen
*   **Top**: Clean header "Active Customers (14)" with a search bar styled like a rounded pill.
*   **List**: Stack of white cards. Each card has a name in Inter Bold, a small green dot for "Paid", and a clear "Log Meal" button with a large touch target and an Urdu label below it.

### 2. Payments Screen
*   **Top**: Total collected this month: **4,200 DHS** in massive, clear typography (Apple Wallet style).
*   **List**: Chronological list of cash receipts. Each entry has a clean receipt icon, the amount in bold, and the customer name. Simple and uncluttered.
