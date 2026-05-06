import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useResponsiveLayout } from '../ui/useResponsiveLayout';
import { Theme } from '../../constants/Theme';
import { useAppTheme } from '../../context/ThemeModeContext';
import { ModalBackdrop } from '../ui/ModalBackdrop';
import { createInitialCustomerFormValues, type CustomerFormValues } from './types';

interface CustomerFormModalProps {
	visible: boolean;
	onClose: () => void;
	onSubmit: (values: CustomerFormValues) => Promise<void>;
	submitting: boolean;
}

export function CustomerFormModal({
	visible,
	onClose,
	onSubmit,
	submitting,
}: CustomerFormModalProps) {
	const { stacked, maxContentWidth, isCompact } = useResponsiveLayout();
	const { colors } = useAppTheme();
	const [formValues, setFormValues] = useState<CustomerFormValues>(createInitialCustomerFormValues());

	useEffect(() => {
		if (visible) {
			setFormValues(createInitialCustomerFormValues());
		}
	}, [visible]);

	useEffect(() => {
		const nextPrice = formValues.isLunch && formValues.isDinner
			? '650'
			: formValues.isLunch || formValues.isDinner
				? '350'
				: '0';

		setFormValues((current) => (
			current.price === nextPrice
				? current
				: { ...current, price: nextPrice }
		));
	}, [formValues.isDinner, formValues.isLunch]);

	const updateField = <K extends keyof CustomerFormValues,>(
		field: K,
		value: CustomerFormValues[K]
	) => {
		setFormValues((current) => ({ ...current, [field]: value }));
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={submitting ? () => undefined : onClose}
		>
			<View style={styles.overlay}>
				<Pressable
					style={styles.backdrop}
					onPress={submitting ? undefined : onClose}
				>
					<ModalBackdrop intensity={32} />
				</Pressable>
				<View
					style={[
						styles.dialog,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							maxWidth: Math.min(maxContentWidth, 760),
							width: isCompact ? '100%' : '92%',
						},
					]}
				>
					<View style={[styles.header, { borderBottomColor: colors.border }]}>
						<View style={styles.headerText}>
							<Text style={[styles.title, { color: colors.textPrimary }]}>Add Customer</Text>
							<Text style={[styles.subtitle, { color: colors.textMuted }]}>Create a new active member</Text>
						</View>
						<TouchableOpacity
							style={[styles.closeButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
							onPress={submitting ? undefined : onClose}
							disabled={submitting}
						>
							<MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
						</TouchableOpacity>
					</View>
					<ScrollView
						style={styles.content}
						contentContainerStyle={styles.contentInner}
						showsVerticalScrollIndicator={false}
						keyboardShouldPersistTaps="handled"
					>
						<View style={styles.form}>
							<Text style={[styles.label, { color: colors.textSecondary }]}>Name - نام</Text>
							<Input
								value={formValues.name}
								onChangeText={(value) => updateField('name', value)}
								placeholder="Customer Name"
							/>

							<Text style={[styles.label, { color: colors.textSecondary }]}>Phone - فون نمبر</Text>
							<Input
								value={formValues.phone}
								onChangeText={(value) => updateField('phone', value)}
								placeholder="0300-1234567"
								keyboardType="phone-pad"
							/>

							<View style={[styles.row, stacked && styles.rowStacked]}>
								<View style={[styles.column, stacked ? styles.columnStacked : styles.columnSpaced]}>
									<Text style={[styles.label, { color: colors.textSecondary }]}>Location - مقام</Text>
									<Input
										value={formValues.location}
										onChangeText={(value) => updateField('location', value)}
										placeholder="Building or Area"
									/>
								</View>
								<View style={styles.column}>
									<Text style={[styles.label, { color: colors.textSecondary }]}>Flat/Villa - فلیٹ</Text>
									<Input
										value={formValues.flat}
										onChangeText={(value) => updateField('flat', value)}
										placeholder="Apt 2B"
									/>
								</View>
							</View>

							<View style={[styles.row, stacked && styles.rowStacked]}>
								<View style={[styles.column, stacked ? styles.columnStacked : styles.columnSpaced]}>
									<Text style={[styles.label, { color: colors.textSecondary }]}>Meals - کھانا</Text>
									<View style={[styles.planSelector, { backgroundColor: colors.surfaceElevated }]}>
										<TouchableOpacity
											style={[
												styles.planOption,
												formValues.isLunch && [styles.planOptionSelected, { backgroundColor: colors.surface, borderColor: colors.border }],
											]}
											onPress={() => updateField('isLunch', !formValues.isLunch)}
											disabled={submitting}
										>
											<Text style={[styles.planOptionText, { color: colors.textSecondary }, formValues.isLunch && { color: colors.primary }]}>
												LUNCH
											</Text>
										</TouchableOpacity>
										<TouchableOpacity
											style={[
												styles.planOption,
												formValues.isDinner && [styles.planOptionSelected, { backgroundColor: colors.surface, borderColor: colors.border }],
											]}
											onPress={() => updateField('isDinner', !formValues.isDinner)}
											disabled={submitting}
										>
											<Text style={[styles.planOptionText, { color: colors.textSecondary }, formValues.isDinner && { color: colors.primary }]}>
												DINNER
											</Text>
										</TouchableOpacity>
									</View>
								</View>
								<View style={styles.column}>
									<Text style={[styles.label, { color: colors.textSecondary }]}>Price - قیمت</Text>
									<Input
										value={formValues.price}
										onChangeText={(value) => updateField('price', value)}
										keyboardType="numeric"
									/>
								</View>
							</View>

							<View style={[styles.row, stacked && styles.rowStacked]}>
								<View style={[styles.column, stacked ? styles.columnStacked : styles.columnSpaced]}>
									<Text style={[styles.label, { color: colors.textSecondary }]}>Start - تاریخ آغاز</Text>
									<Input
										value={formValues.startDate}
										onChangeText={(value) => updateField('startDate', value)}
										placeholder="YYYY-MM-DD"
									/>
								</View>
								<View style={styles.column}>
									<Text style={[styles.label, { color: colors.textSecondary }]}>End - تاریخ ختم</Text>
									<Input
										value={formValues.endDate}
										onChangeText={(value) => updateField('endDate', value)}
										placeholder="YYYY-MM-DD"
									/>
								</View>
							</View>

							<Text style={[styles.label, { color: colors.textSecondary }]}>Notes - نوٹ</Text>
							<Input
								value={formValues.notes}
								onChangeText={(value) => updateField('notes', value)}
								placeholder="Any specific instructions..."
							/>

							<View style={styles.formFooter}>
								<MaterialCommunityIcons name="information-outline" size={14} color={colors.textMuted} />
								<Text style={[styles.formInfo, { color: colors.textMuted }]}>Save the customer from this dialog</Text>
							</View>

							<View style={[styles.footer, stacked && styles.footerStacked]}>
								<Button
									title="Cancel"
									variant="outline"
									onPress={onClose}
									disabled={submitting}
									fullWidth={stacked}
									style={stacked ? styles.footerButtonStacked : styles.footerButton}
								/>
								<Button
									title="Save Customer"
									iconLeft="content-save-check"
									onPress={() => onSubmit(formValues)}
									loading={submitting}
									disabled={submitting}
									fullWidth={stacked}
									style={stacked ? styles.footerButtonStacked : styles.footerButton}
								/>
							</View>
						</View>
					</ScrollView>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: Theme.spacing.xl,
	},
	backdrop: {
		...StyleSheet.absoluteFillObject,
	},
	dialog: {
		maxHeight: '92%',
		borderRadius: Theme.radius.xl,
		borderWidth: 1,
		overflow: 'hidden',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: Theme.spacing.xl,
		paddingVertical: Theme.spacing.lg,
		borderBottomWidth: 1,
	},
	headerText: {
		flex: 1,
	},
	title: {
		...Theme.typography.labelMedium,
		textTransform: 'uppercase',
		letterSpacing: 1,
	},
	subtitle: {
		...Theme.typography.detail,
		marginTop: 2,
		textTransform: 'uppercase',
		letterSpacing: 0.8,
	},
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	content: {
		flexGrow: 0,
	},
	contentInner: {
		paddingHorizontal: Theme.spacing.xl,
		paddingTop: Theme.spacing.md,
		paddingBottom: Theme.spacing.xl,
	},
	form: {
		paddingBottom: Theme.spacing.sm,
	},
	label: {
		...Theme.typography.labelMedium,
		marginBottom: Theme.spacing.xs,
		marginTop: Theme.spacing.sm,
	},
	row: {
		flexDirection: 'row',
		marginTop: Theme.spacing.xs,
	},
	rowStacked: {
		flexDirection: 'column',
	},
	column: {
		flex: 1,
	},
	columnSpaced: {
		marginRight: 10,
	},
	columnStacked: {
		marginRight: 0,
	},
	planSelector: {
		flexDirection: 'row',
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
		borderWidth: 1,
	},
	planOptionText: {
		...Theme.typography.label,
	},
	formFooter: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.xs,
		marginTop: Theme.spacing.xl,
		alignSelf: 'center',
	},
	formInfo: {
		...Theme.typography.detail,
		fontStyle: 'italic',
	},
	footer: {
		flexDirection: 'row',
		gap: Theme.spacing.md,
		marginTop: Theme.spacing.xl,
	},
	footerStacked: {
		flexDirection: 'column',
	},
	footerButton: {
		flex: 1,
	},
	footerButtonStacked: {
		width: '100%',
	},
});
