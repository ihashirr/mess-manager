export const Theme = {
	colors: {
		// Functional
		primary: '#0F766E',    // Dark Aqua
		success: '#1E8E6E',    // Emerald
		danger: '#B45353',     // Muted Red
		warning: '#D48C45',    // Muted Amber

		// Structural
		bg: '#0F1416',         // Deep Charcoal Blue
		surface: '#151C1F',    // Dark Slate
		surfaceElevated: '#1C2428', // Medium Slate
		border: '#1F2E33',     // Aqua Structural Border
		textPrimary: '#E6F0EF',   // Light Aqua Grey
		textSecondary: '#9FB3B0', // Muted Aqua Grey
		textMuted: '#6B7C7A',     // Deep Muted Aqua
		textInverted: '#0F1416',

		// Utilities
		overlay: 'rgba(15, 20, 22, 0.8)',
	},

	spacing: {
		xs: 4,
		sm: 8,
		md: 12,
		lg: 16,
		xl: 20,
		xxl: 24,
		huge: 32,
		massive: 40,
		screen: 20, // Standard screen padding
		screenPadding: 16, // Horizontal padding for all screens
	},

	radius: {
		xs: 4,
		sm: 8,
		md: 12,
		lg: 16,
		xl: 24,
		pill: 9999,
		full: 9999,
	},

	typography: {
		// Tier A - Answer (Large, Bold, Clean)
		answer: {
			size: 32,
			weight: '900' as const,
			letterSpacing: 0.8,
		},
		answerGiant: {
			size: 40,
			weight: '900' as const,
			letterSpacing: -1,
		},
		// Tier B - Section Label (Medium, Slightly Muted)
		label: {
			size: 14,
			weight: '800' as const,
			letterSpacing: 0.5,
		},
		labelMedium: {
			size: 16,
			weight: '700' as const,
		},
		// Tier C - Details (Small, Muted)
		detail: {
			size: 12,
			weight: '600' as const,
		},
		detailBold: {
			size: 12,
			weight: '800' as const,
			letterSpacing: 0.5,
		},
		// Specialized
		urdu: {
			size: 18,
			weight: 'bold' as const,
		},
	},

	// Flat Modern: Shadows removed in favor of borders and contrast
	shadows: {},

	// Layer 2: Behavioral Physics
	elevation: {
		base: 0,
		surface: 10,
		elevated: 20,
		overlay: 30,
		modal: 40,
		toast: 50,
	},

	animation: {
		duration: {
			fast: 150,
			normal: 250,
		},
		scale: {
			active: 0.96,
		}
	},

	opacity: {
		disabled: 0.5,
		active: 0.7,
	}
};
