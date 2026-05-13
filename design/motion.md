# Motion Rules

Motion in Mess Manager must feel fast, tactile, and operational. It should confirm intent, clarify state changes, and make the app feel responsive without becoming decorative.

Reusable food-related motion durations live in `FOOD_THEME.animation` from `src/theme/foodTheme.ts`. Screen code should use those constants instead of inventing local durations.

The motion style is operational warmth: subtle tactile feedback, kitchen-alive feeling, organized movement, and warm machinery. It must not feel like gaming UI, Dribbble motion, or floating chaos.

## Principles

- Motion must support a task: confirm, reveal, dismiss, sync, warn, or show kitchen activity.
- Keep normal UI motion within 80-240ms.
- Keep looping ambient motion very soft and low contrast.
- Avoid theatrical animation, bouncing food graphics, slow hero reveals, confetti, and marketing-style motion.
- Avoid game-like loops, floating decoration, wobble effects, and attention-seeking motion.
- Prefer small scale, opacity, and tint changes over large position changes.
- Do not animate dense data rows unless the user directly triggered that row.

## Hover Motion

Hover is for web/desktop pointer targets only.

- Duration: `FOOD_THEME.animation.hoverMs`.
- Use a slight border/tint lift, not movement-heavy hover states.
- Cards may raise shadow opacity by a very small amount.
- Icon buttons may increase background opacity.
- Do not hover-animate text, prices, customer names, or attendance values.

## Press Motion

- Primary buttons scale to `0.97` on press.
- Icon buttons scale to `0.96` on press.
- Tappable cards scale at most to `0.985`.
- Press-in duration: `FOOD_THEME.animation.pressInMs`.
- Press-out duration: `FOOD_THEME.animation.pressOutMs`.
- Press motion should not change layout dimensions.

## Card Entrance

- Use card entrance only when content first appears, not on every refresh.
- Duration: `FOOD_THEME.animation.cardEnterMs`.
- Preferred pattern: fade from 0 to 1 plus 6-10px upward movement.
- Avoid staggered animation for long lists.
- Operational lists should feel stable after load.

## Steam Loop Animation

Steam is allowed only for food-context surfaces:

- Empty states.
- Lunch/Dinner cards.
- Menu completion or menu missing states.
- Small kitchen-control indicators.

Rules:

- Duration: `FOOD_THEME.animation.steamLoopMs`.
- Opacity must stay low and never compete with text.
- Steam should be 2-3 tiny vertical strokes, not a large decorative illustration.
- Never place steam behind form fields, prices, OCR text, or customer names.

## Success Pulse

Use success pulse for completed actions:

- Payment recorded.
- Menu saved.
- Queue item synced.
- Attendance saved.

Rules:

- Duration: `FOOD_THEME.animation.successPulseMs`.
- Pulse once, then stop.
- Use tint, scale, or checkmark emphasis.
- Do not hide the resulting value or status during the pulse.

## Kitchen Activity Indicators

Kitchen activity motion is for production context:

- Menu readiness.
- Serving activity.
- Lunch/Dinner production counts.
- Queue or prep state when it affects today's service.

Rules:

- Duration: `FOOD_THEME.animation.kitchenActivityMs`.
- Use a small pulse around a chef/meal icon.
- Active pulse can loop while a production state is live.
- Failed or incomplete states should pulse softly, not shake.
- Keep the label operational: "Menu incomplete", "Kitchen control", "Serving activity".

## Bottom Nav Transitions

Bottom navigation must feel stable and fast.

- Duration: `FOOD_THEME.animation.bottomNavMs`.
- Active tab may use tint, background fill, and small icon scale.
- Do not move tabs vertically or resize labels.
- The center/action tab must stay visually aligned with side tabs.
- Route changes should not resize the persistent header or nav bar.

## Queue And Offline State

- Queue count changes can use a quick pulse.
- Failed queue items should not shake repeatedly.
- Retrying should show state change immediately, then final status.
- Queue motion must make sync state clearer, not more dramatic.

## Payment Feedback

- Payment confirmation can use a small checkmark draw, tint shift, or haptic pop.
- Payment success must not hide the amount, customer, or date.
- Error states should be clear and stable, not animated aggressively.
