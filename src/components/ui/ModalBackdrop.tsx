import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../context/ThemeModeContext';

interface ModalBackdropProps {
	intensity?: number;
}

export const ModalBackdrop: React.FC<ModalBackdropProps> = ({
	intensity = 28,
}) => {
	const { isDark } = useAppTheme();

	return (
		<View pointerEvents="none" style={StyleSheet.absoluteFill}>
			<BlurView
				intensity={Platform.OS === 'android' ? Math.min(100, intensity + 12) : intensity}
				tint={isDark ? 'dark' : 'light'}
				experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
				blurReductionFactor={Platform.OS === 'android' ? 1.6 : undefined}
				style={StyleSheet.absoluteFillObject}
			/>
			<View
				style={[
					StyleSheet.absoluteFillObject,
					{
						backgroundColor: isDark ? 'rgba(4, 4, 4, 0.44)' : 'rgba(24, 18, 12, 0.20)',
					},
				]}
			/>
		</View>
	);
};
