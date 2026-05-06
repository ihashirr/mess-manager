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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
import { useAppTheme } from '../../context/ThemeModeContext';
import { ModalBackdrop } from './ModalBackdrop';

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
	const { colors } = useAppTheme();
	const [renderModal, setRenderModal] = useState(visible);
	const anim = useSharedValue(0);
	const dragY = useSharedValue(0);

	// "Freeze" content during exit animation to prevent ghosting/jumps
	const [stableContent, setStableContent] = useState({ title, subtitle, children });

	useEffect(() => {
		if (visible) {
			setRenderModal(true);
			dragY.value = 0;
			anim.value = withSpring(1, SPRING_CONFIG);
		} else {
			anim.value = withTiming(0, { duration: 250 }, (finished) => {
				if (finished) {
					runOnJS(setRenderModal)(false);
				}
			});
		}
	}, [anim, dragY, visible]);

	// Update stable content only when visible
	useEffect(() => {
		if (visible) {
			setStableContent({ title, subtitle, children });
		}
	}, [title, subtitle, children, visible]);

	const panGesture = Gesture.Pan()
		.onUpdate((e) => {
			if (e.translationY > 0) {
				dragY.value = e.translationY;
			}
		})
		.onEnd((e) => {
			if (e.translationY > 100 || e.velocityY > 600) {
				dragY.value = withTiming(600, { duration: 200 });
				runOnJS(onClose)();
			} else {
				dragY.value = withSpring(0, SPRING_CONFIG);
			}
		});

	const backdropStyle = useAnimatedStyle(() => ({
		opacity: interpolate(dragY.value, [0, 400], [anim.value, 0], 'clamp'),
	}));

	const sheetStyle = useAnimatedStyle(() => ({
		transform: [
			{
				translateY: interpolate(anim.value, [0, 1], [400, 0]) + dragY.value,
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
				<Animated.View
					style={[
						styles.backdrop,
						backdropStyle,
					]}
				>
					<ModalBackdrop intensity={34} />
					<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
				</Animated.View>

				{/* Sheet */}
				<GestureDetector gesture={panGesture}>
					<Animated.View
						style={[
							styles.sheet,
							{
								backgroundColor: colors.surface,
								borderColor: colors.border,
							},
							{ paddingBottom: insets.bottom + Theme.spacing.xl },
							sheetStyle,
						]}
					>
						{/* Handle bar */}
						<View style={[styles.handle, { backgroundColor: colors.border }]} />

						{/* Header */}
						<View style={styles.header}>
							<View style={styles.headerText}>
								<Text style={[styles.title, { color: colors.textPrimary }]}>{dTitle}</Text>
								{!!dSubtitle && <Text style={[styles.subtitle, { color: colors.textMuted }]}>{dSubtitle}</Text>}
							</View>
							<TouchableOpacity
								style={[
									styles.closeBtn,
									{
										backgroundColor: colors.surfaceElevated,
										borderColor: colors.border,
									},
								]}
								onPress={onClose}
							>
								<MaterialCommunityIcons
									name="close"
									size={20}
									color={colors.textMuted}
								/>
							</TouchableOpacity>
						</View>

						{/* Divider */}
						<View style={[styles.divider, { backgroundColor: colors.border }]} />

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
				</GestureDetector>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFillObject,
	},
	sheet: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		borderTopLeftRadius: Theme.radius.xl,
		borderTopRightRadius: Theme.radius.xl,
		borderTopWidth: 1,
		borderLeftWidth: 1,
		borderRightWidth: 1,
		maxHeight: '80%',
		minHeight: 200,
	},
	handle: {
		width: 36,
		height: 4,
		borderRadius: 2,
		alignSelf: 'center',
		marginTop: Theme.spacing.md,
		marginBottom: Theme.spacing.sm,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: Theme.spacing.screen,
		paddingVertical: Theme.spacing.md,
	},
	headerText: { flex: 1 },
	title: {
		...Theme.typography.labelMedium,
		textTransform: 'uppercase',
		letterSpacing: 1,
	},
	subtitle: {
		...Theme.typography.detail,
		marginTop: 2,
		textTransform: 'uppercase',
		letterSpacing: 0.8,
	},
	closeBtn: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	divider: {
		height: 1,
	},
	content: {
		flex: 1,
	},
	contentInner: {
		paddingHorizontal: Theme.spacing.screen,
		paddingTop: Theme.spacing.sm,
		paddingBottom: Theme.spacing.md,
	},
});
