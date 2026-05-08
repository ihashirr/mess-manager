import { CloudOff, CreditCard, LucideIcon, RefreshCw, Utensils, Users, Wallet } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialogProvider } from '../components/system/dialogs/ConfirmDialog';
import { AppToastHost } from '../components/system/feedback/AppToast';
import { PremiumBottomSheet, type PremiumBottomSheetHandle } from '../components/ui/PremiumBottomSheet';
import { QueueStatusButton } from '../components/ui/QueueStatusButton';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Theme } from '../constants/Theme';
import { HeaderProvider, useAppHeader } from '../context/HeaderContext';
import { OfflineSyncProvider, useOfflineSync } from '../context/OfflineSyncContext';
import { AppThemeProvider, useAppTheme } from '../context/ThemeModeContext';

type MainTabName = 'index' | 'customers' | 'finance' | 'payments';
const TAB_BAR_HEIGHT = 68;
const TAB_BAR_BACKDROP_HEIGHT = Math.round(TAB_BAR_HEIGHT * 1.35);

const MAIN_TABS: {
	name: MainTabName;
	label: string;
	icon: LucideIcon;
}[] = [
	{
		name: 'index',
		label: 'Home',
		icon: Utensils,
	},
	{
		name: 'customers',
		label: 'Customers',
		icon: Users,
	},
	{
		name: 'finance',
		label: 'Finance',
		icon: Wallet,
	},
	{
		name: 'payments',
		label: 'Payments',
		icon: CreditCard,
	},
];


export default function TabLayout() {
	return (
		<AppThemeProvider>
			<ConfirmDialogProvider>
				<HeaderProvider>
					<OfflineSyncProvider>
						<TabLayoutContent />
					</OfflineSyncProvider>
				</HeaderProvider>
			</ConfirmDialogProvider>
		</AppThemeProvider>
	);
}

function TabLayoutContent() {
	const { colors } = useAppTheme();
	const { config } = useAppHeader();
	const { pendingQueueCount, queueItems, runSync, syncBusy } = useOfflineSync();
	const queueSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const failedQueueCount = useMemo(
		() => queueItems.filter((item) => item.status === 'failed').length,
		[queueItems]
	);

	return (
		<GestureHandlerRootView style={[styles.root, { backgroundColor: colors.bg }]}>
			<BottomSheetModalProvider>
				<ScreenHeader
					{...config}
					edgeToEdge={false}
					persistentRightAction={(
						<QueueStatusButton
							count={pendingQueueCount}
							hasFailures={failedQueueCount > 0}
							syncing={syncBusy}
							onPress={() => queueSheetRef.current?.present()}
						/>
					)}
				/>
				<Tabs
					screenOptions={{
						headerShown: false,
						tabBarActiveTintColor: colors.primary,
						tabBarInactiveTintColor: colors.textMuted,
						tabBarLabelStyle: styles.tabLabel,
					}}
					tabBar={(props) => <BottomDock {...props} />}
				>
					<Tabs.Screen
						name="index"
						options={{
							title: 'Home',
						}}
					/>
					<Tabs.Screen
						name="customers"
						options={{
							title: 'Customers',
						}}
					/>
					<Tabs.Screen
						name="payments"
						options={{
							title: 'Payments',
						}}
					/>
					<Tabs.Screen
						name="finance"
						options={{
							title: 'Finance',
						}}
					/>
					<Tabs.Screen
						name="menu"
						options={{
							title: 'Menu',
							href: null,
						}}
					/>
				</Tabs>
				<PremiumBottomSheet
					ref={queueSheetRef}
					title="Sync Queue"
					subtitle={pendingQueueCount > 0 ? `${pendingQueueCount} local change${pendingQueueCount === 1 ? '' : 's'} waiting` : 'All local changes are synced'}
				>
					<View style={styles.queueHeader}>
						<View style={[styles.queueHero, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
							<CloudOff size={18} color={pendingQueueCount > 0 ? colors.warning : colors.primary} />
							<View style={styles.queueHeroCopy}>
								<Text style={[styles.queueHeroTitle, { color: colors.textPrimary }]}>
									{pendingQueueCount > 0 ? 'Offline-safe changes are stored locally' : 'Queue is clear'}
								</Text>
								<Text style={[styles.queueHeroSubtitle, { color: colors.textSecondary }]}>
									{pendingQueueCount > 0
										? 'You can keep working. Sync will retry automatically and you can force it here.'
										: 'Nothing is waiting to upload right now.'}
								</Text>
							</View>
						</View>
						<Button
							title="Sync Now"
							iconLeft={RefreshCw}
							size="sm"
							variant="secondary"
							onPress={() => void runSync(false)}
							loading={syncBusy}
						/>
					</View>

					{queueItems.length === 0 ? (
						<Card style={[styles.queueEmptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
							<Text style={[styles.queueEmptyTitle, { color: colors.textPrimary }]}>No queued items</Text>
							<Text style={[styles.queueEmptySubtitle, { color: colors.textSecondary }]}>
								New offline changes will appear here until Firestore confirms them.
							</Text>
						</Card>
					) : (
						queueItems.map((item) => (
							<Card key={`${item.source}-${item.id}`} style={[styles.queueItemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
								<View style={styles.queueItemRow}>
									<View style={styles.queueItemCopy}>
										<Text style={[styles.queueItemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
										<Text style={[styles.queueItemSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
									</View>
									<View
										style={[
											styles.queueStatusPill,
											{
												backgroundColor: item.status === 'failed' ? colors.danger + '14' : colors.primary + '12',
												borderColor: item.status === 'failed' ? colors.danger + '33' : colors.primary + '24',
											},
										]}
									>
										<Text
											style={[
												styles.queueStatusText,
												{ color: item.status === 'failed' ? colors.danger : colors.primary },
											]}
										>
											{item.status === 'failed' ? 'Failed' : 'Queued'}
										</Text>
									</View>
								</View>
								<Text style={[styles.queueMetaText, { color: colors.textMuted }]}>
									{item.source === 'receipt' ? 'Receipt queue' : 'Data sync queue'} • {formatQueueTime(item.updatedAt)}
								</Text>
								{item.error ? (
									<Text style={[styles.queueErrorText, { color: colors.danger }]}>{item.error}</Text>
								) : null}
							</Card>
						))
					)}
				</PremiumBottomSheet>
			</BottomSheetModalProvider>
			<AppToastHost />

		</GestureHandlerRootView>
	);
}

function BottomDock({
	state,
	descriptors,
	navigation,
}: BottomTabBarProps) {
	const { colors, isDark } = useAppTheme();
	const insets = useSafeAreaInsets();
	const activeRoute = state.routes[state.index]?.name;
	const blurAvailable = Platform.OS !== 'web';
	const blurMethod = Platform.OS === 'android' ? 'dimezisBlurView' : undefined;
	const backdropBlurIntensity = Platform.OS === 'android'
		? 88
		: isDark ? 64 : 76;
	const shellBlurIntensity = Platform.OS === 'android'
		? 78
		: isDark ? 46 : 56;
	const shellSurfaceColor = blurAvailable
		? isDark ? 'rgba(22, 17, 13, 0.03)' : 'rgba(255, 250, 244, 0.05)'
		: isDark ? 'rgba(33, 26, 22, 0.95)' : 'rgba(255, 251, 246, 0.97)';
	const backdropTintColor = isDark ? 'rgba(18, 14, 11, 0.02)' : 'rgba(255, 247, 238, 0.02)';
	const shellFrostColor = isDark ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.03)';
	const activeTintBackground = isDark ? 'rgba(255, 107, 53, 0.10)' : 'rgba(255, 107, 53, 0.08)';

	const navigateToTab = (name: MainTabName) => {
		const route = state.routes.find((item) => item.name === name);
		if (!route) return;

		const event = navigation.emit({
			type: 'tabPress',
			target: route.key,
			canPreventDefault: true,
		});

		if (!event.defaultPrevented) {
			navigation.navigate(route.name, route.params);
		}
	};

	return (
		<View pointerEvents="box-none" style={styles.tabBarRegion}>
			{blurAvailable ? (
				<BlurView
					intensity={backdropBlurIntensity}
					tint={isDark ? 'dark' : 'light'}
					experimentalBlurMethod={blurMethod}
					style={styles.tabBarBackdrop}
				/>
			) : null}
			<View pointerEvents="none" style={[styles.tabBarBackdropTint, { backgroundColor: backdropTintColor }]} />

			<View
				style={[
					styles.tabBarShell,
					{
						marginBottom: Math.max(insets.bottom + Theme.spacing.sm, Theme.spacing.lg),
						borderColor: colors.border,
						backgroundColor: colors.surface,
						shadowColor: isDark ? '#000000' : '#1A162B',
					},
				]}
			>
				{blurAvailable ? (
					<BlurView
						intensity={shellBlurIntensity}
						tint={isDark ? 'dark' : 'light'}
						experimentalBlurMethod={blurMethod}
						style={StyleSheet.absoluteFillObject}
					/>
				) : null}
				<View
					style={[
						styles.tabBarSurface,
						{
							backgroundColor: shellSurfaceColor,
						},
					]}
				/>
				<View
					pointerEvents="none"
					style={[
						styles.tabBarFrost,
						{
							backgroundColor: shellFrostColor,
							borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.46)',
						},
					]}
				/>
				{MAIN_TABS.map((tab) => {
					const route = state.routes.find((item) => item.name === tab.name);
					const focused = activeRoute === tab.name;
					const descriptor = route ? descriptors[route.key] : undefined;

					return (
						<DockItem
							key={tab.name}
							label={tab.label}
							icon={tab.icon}
							focused={focused}
							activeTintBackground={activeTintBackground}
							onPress={() => navigateToTab(tab.name)}
							accessibilityLabel={descriptor?.options.tabBarAccessibilityLabel ?? tab.label}
						/>
					);
				})}
			</View>
		</View>
	);
}

function DockItem({
	label,
	icon,
	focused,
	activeTintBackground,
	onPress,
	accessibilityLabel,
}: {
	label: string;
	icon: LucideIcon;
	focused: boolean;
	activeTintBackground: string;
	onPress: () => void;
	accessibilityLabel?: string;
}) {
	const { colors } = useAppTheme();
	const IconComponent = icon;
	const itemColor = focused ? colors.primary : colors.textMuted;

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.tabItem,
				focused && { backgroundColor: activeTintBackground },
				pressed && { opacity: Theme.opacity.active },
			]}
			accessibilityRole="button"
			accessibilityState={focused ? { selected: true } : {}}
			accessibilityLabel={accessibilityLabel}
		>
			<IconComponent color={itemColor} size={22} strokeWidth={focused ? 2.5 : 2} />
			<Text style={[styles.tabLabel, { color: focused ? colors.textPrimary : colors.textMuted }]}>
				{label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	queueHeader: {
		gap: Theme.spacing.md,
		marginBottom: Theme.spacing.lg,
	},
	queueHero: {
		borderWidth: 1,
		borderRadius: 22,
		padding: Theme.spacing.lg,
		flexDirection: 'row',
		gap: Theme.spacing.md,
		alignItems: 'flex-start',
	},
	queueHeroCopy: {
		flex: 1,
		gap: 4,
	},
	queueHeroTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
	},
	queueHeroSubtitle: {
		...Theme.typography.detail,
		fontSize: 13,
	},
	queueEmptyCard: {
		borderRadius: 22,
	},
	queueEmptyTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
		textAlign: 'center',
	},
	queueEmptySubtitle: {
		...Theme.typography.detail,
		fontSize: 13,
		textAlign: 'center',
		marginTop: Theme.spacing.sm,
	},
	queueItemCard: {
		marginBottom: Theme.spacing.md,
		borderRadius: 20,
	},
	queueItemRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: Theme.spacing.md,
	},
	queueItemCopy: {
		flex: 1,
		gap: 4,
	},
	queueItemTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
	},
	queueItemSubtitle: {
		...Theme.typography.detail,
		fontSize: 13,
	},
	queueStatusPill: {
		borderWidth: 1,
		paddingHorizontal: Theme.spacing.sm,
		paddingVertical: 6,
		borderRadius: Theme.radius.full,
	},
	queueStatusText: {
		...Theme.typography.detailBold,
	},
	queueMetaText: {
		...Theme.typography.detail,
		fontSize: 12,
		marginTop: Theme.spacing.sm,
	},
	queueErrorText: {
		...Theme.typography.detail,
		fontSize: 12,
		marginTop: Theme.spacing.xs,
	},
	tabBarRegion: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		height: TAB_BAR_BACKDROP_HEIGHT,
		justifyContent: 'flex-end',
	},
	tabBarBackdrop: {
		...StyleSheet.absoluteFillObject,
	},
	tabBarBackdropTint: {
		...StyleSheet.absoluteFillObject,
	},
	tabBarShell: {
		height: TAB_BAR_HEIGHT,
		borderRadius: 999,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: Theme.spacing.sm,
		paddingVertical: 6,
		gap: 6,
		borderWidth: 1,
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.04,
		shadowRadius: 16,
		elevation: 2,
		overflow: 'hidden',
		marginHorizontal: Theme.spacing.screen,
	},
	tabBarSurface: {
		...StyleSheet.absoluteFillObject,
	},
	tabBarFrost: {
		...StyleSheet.absoluteFillObject,
		borderTopWidth: 1,
	},
	tabLabel: {
		...Theme.typography.detailBold,
		fontSize: 11,
		letterSpacing: 0,
	},
	tabItem: {
		flex: 1,
		height: 54,
		borderRadius: 999,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 2,
	},
});

function formatQueueTime(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return 'just now';
	}

	return date.toLocaleString();
}
