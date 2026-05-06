import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
	Modal,
	Pressable,
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
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
import { ModalBackdrop } from './ModalBackdrop';

interface CenterModalProps {
	visible: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
}

const SPRING_CONFIG = {
	damping: 24,
	stiffness: 280,
	mass: 0.8,
};

export const CenterModal: React.FC<CenterModalProps> = ({
	visible,
	onClose,
	title,
	children,
}) => {
	const { colors } = useAppTheme();
	const [renderModal, setRenderModal] = useState(visible);
	const anim = useSharedValue(0);

	// "Freeze" content during exit animation to prevent ghosting/jumps
	const [stableContent, setStableContent] = useState({ title, children });

	useEffect(() => {
		if (visible) {
			setRenderModal(true);
			anim.value = withSpring(1, SPRING_CONFIG);
		} else {
			anim.value = withTiming(0, { duration: 200 }, (finished) => {
				if (finished) {
					runOnJS(setRenderModal)(false);
				}
			});
		}
	}, [anim, visible]);

	// Update stable content only when visible
	useEffect(() => {
		if (visible) {
			setStableContent({ title, children });
		}
	}, [title, children, visible]);

	const backdropStyle = useAnimatedStyle(() => ({
		opacity: anim.value,
	}));

	const contentStyle = useAnimatedStyle(() => ({
		opacity: anim.value,
		transform: [
			{ scale: interpolate(anim.value, [0, 1], [0.94, 1]) }
		],
	}));

	if (!renderModal) return null;

	const { title: dTitle, children: dChildren } = stableContent;

	return (
		<Modal
			visible={true}
			transparent
			animationType="none"
			onRequestClose={onClose}
		>
			<View style={styles.container}>
				{/* Backdrop */}
				<Animated.View
					style={[
						styles.backdrop,
						backdropStyle,
					]}
				>
					<ModalBackdrop intensity={30} />
					<Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
				</Animated.View>

				{/* Content */}
				<Animated.View
					style={[
						styles.content,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
						contentStyle,
					]}
				>
					{dTitle && (
						<View style={[styles.header, { borderBottomColor: colors.border }]}>
							<Text style={[styles.title, { color: colors.textSecondary }]}>{dTitle}</Text>
							<TouchableOpacity onPress={onClose} style={styles.closeBtn}>
								<MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
							</TouchableOpacity>
						</View>
					)}
					<View style={styles.body}>
						{dChildren}
					</View>
				</Animated.View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: Theme.spacing.xl,
	},
	backdrop: {
		...StyleSheet.absoluteFillObject,
	},
	content: {
		width: '100%',
		maxWidth: 400,
		borderRadius: Theme.radius.xl,
		borderWidth: 1,
		overflow: 'hidden',
		elevation: 5,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.md,
		borderBottomWidth: 1,
	},
	title: {
		...Theme.typography.label,
		textTransform: 'uppercase',
		letterSpacing: 1,
	},
	closeBtn: {
		padding: 4,
	},
	body: {
		padding: Theme.spacing.lg,
	},
});
