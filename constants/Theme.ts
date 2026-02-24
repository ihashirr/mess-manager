export const Theme = {
	colors: {
		// Functional
		primary: '#2E7D32',
		success: '#4CAF50',
		danger: '#FF5252',
		warning: '#FF9800',

		// Structural
		bg: '#F4F7F6',
		surface: '#FFFFFF',
		surfaceElevated: '#1A1A1A',
		border: '#EEEEEE',
		textPrimary: '#1A1A1A',
		textSecondary: '#666666',
		textMuted: '#999999',
		textInverted: '#FFFFFF',

		// Utilities
		overlay: 'rgba(0,0,0,0.6)',
		decoration: 'rgba(0,0,0,0.03)',
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
		full: 9999,
	},

	typography: {
		// Tier A - Answer (Large, Bold, Clean)
		answer: {
			size: 28,
			weight: '900' as const,
			letterSpacing: -0.5,
		},
		answerGiant: {
			size: 36,
			weight: '900' as const,
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
