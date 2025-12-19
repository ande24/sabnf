import { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { AppText as Text } from 'components/FontProvider';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import firebase_app from 'firebase/config';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Transaction = {
  id: string;
  type: 'cash_in' | 'cash_out' | 'bet';
  amount: number;
  timestamp: Timestamp;
  reason?: string;
  side?: string;
  fight_number?: number;
};

export const TodaysReport = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCashIn, setTotalCashIn] = useState(0);
  const [totalPayouts, setTotalPayouts] = useState(0);
  const [totalBets, setTotalBets] = useState(0);

  const db = getFirestore(firebase_app);
  const auth = getAuth();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Get today's start and end timestamps
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = Timestamp.fromDate(today);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayEnd = Timestamp.fromDate(tomorrow);

    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('tellerId', '==', user.uid),
      where('timestamp', '>=', todayStart),
      where('timestamp', '<', todayEnd),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txns: Transaction[] = [];
      let cashIn = 0;
      let payouts = 0;
      let bets = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        txns.push({
          id: doc.id,
          type: data.type,
          amount: data.amount,
          timestamp: data.timestamp,
          reason: data.reason,
          side: data.side,
          fight_number: data.fight_number,
        });

        if (data.type === 'cash_in') {
          cashIn += data.amount;
        } else if (data.type === 'cash_out') {
          payouts += data.amount;
        } else if (data.type === 'bet') {
          bets += data.amount;
        }
      });

      setTransactions(txns);
      setTotalCashIn(cashIn);
      setTotalPayouts(payouts);
      setTotalBets(bets);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatTime = (timestamp: Timestamp): string => {
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const renderTransaction = (item: Transaction) => (
    <View key={item.id} className="bg-zinc-800 rounded-lg p-3 mb-2 border border-zinc-700">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-x-2">
          <MaterialCommunityIcons 
            name={item.type === 'cash_in' ? 'download' : item.type === 'cash_out' ? 'upload' : 'hand-coin'} 
            size={20} 
            color={item.type === 'cash_in' ? '#3b82f6' : item.type === 'cash_out' ? '#ef4444' : '#fbbf24'} 
          />
          <Text style={{ fontFamily: 'Orbitron-bold' }} className={`text-sm ${item.type === 'cash_in' ? 'text-blue-400' : item.type === 'cash_out' ? 'text-red-400' : 'text-yellow-400'}`}>
            {item.type === 'cash_in' ? 'CASH IN' : item.type === 'cash_out' ? 'PAYOUT' : 'BET'}
          </Text>
        </View>
        <Text style={{ fontFamily: 'Orbitron-bold' }} className={`text-lg ${item.type === 'cash_in' ? 'text-blue-400' : item.type === 'cash_out' ? 'text-red-400' : 'text-yellow-400'}`}>
          {item.type === 'cash_in' ? '+' : '-'}₱{formatNumber(item.amount)}
        </Text>
      </View>
      <Text className="text-gray-400 text-xs mb-1">{formatTime(item.timestamp)}</Text>
      {item.type === 'bet' && item.side && (
        <Text className="text-gray-400 text-xs">
          Fight #{item.fight_number} - {item.side}
        </Text>
      )}
      {item.reason && (
        <Text className="text-gray-400 text-xs italic">{item.reason}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Summary Cards */}
      <View className="flex-row gap-x-2 mb-3 pt-3 px-4">
        <View className="flex-1 bg-blue-600/20 border border-blue-500 rounded-lg p-2">
          <Text style={{ fontFamily: 'Orbitron-bold' }} className="text-blue-400 text-[10px] text-center mb-1">
            TOTAL CASH IN
          </Text>
          <Text style={{ fontFamily: 'Orbitron-bold' }} className="text-blue-400 text-sm text-center">
            ₱{formatNumber(totalCashIn)}
          </Text>
        </View>
        <View className="flex-1 bg-red-600/20 border border-red-500 rounded-lg p-2">
          <Text style={{ fontFamily: 'Orbitron-bold' }} className="text-red-400 text-[10px] text-center mb-1">
            TOTAL PAYOUTS
          </Text>
          <Text style={{ fontFamily: 'Orbitron-bold' }} className="text-red-400 text-sm text-center">
            ₱{formatNumber(totalPayouts)}
          </Text>
        </View>
        <View className="flex-1 bg-yellow-600/20 border border-yellow-500 rounded-lg p-2">
          <Text style={{ fontFamily: 'Orbitron-bold' }} className="text-yellow-400 text-[10px] text-center mb-1">
            TOTAL BETS
          </Text>
          <Text style={{ fontFamily: 'Orbitron-bold' }} className="text-yellow-400 text-sm text-center">
            ₱{formatNumber(totalBets)}
          </Text>
        </View>
      </View>

      {/* Transactions List */}
      <ScrollView 
        className="flex-1 px-4"
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}>
        {transactions.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <MaterialCommunityIcons name="file-document-outline" size={60} color="#52525b" />
            <Text style={{ fontFamily: 'Orbitron-bold' }} className="text-gray-500 text-sm mt-4">
              No transactions today
            </Text>
          </View>
        ) : (
          <>
            {transactions.map((item) => renderTransaction(item))}
          </>
        )}
      </ScrollView>
    </View>
  );
};
