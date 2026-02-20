import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useAppContent } from './_layout';

export default function CustomersScreen() {
	const { customers } = useAppContent();

	// Rule: If customer daysLeft > 0 -> show in Customers list
	const activeCustomers = customers.filter(c => c.daysLeft > 0);

	return (
		<View style={styles.container}>
			<FlatList
				data={activeCustomers}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<View style={styles.card}>
						<Text style={styles.name}>{item.name}</Text>
						<View style={styles.details}>
							<Text style={styles.plan}>{item.plan}</Text>
							<Text style={styles.days}>{item.daysLeft} days left</Text>
						</View>
					</View>
				)}
				ListEmptyComponent={<Text style={styles.empty}>No active customers</Text>}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#fff',
	},
	card: {
		padding: 20,
		borderWidth: 1,
		borderColor: '#eee',
		borderRadius: 12,
		marginBottom: 15,
	},
	name: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 8,
	},
	details: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	plan: {
		fontSize: 18,
		color: '#666',
	},
	days: {
		fontSize: 18,
		fontWeight: '600',
		color: '#d32f2f',
	},
	empty: {
		textAlign: 'center',
		fontSize: 18,
		marginTop: 50,
		color: '#999',
	}
});
