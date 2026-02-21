import { collection, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SETTINGS } from '../constants/Settings';
import { db } from '../firebase/config';
import { getDaysLeft, getDueAmount, toDate } from '../utils/customerLogic';
import { mockDb } from '../utils/mockDb';

export default function Index() {
	const [stats, setStats] = useState({
		activeCount: 0,
		paymentsDue: 0,
		lunchCount: 0,
		dinnerCount: 0
	});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const calculateStats = (customerData: any[]) => {
			let active = 0;
			let dueCount = 0;
			let lunch = 0;
			let dinner = 0;

			customerData.forEach((data) => {
				const endDate = toDate(data.endDate);
				const daysLeft = getDaysLeft(endDate);
				const due = getDueAmount(data.pricePerMonth, data.totalPaid);

				if (daysLeft >= 0) {
					active++;
					const isLunch = (data as any).mealsPerDay?.lunch || (data as any).plan === "lunch" || (data as any).plan === "both";
					const isDinner = (data as any).mealsPerDay?.dinner || (data as any).plan === "dinner" || (data as any).plan === "both";
					if (isLunch) lunch++;
					if (isDinner) dinner++;
					if (due > 0) dueCount++;
				}
			});

			setStats({
				activeCount: active,
				paymentsDue: dueCount,
				lunchCount: lunch,
				dinnerCount: dinner
			});
			setLoading(false);
		};

		if (SETTINGS.USE_MOCKS) {
			calculateStats(mockDb.getCustomers());
			const unsub = mockDb.subscribe(() => calculateStats(mockDb.getCustomers()));
			return unsub;
		}

		const q = query(collection(db, "customers"));

		const unsubscribe = onSnapshot(q, (querySnapshot) => {
			let active = 0;
			let dueCount = 0;
			let lunch = 0;
			let dinner = 0;

			querySnapshot.forEach((doc) => {
				const data = doc.data();
				const endDate = toDate(data.endDate);
				const daysLeft = getDaysLeft(endDate);
				const due = getDueAmount(data.pricePerMonth, data.totalPaid);

				if (daysLeft >= 0) {
					active++;
					const isLunch = (data as any).mealsPerDay?.lunch || (data as any).plan === "lunch" || (data as any).plan === "both";
					const isDinner = (data as any).mealsPerDay?.dinner || (data as any).plan === "dinner" || (data as any).plan === "both";
					if (isLunch) lunch++;
					if (isDinner) dinner++;
					if (due > 0) dueCount++;
				}
			});

			setStats({
				activeCount: active,
				paymentsDue: dueCount,
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
			<Text style={styles.dateLabel}>
				Today: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
			</Text>

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
