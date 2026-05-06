import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { deleteDoc, doc, getDoc, onSnapshot, query, setDoc, where, collection, addDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { UserPlus, Search, Users, CheckCircle2, XCircle, Clock, Sun, Moon, LucideIcon, Sparkles } from 'lucide-react-native';
import { PremiumBottomSheet, type PremiumBottomSheetHandle } from '../components/ui/PremiumBottomSheet';
import { CustomerIntelligenceDetail } from '../components/ui/CustomerIntelligenceDetail';
import { Screen } from '../components/ui/Screen';
import { ScreenHeaderActionButton } from '../components/ui/ScreenHeader';
import { useResponsiveLayout } from '../components/ui/useResponsiveLayout';
import { CustomerCard } from '../components/customers/CustomerCard';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { type Customer, type CustomerFormValues } from '../components/customers/types';
import { Theme } from '../constants/Theme';
import { useAppHeader } from '../context/HeaderContext';
import { useAppTheme } from '../context/ThemeModeContext';
import { db } from '../firebase/config';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { getFirestoreErrorMessage, isFirestorePermissionDenied } from '../utils/firestoreErrors';
import { normalizeDayMenu, type WeekMenu } from '../utils/menuLogic';
import { DAYS, type DayName, emptyWeekAttendance, getDatesForWeek, getWeekId } from '../utils/weekLogic';

type CustomerFilter = 'All' | 'Active' | 'Expired' | 'Lunch' | 'Dinner';

const CUSTOMER_FILTERS: CustomerFilter[] = ['All', 'Active', 'Expired', 'Lunch', 'Dinner'];

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

export default function CustomersScreen() {
	const { colors } = useAppTheme();
	const { setHeaderConfig } = useAppHeader();
	const { contentPadding, maxContentWidth, maxReadableWidth, scale, font, icon } = useResponsiveLayout();
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [loading, setLoading] = useState(true);
	const [savingCustomer, setSavingCustomer] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
	const intelligenceSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const addCustomerSheetRef = useRef<PremiumBottomSheetHandle>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [activeFilter, setActiveFilter] = useState<CustomerFilter>('All');
	const [weekAttendance, setWeekAttendance] = useState<Record<DayName, { lunch: boolean; dinner: boolean }>>(emptyWeekAttendance());
	const [weekMenu, setWeekMenu] = useState<WeekMenu>({});
	const weekId = getWeekId();
	const [firestoreAlertShown, setFirestoreAlertShown] = useState(false);

	useEffect(() => {
		if (selectedCustomer) {
			intelligenceSheetRef.current?.present();
		} else {
			intelligenceSheetRef.current?.dismiss();
		}
	}, [selectedCustomer]);

	const showAsyncError = (title: string, error: unknown) => {
		const message = error instanceof Error ? error.message : 'Please try again.';
		console.error(title, error);
		Alert.alert(title, message);
	};

	const handleSnapshotError = useCallback((context: string, error: unknown) => {
		if (!isFirestorePermissionDenied(error)) {
			console.error(`Firestore ${context} listener failed:`, error);
		}
		setLoading(false);
		if (!firestoreAlertShown) {
			setFirestoreAlertShown(true);
			Alert.alert('Firestore access failed', getFirestoreErrorMessage(error, `Could not load ${context}.`));
		}
	}, [firestoreAlertShown]);

	useFocusEffect(
		useCallback(() => {
			setHeaderConfig({
				title: 'Customers',
				subtitle: 'Manage plans, renewals & attendance',
				rightAction: (
					<View style={styles.headerRight}>
						<ScreenHeaderActionButton
							icon={UserPlus}
							onPress={() => addCustomerSheetRef.current?.present()}
							accessibilityLabel="Add customer"
							variant="primary"
						/>
					</View>
				),
			});
		}, [setHeaderConfig])
	);

	useEffect(() => {
		const customerQuery = query(collection(db, 'customers'), where('isActive', '==', true));

		const unsubscribe = onSnapshot(
			customerQuery,
			(querySnapshot) => {
				const customersArray: Customer[] = [];
				querySnapshot.forEach((customerDoc) => {
					customersArray.push({ id: customerDoc.id, ...customerDoc.data() } as Customer);
				});
				setCustomers(customersArray);
				setLoading(false);
			},
			(error) => handleSnapshotError('customers', error)
		);

		return () => unsubscribe();
	}, [handleSnapshotError]);

	useEffect(() => {
		const dates = getDatesForWeek(weekId);

		const unsubscribeList = dates.map((date, index) => {
			const dayName = DAYS[index];
			return onSnapshot(
				doc(db, 'menu', date),
				(snapshot) => {
					const data = snapshot.exists() ? snapshot.data() : {};
					setWeekMenu((current) => ({
						...current,
						[dayName]: normalizeDayMenu(data),
					}));
				},
				(error) => handleSnapshotError(`menu for ${dayName}`, error)
			);
		});

		return () => unsubscribeList.forEach((unsubscribe) => unsubscribe());
	}, [weekId, handleSnapshotError]);

	const handleAddCustomer = async (values: CustomerFormValues) => {
		if (!values.name.trim()) {
			Alert.alert('Missing name', 'Please enter a customer name.');
			return;
		}

		if (!values.isLunch && !values.isDinner) {
			Alert.alert('Missing plan', 'Select at least one meal plan before saving.');
			return;
		}

		const startDate = new Date(values.startDate);
		const endDate = new Date(values.endDate);

		if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
			Alert.alert('Invalid dates', 'Use valid YYYY-MM-DD dates for the start and end fields.');
			return;
		}

		setSavingCustomer(true);

		try {
			const payload = {
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
				totalPaid: 0,
				notes: values.notes.trim(),
				isActive: true,
			};

			await addDoc(collection(db, 'customers'), payload);

			addCustomerSheetRef.current?.dismiss();
		} catch (error) {
			showAsyncError('Could not add customer', error);
		} finally {
			setSavingCustomer(false);
		}
	};

	const handleDeleteCustomer = async (id: string) => {
		try {
			await deleteDoc(doc(db, 'customers', id));
		} catch (error) {
			showAsyncError('Could not remove customer', error);
		}
	};

	const handleDeleteCustomerRequest = (customer: Customer) => {
		Alert.alert(
			'Delete customer',
			`Remove ${customer.name} from customers?`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						setSelectedCustomer(null);
						await handleDeleteCustomer(customer.id);
					},
				},
			]
		);
	};

	const handleOpenAttendance = async (customerId: string) => {
		if (expandedId === customerId) {
			setExpandedId(null);
			return;
		}

		const dates = getDatesForWeek(weekId);
		const attendance = emptyWeekAttendance();

		try {
			const snapshots = await Promise.all(
				dates.map((date) => getDoc(doc(db, 'attendance', `${date}_${customerId}`)))
			);

			snapshots.forEach((snapshot, index) => {
				if (!snapshot.exists()) {
					return;
				}

				const dayName = DAYS[index];
				attendance[dayName] = {
					lunch: snapshot.data().lunch ?? true,
					dinner: snapshot.data().dinner ?? true,
				};
			});
		} catch (error) {
			setWeekAttendance(emptyWeekAttendance());
			showAsyncError('Could not load attendance', error);
			return;
		}

		setWeekAttendance(attendance);
		setExpandedId(customerId);
	};

	const handleSaveAttendance = async (customerId: string) => {
		const dates = getDatesForWeek(weekId);

		try {
			await Promise.all(
				dates.map((date, index) => {
					const dayName = DAYS[index];
					const selection = weekAttendance[dayName];
					return setDoc(
						doc(db, 'attendance', `${date}_${customerId}`),
						{
							customerId,
							date,
							lunch: selection.lunch,
							dinner: selection.dinner,
							updatedAt: new Date().toISOString(),
						},
						{ merge: true }
					);
				})
			);

			setExpandedId(null);
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

	const stats = {
		total: customers.length,
		active: customers.filter(c => getDaysLeft(toDate(c.endDate)) >= 0).length,
		expired: customers.filter(c => getDaysLeft(toDate(c.endDate)) < 0).length,
		expiring: customers.filter(c => {
			const days = getDaysLeft(toDate(c.endDate));
			return days >= 0 && days <= 3;
		}).length,
	};

	const normalizedSearchQuery = searchQuery.trim().toLowerCase();
	const searchMatchedCustomers = customers.filter((customer) => matchesCustomerSearch(customer, normalizedSearchQuery));
	const filteredCustomers = searchMatchedCustomers.filter((customer) => matchesCustomerFilter(customer, activeFilter));
	const filterCounts = Object.fromEntries(
		CUSTOMER_FILTERS.map((filter) => [
			filter,
			searchMatchedCustomers.filter((customer) => matchesCustomerFilter(customer, filter)).length,
		])
	) as Record<CustomerFilter, number>;
	const showingText = `Showing ${filteredCustomers.length} of ${customers.length} customers`;
	const hasFiltersApplied = normalizedSearchQuery.length > 0 || activeFilter !== 'All';
	const resetFilters = () => {
		setSearchQuery('');
		setActiveFilter('All');
	};

	if (loading) {
		return (
			<View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
				<ActivityIndicator size="large" color={colors.primary} />
				<Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading customers...</Text>
			</View>
		);
	}

	return (
		<Screen scrollable={false} maxContentWidth={maxReadableWidth}>
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
						onAvatarPress={setSelectedCustomer}
						onDelete={handleDeleteCustomer}
						onToggleExpanded={handleOpenAttendance}
						onToggleAttendance={toggleAttendance}
						onSaveAttendance={handleSaveAttendance}
					/>
				)}
				ListHeaderComponent={
					<View style={styles.listHeader}>
						<View style={[styles.overviewPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
							<View style={styles.overviewTopRow}>
								<View style={styles.overviewCopy}>
									<View style={[styles.overviewIconWrap, { backgroundColor: colors.primary + '12' }]}>
										<Sparkles size={16} color={colors.primary} />
									</View>
									<View style={styles.overviewTextBlock}>
										<Text style={[styles.overviewEyebrow, { color: colors.textSecondary }]}>Customer ledger</Text>
										<Text style={[styles.overviewTitle, { color: colors.textPrimary }]}>Plans, dues, and attendance in one clean list</Text>
										<Text style={[styles.overviewSubtitle, { color: colors.textSecondary }]}>{showingText}</Text>
									</View>
								</View>
								<View style={[styles.overviewCountPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
									<Users size={14} color={colors.primary} />
									<Text style={[styles.overviewCountText, { color: colors.textPrimary }]}>{stats.active} active</Text>
								</View>
							</View>
							<View style={styles.statsContainer}>
								<StatPill icon={Users} label="Total" count={stats.total} color={colors.textPrimary} />
								<StatPill icon={CheckCircle2} label="Active" count={stats.active} color={colors.success} />
								<StatPill icon={XCircle} label="Expired" count={stats.expired} color={colors.danger} />
								<StatPill icon={Clock} label="Expiring soon" count={stats.expiring} color={colors.warning} />
							</View>
						</View>

						<View
							style={[
								styles.searchShell,
								{
									backgroundColor: colors.surface,
									borderColor: colors.border,
								}
							]}
						>
							<View style={styles.searchHeaderRow}>
								<View style={styles.searchHeaderCopy}>
									<View style={[styles.searchIconWrap, { backgroundColor: colors.primary + '10' }]}>
										<Search size={icon(16)} color={colors.primary} />
									</View>
									<View>
										<Text style={[styles.searchTitle, { color: colors.textPrimary }]}>Find the right customer fast</Text>
										<Text style={[styles.searchSubtitle, { color: colors.textSecondary }]}>Search by name, phone, building, or flat number.</Text>
									</View>
								</View>
								<View style={[styles.searchCountPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
									<Text style={[styles.searchCountText, { color: colors.textSecondary }]}>{showingText}</Text>
								</View>
							</View>

							<View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
								<Search size={icon(18)} color={colors.textMuted} />
								<TextInput
									style={[styles.searchInput, { color: colors.textPrimary }]}
									placeholder="Type a customer name or number"
									placeholderTextColor={colors.textMuted}
									value={searchQuery}
									onChangeText={setSearchQuery}
									autoCorrect={false}
								/>
								{normalizedSearchQuery ? (
									<TouchableOpacity
										onPress={() => setSearchQuery('')}
										style={[styles.inlineReset, { backgroundColor: colors.surface, borderColor: colors.border }]}
										activeOpacity={0.8}
									>
										<Text style={[styles.inlineResetText, { color: colors.textSecondary }]}>Clear</Text>
									</TouchableOpacity>
								) : null}
							</View>

							<View style={styles.filterMetaRow}>
								<Text style={[styles.filterMetaText, { color: colors.textSecondary }]}>Filter by status or meal plan</Text>
								{hasFiltersApplied ? (
									<TouchableOpacity onPress={resetFilters} activeOpacity={0.8}>
										<Text style={[styles.filterResetText, { color: colors.primary }]}>Reset all</Text>
									</TouchableOpacity>
								) : null}
							</View>

							<View style={styles.filterChipsContainer}>
								{CUSTOMER_FILTERS.map((filter) => {
									const isActive = activeFilter === filter;
									const FilterIcon = filter === 'Lunch' ? Sun : filter === 'Dinner' ? Moon : null;
									return (
										<TouchableOpacity
											key={filter}
											onPress={() => setActiveFilter(filter)}
											style={[
												styles.filterChip,
												{
													backgroundColor: isActive ? colors.primary : colors.surfaceElevated,
													borderColor: isActive ? colors.primary : colors.border,
												}
											]}
										>
											{FilterIcon && <FilterIcon size={14} color={isActive ? colors.textInverted : colors.textSecondary} style={{ marginRight: 4 }} />}
											<Text style={[styles.filterChipText, { color: isActive ? colors.textInverted : colors.textPrimary }]}>
												{filter}
											</Text>
											<View style={[styles.filterChipCount, { backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : colors.surface }]}>
												<Text style={[styles.filterChipCountText, { color: isActive ? colors.textInverted : colors.textSecondary }]}>
													{filterCounts[filter]}
												</Text>
											</View>
										</TouchableOpacity>
									);
								})}
							</View>
						</View>
					</View>
				}
				contentContainerStyle={{
					paddingHorizontal: contentPadding,
					paddingBottom: scale(150, 0.92, 1.14),
					width: '100%',
					maxWidth: Math.min(maxContentWidth, maxReadableWidth),
					alignSelf: 'center',
				}}
				ListEmptyComponent={
					<View style={[styles.emptyStateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
						<Text style={[styles.emptyStateTitle, { color: colors.textPrimary, fontSize: font(17, 0.94, 1.08) }]}>No customers match this search</Text>
						<Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>Try a different name, phone number, or reset the active filters.</Text>
					</View>
				}
			/>

			<CustomerFormModal
				sheetRef={addCustomerSheetRef}
				onClose={() => {}}
				onSubmit={handleAddCustomer}
				submitting={savingCustomer}
			/>

			<PremiumBottomSheet
				ref={intelligenceSheetRef}
				title="Intelligence Hub"
				subtitle="انٹیلی جنس مرکز"
				onDismiss={() => setSelectedCustomer(null)}
			>
				{selectedCustomer ? (
					<CustomerIntelligenceDetail
						customer={selectedCustomer}
						daysLeft={getDaysLeft(toDate(selectedCustomer.endDate))}
						dueAmount={getDueAmount(selectedCustomer.pricePerMonth, selectedCustomer.totalPaid || 0)}
						onAction={(type) => {
							if (type === 'delete') {
								handleDeleteCustomerRequest(selectedCustomer);
								return;
							}

							intelligenceSheetRef.current?.dismiss();
						}}
					/>
				) : null}
			</PremiumBottomSheet>
		</Screen>
	);
}

function StatPill({ icon: Icon, label, count, color }: { icon: LucideIcon, label: string, count: number, color: string }) {
	const { colors } = useAppTheme();
	const { font } = useResponsiveLayout();
	return (
		<View style={[styles.statPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
			<View style={[styles.statIconBox, { backgroundColor: color + '15' }]}>
				<Icon size={15} color={color} />
			</View>
			<View style={styles.statCopy}>
				<Text style={[styles.statCount, { color: colors.textPrimary, fontSize: font(18, 0.94, 1.08) }]}>{count}</Text>
				<Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: font(11, 0.94, 1.06) }]}>{label}</Text>
			</View>
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
	headerRight: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	listHeader: {
		paddingTop: Theme.spacing.lg,
		paddingBottom: Theme.spacing.xl,
	},
	overviewPanel: {
		borderWidth: 1,
		borderRadius: 24,
		padding: Theme.spacing.lg,
		marginBottom: Theme.spacing.lg,
		shadowColor: '#201812',
		shadowOpacity: 0.06,
		shadowRadius: 18,
		shadowOffset: { width: 0, height: 10 },
		elevation: 2,
	},
	overviewTopRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	overviewCopy: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: Theme.spacing.md,
		flex: 1,
	},
	overviewIconWrap: {
		width: 34,
		height: 34,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	overviewTextBlock: {
		flex: 1,
		gap: 4,
	},
	overviewEyebrow: {
		...Theme.typography.detailBold,
		textTransform: 'uppercase',
		letterSpacing: 0.7,
	},
	overviewTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
	},
	overviewSubtitle: {
		...Theme.typography.detail,
		fontSize: 13,
	},
	overviewCountPill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
		borderRadius: Theme.radius.full,
		borderWidth: 1,
	},
	overviewCountText: {
		...Theme.typography.detailBold,
	},
	statsContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.lg,
	},
	statPill: {
		flex: 1,
		minWidth: '47%',
		flexDirection: 'row',
		alignItems: 'flex-start',
		padding: Theme.spacing.md,
		borderRadius: 18,
		borderWidth: 1,
		gap: Theme.spacing.sm,
	},
	statIconBox: {
		width: 34,
		height: 34,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
	statCopy: {
		flex: 1,
		minWidth: 0,
	},
	statCount: {
		fontWeight: '900',
	},
	statLabel: {
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		fontWeight: '700',
		marginTop: 3,
	},
	searchShell: {
		borderWidth: 1,
		borderRadius: 24,
		padding: Theme.spacing.lg,
		marginBottom: Theme.spacing.lg,
		shadowColor: '#201812',
		shadowOpacity: 0.05,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 8 },
		elevation: 2,
	},
	searchHeaderRow: {
		gap: Theme.spacing.md,
	},
	searchHeaderCopy: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: Theme.spacing.md,
	},
	searchIconWrap: {
		width: 34,
		height: 34,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	searchTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
	},
	searchSubtitle: {
		...Theme.typography.detail,
		fontSize: 13,
		marginTop: 4,
	},
	searchCountPill: {
		alignSelf: 'flex-start',
		borderWidth: 1,
		borderRadius: Theme.radius.full,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.xs,
		marginTop: Theme.spacing.sm,
	},
	searchCountText: {
		...Theme.typography.detailBold,
	},
	searchBar: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: Theme.spacing.md,
		minHeight: 54,
		gap: Theme.spacing.sm,
		borderWidth: 1,
		borderRadius: 18,
		marginTop: Theme.spacing.lg,
	},
	searchInput: {
		flex: 1,
		...Theme.typography.labelMedium,
		paddingVertical: Theme.spacing.sm,
	},
	inlineReset: {
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.xs,
		borderWidth: 1,
		borderRadius: Theme.radius.full,
	},
	inlineResetText: {
		...Theme.typography.detailBold,
	},
	filterMetaRow: {
		marginTop: Theme.spacing.md,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	filterMetaText: {
		...Theme.typography.detail,
		flex: 1,
	},
	filterResetText: {
		...Theme.typography.detailBold,
	},
	filterChipsContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.md,
	},
	filterChip: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
		borderRadius: Theme.radius.pill,
		borderWidth: 1,
		gap: 6,
	},
	filterChipText: {
		...Theme.typography.detailBold,
	},
	filterChipCount: {
		minWidth: 24,
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: Theme.radius.full,
		alignItems: 'center',
	},
	filterChipCountText: {
		...Theme.typography.detailBold,
		fontSize: 10,
	},
	emptyStateCard: {
		marginTop: Theme.spacing.huge,
		borderWidth: 1,
		borderRadius: 22,
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
});
