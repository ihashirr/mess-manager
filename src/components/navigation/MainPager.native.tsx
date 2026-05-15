import React, { forwardRef, ReactNode, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';

export interface MainPagerHandle {
	setPage: (index: number) => void;
	setPageFast: (index: number) => void;
}

interface MainPagerProps {
	activePageIndex: number;
	children: ReactNode;
	onPageScroll?: (pageProgress: number) => void;
	onPageSelected: (position: number) => void;
}

export const MainPager = forwardRef<MainPagerHandle, MainPagerProps>(({
	activePageIndex,
	children,
	onPageScroll,
	onPageSelected,
}, ref) => {
	const pagerRef = useRef<PagerView>(null);

	useImperativeHandle(ref, () => ({
		setPage: (index: number) => {
			pagerRef.current?.setPage(index);
		},
		setPageFast: (index: number) => {
			pagerRef.current?.setPageWithoutAnimation(index);
		},
	}), []);

	return (
		<PagerView
			ref={pagerRef}
			style={styles.root}
			initialPage={activePageIndex}
			offscreenPageLimit={1}
			overdrag
			onPageScroll={(event) => onPageScroll?.(event.nativeEvent.position + event.nativeEvent.offset)}
			onPageSelected={(event) => onPageSelected(event.nativeEvent.position)}
		>
			{children}
		</PagerView>
	);
});

MainPager.displayName = 'MainPager';

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
});
