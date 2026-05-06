const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_RECEIPT_MODEL = process.env.EXPO_PUBLIC_RECEIPT_OCR_MODEL?.trim() || 'gpt-4.1-mini';

export type ReceiptLineItem = {
	name: string;
	amount: number | null;
	quantity: number | null;
};

export type ReceiptExpenseDraft = {
	merchantName: string;
	expenseTitle: string;
	total: number;
	subtotal: number | null;
	tax: number | null;
	currency: string;
	receiptDate: string;
	paymentMethod: string;
	items: ReceiptLineItem[];
	note: string;
	confidence: number;
};

export class ReceiptScannerConfigError extends Error {}

type ScanReceiptInput = {
	base64: string;
	mimeType: string;
};

type RawReceiptPayload = {
	merchant_name?: unknown;
	expense_title?: unknown;
	total?: unknown;
	subtotal?: unknown;
	tax?: unknown;
	currency?: unknown;
	receipt_date?: unknown;
	payment_method?: unknown;
	items?: unknown;
	note?: unknown;
	confidence?: unknown;
};

export const getReceiptScannerConfigMessage = () =>
	'Add EXPO_PUBLIC_OPENAI_API_KEY to .env.local and reload Expo Go to enable receipt OCR.';

export const isReceiptScannerConfigured = () => Boolean(getOpenAiApiKey());

export async function scanReceiptImage({
	base64,
	mimeType,
}: ScanReceiptInput): Promise<ReceiptExpenseDraft> {
	const apiKey = getOpenAiApiKey();

	if (!apiKey) {
		throw new ReceiptScannerConfigError(getReceiptScannerConfigMessage());
	}

	const response = await fetch(OPENAI_RESPONSES_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: DEFAULT_RECEIPT_MODEL,
			input: [
				{
					role: 'user',
					content: [
						{
							type: 'input_text',
							text:
								'Extract this receipt into JSON for a UAE meal-service finance ledger. ' +
								'Detect the merchant, the grand total actually paid, the receipt date, the payment method, ' +
								'and the visible line items with their names, quantities, and amounts when present. ' +
								'Do not invent hidden values. If a value is missing, use null or an empty string. ' +
								'Choose the final payable total if multiple totals are visible. ' +
								'Normalize AED, dirham, and UAE currency labels to DHS. ' +
								'Return exactly one JSON object with these keys: ' +
								'merchant_name, expense_title, total, subtotal, tax, currency, receipt_date, payment_method, items, note, confidence. ' +
								'confidence must be a number from 0 to 1. ' +
								'items must be an array of objects with name, amount, and quantity.',
						},
						{
							type: 'input_image',
							image_url: `data:${mimeType};base64,${base64}`,
							detail: 'high',
						},
					],
				},
			],
			text: {
				format: {
					type: 'json_object',
				},
			},
			max_output_tokens: 1500,
		}),
	});

	const payload = await response.json();

	if (!response.ok) {
		throw new Error(
			payload?.error?.message ||
				'Receipt scan failed before the OCR result came back.'
		);
	}

	const rawText = getOutputText(payload);

	if (!rawText) {
		throw new Error('The OCR response was empty. Try retaking the receipt in better light.');
	}

	const parsed = JSON.parse(extractJsonObject(rawText)) as RawReceiptPayload;
	return normalizeReceiptPayload(parsed);
}

function getOpenAiApiKey() {
	return process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim() || '';
}

function getOutputText(payload: unknown) {
	if (
		typeof payload === 'object' &&
		payload !== null &&
		'output_text' in payload &&
		typeof payload.output_text === 'string'
	) {
		return payload.output_text.trim();
	}

	if (
		typeof payload === 'object' &&
		payload !== null &&
		'output' in payload &&
		Array.isArray(payload.output)
	) {
		const texts: string[] = [];

		for (const block of payload.output) {
			if (
				typeof block === 'object' &&
				block !== null &&
				'content' in block &&
				Array.isArray(block.content)
			) {
				for (const content of block.content) {
					if (
						typeof content === 'object' &&
						content !== null &&
						'text' in content &&
						typeof content.text === 'string'
					) {
						texts.push(content.text);
					}
				}
			}
		}

		return texts.join('\n').trim();
	}

	return '';
}

function extractJsonObject(rawText: string) {
	const cleaned = rawText
		.replace(/```json/gi, '')
		.replace(/```/g, '')
		.trim();

	const firstBrace = cleaned.indexOf('{');
	const lastBrace = cleaned.lastIndexOf('}');

	if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
		return cleaned;
	}

	return cleaned.slice(firstBrace, lastBrace + 1);
}

function normalizeReceiptPayload(raw: RawReceiptPayload): ReceiptExpenseDraft {
	const normalizedItems = normalizeItems(raw.items);
	const subtotal = numberOrNull(raw.subtotal);
	const tax = numberOrNull(raw.tax);
	const itemsTotal = sumLineItems(normalizedItems);
	const resolvedTotal =
		numberOrNull(raw.total) ??
		(subtotal !== null && tax !== null ? roundMoney(subtotal + tax) : itemsTotal ?? 0);
	const merchantName = stringOrEmpty(raw.merchant_name);
	const expenseTitle =
		stringOrEmpty(raw.expense_title) ||
		merchantName ||
		normalizedItems[0]?.name ||
		'Scanned receipt';

	return {
		merchantName,
		expenseTitle,
		total: roundMoney(Math.max(0, resolvedTotal)),
		subtotal,
		tax,
		currency: normalizeCurrency(raw.currency),
		receiptDate: normalizeDate(raw.receipt_date),
		paymentMethod: stringOrEmpty(raw.payment_method),
		items: normalizedItems,
		note: stringOrEmpty(raw.note),
		confidence: normalizeConfidence(raw.confidence),
	};
}

function normalizeItems(value: unknown): ReceiptLineItem[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((item) => {
			if (typeof item !== 'object' || item === null) {
				return null;
			}

			const name =
				'name' in item && typeof item.name === 'string' ? item.name.trim() : '';

			if (!name) {
				return null;
			}

			return {
				name,
				amount:
					'amount' in item ? numberOrNull(item.amount) : null,
				quantity:
					'quantity' in item ? numberOrNull(item.quantity) : null,
			};
		})
		.filter((item): item is ReceiptLineItem => item !== null);
}

function sumLineItems(items: ReceiptLineItem[]) {
	const amounts = items
		.map((item) => item.amount)
		.filter((amount): amount is number => typeof amount === 'number' && Number.isFinite(amount));

	if (amounts.length === 0) {
		return null;
	}

	return roundMoney(amounts.reduce((sum, amount) => sum + amount, 0));
}

function numberOrNull(value: unknown) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return roundMoney(value);
	}

	if (typeof value === 'string') {
		const numeric = Number.parseFloat(
			value.replace(/[^0-9.-]+/g, '')
		);

		if (Number.isFinite(numeric)) {
			return roundMoney(numeric);
		}
	}

	return null;
}

function stringOrEmpty(value: unknown) {
	return typeof value === 'string' ? value.trim() : '';
}

function normalizeCurrency(value: unknown) {
	const raw = stringOrEmpty(value).toUpperCase();

	if (!raw) {
		return 'DHS';
	}

	if (raw === 'AED' || raw === 'DIRHAM' || raw === 'DIRHAMS' || raw === 'DHS') {
		return 'DHS';
	}

	return raw;
}

function normalizeDate(value: unknown) {
	const raw = stringOrEmpty(value);
	const fallback = toIsoDate(new Date());

	if (!raw) {
		return fallback;
	}

	const parsed = new Date(raw);

	if (Number.isNaN(parsed.getTime())) {
		return fallback;
	}

	return toIsoDate(parsed);
}

function normalizeConfidence(value: unknown) {
	const numeric = numberOrNull(value);

	if (numeric === null) {
		return 0.65;
	}

	if (numeric > 1 && numeric <= 100) {
		return clamp(numeric / 100, 0, 1);
	}

	return clamp(numeric, 0, 1);
}

function toIsoDate(date: Date) {
	return date.toISOString().slice(0, 10);
}

function roundMoney(value: number) {
	return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
