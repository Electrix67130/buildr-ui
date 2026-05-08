import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { FontWeight } from '@/constants/Layout';

const casqueLogo = require('@/assets/images/casque-logo.png');

interface Props {
  size?: number;
  color?: string;
  showText?: boolean;
}

const BuildrLogo: React.FC<Props> = ({ size = 64, color = '#D97706', showText = true }) => {
  return (
    <View style={styles.container}>
      <Image
        source={casqueLogo}
        style={{ width: size, height: size * 0.6 }}
        resizeMode="contain"
      />
      {showText && (
        <Text style={[styles.text, { color }]}>buildr</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  text: { fontSize: 32, fontWeight: FontWeight.bold, marginTop: 4, letterSpacing: 2 },
});

export default React.memo(BuildrLogo);
