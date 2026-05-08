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
	height: number;
	fontScale: number;
	shortEdge: number;
	isCompact: boolean;
	isMediumUp: boolean;
	isWide: boolean;
	isTextDense: boolean;
	contentPadding: number;
	maxContentWidth: number;
	maxReadableWidth: number;
	stacked: boolean;
	gridColumns: 1 | 2;
	scale: (value: number, minFactor?: number, maxFactor?: number) => number;
	verticalScale: (value: number, minFactor?: number, maxFactor?: number) => number;
	font: (value: number, minFactor?: number, maxFactor?: number) => number;
	icon: (value: number, minFactor?: number, maxFactor?: number) => number;
};

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const round = (value: number) => Math.round(value * 10) / 10;

export const getResponsiveUiMetrics = (
	width: number,
	height: number,
	fontScale = 1
): ResponsiveUiMetrics => {
	const compactWidth = UI_SPEC.RESPONSIVE.compactWidth;
	const mediumWidth = UI_SPEC.RESPONSIVE.mediumWidth;
	const wideWidth = UI_SPEC.RESPONSIVE.wideWidth;
	const shortEdge = Math.min(width, height);
	const widthRatio = shortEdge / BASE_WIDTH;
	const heightRatio = height / BASE_HEIGHT;

	const scaleValue = (
		value: number,
		ratio: number,
		minFactor: number,
		maxFactor: number
	) => round(clamp(value * ratio, value * minFactor, value * maxFactor));

	const scale = (value: number, minFactor = 0.9, maxFactor = 1.2) =>
		scaleValue(value, widthRatio, minFactor, maxFactor);
	const verticalScale = (value: number, minFactor = 0.9, maxFactor = 1.18) =>
		scaleValue(value, heightRatio, minFactor, maxFactor);
	const font = (value: number, minFactor = 0.94, maxFactor = 1.18) =>
		scaleValue(value, widthRatio, minFactor, maxFactor);
	const icon = (value: number, minFactor = 0.94, maxFactor = 1.14) =>
		scaleValue(value, widthRatio, minFactor, maxFactor);

	const isTextDense = fontScale >= 1.15;
	const isCompact = width <= compactWidth || isTextDense;
	const isMediumUp = width >= mediumWidth;
	const isWide = width >= wideWidth;

	return {
		width,
		height,
		fontScale,
		shortEdge,
		isCompact,
		isMediumUp,
		isWide,
		isTextDense,
		contentPadding: scale(isCompact ? 14 : isMediumUp ? 24 : 20, 0.9, 1.15),
		maxContentWidth: UI_SPEC.RESPONSIVE.maxContentWidth,
		maxReadableWidth: UI_SPEC.RESPONSIVE.maxReadableWidth,
		stacked: width < 640 || fontScale >= 1.12,
		gridColumns: width < 640 || fontScale >= 1.12 ? 1 : 2,
		scale,
		verticalScale,
		font,
		icon,
	};
};
