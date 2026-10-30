import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { useAppTheme } from '@/lib/theme-provider';

export default function TabsLayout() {
  const { tokens } = useAppTheme();
  const styles = useMemo(() => StyleSheet.create({
    bar: {
      backgroundColor: tokens.paper,
      borderTopColor: tokens.border,
      borderTopWidth: 1,
      height: 64,
      paddingTop: 2,
    },
    icon: { marginTop: 4 },
    label: { fontSize: 11, marginBottom: 4, fontWeight: '600' },
  }), [tokens]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: tokens.link,
        tabBarInactiveTintColor: tokens.muted,
        tabBarShowLabel: true,
        tabBarIconStyle: styles.icon,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size, focused }) => (
            <AppIcon name="home" color={color} size={size} fill={focused ? color : 'none'} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalogo"
        options={{
          title: 'Catálogo',
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="grid" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="segmentos"
        options={{
          title: 'Segmentos',
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="store" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ofertas"
        options={{
          title: 'Ofertas',
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="percent" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="novidades"
        options={{
          title: 'Novidades',
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="cube" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="marcas"
        options={{
          title: 'Marcas',
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="pricetag" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
