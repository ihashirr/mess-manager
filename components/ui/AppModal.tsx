import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import Animated, {
	interpolate,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../constants/Theme';

interface AppModalProps {
	visible: boolean;
	onClose: () => void;
	title: string;
	subtitle?: string;
	children: React.ReactNode;
}

const SPRING_CONFIG = {
	damping: 22,
	stiffness: 280,
	mass: 0.8,
};

export const AppModal: React.FC<AppModalProps> = ({
	visible,
	onClose,
	title,
	subtitle,
	children,
}) => {
	const insets = useSafeAreaInsets();
	const [renderModal, setRenderModal] = useState(visible);
	const anim = useSharedValue(0);

	// "Freeze" content during exit animation to prevent ghosting/jumps
	const [stableContent, setStableContent] = useState({ title, subtitle, children });

	useEffect(() => {
		if (visible) {
			setStableContent({ title, subtitle, children });
			setRenderModal(true);
			anim.value = withSpring(1, SPRING_CONFIG);
		} else {
			anim.value = withTiming(0, { duration: 250 }, (finished) => {
				if (finished) {
					runOnJS(setRenderModal)(false);
				}
			});
		}
	}, [visible]);

	// Update stable content only when visible
	useEffect(() => {
		if (visible) {
			setStableContent({ title, subtitle, children });
		}
	}, [title, subtitle, children, visible]);

	const backdropStyle = useAnimatedStyle(() => ({
		opacity: anim.value,
	}));

	const sheetStyle = useAnimatedStyle(() => ({
		transform: [
			{
				translateY: interpolate(anim.value, [0, 1], [400, 0]),
			},
		],
	}));

	if (!renderModal) return null;

	const { title: dTitle, subtitle: dSubtitle, children: dChildren } = stableContent;

	return (
		<Modal
			visible={true}
			transparent
			animationType="none"
			onRequestClose={onClose}
			statusBarTranslucent
		>
			<View style={StyleSheet.absoluteFill}>
				{/* Backdrop */}
				<Animated.View style={[styles.backdrop, backdropStyle]}>
					<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
				</Animated.View>

				{/* Sheet */}
				<Animated.View
					style={[
						styles.sheet,
						{ paddingBottom: insets.bottom + Theme.spacing.xl },
						sheetStyle,
					]}
				>
					{/* Handle bar */}
					<View style={styles.handle} />

					{/* Header */}
					<View style={styles.header}>
						<View style={styles.headerText}>
							<Text style={styles.title}>{dTitle}</Text>
							{!!dSubtitle && <Text style={styles.subtitle}>{dSubtitle}</Text>}
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
						{dChildren}
					</ScrollView>
				</Animated.View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0, 0, 0, 0.72)',
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
