import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { market } from '@/lib/theme';

// Barra inferior do modelo: cinco abas. Ofertas fica dentro de "Novidades".
export default function TabsLayout() {
  const { tokens } = useAppTheme();
  const styles = useMemo(() => StyleSheet.create({
    bar: {
      backgroundColor: '#ffffff',
      borderTopColor: '#dddddd',
      borderTopWidth: 1,
      height: 62,
      paddingTop: 4,
    },
    label: { fontSize: 11, marginBottom: 4 },
    scene: { backgroundColor: market.page },
  }), []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: readableColor(tokens.link, '#ffffff'),
        tabBarInactiveTintColor: '#777777',
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
        sceneStyle: styles.scene,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <AppIcon name="home" color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="catalogo"
        options={{
          title: 'Catálogo',
          tabBarIcon: ({ color, size }) => <AppIcon name="grid" color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="segmentos"
        options={{
          title: 'Segmentos',
          tabBarIcon: ({ color, size }) => <AppIcon name="store" color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="novidades"
        options={{
          title: 'Novidades',
          tabBarIcon: ({ color, size }) => <AppIcon name="sparkles" color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="marcas"
        options={{
          title: 'Marcas',
          tabBarIcon: ({ color, size }) => <AppIcon name="pricetag" color={color} size={size - 2} />,
        }}
      />
      {/* Continua acessível pelos links internos, fora da barra. */}
      <Tabs.Screen name="ofertas" options={{ href: null, title: 'Ofertas' }} />
    </Tabs>
  );
}
