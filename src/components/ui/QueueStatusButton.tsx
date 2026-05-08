import { RefreshCw, UploadCloud } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from '../../constants/Theme';
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
	const { colors } = useAppTheme();
	const { scale, icon, font } = useResponsiveLayout();
	const buttonSize = scale(40, 0.92, 1.04);
	const badgeSize = scale(18, 0.92, 1.04);
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
					borderRadius: buttonSize / 2,
					backgroundColor: colors.surfaceElevated,
					borderColor: colors.border,
					opacity: pressed ? Theme.opacity.active : 1,
				},
			]}
			accessibilityRole="button"
			accessibilityLabel={`Open sync queue. ${count} item${count === 1 ? '' : 's'} queued.`}
		>
			<IconComponent size={icon(18)} color={iconColor} />
			{count > 0 ? (
				<View
					style={[
						styles.badge,
						{
							minWidth: badgeSize,
							height: badgeSize,
							borderRadius: badgeSize / 2,
							backgroundColor: badgeColor,
							borderColor: colors.surface,
						},
					]}
				>
					<Text style={[styles.badgeText, { color: colors.textInverted, fontSize: font(10, 0.94, 1.04) }]}>
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
		shadowColor: '#000',
		shadowOpacity: 0.05,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 1,
	},
	badge: {
		position: 'absolute',
		right: -2,
		top: -2,
		paddingHorizontal: 4,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
	},
	badgeText: {
		fontWeight: '900',
		letterSpacing: 0,
	},
});
