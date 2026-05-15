import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { DayMenu } from '../utils/menuLogic';
import type {
	AttendanceEntry,
	Customer,
	ExpenseEntry,
	OneTimeOrder,
	OfflineSnapshot,
	PaymentEntry,
	SyncQueueOperation,
	SyncQueuePayload,
} from '../types';

type CacheRow = {
	id: string;
	data_json: string;
	dirty: number;
	deleted: number;
	updated_at: string;
};

type CustomerRow = CacheRow & {
	is_active: number;
};

type MenuRow = CacheRow & {
	date: string;
};

type AttendanceRow = CacheRow & {
	date: string;
	customer_id: string;
};

type PaymentRow = CacheRow & {
	month_tag: string;
};

type ExpenseRow = CacheRow & {
	month_tag: string;
};

type OrderRow = CacheRow & {
	month_tag: string;
	order_date: string;
};

type QueueRow = {
	id: string;
	entity_type: string;
	entity_id: string;
	kind: string;
	title: string;
	subtitle: string;
	payload_json: string;
	status: 'pending' | 'failed';
	attempts: number;
	error: string;
	created_at: string;
	updated_at: string;
};

type SafeSQLiteDatabase = {
	execAsync: SQLiteDatabase['execAsync'];
	runAsync: (source: string, ...params: unknown[]) => ReturnType<SQLiteDatabase['runAsync']>;
	getAllAsync: <T>(source: string, ...params: unknown[]) => Promise<T[]>;
	getFirstAsync: <T>(source: string, ...params: unknown[]) => Promise<T | null>;
};

let databasePromise: Promise<SafeSQLiteDatabase> | null = null;

export async function initializeOfflineDatabase() {
	await getDatabase();
}

export async function loadOfflineSnapshot(weekDates: string[]): Promise<OfflineSnapshot> {
	const database = await getDatabase();
	const customerRows = await database.getAllAsync<CustomerRow>(
		'SELECT * FROM customers WHERE deleted = 0 ORDER BY is_active DESC, updated_at DESC'
	);
	const paymentRows = await database.getAllAsync<PaymentRow>(
		'SELECT * FROM payments WHERE deleted = 0 ORDER BY month_tag DESC, updated_at DESC'
	);
	const expenseRows = await database.getAllAsync<ExpenseRow>(
		'SELECT * FROM expenses WHERE deleted = 0 ORDER BY month_tag DESC, updated_at DESC'
	);
	const orderRows = await database.getAllAsync<OrderRow>(
		'SELECT * FROM orders WHERE deleted = 0 ORDER BY order_date DESC, updated_at DESC'
	);
	const menuRows = weekDates.length
		? await database.getAllAsync<MenuRow>(
			`SELECT * FROM menu_entries
			 WHERE date IN (${weekDates.map(() => '?').join(', ')})
			   AND deleted = 0`,
			...weekDates
		)
		: [];
	const attendanceRows = weekDates.length
		? await database.getAllAsync<AttendanceRow>(
			`SELECT * FROM attendance_entries
			 WHERE date IN (${weekDates.map(() => '?').join(', ')})
			   AND deleted = 0
			 ORDER BY date ASC, updated_at DESC`,
			...weekDates
		)
		: [];
	const queueRows = await database.getAllAsync<QueueRow>(
		`SELECT * FROM sync_queue
		 WHERE status IN ('pending', 'failed')
		 ORDER BY created_at ASC`
	);

	const menuByDate: Record<string, DayMenu> = {};
	const attendanceByDate: Record<string, AttendanceEntry[]> = Object.fromEntries(
		weekDates.map((date) => [date, [] as AttendanceEntry[]])
	);

	for (const row of menuRows) {
		menuByDate[row.date] = parseJson<DayMenu>(row.data_json);
	}

	for (const row of attendanceRows) {
		const record = parseJson<AttendanceEntry>(row.data_json);
		if (!attendanceByDate[row.date]) {
			attendanceByDate[row.date] = [];
		}
		attendanceByDate[row.date].push(record);
	}

	return {
		customers: customerRows.map((row) => parseJson<Customer>(row.data_json)),
		payments: paymentRows.map((row) => parseJson<PaymentEntry>(row.data_json)),
		expenses: expenseRows.map((row) => parseJson<ExpenseEntry>(row.data_json)),
		orders: orderRows.map((row) => parseJson<OneTimeOrder>(row.data_json)),
		menuByDate,
		attendanceByDate,
		queueOperations: queueRows.map(mapQueueRow),
		pendingQueueCount: queueRows.length,
	};
}

export async function syncRemoteCustomers(customers: Customer[]) {
	const database = await getDatabase();
	const localRows = await database.getAllAsync<CustomerRow>('SELECT * FROM customers');
	const localMap = new Map(localRows.map((row) => [row.id, row]));
	const remoteIds = new Set(customers.map((customer) => customer.id));

	for (const customer of customers) {
		const local = localMap.get(customer.id);
		if (local && (local.dirty === 1 || local.deleted === 1)) {
			continue;
		}

		await upsertCustomerRow(database, customer, false, false);
	}

	for (const row of localRows) {
		if (!remoteIds.has(row.id) && row.dirty === 0 && row.deleted === 0) {
			await database.runAsync('DELETE FROM customers WHERE id = ?', row.id);
		}
	}
}

export async function syncRemotePayments(payments: PaymentEntry[]) {
	const database = await getDatabase();
	const localRows = await database.getAllAsync<PaymentRow>('SELECT * FROM payments');
	const localMap = new Map(localRows.map((row) => [row.id, row]));
	const remoteIds = new Set(payments.map((payment) => payment.id));

	for (const payment of payments) {
		const local = localMap.get(payment.id);
		if (local && (local.dirty === 1 || local.deleted === 1)) {
			continue;
		}

		await upsertPaymentRow(database, payment, false, false);
	}

	for (const row of localRows) {
		if (!remoteIds.has(row.id) && row.dirty === 0 && row.deleted === 0) {
			await database.runAsync('DELETE FROM payments WHERE id = ?', row.id);
		}
	}
}

export async function syncRemoteExpenses(expenses: ExpenseEntry[]) {
	const database = await getDatabase();
	const localRows = await database.getAllAsync<ExpenseRow>('SELECT * FROM expenses');
	const localMap = new Map(localRows.map((row) => [row.id, row]));
	const remoteIds = new Set(expenses.map((expense) => expense.id));

	for (const expense of expenses) {
		const local = localMap.get(expense.id);
		if (local && (local.dirty === 1 || local.deleted === 1)) {
			continue;
		}

		await upsertExpenseRow(database, expense, false, false);
	}

	for (const row of localRows) {
		if (!remoteIds.has(row.id) && row.dirty === 0 && row.deleted === 0) {
			await database.runAsync('DELETE FROM expenses WHERE id = ?', row.id);
		}
	}
}

export async function syncRemoteOrders(orders: OneTimeOrder[]) {
	const database = await getDatabase();
	const localRows = await database.getAllAsync<OrderRow>('SELECT * FROM orders');
	const localMap = new Map(localRows.map((row) => [row.id, row]));
	const remoteIds = new Set(orders.map((order) => order.id));

	for (const order of orders) {
		const local = localMap.get(order.id);
		if (local && (local.dirty === 1 || local.deleted === 1)) {
			continue;
		}

		await upsertOrderRow(database, order, false, false);
	}

	for (const row of localRows) {
		if (!remoteIds.has(row.id) && row.dirty === 0 && row.deleted === 0) {
			await database.runAsync('DELETE FROM orders WHERE id = ?', row.id);
		}
	}
}

export async function syncRemoteMenu(date: string, menu: DayMenu | null) {
	const database = await getDatabase();
	const local = await database.getFirstAsync<MenuRow>(
		'SELECT * FROM menu_entries WHERE id = ?',
		date
	);

	if (local && (local.dirty === 1 || local.deleted === 1)) {
		return;
	}

	if (!menu) {
		await database.runAsync('DELETE FROM menu_entries WHERE id = ?', date);
		return;
	}

	await upsertMenuRow(database, date, menu, false, false);
}

export async function syncRemoteAttendanceDate(date: string, records: AttendanceEntry[]) {
	const database = await getDatabase();
	const localRows = await database.getAllAsync<AttendanceRow>(
		'SELECT * FROM attendance_entries WHERE date = ?',
		date
	);
	const localMap = new Map(localRows.map((row) => [row.id, row]));
	const remoteIds = new Set(records.map((record) => record.id));

	for (const record of records) {
		const local = localMap.get(record.id);
		if (local && (local.dirty === 1 || local.deleted === 1)) {
			continue;
		}

		await upsertAttendanceRow(database, record, false, false);
	}

	for (const row of localRows) {
		if (!remoteIds.has(row.id) && row.dirty === 0 && row.deleted === 0) {
			await database.runAsync('DELETE FROM attendance_entries WHERE id = ?', row.id);
		}
	}
}

export async function saveLocalCustomer(customer: Customer) {
	const database = await getDatabase();
	await upsertCustomerRow(database, customer, true, false);
}

export async function markCustomerDeleted(customerId: string) {
	const database = await getDatabase();
	await database.runAsync(
		`UPDATE customers
		 SET deleted = 1, dirty = 1, updated_at = ?
		 WHERE id = ?`,
		new Date().toISOString(),
		customerId
	);
}

export async function saveLocalAttendanceBatch(records: AttendanceEntry[]) {
	const database = await getDatabase();
	for (const record of records) {
		await upsertAttendanceRow(database, record, true, false);
	}
}

export async function saveLocalMenu(date: string, menu: DayMenu) {
	const database = await getDatabase();
	await upsertMenuRow(database, date, menu, true, false);
}

export async function saveLocalPayment(payment: PaymentEntry) {
	const database = await getDatabase();
	await upsertPaymentRow(database, payment, true, false);
}

export async function saveLocalOrder(order: OneTimeOrder) {
	const database = await getDatabase();
	await upsertOrderRow(database, order, true, false);
}

export async function applyLocalCustomerPatch(
	customerId: string,
	patch: Partial<Customer>
) {
	const database = await getDatabase();
	const row = await database.getFirstAsync<CustomerRow>(
		'SELECT * FROM customers WHERE id = ?',
		customerId
	);
	if (!row) {
		return;
	}

	const current = parseJson<Customer>(row.data_json);
	const next = {
		...current,
		...normalizeForStorage(patch),
	};

	await upsertCustomerRow(database, next, true, row.deleted === 1);
}

export async function markPaymentDeleted(paymentId: string) {
	const database = await getDatabase();
	await database.runAsync(
		`UPDATE payments
		 SET deleted = 1, dirty = 1, updated_at = ?
		 WHERE id = ?`,
		new Date().toISOString(),
		paymentId
	);
}

export async function markExpenseDeleted(expenseId: string) {
	const database = await getDatabase();
	await database.runAsync(
		`UPDATE expenses
		 SET deleted = 1, dirty = 1, updated_at = ?
		 WHERE id = ?`,
		new Date().toISOString(),
		expenseId
	);
}

export async function markOrderDeleted(orderId: string) {
	const database = await getDatabase();
	await database.runAsync(
		`UPDATE orders
		 SET deleted = 1, dirty = 1, updated_at = ?
		 WHERE id = ?`,
		new Date().toISOString(),
		orderId
	);
}

export async function enqueueSyncOperation(operation: SyncQueueOperation) {
	const database = await getDatabase();
	await database.runAsync(
		`INSERT INTO sync_queue (
			id,
			entity_type,
			entity_id,
			kind,
			title,
			subtitle,
			payload_json,
			status,
			attempts,
			error,
			created_at,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			entity_type = excluded.entity_type,
			entity_id = excluded.entity_id,
			kind = excluded.kind,
			title = excluded.title,
			subtitle = excluded.subtitle,
			payload_json = excluded.payload_json,
			status = excluded.status,
			attempts = excluded.attempts,
			error = excluded.error,
			updated_at = excluded.updated_at`,
		operation.id,
		operation.entityType,
		operation.entityId,
		operation.kind,
		operation.title,
		operation.subtitle,
		serializeJson(operation.payload),
		operation.status,
		operation.attempts,
		operation.error,
		operation.createdAt,
		operation.updatedAt
	);
}

export async function listSyncOperations() {
	const database = await getDatabase();
	const rows = await database.getAllAsync<QueueRow>(
		`SELECT * FROM sync_queue
		 WHERE status IN ('pending', 'failed')
		 ORDER BY created_at ASC`
	);
	return rows.map(mapQueueRow);
}

export async function failSyncOperation(
	operationId: string,
	attempts: number,
	error: string
) {
	const database = await getDatabase();
	await database.runAsync(
		`UPDATE sync_queue
		 SET status = ?, attempts = ?, error = ?, updated_at = ?
		 WHERE id = ?`,
		'failed',
		attempts,
		error,
		new Date().toISOString(),
		operationId
	);
}

export async function completeSyncOperation(operation: SyncQueueOperation) {
	const database = await getDatabase();

	switch (operation.kind) {
		case 'customer_create':
			await clearDirty(database, 'customers', operation.entityId);
			break;
		case 'customer_delete':
			await database.runAsync('DELETE FROM customers WHERE id = ?', operation.entityId);
			break;
		case 'attendance_batch_upsert': {
			const payload = operation.payload as { records: AttendanceEntry[] };
			for (const record of payload.records) {
				await clearDirty(database, 'attendance_entries', record.id);
			}
			break;
		}
		case 'menu_upsert':
			await clearDirty(database, 'menu_entries', operation.entityId);
			break;
		case 'payment_record': {
			const payload = operation.payload as {
				payment: PaymentEntry;
				customerId: string;
			};
			await clearDirty(database, 'payments', operation.entityId);
			await clearDirty(database, 'customers', payload.customerId);
			break;
		}
		case 'payment_delete':
			await database.runAsync('DELETE FROM payments WHERE id = ?', operation.entityId);
			break;
		case 'expense_delete':
			await database.runAsync('DELETE FROM expenses WHERE id = ?', operation.entityId);
			break;
		case 'order_upsert':
			await clearDirty(database, 'orders', operation.entityId);
			break;
		case 'order_delete':
			await database.runAsync('DELETE FROM orders WHERE id = ?', operation.entityId);
			break;
		default:
			break;
	}

	await database.runAsync('DELETE FROM sync_queue WHERE id = ?', operation.id);
}

async function getDatabase() {
	if (!databasePromise) {
		databasePromise = initializeDatabase();
	}

	return databasePromise;
}

async function initializeDatabase() {
	const database = await openDatabaseAsync('mess-manager-offline.db');
	await database.execAsync(`
		CREATE TABLE IF NOT EXISTS customers (
			id TEXT PRIMARY KEY NOT NULL,
			data_json TEXT NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			dirty INTEGER NOT NULL DEFAULT 0,
			deleted INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS menu_entries (
			id TEXT PRIMARY KEY NOT NULL,
			date TEXT NOT NULL UNIQUE,
			data_json TEXT NOT NULL,
			dirty INTEGER NOT NULL DEFAULT 0,
			deleted INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS attendance_entries (
			id TEXT PRIMARY KEY NOT NULL,
			date TEXT NOT NULL,
			customer_id TEXT NOT NULL,
			data_json TEXT NOT NULL,
			dirty INTEGER NOT NULL DEFAULT 0,
			deleted INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS payments (
			id TEXT PRIMARY KEY NOT NULL,
			month_tag TEXT NOT NULL,
			data_json TEXT NOT NULL,
			dirty INTEGER NOT NULL DEFAULT 0,
			deleted INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS expenses (
			id TEXT PRIMARY KEY NOT NULL,
			month_tag TEXT NOT NULL,
			data_json TEXT NOT NULL,
			dirty INTEGER NOT NULL DEFAULT 0,
			deleted INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS orders (
			id TEXT PRIMARY KEY NOT NULL,
			month_tag TEXT NOT NULL,
			order_date TEXT NOT NULL,
			data_json TEXT NOT NULL,
			dirty INTEGER NOT NULL DEFAULT 0,
			deleted INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS sync_queue (
			id TEXT PRIMARY KEY NOT NULL,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			title TEXT NOT NULL,
			subtitle TEXT NOT NULL,
			payload_json TEXT NOT NULL,
			status TEXT NOT NULL,
			attempts INTEGER NOT NULL DEFAULT 0,
			error TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active, updated_at DESC);
		CREATE INDEX IF NOT EXISTS idx_menu_date ON menu_entries(date);
		CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_entries(date, customer_id);
		CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month_tag, updated_at DESC);
		CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(month_tag, updated_at DESC);
		CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date DESC, updated_at DESC);
		CREATE INDEX IF NOT EXISTS idx_orders_month ON orders(month_tag, updated_at DESC);
		CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, created_at ASC);
	`);

	return createDatabaseFacade(database);
}

async function upsertCustomerRow(
	database: SafeSQLiteDatabase,
	customer: Customer,
	dirty: boolean,
	deleted: boolean
) {
	const now = new Date().toISOString();
	const normalized = normalizeForStorage(customer) as Customer;
	await database.runAsync(
		`INSERT INTO customers (
			id,
			data_json,
			is_active,
			dirty,
			deleted,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			data_json = excluded.data_json,
			is_active = excluded.is_active,
			dirty = excluded.dirty,
			deleted = excluded.deleted,
			updated_at = excluded.updated_at`,
		normalized.id,
		serializeJson(normalized),
		normalized.isActive ? 1 : 0,
		dirty ? 1 : 0,
		deleted ? 1 : 0,
		now
	);
}

async function upsertMenuRow(
	database: SafeSQLiteDatabase,
	date: string,
	menu: DayMenu,
	dirty: boolean,
	deleted: boolean
) {
	const now = new Date().toISOString();
	const normalized = normalizeForStorage(menu) as DayMenu;
	await database.runAsync(
		`INSERT INTO menu_entries (
			id,
			date,
			data_json,
			dirty,
			deleted,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			date = excluded.date,
			data_json = excluded.data_json,
			dirty = excluded.dirty,
			deleted = excluded.deleted,
			updated_at = excluded.updated_at`,
		date,
		date,
		serializeJson(normalized),
		dirty ? 1 : 0,
		deleted ? 1 : 0,
		now
	);
}

async function upsertAttendanceRow(
	database: SafeSQLiteDatabase,
	record: AttendanceEntry,
	dirty: boolean,
	deleted: boolean
) {
	const now = new Date().toISOString();
	const normalized = normalizeForStorage(record) as AttendanceEntry;
	await database.runAsync(
		`INSERT INTO attendance_entries (
			id,
			date,
			customer_id,
			data_json,
			dirty,
			deleted,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			date = excluded.date,
			customer_id = excluded.customer_id,
			data_json = excluded.data_json,
			dirty = excluded.dirty,
			deleted = excluded.deleted,
			updated_at = excluded.updated_at`,
		normalized.id,
		normalized.date,
		normalized.customerId,
		serializeJson(normalized),
		dirty ? 1 : 0,
		deleted ? 1 : 0,
		now
	);
}

async function upsertPaymentRow(
	database: SafeSQLiteDatabase,
	payment: PaymentEntry,
	dirty: boolean,
	deleted: boolean
) {
	const now = new Date().toISOString();
	const normalized = normalizeForStorage(payment) as PaymentEntry;
	await database.runAsync(
		`INSERT INTO payments (
			id,
			month_tag,
			data_json,
			dirty,
			deleted,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			month_tag = excluded.month_tag,
			data_json = excluded.data_json,
			dirty = excluded.dirty,
			deleted = excluded.deleted,
			updated_at = excluded.updated_at`,
		normalized.id,
		normalized.monthTag,
		serializeJson(normalized),
		dirty ? 1 : 0,
		deleted ? 1 : 0,
		now
	);
}

async function upsertExpenseRow(
	database: SafeSQLiteDatabase,
	expense: ExpenseEntry,
	dirty: boolean,
	deleted: boolean
) {
	const now = new Date().toISOString();
	const normalized = normalizeForStorage(expense) as ExpenseEntry;
	await database.runAsync(
		`INSERT INTO expenses (
			id,
			month_tag,
			data_json,
			dirty,
			deleted,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			month_tag = excluded.month_tag,
			data_json = excluded.data_json,
			dirty = excluded.dirty,
			deleted = excluded.deleted,
			updated_at = excluded.updated_at`,
		normalized.id,
		normalized.monthTag,
		serializeJson(normalized),
		dirty ? 1 : 0,
		deleted ? 1 : 0,
		now
	);
}

async function upsertOrderRow(
	database: SafeSQLiteDatabase,
	order: OneTimeOrder,
	dirty: boolean,
	deleted: boolean
) {
	const now = new Date().toISOString();
	const normalized = normalizeForStorage(order) as OneTimeOrder;
	await database.runAsync(
		`INSERT INTO orders (
			id,
			month_tag,
			order_date,
			data_json,
			dirty,
			deleted,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			month_tag = excluded.month_tag,
			order_date = excluded.order_date,
			data_json = excluded.data_json,
			dirty = excluded.dirty,
			deleted = excluded.deleted,
			updated_at = excluded.updated_at`,
		normalized.id,
		normalized.monthTag,
		normalized.orderDate,
		serializeJson(normalized),
		dirty ? 1 : 0,
		deleted ? 1 : 0,
		now
	);
}

async function clearDirty(
	database: SafeSQLiteDatabase,
	table: 'customers' | 'menu_entries' | 'attendance_entries' | 'payments' | 'expenses' | 'orders',
	id: string
) {
	await database.runAsync(
		`UPDATE ${table}
		 SET dirty = 0, deleted = 0, updated_at = ?
		 WHERE id = ?`,
		new Date().toISOString(),
		id
	);
}

function mapQueueRow(row: QueueRow): SyncQueueOperation {
	return {
		id: row.id,
		entityType: row.entity_type as SyncQueueOperation['entityType'],
		entityId: row.entity_id,
		kind: row.kind as SyncQueueOperation['kind'],
		title: row.title,
		subtitle: row.subtitle,
		payload: parseJson<SyncQueuePayload>(row.payload_json),
		status: row.status,
		attempts: row.attempts,
		error: row.error,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function normalizeForStorage<T>(value: T): T {
	if (value instanceof Date) {
		return value.toISOString() as T;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => normalizeForStorage(entry)) as T;
	}

	if (value && typeof value === 'object') {
		if ('toDate' in (value as Record<string, unknown>) && typeof (value as { toDate?: () => Date }).toDate === 'function') {
			return (value as unknown as { toDate: () => Date }).toDate().toISOString() as T;
		}

		const next: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
			if (entry === undefined) {
				continue;
			}
			next[key] = normalizeForStorage(entry);
		}
		return next as T;
	}

	return value;
}

function serializeJson(value: unknown) {
	return JSON.stringify(normalizeForStorage(value));
}

function parseJson<T>(value: string): T {
	return JSON.parse(value) as T;
}

function createDatabaseFacade(database: SQLiteDatabase): SafeSQLiteDatabase {
	return {
		execAsync: database.execAsync.bind(database),
		runAsync: (source, ...params) => {
			const boundParams = normalizeBindParams(params);
			return boundParams === undefined
				? database.runAsync(source)
				: database.runAsync(source, boundParams as never);
		},
		getAllAsync: <T,>(source: string, ...params: unknown[]) => {
			const boundParams = normalizeBindParams(params);
			return boundParams === undefined
				? database.getAllAsync<T>(source)
				: database.getAllAsync<T>(source, boundParams as never);
		},
		getFirstAsync: <T,>(source: string, ...params: unknown[]) => {
			const boundParams = normalizeBindParams(params);
			return boundParams === undefined
				? database.getFirstAsync<T>(source)
				: database.getFirstAsync<T>(source, boundParams as never);
		},
	};
}

function normalizeBindParams(params: unknown[]) {
	if (params.length === 0) {
		return undefined;
	}

	if (params.length === 1) {
		const [first] = params;
		if (Array.isArray(first)) {
			return first;
		}

		if (first && typeof first === 'object') {
			return first as Record<string, unknown>;
		}

		return [first];
	}

	return params;
}
