import { LinearGradient } from 'expo-linear-gradient';
import firebase_app from 'firebase/config';
import { collection, doc, getFirestore, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { cssInterop } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from 'components/FontProvider';

const StyledGradient = cssInterop(LinearGradient, {
  className: 'style',
});

type FightDisplayProps = {
  onPressMeron: () => void;
  onPressWala: () => void;
  onPressDraw: () => void;
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
}

const db = getFirestore(firebase_app);

export const FightDisplay = ({
  onPressMeron,
  onPressWala,
  onPressDraw,
}: FightDisplayProps) => {
  
  const [adminConfig, setAdminConfig] = useState<AdminConfigType | null>(null);
  const [fightData, setFightData] = useState<FightDataType | null>(null);

  useEffect(() => {
    const configRef = doc(db, "admin", "config");
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
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, "0");

    const collectionName = `fights_${year}_${month}`;
    const prevCollectionName = `fights_${prevYear}_${prevMonth}`;

    let unsubCurrent: (() => void) | null = null;
    let unsubPrev: (() => void) | null = null;

    const fetchFight = (colName: string, onFound: (fight: FightDataType, id: string, col: string) => void, onNotFound: () => void) => {
      const fightsRef = collection(db, colName);
      const q = query(
        fightsRef,
        where("fight_number", "==", adminConfig.current_fight),
        where("set_number", "==", adminConfig.current_set)
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

    unsubCurrent = fetchFight(collectionName, (fight, id) => {
      setFightData({ ...fight, id, collection: collectionName });
      if (unsubPrev) {
        unsubPrev();
        unsubPrev = null;
      }
    }, () => {
      unsubPrev = fetchFight(prevCollectionName, (fight, id) => {
        setFightData({ ...fight, id, collection: prevCollectionName });
      }, () => {
        setFightData(null);
      });
    });

    return () => {
      if (unsubCurrent) unsubCurrent();
      if (unsubPrev) unsubPrev();
    };
  }, [adminConfig]);



  const updateFightData = React.useCallback(
    async (updates: Array<[string, string | number]>): Promise<void> => {
      const collectionName = fightData?.collection || "";
      const fightsRef = collection(db, collectionName);

      const docRef = doc(fightsRef, fightData?.id);
      const updateObj: Record<string, string | number> = {};
      updates.forEach(([field, value]) => {
        updateObj[field] = value;
      });
      await updateDoc(docRef, updateObj);
    },
    [fightData]
  );



  useEffect(() => {
    if (!fightData || !adminConfig) return;

    const calculateOdds = () => {
      // Calculate ONLY MERON and WALA odds
      // DRAW odds and multiplier should be set manually from WEB admin
      
      const meronOdds = fightData.meron_total > 0 ? (1 + (1 - adminConfig.commission_pct)) : 0;
      const walaOdds = fightData.wala_total > 0 ? (1 + (1 - adminConfig.commission_pct)) : 0;
      
      // Calculate total commission collected
      const meronCommission = fightData.meron_total * adminConfig.commission_pct;
      const walaCommission = fightData.wala_total * adminConfig.commission_pct;
      const drawCommission = (fightData.draw_total || 0) * adminConfig.commission_pct;
      const totalCommission = meronCommission + walaCommission + drawCommission;

      // ONLY update MERON and WALA odds, NOT draw_odds or draw_multiplier
      updateFightData([
        ["meron_odds", meronOdds],
        ["wala_odds", walaOdds],
        ["commission", totalCommission],
      ]);
    }

    calculateOdds();
  }, [fightData, adminConfig, updateFightData]);



  const formatNumber = (number: number): string => {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };



  if (!fightData || !adminConfig) {
    return null;
  }
  
  return (
    <View className={styles.container}>
      {/* Border wrapper for all 3 cards */}
      <View className="w-full border-2 border-zinc-700 rounded-2xl p-3 bg-zinc-800/50">
        <View className="w-full flex-row items-end justify-center gap-x-1">
          {/* MERON Card - Larger */}
          <TouchableOpacity
            onPress={() => {
              onPressMeron();
            }}
            disabled={!adminConfig.meron_open}
            className="flex-[3] rounded-xl overflow-hidden shadow-lg"
            style={{ height: 140 }}>
            <StyledGradient
              colors={adminConfig.meron_open ? ['#b91c1c', '#ef4444'] : ['#52525b', '#71717a']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              className="h-full items-center justify-between p-3">
              <Text style={{ fontFamily: 'Orbitron-bold'}} className="text-lg tracking-widest text-white">MERON</Text>
              
              <View className="flex-col items-center justify-center">
                <Text style={{ fontFamily: 'Orbitron-medium'}} className="text-[10px] tracking-wide text-white/80">ODDS</Text>
                <Text style={{ fontFamily: 'Orbitron-bold'}} className="text-xl tracking-widest text-yellow-400">{fightData.meron_odds.toFixed(2)}</Text>
              </View>

              <View className="items-center justify-center rounded-md bg-black/40 px-2 py-1 w-full">
                <Text style={{ fontFamily: 'Orbitron-bold'}} className="text-[10px] tracking-wide text-white">
                  {fightData.meron_total > 0 ? formatNumber(fightData.meron_total) : '0'}
                </Text>
              </View>
            </StyledGradient>
          </TouchableOpacity>

          {/* DRAW Card (Center) - Smaller with HEXAGONAL fight number at top */}
          <View className="flex-[2] items-center" style={{ marginBottom: -10 }}>
            {/* Fight Number Badge at Top */}
            <View className="items-center justify-center z-20 mb-[-20px]">
              <View className="items-center justify-center relative">
                <Image
                  source={require('../assets/images/hexagon.png')}
                  resizeMode="contain"
                  style={{ width: 55, height: 55 }}
                />
                <View className="absolute inset-0 items-center justify-center">
                  <Text style={{ fontFamily: 'Orbitron-bold'}} className="text-[8px] text-red-700 mt-1">FIGHT</Text>
                  <Text style={{ fontFamily: 'Orbitron-bold'}} className="text-lg text-red-700 -mt-1">
                    {adminConfig.current_fight}
                  </Text>
                </View>
              </View>
            </View>
            
            <TouchableOpacity
              onPress={() => {
                onPressDraw();
              }}
              className="w-full rounded-xl overflow-hidden shadow-lg"
              style={{ height: 110 }}>
              <StyledGradient
                colors={fightData.status === 'OPEN' ? ['#15803d', '#22c55e'] : ['#52525b', '#71717a']}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                className="h-full items-center justify-between py-2 px-2">
                
                <Text style={{ fontFamily: 'Orbitron-bold'}} className="text-sm tracking-widest text-white mt-2">DRAW</Text>
                
                <View className="flex-col items-center justify-center">
                  <Text style={{ fontFamily: 'Orbitron-medium'}} className="text-[9px] tracking-wide text-white/80">ODDS</Text>
                  <Text style={{ fontFamily: 'Orbitron-bold'}} className="text-base tracking-widest text-yellow-400">{(fightData.draw_odds || 8.00).toFixed(2)}</Text>
                </View>

                <View className="items-center justify-center rounded-md bg-black/40 px-2 py-1 w-full">
                  <Text style={{ fontFamily: 'Orbitron-bold'}} className="text-[9px] tracking-wide text-white">
                    {(fightData.draw_total || 0) > 0 ? formatNumber(fightData.draw_total || 0) : '0'}
                  </Text>
                </View>
              </StyledGradient>
            </TouchableOpacity>
          </View>

          {/* WALA Card - Larger */}
          <TouchableOpacity
            className="flex-[3] rounded-xl overflow-hidden shadow-lg"
            onPress={() => {
              onPressWala();
            }}
            disabled={!adminConfig.wala_open}
            style={{ height: 140 }}>
            <StyledGradient
              colors={adminConfig.wala_open ? ['#1d4ed8', '#3b82f6'] : ['#52525b', '#71717a']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              className="h-full items-center justify-between p-3">
              <Text style={{ fontFamily: 'Orbitron-bold'}} className="text-lg tracking-widest text-white">WALA</Text>
              
              <View className="flex-col items-center justify-center">
                <Text style={{ fontFamily: 'Orbitron-medium'}} className="text-[10px] tracking-wide text-white/80">ODDS</Text>
                <Text style={{ fontFamily: 'Orbitron-bold'}} className="text-xl tracking-widest text-yellow-400">{fightData.wala_odds.toFixed(2)}</Text>
              </View>

              <View className="items-center justify-center rounded-md bg-black/40 px-2 py-1 w-full">
                <Text style={{ fontFamily: 'Orbitron-bold'}} className="text-[10px] tracking-wide text-white">
                  {fightData.wala_total > 0 ? formatNumber(fightData.wala_total) : '0'}
                </Text>
              </View>
            </StyledGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = {
  container: `items-center flex-1 justify-center`,
  separator: `h-[1px] my-1 bg-white w-1/2`,
};
