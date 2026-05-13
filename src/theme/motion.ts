export const Motion = {
	duration: {
		pressIn: 90,
		pressOut: 130,
		cardEnter: 200,
		sheetEnter: 240,
		toastEnter: 180,
		queuePulse: 220,
		paymentSuccess: 260,
	},
	scale: {
		primaryPress: 0.97,
		iconPress: 0.96,
		cardPress: 0.985,
	},
	opacity: {
		pressed: 0.72,
		disabled: 0.5,
		textureMin: 0.02,
		textureMax: 0.03,
	},
	easing: {
		standard: 'ease-out',
		emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
	},
	haptics: {
		selection: 'selection',
		success: 'light',
		warning: 'medium',
	},
} as const;

export type MotionContract = typeof Motion;
