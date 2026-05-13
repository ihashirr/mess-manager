import { useWindowDimensions } from 'react-native';
import { getResponsiveUiMetrics } from '../constants/uiSpec';

export const useResponsiveLayout = () => {
	const { width, height, fontScale } = useWindowDimensions();
	return getResponsiveUiMetrics(width, height, fontScale);
};

