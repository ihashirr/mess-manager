import {
	ChefHat,
	Clock3,
	FileText,
	Moon,
	Sun,
	Utensils,
	UtensilsCrossed,
	Wallet,
	type LucideIcon,
} from 'lucide-react-native';

import {BrandAssets} from './assets';

export type FoodMealType = 'lunch' | 'dinner';
export type FoodIconKey =
	| 'menu'
	| 'lunch'
	| 'dinner'
	| 'meal'
	| 'payment'
	| 'receipt'
	| 'queue'
	| 'kitchen';

export const FOOD_THEME = {
	colors: {
		saffron: '#FF8A34',
		saffronDeep: '#D96B27',
		turmeric: '#F6B73C',
		mint: '#2E8B57',
		coriander: '#3F7D4E',
		chili: '#C62828',
		cumin: '#5C4033',
		cream: '#FFF7EC',
		paper: '#F9F8F6',
		ink: '#1A1A1A',
	},
	textures: {
		spice: BrandAssets.textures.spiceGrain,
		pattern: BrandAssets.patterns.mughalPattern,
	},
	illustrations: {
		emptyMenu: BrandAssets.illustrations.emptyMenu,
	},
	ambient: {
		warmLight: BrandAssets.ambient.warmLight,
		overlayColor: 'rgba(217, 107, 39, 0.10)',
		headerOpacity: 0.12,
		passivePanelOpacity: 0.08,
		textureOpacity: 0.025,
	},
	mealColors: {
		lunch: '#FFB457',
		dinner: '#8B5CF6',
		both: '#D96B27',
		skipped: '#9A948C',
	},
	iconImages: {
		curryBowl: BrandAssets.icons.curryBowl,
	},
	iconMap: {
		menu: UtensilsCrossed,
		lunch: Sun,
		dinner: Moon,
		meal: Utensils,
		payment: Wallet,
		receipt: FileText,
		queue: Clock3,
		kitchen: ChefHat,
	} satisfies Record<FoodIconKey, LucideIcon>,
	animation: {
		hoverMs: 140,
		pressInMs: 90,
		pressOutMs: 130,
		cardEnterMs: 200,
		queuePulseMs: 220,
		kitchenActivityMs: 1450,
		steamLoopMs: 1800,
		paymentSuccessMs: 260,
		successPulseMs: 320,
		bottomNavMs: 180,
	},
	gradients: {
		appCanvas: ['#F9F8F6', '#F1EFEA'],
		headerWarmth: ['#FFF7EC', '#F9F8F6'],
		saffronAction: ['#FF8A34', '#D96B27'],
		menuAccent: ['#FFF2DE', '#F9F8F6'],
		dinnerAccent: ['#F4EEFF', '#F9F8F6'],
	},
} as const;

export type FoodThemeContract = typeof FOOD_THEME;
