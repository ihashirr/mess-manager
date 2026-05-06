import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { deleteDoc, doc, getDoc, onSnapshot, query, setDoc, where, collection, addDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CenterModal } from '../components/ui/CenterModal';
import { CustomerIntelligenceDetail } from '../components/ui/CustomerIntelligenceDetail';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader, ScreenHeaderActionButton } from '../components/ui/ScreenHeader';
import { useResponsiveLayout } from '../components/ui/useResponsiveLayout';
import { CustomerCard } from '../components/customers/CustomerCard';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { type Customer, type CustomerFormValues } from '../components/customers/types';
import { Theme } from '../constants/Theme';
import { useAppTheme } from '../context/ThemeModeContext';
import { db } from '../firebase/config';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { getFirestoreErrorMessage, isFirestorePermissionDenied } from '../utils/firestoreErrors';
import { normalizeDayMenu, type WeekMenu } from '../utils/menuLogic';
import { DAYS, type DayName, emptyWeekAttendance, getDatesForWeek, getWeekId } from '../utils/weekLogic';

export default function CustomersScreen() {
	const { colors } = useAppTheme();
	const { contentPadding, maxContentWidth } = useResponsiveLayout();
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [loading, setLoading] = useState(true);
	const [addingCustomer, setAddingCustomer] = useState(false);
	const [savingCustomer, setSavingCustomer] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [weekAttendance, setWeekAttendance] = useState<Record<DayName, { lunch: boolean; dinner: boolean }>>(emptyWeekAttendance());
	const [weekMenu, setWeekMenu] = useState<WeekMenu>({});
	const weekId = getWeekId();
	const [firestoreAlertShown, setFirestoreAlertShown] = useState(false);

	const showAsyncError = (title: string, error: unknown) => {
		const message = error instanceof Error ? error.message : 'Please try again.';
		console.error(title, error);
		Alert.alert(title, message);
	};

	const handleSnapshotError = (context: string, error: unknown) => {
		if (!isFirestorePermissionDenied(error)) {
			console.error(`Firestore ${context} listener failed:`, error);
		}
		setLoading(false);
		if (!firestoreAlertShown) {
			setFirestoreAlertShown(true);
			Alert.alert('Firestore access failed', getFirestoreErrorMessage(error, `Could not load ${context}.`));
		}
	};

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
	}, []);

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
	}, [weekId]);

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
				mealsPerDay: { lunch: values.isLunch, dinner: values.isDinner },
				pricePerMonth: parseInt(values.price, 10) || 0,
				startDate,
				endDate,
				totalPaid: 0,
				notes: values.notes.trim(),
				isActive: true,
			};

			await addDoc(collection(db, 'customers'), payload);

			setAddingCustomer(false);
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

	const normalizedQuery = searchQuery.trim().toLowerCase();
	const filteredCustomers = normalizedQuery.length === 0
		? customers
		: customers.filter((customer) => {
			const searchableText = [
				customer.name,
				customer.phone,
				customer.address?.location,
				customer.address?.flat,
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();

			return searchableText.includes(normalizedQuery);
		});

	if (loading) {
		return (
			<View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
				<Text style={[styles.loadingText, { color: colors.textPrimary }]}>Loading...</Text>
			</View>
		);
	}

	return (
		<Screen scrollable={false}>
			<ScreenHeader
				edgeToEdge={false}
				title="Customers"
				subtitle={`${customers.length} ACTIVE MEMBERS`}
				rightAction={
					<View style={styles.headerRight}>
						<ScreenHeaderActionButton
							icon="account-plus"
							onPress={() => setAddingCustomer(true)}
							accessibilityLabel="Add customer"
							variant="primary"
						/>
					</View>
				}
			/>

			<FlatList
				data={filteredCustomers}
				keyExtractor={(item) => item.id}
				contentContainerStyle={{
					paddingHorizontal: contentPadding,
					paddingBottom: 150,
					width: '100%',
					maxWidth: maxContentWidth,
					alignSelf: 'center',
				}}
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
					<View style={[styles.listHeader, { borderTopColor: colors.border }]}>
						<View style={styles.listHeaderSpacing} />

						<View
							style={[
								styles.searchShell,
								{
									backgroundColor: colors.surface,
									borderColor: colors.border,
								},
							]}
						>
							<View
								style={[
									styles.searchBar,
									{
										backgroundColor: colors.surfaceElevated,
										borderColor: colors.border,
									},
								]}
							>
								<MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
								<TextInput
									value={searchQuery}
									onChangeText={setSearchQuery}
									placeholder="Search by name, phone, or address"
									placeholderTextColor={colors.textMuted}
									style={[styles.searchInput, { color: colors.textPrimary }]}
								/>
								{searchQuery.length > 0 ? (
									<TouchableOpacity
										onPress={() => setSearchQuery('')}
										style={[styles.clearButton, { backgroundColor: colors.surface }]}
									>
										<MaterialCommunityIcons name="close" size={14} color={colors.textMuted} />
									</TouchableOpacity>
								) : (
									<View style={[styles.searchCountPill, { backgroundColor: colors.surface }]}>
										<MaterialCommunityIcons name="account-group-outline" size={14} color={colors.primary} />
										<Text style={[styles.searchCountText, { color: colors.textSecondary }]}>{customers.length}</Text>
									</View>
								)}
							</View>

							<View style={styles.metaRow}>
								<View style={styles.metaBlock}>
									<Text style={[styles.metaLabel, { color: colors.textMuted }]}>Showing</Text>
									<Text style={[styles.metaValue, { color: colors.textPrimary }]}>
										{filteredCustomers.length} of {customers.length}
									</Text>
								</View>
								<View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
								<View style={styles.metaBlock}>
									<Text style={[styles.metaLabel, { color: colors.textMuted }]}>Scope</Text>
									<Text style={[styles.metaValue, { color: colors.textPrimary }]}>
										{normalizedQuery.length > 0 ? 'Filtered customers' : 'All active customers'}
									</Text>
								</View>
							</View>
						</View>

						<Text style={[styles.searchMeta, { color: colors.textMuted }]}>
							{normalizedQuery.length > 0 ? 'Refine the search to narrow the list faster.' : 'Browse active customers or search directly.'}
						</Text>
					</View>
				}
				ListEmptyComponent={
					<Text style={[styles.emptyState, { color: colors.textMuted }]}>
						{normalizedQuery.length > 0 ? 'No customers match this search' : 'No active customers'}
					</Text>
				}
			/>

			<CustomerFormModal
				visible={addingCustomer}
				onClose={() => {
					if (!savingCustomer) {
						setAddingCustomer(false);
					}
				}}
				onSubmit={handleAddCustomer}
				submitting={savingCustomer}
			/>

			<CenterModal
				visible={selectedCustomer !== null}
				onClose={() => setSelectedCustomer(null)}
				title="Intelligence Hub — انٹیلی جنس مرکز"
			>
				{selectedCustomer ? (
					<CustomerIntelligenceDetail
						customer={selectedCustomer}
						daysLeft={getDaysLeft(toDate(selectedCustomer.endDate))}
						dueAmount={getDueAmount(selectedCustomer.pricePerMonth, selectedCustomer.totalPaid || 0)}
						onAction={() => {
							setSelectedCustomer(null);
						}}
					/>
				) : null}
			</CenterModal>
		</Screen>
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
	},
	headerRight: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.lg,
	},
	listHeader: {
		paddingTop: Theme.spacing.lg,
		paddingBottom: Theme.spacing.lg,
		borderTopWidth: 1,
	},
	listHeaderSpacing: {
		height: Theme.spacing.md,
	},
	searchShell: {
		borderWidth: 1,
		borderRadius: Theme.radius.lg,
		padding: Theme.spacing.md,
		gap: Theme.spacing.md,
	},
	searchBar: {
		minHeight: 52,
		borderWidth: 1,
		borderRadius: Theme.radius.lg,
		paddingHorizontal: Theme.spacing.md,
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
	},
	searchInput: {
		flex: 1,
		...Theme.typography.labelMedium,
		paddingVertical: Theme.spacing.sm,
	},
	clearButton: {
		width: 28,
		height: 28,
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
	searchCountPill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.xs,
		paddingHorizontal: Theme.spacing.sm,
		paddingVertical: 6,
		borderRadius: Theme.radius.full,
	},
	searchCountText: {
		...Theme.typography.detailBold,
	},
	metaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.md,
	},
	metaBlock: {
		flex: 1,
		gap: 2,
	},
	metaDivider: {
		width: 1,
		alignSelf: 'stretch',
	},
	metaLabel: {
		...Theme.typography.detail,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	metaValue: {
		...Theme.typography.labelMedium,
	},
	searchMeta: {
		...Theme.typography.detail,
		marginTop: Theme.spacing.md,
		paddingHorizontal: Theme.spacing.xs,
	},
	emptyState: {
		textAlign: 'center',
		...Theme.typography.labelMedium,
		marginTop: Theme.spacing.massive,
	},
});
