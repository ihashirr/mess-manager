export const VisualIdentity = {
	brand: {
		name: 'Desi Zaiqa',
		product: 'Mess Manager',
		principle: 'Operational warmth',
	},
	colors: {
		ink: '#1A1A1A',
		canvas: '#F9F8F6',
		surface: '#FFFFFF',
		surfaceWarm: '#F1EFEA',
		saffron: '#D96B27',
		turmeric: '#D9A036',
		cumin: '#5C4033',
		success: '#2E7D32',
		danger: '#C62828',
	},
	iconography: {
		library: 'lucide-react-native',
		strokeWidth: 2,
		activeStrokeWidth: 2.2,
		cornerRadius: 4,
	},
	assetUsage: {
		maxFoodAccentCoverage: 0.2,
		textureOpacityMin: 0.02,
		textureOpacityMax: 0.03,
	},
	typography: {
		latin: 'Inter or Outfit style sans',
		urdu: 'Readable Naskh or Noto Sans Arabic/Urdu style',
		numberStyle: 'bold tabular figures',
	},
} as const;

export type VisualIdentityContract = typeof VisualIdentity;
