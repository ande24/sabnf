import { useEffect, useState } from 'react';
import { View, TouchableOpacity, TextInput, Alert } from 'react-native';
import { AppText as Text } from 'components/FontProvider';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

import { getAuth, User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  where,
  query,
  Timestamp,
  getDoc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';

import QRCode from 'react-native-qrcode-svg';
import firebase_app from 'firebase/config';
import { generateBetId } from '../utils/betIdGenerator';

const StyledGradient = cssInterop(LinearGradient, {
  className: 'style',
});

type BetWalaProps = {
  onClose: () => void;
  onPrint: (payload: {
    title?: string;
    lines: string[];
    qrcode?: string;
  }) => Promise<void>;
};

type AdminConfigType = {
  current_fight: number;
  current_set: number;
  commission_pct: number;
  commission_total: number;
  meron_open: boolean;
  wala_open: boolean;
  petty_cash: number;
  show_display: boolean;
  tv_message: string;
};

type FightDataType = {
  id: string;
  commission: number;
  fight_number: number;
  set_number: number;
  meron_total: number;
  wala_total: number;
  draw_total: number;
  meron_odds: number;
  wala_odds: number;
  draw_odds: number;
  draw_multiplier: number;
  outcome: string;
  status: string;
  timestamp: Timestamp;
  collection: string;
};

const db = getFirestore(firebase_app);

export const BetWala = ({ onClose, onPrint }: BetWalaProps) => {
  const [user, setUser] = useState<User | null>(null);

  const [betAmount, setBetAmount] = useState('0');

  const [adminConfig, setAdminConfig] = useState<AdminConfigType | null>(null);
  const [fightData, setFightData] = useState<FightDataType | null>(null);

  const [receipt, setReceipt] = useState<any | null>(null);
  const [receiptQR, setReceiptQR] = useState<string>('');

  // Helper function to format time as HH:MM:SS AM/PM
  const formatTime = (date: Date): string => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = hours.toString().padStart(2, '0');
    return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
          return;
        }

        setUser(currentUser);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const configRef = doc(db, 'admin', 'config');
    const unsubscribe = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        setAdminConfig(snapshot.data() as AdminConfigType);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!adminConfig) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');

    const collectionName = `fights_${year}_${month}`;
    const prevCollectionName = `fights_${prevYear}_${prevMonth}`;

    let unsubCurrent: (() => void) | null = null;
    let unsubPrev: (() => void) | null = null;

    const fetchFight = (
      colName: string,
      onFound: (fight: FightDataType, id: string, col: string) => void,
      onNotFound: () => void
    ) => {
      const fightsRef = collection(db, colName);
      const q = query(
        fightsRef,
        where('fight_number', '==', adminConfig.current_fight),
        where('set_number', '==', adminConfig.current_set)
      );
      return onSnapshot(q, (querySnapshot) => {
        if (!querySnapshot.empty) {
          const fight = querySnapshot.docs[0].data() as FightDataType;
          onFound(fight, querySnapshot.docs[0].id, colName);
        } else {
          onNotFound();
        }
      });
    };

    unsubCurrent = fetchFight(
      collectionName,
      (fight, id) => {
        setFightData({ ...fight, id, collection: collectionName });
        if (unsubPrev) {
          unsubPrev();
          unsubPrev = null;
        }
      },
      () => {
        unsubPrev = fetchFight(
          prevCollectionName,
          (fight, id) => {
            setFightData({ ...fight, id, collection: prevCollectionName });
          },
          () => {
            setFightData(null);
          }
        );
      }
    );

    return () => {
      if (unsubCurrent) unsubCurrent();
      if (unsubPrev) unsubPrev();
    };
  }, [adminConfig]);

  const handleSubmit = async () => {
    if (!adminConfig || !fightData) return;

    if (Number(betAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid bet amount.');
      return;
    }

    try {
      if (!user) {
        return;
      }

      const db = getFirestore();

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const collectionName = `bets_${year}_${month}`;

      const docId = await generateBetId();
      const betCollection = collection(db, 'tellers', user.uid, collectionName);
      const betDocRef = doc(betCollection, docId);

      await setDoc(betDocRef, {
        amount: Number(betAmount),
        fight_number: adminConfig.current_fight,
        side: 'WALA',
        timestamp: Timestamp.fromDate(now),
        teller: user.email,
        teller_id: user.uid,
        fight_id: fightData.id,
        id: docId,
        set_number: adminConfig.current_set,
        fight_collection: fightData.collection,
      });

      await setDoc(doc(collection(db, 'receipts'), docId), {
        id: docId,
        teller_id: user.uid,
        collection: collectionName,
      });

      // Record bet transaction for Today's Report
      await setDoc(doc(collection(db, 'transactions'), `${docId}_bet`), {
        tellerId: user.uid,
        type: 'bet',
        amount: Number(betAmount),
        timestamp: Timestamp.fromDate(now),
        createdAt: now.toISOString(),
        bet_id: docId,
        fight_id: fightData.id,
        fight_number: adminConfig.current_fight,
        side: 'WALA',
        reason: `Bet placed on WALA - Fight #${adminConfig.current_fight}`,
      });

      const fightDocRef = doc(db, fightData.collection, fightData.id);
      const fightDocSnapshot = await getDoc(fightDocRef);

      if (fightDocSnapshot.exists()) {
        const fightDocData = fightDocSnapshot.data();
        console.log('Fight Document Data:', fightDocData);

        const updatedWalaTotal = (fightDocData.wala_total || 0) + Number(betAmount);
        await updateDoc(fightDocRef, {
          wala_total: updatedWalaTotal,
        });
        console.log('Fight document updated with new wala_total:', updatedWalaTotal);
      } else {
        console.log('No fight document found with the given ID.');
      }

      console.log('Bet added successfully!');

      const nowDate = new Date();
      const formattedDate = nowDate.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Manila',
      });
      const formattedTime = formatTime(nowDate);
      const betDetails = {
        fight_number: adminConfig.current_fight,
        set_number: adminConfig.current_set,
        side: 'WALA',
        amount: Number(betAmount),
        odds: fightData.wala_odds,
        formattedDate,
        formattedTime,
        teller: user.email,
        teller_id: user.uid,
        id: docId,
        fight_id: fightData.id,
      };

      const qrValue = `fight_id=${fightData.id},bet_id=${docId},teller=${user.uid},timestamp=${nowDate.toISOString()},fight_collection=${fightData.collection}`;
      setReceipt(betDetails);
      setReceiptQR(qrValue);
    } catch (error) {
      console.error('Error adding bet:', error);
    }
  };

  const formatNumber = (number: number): string => {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  if (receipt) {
    return (
      <View className="flex-1 items-center justify-center bg-black/80 px-4">
        <View className="w-full max-w-md rounded-2xl bg-white p-4">
          <Text style={{ fontFamily: 'Orbitron-bold', fontSize: 22, textAlign: 'center', marginBottom: 8 }}>BET RECEIPT</Text>
          <Text style={{ textAlign: 'center', marginBottom: 8 }}>{receipt.formattedDate} {receipt.formattedTime}</Text>
          <Text style={{ marginBottom: 2 }}>Teller: {receipt.teller}</Text>
          <Text style={{ marginBottom: 2 }}>Bet ID: {receipt.id}</Text>
          <Text style={{ marginBottom: 2 }}>Fight ID: {receipt.fight_id}</Text>
          <Text style={{ marginBottom: 2 }}>Fight #: {receipt.fight_number}</Text>
          <Text style={{ marginBottom: 2 }}>Side: {receipt.side}</Text>
          <Text style={{ marginBottom: 2 }}>Amount: P{formatNumber(receipt.amount)}</Text>
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <QRCode value={receiptQR} size={180} />
            <Text style={{ marginTop: 8, textAlign: 'center' }}>Save this receipt and QR for payout</Text>
          </View>
          <TouchableOpacity onPress={() => {onPrint({
            title: 'BET RECEIPT',
            lines: [
              `${receipt.formattedDate} ${receipt.formattedTime}`,
              `Teller: ${receipt.teller}`,
              `Bet ID: ${receipt.id}`,
              `Fight ID: ${receipt.fight_id}`,
              `Fight #: ${receipt.fight_number}`,
              `Side: ${receipt.side}`,
              `Amount: P${formatNumber(receipt.amount)}`,
            ],
            qrcode: receiptQR,
          })}
            } style={{ backgroundColor: '#2563eb', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <Text style={{ color: 'white', textAlign: 'center', fontFamily: 'Orbitron-bold', fontSize: 18 }}>PRINT RECEIPT</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setReceipt(null); onClose(); }} style={{ backgroundColor: '#dc2626', borderRadius: 8, padding: 12, marginTop: 0 }}>
            <Text style={{ color: 'white', textAlign: 'center', fontFamily: 'Orbitron-bold', fontSize: 18 }}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!fightData || !adminConfig) {
    return;
  }
  return (
    <View className="flex-1 items-center justify-center bg-black/80">
      <View className="w-11/12 rounded-2xl bg-zinc-800">

        <View className="w-full rounded-t-2xl">
          <StyledGradient
            colors={['#1e3a8a', '#1d4ed8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="relative w-full flex-row items-center justify-center rounded-t-2xl p-4">
            <Text style={{ fontFamily: "Orbitron-bold"}} className="text-4xl tracking-widest text-white">WALA</Text>
            <TouchableOpacity
              className="absolute right-3 rounded-full bg-black/20 p-2"
              onPress={() => onClose()}>
              <Feather name="x" size={24} color="white" />
            </TouchableOpacity>
          </StyledGradient>
        </View>

        <StyledGradient
          colors={['#0f172a', '#172554']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          className="w-full flex-col items-center justify-center rounded-b-2xl px-4">
          {/* Min/Max and Total Row */}
          <View className="w-full flex-row justify-between items-center py-3">
            <Text className="text-sm text-white/70">Min: 20   Min: 5,000</Text>
            <View className="flex-row items-center gap-x-2 rounded-md border border-zinc-600 px-3 py-1">
              <Text className="text-sm text-white">Total</Text>
              <Text className="text-sm text-blue-400">
                {formatNumber(fightData.wala_total)}
              </Text>
            </View>
          </View>

          <View className="mb-4 h-14 flex-row items-center justify-center">
            <TouchableOpacity
              className="flex h-full flex-[2] items-center justify-center rounded-l-md bg-blue-600"
              onPress={() => setBetAmount((prev) => Math.max(0, Number(prev) - 10).toString())}>
              <StyledGradient
                colors={['#1e40af', '#2563eb']}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                className="flex h-full w-full items-center justify-center rounded-l-md">
                <Feather name="minus" size={26} color="white" />
              </StyledGradient>
            </TouchableOpacity>

            <TextInput
              className="h-full flex-[7] bg-white text-center text-3xl"
              style={{ fontFamily: "Orbitron-bold"}}
              value={formatNumber(Number(Number(betAmount).toFixed(0)))}
              keyboardType="numeric"
              onChangeText={(text) => setBetAmount(text.replace(/,/g, ''))}
              textAlignVertical="center"
            />

            <TouchableOpacity
              className="flex h-full flex-[2] items-center justify-center rounded-r-md bg-blue-600"
              onPress={() => setBetAmount((prev) => (Number(prev) + 10).toString())}>
              <StyledGradient
                colors={['#1e40af', '#2563eb']}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                className="flex h-full w-full items-center justify-center rounded-r-md">
                <Feather name="plus" size={26} color="white" />
              </StyledGradient>
            </TouchableOpacity>
          </View>

          <View className="mb-3 w-full">
            {/* Row 1: 7 8 9 */}
            <View className="flex-row justify-center gap-1 mb-1">
              {['7', '8', '9'].map((item) => (
                <TouchableOpacity
                  key={item}
                  className="h-14 flex-1 items-center justify-center rounded-md bg-white"
                  onPress={() => {
                    if (betAmount === '0') {
                      setBetAmount(item);
                    } else {
                      setBetAmount((prev) => prev + item);
                    }
                  }}>
                  <StyledGradient
                    colors={['#ffffff', '#d4d4d8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    className="flex h-full w-full items-center justify-center rounded-md">
                    <Text className="text-3xl text-black">{item}</Text>
                  </StyledGradient>
                </TouchableOpacity>
              ))}
            </View>
            {/* Row 2: 4 5 6 */}
            <View className="flex-row justify-center gap-1 mb-1">
              {['4', '5', '6'].map((item) => (
                <TouchableOpacity
                  key={item}
                  className="h-14 flex-1 items-center justify-center rounded-md bg-white"
                  onPress={() => {
                    if (betAmount === '0') {
                      setBetAmount(item);
                    } else {
                      setBetAmount((prev) => prev + item);
                    }
                  }}>
                  <StyledGradient
                    colors={['#ffffff', '#d4d4d8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    className="flex h-full w-full items-center justify-center rounded-md">
                    <Text className="text-3xl text-black">{item}</Text>
                  </StyledGradient>
                </TouchableOpacity>
              ))}
            </View>
            {/* Row 3: 1 2 3 */}
            <View className="flex-row justify-center gap-1 mb-1">
              {['1', '2', '3'].map((item) => (
                <TouchableOpacity
                  key={item}
                  className="h-14 flex-1 items-center justify-center rounded-md bg-white"
                  onPress={() => {
                    if (betAmount === '0') {
                      setBetAmount(item);
                    } else {
                      setBetAmount((prev) => prev + item);
                    }
                  }}>
                  <StyledGradient
                    colors={['#ffffff', '#d4d4d8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    className="flex h-full w-full items-center justify-center rounded-md">
                    <Text className="text-3xl text-black">{item}</Text>
                  </StyledGradient>
                </TouchableOpacity>
              ))}
            </View>
            {/* Row 4: . 0 CLEAR */}
            <View className="flex-row justify-center gap-1">
              <TouchableOpacity
                className="h-14 flex-1 items-center justify-center rounded-md bg-white"
                onPress={() => {
                  if (!betAmount.includes('.')) {
                    setBetAmount((prev) => prev + '.');
                  }
                }}>
                <StyledGradient
                  colors={['#ffffff', '#d4d4d8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  className="flex h-full w-full items-center justify-center rounded-md">
                  <Text className="text-3xl text-black">.</Text>
                </StyledGradient>
              </TouchableOpacity>
              <TouchableOpacity
                className="h-14 flex-1 items-center justify-center rounded-md bg-white"
                onPress={() => {
                  if (betAmount === '0') {
                    setBetAmount('0');
                  } else {
                    setBetAmount((prev) => prev + '0');
                  }
                }}>
                <StyledGradient
                  colors={['#ffffff', '#d4d4d8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  className="flex h-full w-full items-center justify-center rounded-md">
                  <Text className="text-3xl text-black">0</Text>
                </StyledGradient>
              </TouchableOpacity>
              <TouchableOpacity
                className="h-14 flex-1 items-center justify-center rounded-md bg-white"
                onPress={() => {
                  setBetAmount('0');
                }}>
                <StyledGradient
                  colors={['#ffffff', '#d4d4d8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  className="flex h-full w-full items-center justify-center rounded-md">
                  <Text style={{ fontFamily: "Orbitron-bold"}} className="text-lg tracking-widest text-black">CLEAR</Text>
                </StyledGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Bet Buttons */}
          <View className="mb-3 flex-row flex-wrap items-center justify-center gap-2">
            {[50, 100, 200].map((amount) => (
              <TouchableOpacity
                key={amount}
                className="rounded-full border border-zinc-500 px-4 py-2"
                onPress={() => setBetAmount((prev) => (Number(prev) + amount).toString())}>
                <Text className="text-sm text-white">
                  <MaterialCommunityIcons name="poker-chip" size={14} color="#fbbf24" /> {amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="mb-4 flex-row flex-wrap items-center justify-center gap-2">
            {[500, 1000].map((amount) => (
              <TouchableOpacity
                key={amount}
                className="rounded-full border border-zinc-500 px-4 py-2"
                onPress={() => setBetAmount((prev) => (Number(prev) + amount).toString())}>
                <Text className="text-sm text-white">
                  <MaterialCommunityIcons name="poker-chip" size={14} color="#fbbf24" /> {amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            className="mb-4 w-full rounded-md bg-blue-500 p-[2px]">
            <StyledGradient
              colors={['#1e40af', '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              className="flex w-full items-center justify-center rounded-md py-3">
              <Text style={{ fontFamily: "Orbitron-bold"}} className="text-center text-3xl tracking-widest text-white">SUBMIT</Text>
            </StyledGradient>
          </TouchableOpacity>
        </StyledGradient>
      </View>
    </View>
  );
};
