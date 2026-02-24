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

interface ScreenProps {
	children: React.ReactNode;
	style?: ViewStyle;
	contentContainerStyle?: ViewStyle;
	scrollable?: boolean;
	withLargeHeader?: boolean;
	edges?: Edge[];
	backgroundColor?: string;
	keyboardOffset?: number;
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
	withLargeHeader = false,
	edges = ['top', 'left', 'right'], // Navigation usually handles bottom
	backgroundColor = Theme.colors.bg,
	keyboardOffset = 0,
}) => {
	const Container = scrollable ? ScrollView : View;

	return (
		<SafeAreaView
			style={[styles.outer, { backgroundColor }]}
			edges={edges}
		>
			<StatusBar barStyle="dark-content" />

			{withLargeHeader && (
				<View style={styles.bgDecoration} />
			)}

			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				keyboardVerticalOffset={keyboardOffset}
				style={styles.flex}
			>
				<Container
					style={[styles.flex, style]}
					contentContainerStyle={[
						scrollable && styles.scrollContent,
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
		paddingHorizontal: Theme.spacing.screenPadding,
		paddingBottom: 100, // Extra space for bottom nav/fab
	},
	bgDecoration: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		height: 400,
		backgroundColor: Theme.colors.decoration,
		borderBottomLeftRadius: 80,
		borderBottomRightRadius: 80,
		zIndex: -1,
	},
});
