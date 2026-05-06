import { useWindowDimensions } from 'react-native';
import { getResponsiveUiMetrics } from '../../constants/uiSpec';

export const useResponsiveLayout = () => {
	const { width } = useWindowDimensions();
	return getResponsiveUiMetrics(width);
};
