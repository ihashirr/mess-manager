export const Theme = {
	colors: {
		// Layout
		background: '#F4F7F6',
		surface: '#FFFFFF',
		surfaceSecondary: '#F8F9FA',
		elevated: '#1A1A1A', // Dark cards used in the current design

		// Brand & Semantic
		primary: '#2E7D32',   // Trustworthy Green for Food/Payments
		secondary: '#5C6BC0', // Indigo for secondary actions
		accent: '#FFD700',    // Gold for highlights

		// Status
		success: '#4CAF50',
		danger: '#FF5252',
		warning: '#FF9800',
		info: '#2196F3',

		// Typography & Borders
		text: '#1A1A1A',
		textMuted: '#666666',
		textDimmed: '#999999',
		textInverted: '#FFFFFF',
		border: '#EEEEEE',
		borderStrong: '#DDDDDD',

		// Overlays
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
		screen: 20, // Standard screen padding
	},

	radius: {
		sm: 6,
		md: 10,
		lg: 12,
		xl: 14,
		xxl: 18,
		huge: 25,
		full: 9999,
	},

	typography: {
		heading: {
			size: 28,
			weight: '900' as const,
			letterSpacing: -0.5,
		},
		subheading: {
			size: 20,
			weight: '700' as const,
		},
		section: {
			size: 14,
			weight: '800' as const,
			letterSpacing: 0.5,
		},
		body: {
			size: 16,
			weight: '500' as const,
		},
		bodyBold: {
			size: 17,
			weight: '700' as const,
		},
		caption: {
			size: 13,
			weight: '600' as const,
		},
		label: {
			size: 10,
			weight: '800' as const,
			letterSpacing: 1,
		},
		urdu: {
			size: 18,
			weight: 'bold' as const,
		},
		// Specialized counts
		giant: {
			size: 36,
			weight: '900' as const,
		}
	},

	shadows: {
		soft: {
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.05,
			shadowRadius: 5,
			elevation: 2,
		},
		medium: {
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 4 },
			shadowOpacity: 0.1,
			shadowRadius: 8,
			elevation: 4,
		},
		strong: {
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 12 },
			shadowOpacity: 0.4,
			shadowRadius: 15,
			elevation: 12,
		}
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
