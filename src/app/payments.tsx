import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Clock3, PackageCheck, Plus, ShoppingBag, type LucideIcon, Users } from 'lucide-react-native';
import AnimatedReanimated, { FadeInUp } from 'react-native-reanimated';
import { showToast } from '../components/system/feedback/AppToast';
import { Badge, Button, Card, FoodEmptyStateArt, FullScreenModal, Input, PrimaryPanel, Screen, type FullScreenModalHandle } from '../components/ui';
import { Theme } from '../constants/Theme';
import { useAppHeader } from '../context/HeaderContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { usePagerFocusEffect } from '../context/PagerFocusContext';
import { useAppTheme } from '../context/ThemeModeContext';
import { useResponsiveLayout } from '../hooks';
import type { OneTimeOrder } from '../types';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';

type Payment = {
	id: string;
	name: string;
	pricePerMonth: number;
	totalPaid: number;
	isActive: boolean;
	mealsPerDay: { lunch: boolean; dinner: boolean };
	endDate: unknown;
};

type PaymentRow = Payment & {
	dueAmount: number;
	daysLeft: number;
	planLabel: string;
};

export default function PaymentsScreen() {
	return <PaymentsCollectView standalone />;
}

export function PaymentsCollectView({ standalone = false }: { standalone?: boolean }) {
	const { colors } = useAppTheme();
	const { setHeaderConfig } = useAppHeader();
	const {
		ready,
		customers,
		orders,
		recordPayment: queuePayment,
		createOneTimeOrder,
		updateOneTimeOrder,
	} = useOfflineSync();
	const { contentPadding, maxContentWidth, maxReadableWidth, stacked, font } = useResponsiveLayout();
	const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
	const orderSheetRef = useRef<FullScreenModalHandle>(null);
	const [orderSheetOpen, setOrderSheetOpen] = useState(false);
	const [orderCustomerName, setOrderCustomerName] = useState('');
	const [orderPhone, setOrderPhone] = useState('');
	const [orderMealSlot, setOrderMealSlot] = useState<OneTimeOrder['mealSlot']>('lunch');
	const [orderItemName, setOrderItemName] = useState('');
	const [orderQuantity, setOrderQuantity] = useState('1');
	const [orderPrice, setOrderPrice] = useState('');
	const [orderPaidAmount, setOrderPaidAmount] = useState('');
	const [orderNotes, setOrderNotes] = useState('');
	const [savingOrder, setSavingOrder] = useState(false);

	usePagerFocusEffect(
		'payments',
		useCallback(() => {
			if (!standalone) {
				return;
			}

			setHeaderConfig({
				title: 'Money',
				subtitle: 'Collect payments from customers',
			});
		}, [setHeaderConfig, standalone])
	);

	const paymentRows: PaymentRow[] = customers
		.filter((customer) => customer.isActive && getDueAmount(customer.pricePerMonth, customer.totalPaid) > 0)
		.map((payment) => {
			const dueAmount = getDueAmount(payment.pricePerMonth, payment.totalPaid);
			const daysLeft = getDaysLeft(toDate(payment.endDate));
			const planLabel = payment.mealsPerDay?.lunch && payment.mealsPerDay?.dinner
				? 'Lunch + Dinner'
				: payment.mealsPerDay?.lunch
					? 'Lunch only'
					: 'Dinner only';

			return {
				...payment,
				dueAmount,
				daysLeft,
				planLabel,
			};
		})
		.sort((a, b) => {
			if ((a.daysLeft < 0) !== (b.daysLeft < 0)) {
				return a.daysLeft < 0 ? -1 : 1;
			}

			if (b.dueAmount !== a.dueAmount) {
				return b.dueAmount - a.dueAmount;
			}

			return a.daysLeft - b.daysLeft;
		});

	const totalDue = paymentRows.reduce((acc, current) => acc + current.dueAmount, 0);
	const overdueCount = paymentRows.filter((payment) => payment.daysLeft < 0).length;
	const expiringSoonCount = paymentRows.filter((payment) => payment.daysLeft >= 0 && payment.daysLeft <= 3).length;
	const activeOrders = useMemo(
		() => orders
			.filter((order) => order.fulfillmentStatus !== 'cancelled')
			.sort((left, right) => {
				if (left.orderDate !== right.orderDate) {
					return right.orderDate.localeCompare(left.orderDate);
				}
				return right.updatedAt.localeCompare(left.updatedAt);
			}),
		[orders]
	);
	const unsettledOrders = activeOrders.filter((order) => getOrderDue(order) > 0);
	const todayOrders = activeOrders.filter((order) => order.orderDate === todayIso);
	const orderDue = unsettledOrders.reduce((sum, order) => sum + getOrderDue(order), 0);
	const orderCollected = activeOrders.reduce((sum, order) => sum + (order.paidAmount || 0), 0);
	const collectTotal = totalDue + orderDue;
	const actionCount = paymentRows.length + unsettledOrders.length;

	useEffect(() => {
		if (orderSheetOpen) {
			orderSheetRef.current?.present();
		} else {
			orderSheetRef.current?.dismiss();
		}
	}, [orderSheetOpen]);

	const resetOrderDraft = useCallback(() => {
		setOrderCustomerName('');
		setOrderPhone('');
		setOrderMealSlot('lunch');
		setOrderItemName('');
		setOrderQuantity('1');
		setOrderPrice('');
		setOrderPaidAmount('');
		setOrderNotes('');
		setSavingOrder(false);
	}, []);

	const closeOrderSheet = useCallback(() => {
		setOrderSheetOpen(false);
		resetOrderDraft();
	}, [resetOrderDraft]);

	const recordPayment = async (customer: PaymentRow) => {
		try {
			await queuePayment({
				customerId: customer.id,
				customerName: customer.name,
				amount: customer.pricePerMonth,
				totalPaid: customer.totalPaid,
				currentEndDate: customer.endDate,
			});
		} catch (error) {
			console.error('Error recording payment:', error);
			showToast({
				type: 'error',
				title: 'Could not record payment',
				message: error instanceof Error && error.message.trim()
					? error.message.trim()
					: 'Payment could not be recorded locally.',
			});
		}
	};

	const handleCreateOrder = async () => {
		const quantity = parseOrderNumber(orderQuantity);
		const price = parseOrderNumber(orderPrice);
		const paidAmount = parseOrderNumber(orderPaidAmount);
		const itemName = orderItemName.trim() || getMealSlotLabel(orderMealSlot);

		if (!orderCustomerName.trim()) {
			showToast({ type: 'warning', title: 'Customer name is required' });
			return;
		}

		if (quantity <= 0 || price <= 0) {
			showToast({ type: 'warning', title: 'Add a valid quantity and price' });
			return;
		}

		setSavingOrder(true);
		try {
			await createOneTimeOrder({
				customerName: orderCustomerName,
				phone: orderPhone,
				orderDate: todayIso,
				mealSlot: orderMealSlot,
				items: [
					{
						id: `item-${Date.now()}`,
						name: itemName,
						quantity,
						price,
					},
				],
				paidAmount,
				fulfillmentStatus: 'pending',
				notes: orderNotes,
			});
			showToast({ type: 'success', title: 'One-time order saved' });
			closeOrderSheet();
		} catch (error) {
			showToast({
				type: 'error',
				title: 'Could not save order',
				message: error instanceof Error && error.message.trim() ? error.message.trim() : 'Order could not be saved locally.',
			});
		} finally {
			setSavingOrder(false);
		}
	};

	const markOrderPaid = async (order: OneTimeOrder) => {
		try {
			await updateOneTimeOrder({
				...order,
				paidAmount: order.total,
				paymentStatus: 'paid',
			});
			showToast({ type: 'success', title: 'Order marked paid' });
		} catch (error) {
			showToast({
				type: 'error',
				title: 'Could not update order',
				message: error instanceof Error && error.message.trim() ? error.message.trim() : 'Order update could not be queued.',
			});
		}
	};

	const markOrderDelivered = async (order: OneTimeOrder) => {
		try {
			await updateOneTimeOrder({
				...order,
				fulfillmentStatus: 'delivered',
			});
			showToast({ type: 'success', title: 'Order marked delivered' });
		} catch (error) {
			showToast({
				type: 'error',
				title: 'Could not update order',
				message: error instanceof Error && error.message.trim() ? error.message.trim() : 'Order update could not be queued.',
			});
		}
	};

	if (!ready) {
		return (
			<View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
				<ActivityIndicator size="large" color={colors.primary} />
				<Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading payments...</Text>
			</View>
		);
	}

	return (
		<Screen
			scrollable={false}
			maxContentWidth={maxReadableWidth}
			atmosphere={{
				ambientEnergy: 'calm',
				intensity: 'subtle',
				warmLighting: true,
			}}
		>
			<>
			<FlatList
				style={styles.flex}
				data={paymentRows}
				keyExtractor={(item) => item.id}
				contentContainerStyle={{
					paddingHorizontal: contentPadding,
					paddingBottom: 150,
					width: '100%',
					maxWidth: Math.min(maxContentWidth, maxReadableWidth),
					alignSelf: 'center',
				}}
				showsVerticalScrollIndicator={false}
				ListHeaderComponent={
					<View style={styles.listHeader}>
						<AnimatedReanimated.View entering={FadeInUp.duration(170)}>
							<PrimaryPanel title="Collection Focus" style={styles.summaryPanel}>
								<View style={styles.summaryRow}>
									<Text style={[styles.summaryEyebrow, { color: colors.success }]}>Collect today</Text>
									<Text style={[styles.summaryValue, { color: colors.textPrimary, fontSize: font(40, 0.9, 1.08) }]} numberOfLines={1}>
										DHS {collectTotal}
									</Text>
									<Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
										{actionCount} collection action{actionCount === 1 ? '' : 's'} across subscriptions and one-time orders
									</Text>
								</View>
								<View style={styles.summaryStatsGrid}>
									<PaymentStatCard icon={AlertTriangle} label="Overdue" value={overdueCount} tone={colors.danger} filled />
									<PaymentStatCard icon={Clock3} label="Expiring soon" value={expiringSoonCount} tone={colors.warning} />
									<PaymentStatCard icon={Users} label="Accounts due" value={paymentRows.length} tone={colors.primary} />
									<PaymentStatCard icon={ShoppingBag} label="Order due" value={formatCurrency(orderDue)} tone={colors.success} />
								</View>
							</PrimaryPanel>
						</AnimatedReanimated.View>

						<View style={[styles.collectionMap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
							<Text style={[styles.collectionMapTitle, { color: colors.textPrimary }]}>Collection order</Text>
							<View style={styles.collectionSteps}>
								<CollectionStep index="1" label="Expired" detail="Recover service first" color={colors.danger} />
								<CollectionStep index="2" label="High due" detail="Prioritize larger balances" color={colors.warning} />
								<CollectionStep index="3" label="Renew" detail="Keep active plans stable" color={colors.success} />
							</View>
						</View>

						<View style={[styles.orderPanel, { backgroundColor: colors.surface, borderColor: colors.success + '2A' }]}>
							<View style={styles.orderPanelHeader}>
								<View style={styles.orderPanelTitleWrap}>
									<View style={[styles.orderIconBox, { backgroundColor: colors.success + '14' }]}>
										<ShoppingBag size={18} color={colors.success} strokeWidth={2.5} />
									</View>
									<View style={styles.orderPanelCopy}>
										<Text style={[styles.orderPanelTitle, { color: colors.textPrimary }]}>One-time orders</Text>
										<Text style={[styles.orderPanelSubtitle, { color: colors.textSecondary }]}>
											Track walk-in meals without turning them into monthly customers.
										</Text>
									</View>
								</View>
								<Button
									title="New"
									iconLeft={Plus}
									size="sm"
									onPress={() => setOrderSheetOpen(true)}
								/>
							</View>

							<View style={styles.orderStatsRow}>
								<OrderMiniStat label="Today" value={todayOrders.length} tone={colors.success} />
								<OrderMiniStat label="Due" value={formatCurrency(orderDue)} tone={orderDue > 0 ? colors.warning : colors.success} />
								<OrderMiniStat label="Collected" value={formatCurrency(orderCollected)} tone={colors.primary} />
							</View>

							{activeOrders.slice(0, 3).map((order) => (
								<OneTimeOrderCard
									key={order.id}
									order={order}
									onMarkPaid={() => markOrderPaid(order)}
									onMarkDelivered={() => markOrderDelivered(order)}
								/>
							))}
							{activeOrders.length === 0 ? (
								<View style={[styles.orderEmptyState, { backgroundColor: colors.success + '0A', borderColor: colors.success + '18' }]}>
									<Text style={[styles.orderEmptyTitle, { color: colors.textPrimary }]}>No one-time orders yet</Text>
									<Text style={[styles.orderEmptyText, { color: colors.textSecondary }]}>Use New for trial meals, party trays, or extra paid plates.</Text>
								</View>
							) : null}
						</View>

						<View style={[styles.listIntro, { backgroundColor: colors.success + '0D', borderColor: colors.success + '22' }]}>
							<View style={[styles.listIntroIcon, { backgroundColor: colors.success + '18' }]}>
								<CheckCircle2 size={17} color={colors.success} />
							</View>
							<View style={styles.listIntroCopy}>
								<Text style={[styles.listIntroTitle, { color: colors.textPrimary }]}>Payment action list</Text>
								<Text style={[styles.listIntroSubtitle, { color: colors.textSecondary }]}>
									Each card shows what is due, why it matters, and the one action to close it.
								</Text>
							</View>
						</View>
					</View>
				}
				renderItem={({ item }) => (
					<Card style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
						<View style={[styles.paymentHeader, stacked && styles.paymentHeaderStacked]}>
							<View style={styles.paymentCopy}>
								<Text style={[styles.paymentName, { color: colors.textPrimary }]}>{item.name}</Text>
								<Text style={[styles.paymentPlan, { color: colors.textSecondary }]}>{item.planLabel}</Text>
							</View>
							<View style={[styles.paymentBadgeRow, stacked && styles.paymentBadgeRowStacked]}>
								<Badge
									label={item.daysLeft < 0 ? 'Expired' : `${item.daysLeft}d left`}
									variant={item.daysLeft < 0 ? 'danger' : item.daysLeft <= 3 ? 'warning' : 'success'}
									style={styles.badgeTight}
								/>
								<Badge
									label={`DHS ${item.dueAmount} due`}
									variant={item.daysLeft < 0 ? 'danger' : 'warning'}
									style={styles.badgeTight}
								/>
							</View>
						</View>

						<View style={[styles.metaGrid, stacked && styles.metaGridStacked]}>
							<View style={[styles.metaCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
								<Text style={[styles.metaLabel, { color: colors.textMuted }]}>Paid so far</Text>
								<Text style={[styles.metaValue, { color: colors.textPrimary }]}>DHS {item.totalPaid || 0}</Text>
							</View>
							<View style={[styles.metaCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
								<Text style={[styles.metaLabel, { color: colors.textMuted }]}>Monthly fee</Text>
								<Text style={[styles.metaValue, { color: colors.textPrimary }]}>DHS {item.pricePerMonth}</Text>
							</View>
						</View>

						<Text style={[styles.paymentFootnote, { color: colors.textSecondary }]}>
							Posting the payment renews this customer for the next 30 days.
						</Text>

						<Button
							title="Record payment - ادائیگی درج کریں"
							onPress={() => recordPayment(item)}
							fullWidth
							style={styles.paymentButton}
						/>
					</Card>
				)}
				ListEmptyComponent={
					<View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
						<FoodEmptyStateArt tone={colors.success} size={104} />
						<Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>All payments are settled</Text>
						<Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Nothing needs to be collected right now.</Text>
					</View>
				}
			/>
			<FullScreenModal
				ref={orderSheetRef}
				title="New One-time Order"
				subtitle="Save a cash order without creating a monthly subscription"
				onDismiss={closeOrderSheet}
			>
				<View style={styles.orderSheetContent}>
					<Input
						label="Customer name"
						value={orderCustomerName}
						onChangeText={setOrderCustomerName}
						placeholder="Walk-in customer"
						autoCapitalize="words"
					/>
					<Input
						label="Phone optional"
						value={orderPhone}
						onChangeText={setOrderPhone}
						placeholder="+971..."
						keyboardType="phone-pad"
					/>
					<View style={styles.orderSheetBlock}>
						<Text style={[styles.orderSheetLabel, { color: colors.textSecondary }]}>Meal slot</Text>
						<View style={styles.orderChipRow}>
							{(['lunch', 'dinner', 'custom'] as const).map((slot) => (
								<TouchableOpacity
									key={slot}
									activeOpacity={0.82}
									onPress={() => setOrderMealSlot(slot)}
									style={[
										styles.orderChip,
										{
											backgroundColor: orderMealSlot === slot ? colors.success + '16' : colors.surfaceElevated,
											borderColor: orderMealSlot === slot ? colors.success + '40' : colors.border,
										},
									]}
								>
									<Text style={[styles.orderChipText, { color: orderMealSlot === slot ? colors.success : colors.textSecondary }]}>
										{getMealSlotLabel(slot)}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>
					<Input
						label="Item"
						value={orderItemName}
						onChangeText={setOrderItemName}
						placeholder={getMealSlotLabel(orderMealSlot)}
						autoCapitalize="words"
					/>
					<View style={styles.orderInputRow}>
						<Input
							label="Qty"
							value={orderQuantity}
							onChangeText={setOrderQuantity}
							keyboardType="numeric"
							containerStyle={styles.orderInputSmall}
						/>
						<Input
							label="Price"
							value={orderPrice}
							onChangeText={setOrderPrice}
							keyboardType="numeric"
							placeholder="DHS"
							containerStyle={styles.orderInputLarge}
						/>
					</View>
					<Input
						label="Paid now"
						value={orderPaidAmount}
						onChangeText={setOrderPaidAmount}
						keyboardType="numeric"
						placeholder="0 if unpaid"
					/>
					<Input
						label="Notes"
						value={orderNotes}
						onChangeText={setOrderNotes}
						placeholder="Delivery time, address, or special request"
						multiline
					/>
					<Button
						title="Save Order"
						iconLeft={PackageCheck}
						onPress={handleCreateOrder}
						loading={savingOrder}
						fullWidth
					/>
				</View>
			</FullScreenModal>
			</>
		</Screen>
	);
}

function PaymentStatCard({
	icon: Icon,
	label,
	value,
	tone,
	filled = false,
}: {
	icon: LucideIcon;
	label: string;
	value: number | string;
	tone: string;
	filled?: boolean;
}) {
	const { colors } = useAppTheme();
	return (
		<View style={[styles.statCard, { backgroundColor: filled ? tone + '12' : colors.surfaceElevated, borderColor: filled ? tone + '28' : colors.border }]}>
			<View style={[styles.statIconBox, { backgroundColor: filled ? colors.surface : tone + '12' }]}>
				<Icon size={15} color={tone} strokeWidth={2.4} />
			</View>
			<View style={styles.statCopy}>
				<Text style={[styles.statValue, { color: colors.textPrimary }]} numberOfLines={1}>{value}</Text>
				<Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
			</View>
		</View>
	);
}

function CollectionStep({
	index,
	label,
	detail,
	color,
}: {
	index: string;
	label: string;
	detail: string;
	color: string;
}) {
	const { colors } = useAppTheme();
	return (
		<View style={[styles.collectionStep, { backgroundColor: color + '0D', borderColor: color + '24' }]}>
			<View style={[styles.collectionStepIndex, { backgroundColor: color }]}>
				<Text style={styles.collectionStepIndexText}>{index}</Text>
			</View>
			<Text style={[styles.collectionStepLabel, { color: colors.textPrimary }]}>{label}</Text>
			<Text style={[styles.collectionStepDetail, { color: colors.textSecondary }]}>{detail}</Text>
		</View>
	);
}

function OrderMiniStat({
	label,
	value,
	tone,
}: {
	label: string;
	value: number | string;
	tone: string;
}) {
	const { colors } = useAppTheme();
	return (
		<View style={[styles.orderMiniStat, { backgroundColor: tone + '0D', borderColor: tone + '22' }]}>
			<Text style={[styles.orderMiniValue, { color: colors.textPrimary }]} numberOfLines={1}>
				{value}
			</Text>
			<Text style={[styles.orderMiniLabel, { color: colors.textSecondary }]}>{label}</Text>
		</View>
	);
}

function OneTimeOrderCard({
	order,
	onMarkPaid,
	onMarkDelivered,
}: {
	order: OneTimeOrder;
	onMarkPaid: () => void;
	onMarkDelivered: () => void;
}) {
	const { colors } = useAppTheme();
	const due = getOrderDue(order);
	const firstItem = order.items[0];
	const fulfillmentDone = order.fulfillmentStatus === 'delivered';

	return (
		<View style={[styles.orderCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
			<View style={styles.orderCardTop}>
				<View style={styles.orderCardCopy}>
					<Text style={[styles.orderCustomer, { color: colors.textPrimary }]} numberOfLines={1}>
						{order.customerName}
					</Text>
					<Text style={[styles.orderDetail, { color: colors.textSecondary }]} numberOfLines={1}>
						{getMealSlotLabel(order.mealSlot)} • {firstItem ? `${firstItem.quantity} x ${firstItem.name}` : 'Custom order'}
					</Text>
				</View>
				<View style={styles.orderAmountBlock}>
					<Text style={[styles.orderAmount, { color: due > 0 ? colors.warning : colors.success }]}>
						{due > 0 ? formatCurrency(due) : 'Paid'}
					</Text>
					<Badge label={order.fulfillmentStatus} variant={fulfillmentDone ? 'success' : 'warning'} style={styles.badgeTight} />
				</View>
			</View>
			<View style={styles.orderActions}>
				{due > 0 ? (
					<Button title="Paid" size="sm" variant="secondary" onPress={onMarkPaid} style={styles.orderActionButton} />
				) : null}
				{!fulfillmentDone ? (
					<Button title="Delivered" size="sm" variant="ghost" onPress={onMarkDelivered} style={styles.orderActionButton} />
				) : null}
			</View>
		</View>
	);
}

function getOrderDue(order: OneTimeOrder) {
	return Math.max(0, Math.round(((order.total || 0) - (order.paidAmount || 0)) * 100) / 100);
}

function getMealSlotLabel(slot: OneTimeOrder['mealSlot']) {
	if (slot === 'lunch') return 'Lunch';
	if (slot === 'dinner') return 'Dinner';
	return 'Custom';
}

function formatCurrency(value: number) {
	const normalized = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
	return `DHS ${Number.isInteger(normalized) ? normalized : normalized.toFixed(2)}`;
}

function parseOrderNumber(value: string) {
	const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
	return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	loadingText: {
		...Theme.typography.labelMedium,
		marginTop: Theme.spacing.md,
	},
	listHeader: {
		paddingTop: Theme.spacing.lg,
		paddingBottom: Theme.spacing.lg,
	},
	summaryPanel: {
		marginVertical: 0,
	},
	summaryRow: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	summaryEyebrow: {
		...Theme.typography.detailBold,
		textTransform: 'uppercase',
		letterSpacing: 0.7,
		marginBottom: Theme.spacing.xs,
	},
	summaryValue: {
		...Theme.typography.answerGiant,
	},
	summaryLabel: {
		...Theme.typography.label,
		opacity: 0.84,
		marginTop: Theme.spacing.xs,
		textAlign: 'center',
	},
	summaryStatsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.lg,
	},
	statCard: {
		flex: 1,
		minWidth: '47%',
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.sm,
		padding: Theme.spacing.md,
		borderRadius: 18,
		borderWidth: 1,
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
	statValue: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
	},
	statLabel: {
		...Theme.typography.detailBold,
		marginTop: 3,
	},
	listIntro: {
		borderWidth: 1,
		borderRadius: 22,
		paddingHorizontal: Theme.spacing.lg,
		paddingVertical: Theme.spacing.lg,
		marginTop: Theme.spacing.md,
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: Theme.spacing.md,
	},
	listIntroIcon: {
		width: 36,
		height: 36,
		borderRadius: 13,
		alignItems: 'center',
		justifyContent: 'center',
	},
	listIntroCopy: {
		flex: 1,
		minWidth: 0,
	},
	listIntroTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
	},
	listIntroSubtitle: {
		...Theme.typography.detail,
		fontSize: 13,
		marginTop: Theme.spacing.xs,
	},
	collectionMap: {
		borderWidth: 1,
		borderRadius: 24,
		padding: Theme.spacing.lg,
		marginTop: Theme.spacing.md,
	},
	collectionMapTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
		marginBottom: Theme.spacing.md,
	},
	collectionSteps: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
	},
	collectionStep: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 18,
		padding: Theme.spacing.md,
		minHeight: 112,
	},
	collectionStepIndex: {
		width: 26,
		height: 26,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: Theme.spacing.sm,
	},
	collectionStepIndexText: {
		...Theme.typography.detailBold,
		color: Theme.colors.textInverted,
		fontWeight: '900',
	},
	collectionStepLabel: {
		...Theme.typography.detailBold,
		fontSize: 13,
	},
	collectionStepDetail: {
		...Theme.typography.detail,
		fontSize: 11,
		lineHeight: 15,
		marginTop: 3,
	},
	orderPanel: {
		borderWidth: 1,
		borderRadius: 24,
		padding: Theme.spacing.lg,
		marginTop: Theme.spacing.md,
		gap: Theme.spacing.md,
	},
	orderPanelHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	orderPanelTitleWrap: {
		flex: 1,
		minWidth: 0,
		flexDirection: 'row',
		alignItems: 'center',
		gap: Theme.spacing.md,
	},
	orderIconBox: {
		width: 40,
		height: 40,
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
	orderPanelCopy: {
		flex: 1,
		minWidth: 0,
	},
	orderPanelTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
	},
	orderPanelSubtitle: {
		...Theme.typography.detail,
		fontSize: 12,
		lineHeight: 17,
		marginTop: 3,
	},
	orderStatsRow: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
	},
	orderMiniStat: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 16,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
	},
	orderMiniValue: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
	},
	orderMiniLabel: {
		...Theme.typography.detailBold,
		fontSize: 11,
		marginTop: 3,
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	orderCard: {
		borderWidth: 1,
		borderRadius: 18,
		padding: Theme.spacing.md,
		gap: Theme.spacing.sm,
	},
	orderCardTop: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	orderCardCopy: {
		flex: 1,
		minWidth: 0,
	},
	orderCustomer: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
	},
	orderDetail: {
		...Theme.typography.detail,
		fontSize: 12,
		marginTop: 4,
	},
	orderAmountBlock: {
		alignItems: 'flex-end',
		gap: 5,
	},
	orderAmount: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
	},
	orderActions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: Theme.spacing.sm,
	},
	orderActionButton: {
		minWidth: 92,
	},
	orderEmptyState: {
		borderWidth: 1,
		borderRadius: 18,
		padding: Theme.spacing.md,
	},
	orderEmptyTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '900',
	},
	orderEmptyText: {
		...Theme.typography.detail,
		fontSize: 12,
		lineHeight: 17,
		marginTop: 4,
	},
	orderSheetContent: {
		gap: Theme.spacing.sm,
	},
	orderSheetBlock: {
		marginBottom: Theme.spacing.md,
	},
	orderSheetLabel: {
		...Theme.typography.labelMedium,
		marginBottom: Theme.spacing.xs,
	},
	orderChipRow: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
	},
	orderChip: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 15,
		paddingVertical: 12,
		alignItems: 'center',
	},
	orderChipText: {
		...Theme.typography.detailBold,
		fontWeight: '900',
	},
	orderInputRow: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
	},
	orderInputSmall: {
		flex: 0.42,
	},
	orderInputLarge: {
		flex: 1,
	},
	paymentCard: {
		marginBottom: Theme.spacing.md,
		borderRadius: 20,
	},
	paymentHeader: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: Theme.spacing.md,
	},
	paymentHeaderStacked: {
		flexDirection: 'column',
	},
	paymentCopy: {
		flex: 1,
		minWidth: 0,
	},
	paymentName: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
	},
	paymentPlan: {
		...Theme.typography.detail,
		fontSize: 13,
		marginTop: 4,
	},
	paymentBadgeRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'flex-end',
		gap: Theme.spacing.xs,
		maxWidth: '48%',
	},
	paymentBadgeRowStacked: {
		maxWidth: '100%',
		justifyContent: 'flex-start',
	},
	badgeTight: {
		paddingHorizontal: Theme.spacing.sm,
		paddingVertical: 5,
	},
	metaGrid: {
		flexDirection: 'row',
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.md,
	},
	metaGridStacked: {
		flexDirection: 'column',
	},
	metaCard: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 16,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.sm,
	},
	metaLabel: {
		...Theme.typography.detailBold,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	metaValue: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
		marginTop: 6,
	},
	paymentFootnote: {
		...Theme.typography.detail,
		fontSize: 13,
		marginTop: Theme.spacing.md,
	},
	paymentButton: {
		marginTop: Theme.spacing.md,
	},
	emptyState: {
		marginTop: Theme.spacing.huge,
		borderWidth: 1,
		borderRadius: 22,
		paddingHorizontal: Theme.spacing.xl,
		paddingVertical: Theme.spacing.huge,
		alignItems: 'center',
		gap: Theme.spacing.sm,
	},
	emptyTitle: {
		...Theme.typography.labelMedium,
		fontWeight: '800',
		textAlign: 'center',
	},
	emptySubtitle: {
		...Theme.typography.detail,
		fontSize: 13,
		marginTop: Theme.spacing.sm,
		textAlign: 'center',
	},
});
