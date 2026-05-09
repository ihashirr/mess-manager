export type ServingBreakdownMeal = 'lunch' | 'dinner' | 'total';

export type OperationalSheetRoute =
	| { name: 'customer-detail'; customerId: string }
	| { name: 'customer-form'; mode: 'add' }
	| { name: 'customer-form'; mode: 'edit'; customerId: string }
	| { name: 'customer-stats' }
	| { name: 'serving-breakdown'; meal: ServingBreakdownMeal }
	| { name: 'receipt-scanner' }
	| { name: 'sync-queue' }
	| { name: 'copy-menu' };

export type CustomerSheetEvent =
	| { type: 'customer.attendance'; customerId: string }
	| { type: 'customer.delete'; customerId: string }
	| { type: 'customer.edit'; customerId: string }
	| { type: 'customer.payment'; customerId: string }
	| { type: 'sheet.dismiss' };
