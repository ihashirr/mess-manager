import type { CustomerFormValues } from '../../types';
import { formatISO } from '../../utils/weekLogic';

export const createInitialCustomerFormValues = (): CustomerFormValues => {
	const startDate = formatISO(new Date());
	const endDate = new Date();
	endDate.setMonth(endDate.getMonth() + 1);

	return {
		name: '',
		phone: '',
		location: '',
		flat: '',
		mapLink: '',
		isLunch: true,
		isDinner: false,
		price: '350',
		notes: '',
		startDate,
		endDate: formatISO(endDate),
	};
};

