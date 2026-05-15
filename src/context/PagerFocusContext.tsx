import React, { createContext, ReactNode, useContext, useEffect } from 'react';

type PagerScreenName = 'index' | 'customers' | 'finance' | 'payments' | 'menu' | 'none';
type FocusEffectCallback = () => void | (() => void);

const PagerFocusContext = createContext<PagerScreenName>('index');

export const PagerFocusProvider = ({
	activeScreen,
	children,
}: {
	activeScreen: PagerScreenName;
	children: ReactNode;
}) => (
	<PagerFocusContext.Provider value={activeScreen}>
		{children}
	</PagerFocusContext.Provider>
);

export function usePagerFocusEffect(screenName: PagerScreenName, effect: FocusEffectCallback) {
	const activeScreen = useContext(PagerFocusContext);

	useEffect(() => {
		if (activeScreen !== screenName) {
			return undefined;
		}

		return effect();
	}, [activeScreen, effect, screenName]);
}
