import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Theme } from '../../constants/Theme';

interface InputProps extends TextInputProps {
	label?: string;
	error?: string;
	containerStyle?: ViewStyle | ViewStyle[];
}

export function Input({ label, error, containerStyle, onFocus, onBlur, ...props }: InputProps) {
	const [isFocused, setIsFocused] = useState(false);

	return (
		<View style={[styles.container, containerStyle]}>
			{label && <Text style={styles.label}>{label}</Text>}
			<TextInput
				placeholderTextColor={Theme.colors.textMuted}
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
					isFocused && styles.inputFocused,
					error && styles.inputError,
					props.style
				]}
				{...props}
			/>
			{error && <Text style={styles.errorText}>{error}</Text>}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		marginBottom: Theme.spacing.md,
	},
	label: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textSecondary,
		marginBottom: Theme.spacing.xs,
	},
	input: {
		...Theme.typography.labelMedium,
		backgroundColor: Theme.colors.surface,
		borderWidth: 1,
		borderColor: Theme.colors.border,
		borderRadius: Theme.radius.md,
		padding: Theme.spacing.md,
		color: Theme.colors.textPrimary,
	},
	inputFocused: {
		borderColor: Theme.colors.primary,
		backgroundColor: Theme.colors.surface,
	},
	inputError: {
		borderColor: Theme.colors.danger,
	},
	errorText: {
		...Theme.typography.detail,
		color: Theme.colors.danger,
		marginTop: Theme.spacing.xs,
	}
});
