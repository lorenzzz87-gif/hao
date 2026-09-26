import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Circle, Map as LeafletMap } from 'leaflet';
import { useTranslation } from 'react-i18next';

import { NearbyPlanList } from '@/components/nearby-plan-list';
import { PlanCard } from '@/components/plan-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useNearbyPlans } from '@/hooks/use-nearby-plans';
import { useLocationStore } from '@/stores/location-store';
import type { NearbyPlan } from '@/types/nearby-plan';

export function PlanMap() {
  const { t } = useTranslation();
  const coordinates = useLocationStore((state) => state.coordinates)!;
  const source = useLocationStore((state) => state.source);
  const areaLabel = useLocationStore((state) => state.areaLabel);
  const plans = useNearbyPlans();
  const containerRef = useRef<View>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Circle[]>([]);
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [selectedPlan, setSelectedPlan] = useState<NearbyPlan | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    void import('leaflet').then((leaflet) => {
      if (disposed || mapRef.current || !containerRef.current) return;
      const map = leaflet.map(containerRef.current as unknown as HTMLElement, { zoomControl: true, attributionControl: false })
        .setView([coordinates.latitude, coordinates.longitude], 13);
      leaflet.control.attribution({ position: 'topright', prefix: false }).addTo(map);
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      if (source === 'device') {
        leaflet.circleMarker([coordinates.latitude, coordinates.longitude], { radius: 8, color: '#FFFFFF', weight: 3, fillColor: '#2777E8', fillOpacity: 1 })
          .bindTooltip(t('mapScreen.youAreHere'))
          .addTo(map);
      } else {
        leaflet.circle([coordinates.latitude, coordinates.longitude], { radius: 700, color: Brand.primary, weight: 2, fillColor: Brand.primary, fillOpacity: 0.1 })
          .bindTooltip(t('mapScreen.browsingArea', { area: areaLabel ?? '' }))
          .addTo(map);
      }
      window.setTimeout(() => map.invalidateSize(), 0);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      disposed = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [areaLabel, coordinates.latitude, coordinates.longitude, source, t]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !plans.data) return;
    let cancelled = false;
    void import('leaflet').then((leaflet) => {
      if (cancelled || !mapRef.current) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = plans.data.map((plan) => {
        const marker = leaflet.circle([plan.latitude, plan.longitude], { radius: 400, color: Brand.primary, weight: 2, fillColor: Brand.primary, fillOpacity: 0.16 }).addTo(mapRef.current!);
        marker.on('click', () => setSelectedPlan(plan));
        return marker;
      });
    });
    return () => { cancelled = true; };
  }, [mapReady, plans.data]);

  useEffect(() => {
    if (mode !== 'map' || !mapRef.current) return;
    const timer = window.setTimeout(() => mapRef.current?.invalidateSize(), 0);
    return () => window.clearTimeout(timer);
  }, [mode]);

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <View><ThemedText style={styles.eyebrow}>HAO · NOW</ThemedText><ThemedText style={styles.title}>{t('mapScreen.title')}</ThemedText></View>
        <View style={styles.locationPill}><Ionicons name="location" size={15} color={Brand.primary} /><ThemedText type="smallBold">{t('mapScreen.within')}</ThemedText></View>
      </View>
      <View style={styles.segmented}>
        <Pressable onPress={() => setMode('map')} style={[styles.segment, mode === 'map' && styles.segmentActive]}><Ionicons name="map-outline" size={17} color={mode === 'map' ? '#FFFFFF' : '#67666D'} /><ThemedText type="smallBold" style={mode === 'map' && styles.segmentTextActive}>{t('map')}</ThemedText></Pressable>
        <Pressable onPress={() => setMode('list')} style={[styles.segment, mode === 'list' && styles.segmentActive]}><Ionicons name="list" size={17} color={mode === 'list' ? '#FFFFFF' : '#67666D'} /><ThemedText type="smallBold" style={mode === 'list' && styles.segmentTextActive}>{t('mapScreen.list')}</ThemedText></Pressable>
      </View>

      <View style={[styles.mapFrame, mode === 'list' && styles.hidden]}>
        <View ref={containerRef} style={styles.map} />
        {(!mapReady || plans.isLoading) && <View style={styles.loading}><ActivityIndicator color={Brand.primary} /><ThemedText type="small" themeColor="textSecondary">{t('mapScreen.loading')}</ThemedText></View>}
        {plans.error && <ThemedView style={styles.overlayCard}><ThemedText type="smallBold">{t('nearby.loadError')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('mapScreen.loadHelp')}</ThemedText><Pressable onPress={() => void plans.refetch()}><ThemedText style={styles.retry}>{t('tryAgain')}</ThemedText></Pressable></ThemedView>}
        {!plans.isLoading && !plans.error && !plans.data?.length && <ThemedView style={styles.overlayCard}><ThemedText style={styles.emptyTitle}>{t('mapScreen.empty')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('mapScreen.emptyHelp')}</ThemedText></ThemedView>}
        {selectedPlan && <View style={styles.preview}><PlanCard plan={selectedPlan} /></View>}
      </View>
      {mode === 'list' && <View style={styles.list}><View style={styles.listHeading}><ThemedText style={styles.listTitle}>{t('home.plans')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('mapScreen.nextHours')}</ThemedText></View><NearbyPlanList /></View>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: Spacing.three, paddingHorizontal: Spacing.three, paddingBottom: 94, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.three },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: '900', letterSpacing: 1.2, color: Brand.primary },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -1 },
  locationPill: { minHeight: 38, borderRadius: 19, paddingHorizontal: 12, backgroundColor: Brand.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: Brand.card },
  segment: { flex: 1, minHeight: 40, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segmentActive: { backgroundColor: Brand.primary }, segmentTextActive: { color: '#FFFFFF' },
  mapFrame: { flex: 1, minHeight: 420, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.card },
  hidden: { display: 'none' },
  map: { ...StyleSheet.absoluteFillObject },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, backgroundColor: 'rgba(255,253,252,0.88)' },
  overlayCard: { position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: Spacing.three, padding: Spacing.three, borderRadius: 20, gap: 5, borderWidth: 1, borderColor: Brand.border },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' }, retry: { color: Brand.primary, fontWeight: '800', marginTop: 4 },
  preview: { position: 'absolute', left: Spacing.two, right: Spacing.two, bottom: Spacing.two },
  list: { flex: 1, gap: Spacing.three }, listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, listTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900' },
});
