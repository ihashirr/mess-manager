import type {ImageSourcePropType} from 'react-native';

export const BrandAssets = {
	illustrations: {
		emptyMenu: require('../../assets/illustrations/empty-menu.png') as ImageSourcePropType,
		biryani: require('../../assets/illustrations/biryani_hero.png') as ImageSourcePropType,
		karahi: require('../../assets/illustrations/chicken_karahi_hero.png') as ImageSourcePropType,
	},
	textures: {
		spiceGrain: require('../../assets/textures/spice-grain.png') as ImageSourcePropType,
	},
	patterns: {
		mughalPattern: require('../../assets/patterns/mughal-pattern.png') as ImageSourcePropType,
	},
	icons: {
		curryBowl: require('../../assets/icons/curry-bowl.png') as ImageSourcePropType,
	},
	ambient: {
		warmLight: require('../../assets/ambient/warm-light.png') as ImageSourcePropType,
	},
} as const;

export type BrandAssetRegistry = typeof BrandAssets;
