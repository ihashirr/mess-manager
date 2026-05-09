import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';
import { DAYS, type DayName, shortDay } from '../../utils/weekLogic';
import type { WeekMenu } from '../../utils/menuLogic';
import type { Customer } from './types';

interface CustomerAttendancePanelProps {
	customer: Customer;
	weekId: string;
	weekAttendance: Record<DayName, { lunch: boolean; dinner: boolean }>;
	weekMenu: WeekMenu;
	onToggle: (day: DayName, meal: 'lunch' | 'dinner') => void;
	onSave: () => void;
}

export function CustomerAttendancePanel({
	customer,
	weekId,
	weekAttendance,
	weekMenu,
	onToggle,
	onSave,
}: CustomerAttendancePanelProps) {
	const { colors } = useAppTheme();
	const { stacked, scale, font } = useResponsiveLayout();
	const dayNameWidth = scale(36, 0.9, 1.08);
	const chipRadius = scale(12, 0.94, 1.08);
	const saveFontSize = font(14, 0.94, 1.08);
	const availableMeals = [customer.mealsPerDay?.lunch !== false, customer.mealsPerDay?.dinner !== false].filter(Boolean).length;

	return (
		<View style={[styles.panel, { backgroundColor: colors.surfaceElevated, borderColor: 'rgba(42, 30, 19, 0.06)' }]}>
			<View style={styles.header}>
				<View style={styles.headerCopy}>
					<Text style={[styles.title, { color: colors.textPrimary, fontSize: font(15, 0.94, 1.08) }]}>Weekly attendance</Text>
					<Text style={[styles.subtitle, { color: colors.textSecondary }]}>Week {weekId} - tap a meal to include or skip it.</Text>
				</View>
				<View style={[styles.headerPill, { backgroundColor: colors.surface, borderColor: 'rgba(42, 30, 19, 0.06)' }]}>
					<Text style={[styles.headerPillText, { color: colors.textSecondary }]}>{availableMeals} meals/day</Text>
				</View>
			</View>

			{DAYS.map((day) => {
				const activeMeals = [
					customer.mealsPerDay?.lunch !== false && weekAttendance[day].lunch,
					customer.mealsPerDay?.dinner !== false && weekAttendance[day].dinner,
				].filter(Boolean).length;

				return (
					<View key={day} style={[styles.dayRow, { backgroundColor: colors.surface, borderColor: 'rgba(42, 30, 19, 0.055)' }, stacked && styles.dayRowStacked]}>
						<View style={[styles.dayHeader, stacked && styles.dayHeaderStacked]}>
							<Text style={[styles.dayName, { color: colors.textPrimary, width: dayNameWidth, fontSize: font(16, 0.94, 1.08) }]}>
								{shortDay(day)}
							</Text>
							<View style={[styles.dayStatusPill, { backgroundColor: colors.surfaceElevated, borderColor: 'rgba(42, 30, 19, 0.05)' }]}>
								<Text style={[styles.dayStatusText, { color: colors.textSecondary }]}>{activeMeals}/{availableMeals} included</Text>
							</View>
						</View>

						<View style={[styles.mealToggles, stacked && styles.mealTogglesStacked]}>
							{customer.mealsPerDay?.lunch !== false ? (
								<TouchableOpacity
									style={[
										styles.mealChip,
										{ backgroundColor: colors.surfaceElevated, borderColor: 'rgba(42, 30, 19, 0.055)' },
										{ borderRadius: chipRadius },
										stacked && styles.mealChipStacked,
										weekAttendance[day].lunch && {
											backgroundColor: colors.primary + '10',
											borderColor: colors.primary,
										},
									]}
									onPress={() => onToggle(day, 'lunch')}
									activeOpacity={0.82}
								>
									<View style={styles.mealChipTopRow}>
										<Text style={[styles.mealChipLabel, { color: weekAttendance[day].lunch ? colors.primary : colors.textSecondary, fontSize: font(12, 0.94, 1.04) }]}>Lunch</Text>
										<View style={[styles.mealStatePill, { backgroundColor: weekAttendance[day].lunch ? colors.primary : colors.surface, borderColor: weekAttendance[day].lunch ? colors.primary : 'rgba(42, 30, 19, 0.05)' }]}>
											<Text style={[styles.mealStateText, { color: weekAttendance[day].lunch ? colors.textInverted : colors.textSecondary }]}>
												{weekAttendance[day].lunch ? 'Included' : 'Skipped'}
											</Text>
										</View>
									</View>
									<Text style={[styles.mealChipDish, { color: colors.textPrimary, fontSize: font(14, 0.94, 1.08) }]} numberOfLines={stacked ? 2 : 1}>
										{weekMenu[day]?.lunch?.main || 'Rice / Roti'}
									</Text>
								</TouchableOpacity>
							) : null}

							{customer.mealsPerDay?.dinner !== false ? (
								<TouchableOpacity
									style={[
										styles.mealChip,
										{ backgroundColor: colors.surfaceElevated, borderColor: 'rgba(42, 30, 19, 0.055)' },
										{ borderRadius: chipRadius },
										stacked && styles.mealChipStacked,
										weekAttendance[day].dinner && {
											backgroundColor: colors.primary + '10',
											borderColor: colors.primary,
										},
									]}
									onPress={() => onToggle(day, 'dinner')}
									activeOpacity={0.82}
								>
									<View style={styles.mealChipTopRow}>
										<Text style={[styles.mealChipLabel, { color: weekAttendance[day].dinner ? colors.primary : colors.textSecondary, fontSize: font(12, 0.94, 1.04) }]}>Dinner</Text>
										<View style={[styles.mealStatePill, { backgroundColor: weekAttendance[day].dinner ? colors.primary : colors.surface, borderColor: weekAttendance[day].dinner ? colors.primary : 'rgba(42, 30, 19, 0.05)' }]}>
											<Text style={[styles.mealStateText, { color: weekAttendance[day].dinner ? colors.textInverted : colors.textSecondary }]}>
												{weekAttendance[day].dinner ? 'Included' : 'Skipped'}
											</Text>
										</View>
									</View>
									<Text style={[styles.mealChipDish, { color: colors.textPrimary, fontSize: font(14, 0.94, 1.08) }]} numberOfLines={stacked ? 2 : 1}>
										{weekMenu[day]?.dinner?.main || 'Rice / Roti'}
									</Text>
								</TouchableOpacity>
							) : null}
						</View>
					</View>
				);
			})}

			<TouchableOpacity
				style={[styles.saveButton, { backgroundColor: colors.primary, paddingVertical: scale(16, 0.92, 1.08) }]}
				onPress={onSave}
				activeOpacity={0.86}
			>
				<Text style={[styles.saveButtonText, { color: colors.textInverted, fontSize: saveFontSize }]}>
					Save week - محفوظ کریں
				</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	panel: {
		marginTop: Theme.spacing.xs,
		borderRadius: 22,
		padding: Theme.spacing.md,
		borderWidth: 1,
		shadowColor: '#2A1E13',
		shadowOpacity: 0.035,
		shadowRadius: 14,
		shadowOffset: { width: 0, height: 8 },
		elevation: 1,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
		marginBottom: Theme.spacing.sm,
	},
	headerCopy: {
		flex: 1,
	},
	headerPill: {
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.xs,
		borderRadius: 16,
		borderWidth: 1,
	},
	headerPillText: {
		...Theme.typography.detailBold,
	},
	title: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
	},
	subtitle: {
		...Theme.typography.detail,
		fontSize: 13,
		marginTop: 4,
	},
	dayRow: {
		borderWidth: 1,
		borderRadius: 16,
		padding: Theme.spacing.sm,
		marginBottom: Theme.spacing.xs,
	},
	dayRowStacked: {
		gap: Theme.spacing.md,
	},
	dayHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: Theme.spacing.xs,
	},
	dayHeaderStacked: {
		alignItems: 'flex-start',
		flexDirection: 'column',
		gap: Theme.spacing.sm,
	},
	dayName: {
		...Theme.typography.labelMedium,
	},
	dayStatusPill: {
		paddingHorizontal: Theme.spacing.sm,
		paddingVertical: 5,
		borderRadius: 16,
		borderWidth: 1,
	},
	dayStatusText: {
		...Theme.typography.detailBold,
		fontSize: 10,
	},
	mealToggles: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
	},
	mealTogglesStacked: {
		flexDirection: 'column',
		width: '100%',
	},
	mealChip: {
		flex: 1,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
		borderWidth: 1,
	},
	mealChipStacked: {
		width: '100%',
		flexBasis: 'auto',
	},
	mealChipTopRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Theme.spacing.sm,
	},
	mealChipLabel: {
		...Theme.typography.detailBold,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	mealStatePill: {
		paddingHorizontal: Theme.spacing.sm,
		paddingVertical: 4,
		borderRadius: 16,
		borderWidth: 1,
	},
	mealStateText: {
		...Theme.typography.detailBold,
		fontSize: 10,
	},
	mealChipDish: {
		...Theme.typography.label,
		marginTop: Theme.spacing.xs,
	},
	saveButton: {
		marginTop: Theme.spacing.md,
		padding: Theme.spacing.md,
		borderRadius: 16,
		alignItems: 'center',
	},
	saveButtonText: {
		...Theme.typography.label,
		letterSpacing: 0.7,
	},
});
