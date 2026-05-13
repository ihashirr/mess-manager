import { ActivityIndicator, Animated, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import { BarChart3, Search, SlidersHorizontal, UserPlus, X, MoreVertical } from 'lucide-react-native';
import AnimatedReanimated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useConfirmDialog } from '../components/system/dialogs/ConfirmDialog';
import { showToast } from '../components/system/feedback/AppToast';
import {
	CustomerIntelligenceDetail,
	LayeredSurface,
	PremiumBottomSheet,
	Screen,
	ScreenHeaderActionButton,
	type CustomerSheetEvent,
	type OperationalSheetRoute,
	type PremiumBottomSheetHandle,
} from '../components/ui';
import { CustomerCard } from '../components/customers/CustomerCard';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { type Customer, type CustomerFormValues } from '../types';
import { Theme } from '../constants/Theme';
import { useAppHeader } from '../context/HeaderContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { useAppTheme } from '../context/ThemeModeContext';
import { useOperationalSheetController, useResponsiveLayout } from '../hooks';
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
	const { contentPadding, maxContentWidth, maxReadableWidth, scale, font, icon, isCompact } = useResponsiveLayout();
	const [savingCustomer, setSavingCustomer] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const intelligenceSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const addCustomerSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const statsSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const optionsSheetRef = useRef<PremiumBottomSheetHandle>(null);
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
				rightAction: (
					<View style={[styles.headerActions, { gap: isCompact ? 4 : 8 }]}>
						{!isCompact && (
							<ScreenHeaderActionButton
								icon={BarChart3}
								onPress={() => openSheet({ name: 'customer-stats' })}
								accessibilityLabel="Open customer stats"
							/>
						)}
						<ScreenHeaderActionButton
							icon={UserPlus}
							onPress={() => openSheet({ name: 'customer-form', mode: 'add' })}
							accessibilityLabel="Add customer"
							variant="primary"
						/>
						{isCompact && (
							<ScreenHeaderActionButton
								icon={MoreVertical}
								onPress={() => optionsSheetRef.current?.present()}
								accessibilityLabel="More options"
							/>
						)}
					</View>
				),
			});
		}, [openSheet, setHeaderConfig, isCompact])
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
				renderItem={({ item, index }) => (
					<AnimatedReanimated.View entering={FadeInUp.delay(Math.min(index, 12) * 60).springify().damping(18).stiffness(200)}>
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
					</AnimatedReanimated.View>
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
				snapPoints={['70%', '95%']}
				scrollable={true}
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

			<PremiumBottomSheet
				ref={optionsSheetRef}
				title="Options"
				subtitle="Manage customers"
				snapPoints={['35%']}
				policy="passive"
			>
				<View style={{ padding: 20, gap: 12 }}>
					<Pressable
						style={[styles.financePill, { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 16 }]}
						onPress={() => {
							optionsSheetRef.current?.dismiss();
							setTimeout(() => openSheet({ name: 'customer-stats' }), 300);
						}}
					>
						<BarChart3 size={24} color={colors.primary} />
						<Text style={[styles.opListLabel, { color: colors.textPrimary }]}>View Stats Dashboard</Text>
					</Pressable>
				</View>
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
	const { font, scale } = useResponsiveLayout();

	return (
		<View style={styles.statsSheet}>
			{/* Master Hero Card */}
			<AnimatedReanimated.View entering={FadeInUp.delay(100).springify().damping(18).stiffness(200)}>
				<View style={[styles.masterHeroCard, { backgroundColor: colors.primary, borderRadius: scale(24, 0.9, 1.1), padding: scale(Theme.spacing.xl, 0.85, 1.15) }]}>
					<Text style={[styles.heroCardEyebrow, { color: 'rgba(255,255,255,0.7)', fontSize: font(12, 0.9, 1.1) }]}>PENDING REVENUE</Text>
					<Text style={[styles.heroCardValue, { color: '#FFF', fontSize: font(42, 0.85, 1.2) }]}>DHS {stats.pending}</Text>
					<View style={styles.heroCardFooter}>
						<View style={[styles.heroCardBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
							<Text style={[styles.heroCardBadgeText, { color: '#FFF', fontSize: font(11, 0.9, 1.1) }]}>{stats.due} accounts due</Text>
						</View>
						<Text style={[styles.heroCardSub, { color: 'rgba(255,255,255,0.8)', fontSize: font(13, 0.9, 1.1) }]}>{stats.total} total ledger</Text>
					</View>
				</View>
			</AnimatedReanimated.View>

			{/* Financial Health Row */}
			<AnimatedReanimated.View entering={FadeInUp.delay(200).springify().damping(18).stiffness(200)}>
				<Text style={[styles.dashboardSectionTitle, { color: colors.textSecondary, fontSize: font(11, 0.9, 1.1) }]}>FINANCIAL HEALTH</Text>
				<View style={styles.financialRow}>
					<View style={[styles.financePill, { backgroundColor: colors.surfaceElevated, padding: scale(Theme.spacing.md, 0.9, 1.1), borderRadius: scale(20, 0.9, 1.1) }]}>
						<MaterialCommunityIcons name="cash-multiple" size={font(24, 0.9, 1.2)} color={colors.warning} />
						<View style={styles.financePillContent}>
							<Text style={[styles.financePillValue, { color: colors.warning, fontSize: font(22, 0.9, 1.15) }]}>{stats.due}</Text>
							<Text style={[styles.financePillLabel, { color: colors.textMuted, fontSize: font(10, 0.9, 1.1) }]}>Due Today</Text>
						</View>
					</View>
					<View style={[styles.financePill, { backgroundColor: colors.surfaceElevated, padding: scale(Theme.spacing.md, 0.9, 1.1), borderRadius: scale(20, 0.9, 1.1) }]}>
						<MaterialCommunityIcons name="check-decagram" size={font(24, 0.9, 1.2)} color={colors.success} />
						<View style={styles.financePillContent}>
							<Text style={[styles.financePillValue, { color: colors.success, fontSize: font(22, 0.9, 1.15) }]}>{Math.max(stats.active - stats.due, 0)}</Text>
							<Text style={[styles.financePillLabel, { color: colors.textMuted, fontSize: font(10, 0.9, 1.1) }]}>Settled Active</Text>
						</View>
					</View>
				</View>
			</AnimatedReanimated.View>

			{/* Operational Status */}
			<AnimatedReanimated.View entering={FadeInUp.delay(300).springify().damping(18).stiffness(200)}>
				<Text style={[styles.dashboardSectionTitle, { color: colors.textSecondary, fontSize: font(11, 0.9, 1.1) }]}>OPERATIONAL STATUS</Text>
				<View style={[styles.operationsList, { backgroundColor: colors.surfaceElevated, borderRadius: scale(24, 0.9, 1.1), paddingHorizontal: scale(Theme.spacing.lg, 0.9, 1.1) }]}>
					<View style={[styles.operationListItem, { paddingVertical: scale(Theme.spacing.md, 0.9, 1.1) }]}>
						<View style={[styles.opIconWrap, { backgroundColor: colors.success + '18', width: scale(32), height: scale(32), borderRadius: scale(16) }]}>
							<FontAwesome name="check" size={font(14, 0.9, 1.2)} color={colors.success} />
						</View>
						<Text style={[styles.opListLabel, { color: colors.textPrimary, fontSize: font(15, 0.9, 1.15) }]}>Active subscriptions</Text>
						<Text style={[styles.opListValue, { color: colors.success, fontSize: font(18, 0.9, 1.15) }]}>{stats.active}</Text>
					</View>
					<View style={[styles.opDivider, { backgroundColor: colors.border, marginLeft: scale(48) }]} />
					<View style={[styles.operationListItem, { paddingVertical: scale(Theme.spacing.md, 0.9, 1.1) }]}>
						<View style={[styles.opIconWrap, { backgroundColor: colors.warning + '18', width: scale(32), height: scale(32), borderRadius: scale(16) }]}>
							<FontAwesome name="clock-o" size={font(14, 0.9, 1.2)} color={colors.warning} />
						</View>
						<Text style={[styles.opListLabel, { color: colors.textPrimary, fontSize: font(15, 0.9, 1.15) }]}>Expiring soon</Text>
						<Text style={[styles.opListValue, { color: colors.warning, fontSize: font(18, 0.9, 1.15) }]}>{stats.expiring}</Text>
					</View>
					<View style={[styles.opDivider, { backgroundColor: colors.border, marginLeft: scale(48) }]} />
					<View style={[styles.operationListItem, { paddingVertical: scale(Theme.spacing.md, 0.9, 1.1) }]}>
						<View style={[styles.opIconWrap, { backgroundColor: colors.danger + '18', width: scale(32), height: scale(32), borderRadius: scale(16) }]}>
							<FontAwesome name="exclamation" size={font(14, 0.9, 1.2)} color={colors.danger} />
						</View>
						<Text style={[styles.opListLabel, { color: colors.textPrimary, fontSize: font(15, 0.9, 1.15) }]}>Expired accounts</Text>
						<Text style={[styles.opListValue, { color: colors.danger, fontSize: font(18, 0.9, 1.15) }]}>{stats.expired}</Text>
					</View>
				</View>
			</AnimatedReanimated.View>

			{/* Meal Load Segmented Bar */}
			<AnimatedReanimated.View entering={FadeInUp.delay(400).springify().damping(18).stiffness(200)}>
				<Text style={[styles.dashboardSectionTitle, { color: colors.textSecondary, fontSize: font(11, 0.9, 1.1) }]}>MEAL DISTRIBUTION</Text>
				<View style={[styles.mealDistributionCard, { backgroundColor: colors.surfaceElevated, borderRadius: scale(24, 0.9, 1.1), padding: scale(Theme.spacing.lg, 0.9, 1.1) }]}>
					<View style={styles.mealLabels}>
						<View>
							<Text style={[styles.mealLabelText, { color: colors.textPrimary, fontSize: font(15, 0.9, 1.15) }]}>Lunch</Text>
							<Text style={[styles.mealValueText, { color: colors.mealLunch, fontSize: font(24, 0.9, 1.15) }]}>{stats.lunch}</Text>
						</View>
						<View style={{ alignItems: 'flex-end' }}>
							<Text style={[styles.mealLabelText, { color: colors.textPrimary, fontSize: font(15, 0.9, 1.15) }]}>Dinner</Text>
							<Text style={[styles.mealValueText, { color: colors.mealDinner, fontSize: font(24, 0.9, 1.15) }]}>{stats.dinner}</Text>
						</View>
					</View>
					<View style={[styles.mealBarTrack, { height: scale(12, 0.8, 1.5) }]}>
						{stats.lunch + stats.dinner > 0 ? (
							<>
								<View style={[styles.mealBarFill, { backgroundColor: colors.mealLunch, flex: stats.lunch, borderTopLeftRadius: 99, borderBottomLeftRadius: 99, marginRight: 2 }]} />
								<View style={[styles.mealBarFill, { backgroundColor: colors.mealDinner, flex: stats.dinner, borderTopRightRadius: 99, borderBottomRightRadius: 99 }]} />
							</>
						) : (
							<View style={[styles.mealBarFill, { backgroundColor: colors.border, flex: 1, borderRadius: 99 }]} />
						)}
					</View>
				</View>
			</AnimatedReanimated.View>
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
	masterHeroCard: {
		borderRadius: 24,
		padding: Theme.spacing.xl,
		marginBottom: Theme.spacing.md,
		shadowColor: Theme.colors.primary,
		shadowOffset: { width: 0, height: 12 },
		shadowOpacity: 0.35,
		shadowRadius: 24,
		elevation: 12,
	},
	heroCardEyebrow: {
		...Theme.typography.detailBold,
		fontSize: 12,
		letterSpacing: 1,
	},
	heroCardValue: {
		fontSize: 42,
		fontWeight: '900',
		letterSpacing: -1,
		marginTop: 4,
		marginBottom: Theme.spacing.lg,
	},
	heroCardFooter: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	heroCardBadge: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 99,
	},
	heroCardBadgeText: {
		...Theme.typography.detailBold,
		fontSize: 11,
	},
	heroCardSub: {
		...Theme.typography.detail,
		fontSize: 13,
	},
	dashboardSectionTitle: {
		...Theme.typography.detailBold,
		fontSize: 11,
		letterSpacing: 1,
		marginBottom: Theme.spacing.sm,
		marginLeft: 4,
		marginTop: Theme.spacing.sm,
	},
	financialRow: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
		marginBottom: Theme.spacing.md,
	},
	financePill: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		padding: Theme.spacing.md,
		borderRadius: 20,
		gap: Theme.spacing.md,
	},
	financePillContent: {
		flex: 1,
	},
	financePillValue: {
		fontSize: 22,
		fontWeight: '800',
		letterSpacing: -0.5,
	},
	financePillLabel: {
		...Theme.typography.detailBold,
		fontSize: 10,
		marginTop: 2,
	},
	operationsList: {
		borderRadius: 24,
		paddingHorizontal: Theme.spacing.lg,
		marginBottom: Theme.spacing.md,
	},
	operationListItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: Theme.spacing.md,
		gap: Theme.spacing.md,
	},
	opIconWrap: {
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	opListLabel: {
		flex: 1,
		fontSize: 15,
		fontWeight: '600',
	},
	opListValue: {
		fontSize: 18,
		fontWeight: '800',
	},
	opDivider: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 48,
	},
	mealDistributionCard: {
		borderRadius: 24,
		padding: Theme.spacing.lg,
		marginBottom: Theme.spacing.xl,
	},
	mealLabels: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: Theme.spacing.md,
	},
	mealLabelText: {
		fontSize: 15,
		fontWeight: '700',
	},
	mealValueText: {
		fontSize: 24,
		fontWeight: '900',
		letterSpacing: -0.5,
	},
	mealBarTrack: {
		height: 12,
		flexDirection: 'row',
		borderRadius: 99,
		overflow: 'hidden',
	},
	mealBarFill: {
		height: '100%',
	},
});
