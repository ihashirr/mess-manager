import { RefreshCw, UploadCloud } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../context/ThemeModeContext';
import { useResponsiveLayout } from './useResponsiveLayout';

type QueueStatusButtonProps = {
	count: number;
	hasFailures: boolean;
	syncing: boolean;
	onPress: () => void;
};

export function QueueStatusButton({
	count,
	hasFailures,
	syncing,
	onPress,
}: QueueStatusButtonProps) {
	const { colors, isDark } = useAppTheme();
	const { scale, icon, font } = useResponsiveLayout();
	const buttonSize = scale(40, 0.92, 1.04);
	const badgeSize = scale(17, 0.92, 1.04);
	const IconComponent = syncing ? RefreshCw : UploadCloud;
	const iconColor = hasFailures ? colors.danger : count > 0 ? colors.primary : colors.textMuted;
	const badgeColor = hasFailures ? colors.danger : colors.primary;
	const label = count > 9 ? '9+' : String(count);

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				{
					height: buttonSize,
					width: buttonSize,
					borderRadius: 14,
					backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.78)',
					borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(42, 30, 19, 0.07)',
					opacity: pressed ? 0.78 : 1,
					transform: [{ scale: pressed ? 0.91 : 1 }],
				},
			]}
			accessibilityRole="button"
			accessibilityLabel={`Open sync queue. ${count} item${count === 1 ? '' : 's'} queued.`}
		>
			<IconComponent size={icon(17)} color={iconColor} strokeWidth={2.2} />
			{count > 0 ? (
				<View
					style={[
						styles.badge,
						{
							minWidth: badgeSize,
							height: badgeSize,
							borderRadius: badgeSize / 2,
							backgroundColor: badgeColor,
							borderColor: colors.bg,
						},
					]}
				>
					<Text style={[styles.badgeText, { color: colors.textInverted, fontSize: font(9, 0.94, 1.04) }]}>
						{label}
					</Text>
				</View>
			) : null}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		// Unified layered shadow
		shadowColor: '#1A1510',
		shadowOpacity: 0.06,
		shadowRadius: 14,
		shadowOffset: { width: 0, height: 6 },
		elevation: 2,
	},
	badge: {
		position: 'absolute',
		right: -3,
		top: -3,
		paddingHorizontal: 4,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 2,
	},
	badgeText: {
		fontWeight: '900',
		letterSpacing: 0,
	},
});
