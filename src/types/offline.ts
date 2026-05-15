import type { DayMenu } from '../utils/menuLogic';
import type { ReceiptLineItem } from '../utils/receiptTypes';
import type { Customer } from './customer';

export type AttendanceEntry = {
	id: string;
	customerId: string;
	date: string;
	name?: string;
	lunch: boolean;
	dinner: boolean;
	updatedAt?: string;
};

export type PaymentEntry = {
	id: string;
	customerId: string;
	customerName: string;
	amount: number;
	date: unknown;
	method?: string;
	monthTag: string;
};

export type ExpenseEntry = {
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
	paymentMethod?: string;
	receiptDate?: string;
	localReceiptId?: string;
	imageUri?: string;
	rawText?: string;
	subtotal?: number | null;
	tax?: number | null;
};

export type OneTimeOrderItem = {
	id: string;
	name: string;
	quantity: number;
	price: number;
};

export type OneTimeOrder = {
	id: string;
	customerId?: string | null;
	customerName: string;
	phone?: string;
	orderDate: string;
	mealSlot: 'lunch' | 'dinner' | 'custom';
	items: OneTimeOrderItem[];
	total: number;
	paidAmount: number;
	paymentStatus: 'unpaid' | 'partial' | 'paid';
	fulfillmentStatus: 'pending' | 'preparing' | 'delivered' | 'cancelled';
	notes?: string;
	monthTag: string;
	createdAt: string;
	updatedAt: string;
};

export type SyncEntityType = 'customer' | 'attendance' | 'menu' | 'payment' | 'expense' | 'order';

export type SyncOperationKind =
	| 'customer_create'
	| 'customer_delete'
	| 'attendance_batch_upsert'
	| 'menu_upsert'
	| 'payment_record'
	| 'payment_delete'
	| 'expense_upsert'
	| 'expense_delete'
	| 'order_upsert'
	| 'order_delete';

export type SyncQueueStatus = 'pending' | 'failed';

export type CustomerCreatePayload = {
	customer: Customer;
};

export type CustomerDeletePayload = {
	customerId: string;
};

export type AttendanceBatchPayload = {
	records: AttendanceEntry[];
};

export type MenuUpsertPayload = {
	date: string;
	menu: DayMenu;
};

export type PaymentRecordPayload = {
	payment: PaymentEntry;
	customerId: string;
	customerPatch: {
		totalPaid: number;
		endDate: string;
	};
};

export type PaymentDeletePayload = {
	paymentId: string;
};

export type ExpenseDeletePayload = {
	expenseId: string;
};

export type ExpenseUpsertPayload = {
	expense: ExpenseEntry;
};

export type OrderUpsertPayload = {
	order: OneTimeOrder;
};

export type OrderDeletePayload = {
	orderId: string;
};

export type SyncQueuePayload =
	| CustomerCreatePayload
	| CustomerDeletePayload
	| AttendanceBatchPayload
	| MenuUpsertPayload
	| PaymentRecordPayload
	| PaymentDeletePayload
	| ExpenseUpsertPayload
	| ExpenseDeletePayload
	| OrderUpsertPayload
	| OrderDeletePayload;

export type SyncQueueOperation = {
	id: string;
	entityType: SyncEntityType;
	entityId: string;
	kind: SyncOperationKind;
	title: string;
	subtitle: string;
	payload: SyncQueuePayload;
	status: SyncQueueStatus;
	attempts: number;
	error: string;
	createdAt: string;
	updatedAt: string;
};

export type QueuePreviewItem = {
	id: string;
	source: 'sync' | 'receipt';
	title: string;
	subtitle: string;
	status: SyncQueueStatus;
	error: string;
	createdAt: string;
	updatedAt: string;
};

export type OfflineSnapshot = {
	customers: Customer[];
	payments: PaymentEntry[];
	expenses: ExpenseEntry[];
	orders: OneTimeOrder[];
	menuByDate: Record<string, DayMenu>;
	attendanceByDate: Record<string, AttendanceEntry[]>;
	queueOperations: SyncQueueOperation[];
	pendingQueueCount: number;
};
