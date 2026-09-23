import { Tabs } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
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
            <AppIcon name="home" color={color} size={size} fill={focused ? color : 'none'} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalogo"
        options={{
          title: 'Catálogo',
          tabBarIcon: ({ color, size, focused }) => (
            <AppIcon name="grid" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="segmentos"
        options={{
          title: 'Segmentos',
          tabBarIcon: ({ color, size }) => <AppIcon name="store" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ofertas"
        options={{
          title: 'Ofertas',
          tabBarIcon: ({ color, size, focused }) => (
            <AppIcon name="percent" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="novidades"
        options={{
          title: 'Novidades',
          tabBarIcon: ({ color, size, focused }) => (
            <AppIcon name="cube" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="marcas"
        options={{
          title: 'Marcas',
          tabBarIcon: ({ color, size, focused }) => (
            <AppIcon name="pricetag" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
