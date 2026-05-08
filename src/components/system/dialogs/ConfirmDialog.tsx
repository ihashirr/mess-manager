import { AlertTriangle } from 'lucide-react-native';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../ui/Button';
import { Theme } from '../../../constants/Theme';
import { useAppTheme } from '../../../context/ThemeModeContext';

type ConfirmTone = 'danger' | 'warning' | 'primary';

type ConfirmDialogOptions = {
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: ConfirmTone;
};

type ConfirmDialogContextValue = {
	confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
	const { colors, isDark } = useAppTheme();
	const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
	const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

	const close = useCallback((confirmed: boolean) => {
		resolverRef.current?.(confirmed);
		resolverRef.current = null;
		setOptions(null);
	}, []);

	const confirm = useCallback((nextOptions: ConfirmDialogOptions) => (
		new Promise<boolean>((resolve) => {
			resolverRef.current?.(false);
			resolverRef.current = resolve;
			setOptions(nextOptions);
		})
	), []);

	const tone = options?.tone ?? 'danger';
	const toneColor = tone === 'danger'
		? colors.danger
		: tone === 'warning'
			? colors.warning
			: colors.primary;

	return (
		<ConfirmDialogContext.Provider value={{ confirm }}>
			{children}
			<Modal
				visible={Boolean(options)}
				transparent
				animationType="fade"
				onRequestClose={() => close(false)}
				statusBarTranslucent
			>
				<View style={styles.overlay}>
					<Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} />
					<View
						style={[
							styles.dialog,
							{
								backgroundColor: colors.surface,
								borderColor: colors.border,
								shadowOpacity: isDark ? 0.34 : 0.11,
							},
						]}
					>
						<View style={[styles.iconWrap, { backgroundColor: `${toneColor}16` }]}>
							<AlertTriangle size={22} color={toneColor} />
						</View>
						<Text style={[styles.title, { color: colors.textPrimary }]}>{options?.title}</Text>
						<Text style={[styles.message, { color: colors.textSecondary }]}>{options?.message}</Text>
						<View style={styles.actions}>
							<Button
								title={options?.cancelLabel ?? 'Cancel'}
								variant="outline"
								onPress={() => close(false)}
								style={styles.actionButton}
							/>
							<Button
								title={options?.confirmLabel ?? 'Confirm'}
								variant={tone === 'danger' ? 'danger' : 'primary'}
								onPress={() => close(true)}
								style={styles.actionButton}
							/>
						</View>
					</View>
				</View>
			</Modal>
		</ConfirmDialogContext.Provider>
	);
}

export function useConfirmDialog() {
	const value = useContext(ConfirmDialogContext);
	if (!value) {
		throw new Error('useConfirmDialog must be used inside ConfirmDialogProvider');
	}

	return value;
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: Theme.spacing.xl,
		backgroundColor: 'rgba(0, 0, 0, 0.34)',
	},
	dialog: {
		width: '100%',
		maxWidth: 360,
		borderWidth: 1,
		borderRadius: 24,
		padding: Theme.spacing.xl,
		alignItems: 'center',
		shadowColor: '#000',
		shadowRadius: 24,
		shadowOffset: { width: 0, height: 12 },
		elevation: 10,
	},
	iconWrap: {
		width: 48,
		height: 48,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: Theme.spacing.md,
	},
	title: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
		textAlign: 'center',
	},
	message: {
		...Theme.typography.detail,
		fontSize: 13,
		lineHeight: 19,
		textAlign: 'center',
		marginTop: Theme.spacing.sm,
	},
	actions: {
		flexDirection: 'row',
		gap: Theme.spacing.md,
		marginTop: Theme.spacing.xl,
		width: '100%',
	},
	actionButton: {
		flex: 1,
	},
});
