import React, { forwardRef, ReactNode, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';

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
}, ref) => {
	const pages = React.Children.toArray(children);

	useImperativeHandle(ref, () => ({
		setPage: () => undefined,
		setPageFast: () => undefined,
	}), []);

	return (
		<View style={styles.root}>
			{pages[activePageIndex]}
		</View>
	);
});

MainPager.displayName = 'MainPager';

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
});
