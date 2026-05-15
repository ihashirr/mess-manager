import React, { useState } from 'react';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';

interface InputProps extends TextInputProps {
	label?: string;
	error?: string;
	containerStyle?: ViewStyle | ViewStyle[];
	bottomSheet?: boolean;
}

export function Input({ label, error, containerStyle, onFocus, onBlur, bottomSheet = false, ...props }: InputProps) {
	const [isFocused, setIsFocused] = useState(false);
	const { colors, isDark } = useAppTheme();
	const InputComponent = bottomSheet ? BottomSheetTextInput : TextInput;


	return (
		<View style={[styles.container, containerStyle]}>
			{label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
			<InputComponent
				placeholderTextColor={colors.textMuted}
				onFocus={(e: any) => {
					setIsFocused(true);
					onFocus?.(e);
				}}
				onBlur={(e: any) => {
					setIsFocused(false);
					onBlur?.(e);
				}}
				style={[
					styles.input,
					{
						backgroundColor: isFocused || isDark ? colors.surface : colors.surfaceElevated,
						borderColor: isFocused ? colors.primary : error ? colors.danger : colors.border,
						color: colors.textPrimary,
					},
					props.style
				]}
				{...props}
			/>
			{error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		marginBottom: Theme.spacing.md,
	},
	label: {
		...Theme.typography.labelMedium,
		marginBottom: Theme.spacing.xs,
	},
	input: {
		...Theme.typography.labelMedium,
		borderWidth: 1,
		borderRadius: Theme.radius.md,
		padding: Theme.spacing.md,
		minHeight: 48,
		...Theme.shadows.input,
	},
	errorText: {
		...Theme.typography.detail,
		marginTop: Theme.spacing.xs,
	}
});
