import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../constants/Theme';

interface AppModalProps {
	visible: boolean;
	onClose: () => void;
	title: string;
	subtitle?: string;
	children: React.ReactNode;
}

export const AppModal: React.FC<AppModalProps> = ({
	visible,
	onClose,
	title,
	subtitle,
	children,
}) => {
	const insets = useSafeAreaInsets();

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
			statusBarTranslucent
		>
			{/* Backdrop */}
			<Pressable style={styles.backdrop} onPress={onClose}>
				<View style={styles.backdropInner} />
			</Pressable>

			{/* Sheet */}
			<View style={[styles.sheet, { paddingBottom: insets.bottom + Theme.spacing.xl }]}>
				{/* Handle bar */}
				<View style={styles.handle} />

				{/* Header */}
				<View style={styles.header}>
					<View style={styles.headerText}>
						<Text style={styles.title}>{title}</Text>
						{!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
					</View>
					<TouchableOpacity style={styles.closeBtn} onPress={onClose}>
						<MaterialCommunityIcons
							name="close"
							size={20}
							color={Theme.colors.textMuted}
						/>
					</TouchableOpacity>
				</View>

				{/* Divider */}
				<View style={styles.divider} />

				{/* Scrollable Content */}
				<ScrollView
					style={styles.content}
					contentContainerStyle={styles.contentInner}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
				>
					{children}
				</ScrollView>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0, 0, 0, 0.72)',
		justifyContent: 'flex-end',
	},
	backdropInner: {
		flex: 1,
	},
	sheet: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: Theme.colors.surface,
		borderTopLeftRadius: Theme.radius.xl,
		borderTopRightRadius: Theme.radius.xl,
		borderTopWidth: 1,
		borderLeftWidth: 1,
		borderRightWidth: 1,
		borderColor: Theme.colors.border,
		maxHeight: '80%',
		minHeight: 200,
	},
	handle: {
		width: 36,
		height: 4,
		borderRadius: 2,
		backgroundColor: Theme.colors.border,
		alignSelf: 'center',
		marginTop: Theme.spacing.md,
		marginBottom: Theme.spacing.sm,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: Theme.spacing.screenPadding,
		paddingVertical: Theme.spacing.md,
	},
	headerText: { flex: 1 },
	title: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
		textTransform: 'uppercase',
		letterSpacing: 1,
	},
	subtitle: {
		...Theme.typography.detail,
		color: Theme.colors.textMuted,
		marginTop: 2,
		textTransform: 'uppercase',
		letterSpacing: 0.8,
	},
	closeBtn: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: Theme.colors.surfaceElevated,
		borderWidth: 1,
		borderColor: Theme.colors.border,
		justifyContent: 'center',
		alignItems: 'center',
	},
	divider: {
		height: 1,
		backgroundColor: Theme.colors.border,
	},
	content: {
		flex: 1,
	},
	contentInner: {
		paddingHorizontal: Theme.spacing.screenPadding,
		paddingTop: Theme.spacing.sm,
		paddingBottom: Theme.spacing.md,
	},
});
