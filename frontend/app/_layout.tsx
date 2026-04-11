import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { BackgroundProvider, useBackground } from '../src/BackgroundContext';
import { ThemeProvider, useTheme } from '../src/ThemeContext';
import { initializeAuth } from '../src/supabase';
import { scheduleBirthdayNotifications } from '../src/api';
import * as Notifications from 'expo-notifications';

// Configura come gestire le notifiche quando l'app è aperta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Impedisce allo splash screen di nascondersi automaticamente finché non siamo pronti
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { bgImage } = useBackground();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    // Inizializza l'autenticazione anonima Supabase
    initializeAuth();

    // Programma le notifiche per i compleanni
    scheduleBirthdayNotifications();

    // Nasconde lo splash screen dopo un piccolo ritardo
    const hideSplash = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await SplashScreen.hideAsync();
    };
    hideSplash();
  }, []);

  const backgroundColor = isDarkMode ? '#1C1C1E' : '#F2F2F7';
  const overlayColor = isDarkMode ? 'rgba(28, 28, 30, 0.8)' : 'rgba(242, 242, 247, 0.7)';

  const content = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="group/[groupId]" options={{ headerShown: false }} />
      <Stack.Screen
        name="player/add"
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="player/[id]"
        options={{ headerShown: false, presentation: 'modal' }}
      />
    </Stack>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      {bgImage ? (
        <ImageBackground source={{ uri: bgImage }} style={styles.container} resizeMode="cover">
          <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
            {content}
          </View>
        </ImageBackground>
      ) : (
        content
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <BackgroundProvider>
        <AppContent />
      </BackgroundProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
});
