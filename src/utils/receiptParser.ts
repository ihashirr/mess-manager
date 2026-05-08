import type { ReceiptExpenseDraft, ReceiptLineItem } from './receiptTypes';

type ParseReceiptTextInput = {
	rawText: string;
	imageUri: string;
};

type TotalResolution = {
	total: number;
	lineIndex: number;
	source: 'keyword' | 'fallback' | 'subtotal' | 'subtotal_plus_tax';
};

const AMOUNT_PATTERN =
	/(?:(?:AED|A\.?E\.?D\.?|DHS|SAR|USD|EUR)\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2})?)/gi;

const SUBTOTAL_KEYWORDS = ['subtotal', 'sub total', 'sub-total'];
const TAX_KEYWORDS = ['vat', 'tax', 'sales tax'];
const PAYMENT_METHODS = [
	{ label: 'Card', patterns: ['visa', 'mastercard', 'master card', 'debit', 'credit', 'card', 'pos'] },
	{ label: 'Cash', patterns: ['cash'] },
	{ label: 'Bank Transfer', patterns: ['bank transfer', 'transfer'] },
];
const TOTAL_PRIORITIES = [
	{ pattern: 'grand total', score: 100 },
	{ pattern: 'amount due', score: 95 },
	{ pattern: 'total paid', score: 95 },
	{ pattern: 'net amount', score: 92 },
	{ pattern: 'balance due', score: 88 },
	{ pattern: 'total amount', score: 84 },
	{ pattern: 'sub total', score: 82 },
	{ pattern: 'subtotal', score: 82 },
	{ pattern: 'total', score: 70 },
	{ pattern: 'amount', score: 52 },
];
const NON_ITEM_KEYWORDS = [
	...SUBTOTAL_KEYWORDS,
	...TAX_KEYWORDS,
	'total',
	'amount due',
	'cash',
	'change',
	'balance',
	'payment',
	'card',
	'visa',
	'mastercard',
	'approval',
	'auth',
	'telephone',
	'tel',
	'phone',
	'mobile',
	'trn',
	'invoice',
	'tax invoice',
	'receipt',
];
const LABEL_ONLY_PATTERNS = [
	/^cashier:?$/i,
	/^manager:?$/i,
	/^name:?$/i,
	/^qty:?$/i,
	/^price:?$/i,
	/^subtotal:?$/i,
	/^sub total:?$/i,
	/^cash:?$/i,
	/^change:?$/i,
	/^thank you!?$/i,
	/^thank you!$/i,
	/^glad to see you again!?$/i,
	/^#?\d+$/i,
];
const CONTACT_KEYWORDS = ['city index', 'tel', 'telephone', 'phone', 'mobile', 'fax', 'email', 'www', '.com'];
const TABLE_HEADER_KEYWORDS = ['name', 'qty', 'price'];
const MERCHANT_BLOCKLIST = [
	'manager',
	'cashier',
	'name',
	'qty',
	'price',
	'cash',
	'change',
	'sub total',
	'subtotal',
	'thank you',
	'glad to see you again',
];

export function parseReceiptText({
	rawText,
	imageUri,
}: ParseReceiptTextInput): ReceiptExpenseDraft {
	const normalizedText = normalizeReceiptText(rawText);
	const lines = normalizedText
		.split('\n')
		.map((line) => normalizeLine(line))
		.filter(Boolean);
	const merchantName = detectMerchantName(lines);
	const subtotal = detectAmountByKeywords(lines, SUBTOTAL_KEYWORDS);
	const tax = detectAmountByKeywords(lines, TAX_KEYWORDS);
	const totalResolution = detectTotal(lines, subtotal, tax);
	const paymentMethod = detectPaymentMethod(normalizedText);
	const currency = detectCurrency(normalizedText);
	const receiptDate = detectReceiptDate(normalizedText);
	const items = detectLineItems(lines, totalResolution.lineIndex, totalResolution.total);
	const expenseTitle = merchantName || items[0]?.name || 'Receipt expense';
	const confidence = estimateConfidence({
		rawText: normalizedText,
		merchantName,
		total: totalResolution.total,
		totalSource: totalResolution.source,
		subtotal,
		tax,
		paymentMethod,
		receiptDate,
		items,
	});

	return {
		merchantName,
		expenseTitle,
		total: totalResolution.total,
		subtotal,
		tax,
		currency,
		receiptDate,
		paymentMethod,
		items,
		note: '',
		confidence,
		rawText: normalizedText,
		imageUri,
	};
}

function normalizeReceiptText(value: string) {
	return value
		.replace(/\r/g, '\n')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{2,}/g, '\n')
		.trim();
}

function normalizeLine(line: string) {
	return line.replace(/\s+/g, ' ').trim();
}

function detectMerchantName(lines: string[]) {
	const searchSpace = lines.slice(0, 14);
	let bestLine = '';
	let bestScore = -Infinity;

	for (const line of searchSpace) {
		const score = scoreMerchantCandidate(line);
		if (score > bestScore) {
			bestScore = score;
			bestLine = line;
		}
	}

	if (bestScore < 8) {
		return '';
	}

	return cleanupMerchantName(bestLine);
}

function detectAmountByKeywords(lines: string[], keywords: string[]) {
	for (const line of lines) {
		const lower = line.toLowerCase();
		if (!containsAny(lower, keywords)) {
			continue;
		}

		const amounts = getAmountMatchesFromLine(line);
		if (amounts.length > 0) {
			return amounts[amounts.length - 1]?.value ?? null;
		}
	}

	return null;
}

function detectTotal(
	lines: string[],
	subtotal: number | null,
	tax: number | null
): TotalResolution {
	let bestMatch: TotalResolution | null = null;
	let bestScore = -Infinity;

	lines.forEach((line, index) => {
		const lower = line.toLowerCase();
		if (isAdministrativeNumberLine(lower)) {
			return;
		}
		const amountMatches = getAmountMatchesFromLine(line);
		if (amountMatches.length === 0) {
			return;
		}

		const amountMatch = selectPreferredAmountMatch(line, amountMatches, 'total');
		if (!amountMatch) {
			return;
		}

		const amount = amountMatch.value;
		let score = -1;

		for (const priority of TOTAL_PRIORITIES) {
			if (lower.includes(priority.pattern)) {
				score = Math.max(score, priority.score);
			}
		}

		if (score < 0) {
			return;
		}

		if (containsAny(lower, TAX_KEYWORDS)) {
			score -= 34;
		}

		if (containsAny(lower, SUBTOTAL_KEYWORDS)) {
			score -= 10;
		}

		if (lower.includes('change')) {
			score -= 70;
		}

		if (lower.includes('cash') && !containsAny(lower, TOTAL_PRIORITIES.map((entry) => entry.pattern))) {
			score -= 16;
		}

		if (amountMatch.hasDecimals) {
			score += 9;
		} else {
			score -= 18;
		}

		if (amount >= 10000) {
			score -= 40;
		}

		if (!hasMonetarySignal(line) && !amountMatch.hasDecimals) {
			score -= 26;
		}

		score += Math.max(0, 12 - index);

		if (!bestMatch || score > bestScore) {
			bestMatch = {
				total: amount,
				lineIndex: index,
				source: 'keyword',
			};
			bestScore = score;
		}
	});

	if (bestMatch) {
		return bestMatch;
	}

	if (subtotal !== null && tax !== null && tax > 0) {
		return {
			total: roundMoney(subtotal + tax),
			lineIndex: lines.findIndex((line) => containsAny(line.toLowerCase(), SUBTOTAL_KEYWORDS)),
			source: 'subtotal_plus_tax',
		};
	}

	if (subtotal !== null) {
		return {
			total: subtotal,
			lineIndex: lines.findIndex((line) => containsAny(line.toLowerCase(), SUBTOTAL_KEYWORDS)),
			source: 'subtotal',
		};
	}

	let fallbackTotal = 0;
	let fallbackLineIndex = -1;
	let fallbackScore = -Infinity;
	lines.forEach((line, index) => {
		const lower = line.toLowerCase();
		if (
			containsAny(lower, TAX_KEYWORDS) ||
			lower.includes('change') ||
			isAdministrativeNumberLine(lower)
		) {
			return;
		}

		const amountMatches = getAmountMatchesFromLine(line);
		const selected = selectPreferredAmountMatch(line, amountMatches, 'fallback');
		if (!selected) {
			return;
		}

		let score = selected.value;
		if (selected.hasDecimals) {
			score += 10000;
		}
		if (hasMonetarySignal(line)) {
			score += 2000;
		}
		if (containsAny(lower, SUBTOTAL_KEYWORDS)) {
			score += 1600;
		}
		if (lower.includes('cash')) {
			score -= 300;
		}

		if (score > fallbackScore) {
			fallbackScore = score;
			fallbackTotal = selected.value;
			fallbackLineIndex = index;
		}
	});

	return {
		total: roundMoney(Math.max(0, fallbackTotal)),
		lineIndex: fallbackLineIndex,
		source: 'fallback',
	};
}

function detectPaymentMethod(rawText: string) {
	const lower = rawText.toLowerCase();
	for (const method of PAYMENT_METHODS) {
		if (method.patterns.some((pattern) => lower.includes(pattern))) {
			return method.label;
		}
	}

	return '';
}

function detectCurrency(rawText: string) {
	const upper = rawText.toUpperCase();
	if (upper.includes('AED') || upper.includes('DIRHAM') || upper.includes('DHS')) {
		return 'DHS';
	}

	if (upper.includes('SAR')) {
		return 'SAR';
	}

	if (upper.includes('USD')) {
		return 'USD';
	}

	if (upper.includes('EUR')) {
		return 'EUR';
	}

	return 'DHS';
}

function detectReceiptDate(rawText: string) {
	const patterns = [
		/\b(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})\b/,
		/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/,
	];

	for (const pattern of patterns) {
		const match = rawText.match(pattern);
		if (!match) {
			continue;
		}

		const iso = normalizeDateMatch(match.slice(1));
		if (iso) {
			return iso;
		}
	}

	return toIsoDate(new Date());
}

function detectLineItems(
	lines: string[],
	totalLineIndex: number,
	totalAmount: number
): ReceiptLineItem[] {
	const searchWindow =
		totalLineIndex > 0 ? lines.slice(0, totalLineIndex) : lines;
	const tableHeaderIndex = searchWindow.findIndex((line) => isTableHeaderLine(line.toLowerCase()));
	const candidateLines = tableHeaderIndex >= 0 ? searchWindow.slice(tableHeaderIndex + 1) : searchWindow;
	const items: ReceiptLineItem[] = [];

	for (const line of candidateLines) {
		const lower = line.toLowerCase();
		if (
			!hasLetters(line) ||
			containsAny(lower, NON_ITEM_KEYWORDS) ||
			looksLikeDate(line) ||
			isAdministrativeNumberLine(lower) ||
			isLikelyLabelOnlyLine(line)
		) {
			continue;
		}

		const amountMatches = getAmountMatchesFromLine(line);
		const selected = selectPreferredAmountMatch(line, amountMatches, 'line-item');
		if (!selected) {
			continue;
		}

		const amount = selected.value;
		if (amount === totalAmount) {
			continue;
		}

		const quantity = detectQuantity(line, amountMatches);
		const name = cleanupLineItemName(line);
		if (!name || name.length < 2) {
			continue;
		}

		items.push({
			name,
			amount,
			quantity,
		});
	}

	return dedupeLineItems(items).slice(0, 8);
}

function estimateConfidence(input: {
	rawText: string;
	merchantName: string;
	total: number;
	totalSource: TotalResolution['source'];
	subtotal: number | null;
	tax: number | null;
	paymentMethod: string;
	receiptDate: string;
	items: ReceiptLineItem[];
}) {
	let score = 0.34;
	const noiseLineCount = input.rawText
		.split('\n')
		.map((line) => normalizeLine(line))
		.filter((line) => isAdministrativeNumberLine(line.toLowerCase()) || isLikelyLabelOnlyLine(line)).length;

	if (input.rawText.length >= 40) {
		score += 0.08;
	}

	if (input.rawText.length >= 100) {
		score += 0.04;
	}

	if (input.merchantName) {
		score += 0.18;
	}

	if (input.total > 0) {
		score += 0.24;
	}

	if (input.totalSource === 'keyword') {
		score += 0.08;
	}

	if (input.totalSource === 'subtotal') {
		score -= 0.02;
	}

	if (input.totalSource === 'subtotal_plus_tax') {
		score += 0.02;
	}

	if (input.totalSource === 'fallback') {
		score -= 0.18;
	}

	if (input.subtotal !== null) {
		score += 0.04;
	}

	if (input.tax !== null) {
		score += 0.04;
	}

	if (input.paymentMethod) {
		score += 0.05;
	}

	if (input.receiptDate !== toIsoDate(new Date())) {
		score += 0.05;
	}

	if (input.items.length > 0) {
		score += input.items.length >= 3 ? 0.08 : 0.04;
	} else {
		score -= 0.12;
	}

	const itemsTotal = input.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
	if (itemsTotal > 0 && Math.abs(itemsTotal - input.total) <= 2) {
		score += 0.05;
	}

	if (!input.merchantName) {
		score -= 0.08;
	}

	if (!hasDecimalNumber(String(input.total)) && input.total >= 1000) {
		score -= 0.18;
	}

	if (noiseLineCount >= 4) {
		score -= 0.05;
	}

	return clamp(roundMoney(score), 0.28, 0.94);
}

function cleanupMerchantName(line: string) {
	return line
		.replace(/^(tax invoice|invoice|receipt)[:\s-]*/i, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

function cleanupLineItemName(line: string) {
	return line
		.replace(/^\s*[-*]\s*/g, '')
		.replace(/\b\d{1,2}\s+(?=(?:AED|A\.?E\.?D\.?|DHS|SAR|USD|EUR|\$)\s*\d+(?:\.\d{2})?\b)/gi, '')
		.replace(AMOUNT_PATTERN, '')
		.replace(/\$/g, ' ')
		.replace(/\b(?:AED|A\.?E\.?D\.?|DHS|SAR|USD|EUR)\b/gi, ' ')
		.replace(/\bqty[:\s-]*\d+(?:\.\d+)?\b/gi, '')
		.replace(/\b\d+(?:\.\d+)?\s*x\b/gi, '')
		.replace(/\bx\s*\d+(?:\.\d+)?\b/gi, '')
		.replace(/[()]/g, ' ')
		.replace(/\b(?:name|qty|price)\b/gi, '')
		.replace(/[|]/g, ' ')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

function detectQuantity(line: string, amountMatches: AmountMatch[] = []) {
	const quantityPatterns = [
		/\bqty[:\s-]*(\d+(?:\.\d+)?)\b/i,
		/\b(\d+(?:\.\d+)?)\s*x\b/i,
		/\bx\s*(\d+(?:\.\d+)?)\b/i,
		/\b(\d{1,2})\s+(?=(?:AED|A\.?E\.?D\.?|DHS|SAR|USD|EUR|\$)\s*\d+(?:\.\d{2})?\b)/i,
	];

	for (const pattern of quantityPatterns) {
		const match = line.match(pattern);
		if (match?.[1]) {
			return roundMoney(Number.parseFloat(match[1]));
		}
	}

	if (amountMatches.length >= 2) {
		const possibleQuantity = amountMatches[0]?.value;
		const lastAmount = amountMatches[amountMatches.length - 1]?.value;
		if (
			possibleQuantity !== undefined &&
			lastAmount !== undefined &&
			Number.isInteger(possibleQuantity) &&
			possibleQuantity > 0 &&
			possibleQuantity <= 24 &&
			lastAmount > possibleQuantity
		) {
			return possibleQuantity;
		}
	}

	return null;
}

function dedupeLineItems(items: ReceiptLineItem[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = `${item.name.toLowerCase()}|${item.amount ?? 'na'}|${item.quantity ?? 'na'}`;
		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
}

type AmountMatch = {
	value: number;
	raw: string;
	hasDecimals: boolean;
	hasCurrency: boolean;
};

function getAmountMatchesFromLine(line: string) {
	const amounts: AmountMatch[] = [];
	const matches = line.matchAll(AMOUNT_PATTERN);
	for (const match of matches) {
		const parsed = parseMoney(match[1]);
		if (parsed !== null) {
			amounts.push({
				value: parsed,
				raw: match[1],
				hasDecimals: match[1].includes('.'),
				hasCurrency: hasCurrencyToken(line),
			});
		}
	}

	return amounts;
}

function hasAmount(line: string) {
	return getAmountMatchesFromLine(line).length > 0;
}

function hasLetters(line: string) {
	return /[A-Za-z]/.test(line);
}

function looksLikeDate(line: string) {
	return /\b\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}\b/.test(line);
}

function isAdministrativeNumberLine(lower: string) {
	return containsAny(lower, CONTACT_KEYWORDS);
}

function isTableHeaderLine(lower: string) {
	return TABLE_HEADER_KEYWORDS.every((keyword) => lower.includes(keyword));
}

function isLikelyLabelOnlyLine(line: string) {
	const lower = line.toLowerCase().trim();
	return (
		LABEL_ONLY_PATTERNS.some((pattern) => pattern.test(line.trim())) ||
		MERCHANT_BLOCKLIST.includes(lower)
	);
}

function scoreMerchantCandidate(line: string) {
	const lower = line.toLowerCase().trim();
	if (
		!hasLetters(line) ||
		looksLikeDate(line) ||
		isAdministrativeNumberLine(lower) ||
		isLikelyLabelOnlyLine(line) ||
		isTableHeaderLine(lower)
	) {
		return -100;
	}

	let score = 0;

	if (line.includes(':')) {
		score -= 30;
	}

	if (hasAmount(line)) {
		score -= 22;
	}

	if (containsAny(lower, MERCHANT_BLOCKLIST)) {
		score -= 40;
	}

	if (/^[A-Z0-9 &.'-]{4,}$/.test(line)) {
		score += 34;
	}

	if (line.split(' ').length >= 2) {
		score += 10;
	}

	if (line.length >= 4 && line.length <= 40) {
		score += 8;
	}

	if (/^[A-Za-z][A-Za-z &.'-]{3,}$/.test(line)) {
		score += 12;
	}

	return score;
}

function selectPreferredAmountMatch(
	line: string,
	matches: AmountMatch[],
	mode: 'total' | 'fallback' | 'line-item'
) {
	if (matches.length === 0) {
		return null;
	}

	const lower = line.toLowerCase();
	const filtered = matches.filter((match) => {
		if (mode === 'line-item') {
			return match.hasDecimals || match.hasCurrency || match.value < 1000;
		}

		if (mode === 'fallback') {
			return (
				match.hasDecimals ||
				match.hasCurrency ||
				containsAny(lower, SUBTOTAL_KEYWORDS) ||
				containsAny(lower, TOTAL_PRIORITIES.map((entry) => entry.pattern))
			);
		}

		if (isAdministrativeNumberLine(lower) && !containsAny(lower, TOTAL_PRIORITIES.map((entry) => entry.pattern))) {
			return false;
		}

		return match.hasDecimals || match.hasCurrency || containsAny(lower, TOTAL_PRIORITIES.map((entry) => entry.pattern));
	});

	if (filtered.length === 0) {
		return null;
	}

	return filtered[filtered.length - 1];
}

function containsAny(value: string, patterns: string[]) {
	return patterns.some((pattern) => value.includes(pattern));
}

function normalizeDateMatch(parts: string[]) {
	if (parts.length !== 3) {
		return null;
	}

	let year = 0;
	let month = 0;
	let day = 0;

	if (parts[0].length === 4) {
		year = Number.parseInt(parts[0], 10);
		month = Number.parseInt(parts[1], 10);
		day = Number.parseInt(parts[2], 10);
	} else {
		day = Number.parseInt(parts[0], 10);
		month = Number.parseInt(parts[1], 10);
		year = Number.parseInt(parts[2], 10);
		if (year < 100) {
			year += year >= 70 ? 1900 : 2000;
		}
	}

	if (!isValidDateParts(year, month, day)) {
		return null;
	}

	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isValidDateParts(year: number, month: number, day: number) {
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		return false;
	}

	if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
		return false;
	}

	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

function parseMoney(value: string) {
	const numeric = Number.parseFloat(value.replace(/,/g, ''));
	if (!Number.isFinite(numeric)) {
		return null;
	}

	return roundMoney(numeric);
}

function roundMoney(value: number) {
	return Math.round(value * 100) / 100;
}

function hasCurrencyToken(value: string) {
	return /\b(?:AED|A\.?E\.?D\.?|DHS|SAR|USD|EUR)\b|\$/i.test(value);
}

function hasMonetarySignal(value: string) {
	return hasCurrencyToken(value) || /\d+\.\d{2}\b/.test(value);
}

function hasDecimalNumber(value: string) {
	return /\d+\.\d{2}\b/.test(value);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function toIsoDate(date: Date) {
	return date.toISOString().slice(0, 10);
}
