import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';

interface InputProps extends TextInputProps {
	label?: string;
	error?: string;
	containerStyle?: ViewStyle | ViewStyle[];
}

export function Input({ label, error, containerStyle, onFocus, onBlur, ...props }: InputProps) {
	const [isFocused, setIsFocused] = useState(false);
	const { colors, isDark } = useAppTheme();

	return (
		<View style={[styles.container, containerStyle]}>
			{label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
			<TextInput
				placeholderTextColor={colors.textMuted}
				onFocus={(e) => {
					setIsFocused(true);
					onFocus?.(e);
				}}
				onBlur={(e) => {
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
	},
	errorText: {
		...Theme.typography.detail,
		marginTop: Theme.spacing.xs,
	}
});
