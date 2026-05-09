import { useCallback, useMemo, useRef } from 'react';

export function useSheetReplacement<T>() {
	const pendingRef = useRef<T | null>(null);

	const replaceAfterDismiss = useCallback((next: T, dismissCurrent: () => void) => {
		pendingRef.current = next;
		dismissCurrent();
	}, []);

	const consumeReplacement = useCallback((onReplacement: (next: T) => void) => {
		const next = pendingRef.current;
		if (next === null) {
			return false;
		}

		pendingRef.current = null;
		onReplacement(next);
		return true;
	}, []);

	const clearReplacement = useCallback(() => {
		pendingRef.current = null;
	}, []);

	return useMemo(() => ({
		clearReplacement,
		consumeReplacement,
		replaceAfterDismiss,
	}), [clearReplacement, consumeReplacement, replaceAfterDismiss]);
}
