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
	const { stacked } = useResponsiveLayout();

	return (
		<View style={[styles.panel, { backgroundColor: colors.bg }]}>
			<Text style={[styles.title, { color: colors.textMuted }]}>Week Attendance — {weekId}</Text>
			{DAYS.map((day) => (
				<View key={day} style={[styles.dayRow, stacked && styles.dayRowStacked]}>
					<Text style={[styles.dayName, { color: colors.textPrimary }]}>{shortDay(day)}</Text>
					<View style={[styles.mealToggles, stacked && styles.mealTogglesStacked]}>
						{customer.mealsPerDay?.lunch !== false ? (
							<TouchableOpacity
								style={[
									styles.mealChip,
									{ backgroundColor: colors.surface, borderColor: colors.border },
									stacked && styles.mealChipStacked,
									weekAttendance[day].lunch && {
										backgroundColor: colors.surfaceElevated,
										borderColor: colors.primary,
									},
								]}
								onPress={() => onToggle(day, 'lunch')}
							>
								<View>
									<Text style={[styles.mealChipLabel, { color: colors.textSecondary }]}>LUNCH</Text>
									<Text style={[styles.mealChipDish, { color: colors.textPrimary }]} numberOfLines={1}>
										{weekMenu[day]?.lunch?.main || 'Rice/Roti'}
									</Text>
								</View>
							</TouchableOpacity>
						) : null}
						{customer.mealsPerDay?.dinner !== false ? (
							<TouchableOpacity
								style={[
									styles.mealChip,
									{ backgroundColor: colors.surface, borderColor: colors.border },
									stacked && styles.mealChipStacked,
									weekAttendance[day].dinner && {
										backgroundColor: colors.surfaceElevated,
										borderColor: colors.primary,
									},
								]}
								onPress={() => onToggle(day, 'dinner')}
							>
								<View>
									<Text style={[styles.mealChipLabel, { color: colors.textSecondary }]}>DINNER</Text>
									<Text style={[styles.mealChipDish, { color: colors.textPrimary }]} numberOfLines={1}>
										{weekMenu[day]?.dinner?.main || 'Rice/Roti'}
									</Text>
								</View>
							</TouchableOpacity>
						) : null}
					</View>
				</View>
			))}
			<TouchableOpacity
				style={[styles.saveButton, { backgroundColor: colors.primary }]}
				onPress={onSave}
			>
				<Text style={[styles.saveButtonText, { color: colors.textInverted }]}>SAVE WEEK — محفوظ کریں</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	panel: {
		marginTop: Theme.spacing.sm,
		borderRadius: Theme.radius.md,
		padding: Theme.spacing.md,
	},
	title: {
		...Theme.typography.detailBold,
		marginBottom: Theme.spacing.md,
	},
	dayRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: Theme.spacing.sm,
	},
	dayRowStacked: {
		alignItems: 'flex-start',
		flexDirection: 'column',
		gap: Theme.spacing.sm,
	},
	dayName: {
		...Theme.typography.labelMedium,
		width: 36,
	},
	mealToggles: {
		flexDirection: 'row',
		gap: Theme.spacing.md,
		flex: 1,
		marginLeft: 10,
	},
	mealTogglesStacked: {
		flexDirection: 'column',
		width: '100%',
		marginLeft: 0,
	},
	mealChip: {
		flex: 1,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
		borderRadius: Theme.radius.md,
		borderWidth: 1,
	},
	mealChipStacked: {
		width: '100%',
		flexBasis: 'auto',
	},
	mealChipLabel: {
		...Theme.typography.detail,
	},
	mealChipDish: {
		...Theme.typography.label,
		marginTop: Theme.spacing.xs,
	},
	saveButton: {
		marginTop: Theme.spacing.lg,
		padding: Theme.spacing.lg,
		borderRadius: Theme.radius.lg,
		alignItems: 'center',
	},
	saveButtonText: {
		...Theme.typography.label,
		letterSpacing: 1,
	},
});
