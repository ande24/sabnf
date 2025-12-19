import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, FlatList, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { getAuth, User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import firebase_app from 'firebase/config';
import { AppText as Text } from 'components/FontProvider';

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
  meron_odds: number;
  wala_odds: number;
  outcome: string;
  status: string;
  timestamp: Timestamp;
};

export type BetType = {
  id: string;
  amount: number;
  fight_number: number;
  side: string;
  timestamp: Timestamp;
  fight_collection: string;
  fight_id: string;
  odds: number;
  set_number: number;
  formattedDate: string;
  formattedTime: string;
  outcome: string;
  teller: string;
  teller_id: string;
};



const db = getFirestore(firebase_app);

export const BetSummaryDaily = ({
  filterFight,
  selectedFight,
  filterTime,
  filterStatus,
  filterSide,
  onPrint,
  onBetPress
}: {
  filterFight: string;
  selectedFight: string;
  filterTime: string;
  filterStatus: string;
  filterSide: string;
  onPrint: (payload: {
    title?: string;
    lines: string[];
    qrcode?: string;
  }) => Promise<void>;
  onBetPress?: (bet: BetType) => void;
}) => {
  const { height: screenHeight } = Dimensions.get('window');
  const itemHeight = screenHeight * 0.26;

  const [user, setUser] = useState<User | null>(null);

  const [bets, setBets] = useState<BetType[]>([]);
  const [allBets, setAllBets] = useState<BetType[]>([]);

  const [adminConfig, setAdminConfig] = useState<AdminConfigType | null>(null);
  const [fights, setFights] = useState<FightDataType[]>([]);

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
    const collectionName1 = `fights_${year}_${month}`;
    const collectionName2 = `fights_${Number(month) > 1 ? year : String(Number(year) - 1)}_${Number(month) > 1 ? String(Number(month) - 1).padStart(2, '0') : 12}`;
    const fightsRef1 = collection(db, collectionName1);
    const q1 = query(fightsRef1, where('set_number', '==', adminConfig.current_set));

    const unsubscribe1 = onSnapshot(q1, (querySnapshot) => {
      if (!querySnapshot.empty) {
        setFights(
          querySnapshot.docs
            .map(
              (doc) =>
                ({
                  id: doc.id,
                  ...doc.data(),
                }) as FightDataType
            )
            .sort((a, b) => b.fight_number - a.fight_number)
        );
      }
    });

    const fightsRef2 = collection(db, collectionName2);
    const q2 = query(fightsRef2, where('set_number', '==', adminConfig.current_set));

    const unsubscribe2 = onSnapshot(q2, (querySnapshot) => {
      if (!querySnapshot.empty) {
        setFights((prev) =>
          prev
            .concat(
              querySnapshot.docs.map(
                (doc) =>
                  ({
                    id: doc.id,
                    ...doc.data(),
                  }) as FightDataType
              )
            )
            .sort((a, b) => b.fight_number - a.fight_number)
        );
      }
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [adminConfig]);

  useEffect(() => {
    if (!adminConfig || !user || !fights) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const collectionName1 = `bets_${year}_${month}`;
    const collectionName2 = `bets_${Number(month) > 1 ? year : String(Number(year) - 1)}_${Number(month) > 1 ? String(Number(month) - 1).padStart(2, '0') : 12}`;

    const betsRef1 = collection(db, 'tellers', user.uid, collectionName1);
    const betsRef2 = collection(db, 'tellers', user.uid, collectionName2);
    const q1 = query(betsRef1, where('set_number', '==', adminConfig.current_set));
    const q2 = query(betsRef2, where('set_number', '==', adminConfig.current_set));

    let allFetchedBets: BetType[] = [];
    let listenersReady = { first: false, second: false };

    const processAndSetBets = () => {
      const deduped: { [id: string]: BetType } = {};
      for (const bet of allFetchedBets) {
        if (!bet.id) continue;
        const fight = fights.find((f) => f.id === bet.fight_id);
        let outcome = '';
        let odds = 0;
        if (fight) {
          outcome = fight.outcome;
          odds = bet.side === 'MERON' ? fight.meron_odds : fight.wala_odds;
        }
        deduped[bet.id] = {
          ...bet,
          outcome,
          odds,
        };
      }
      setAllBets(Object.values(deduped).sort((a, b) => b.fight_number - a.fight_number));
    };

    const unsubscribe1 = onSnapshot(q1, async (querySnapshot) => {
      if (!querySnapshot.empty) {
        const bets = await Promise.all(
          querySnapshot.docs.map(async (docSnap) => {
            const bet = docSnap.data() as BetType;
            let dateObj: Date;
            if (bet.timestamp && typeof bet.timestamp === 'object' && '_seconds' in bet.timestamp) {
              dateObj = new Date(bet.timestamp.seconds * 1000);
            } else {
              dateObj = (bet.timestamp as Timestamp).toDate();
            }
            if (bet.id) {
              return {
                ...bet,
                formattedDate: dateObj.toLocaleDateString('en-PH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'Asia/Manila',
                }),
                formattedTime: dateObj.toLocaleTimeString('en-PH', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                  timeZone: 'Asia/Manila',
                }),
              };
            }
            return undefined;
          })
        );
        allFetchedBets = allFetchedBets
          .filter((b) => b.fight_collection !== collectionName1)
          .concat(bets.filter(Boolean) as BetType[]);
      } else {
        allFetchedBets = allFetchedBets.filter((b) => b.fight_collection !== collectionName1);
      }
      listenersReady.first = true;
      if (listenersReady.first && listenersReady.second) processAndSetBets();
    });

    const unsubscribe2 = onSnapshot(q2, async (querySnapshot) => {
      if (!querySnapshot.empty) {
        const bets = await Promise.all(
          querySnapshot.docs.map(async (docSnap) => {
            const bet = docSnap.data() as BetType;
            let dateObj: Date;
            if (bet.timestamp && typeof bet.timestamp === 'object' && '_seconds' in bet.timestamp) {
              dateObj = new Date(bet.timestamp.seconds * 1000);
            } else {
              dateObj = (bet.timestamp as Timestamp).toDate();
            }
            if (bet.id) {
              return {
                ...bet,
                formattedDate: dateObj.toLocaleDateString('en-PH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'Asia/Manila',
                }),
                formattedTime: dateObj.toLocaleTimeString('en-PH', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                  timeZone: 'Asia/Manila',
                }),
              };
            }
            return undefined;
          })
        );
        allFetchedBets = allFetchedBets
          .filter((b) => b.fight_collection !== collectionName2)
          .concat(bets.filter(Boolean) as BetType[]);
      } else {
        allFetchedBets = allFetchedBets.filter((b) => b.fight_collection !== collectionName2);
      }
      listenersReady.second = true;
      if (listenersReady.first && listenersReady.second) processAndSetBets();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [adminConfig, user, fights, filterFight, selectedFight, filterTime, filterStatus, filterSide]);

  useEffect(() => {
    if (!allBets || allBets.length === 0) {
      setBets([]);
      return;
    }

    let betList = [...allBets];

    if (filterTime === 'desc') {
      betList.sort((a, b) => {
        const aTime =
          a.timestamp && typeof (a.timestamp as any).toDate === 'function'
            ? (a.timestamp as any).toDate().getTime()
            : new Date(a.timestamp as any).getTime();
        const bTime =
          b.timestamp && typeof (b.timestamp as any).toDate === 'function'
            ? (b.timestamp as any).toDate().getTime()
            : new Date(b.timestamp as any).getTime();
        return bTime - aTime;
      });
    } else {
      betList.sort((a, b) => {
        const aTime =
          a.timestamp && typeof (a.timestamp as any).toDate === 'function'
            ? (a.timestamp as any).toDate().getTime()
            : new Date(a.timestamp as any).getTime();
        const bTime =
          b.timestamp && typeof (b.timestamp as any).toDate === 'function'
            ? (b.timestamp as any).toDate().getTime()
            : new Date(b.timestamp as any).getTime();
        return aTime - bTime;
      });
    }

    if (filterFight === 'select') {
      betList = betList.filter((bet) => String(bet.fight_number) === selectedFight);
    }

    if (filterSide !== 'all') {
      betList = betList.filter((bet) => bet.side === filterSide.toUpperCase());
    }

    if (filterStatus !== 'all') {
      betList = betList.filter(
        (bet) =>
          (filterStatus === 'pending' && bet.outcome === 'PENDING') ||
          (filterStatus === 'completed' && bet.outcome.toUpperCase() !== 'PENDING')
      );
    }

    console.log('All bets:', allBets);
    console.log('Filtered bets:', betList);

    setBets(betList);
  }, [filterFight, selectedFight, filterTime, filterStatus, filterSide, allBets]);

  const formatNumber = (number: number): string => {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const BetItem = React.memo(({ bet }: any) => (
    <View style={{ height: itemHeight }}>
      <TouchableOpacity onPress={() => { onBetPress?.(bet); }} style={styles.betContainer}>
        <View style={styles.idContainer}>
          <Text style={styles.idText}>{bet.id}</Text>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>FIGHT NUMBER</Text>
              <Text style={styles.label}>:</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.value}>{bet.fight_number}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>SIDE</Text>
              <Text style={styles.label}>:</Text>
            </View>
            <View style={styles.valueContainer}>
              <View
                style={[
                  styles.colorContainer,
                  bet.side === 'MERON' ? styles.colorMeron : styles.colorWala,
                ]}>
                <Text style={styles.value}>{bet.side}</Text>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>AMOUNT</Text>
              <Text style={styles.label}>:</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.value}>₱ {formatNumber(bet.amount)}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>OUTCOME</Text>
              <Text style={styles.label}>:</Text>
            </View>
            <View style={styles.valueContainer}>
              <View
                style={[
                  styles.colorContainer,
                  bet.outcome === 'PENDING'
                    ? styles.colorPending
                    : bet.outcome === 'WALA'
                      ? styles.colorWala
                      : bet.outcome === 'MERON'
                        ? styles.colorMeron
                        : bet.outcome === 'CANCELLED'
                          ? styles.colorCancelled
                          : styles.colorDraw,
                ]}>
                <Text style={styles.value}>{bet.outcome}</Text>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>ODDS</Text>
              <Text style={styles.label}>:</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.value}>{bet.odds !== undefined ? bet.odds.toFixed(2) : ''}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footer}>
            {bet.formattedDate}
            {'\n'}
            {bet.formattedTime}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  ));

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <FlatList
          ItemSeparatorComponent={() => (
            <Text style={styles.divider}>────────────────────────────────</Text>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No bets to display</Text>
            </View>
          }
          style={{ flex: 1 }}
          data={bets}
          keyExtractor={(item) => item.id}
          renderItem={({ item: bet }) => <BetItem bet={bet} />}
          initialNumToRender={10}
          showsVerticalScrollIndicator={true}
          maxToRenderPerBatch={10}
          nestedScrollEnabled={true}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  betContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  idContainer: {
    borderWidth: 1,
    borderColor: '#52525b',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  idText: {
    fontSize: 13,
    fontFamily: 'Orbitron-medium',
    color: 'white',
  },
  detailsContainer: {
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'column',
    justifyContent: 'space-between',
    flex: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  labelContainer: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 16,
    letterSpacing: 1.5,
    color: '#52525b',
  },
  valueContainer: {
    paddingLeft: 12,
  },
  colorContainer: {
    borderRadius: 4,
    padding: 4,
    alignSelf: 'flex-start',
  },
  colorMeron: {
    backgroundColor: '#dc2626',
  },
  colorWala: {
    backgroundColor: '#2563eb',
  },
  colorPending: {
    backgroundColor: '#ca8a04',
  },
  colorCancelled: {
    backgroundColor: '#000000',
  },
  colorDraw: {
    backgroundColor: '#facc15',
  },
  value: {
    fontSize: 15,
    letterSpacing: 1.5,
    color: 'white',
  },
  footerContainer: {
    flex: 2,
  },
  footer: {
    fontSize: 18,
    letterSpacing: 1.5,
    color: '#52525b',
    textAlign: 'center',
  },
  divider: {
    color: '#52525b',
    fontSize: 16,
    marginBottom: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
