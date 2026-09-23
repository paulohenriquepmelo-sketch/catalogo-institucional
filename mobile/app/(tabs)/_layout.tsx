import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { TabOrnament } from '@/components/ThemeDecor';
import { useThemeColors } from '@/lib/app-theme';

export default function TabsLayout() {
  const colors = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Troca de aba com um esmaecer curto, em vez de um corte seco.
        animation: 'fade',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarIconStyle: { marginTop: 4 },
        tabBarLabelStyle: { fontSize: 11, marginBottom: 4, fontWeight: '600' },
        tabBarStyle: {
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size, focused }) => (
            <View>
              <AppIcon name="home" color={color} size={size} fill={focused ? color : 'none'} />
              <TabOrnament />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="catalogo"
        options={{
          title: 'Catálogo',
          tabBarIcon: ({ color, size, focused }) => (
            <View>
              <AppIcon name="grid" color={color} size={size} />
              <TabOrnament />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="segmentos"
        options={{
          title: 'Segmentos',
          tabBarIcon: ({ color, size }) => (
            <View>
              <AppIcon name="store" color={color} size={size} />
              <TabOrnament />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="ofertas"
        options={{
          title: 'Ofertas',
          tabBarIcon: ({ color, size, focused }) => (
            <View>
              <AppIcon name="percent" color={color} size={size} />
              <TabOrnament />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="novidades"
        options={{
          title: 'Novidades',
          tabBarIcon: ({ color, size, focused }) => (
            <View>
              <AppIcon name="cube" color={color} size={size} />
              <TabOrnament />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="marcas"
        options={{
          title: 'Marcas',
          tabBarIcon: ({ color, size, focused }) => (
            <View>
              <AppIcon name="pricetag" color={color} size={size} />
              <TabOrnament />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
