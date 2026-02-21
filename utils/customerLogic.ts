/**
 * Utility functions for deriving customer subscription status and financial data.
 * "Stored numbers rot. Derived numbers stay honest."
 */

export type CustomerStatus = 'active' | 'expiring-soon' | 'expired';

/**
 * Calculates days remaining until a given end date.
 */
export function getDaysLeft(endDate: Date): number {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const end = new Date(endDate);
	end.setHours(0, 0, 0, 0);

	const diffTime = end.getTime() - today.getTime();
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

	return diffDays;
}

/**
 * Determines the subscription status based on the end date.
 */
export function getCustomerStatus(endDate: Date): CustomerStatus {
	const daysLeft = getDaysLeft(endDate);

	if (daysLeft < 0) return 'expired';
	if (daysLeft <= 3) return 'expiring-soon';
	return 'active';
}

/**
 * Calculates the remaining balance for a customer.
 */
export function getDueAmount(pricePerMonth: number, totalPaid: number): number {
	return Math.max(0, pricePerMonth - totalPaid);
}

/**
 * Utility to convert Firestore Timestamp or ISO string to Date object.
 */
export function toDate(dateVal: any): Date {
	if (!dateVal) return new Date();
	if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
	return new Date(dateVal);
}
