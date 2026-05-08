import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Toast, { type ToastConfig, type ToastConfigParams, type ToastShowParams } from 'react-native-toast-message';
import { Theme } from '../../../constants/Theme';
import { useAppTheme } from '../../../context/ThemeModeContext';

type AppToastType = 'success' | 'error' | 'info' | 'warning';

type ShowAppToastParams = {
	type?: AppToastType;
	title: string;
	message?: string;
	position?: ToastShowParams['position'];
	visibilityTime?: number;
};

export function showToast({
	type = 'info',
	title,
	message,
	position = 'bottom',
	visibilityTime = 2400,
}: ShowAppToastParams) {
	Toast.show({
		type,
		text1: title,
		text2: message,
		position,
		visibilityTime,
		bottomOffset: 108,
		topOffset: 76,
	});
}

export function AppToastHost() {
	return (
		<Toast
			config={toastConfig}
			position="bottom"
			visibilityTime={2400}
			bottomOffset={108}
			topOffset={76}
			swipeable
		/>
	);
}

const toastConfig: ToastConfig = {
	success: (params) => <ToastCard {...params} tone="success" />,
	error: (params) => <ToastCard {...params} tone="error" />,
	info: (params) => <ToastCard {...params} tone="info" />,
	warning: (params) => <ToastCard {...params} tone="warning" />,
};

function ToastCard({
	text1,
	text2,
	tone,
}: ToastConfigParams<unknown> & { tone: AppToastType }) {
	const { colors, isDark } = useAppTheme();
	const toneColor = tone === 'success'
		? colors.success
		: tone === 'error'
			? colors.danger
			: tone === 'warning'
				? colors.warning
				: colors.primary;
	const Icon = tone === 'success'
		? CheckCircle2
		: tone === 'error'
			? XCircle
			: tone === 'warning'
				? AlertTriangle
				: Info;

	return (
		<View
			style={[
				styles.toast,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					shadowOpacity: isDark ? 0.28 : 0.08,
				},
			]}
		>
			<View style={[styles.iconWrap, { backgroundColor: `${toneColor}16` }]}>
				<Icon size={18} color={toneColor} />
			</View>
			<View style={styles.copy}>
				<Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
					{text1}
				</Text>
				{text2 ? (
					<Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
						{text2}
					</Text>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	toast: {
		width: '92%',
		minHeight: 58,
		borderWidth: 1,
		borderRadius: 20,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.md,
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.md,
		shadowColor: '#201812',
		shadowRadius: 18,
		shadowOffset: { width: 0, height: 8 },
		elevation: 3,
	},
	iconWrap: {
		width: 36,
		height: 36,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	copy: {
		flex: 1,
		minWidth: 0,
	},
	title: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
	},
	message: {
		...Theme.typography.detail,
		fontSize: 13,
		marginTop: 3,
		lineHeight: 18,
	},
});
