import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useState } from 'react';
import { Button, StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import { AppText as Text } from 'components/FontProvider';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import firebase_app from 'firebase/config';

export const Scanner = ({ 
  onResult, 
  onPayout, 
  onPrint,
  balance = 0,
  ...props 
}: { 
  onResult?: (result: any) => void; 
  onPayout?: (amount: number, receipt: any) => void;
  onPrint?: (payload: { title?: string; lines: string[]; qrcode?: string }) => Promise<void>;
  balance?: number;
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const db = getFirestore(firebase_app);

  // Helper function to format time as HH:MM:SS AM/PM
  const formatTime = (date: Date): string => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const hoursStr = hours.toString().padStart(2, '0');
    return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const handleScan = async ({ type, data }: BarcodeScanningResult) => {
    setScanned(true);
    console.log('QR scanned:', data);
    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      const params = Object.fromEntries(data.split(',').map((kv) => kv.split('=')));
      const { fight_id, bet_id, teller, timestamp, fight_collection } = params;

      if (!fight_id) throw new Error('Invalid QR: fight_id missing');

      if (!bet_id || !teller) {
        setError('QR code is missing bet_id or teller. Please scan a valid receipt QR.');
        setLoading(false);
        return;
      }

      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');

      console.log(`Using bets collection: bets_${year}_${month}`);
      console.log(`Using fights collection: fights_${year}_${month}`);

      const betsCollection = `bets_${year}_${month}`;
      const fightsCollection = fight_collection;
      console.log('teller:', teller);
      console.log('bet_id:', bet_id);

      const betDocRef = doc(db, 'tellers', teller, betsCollection, bet_id);
      const betSnap = await getDoc(betDocRef);

      if (!betSnap.exists()) {
        console.log('Bet data is undefined or null');
        throw new Error('Bet not found');
      }
      const bet = betSnap.data();
      
      // Fetch teller email from users collection
      let tellerEmail = teller; // fallback to UID
      try {
        const tellerDocRef = doc(db, 'tellers', teller);
        const tellerSnap = await getDoc(tellerDocRef);
        if (tellerSnap.exists()) {
          tellerEmail = tellerSnap.data().email || bet.teller || teller;
        } else {
          // If teller doc doesn't exist, try to get from bet data
          tellerEmail = bet.teller || teller;
        }
      } catch (err) {
        console.error('Error fetching teller email:', err);
        tellerEmail = bet.teller || teller;
      }
      console.log('Bet data:', bet);

      // CHECK IF ALREADY CLAIMED
      if (bet.payout_claimed) {
        setError('⚠️ THIS BET HAS ALREADY BEEN CLAIMED!\n\nPayout was processed on: ' + 
          new Date(bet.payout_claimed_at?.seconds * 1000 || Date.now()).toLocaleString('en-PH'));
        setLoading(false);
        return;
      }

      const fightDocRef = doc(db, fightsCollection, fight_id);
      console.log('Fetching fight data from:', fightDocRef.path);
      const fightSnap = await getDoc(fightDocRef);
      console.log('Fight snapshot:', fightSnap);
      if (!fightSnap.exists()) console.log('Fight not found');
      console.log('Fight data exists, processing...');
      const fight = fightSnap.data();

      console.log('Fight data:', fight);

      const side = bet.side;
      const amount = bet.amount;
      const outcome = fight?.outcome;
      
      // Get odds/multiplier based on side
      let odds = 0;
      if (side === 'MERON') {
        odds = fight?.meron_odds || 0;
      } else if (side === 'WALA') {
        odds = fight?.wala_odds || 0;
      } else if (side === 'DRAW') {
        odds = fight?.draw_multiplier || 0; // Use draw_multiplier for DRAW bets
      }
      
      let payout = 0;
      let result = 'PENDING';
      if (outcome !== 'PENDING') {
        if (side && outcome && side.toUpperCase() === outcome.toUpperCase()) {
          payout = amount * odds;
          result = 'WON';
        } else if (side && outcome && side.toUpperCase() !== outcome.toUpperCase()) {
          result = 'LOST';
        }
      }

      console.log('Receipt:', {
        bet_id,
        fight_id,
        teller,
        side,
        amount,
        outcome,
        odds,
        payout,
        result,
        timestamp: bet.timestamp ? new Date(bet.timestamp.seconds * 1000) : date,
      });

      setReceipt({
        bet_id,
        fight_id,
        teller: tellerEmail,
        side,
        amount,
        outcome,
        odds,
        payout,
        result,
        timestamp: bet.timestamp ? new Date(bet.timestamp.seconds * 1000) : date,
        betDocRef, // Store the reference to mark as claimed later
        betsCollection, // Store collection name
      });
      if (onResult)
        onResult({
          bet_id,
          fight_id,
          teller: tellerEmail,
          side,
          amount,
          outcome,
          odds,
          payout,
          result,
          timestamp: bet.timestamp ? new Date(bet.timestamp.seconds * 1000) : date,
        }); 

      
    } catch (err: any) {
      setError(err.message || 'Error processing QR');
    } finally {
      setLoading(false);
    }
  };

  if (receipt) {
    return (
      <View className="flex-1 items-center justify-center bg-black/80 px-4">
        <View className="w-full max-w-md rounded-2xl bg-zinc-900 border-2 border-zinc-700 p-4">
          <Text style={{ fontFamily: 'Orbitron-bold', fontSize: 20, textAlign: 'center', marginBottom: 8, color: '#fbbf24' }}>PAYOUT RECEIPT</Text>
          
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text style={{ textAlign: 'center', marginBottom: 12, fontFamily: 'Orbitron-bold', fontSize: 11, color: '#52525b' }}>
              {receipt.timestamp.toLocaleDateString('en-PH')} {formatTime(receipt.timestamp)}
            </Text>
            <Text style={{ marginBottom: 3, fontSize: 10, color: '#52525b' }}>Teller: {receipt.teller}</Text>
            <Text style={{ marginBottom: 3, fontSize: 10, color: '#52525b' }}>Bet ID: {receipt.bet_id}</Text>
            <Text style={{ marginBottom: 3, fontSize: 10, color: '#52525b' }}>Fight ID: {receipt.fight_id}</Text>
            <Text style={{ marginBottom: 3, fontSize: 11, color: '#18181b', fontFamily: 'Orbitron-bold' }}>Side: {receipt.side}</Text>
            <Text style={{ marginBottom: 3, fontSize: 11, color: '#18181b', fontFamily: 'Orbitron-bold' }}>Amount: P{receipt.amount.toLocaleString()}</Text>
            <Text style={{ marginBottom: 3, fontSize: 11, color: '#18181b' }}>Outcome: {receipt.outcome}</Text>
            <Text style={{ marginBottom: 3, fontSize: 11, color: '#18181b' }}>
              {receipt.side === 'DRAW' ? 'Multiplier' : 'Odds'}: {receipt.odds.toFixed(2)}{receipt.side === 'DRAW' ? 'x' : ''}
            </Text>
            <Text style={{ marginBottom: 8, fontSize: 14, color: receipt.result === 'WON' ? '#16a34a' : receipt.result === "PENDING" ? '#f59e0b' : '#dc2626', fontFamily: 'Orbitron-bold' }}>
              Result: {receipt.result}
            </Text>
            
            {receipt.result === 'WON' && (
              <View className="bg-green-100 rounded-lg p-3 border-2 border-green-500">
                <Text style={{ fontSize: 16, color: '#16a34a', textAlign: 'center', fontFamily: 'Orbitron-bold' }}>
                  PAYOUT: P{receipt.payout.toLocaleString()}
                </Text>
              </View>
            )}
            
            {receipt.result === 'LOST' && (
              <View className="bg-red-100 rounded-lg p-3 border-2 border-red-500">
                <Text style={{ fontSize: 16, color: '#dc2626', textAlign: 'center', fontFamily: 'Orbitron-bold' }}>
                  BETTER LUCK NEXT TIME!
                </Text>
              </View>
            )}
            
            {receipt.result === 'PENDING' && (
              <View className="bg-yellow-100 rounded-lg p-3 border-2 border-yellow-500">
                <Text style={{ fontSize: 14, color: '#f59e0b', textAlign: 'center', fontFamily: 'Orbitron-bold' }}>
                  FIGHT STILL PENDING
                </Text>
              </View>
            )}
          </View>

          {receipt.result === 'WON' && (
            <TouchableOpacity 
              onPress={async () => {
                // CHECK BALANCE FIRST before doing anything
                if (balance <= 0) {
                  Alert.alert(
                    '💰 No Balance Available',
                    'You currently have no balance to process payouts.\n\nPlease ask the customer to go to another teller with sufficient balance.',
                    [{ text: 'OK' }]
                  );
                  return;
                }

                if (balance < receipt.payout) {
                  Alert.alert(
                    '⚠️ Insufficient Balance',
                    `Cannot process payout!\n\nPayout Amount: ₱${receipt.payout.toLocaleString()}\nYour Balance: ₱${balance.toLocaleString()}\n\nPlease ask the customer to go to another teller with sufficient balance.`,
                    [{ text: 'OK' }]
                  );
                  return;
                }

                try {
                  // Mark bet as claimed FIRST to prevent double payout
                  if (receipt.betDocRef) {
                    await updateDoc(receipt.betDocRef, {
                      payout_claimed: true,
                      payout_claimed_at: Timestamp.now(),
                    });
                  }

                  // Auto-print the payout receipt
                  if (onPrint) {
                    await onPrint({
                      title: 'PAYOUT RECEIPT',
                      lines: [
                        `${receipt.timestamp.toLocaleDateString('en-PH')} ${formatTime(receipt.timestamp)}`,
                        `Teller: ${receipt.teller}`,
                        `Bet ID: ${receipt.bet_id}`,
                        `Fight ID: ${receipt.fight_id}`,
                        `Side: ${receipt.side}`,
                        `Amount: P${receipt.amount.toLocaleString()}`,
                        `Outcome: ${receipt.outcome}`,
                        `${receipt.side === 'DRAW' ? 'Multiplier' : 'Odds'}: ${receipt.odds.toFixed(2)}${receipt.side === 'DRAW' ? 'x' : ''}`,
                        `Result: ${receipt.result}`,
                        `PAYOUT: P${receipt.payout.toLocaleString()}`,
                      ],
                    });
                  }
                  
                  // Process the payout
                  if (onPayout) {
                    onPayout(receipt.payout, receipt);
                  }
                  setReceipt(null); 
                  setScanned(false);
                } catch (error) {
                  Alert.alert('Error', 'Failed to process payout. Please try again.');
                  console.error('Payout error:', error);
                }
              }} 
              className="bg-green-600 rounded-lg py-3 mb-2">
              <Text style={{ color: 'white', textAlign: 'center', fontFamily: 'Orbitron-bold', fontSize: 16 }}>
                PROCESS PAYOUT
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            onPress={() => {setReceipt(null); setScanned(false)}} 
            className="bg-zinc-800 rounded-lg py-3 border border-zinc-700">
            <Text style={{ color: 'white', textAlign: 'center', fontFamily: 'Orbitron-bold', fontSize: 16 }}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-black/80 px-4">
        <View className="w-full max-w-md rounded-2xl bg-zinc-900 border-2 border-red-600 p-4">
          <View className="items-center mb-4">
            <Ionicons name="alert-circle" size={60} color="#dc2626" />
          </View>
          <Text style={{ fontFamily: 'Orbitron-bold', fontSize: 18, textAlign: 'center', marginBottom: 12, color: '#dc2626' }}>
            ERROR
          </Text>
          <Text style={{ fontSize: 14, textAlign: 'center', marginBottom: 20, color: '#ffffff' }}>
            {error}
          </Text>
          <TouchableOpacity 
            onPress={() => {
              setError(null); 
              setScanned(false);
            }} 
            className="bg-zinc-800 rounded-lg py-3 border border-zinc-700">
            <Text style={{ color: 'white', textAlign: 'center', fontFamily: 'Orbitron-bold', fontSize: 16 }}>
              SCAN AGAIN
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View className="absolute bottom-0 left-0 right-0 top-0 z-10 flex items-center justify-center bg-transparent">
        <View className="flex-1 items-center justify-center opacity-30">
          <Ionicons name="scan-outline" size={350} color="white" />
        </View>
      </View>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        style={styles.camera}
        facing="back"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64,
  },
  button: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
});
