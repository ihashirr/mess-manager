import React from 'react';
import {StyleProp, StyleSheet, Text, View, ViewStyle} from 'react-native';

import {Theme} from '../../constants/Theme';
import {useAppTheme} from '../../context/ThemeModeContext';
import {FOOD_THEME} from '../../theme';
import {OperationalPulse} from './OperationalPulse';

export type EmberAlertProps = {
	label: string;
	tone?: string;
	style?: StyleProp<ViewStyle>;
	compact?: boolean;
};

const withAlpha = (color: string, alphaHex: string) => {
	if (color.startsWith('#') && color.length === 7) {
		return `${color}${alphaHex}`;
	}
	return color;
};

export const EmberAlert: React.FC<EmberAlertProps> = ({
	label,
	tone = FOOD_THEME.colors.saffronDeep,
	style,
	compact = false,
}) => {
	const {colors, isDark} = useAppTheme();

	return (
		<View
			style={[
				styles.root,
				compact && styles.compact,
				{
					backgroundColor: withAlpha(tone, isDark ? '20' : '12'),
					borderColor: withAlpha(tone, isDark ? '3D' : '24'),
				},
				style,
			]}
		>
			<OperationalPulse active tone={tone} size={compact ? 12 : 16} />
			<Text style={[styles.label, compact && styles.compactLabel, {color: compact ? colors.textSecondary : tone}]}>
				{label}
			</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center',
		alignSelf: 'flex-start',
		gap: 7,
		borderWidth: 1,
		borderRadius: Theme.radius.full,
		paddingHorizontal: 10,
		paddingVertical: 7,
	},
	compact: {
		gap: 5,
		paddingHorizontal: 0,
		paddingVertical: 0,
		borderWidth: 0,
		backgroundColor: 'transparent',
	},
	label: {
		...Theme.typography.detailBold,
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 0.35,
	},
	compactLabel: {
		fontSize: 10,
	},
});
