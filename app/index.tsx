import { collection, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { db } from '../firebase/config';

export default function Index() {
	const [stats, setStats] = useState({
		activeCount: 0,
		paymentsDue: 0,
		lunchCount: 0,
		dinnerCount: 0
	});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const q = query(collection(db, "customers"));

		const unsubscribe = onSnapshot(q, (querySnapshot) => {
			let active = 0;
			let due = 0;
			let lunch = 0;
			let dinner = 0;

			querySnapshot.forEach((doc) => {
				const data = doc.data();
				if (data.daysLeft > 0) active++;
				if (data.paymentDue) due++;
				if (data.plan && data.plan.includes("Lunch")) lunch++;
				if (data.plan && data.plan.includes("Dinner")) dinner++;
			});

			setStats({
				activeCount: active,
				paymentsDue: due,
				lunchCount: lunch,
				dinnerCount: dinner
			});
			setLoading(false);
		});

		return () => unsubscribe();
	}, []);

	if (loading) return <View style={styles.container}><Text>Loading...</Text></View>;

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Text style={styles.dateLabel}>Today: 21 Feb 2026</Text>

			<View style={styles.statCard}>
				<Text style={styles.statValue}>{stats.activeCount}</Text>
				<Text style={styles.statLabel}>Active Customers</Text>
			</View>

			<View style={[styles.statCard, { borderColor: '#d32f2f' }]}>
				<Text style={[styles.statValue, { color: '#d32f2f' }]}>{stats.paymentsDue}</Text>
				<Text style={styles.statLabel}>Payments Due</Text>
			</View>

			<View style={styles.statCard}>
				<Text style={styles.statValue}>{stats.lunchCount}</Text>
				<Text style={styles.statLabel}>Lunch Count</Text>
			</View>

			<View style={styles.statCard}>
				<Text style={styles.statValue}>{stats.dinnerCount}</Text>
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
