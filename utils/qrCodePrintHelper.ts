/**
 * QR Code Print Helper for Thermal Printers
 * 
 * This file demonstrates how to generate QR codes as base64 images
 * and print them using the thermal printer library.
 * 
 * Usage Example in your components:
 * 
 * import { printQRCodeImage } from './utils/qrCodePrintHelper';
 * 
 * const qrData = `fight_id=${fightId},bet_id=${betId},...`;
 * await printQRCodeImage(qrData, 200); // 200px size
 */

import QRCode from 'react-native-qrcode-svg';
import { BLEPrinter } from '@haroldtran/react-native-thermal-printer';

/**
 * Generate QR Code as Base64 string
 * @param data - The data to encode in QR code
 * @param size - Size of QR code (default: 200)
 * @returns Promise<string> - Base64 encoded QR code image
 */
export const generateQRCodeBase64 = (data: string, size: number = 200): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a reference to store the base64 data
      let qrBase64 = '';

      // Use the getBase64 callback from QRCode component
      // You would need to render this component off-screen and get the base64
      // This is a placeholder - actual implementation would use react-native-view-shot
      // or similar library to capture the QR code as image
      
      // For now, return a placeholder
      // TODO: Implement actual QR code to base64 conversion
      resolve('PLACEHOLDER_BASE64_QR_CODE');
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Print QR Code Image to Thermal Printer
 * @param qrData - The data to encode in QR code
 * @param size - Size of QR code (default: 200)
 */
export const printQRCodeImage = async (qrData: string, size: number = 200) => {
  try {
    // Generate QR code as base64
    const qrBase64 = await generateQRCodeBase64(qrData, size);

    // Print using BLEPrinter
    await BLEPrinter.printImageBase64(qrBase64, {
      imageWidth: size,
      // Additional options if supported by the library
    });

    console.log('QR Code printed successfully');
  } catch (error) {
    console.error('Error printing QR code:', error);
    throw error;
  }
};

/**
 * Alternative: Print QR Code using react-native-view-shot
 * 
 * Install: npm install react-native-view-shot
 * 
 * import ViewShot from 'react-native-view-shot';
 * 
 * Example component:
 * 
 * const QRCodeCapture = ({ data, onCapture }) => {
 *   const viewShotRef = useRef();
 * 
 *   useEffect(() => {
 *     const captureQR = async () => {
 *       try {
 *         const uri = await viewShotRef.current.capture();
 *         const base64 = await RNFS.readFile(uri, 'base64');
 *         onCapture(base64);
 *       } catch (error) {
 *         console.error('Capture error:', error);
 *       }
 *     };
 *     captureQR();
 *   }, [data]);
 * 
 *   return (
 *     <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
 *       <QRCode value={data} size={200} />
 *     </ViewShot>
 *   );
 * };
 */

/**
 * Print Complete Receipt with QR Code Image
 */
export const printReceiptWithQRImage = async (
  title: string,
  lines: string[],
  qrData: string,
  qrSize: number = 200
) => {
  const { COMMANDS } = require('@haroldtran/react-native-thermal-printer');

  try {
    // Print header
    let headerText = '';
    headerText += COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
    headerText += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
    headerText += COMMANDS.TEXT_FORMAT.TXT_2HEIGHT;
    headerText += title + '\n';
    headerText += COMMANDS.TEXT_FORMAT.TXT_NORMAL;
    headerText += COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
    headerText += COMMANDS.HORIZONTAL_LINE.HR_58MM + '\n';

    await BLEPrinter.printText(headerText);

    // Print content
    await BLEPrinter.printText(COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT);
    for (const line of lines) {
      await BLEPrinter.printText(line + '\n');
    }

    // Print QR code image
    await BLEPrinter.printText('\n' + COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT);
    await printQRCodeImage(qrData, qrSize);

    // Print footer
    let footerText = '';
    footerText += '\n' + COMMANDS.HORIZONTAL_LINE.HR_58MM + '\n';
    footerText += COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
    footerText += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
    footerText += 'THANK YOU!\n';
    footerText += COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
    footerText += '\n\n\n';
    footerText += COMMANDS.PAPER.PAPER_FULL_CUT;

    await BLEPrinter.printText(footerText);

    return true;
  } catch (error) {
    console.error('Error printing receipt with QR:', error);
    throw error;
  }
};

export default {
  generateQRCodeBase64,
  printQRCodeImage,
  printReceiptWithQRImage,
};
