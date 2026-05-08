export const Theme = {
	colors: {
		// Functional
		primary: '#FF6B35',    // Vibrant Orange
		success: '#2ECC71',    // Bright Green
		danger: '#E74C3C',     // Bright Red
		warning: '#F39C12',    // Bright Amber

		// Structural
		bg: '#F6F7FA',         // iOS-style cool gray background
		surface: '#FFFFFF',    // Pure White
		surfaceElevated: '#F8F9FA', // Warm off-white for inset surfaces
		border: '#E5E5EA',     // Slightly stronger border for definition
		textPrimary: '#1A1A1C',   // Deeper Charcoal
		textSecondary: '#525256', // Darker Gray
		textMuted: '#8E8E93',     // iOS Muted Gray
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
		screen: 16, 
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
		heroGiant: {
			fontSize: 68,
			fontWeight: '900' as const,
			letterSpacing: -2,
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

	shadows: {
		card: {
			shadowColor: '#1A162B',
			shadowOffset: { width: 0, height: 12 },
			shadowOpacity: 0.04,
			shadowRadius: 28,
			elevation: 4,
		},
		modal: {
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 8 },
			shadowOpacity: 0.15,
			shadowRadius: 24,
			elevation: 12,
		},
		input: {
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 1 },
			shadowOpacity: 0.04,
			shadowRadius: 3,
			elevation: 1,
		},
	},

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
