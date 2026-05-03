/**
 * UI OPERATING FRAME SPECIFICATION
 * 
 * This file captures the "Constitution" of the UI to ensure 
 * consistent hierarchy and restraint across the app.
 */

export const UI_SPEC = {
	CORE_QUESTIONS: {
		HOME: "How many plates today?",
		PAYMENTS: "Who hasn't paid / is expiring?",
		MENU: "What's cooking today and next?",
	},

	LAYOUT_HIERARCHY: [
		"TOP_BAR",       // context + 1 action
		"PRIMARY_PANEL", // The Hero (The Answer)
		"SECONDARY_PANEL", // Supporting details
		"ACTION_STRIP",   // 1-2 key actions
		"BOTTOM_NAV",     // Global stability
	],

	INFO_LEVELS: {
		A: "Primary (Big, Bold)",
		B: "Status (Badges, Hints)",
		C: "Details (Quiet, Collapsible)",
	},

	RULES: {
		TIME_TO_ANSWER: "≤ 3 Seconds",
		QUESTIONS_PER_SCREEN: 1,
		MAX_ACTIONS_TOP_BAR: 1,
		MAX_ACTIONS_STRIP: 2,
	}
} as const;
