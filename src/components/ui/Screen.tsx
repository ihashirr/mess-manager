import React from 'react';
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StatusBar,
	StyleSheet,
	View,
	ViewStyle
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
import { useResponsiveLayout } from './useResponsiveLayout';

interface ScreenProps {
	children: React.ReactNode;
	style?: ViewStyle;
	contentContainerStyle?: ViewStyle;
	scrollable?: boolean;
	edges?: Edge[];
	backgroundColor?: string;
	keyboardOffset?: number;
	centerContent?: boolean;
	maxContentWidth?: number;
}

/**
 * Screen Component
 * The "Docker Container" for every layout.
 * Enforces consistent background, padding, and safe area behavior.
 */
export const Screen: React.FC<ScreenProps> = ({
	children,
	style,
	contentContainerStyle,
	scrollable = true,
	edges = ['top', 'left', 'right'], // Navigation usually handles bottom
	backgroundColor = Theme.colors.bg,
	keyboardOffset = 0,
	centerContent = true,
	maxContentWidth,
}) => {
	const Container = scrollable ? ScrollView : View;
	const { colors, isDark } = useAppTheme();
	const { contentPadding, maxContentWidth: responsiveMaxContentWidth } = useResponsiveLayout();
	const resolvedBackground = backgroundColor === Theme.colors.bg ? colors.bg : backgroundColor;
	const resolvedMaxWidth = maxContentWidth ?? responsiveMaxContentWidth;

	return (
		<SafeAreaView
			style={[styles.outer, { backgroundColor: resolvedBackground }]}
			edges={edges}
		>
			<StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				keyboardVerticalOffset={keyboardOffset}
				style={styles.flex}
			>
				<Container
					style={[styles.flex, style]}
					contentContainerStyle={[
						scrollable && styles.scrollContent,
						centerContent && {
							paddingHorizontal: contentPadding,
							width: '100%',
							alignSelf: 'center',
							maxWidth: resolvedMaxWidth,
						},
						contentContainerStyle
					]}
					showsVerticalScrollIndicator={false}
				>
					{children}
				</Container>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	outer: {
		flex: 1,
	},
	flex: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: 100, // Extra space for bottom nav/fab
	},
});
