import { ActivityIndicator, Animated, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import { BarChart3, Search, SlidersHorizontal, UserPlus, X } from 'lucide-react-native';
import { useConfirmDialog } from '../components/system/dialogs/ConfirmDialog';
import { showToast } from '../components/system/feedback/AppToast';
import { PremiumBottomSheet, type PremiumBottomSheetHandle } from '../components/ui/PremiumBottomSheet';
import { CustomerIntelligenceDetail } from '../components/ui/CustomerIntelligenceDetail';
import { LayeredSurface } from '../components/ui/LayeredSurface';
import { Screen } from '../components/ui/Screen';
import { ScreenHeaderActionButton } from '../components/ui/ScreenHeader';
import { useResponsiveLayout } from '../components/ui/useResponsiveLayout';
import { useOperationalSheetController } from '../components/ui/useOperationalSheetController';
import { type CustomerSheetEvent, type OperationalSheetRoute } from '../components/ui/sheetTypes';
import { CustomerCard } from '../components/customers/CustomerCard';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { type Customer, type CustomerFormValues } from '../components/customers/types';
import { Theme } from '../constants/Theme';
import { useAppHeader } from '../context/HeaderContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { useAppTheme } from '../context/ThemeModeContext';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { type WeekMenu } from '../utils/menuLogic';
import { DAYS, type DayName, emptyWeekAttendance, getDatesForWeek, getWeekId } from '../utils/weekLogic';

type CustomerFilter = 'All' | 'Active' | 'Due' | 'Expired' | 'Lunch' | 'Dinner';
type CustomersSheetRoute = Extract<OperationalSheetRoute, { name: 'customer-detail' | 'customer-form' | 'customer-stats' }>;

const CUSTOMER_FILTERS: CustomerFilter[] = ['All', 'Active', 'Due', 'Expired', 'Lunch', 'Dinner'];
let localCustomerCounter = 0;

const matchesCustomerSearch = (customer: Customer, normalizedQuery: string) => {
	if (!normalizedQuery) {
		return true;
	}

	return (
		(customer.name?.toLowerCase() || '').includes(normalizedQuery) ||
		(customer.phone?.toLowerCase() || '').includes(normalizedQuery) ||
		(customer.address?.location?.toLowerCase() || '').includes(normalizedQuery) ||
		(customer.address?.flat?.toLowerCase() || '').includes(normalizedQuery)
	);
};

const matchesCustomerFilter = (customer: Customer, filter: CustomerFilter) => {
	switch (filter) {
		case 'Active':
			return getDaysLeft(toDate(customer.endDate)) >= 0;
		case 'Due':
			return getDueAmount(customer.pricePerMonth, customer.totalPaid || 0) > 0;
		case 'Expired':
			return getDaysLeft(toDate(customer.endDate)) < 0;
		case 'Lunch':
			return customer.mealsPerDay?.lunch !== false;
		case 'Dinner':
			return customer.mealsPerDay?.dinner !== false;
		default:
			return true;
	}
};

function FilterChip({
	label,
	active,
	onPress,
}: {
	label: CustomerFilter;
	active: boolean;
	onPress: () => void;
}) {
	const { colors, isDark } = useAppTheme();
	const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;
	const pressScale = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		Animated.timing(activeProgress, {
			toValue: active ? 1 : 0,
			duration: Theme.animation.duration.normal,
			useNativeDriver: false,
		}).start();
	}, [active, activeProgress]);

	const handlePressIn = () => {
		Animated.timing(pressScale, {
			toValue: 0.97,
			duration: Theme.animation.duration.fast,
			useNativeDriver: false,
		}).start();
	};

	const handlePressOut = () => {
		Animated.timing(pressScale, {
			toValue: 1,
			duration: Theme.animation.duration.fast,
			useNativeDriver: false,
		}).start();
	};

	const animatedContainerStyle = {
		backgroundColor: activeProgress.interpolate({
			inputRange: [0, 1],
			outputRange: [isDark ? 'rgba(255, 255, 255, 0.055)' : 'rgba(255, 255, 255, 0.54)', colors.primary],
		}),
		borderColor: activeProgress.interpolate({
			inputRange: [0, 1],
			outputRange: [isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(42, 30, 19, 0.08)', colors.primary],
		}),
		shadowOpacity: activeProgress.interpolate({
			inputRange: [0, 1],
			outputRange: [isDark ? 0 : 0.02, isDark ? 0.34 : 0.2],
		}),
		shadowRadius: activeProgress.interpolate({
			inputRange: [0, 1],
			outputRange: [isDark ? 0 : 5, 14],
		}),
		transform: [{ scale: pressScale }],
	};
	const highlightOpacity = activeProgress.interpolate({
		inputRange: [0, 1],
		outputRange: [0, 0.22],
	});
	const textColor = activeProgress.interpolate({
		inputRange: [0, 1],
		outputRange: [colors.textSecondary, isDark ? '#FFFFFF' : colors.textInverted],
	});

	return (
		<Animated.View style={[styles.filterChipMotion, animatedContainerStyle]}>
			<Animated.View
				pointerEvents="none"
				style={[
					styles.filterChipHighlight,
					{
						backgroundColor: isDark ? 'rgba(255, 255, 255, 0.46)' : '#FFFFFF',
						opacity: highlightOpacity,
					},
				]}
			/>
			<Pressable
				onPress={onPress}
				onPressIn={handlePressIn}
				onPressOut={handlePressOut}
				hitSlop={6}
				accessibilityRole="button"
				accessibilityState={{ selected: active }}
				accessibilityLabel={`Filter customers by ${label}`}
				style={styles.filterChipPressable}
			>
				<Animated.Text style={[styles.filterChipText, { color: textColor }]}>{label}</Animated.Text>
			</Pressable>
		</Animated.View>
	);
}

export default function CustomersScreen() {
	const { colors, isDark } = useAppTheme();
	const { confirm } = useConfirmDialog();
	const { setHeaderConfig } = useAppHeader();
	const {
		ready,
		customers,
		menuByDate,
		attendanceByDate,
		addCustomer: saveCustomerOffline,
		deleteCustomer: queueDeleteCustomer,
		saveAttendanceBatch,
	} = useOfflineSync();
	const { contentPadding, maxContentWidth, maxReadableWidth, scale, font, icon } = useResponsiveLayout();
	const [savingCustomer, setSavingCustomer] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const intelligenceSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const addCustomerSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const statsSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const sheetController = useOperationalSheetController<CustomersSheetRoute>();
	const openSheet = sheetController.open;
	const [searchQuery, setSearchQuery] = useState('');
	const [searchFocused, setSearchFocused] = useState(false);
	const searchFocusProgress = useRef(new Animated.Value(0)).current;
	const [activeFilter, setActiveFilter] = useState<CustomerFilter>('All');
	const [weekAttendance, setWeekAttendance] = useState<Record<DayName, { lunch: boolean; dinner: boolean }>>(emptyWeekAttendance());
	const currentSheetRoute = sheetController.currentRoute;
	const selectedCustomer = currentSheetRoute?.name === 'customer-detail'
		? customers.find((customer) => customer.id === currentSheetRoute.customerId) ?? null
		: null;
	const editingCustomer = currentSheetRoute?.name === 'customer-form' && currentSheetRoute.mode === 'edit'
		? customers.find((customer) => customer.id === currentSheetRoute.customerId) ?? null
		: null;
	const weekId = getWeekId();
	const weekDates = useMemo(() => getDatesForWeek(weekId), [weekId]);
	const weekMenu = useMemo(() => {
		const next: WeekMenu = {};
		weekDates.forEach((date, index) => {
			const dayName = DAYS[index];
			const menu = menuByDate[date];
			if (menu) {
				next[dayName] = menu;
			}
		});
		return next;
	}, [menuByDate, weekDates]);

	const stats = useMemo(() => {
		const active = customers.filter(c => getDaysLeft(toDate(c.endDate)) >= 0).length;
		const expired = customers.filter(c => getDaysLeft(toDate(c.endDate)) < 0).length;
		const due = customers.filter(c => getDueAmount(c.pricePerMonth, c.totalPaid || 0) > 0).length;
		const pending = customers.reduce((sum, customer) => sum + getDueAmount(customer.pricePerMonth, customer.totalPaid || 0), 0);
		const lunch = customers.filter(c => c.mealsPerDay?.lunch !== false).length;
		const dinner = customers.filter(c => c.mealsPerDay?.dinner !== false).length;
		const expiring = customers.filter(c => {
			const days = getDaysLeft(toDate(c.endDate));
			return days >= 0 && days <= 3;
		}).length;

		return {
			total: customers.length,
			active,
			due,
			expired,
			expiring,
			pending,
			lunch,
			dinner,
		};
	}, [customers]);

	useEffect(() => {
		if (currentSheetRoute?.name === 'customer-detail' && selectedCustomer) {
			intelligenceSheetRef.current?.present();
		} else {
			intelligenceSheetRef.current?.dismiss();
		}
	}, [currentSheetRoute, selectedCustomer]);

	useEffect(() => {
		if (currentSheetRoute?.name === 'customer-form') {
			addCustomerSheetRef.current?.present();
		} else {
			addCustomerSheetRef.current?.dismiss();
		}
	}, [currentSheetRoute]);

	useEffect(() => {
		if (currentSheetRoute?.name === 'customer-stats') {
			statsSheetRef.current?.present();
		} else {
			statsSheetRef.current?.dismiss();
		}
	}, [currentSheetRoute]);

	const showAsyncError = (title: string, error: unknown) => {
		const message = error instanceof Error && error.message.trim() ? error.message.trim() : 'Please try again.';
		console.error(title, error);
		showToast({ type: 'error', title, message });
	};

	useFocusEffect(
		useCallback(() => {
			setHeaderConfig({
				title: 'Customers',
				subtitle: `${stats.active} active | ${stats.due} due today`,
				rightAction: (
					<View style={styles.headerActions}>
						<ScreenHeaderActionButton
							icon={BarChart3}
							onPress={() => openSheet({ name: 'customer-stats' })}
							accessibilityLabel="Open customer stats"
						/>
						<ScreenHeaderActionButton
							icon={UserPlus}
							onPress={() => openSheet({ name: 'customer-form', mode: 'add' })}
							accessibilityLabel="Add customer"
							variant="primary"
						/>
					</View>
				),
			});
		}, [openSheet, setHeaderConfig, stats.active, stats.due])
	);

	const handleAddCustomer = async (values: CustomerFormValues) => {
		if (!values.name.trim()) {
			showToast({ type: 'warning', title: 'Missing name', message: 'Please enter a customer name.' });
			return;
		}

		if (!values.isLunch && !values.isDinner) {
			showToast({ type: 'warning', title: 'Missing plan', message: 'Select at least one meal plan before saving.' });
			return;
		}

		const startDate = new Date(values.startDate);
		const endDate = new Date(values.endDate);

		if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
			showToast({ type: 'warning', title: 'Invalid dates', message: 'Use valid YYYY-MM-DD dates for the start and end fields.' });
			return;
		}

		setSavingCustomer(true);

		try {
			const payload = {
				id: editingCustomer ? editingCustomer.id : createLocalCustomerId(),
				name: values.name.trim(),
				phone: values.phone.trim(),
				address: {
					location: values.location.trim(),
					flat: values.flat.trim(),
				},
				mapLink: values.mapLink.trim() || '',
				mealsPerDay: { lunch: values.isLunch, dinner: values.isDinner },
				pricePerMonth: parseInt(values.price, 10) || 0,
				startDate,
				endDate,
				totalPaid: editingCustomer ? editingCustomer.totalPaid : 0,
				notes: values.notes.trim(),
				isActive: editingCustomer ? editingCustomer.isActive : true,
			};

			await saveCustomerOffline(payload);

			addCustomerSheetRef.current?.dismiss();
			showToast({
				type: 'success',
				title: editingCustomer ? 'Customer updated' : 'Customer saved',
				message: `${payload.name} is queued for sync.`
			});
		} catch (error) {
			showAsyncError('Could not add customer', error);
		} finally {
			setSavingCustomer(false);
		}
	};

	const handleDeleteCustomer = async (id: string) => {
		try {
			const customer = customers.find((entry) => entry.id === id);
			await queueDeleteCustomer(id, customer?.name);
		} catch (error) {
			showAsyncError('Could not remove customer', error);
		}
	};

	const handleDeleteCustomerRequest = async (customer: Customer) => {
		const confirmed = await confirm({
			title: 'Delete customer',
			message: `Remove ${customer.name} from customers?`,
			confirmLabel: 'Delete',
			tone: 'danger',
		});

		if (!confirmed) {
			return;
		}

		sheetController.close();
		await handleDeleteCustomer(customer.id);
	};

	const handleCustomerSheetEvent = (event: CustomerSheetEvent) => {
		if (event.type === 'customer.delete') {
			const customer = customers.find((entry) => entry.id === event.customerId);
			if (customer) {
				void handleDeleteCustomerRequest(customer);
			}
			return;
		}

		if (event.type === 'customer.edit') {
			sheetController.replaceAfterDismiss(
				{ name: 'customer-form', mode: 'edit', customerId: event.customerId },
				() => intelligenceSheetRef.current?.dismiss()
			);
			return;
		}

		intelligenceSheetRef.current?.dismiss();
	};

	const handleOpenAttendance = async (customerId: string) => {
		if (expandedId === customerId) {
			setExpandedId(null);
			return;
		}

		const attendance = emptyWeekAttendance();
		weekDates.forEach((date, index) => {
			const dayName = DAYS[index];
			const record = attendanceByDate[date]?.find((entry) => entry.customerId === customerId);
			if (!record) {
				return;
			}
			attendance[dayName] = {
				lunch: record.lunch ?? true,
				dinner: record.dinner ?? true,
			};
		});

		setWeekAttendance(attendance);
		setExpandedId(customerId);
	};

	const handleSaveAttendance = async (customerId: string) => {
		try {
			const customer = customers.find((entry) => entry.id === customerId);
			const records = weekDates.map((date, index) => {
				const dayName = DAYS[index];
				const selection = weekAttendance[dayName];
				return {
					id: `${date}_${customerId}`,
					customerId,
					name: customer?.name ?? '',
					date,
					lunch: selection.lunch,
					dinner: selection.dinner,
					updatedAt: new Date().toISOString(),
				};
			});

			await saveAttendanceBatch(
				records,
				customer?.name ? `Update ${customer.name}` : 'Update attendance',
				`${records.length} day records saved locally`
			);

			setExpandedId(null);
			showToast({ type: 'success', title: 'Attendance saved', message: `${records.length} day records updated locally.` });
		} catch (error) {
			showAsyncError('Could not save attendance', error);
		}
	};

	const toggleAttendance = (day: DayName, meal: 'lunch' | 'dinner') => {
		setWeekAttendance((current) => ({
			...current,
			[day]: {
				...current[day],
				[meal]: !current[day][meal],
			},
		}));
	};

	const normalizedSearchQuery = searchQuery.trim().toLowerCase();
	const searchMatchedCustomers = customers.filter((customer) => matchesCustomerSearch(customer, normalizedSearchQuery));
	const filteredCustomers = searchMatchedCustomers.filter((customer) => matchesCustomerFilter(customer, activeFilter));
	const showingText = `Showing ${filteredCustomers.length} of ${customers.length} customers`;
	const hasFiltersApplied = normalizedSearchQuery.length > 0 || activeFilter !== 'All';
	const animatedSearchStyle = {
		backgroundColor: searchFocusProgress.interpolate({
			inputRange: [0, 1],
			outputRange: [
				isDark ? 'rgba(21, 22, 27, 0.94)' : 'rgba(255, 255, 255, 0.72)',
				isDark ? 'rgba(32, 33, 39, 0.98)' : 'rgba(255, 255, 255, 0.92)',
			],
		}),
		borderColor: searchFocusProgress.interpolate({
			inputRange: [0, 1],
			outputRange: [
				isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(42, 30, 19, 0.07)',
				isDark ? 'rgba(255, 107, 53, 0.48)' : 'rgba(255, 107, 53, 0.34)',
			],
		}),
		shadowOpacity: searchFocusProgress.interpolate({
			inputRange: [0, 1],
			outputRange: [isDark ? 0.22 : 0.07, isDark ? 0.34 : 0.18],
		}),
		shadowRadius: searchFocusProgress.interpolate({
			inputRange: [0, 1],
			outputRange: [18, 26],
		}),
		transform: [
			{
				scale: searchFocusProgress.interpolate({
					inputRange: [0, 1],
					outputRange: [1, 1.01],
				}),
			},
		],
	};
	const resetFilters = () => {
		setSearchQuery('');
		setActiveFilter('All');
	};

	useEffect(() => {
		Animated.timing(searchFocusProgress, {
			toValue: searchFocused ? 1 : 0,
			duration: Theme.animation.duration.normal,
			useNativeDriver: false,
		}).start();
	}, [searchFocusProgress, searchFocused]);

	if (!ready) {
		return (
			<View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
				<ActivityIndicator size="large" color={colors.primary} />
				<Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading customers...</Text>
			</View>
		);
	}

	return (
		<Screen scrollable={false} maxContentWidth={maxReadableWidth} backgroundColor={colors.bg}>
			<FlatList
				data={filteredCustomers}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<CustomerCard
						customer={item}
						expanded={expandedId === item.id}
						weekId={weekId}
						weekAttendance={weekAttendance}
						weekMenu={weekMenu}
						onAvatarPress={(customer) => sheetController.open({ name: 'customer-detail', customerId: customer.id })}
						onDelete={handleDeleteCustomerRequest}
						onToggleExpanded={handleOpenAttendance}
						onToggleAttendance={toggleAttendance}
						onSaveAttendance={handleSaveAttendance}
					/>
				)}
				ListHeaderComponent={
					<View style={styles.listHeader}>
						<View style={styles.topSummaryRow}>
							<Text style={[styles.deckTitle, { color: colors.textPrimary }]}>Customers</Text>
							<Text style={[styles.deckEyebrow, { color: colors.textSecondary }]}>{stats.active} active • {stats.pending} pending</Text>
						</View>

						<Animated.View
							style={[
								styles.searchBar,
								animatedSearchStyle,
								{
									shadowColor: searchFocused ? colors.primary : '#000000',
								}
							]}
						>
							{Platform.OS !== 'web' ? (
								<BlurView
									intensity={Platform.OS === 'android' ? (isDark ? 42 : 82) : searchFocused ? (isDark ? 26 : 48) : (isDark ? 18 : 34)}
									tint={isDark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'}
									experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
									blurReductionFactor={Platform.OS === 'android' ? 1.7 : undefined}
									style={StyleSheet.absoluteFillObject}
								/>
							) : null}
							<View
								pointerEvents="none"
								style={[
									styles.searchSurfaceTint,
									{
										backgroundColor: isDark ? 'rgba(255, 255, 255, 0.018)' : 'rgba(255, 255, 255, 0.46)',
									},
								]}
							/>
							<View
								style={[
									styles.searchIconCell,
									{
										backgroundColor: searchFocused
											? colors.primary + (isDark ? '24' : '14')
											: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(142, 142, 147, 0.10)',
									},
								]}
							>
								<Search size={icon(18)} color={searchFocused ? colors.primary : colors.textMuted} strokeWidth={2.4} />
							</View>
							<TextInput
								style={[styles.searchInput, { color: colors.textPrimary }]}
								placeholder="Search name, phone, address"
								placeholderTextColor={searchFocused ? colors.textSecondary : colors.textMuted}
								value={searchQuery}
								onChangeText={setSearchQuery}
								onFocus={() => setSearchFocused(true)}
								onBlur={() => setSearchFocused(false)}
								autoCorrect={false}
							/>
							{normalizedSearchQuery ? (
								<TouchableOpacity
									onPress={() => setSearchQuery('')}
									style={[
										styles.clearButton,
										{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(142, 142, 147, 0.12)' },
									]}
									activeOpacity={0.8}
									accessibilityLabel="Clear customer search"
								>
									<X size={icon(14)} color={colors.textMuted} strokeWidth={2.6} />
								</TouchableOpacity>
							) : null}
							<View style={[styles.searchTrailingIcon, { borderLeftColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(142, 142, 147, 0.18)' }]}>
								<SlidersHorizontal size={icon(17)} color={searchFocused ? colors.primary : colors.textMuted} strokeWidth={2.3} />
							</View>
						</Animated.View>

						<View style={styles.feedMetaRow}>
							{hasFiltersApplied ? (
								<>
									<Text style={[styles.feedMetaText, { color: colors.textMuted }]}>{showingText}</Text>
									<TouchableOpacity onPress={resetFilters} activeOpacity={0.8}>
										<Text style={[styles.filterResetText, { color: colors.primary }]}>Reset</Text>
									</TouchableOpacity>
								</>
							) : (
								<Text style={[styles.feedMetaText, { color: colors.textMuted }]}>{customers.length} total customers</Text>
							)}
						</View>

						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.filterChipsContainer}
							decelerationRate="fast"
							directionalLockEnabled
							keyboardShouldPersistTaps="handled"
							overScrollMode="never"
						>
							{CUSTOMER_FILTERS.map((filter) => (
								<FilterChip
									key={filter}
									label={filter}
									active={activeFilter === filter}
									onPress={() => setActiveFilter(filter)}
								/>
							))}
						</ScrollView>
					</View>
				}
				contentContainerStyle={{
					paddingHorizontal: contentPadding,
					paddingBottom: scale(142, 0.92, 1.14),
					width: '100%',
					maxWidth: Math.min(maxContentWidth, maxReadableWidth),
					alignSelf: 'center',
				}}
				ListEmptyComponent={
					<View
						style={[
							styles.emptyStateCard,
							{
								backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : colors.surface,
								borderColor: isDark ? 'rgba(255, 255, 255, 0.09)' : colors.border,
							},
						]}
					>
						<Text style={[styles.emptyStateTitle, { color: colors.textPrimary, fontSize: font(17, 0.94, 1.08) }]}>No customers match this search</Text>
						<Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>Try a different name, phone number, or reset the active filters.</Text>
					</View>
				}
			/>

			<CustomerFormModal
				sheetRef={addCustomerSheetRef}
				onClose={sheetController.close}
				onSubmit={handleAddCustomer}
				submitting={savingCustomer}
				customer={editingCustomer}
			/>

			<PremiumBottomSheet
				ref={statsSheetRef}
				title="Customer Summary"
				subtitle="Live operating snapshot"
				snapPoints={['56%']}
				scrollable={false}
				policy="passive"
				onDismiss={sheetController.close}
			>
				<StatsSummarySheet stats={stats} />
			</PremiumBottomSheet>

			<PremiumBottomSheet
				ref={intelligenceSheetRef}
				title="Customer Record"
				subtitle="Operational details"
				policy="operational"
				onDismiss={() => {
					if (!sheetController.consumeReplacement()) {
						sheetController.close();
					}
				}}
			>
				{selectedCustomer ? (
					<CustomerIntelligenceDetail
						customer={selectedCustomer}
						daysLeft={getDaysLeft(toDate(selectedCustomer.endDate))}
						dueAmount={getDueAmount(selectedCustomer.pricePerMonth, selectedCustomer.totalPaid || 0)}
						onAction={handleCustomerSheetEvent}
					/>
				) : null}
			</PremiumBottomSheet>
		</Screen>
	);
}

function createLocalCustomerId() {
	localCustomerCounter += 1;
	return `customer-${Date.now()}-${localCustomerCounter}`;
}

function StatsSummarySheet({
	stats,
}: {
	stats: {
		total: number;
		active: number;
		due: number;
		expired: number;
		expiring: number;
		pending: number;
		lunch: number;
		dinner: number;
	};
}) {
	const { colors } = useAppTheme();

	return (
		<View style={styles.statsSheet}>
			<LayeredSurface
				radius={24}
				contentStyle={styles.statsHeroRow}
				borderColor={colors.primary + '18'}
				tintColor={colors.primary + '08'}
				shadowColor="rgba(255, 107, 53, 0.16)"
				distance={12}
			>
				<View>
					<Text style={[styles.statsHeroLabel, { color: colors.textMuted }]}>Pending revenue</Text>
					<Text style={[styles.statsHeroValue, { color: colors.textPrimary }]}>DHS {stats.pending}</Text>
				</View>
				<View style={[styles.statsHeroBadge, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '26' }]}>
					<View style={[styles.statsHeroDot, { backgroundColor: colors.primary }]} />
					<Text style={[styles.statsHeroBadgeText, { color: colors.primary }]}>{stats.due} due</Text>
				</View>
			</LayeredSurface>

			<StatsSection
				title="Financial"
				accent={colors.primary}
				items={[
					{ label: 'Due today', value: stats.due.toString(), tone: colors.warning },
					{ label: 'Settled active', value: Math.max(stats.active - stats.due, 0).toString(), tone: colors.success },
				]}
			/>

			<StatsSection
				title="Operations"
				accent={colors.success}
				items={[
					{ label: 'Active', value: stats.active.toString(), tone: colors.success },
					{ label: 'Expiring', value: stats.expiring.toString(), tone: colors.warning },
					{ label: 'Expired', value: stats.expired.toString(), tone: colors.danger },
					{ label: 'Total ledger', value: stats.total.toString(), tone: colors.textSecondary },
				]}
			/>

			<StatsSection
				title="Meal Load"
				accent={colors.mealDinner}
				items={[
					{ label: 'Lunch', value: stats.lunch.toString(), tone: colors.mealLunch },
					{ label: 'Dinner', value: stats.dinner.toString(), tone: colors.mealDinner },
				]}
			/>
		</View>
	);
}

function StatsSection({
	title,
	accent,
	items,
}: {
	title: string;
	accent: string;
	items: { label: string; value: string; tone: string }[];
}) {
	const { colors } = useAppTheme();

	return (
		<LayeredSurface
			radius={22}
			contentStyle={styles.statsSection}
			surfaceColor={colors.surfaceElevated}
			borderColor={colors.border}
			tintColor={accent + '08'}
			shadowColor="rgba(32, 24, 18, 0.10)"
			distance={10}
		>
			<View style={styles.statsSectionHeader}>
				<View style={[styles.statsSectionIndicator, { backgroundColor: accent + '18' }]}>
					<View style={[styles.statsSectionIndicatorCore, { backgroundColor: accent }]} />
				</View>
				<Text style={[styles.statsSectionTitle, { color: colors.textSecondary }]}>{title}</Text>
			</View>
			<View style={styles.statsMetricGrid}>
				{items.map((item) => (
					<StatsMetric key={`${title}-${item.label}`} {...item} />
				))}
			</View>
		</LayeredSurface>
	);
}

function StatsMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
	const { colors } = useAppTheme();

	return (
		<View style={[styles.statsMetric, { backgroundColor: colors.surface, borderColor: tone + '18' }]}>
			<View style={[styles.statsMetricMarker, { backgroundColor: tone + '18' }]}>
				<View style={[styles.statsMetricMarkerCore, { backgroundColor: tone }]} />
			</View>
			<Text style={[styles.statsMetricValue, { color: tone }]}>{value}</Text>
			<Text style={[styles.statsMetricLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	loadingText: {
		...Theme.typography.labelMedium,
		marginTop: Theme.spacing.md,
	},
	headerActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	listHeader: {
		paddingTop: Theme.spacing.xs,
		paddingBottom: Theme.spacing.md,
	},
	controlDeck: {
		padding: Theme.spacing.md,
	},
	deckHeaderRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
		marginBottom: Theme.spacing.md,
	},
	topSummaryRow: {
		marginBottom: Theme.spacing.md,
		paddingHorizontal: 4,
	},
	deckTitle: {
		fontSize: 24,
		fontWeight: '800',
		letterSpacing: -0.5,
	},
	deckEyebrow: {
		...Theme.typography.detailBold,
		fontSize: 13,
		marginTop: 2,
	},
	searchBar: {
		flexDirection: 'row',
		alignItems: 'center',
		height: 56,
		paddingLeft: 7,
		paddingRight: 8,
		gap: 9,
		borderWidth: 1,
		borderRadius: 18,
		overflow: 'hidden',
		shadowColor: '#000000',
		shadowOpacity: 0.08,
		shadowRadius: 18,
		shadowOffset: { width: 0, height: 6 },
		elevation: 4,
		marginBottom: Theme.spacing.md,
	},
	searchSurfaceTint: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(255, 255, 255, 0.46)',
	},
	searchIconCell: {
		width: 34,
		height: 34,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	searchInput: {
		flex: 1,
		...Theme.typography.labelMedium,
		fontSize: 15,
		fontWeight: '800',
		letterSpacing: 0,
		paddingVertical: 0,
		includeFontPadding: false,
		minWidth: 0,
	},
	clearButton: {
		width: 28,
		height: 28,
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(142, 142, 147, 0.12)',
	},
	clearButtonText: {
		...Theme.typography.detailBold,
	},
	searchTrailingIcon: {
		height: 28,
		width: 34,
		borderLeftWidth: 1,
		alignItems: 'flex-end',
		justifyContent: 'center',
	},
	feedMetaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: Theme.spacing.sm,
		minHeight: 20,
	},
	feedMetaText: {
		...Theme.typography.detail,
	},
	filterResetText: {
		...Theme.typography.detailBold,
	},
	filterChipsContainer: {
		flexDirection: 'row',
		gap: 7,
		paddingTop: 3,
		paddingBottom: 9,
		paddingHorizontal: 16,
	},
	filterChipMotion: {
		height: 31,
		minWidth: 54,
		borderWidth: 1,
		borderRadius: 999,
		shadowColor: '#C85B2F',
		shadowOffset: { width: 0, height: 7 },
		elevation: 2,
	},
	filterChipHighlight: {
		position: 'absolute',
		top: 1,
		left: 2,
		right: 2,
		height: 12,
		borderRadius: 999,
		backgroundColor: '#FFFFFF',
	},
	filterChipPressable: {
		height: '100%',
		minWidth: 54,
		paddingHorizontal: 13,
		alignItems: 'center',
		justifyContent: 'center',
	},
	filterChipText: {
		...Theme.typography.detailBold,
		fontSize: 11,
		letterSpacing: 0,
		lineHeight: 14,
	},
	miniStatsRow: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
		marginTop: 2,
	},
	miniStat: {
		flex: 1,
		borderRadius: 16,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
	},
	miniStatValue: {
		fontSize: 18,
		fontWeight: '900',
		letterSpacing: -0.4,
	},
	miniStatLabel: {
		...Theme.typography.detailBold,
		fontSize: 10,
		marginTop: 2,
	},
	emptyStateCard: {
		marginTop: Theme.spacing.huge,
		borderWidth: 1,
		borderRadius: 30,
		paddingHorizontal: Theme.spacing.xl,
		paddingVertical: Theme.spacing.huge,
		alignItems: 'center',
	},
	emptyStateTitle: {
		...Theme.typography.labelMedium,
		textAlign: 'center',
		fontWeight: '800',
	},
	emptyStateSubtitle: {
		...Theme.typography.detail,
		textAlign: 'center',
		marginTop: Theme.spacing.sm,
		fontSize: 13,
		maxWidth: 280,
	},
	statsSheet: {
		gap: Theme.spacing.md,
	},
	statsHeroRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.lg,
	},
	statsHeroLabel: {
		...Theme.typography.detailBold,
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	statsHeroValue: {
		fontSize: 30,
		fontWeight: '900',
		letterSpacing: -0.6,
		marginTop: 3,
	},
	statsHeroBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 7,
		borderWidth: 1,
		borderRadius: 999,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: 8,
	},
	statsHeroDot: {
		width: 7,
		height: 7,
		borderRadius: 999,
	},
	statsHeroBadgeText: {
		...Theme.typography.detailBold,
		fontSize: 11,
	},
	statsSection: {
		padding: Theme.spacing.md,
		gap: Theme.spacing.sm,
	},
	statsSectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		minHeight: 22,
	},
	statsSectionIndicator: {
		width: 20,
		height: 20,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
	statsSectionIndicatorCore: {
		width: 7,
		height: 7,
		borderRadius: 999,
	},
	statsSectionTitle: {
		...Theme.typography.detailBold,
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 0.65,
	},
	statsMetricGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: Theme.spacing.sm,
	},
	statsMetric: {
		flexGrow: 1,
		flexBasis: '47%',
		minHeight: 78,
		borderWidth: 1,
		borderRadius: 18,
		padding: Theme.spacing.md,
		justifyContent: 'space-between',
	},
	statsMetricMarker: {
		width: 20,
		height: 20,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 2,
	},
	statsMetricMarkerCore: {
		width: 7,
		height: 7,
		borderRadius: 999,
	},
	statsMetricValue: {
		fontSize: 21,
		fontWeight: '900',
		letterSpacing: -0.35,
	},
	statsMetricLabel: {
		...Theme.typography.detailBold,
		fontSize: 10,
		letterSpacing: 0,
		marginTop: 2,
	},
});
