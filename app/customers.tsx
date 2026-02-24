import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SETTINGS } from '../constants/Settings';
import { Theme } from '../constants/Theme';
import { db } from '../firebase/config';
import { getCustomerStatus, getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { mockDb } from '../utils/mockDb';
import { DAYS, DayName, emptyWeekAttendance, formatISO, getDatesForWeek, getWeekId, shortDay } from '../utils/weekLogic';


type MealSlot = { main: string; roti: boolean; rice: { enabled: boolean; type: string }; extra: string };
type DayMenu = { lunch: MealSlot; dinner: MealSlot };
type WeekMenu = Partial<Record<DayName, DayMenu>>;

const normalizeMeal = (raw: any): MealSlot => ({
	main: typeof raw?.main === 'string' ? raw.main : "",
	rice: (raw?.rice && typeof raw.rice === 'object' && 'enabled' in raw.rice)
		? raw.rice
		: { enabled: false, type: typeof raw?.rice === 'string' ? raw.rice : "" },
	roti: typeof raw?.roti === 'boolean' ? raw.roti : true,
	extra: typeof raw?.extra === 'string' ? raw.extra : (raw?.side || ""),
});

type Customer = {
	id: string;
	name: string;
	phone: string;
	mealsPerDay: { lunch: boolean; dinner: boolean };
	plan?: string; // Legacy fallback
	pricePerMonth: number;
	startDate: any;
	endDate: any;
	totalPaid: number;
	notes: string;
	isActive: boolean;
};

export default function CustomersScreen() {
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [loading, setLoading] = useState(true);
	const [isAdding, setIsAdding] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [weekAttendance, setWeekAttendance] = useState<Record<DayName, { lunch: boolean; dinner: boolean }>>(emptyWeekAttendance());
	const [weekMenu, setWeekMenu] = useState<WeekMenu>({});
	const weekId = getWeekId();

	// Form State
	const [newName, setNewName] = useState("");
	const [newPhone, setNewPhone] = useState("");
	const [isLunch, setIsLunch] = useState(true);
	const [isDinner, setIsDinner] = useState(false);
	const [newPrice, setNewPrice] = useState("2500");
	const [newNotes, setNewNotes] = useState("");
	const [newStartDate, setNewStartDate] = useState(formatISO(new Date()));
	const [newEndDate, setNewEndDate] = useState(() => {
		const d = new Date();
		d.setMonth(d.getMonth() + 1);
		return formatISO(d);
	});

	useEffect(() => {
		if (isLunch && isDinner) {
			setNewPrice("650");
		} else if (isLunch || isDinner) {
			setNewPrice("350");
		} else {
			setNewPrice("0");
		}
	}, [isLunch, isDinner]);

	useEffect(() => {
		const loadCustomers = () => {
			setCustomers(mockDb.getCustomers() as Customer[]);
			setLoading(false);
		};

		if (SETTINGS.USE_MOCKS) {
			loadCustomers();
			const unsub = mockDb.subscribe(loadCustomers);
			return unsub;
		}

		// Rule: If customer isActive -> show in Customers list
		const q = query(collection(db, "customers"), where("isActive", "==", true));

		const unsubscribe = onSnapshot(q, (querySnapshot) => {
			const customersArray: Customer[] = [];
			querySnapshot.forEach((doc) => {
				customersArray.push({ id: doc.id, ...doc.data() } as Customer);
			});
			setCustomers(customersArray);
			setLoading(false);
		});

		return () => unsubscribe();
	}, []);

	useEffect(() => {
		const dates = getDatesForWeek(weekId);

		const loadMenu = () => {
			if (SETTINGS.USE_MOCKS) {
				const mock: WeekMenu = {};
				dates.forEach((date: string, idx: number) => {
					const dayName = DAYS[idx];
					const data = mockDb.getMenu(date);
					mock[dayName] = {
						lunch: normalizeMeal(data.lunch),
						dinner: normalizeMeal(data.dinner),
					};
				});
				setWeekMenu(mock);
			}
		};

		if (SETTINGS.USE_MOCKS) {
			loadMenu();
			return mockDb.subscribe(loadMenu);
		}

		const unsubMenu = dates.map((date: string, idx: number) => {
			const dayName = DAYS[idx];
			return onSnapshot(doc(db, "menu", date), (snap) => {
				const data = snap.exists() ? snap.data() : {};
				setWeekMenu(prev => ({
					...prev,
					[dayName]: {
						lunch: normalizeMeal(data.lunch),
						dinner: normalizeMeal(data.dinner),
					}
				}));
			});
		});

		return () => unsubMenu.forEach((unsub: () => void) => unsub());
	}, [weekId]);

	const handleAddCustomer = async () => {
		if (!newName.trim()) {
			alert("Please enter a name");
			return;
		}

		try {
			if (!SETTINGS.USE_MOCKS) {
				await addDoc(collection(db, "customers"), {
					name: newName,
					phone: newPhone,
					mealsPerDay: { lunch: isLunch, dinner: isDinner },
					pricePerMonth: parseInt(newPrice) || 0,
					startDate: new Date(newStartDate),
					endDate: new Date(newEndDate),
					totalPaid: 0,
					notes: newNotes,
					isActive: true
				});
			} else {
				console.log("Mock Mode: Adding customer to local session storage");
				mockDb.addCustomer({
					id: `mock - ${Date.now()} `,
					name: newName,
					phone: newPhone,
					mealsPerDay: { lunch: isLunch, dinner: isDinner },
					pricePerMonth: parseInt(newPrice) || 0,
					startDate: new Date(newStartDate).toISOString(),
					endDate: new Date(newEndDate).toISOString(),
					totalPaid: 0,
					notes: newNotes,
					isActive: true
				});
			}

			// Reset form
			setNewName("");
			setNewPhone("");
			setNewNotes("");
			setIsAdding(false);
		} catch (error) {
			console.error("Error adding customer:", error);
		}
	};

	const handleDeleteCustomer = async (id: string) => {
		if (!SETTINGS.USE_MOCKS) {
			try {
				await deleteDoc(doc(db, "customers", id));
			} catch (error) {
				console.error("Error deleting customer:", error);
			}
		} else {
			console.log("Mock Mode: Delete not persisted");
		}
	};

	const handleOpenAttendance = async (customerId: string) => {
		if (expandedId === customerId) {
			setExpandedId(null);
			return;
		}

		const dates = getDatesForWeek(weekId);
		const attendance: Record<DayName, { lunch: boolean; dinner: boolean }> = emptyWeekAttendance();

		if (!SETTINGS.USE_MOCKS) {
			try {
				// Fetch 7 docs in parallel for the week
				const promises = dates.map((date: string) => getDoc(doc(db, "attendance", `${date}_${customerId} `)));
				const snaps = await Promise.all(promises);

				snaps.forEach((snap: any, i: number) => {
					if (snap.exists()) {
						const dayName = DAYS[i];
						attendance[dayName] = {
							lunch: snap.data().lunch ?? true,
							dinner: snap.data().dinner ?? true
						};
					}
				});
				setWeekAttendance(attendance);
			} catch (e) {
				console.error("Error loading attendance:", e);
				setWeekAttendance(emptyWeekAttendance());
			}
		} else {
			setWeekAttendance(emptyWeekAttendance());
		}
		setExpandedId(customerId);
	};

	const handleSaveAttendance = async (customerId: string) => {
		const dates = getDatesForWeek(weekId);
		if (!SETTINGS.USE_MOCKS) {
			try {
				const promises = dates.map((date: string, i: number) => {
					const dayName = DAYS[i];
					const selection = weekAttendance[dayName];
					return setDoc(doc(db, "attendance", `${date}_${customerId}`), {
						customerId,
						date,
						lunch: selection.lunch,
						dinner: selection.dinner,
						updatedAt: new Date().toISOString()
					}, { merge: true });
				});
				await Promise.all(promises);
			} catch (e) {
				console.error("Error saving attendance:", e);
			}
		} else {
			// Mock save logic if needed, but currently mock state is handled in toggleAttendance locally
		}
		setExpandedId(null);
	};

	const toggleAttendance = (day: DayName, meal: 'lunch' | 'dinner') => {
		setWeekAttendance(prev => ({
			...prev,
			[day]: { ...prev[day], [meal]: !prev[day][meal] }
		}));
	};

	if (loading) return <View style={styles.container}><Text>Loading...</Text></View>;

	return (
		<Screen scrollable={false}>
			<ScreenHeader
				title="Customers"
				subtitle={`${customers.length} ACTIVE MEMBERS`}
				rightAction={
					<View style={styles.headerRight}>
						{isAdding && (
							<TouchableOpacity
								style={styles.headerActionBtn}
								onPress={handleAddCustomer}
							>
								<MaterialCommunityIcons name="content-save-check" size={24} color={Theme.colors.success} />
							</TouchableOpacity>
						)}
						<TouchableOpacity
							style={[styles.addBtn, isAdding && styles.cancelBtn]}
							onPress={() => setIsAdding(!isAdding)}
						>
							<MaterialCommunityIcons
								name={isAdding ? "close" : "account-plus"}
								size={24}
								color={Theme.colors.textInverted}
							/>
						</TouchableOpacity>
					</View>
				}
			/>

			{isAdding && (
				<View style={styles.form}>
					<Text style={styles.label}>Name - نام</Text>
					<Input
						value={newName}
						onChangeText={setNewName}
						placeholder="Customer Name"
					/>

					<Text style={styles.label}>Phone - فون نمبر</Text>
					<Input
						value={newPhone}
						onChangeText={setNewPhone}
						placeholder="0300-1234567"
						keyboardType="phone-pad"
					/>

					<View style={styles.row}>
						<View style={{ flex: 1, marginRight: 10 }}>
							<Text style={styles.label}>Meals - کھانا</Text>
							<View style={styles.planSelector}>
								<TouchableOpacity
									style={[styles.planOption, isLunch && styles.planOptionSelected]}
									onPress={() => setIsLunch(!isLunch)}
								>
									<Text style={[styles.planOptionText, isLunch && styles.planOptionTextSelected]}>
										LUNCH
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.planOption, isDinner && styles.planOptionSelected]}
									onPress={() => setIsDinner(!isDinner)}
								>
									<Text style={[styles.planOptionText, isDinner && styles.planOptionTextSelected]}>
										DINNER
									</Text>
								</TouchableOpacity>
							</View>
						</View>
						<View style={{ flex: 1 }}>
							<Text style={styles.label}>Price - قیمت</Text>
							<Input
								value={newPrice}
								onChangeText={setNewPrice}
								keyboardType="numeric"
							/>
						</View>
					</View>

					<View style={styles.row}>
						<View style={{ flex: 1, marginRight: 10 }}>
							<Text style={styles.label}>Start - تاریخ آغاز</Text>
							<Input
								value={newStartDate}
								onChangeText={setNewStartDate}
								placeholder="YYYY-MM-DD"
							/>
						</View>
						<View style={{ flex: 1 }}>
							<Text style={styles.label}>End - تاریخ ختم</Text>
							<Input
								value={newEndDate}
								onChangeText={setNewEndDate}
								placeholder="YYYY-MM-DD"
							/>
						</View>
					</View>

					<Text style={styles.label}>Notes - نوٹ</Text>
					<Input
						value={newNotes}
						onChangeText={setNewNotes}
						placeholder="Any specific instructions..."
					/>

					<View style={styles.formFooter}>
						<MaterialCommunityIcons name="information-outline" size={14} color={Theme.colors.textMuted} />
						<Text style={styles.formInfo}>Save from header when ready</Text>
					</View>
				</View>
			)}

			<FlatList
				data={customers}
				keyExtractor={(item) => item.id}
				contentContainerStyle={{ paddingHorizontal: Theme.spacing.screenPadding, paddingBottom: 150 }}
				renderItem={({ item }) => (
					<Card borderless style={{ marginBottom: Theme.spacing.md, borderBottomWidth: 1, borderBottomColor: Theme.colors.border }}>
						<View style={styles.rowBetween}>
							<Text style={styles.name}>{item.name}</Text>
							<View style={styles.badgeRow}>
								{getCustomerStatus(toDate(item.endDate)) === 'expired' && <Badge label="EXPIRED" variant="danger" />}
								{getCustomerStatus(toDate(item.endDate)) === 'expiring-soon' && <Badge label="EXPIRING" variant="warning" />}
								{getDueAmount(item.pricePerMonth, item.totalPaid) > 0 && <Badge label="DUE" variant="warning" />}
							</View>
						</View>

						<View style={[styles.details, { marginTop: Theme.spacing.xs }]}>
							<Text style={[
								styles.daysRemaining,
								getCustomerStatus(toDate(item.endDate)) === 'expired' && styles.textRed,
								getCustomerStatus(toDate(item.endDate)) === 'expiring-soon' && styles.textOrange,
								{ marginTop: 0 }
							]}>
								{getDaysLeft(toDate(item.endDate))} days left
							</Text>
							<Text style={styles.metadataBrief}>
								{item.mealsPerDay
									? [item.mealsPerDay.lunch && "L", item.mealsPerDay.dinner && "D"].filter(Boolean).join("+")
									: "?? "}
								{" • "}DHS {item.pricePerMonth}
							</Text>
						</View>

						{expandedId === item.id && (
							<View style={styles.expandedMetadata}>
								<View style={styles.metaGrid}>
									<View style={styles.metaItem}>
										<Text style={styles.metaText}>{item.phone}</Text>
									</View>
									<View style={styles.metaItem}>
										<Text style={styles.metaText}>{toDate(item.startDate).toLocaleDateString()} - {toDate(item.endDate).toLocaleDateString()}</Text>
									</View>
									<View style={styles.metaItem}>
										<Text style={styles.metaText}>Paid cumulative: DHS {item.totalPaid}</Text>
									</View>
								</View>
								{item.notes ? (
									<View style={styles.notesContainer}>
										<Text style={styles.notesText}>Note: {item.notes}</Text>
									</View>
								) : null}
								<TouchableOpacity
									style={styles.inlineDeleteBtn}
									onPress={() => handleDeleteCustomer(item.id)}
								>
									<Text style={styles.deleteBtnText}>REMOVE CUSTOMER</Text>
								</TouchableOpacity>
							</View>
						)}

						<TouchableOpacity
							style={[styles.weekBtn, expandedId === item.id && styles.weekBtnActive]}
							onPress={() => handleOpenAttendance(item.id)}
						>
							<View style={styles.btnContent}>
								<MaterialCommunityIcons
									name={expandedId === item.id ? "close" : "calendar-edit"}
									size={16}
									color={expandedId === item.id ? Theme.colors.danger : Theme.colors.primary}
								/>
								<Text style={[styles.weekBtnText, expandedId === item.id && styles.textRed]}>
									{expandedId === item.id ? 'CLOSE' : 'SET WEEK'}
								</Text>
							</View>
						</TouchableOpacity>

						{expandedId === item.id && (
							<View style={styles.attendancePanel}>
								<Text style={styles.attendanceTitle}>Week Attendance — {weekId}</Text>
								{DAYS.map((day: DayName) => (
									<View key={day} style={styles.dayRow}>
										<Text style={styles.dayName}>{shortDay(day)}</Text>
										<View style={styles.mealToggles}>
											{(item.mealsPerDay?.lunch !== false) && (
												<TouchableOpacity
													style={[
														styles.mealChip,
														weekAttendance[day].lunch && styles.mealChipOn
													]}
													onPress={() => toggleAttendance(day, 'lunch')}
												>
													<View style={styles.chipContent}>
														<View>
															<Text style={styles.mealChipLabel}>LUNCH</Text>
															<Text style={styles.mealChipDish} numberOfLines={1}>
																{(weekMenu[day]?.lunch?.main) || 'Rice/Roti'}
															</Text>
														</View>
													</View>
												</TouchableOpacity>
											)}
											{(item.mealsPerDay?.dinner !== false) && (
												<TouchableOpacity
													style={[
														styles.mealChip,
														weekAttendance[day].dinner && styles.mealChipOn
													]}
													onPress={() => toggleAttendance(day, 'dinner')}
												>
													<View style={styles.chipContent}>
														<View>
															<Text style={styles.mealChipLabel}>DINNER</Text>
															<Text style={styles.mealChipDish} numberOfLines={1}>
																{(weekMenu[day]?.dinner?.main) || 'Rice/Roti'}
															</Text>
														</View>
													</View>
												</TouchableOpacity>
											)}
										</View>
									</View>
								))}
								<TouchableOpacity
									style={styles.saveWeekBtn}
									onPress={() => handleSaveAttendance(item.id)}
								>
									<Text style={styles.saveWeekBtnText}>SAVE WEEK — محفوظ کریں</Text>
								</TouchableOpacity>
							</View>
						)}
					</Card>
				)}
				ListEmptyComponent={!isAdding ? <Text style={styles.empty}>No active customers</Text> : null}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: Theme.colors.bg },
	headerRight: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.lg },
	headerActionBtn: {
		backgroundColor: Theme.colors.bg,
		width: 40,
		height: 40,
		borderRadius: 20,
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: Theme.colors.success,
	},
	addBtn: {
		backgroundColor: Theme.colors.primary,
		width: 40,
		height: 40,
		borderRadius: 20,
		justifyContent: 'center',
		alignItems: 'center',
	},
	cancelBtn: {
		backgroundColor: Theme.colors.danger,
	},
	form: {
		padding: Theme.spacing.xxl,
		backgroundColor: 'transparent',
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.border,
		marginBottom: Theme.spacing.xl,
	},
	formFooter: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.xs, marginTop: Theme.spacing.xl, alignSelf: 'center' },
	formInfo: { ...Theme.typography.detail, color: Theme.colors.textMuted, fontStyle: 'italic' },
	label: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textSecondary,
		marginBottom: Theme.spacing.xs,
		marginTop: Theme.spacing.sm,
	},
	row: {
		flexDirection: 'row',
		marginTop: Theme.spacing.xs,
	},
	rowBetween: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	planSelector: {
		flexDirection: 'row',
		backgroundColor: Theme.colors.border,
		borderRadius: Theme.radius.sm,
		padding: Theme.spacing.xs,
	},
	planOption: {
		flex: 1,
		paddingVertical: Theme.spacing.sm,
		alignItems: 'center',
		borderRadius: Theme.radius.sm,
	},
	planOptionSelected: {
		backgroundColor: Theme.colors.surface,
		borderWidth: 1,
		borderColor: Theme.colors.border,
	},
	planOptionText: {
		...Theme.typography.label,
		color: Theme.colors.textSecondary,
	},
	planOptionTextSelected: {
		color: Theme.colors.primary,
	},
	name: {
		...Theme.typography.answer,
		color: Theme.colors.textPrimary,
	},
	details: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: Theme.spacing.sm,
	},
	plan: {
		...Theme.typography.labelMedium,
		color: Theme.colors.primary,
	},
	phone: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textSecondary,
	},
	dates: {
		...Theme.typography.detail,
		color: Theme.colors.textMuted,
	},
	statusBadge: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	paid: {
		...Theme.typography.labelMedium,
		color: Theme.colors.primary,
	},
	daysRemaining: {
		marginTop: Theme.spacing.xs,
		...Theme.typography.labelMedium,
		color: Theme.colors.textSecondary,
	},
	textRed: {
		color: Theme.colors.danger,
	},
	textOrange: {
		color: Theme.colors.warning,
	},
	empty: {
		textAlign: 'center',
		...Theme.typography.labelMedium,
		color: Theme.colors.textMuted,
		marginTop: Theme.spacing.massive,
	},
	notes: {
		...Theme.typography.detail,
		fontStyle: 'italic',
		marginTop: Theme.spacing.sm,
		paddingTop: Theme.spacing.sm,
		borderTopWidth: 1,
		borderTopColor: Theme.colors.border,
	},
	deleteBtn: {
		backgroundColor: 'rgba(180, 83, 83, 0.15)', // Palette-aligned muted danger
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.xs,
		borderRadius: Theme.radius.sm,
	},
	deleteBtnText: {
		color: Theme.colors.danger,
		...Theme.typography.detailBold,
	},
	weekBtn: {
		marginTop: Theme.spacing.sm, paddingVertical: Theme.spacing.sm, paddingHorizontal: Theme.spacing.lg,
		backgroundColor: Theme.colors.decoration, borderRadius: Theme.radius.md, alignSelf: 'flex-start',
	},
	weekBtnActive: { backgroundColor: 'rgba(180, 83, 83, 0.2)' },
	weekBtnText: { ...Theme.typography.detailBold, color: Theme.colors.primary },
	badgeRow: { flexDirection: 'row', gap: Theme.spacing.xs },
	metadataBrief: { ...Theme.typography.detailBold, color: Theme.colors.textMuted },
	expandedMetadata: {
		marginTop: Theme.spacing.sm,
		padding: Theme.spacing.md,
		backgroundColor: Theme.colors.bg,
		borderRadius: Theme.radius.md,
	},
	metaGrid: { gap: Theme.spacing.xs },
	metaItem: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
	metaText: { ...Theme.typography.detail, color: Theme.colors.textSecondary },
	notesContainer: {
		marginTop: Theme.spacing.sm,
		paddingTop: Theme.spacing.sm,
		borderTopWidth: 1,
		borderTopColor: Theme.colors.border,
	},
	notesText: { ...Theme.typography.detail, fontStyle: 'italic', color: Theme.colors.textMuted },
	inlineDeleteBtn: {
		marginTop: Theme.spacing.md,
		alignItems: 'center',
		paddingVertical: Theme.spacing.sm,
	},
	btnContent: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
	chipContent: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.xs },
	attendancePanel: {
		marginTop: Theme.spacing.sm, backgroundColor: Theme.colors.bg,
		borderRadius: Theme.radius.md, padding: Theme.spacing.md,
	},
	attendanceTitle: { ...Theme.typography.detailBold, color: Theme.colors.textMuted, marginBottom: Theme.spacing.md },
	dayRow: {
		flexDirection: 'row', alignItems: 'center',
		justifyContent: 'space-between', marginBottom: Theme.spacing.sm,
	},
	dayName: { ...Theme.typography.labelMedium, width: 36 },
	mealToggles: { flexDirection: 'row', gap: Theme.spacing.md, flex: 1, marginLeft: 10 },
	mealChip: {
		flex: 1, paddingHorizontal: Theme.spacing.md, paddingVertical: Theme.spacing.sm,
		backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.md, borderWidth: 1, borderColor: Theme.colors.border,
	},
	mealChipOn: { backgroundColor: Theme.colors.decoration, borderColor: Theme.colors.primary },
	mealChipLabel: { ...Theme.typography.detail, color: Theme.colors.textSecondary },
	mealChipDish: { ...Theme.typography.label, color: Theme.colors.textPrimary, marginTop: Theme.spacing.xs },
	saveWeekBtn: {
		marginTop: Theme.spacing.lg, backgroundColor: Theme.colors.surfaceElevated,
		padding: Theme.spacing.lg, borderRadius: Theme.radius.lg, alignItems: 'center',
	},
	saveWeekBtnText: { ...Theme.typography.label, color: Theme.colors.textInverted, letterSpacing: 1 },
});
