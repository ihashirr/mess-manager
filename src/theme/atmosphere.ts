export const Atmosphere = {
	screen: {
		canvas: 'warm-off-white',
		textureOpacity: 0.025,
		textureAllowedOnDenseData: false,
	},
	card: {
		background: 'white',
		borderFirst: true,
		radius: 16,
		padding: 16,
		shadowOpacity: 0.04,
		shadowBlur: 10,
	},
	header: {
		allowTexture: true,
		allowSoftGradient: true,
		maxTextureOpacity: 0.03,
	},
	foodAccents: {
		maxCoverage: 0.2,
		allowedContexts: ['empty-state', 'menu-context', 'header-ambience', 'brand-panel'],
		blockedContexts: ['payment-list', 'customer-name-row', 'receipt-fields', 'attendance-grid', 'forms'],
	},
} as const;

export type AtmosphereContract = typeof Atmosphere;
