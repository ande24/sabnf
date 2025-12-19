import { Timestamp } from "firebase/firestore";
import { TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import {AppText as Text} from "components/FontProvider";

type BetType = {
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
};

const Receipt = ({ bet, onPrint, onClose }: { bet: BetType; onPrint: () => void; onClose: () => void }) => {
    function formatNumber (number: number): string {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }   

    return (
      <View className="flex-1 items-center justify-center bg-black/90 px-4">
        <View className="w-full max-w-md rounded-2xl bg-zinc-900 border-2 border-zinc-700 p-4 shadow-2xl" style={{ maxHeight: '85%' }}>
          <Text style={{ fontFamily: 'Orbitron-bold', fontSize: 20, textAlign: 'center', marginBottom: 8 }} className="text-yellow-400">BET SUMMARY</Text>
          
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text style={{ textAlign: 'center', marginBottom: 12, fontFamily: 'Orbitron-bold', fontSize: 11, color: '#52525b' }}>{bet.formattedDate} {bet.formattedTime}</Text>
            <Text style={{ marginBottom: 3, fontSize: 11, color: '#18181b' }}>Teller: {bet.teller}</Text>
            <Text style={{ marginBottom: 3, fontSize: 10, color: '#52525b' }}>Bet ID: {bet.id}</Text>
            <Text style={{ marginBottom: 3, fontSize: 10, color: '#52525b' }}>Fight ID: {bet.fight_id}</Text>
            <Text style={{ marginBottom: 3, fontSize: 11, color: '#18181b', fontFamily: 'Orbitron-bold' }}>Fight #: {bet.fight_number}</Text>
            <Text style={{ marginBottom: 3, fontSize: 11, color: '#18181b', fontFamily: 'Orbitron-bold' }}>Side: {bet.side}</Text>
            <Text style={{ marginBottom: 3, fontSize: 14, color: '#18181b', fontFamily: 'Orbitron-bold' }}>Amount: ₱{formatNumber(bet.amount)}</Text>
            
            <View style={{ alignItems: 'center', marginVertical: 12 }}>
              <QRCode value={`fight_id=${bet.fight_id},bet_id=${bet.id},teller=${bet.teller},timestamp=${bet.timestamp.toDate().toISOString()},fight_collection=${bet.fight_collection}`} size={160} />
            </View>
          </View>
          
          <TouchableOpacity onPress={() => onPrint()} className="bg-blue-600 rounded-lg py-3 mb-2">
            <Text style={{ color: 'white', textAlign: 'center', fontFamily: 'Orbitron-bold', fontSize: 16 }}>PRINT RECEIPT</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onClose()} className="bg-red-600 rounded-lg py-3">
            <Text style={{ color: 'white', textAlign: 'center', fontFamily: 'Orbitron-bold', fontSize: 16 }}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
};

export default Receipt;