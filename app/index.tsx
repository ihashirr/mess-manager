import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppContent } from "./_layout";

export default function Index() {
	const { customers } = useAppContent();

	const activeCount = customers.filter(c => c.daysLeft > 0).length;
	const paymentsDue = customers.filter(c => c.paymentDue).length;
	const lunchCount = customers.filter(c => c.plan.includes("Lunch")).length;
	const dinnerCount = customers.filter(c => c.plan.includes("Dinner")).length;

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Text style={styles.dateLabel}>Today: 21 Feb 2026</Text>

			<View style={styles.statCard}>
				<Text style={styles.statValue}>{activeCount}</Text>
				<Text style={styles.statLabel}>Active Customers</Text>
			</View>

			<View style={[styles.statCard, { borderColor: '#d32f2f' }]}>
				<Text style={[styles.statValue, { color: '#d32f2f' }]}>{paymentsDue}</Text>
				<Text style={styles.statLabel}>Payments Due</Text>
			</View>

			<View style={styles.statCard}>
				<Text style={styles.statValue}>{lunchCount}</Text>
				<Text style={styles.statLabel}>Lunch Count</Text>
			</View>

			<View style={styles.statCard}>
				<Text style={styles.statValue}>{dinnerCount}</Text>
				<Text style={styles.statLabel}>Dinner Count</Text>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	content: {
		padding: 20,
		alignItems: 'center',
	},
	dateLabel: {
		fontSize: 24,
		color: '#666',
		fontWeight: 'bold',
		marginBottom: 30,
		marginTop: 10,
	},
	statCard: {
		width: '100%',
		padding: 30,
		backgroundColor: '#f8f9fa',
		borderRadius: 20,
		borderWidth: 2,
		borderColor: '#e9ecef',
		alignItems: 'center',
		marginBottom: 20,
	},
	statValue: {
		fontSize: 64,
		fontWeight: '900',
		color: '#1a1a1a',
	},
	statLabel: {
		fontSize: 20,
		color: '#495057',
		fontWeight: '600',
		marginTop: 5,
	}
});
