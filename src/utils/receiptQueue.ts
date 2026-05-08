import type {
	QueuedReceiptExpense,
	ReceiptExpenseDraft,
	ReceiptQueueSyncSummary,
	SavedReceiptResult,
} from './receiptTypes';

const UNSUPPORTED_MESSAGE =
	'Local receipt queueing is available on Android and iOS development builds only.';

export async function loadQueuedReceiptExpenses(): Promise<QueuedReceiptExpense[]> {
	return [];
}

export async function saveReceiptDraftToQueue(
	_: ReceiptExpenseDraft
): Promise<SavedReceiptResult> {
	throw new Error(UNSUPPORTED_MESSAGE);
}

export async function syncQueuedReceiptExpenses(): Promise<ReceiptQueueSyncSummary> {
	return {
		syncedCount: 0,
		failedCount: 0,
		pendingCount: 0,
	};
}

export async function deleteQueuedReceiptExpense(_: string): Promise<void> {
	return;
}
