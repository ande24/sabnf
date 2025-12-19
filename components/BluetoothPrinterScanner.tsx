import { useState, useEffect } from 'react';
import { View, TouchableOpacity, FlatList, Alert, PermissionsAndroid, Platform } from 'react-native';
import { AppText as Text } from './FontProvider';
import { Ionicons } from '@expo/vector-icons';
import { BLEPrinter } from '@haroldtran/react-native-thermal-printer';

interface BluetoothDevice {
  inner_mac_address: string;
  device_name?: string;
}

interface BluetoothPrinterScannerProps {
  onDeviceSelect: (device: BluetoothDevice) => void;
  onClose: () => void;
}

export const BluetoothPrinterScanner = ({ onDeviceSelect, onClose }: BluetoothPrinterScannerProps) => {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);

  useEffect(() => {
    requestBluetoothPermission();
  }, []);

  const requestBluetoothPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(granted).every(
          (permission) => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        if (allGranted) {
          console.log('All Bluetooth permissions granted');
        } else {
          Alert.alert(
            'Permissions Required',
            'Bluetooth and Location permissions are required to scan for printers.'
          );
        }
      } catch (err) {
        console.warn('Permission request error:', err);
      }
    }
  };

  const startScan = async () => {
    try {
      setIsScanning(true);
      setDevices([]);
      
      // Initialize BLE Printer
      await BLEPrinter.init();
      
      // Get list of available BLE devices
      const deviceList = await BLEPrinter.getDeviceList();
      
      console.log('Found devices:', deviceList);
      
      if (deviceList && deviceList.length > 0) {
        setDevices(deviceList);
      } else {
        Alert.alert('No Devices Found', 'No Bluetooth thermal printers were found nearby.');
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      Alert.alert('Scan Error', error.message || 'Failed to scan for devices');
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeviceSelect = async (device: BluetoothDevice) => {
    try {
      setSelectedDevice(device);
      
      Alert.alert(
        'Connect to Printer',
        `Do you want to connect to ${device.device_name || device.inner_mac_address}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setSelectedDevice(null),
          },
          {
            text: 'Connect',
            onPress: async () => {
              try {
                // Connect to the printer
                await BLEPrinter.connectPrinter(device.inner_mac_address);
                
                Alert.alert('Success', 'Connected to printer successfully!');
                onDeviceSelect(device);
              } catch (error: any) {
                console.error('Connection error:', error);
                Alert.alert('Connection Failed', error.message || 'Failed to connect to printer');
                setSelectedDevice(null);
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Selection error:', error);
      Alert.alert('Error', error.message || 'Failed to select device');
    }
  };

  return (
    <View className="flex-1 bg-zinc-900 p-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <Text className="text-white text-2xl font-bold">Bluetooth Printers</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={32} color="white" />
        </TouchableOpacity>
      </View>

      {/* Scan Button */}
      <TouchableOpacity
        onPress={startScan}
        disabled={isScanning}
        className={`flex-row items-center justify-center p-4 rounded-lg mb-4 ${
          isScanning ? 'bg-gray-600' : 'bg-blue-600'
        }`}>
        <Ionicons
          name={isScanning ? 'reload' : 'scan'}
          size={24}
          color="white"
          style={{ marginRight: 8 }}
        />
        <Text className="text-white text-lg font-bold">
          {isScanning ? 'Scanning...' : 'Scan for Printers'}
        </Text>
      </TouchableOpacity>

      {/* Instructions */}
      <View className="bg-zinc-800 p-4 rounded-lg mb-4">
        <Text className="text-white text-sm mb-2">📱 Instructions:</Text>
        <Text className="text-gray-300 text-xs mb-1">1. Make sure your thermal printer is turned on</Text>
        <Text className="text-gray-300 text-xs mb-1">2. Enable Bluetooth on your device</Text>
        <Text className="text-gray-300 text-xs mb-1">3. Tap "Scan for Printers" to discover nearby devices</Text>
        <Text className="text-gray-300 text-xs">4. Select your printer from the list</Text>
      </View>

      {/* Device List */}
      <View className="flex-1">
        {devices.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="print-outline" size={80} color="#4B5563" />
            <Text className="text-gray-500 text-center mt-4">
              {isScanning ? 'Searching for printers...' : 'No printers found.\nTap "Scan for Printers" to start.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={devices}
            keyExtractor={(item) => item.inner_mac_address}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleDeviceSelect(item)}
                disabled={isScanning}
                className={`bg-zinc-800 p-4 rounded-lg mb-3 flex-row items-center justify-between ${
                  selectedDevice?.inner_mac_address === item.inner_mac_address ? 'border-2 border-blue-500' : ''
                }`}>
                <View className="flex-1">
                  <Text className="text-white text-lg font-bold mb-1">
                    {item.device_name || 'Unknown Printer'}
                  </Text>
                  <Text className="text-gray-400 text-sm">{item.inner_mac_address}</Text>
                </View>
                <Ionicons name="bluetooth" size={24} color="#3B82F6" />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
};
