import { CloudOff, LucideIcon, RefreshCw, Utensils, Users, Wallet } from 'lucide-react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { Stack, usePathname } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AnimatedReanimated, {
	Extrapolation,
	interpolate,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomersScreen from './customers';
import FinanceScreen from './finance';
import HomeScreen from './index';
import MenuScreen from './menu';
import { PaymentsCollectView } from './payments';
import { MainPager, type MainPagerHandle } from '../components/navigation/MainPager';
import { ConfirmDialogProvider } from '../components/system/dialogs/ConfirmDialog';
import { AppToastHost } from '../components/system/feedback/AppToast';
import { Button, Card, PremiumBottomSheet, QueueStatusButton, ScreenHeader, type PremiumBottomSheetHandle } from '../components/ui';
import { Theme } from '../constants/Theme';
import { HeaderProvider, useAppHeader } from '../context/HeaderContext';
import { OfflineSyncProvider, useOfflineSync } from '../context/OfflineSyncContext';
import { PagerFocusProvider } from '../context/PagerFocusContext';
import { AppThemeProvider, useAppTheme } from '../context/ThemeModeContext';

type MainTabName = 'index' | 'customers' | 'finance';
type AppScreenName = MainTabName | 'menu' | 'payments';
const TAB_BAR_HEIGHT = 74;
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
		label: 'Money',
		icon: Wallet,
	},
];

const SWIPE_TAB_ORDER: MainTabName[] = MAIN_TABS.map((tab) => tab.name);

function getTabFromPathname(pathname: string): MainTabName | null {
	const firstSegment = pathname.split('/').filter(Boolean)[0] ?? 'index';
	return SWIPE_TAB_ORDER.includes(firstSegment as MainTabName) ? firstSegment as MainTabName : null;
}

function getScreenFromPathname(pathname: string): AppScreenName {
	const firstSegment = pathname.split('/').filter(Boolean)[0] ?? 'index';
	if (firstSegment === 'menu') {
		return 'menu';
	}
	if (firstSegment === 'payments') {
		return 'payments';
	}

	return getTabFromPathname(pathname) ?? 'index';
}

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
	const pathname = usePathname();
	const queueSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const pagerRef = useRef<MainPagerHandle>(null);
	const currentSwipeTab = getTabFromPathname(pathname);
	const routedScreen = getScreenFromPathname(pathname);
	const [activePageIndex, setActivePageIndex] = useState(() => (
		currentSwipeTab ? SWIPE_TAB_ORDER.indexOf(currentSwipeTab) : 0
	));
	const pagerProgress = useSharedValue(currentSwipeTab ? SWIPE_TAB_ORDER.indexOf(currentSwipeTab) : 0);
	const lastSyncedPathnameRef = useRef(pathname);
	const activeScreen = routedScreen === 'menu' || routedScreen === 'payments'
		? routedScreen
		: SWIPE_TAB_ORDER[activePageIndex] ?? 'index';
	const failedQueueCount = useMemo(
		() => queueItems.filter((item) => item.status === 'failed').length,
		[queueItems]
	);

	useEffect(() => {
		if (lastSyncedPathnameRef.current === pathname) {
			return;
		}

		lastSyncedPathnameRef.current = pathname;

		if (!currentSwipeTab) {
			return;
		}

		const routeIndex = SWIPE_TAB_ORDER.indexOf(currentSwipeTab);
		if (routeIndex !== activePageIndex) {
			setActivePageIndex(routeIndex);
			pagerProgress.value = withSpring(routeIndex, { damping: 22, stiffness: 260 });
			pagerRef.current?.setPage(routeIndex);
		}
	}, [activePageIndex, currentSwipeTab, pagerProgress, pathname]);

	const navigateToTab = useCallback((name: MainTabName) => {
		const targetIndex = SWIPE_TAB_ORDER.indexOf(name);
		if (targetIndex < 0) {
			return;
		}

		void Haptics.selectionAsync();
		setActivePageIndex(targetIndex);
		pagerProgress.value = withTiming(targetIndex, { duration: 130 });
		pagerRef.current?.setPageFast(targetIndex);
	}, [pagerProgress]);

	const handlePageScroll = useCallback((pageProgress: number) => {
		pagerProgress.value = pageProgress;
	}, [pagerProgress]);

	const handlePageSelected = useCallback((position: number) => {
		const nextTab = SWIPE_TAB_ORDER[position];
		if (!nextTab) {
			return;
		}

		setActivePageIndex(position);
		pagerProgress.value = withSpring(position, { damping: 22, stiffness: 260 });
		void Haptics.selectionAsync();
	}, [pagerProgress]);

	return (
		<GestureHandlerRootView style={[styles.root, { backgroundColor: colors.bg }]}>
			<BottomSheetModalProvider>
				<PagerFocusProvider activeScreen="none">
					<View pointerEvents="none" style={styles.routerMountHost}>
						<Stack screenOptions={{ headerShown: false }} />
					</View>
				</PagerFocusProvider>
				<PagerFocusProvider activeScreen={activeScreen}>
					<ScreenHeader
						{...config}
						edgeToEdge={false}
						activeIndex={activePageIndex}
						pageCount={SWIPE_TAB_ORDER.length}
						pagerProgress={pagerProgress}
						persistentRightAction={(
							<QueueStatusButton
								count={pendingQueueCount}
								hasFailures={failedQueueCount > 0}
								syncing={syncBusy}
								onPress={() => queueSheetRef.current?.present()}
							/>
						)}
					/>
					{activeScreen === 'menu' ? (
						<View style={styles.tabSwipeRegion}>
							<MenuScreen />
						</View>
					) : activeScreen === 'payments' ? (
						<View style={styles.tabSwipeRegion}>
							<PaymentsCollectView standalone />
						</View>
					) : (
						<>
							<MainPager
								ref={pagerRef}
								activePageIndex={activePageIndex}
								onPageScroll={handlePageScroll}
								onPageSelected={handlePageSelected}
							>
								<PagerPageSlot key="index" index={0} activePageIndex={activePageIndex}>
									<HomeScreen />
								</PagerPageSlot>
								<PagerPageSlot key="customers" index={1} activePageIndex={activePageIndex}>
									<CustomersScreen />
								</PagerPageSlot>
								<PagerPageSlot key="finance" index={2} activePageIndex={activePageIndex}>
									<FinanceScreen />
								</PagerPageSlot>
							</MainPager>
							<BottomDock
								activeTab={SWIPE_TAB_ORDER[activePageIndex] ?? 'index'}
								pagerProgress={pagerProgress}
								onTabPress={navigateToTab}
							/>
						</>
					)}
				</PagerFocusProvider>
				<PremiumBottomSheet
					ref={queueSheetRef}
					title="Sync Queue"
					subtitle={pendingQueueCount > 0 ? `${pendingQueueCount} local change${pendingQueueCount === 1 ? '' : 's'} waiting` : 'All local changes are synced'}
					policy="passive"
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

function PagerPageSlot({
	index,
	activePageIndex,
	children,
}: {
	index: number;
	activePageIndex: number;
	children: ReactNode;
}) {
	const shouldRender = Math.abs(index - activePageIndex) <= 1;

	return (
		<View collapsable={false} style={styles.pagerPage}>
			{shouldRender ? children : null}
		</View>
	);
}

function BottomDock({
	activeTab,
	pagerProgress,
	onTabPress,
}: {
	activeTab: MainTabName | null;
	pagerProgress: SharedValue<number>;
	onTabPress: (name: MainTabName) => void;
}) {
	const { isDark } = useAppTheme();
	const insets = useSafeAreaInsets();
	const blurAvailable = Platform.OS !== 'web';
	const blurMethod = Platform.OS === 'android' ? 'dimezisBlurView' : undefined;
	const shellBlurIntensity = Platform.OS === 'android'
		? isDark ? 48 : 88
		: isDark ? 36 : 64;
	const shellSurfaceColor = blurAvailable
		? isDark ? 'rgba(18, 19, 24, 0.78)' : 'rgba(255, 255, 255, 0.85)'
		: isDark ? 'rgba(18, 19, 24, 0.96)' : 'rgba(255, 255, 255, 0.92)';
	const shellFrostColor = isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(255, 255, 255, 0.03)';
	const activeTintBackground = isDark ? 'rgba(255, 107, 53, 0.19)' : 'rgba(255, 107, 53, 0.13)';

	return (
		<View pointerEvents="box-none" style={styles.tabBarRegion}>
			<View
				style={[
					styles.tabBarShell,
					{
						marginBottom: Math.max(insets.bottom + 12, 12),
						borderColor: isDark ? 'rgba(255, 255, 255, 0.095)' : 'rgba(0, 0, 0, 0.05)',
						backgroundColor: isDark ? 'rgba(18, 19, 24, 0.94)' : 'rgba(255, 255, 255, 0.85)',
						shadowColor: isDark ? '#000000' : '#201812',
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
					const tabIndex = SWIPE_TAB_ORDER.indexOf(tab.name);
					const focused = activeTab === tab.name;

					return (
						<DockItem
							key={tab.name}
							label={tab.label}
							icon={tab.icon}
							index={tabIndex}
							focused={focused}
							activeTintBackground={activeTintBackground}
							pagerProgress={pagerProgress}
							onPress={() => onTabPress(tab.name)}
							accessibilityLabel={tab.label}
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
	index,
	focused,
	activeTintBackground,
	pagerProgress,
	onPress,
	accessibilityLabel,
}: {
	label: string;
	icon: LucideIcon;
	index: number;
	focused: boolean;
	activeTintBackground: string;
	pagerProgress: SharedValue<number>;
	onPress: () => void;
	accessibilityLabel?: string;
}) {
	const { colors } = useAppTheme();
	const IconComponent = icon;
	const itemColor = focused ? colors.primary : colors.textMuted;
	
	const scale = useSharedValue(1);
	
	const handlePressIn = () => {
		scale.value = withSpring(0.85, { damping: 12, stiffness: 300 });
	};
	
	const handlePressOut = () => {
		scale.value = withSpring(1, { damping: 15, stiffness: 200 });
	};
	
	const handlePress = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		onPress();
	};

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }]
	}));

	const activeFillStyle = useAnimatedStyle(() => {
		const distance = Math.abs(pagerProgress.value - index);
		return {
			opacity: interpolate(distance, [0, 0.72, 1], [1, 0.28, 0], Extrapolation.CLAMP),
			transform: [
				{ scale: interpolate(distance, [0, 1], [1, 0.78], Extrapolation.CLAMP) },
			],
		};
	});

	return (
		<Pressable
			onPress={handlePress}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			style={({ pressed }) => [
				styles.tabItem,
				pressed && { opacity: Theme.opacity.active },
			]}
			accessibilityRole="button"
			accessibilityState={focused ? { selected: true } : {}}
			accessibilityLabel={accessibilityLabel}
		>
			<AnimatedReanimated.View
				pointerEvents="none"
				style={[
					styles.tabItemActiveFill,
					{ backgroundColor: activeTintBackground },
					activeFillStyle,
				]}
			/>
			<AnimatedReanimated.View style={[styles.tabItemInner, animatedStyle]}>
				<IconComponent color={itemColor} size={22} strokeWidth={focused ? 2.5 : 2} />
				<Text style={[styles.tabLabel, { color: focused ? colors.textPrimary : colors.textMuted }]}>
					{label}
				</Text>
			</AnimatedReanimated.View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	routerMountHost: {
		position: 'absolute',
		width: 1,
		height: 1,
		opacity: 0,
		overflow: 'hidden',
	},
	tabSwipeRegion: {
		flex: 1,
	},
	pagerPage: {
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
		borderRadius: 26,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: Theme.spacing.xs,
		paddingVertical: Theme.spacing.xs,
		gap: 4,
		borderWidth: 1,
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.05,
		shadowRadius: 16,
		elevation: 4,
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
		height: 56,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
	},
	tabItemActiveFill: {
		...StyleSheet.absoluteFillObject,
		borderRadius: 18,
	},
	tabItemInner: {
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
