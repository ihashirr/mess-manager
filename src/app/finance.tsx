import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppModal } from '../components/ui/AppModal';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader, ScreenHeaderActionButton } from '../components/ui/ScreenHeader';
import { useResponsiveLayout } from '../components/ui/useResponsiveLayout';
import { Theme } from '../constants/Theme';
import { useAppTheme } from '../context/ThemeModeContext';
import { db } from '../firebase/config';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { getFirestoreErrorMessage } from '../utils/firestoreErrors';
import {
	getReceiptScannerConfigMessage,
	isReceiptScannerConfigured,
	scanReceiptImage,
	type ReceiptExpenseDraft,
	type ReceiptLineItem,
} from '../utils/receiptScanner';

type FinanceCustomer = {
	id: string;
	pricePerMonth: number;
	totalPaid: number;
	endDate: unknown;
	isActive: boolean;
};

type Transaction = {
	id: string;
	customerId: string;
	customerName: string;
	amount: number;
	date: unknown;
	method?: string;
	isOrphan?: boolean;
};

type ExpenseEntry = {
	id: string;
	title: string;
	merchantName?: string;
	total: number;
	date: unknown;
	monthTag: string;
	currency?: string;
	source?: string;
	note?: string;
	items?: ReceiptLineItem[];
	confidence?: number;
};

export default function FinanceScreen() {
	const { colors, isDark } = useAppTheme();
	const { contentPadding, maxContentWidth, stacked, gridColumns } = useResponsiveLayout();
	const scannerEnabled = isReceiptScannerConfigured();
	const [financeCustomers, setFinanceCustomers] = useState<FinanceCustomer[]>([]);
	const [rawTransactions, setRawTransactions] = useState<Transaction[]>([]);
	const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
	const [customersReady, setCustomersReady] = useState(false);
	const [paymentsReady, setPaymentsReady] = useState(false);
	const [expensesReady, setExpensesReady] = useState(false);
	const [scannerOpen, setScannerOpen] = useState(false);
	const [scannerBusy, setScannerBusy] = useState(false);
	const [savingExpense, setSavingExpense] = useState(false);
	const [scannerError, setScannerError] = useState('');
	const [receiptPreviewUri, setReceiptPreviewUri] = useState<string | null>(null);
	const [receiptDraft, setReceiptDraft] = useState<ReceiptExpenseDraft | null>(null);

	const handleSnapshotError = (context: string, error: unknown) => {
		console.error(`Firestore ${context} listener failed:`, error);
		Alert.alert('Firestore access failed', getFirestoreErrorMessage(error, `Could not load ${context}.`));
		if (context === 'customers') {
			setCustomersReady(true);
		}
		if (context === 'payments') {
			setPaymentsReady(true);
		}
		if (context === 'expenses') {
			setExpensesReady(true);
		}
	};

	useEffect(() => {
		const currentMonthTag = formatMonthTag(new Date());
		const qCustomers = query(collection(db, 'customers'), where('isActive', '==', true));
		const qPayments = query(collection(db, 'payments'), where('monthTag', '==', currentMonthTag));
		const qExpenses = query(collection(db, 'expenses'), where('monthTag', '==', currentMonthTag));

		const unsubscribeCustomers = onSnapshot(
			qCustomers,
			(snapshot) => {
				setFinanceCustomers(
					snapshot.docs.map((customerDoc) => ({
						id: customerDoc.id,
						...(customerDoc.data() as Omit<FinanceCustomer, 'id'>),
					}))
				);
				setCustomersReady(true);
			},
			(error) => handleSnapshotError('customers', error)
		);

		const unsubscribePayments = onSnapshot(
			qPayments,
			(snapshot) => {
				setRawTransactions(
					snapshot.docs.map((paymentDoc) => ({
						id: paymentDoc.id,
						...(paymentDoc.data() as Omit<Transaction, 'id' | 'isOrphan'>),
					}))
				);
				setPaymentsReady(true);
			},
			(error) => handleSnapshotError('payments', error)
		);

		const unsubscribeExpenses = onSnapshot(
			qExpenses,
			(snapshot) => {
				setExpenses(
					snapshot.docs.map((expenseDoc) => ({
						id: expenseDoc.id,
						...(expenseDoc.data() as Omit<ExpenseEntry, 'id'>),
					}))
				);
				setExpensesReady(true);
			},
			(error) => handleSnapshotError('expenses', error)
		);

		return () => {
			unsubscribeCustomers();
			unsubscribePayments();
			unsubscribeExpenses();
		};
	}, []);

	const transactions = rawTransactions
		.map((transaction) => ({
			...transaction,
			isOrphan: !financeCustomers.some((customer) => customer.id === transaction.customerId),
		}))
		.sort((left, right) => toDate(right.date).getTime() - toDate(left.date).getTime());

	const expenseEntries = [...expenses].sort(
		(left, right) => toDate(right.date).getTime() - toDate(left.date).getTime()
	);

	const metrics = {
		expected: financeCustomers.reduce(
			(sum, customer) => sum + (customer.isActive ? customer.pricePerMonth || 0 : 0),
			0
		),
		collected: transactions.reduce(
			(sum, transaction) => sum + (transaction.isOrphan ? 0 : transaction.amount || 0),
			0
		),
		outstanding: financeCustomers.reduce(
			(sum, customer) => sum + getDueAmount(customer.pricePerMonth || 0, customer.totalPaid || 0),
			0
		),
		activeCount: financeCustomers.filter(
			(customer) => customer.isActive && getDaysLeft(toDate(customer.endDate)) >= 0
		).length,
		expenses: expenseEntries.reduce((sum, expense) => sum + (expense.total || 0), 0),
	};

	const netCash = metrics.collected - metrics.expenses;
	const percentage = Math.min(100, Math.round((metrics.collected / metrics.expected) * 100 || 0));
	const loading = !customersReady || !paymentsReady || !expensesReady;

	const handleDeleteTransaction = async (id: string) => {
		try {
			await deleteDoc(doc(db, 'payments', id));
		} catch (error) {
			console.error('Error deleting transaction:', error);
		}
	};

	const handleDeleteExpense = async (id: string) => {
		try {
			await deleteDoc(doc(db, 'expenses', id));
		} catch (error) {
			console.error('Error deleting expense:', error);
		}
	};

	const closeScanner = () => {
		setScannerOpen(false);
		setScannerBusy(false);
		setSavingExpense(false);
		setScannerError('');
		setReceiptPreviewUri(null);
		setReceiptDraft(null);
	};

	const updateReceiptDraft = <K extends keyof ReceiptExpenseDraft,>(
		field: K,
		value: ReceiptExpenseDraft[K]
	) => {
		setReceiptDraft((current) => (current ? { ...current, [field]: value } : current));
	};

	const launchReceiptFlow = async (source: 'camera' | 'library') => {
		setScannerError('');

		if (!scannerEnabled) {
			setScannerError(getReceiptScannerConfigMessage());
			return;
		}

		try {
			let result: ImagePicker.ImagePickerResult;

			if (source === 'camera') {
				const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
				if (!cameraPermission.granted) {
					setScannerError('Camera permission is required to scan a receipt.');
					return;
				}

				result = await ImagePicker.launchCameraAsync({
					mediaTypes: ['images'],
					base64: true,
					quality: 0.65,
				});
			} else {
				const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
				if (!libraryPermission.granted) {
					setScannerError('Photo library permission is required to import a receipt.');
					return;
				}

				result = await ImagePicker.launchImageLibraryAsync({
					mediaTypes: ['images'],
					base64: true,
					quality: 0.65,
				});
			}

			if (result.canceled) {
				return;
			}

			const asset = result.assets?.[0];

			if (!asset?.base64) {
				setScannerError('The selected image could not be prepared for OCR. Try another photo.');
				return;
			}

			setReceiptPreviewUri(asset.uri);
			setReceiptDraft(null);
			setScannerBusy(true);

			const draft = await scanReceiptImage({
				base64: asset.base64,
				mimeType: asset.mimeType || 'image/jpeg',
			});

			setReceiptDraft(draft);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Receipt scanning failed unexpectedly.';
			setScannerError(message);
		} finally {
			setScannerBusy(false);
		}
	};

	const saveScannedExpense = async () => {
		if (!receiptDraft) {
			return;
		}

		if (!Number.isFinite(receiptDraft.total) || receiptDraft.total <= 0) {
			setScannerError('The detected total looks invalid. Edit the value before saving.');
			return;
		}

		const receiptDate = normalizeDraftDate(receiptDraft.receiptDate);
		const payload = {
			title: receiptDraft.expenseTitle.trim() || receiptDraft.merchantName.trim() || 'Scanned receipt',
			merchantName: receiptDraft.merchantName.trim(),
			total: roundMoney(receiptDraft.total),
			date: receiptDate,
			monthTag: formatMonthTag(receiptDate),
			currency: receiptDraft.currency || 'DHS',
			source: 'receipt-scan',
			note: receiptDraft.note.trim(),
			items: receiptDraft.items.filter((item) => item.name.trim()),
			confidence: receiptDraft.confidence,
		};

		try {
			setSavingExpense(true);

			await addDoc(collection(db, 'expenses'), payload);

			closeScanner();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Saving the scanned expense failed.';
			setScannerError(message);
		} finally {
			setSavingExpense(false);
		}
	};

	if (loading) {
		return (
			<View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
				<ActivityIndicator size="large" color={colors.primary} />
				<Text style={[styles.loadingText, { color: colors.textPrimary }]}>Loading Finance...</Text>
			</View>
		);
	}

	const metricCardStyles = gridColumns === 1 ? [styles.card, styles.cardFullWidth] : [styles.card];
	const transactionCardBaseStyles = stacked
		? [styles.transactionCard, styles.transactionCardStacked]
		: [styles.transactionCard];

	return (
		<Screen scrollable={false}>
			<ScreenHeader
				edgeToEdge={false}
				title="Finance Panel"
				subtitle={`${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} Summary`}
				rightAction={
					<ScreenHeaderActionButton
						icon="receipt-text-check"
						onPress={() => setScannerOpen(true)}
						accessibilityLabel="Open receipt scanner"
					/>
				}
			/>

			<ScrollView
				contentContainerStyle={[
					styles.content,
					{
						paddingHorizontal: contentPadding,
						width: '100%',
						maxWidth: maxContentWidth,
						alignSelf: 'center',
					},
				]}
				showsVerticalScrollIndicator={false}
			>
				<Card style={styles.scannerPanel}>
					<View style={[styles.sectionRow, stacked && styles.sectionRowStacked]}>
						<View style={styles.sectionHeading}>
							<Text style={styles.sectionTitle}>Receipt Scanner</Text>
							<Text style={styles.sectionCopy}>
								Capture grocery and supply receipts, detect totals and item names, then deduct the expense from net cash.
							</Text>
						</View>
						<Badge
							label={scannerEnabled ? 'OCR READY' : 'KEY NEEDED'}
							variant={scannerEnabled ? 'success' : 'warning'}
						/>
					</View>
					<View style={styles.scannerButtons}>
						<Button
							title="Scan Receipt"
							iconLeft="receipt-text-check"
							onPress={() => setScannerOpen(true)}
							style={styles.primaryScannerButton}
							fullWidth
						/>
					</View>
					<Text style={styles.scannerHint}>
						{scannerEnabled
							? 'Scanned receipts land in the expense ledger below and update net cash immediately.'
							: getReceiptScannerConfigMessage()}
					</Text>
				</Card>

				<View style={styles.grid}>
					<Card style={[...metricCardStyles, { borderLeftColor: colors.success }]}>
						<Text style={[styles.label, { color: colors.textMuted }]}>EXPECTED</Text>
						<Text style={[styles.value, { color: colors.textPrimary }]}>{formatAmount(metrics.expected)}</Text>
						<Text style={[styles.cardSubText, { color: colors.textMuted }]}>Monthly Goal</Text>
					</Card>

					<Card style={[...metricCardStyles, { borderLeftColor: colors.primary }]}>
						<Text style={[styles.label, { color: colors.textMuted }]}>COLLECTED</Text>
						<Text style={[styles.value, { color: colors.textPrimary }]}>{formatAmount(metrics.collected)}</Text>
						<Text style={[styles.cardSubText, { color: colors.textMuted }]}>Received So Far</Text>
					</Card>

					<Card style={[...metricCardStyles, { borderLeftColor: colors.danger }]}>
						<Text style={[styles.label, { color: colors.textMuted }]}>OUTSTANDING</Text>
						<Text style={[styles.value, { color: colors.textPrimary }]}>{formatAmount(metrics.outstanding)}</Text>
						<Text style={[styles.cardSubText, { color: colors.textMuted }]}>Still To Collect</Text>
					</Card>

					<Card style={[...metricCardStyles, { borderLeftColor: colors.warning }]}>
						<Text style={[styles.label, { color: colors.textMuted }]}>ACTIVE SUBS</Text>
						<Text style={[styles.value, { color: colors.textPrimary }]}>{metrics.activeCount}</Text>
						<Text style={[styles.cardSubText, { color: colors.textMuted }]}>Paying Members</Text>
					</Card>

					<Card style={[...metricCardStyles, { borderLeftColor: colors.mealDinner }]}>
						<Text style={[styles.label, { color: colors.textMuted }]}>EXPENSES</Text>
						<Text style={[styles.value, { color: colors.textPrimary }]}>{formatAmount(metrics.expenses)}</Text>
						<Text style={[styles.cardSubText, { color: colors.textMuted }]}>Receipt Outflow</Text>
					</Card>

					<Card
						style={[
							...metricCardStyles,
							{ borderLeftColor: netCash >= 0 ? colors.success : colors.danger },
						]}
					>
						<Text style={[styles.label, { color: colors.textMuted }]}>NET CASH</Text>
						<Text style={[styles.value, { color: colors.textPrimary }]}>{formatAmount(netCash)}</Text>
						<Text style={[styles.cardSubText, { color: colors.textMuted }]}>Collected Less Expenses</Text>
					</Card>
				</View>

				<Card style={styles.progressSection}>
					<View style={[styles.rowBetween, stacked && styles.rowBetweenStacked]}>
						<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Collection Goal</Text>
						<Text style={[styles.percentageText, { color: colors.success }]}>{percentage}%</Text>
					</View>
					<View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
						<View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: colors.success }]} />
					</View>
					<View style={[styles.goalFooter, stacked && styles.goalFooterStacked]}>
						<Text style={[styles.goalFooterText, { color: colors.textSecondary }]}>Net cash after receipts: {formatAmount(netCash)}</Text>
						{metrics.collected > metrics.expected ? (
							<Text style={[styles.surplusText, { color: colors.primary }]}>Surplus: {formatAmount(metrics.collected - metrics.expected)}</Text>
						) : null}
					</View>
				</Card>

				<View style={styles.historySection}>
					<View style={[styles.rowBetween, stacked && styles.rowBetweenStacked]}>
						<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Expenses</Text>
						<Text style={[styles.countBadge, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary }]}>{expenseEntries.length}</Text>
					</View>

					{expenseEntries.length === 0 ? (
						<View style={styles.emptyCard}>
							<Text style={[styles.emptyText, { color: colors.textMuted }]}>No receipts saved this month</Text>
						</View>
					) : (
						expenseEntries.map((expense) => (
							<Card borderless key={expense.id} style={styles.expenseCard}>
								<View style={styles.txIconContainer}>
									<MaterialCommunityIcons
										name={expense.source === 'receipt-scan' ? 'receipt-text' : 'cash-minus'}
										size={20}
										color={colors.danger}
									/>
								</View>
								<View style={styles.expenseContent}>
									<View style={[styles.expenseTopRow, stacked && styles.expenseTopRowStacked]}>
										<Text style={[styles.txName, { color: colors.textPrimary }]}>{expense.title}</Text>
										<Text style={[styles.expenseAmount, { color: colors.danger }]}>
											-{formatAmount(expense.total, expense.currency || 'DHS')}
										</Text>
									</View>
									<Text style={[styles.txDate, { color: colors.textMuted }]}>
										{expense.merchantName || 'Receipt'} • {toDate(expense.date).toLocaleDateString()}
									</Text>
									{!!expense.items?.length && (
										<Text style={[styles.expenseItemsPreview, { color: colors.textSecondary }]} numberOfLines={2}>
											{expense.items.slice(0, 4).map((item) => item.name).join(' • ')}
										</Text>
									)}
									<View style={styles.expenseMetaRow}>
										<Badge
											label={`${expense.items?.length || 0} ITEMS`}
											variant="neutral"
											style={styles.metaBadge}
										/>
										{typeof expense.confidence === 'number' && (
											<Badge
												label={`OCR ${Math.round(expense.confidence * 100)}%`}
												variant={getConfidenceVariant(expense.confidence)}
												style={styles.metaBadge}
											/>
										)}
									</View>
								</View>
								<TouchableOpacity
									onPress={() => handleDeleteExpense(expense.id)}
									style={styles.txDelete}
								>
									<MaterialCommunityIcons name="delete-outline" size={18} color={colors.danger} />
								</TouchableOpacity>
							</Card>
						))
					)}
				</View>

				<View style={styles.historySection}>
					<View style={[styles.rowBetween, stacked && styles.rowBetweenStacked]}>
						<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Transactions</Text>
						<Text style={[styles.countBadge, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary }]}>{transactions.length}</Text>
					</View>

					{transactions.length === 0 ? (
						<View style={styles.emptyCard}>
							<Text style={[styles.emptyText, { color: colors.textMuted }]}>No payments recorded this month</Text>
						</View>
					) : (
						transactions.map((transaction) => (
							<Card
								borderless
								key={transaction.id}
								style={transaction.isOrphan ? [...transactionCardBaseStyles, styles.orphanCard] : transactionCardBaseStyles}
							>
								<View style={styles.txIconContainer}>
									<MaterialCommunityIcons
										name={transaction.method === 'bank' ? 'bank' : 'cash-multiple'}
										size={20}
										color={transaction.isOrphan ? colors.textMuted : colors.primary}
									/>
								</View>
								<View style={styles.transactionContent}>
									<Text style={[styles.txName, { color: colors.textPrimary }]}>
										{transaction.customerName}
										{transaction.isOrphan ? ' (Deleted)' : ''}
									</Text>
									<Text style={[styles.txDate, { color: colors.textMuted }]}>{toDate(transaction.date).toLocaleDateString()}</Text>
								</View>
								<View style={[styles.txRight, stacked && styles.txRightStacked]}>
									<Text style={[styles.txAmount, { color: colors.primary }]}>{formatAmount(transaction.amount)}</Text>
									<TouchableOpacity
										onPress={() => handleDeleteTransaction(transaction.id)}
										style={styles.txDelete}
									>
										<MaterialCommunityIcons name="delete-outline" size={16} color={colors.danger} />
									</TouchableOpacity>
								</View>
							</Card>
						))
					)}
				</View>
			</ScrollView>

			<AppModal
				visible={scannerOpen}
				onClose={closeScanner}
				title="Receipt OCR Scanner"
				subtitle="Scan, review, and save expense deductions"
			>
				<View style={styles.modalSection}>
					<View style={[styles.modalActionRow, stacked && styles.modalActionRowStacked]}>
						<Button
							title="Take Receipt"
							iconLeft="camera-outline"
							onPress={() => launchReceiptFlow('camera')}
							disabled={scannerBusy || savingExpense}
							style={stacked ? [styles.modalActionButton, styles.modalActionButtonStacked] : styles.modalActionButton}
							fullWidth
						/>
						<Button
							title="Choose Photo"
							variant="outline"
							iconLeft="image-outline"
							onPress={() => launchReceiptFlow('library')}
							disabled={scannerBusy || savingExpense}
							style={stacked ? [styles.modalActionButton, styles.modalActionButtonStacked] : styles.modalActionButton}
							fullWidth
						/>
					</View>

					{receiptPreviewUri && (
						<View style={styles.previewShell}>
							<Image source={{ uri: receiptPreviewUri }} style={styles.receiptPreview} />
						</View>
					)}

					{scannerBusy && (
						<View style={styles.scannerLoading}>
							<ActivityIndicator size="large" color={colors.primary} />
							<Text style={[styles.scannerLoadingTitle, { color: colors.textPrimary }]}>Reading receipt...</Text>
							<Text style={[styles.scannerLoadingText, { color: colors.textMuted }]}>
								Extracting totals and item names from the photo.
							</Text>
						</View>
					)}

					{!!scannerError && (
						<View
							style={[
								styles.errorCard,
								{
									backgroundColor: isDark ? 'rgba(231, 76, 60, 0.14)' : '#ffebee',
									borderColor: colors.danger,
								},
							]}
						>
							<MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
							<Text style={[styles.errorText, { color: colors.danger }]}>{scannerError}</Text>
						</View>
					)}

					{receiptDraft && (
						<View style={styles.modalSection}>
							<View style={[styles.rowBetween, stacked && styles.rowBetweenStacked]}>
								<Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Detected Receipt</Text>
								<View style={styles.expenseMetaRow}>
									<Badge
										label={`${receiptDraft.items.length} ITEMS`}
										variant="neutral"
										style={styles.metaBadge}
									/>
									<Badge
										label={`OCR ${Math.round(receiptDraft.confidence * 100)}%`}
										variant={getConfidenceVariant(receiptDraft.confidence)}
										style={styles.metaBadge}
									/>
								</View>
							</View>

							<Input
								label="Merchant"
								value={receiptDraft.merchantName}
								onChangeText={(value) => updateReceiptDraft('merchantName', value)}
							/>
							<Input
								label="Expense Title"
								value={receiptDraft.expenseTitle}
								onChangeText={(value) => updateReceiptDraft('expenseTitle', value)}
							/>
							<View style={[styles.modalFieldRow, stacked && styles.modalFieldRowStacked]}>
								<View style={styles.modalFieldHalf}>
									<Input
										label="Total"
										value={String(receiptDraft.total)}
										onChangeText={(value) => updateReceiptDraft('total', parseMoneyInput(value))}
										keyboardType="decimal-pad"
									/>
								</View>
								<View style={styles.modalFieldHalf}>
									<Input
										label="Date"
										value={receiptDraft.receiptDate}
										onChangeText={(value) => updateReceiptDraft('receiptDate', value)}
										placeholder="YYYY-MM-DD"
									/>
								</View>
							</View>
							<Input
								label="Payment Method"
								value={receiptDraft.paymentMethod}
								onChangeText={(value) => updateReceiptDraft('paymentMethod', value)}
								placeholder="Cash / Card / Bank"
							/>
							<Input
								label="Scanner Note"
								value={receiptDraft.note}
								onChangeText={(value) => updateReceiptDraft('note', value)}
								placeholder="Optional note about the receipt"
								multiline
							/>

							<View style={styles.breakdownRow}>
								<Badge
									label={`SUBTOTAL ${formatAmount(receiptDraft.subtotal || 0, receiptDraft.currency)}`}
									variant="neutral"
									style={styles.metaBadge}
								/>
								<Badge
									label={`TAX ${formatAmount(receiptDraft.tax || 0, receiptDraft.currency)}`}
									variant="neutral"
									style={styles.metaBadge}
								/>
							</View>

							<View style={styles.itemSection}>
								<Text style={[styles.itemSectionTitle, { color: colors.textPrimary }]}>Detected Items</Text>
								{receiptDraft.items.length === 0 ? (
									<Text style={[styles.emptyText, { color: colors.textMuted }]}>No line items were confidently detected.</Text>
								) : (
									receiptDraft.items.map((item, index) => (
										<View key={`${item.name}-${index}`} style={styles.itemRow}>
											<View style={styles.itemTextColumn}>
												<Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.name}</Text>
												<Text style={[styles.itemMeta, { color: colors.textMuted }]}>
													{item.quantity ? `Qty ${item.quantity}` : 'Qty -'}
												</Text>
											</View>
											<Text style={[styles.itemAmount, { color: colors.textPrimary }]}>
												{item.amount !== null ? formatAmount(item.amount, receiptDraft.currency) : '—'}
											</Text>
										</View>
									))
								)}
							</View>

							<Button
								title={savingExpense ? 'Saving...' : 'Save Expense'}
								iconLeft="content-save-check"
								onPress={saveScannedExpense}
								disabled={savingExpense || scannerBusy}
								fullWidth
							/>
						</View>
					)}
				</View>
			</AppModal>
		</Screen>
	);
}

function normalizeDraftDate(value: string) {
	const parsed = new Date(value);

	if (Number.isNaN(parsed.getTime())) {
		return new Date();
	}

	return parsed;
}

function formatMonthTag(value: unknown) {
	return toDate(value).toISOString().slice(0, 7);
}

function roundMoney(value: number) {
	return Math.round(value * 100) / 100;
}

function parseMoneyInput(value: string) {
	const parsed = Number.parseFloat(value.replace(/[^0-9.-]+/g, ''));

	if (!Number.isFinite(parsed)) {
		return 0;
	}

	return roundMoney(parsed);
}

function formatAmount(value: number, currency = 'DHS') {
	const normalized = Number.isFinite(value) ? roundMoney(value) : 0;
	const display = Number.isInteger(normalized) ? `${normalized}` : normalized.toFixed(2);
	return `${currency} ${display}`;
}

function getConfidenceVariant(confidence: number): BadgeVariant {
	if (confidence >= 0.85) {
		return 'success';
	}

	if (confidence >= 0.65) {
		return 'warning';
	}

	return 'danger';
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Theme.colors.bg,
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: Theme.spacing.md,
	},
	loadingText: {
		...Theme.typography.labelMedium,
	},
	content: {
		paddingBottom: 150,
	},
	scannerPanel: {
		marginTop: Theme.spacing.md,
	},
	sectionRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	sectionRowStacked: {
		flexDirection: 'column',
	},
	sectionHeading: {
		flex: 1,
	},
	sectionTitle: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
	},
	sectionCopy: {
		...Theme.typography.detail,
		color: Theme.colors.textSecondary,
		marginTop: Theme.spacing.sm,
		lineHeight: 18,
	},
	scannerButtons: {
		marginTop: Theme.spacing.lg,
	},
	primaryScannerButton: {},
	scannerHint: {
		...Theme.typography.detail,
		color: Theme.colors.textMuted,
		marginTop: Theme.spacing.md,
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		marginTop: Theme.spacing.lg,
	},
	card: {
		width: '48%',
		marginBottom: Theme.spacing.lg,
		borderLeftWidth: 4,
	},
	cardFullWidth: {
		width: '100%',
	},
	label: {
		...Theme.typography.detailBold,
		color: Theme.colors.textMuted,
		marginBottom: Theme.spacing.xs,
	},
	value: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
	},
	cardSubText: {
		...Theme.typography.detail,
		color: Theme.colors.textMuted,
		marginTop: Theme.spacing.xs,
	},
	progressSection: {
		borderRadius: Theme.radius.xl,
		marginTop: Theme.spacing.xs,
	},
	rowBetween: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: Theme.spacing.sm,
	},
	rowBetweenStacked: {
		flexDirection: 'column',
		alignItems: 'flex-start',
	},
	percentageText: {
		...Theme.typography.labelMedium,
		color: Theme.colors.success,
	},
	progressBarBg: {
		height: 12,
		backgroundColor: Theme.colors.border,
		borderRadius: Theme.radius.sm,
		overflow: 'hidden',
	},
	progressBarFill: {
		height: '100%',
		backgroundColor: Theme.colors.success,
		borderRadius: Theme.radius.sm,
	},
	goalFooter: {
		marginTop: Theme.spacing.md,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Theme.spacing.sm,
	},
	goalFooterStacked: {
		flexDirection: 'column',
		alignItems: 'flex-start',
	},
	goalFooterText: {
		...Theme.typography.detailBold,
		color: Theme.colors.textSecondary,
	},
	surplusText: {
		...Theme.typography.detailBold,
		color: Theme.colors.primary,
	},
	historySection: {
		marginTop: Theme.spacing.xl,
	},
	countBadge: {
		backgroundColor: Theme.colors.surfaceElevated,
		color: Theme.colors.textPrimary,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.xs,
		borderRadius: Theme.radius.md,
		...Theme.typography.detailBold,
		overflow: 'hidden',
	},
	transactionCard: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: Theme.spacing.xs,
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.border,
		paddingVertical: Theme.spacing.sm,
	},
	transactionCardStacked: {
		alignItems: 'flex-start',
	},
	expenseCard: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: Theme.spacing.xs,
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.border,
		paddingVertical: Theme.spacing.sm,
	},
	txIconContainer: {
		width: 40,
		height: 40,
		backgroundColor: Theme.colors.bg,
		borderRadius: Theme.radius.lg,
		justifyContent: 'center',
		alignItems: 'center',
	},
	transactionContent: {
		flex: 1,
		marginLeft: 12,
	},
	expenseContent: {
		flex: 1,
		marginLeft: 12,
	},
	expenseTopRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	expenseTopRowStacked: {
		flexDirection: 'column',
	},
	orphanCard: {
		opacity: 0.6,
		backgroundColor: Theme.colors.bg,
	},
	txName: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
	},
	txDate: {
		...Theme.typography.detail,
		color: Theme.colors.textMuted,
		marginTop: Theme.spacing.xs,
	},
	txRight: {
		alignItems: 'flex-end',
		justifyContent: 'center',
	},
	txRightStacked: {
		alignItems: 'flex-start',
		marginLeft: 52,
		marginTop: Theme.spacing.sm,
	},
	txAmount: {
		...Theme.typography.labelMedium,
		color: Theme.colors.primary,
	},
	expenseAmount: {
		...Theme.typography.labelMedium,
		color: Theme.colors.danger,
	},
	txDelete: {
		marginTop: 4,
		paddingHorizontal: Theme.spacing.xs,
	},
	expenseItemsPreview: {
		...Theme.typography.detail,
		color: Theme.colors.textSecondary,
		marginTop: Theme.spacing.xs,
	},
	expenseMetaRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.sm,
	},
	metaBadge: {
		marginRight: Theme.spacing.sm,
	},
	emptyCard: {
		backgroundColor: Theme.colors.surface,
		padding: Theme.spacing.massive,
		borderRadius: Theme.radius.xl,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: Theme.colors.border,
	},
	emptyText: {
		...Theme.typography.label,
		color: Theme.colors.textMuted,
		fontStyle: 'italic',
	},
	modalSection: {
		gap: Theme.spacing.md,
	},
	modalActionRow: {
		flexDirection: 'row',
		gap: Theme.spacing.md,
	},
	modalActionRowStacked: {
		flexDirection: 'column',
	},
	modalActionButton: {
		flex: 1,
	},
	modalActionButtonStacked: {
		flex: 0,
	},
	previewShell: {
		backgroundColor: Theme.colors.surfaceElevated,
		borderRadius: Theme.radius.lg,
		overflow: 'hidden',
		borderWidth: 1,
		borderColor: Theme.colors.border,
	},
	receiptPreview: {
		width: '100%',
		height: 180,
		resizeMode: 'cover',
	},
	scannerLoading: {
		paddingVertical: Theme.spacing.xl,
		alignItems: 'center',
		gap: Theme.spacing.sm,
	},
	scannerLoadingTitle: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
	},
	scannerLoadingText: {
		...Theme.typography.detail,
		color: Theme.colors.textMuted,
		textAlign: 'center',
	},
	errorCard: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: Theme.spacing.sm,
		padding: Theme.spacing.md,
		backgroundColor: '#ffebee',
		borderRadius: Theme.radius.md,
		borderWidth: 1,
		borderColor: Theme.colors.danger,
	},
	errorText: {
		flex: 1,
		...Theme.typography.detail,
		color: Theme.colors.danger,
	},
	modalFieldRow: {
		flexDirection: 'row',
		gap: Theme.spacing.md,
	},
	modalFieldRowStacked: {
		flexDirection: 'column',
	},
	modalFieldHalf: {
		flex: 1,
	},
	breakdownRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: Theme.spacing.sm,
	},
	itemSection: {
		gap: Theme.spacing.sm,
	},
	itemSectionTitle: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
	},
	itemRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: Theme.spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.border,
		gap: Theme.spacing.md,
	},
	itemTextColumn: {
		flex: 1,
	},
	itemName: {
		...Theme.typography.labelMedium,
		color: Theme.colors.textPrimary,
	},
	itemMeta: {
		...Theme.typography.detail,
		color: Theme.colors.textMuted,
		marginTop: 2,
	},
	itemAmount: {
		...Theme.typography.detailBold,
		color: Theme.colors.textPrimary,
	},
});
