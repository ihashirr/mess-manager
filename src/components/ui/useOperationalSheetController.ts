import { useCallback, useMemo, useState } from 'react';
import { useSheetReplacement } from './useSheetReplacement';

type SheetRoute = { name: string };

export function useOperationalSheetController<T extends SheetRoute>() {
	const [currentRoute, setCurrentRoute] = useState<T | null>(null);
	const replacement = useSheetReplacement<T>();

	const open = useCallback((route: T) => {
		setCurrentRoute(route);
	}, []);

	const close = useCallback(() => {
		setCurrentRoute(null);
	}, []);

	const replaceAfterDismiss = useCallback((next: T, dismissCurrent: () => void) => {
		replacement.replaceAfterDismiss(next, dismissCurrent);
	}, [replacement]);

	const consumeReplacement = useCallback(() => {
		return replacement.consumeReplacement((next) => {
			setCurrentRoute(next);
		});
	}, [replacement]);

	return useMemo(() => ({
		close,
		consumeReplacement,
		currentRoute,
		open,
		replaceAfterDismiss,
	}), [close, consumeReplacement, currentRoute, open, replaceAfterDismiss]);
}
