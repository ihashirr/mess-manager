export const Theme = {
	colors: {
		// Functional
		primary: '#FF6B35',    // Vibrant Orange
		success: '#2ECC71',    // Bright Green
		danger: '#E74C3C',     // Bright Red
		warning: '#F39C12',    // Bright Amber

		// Structural
		bg: '#F8F6F2',         // Soft Porcelain
		surface: '#FFFFFF',    // White
		surfaceElevated: '#F4EEE6', // Warm Sand Tint
		border: '#E8DDD0',     // Soft Sand Border
		textPrimary: '#1F1B16',   // Warm Charcoal
		textSecondary: '#62574C', // Toasted Taupe
		textMuted: '#9A8D80',     // Quiet Neutral
		textInverted: '#FFFFFF',

		// Meal Semantics
		mealLunch: '#FF6B35',  // Vivid Orange
		mealDinner: '#7C3AED', // Vivid Violet

		// Utilities
		overlay: 'rgba(26, 21, 17, 0.42)',
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
			fontSize: 32,
			fontWeight: '900' as const,
			letterSpacing: 0.8,
		},
		answerGiant: {
			fontSize: 40,
			fontWeight: '900' as const,
			letterSpacing: -1,
		},
		// Tier B - Section Label (Medium, Slightly Muted)
		label: {
			fontSize: 14,
			fontWeight: '800' as const,
			letterSpacing: 0.5,
		},
		labelMedium: {
			fontSize: 16,
			fontWeight: '700' as const,
		},
		// Tier C - Details (Small, Muted)
		detail: {
			fontSize: 12,
			fontWeight: '600' as const,
		},
		detailBold: {
			fontSize: 12,
			fontWeight: '800' as const,
			letterSpacing: 0.5,
		},
		// Specialized
		urdu: {
			fontSize: 18,
			fontWeight: 'bold' as const,
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
