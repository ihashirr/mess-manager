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
	},

	RESPONSIVE: {
		compactWidth: 390,
		mediumWidth: 768,
		wideWidth: 1120,
		minContentWidth: 280,
		maxContentWidth: 1160,
		maxReadableWidth: 980,
	}
} as const;

export type ResponsiveUiMetrics = {
	width: number;
	isCompact: boolean;
	isMediumUp: boolean;
	isWide: boolean;
	contentPadding: number;
	maxContentWidth: number;
	maxReadableWidth: number;
	stacked: boolean;
	gridColumns: 1 | 2;
};

export const getResponsiveUiMetrics = (width: number): ResponsiveUiMetrics => {
	const compactWidth = UI_SPEC.RESPONSIVE.compactWidth;
	const mediumWidth = UI_SPEC.RESPONSIVE.mediumWidth;
	const wideWidth = UI_SPEC.RESPONSIVE.wideWidth;

	const isCompact = width <= compactWidth;
	const isMediumUp = width >= mediumWidth;
	const isWide = width >= wideWidth;

	return {
		width,
		isCompact,
		isMediumUp,
		isWide,
		contentPadding: isCompact ? 14 : isMediumUp ? 24 : 20,
		maxContentWidth: UI_SPEC.RESPONSIVE.maxContentWidth,
		maxReadableWidth: UI_SPEC.RESPONSIVE.maxReadableWidth,
		stacked: width < 640,
		gridColumns: width < 640 ? 1 : 2,
	};
};
