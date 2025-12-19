import React, { createContext, useContext } from 'react';
import { Text, TextProps } from 'react-native';

const FontContext = createContext({ fontFamily: 'Orbitron' });

export const useFont = () => useContext(FontContext);

export function AppText(props: TextProps) {
  const { fontFamily } = useFont();
  return <Text {...props} style={[{ fontFamily }, props.style]}>{props.children}</Text>;
}

export function FontProvider({ children }: { children: React.ReactNode }) {
  return (
    <FontContext.Provider value={{ fontFamily: 'Orbitron-medium' }}>
      {children}
    </FontContext.Provider>
  );
}