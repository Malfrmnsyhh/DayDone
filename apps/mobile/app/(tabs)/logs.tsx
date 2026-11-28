import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { LogListItem } from '@daydone/shared';
import { formatDateIndonesian } from '@/lib/date';
import { useLogsList } from '@/lib/logs-api';

const SEARCH_DEBOUNCE_MS = 300;

export default function LogsScreen() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Debounce input pencarian 300ms agar tidak memanggil API di setiap ketikan huruf
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useLogsList({
    search: debouncedSearch || undefined,
  });

  const logs = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data?.pages],
  );
  const totalCount = data?.pages[0]?.meta.total ?? 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setDebouncedSearch('');
  };

  const renderLogItem = ({ item }: { item: LogListItem }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() =>
        router.push({ pathname: '/logs/[id]', params: { id: item.id } })
      }
      accessibilityRole="button"
      accessibilityLabel={`Buka logbook tanggal ${formatDateIndonesian(item.date)}`}>
      <View style={styles.cardRow}>
        <View style={styles.cardBody}>
          <Text style={styles.cardDate}>{formatDateIndonesian(item.date)}</Text>
          <Text style={styles.cardSnippet} numberOfLines={3}>
            {item.descriptionSnippet}
          </Text>
          <Text style={styles.cardMeta}>
            {item.attachmentCount > 0
              ? `${item.attachmentCount} foto terlampir`
              : 'Tanpa foto'}
          </Text>
        </View>

        {item.firstAttachmentThumbnailUrl && (
          <Image
            source={{ uri: item.firstAttachmentThumbnailUrl }}
            style={styles.cardThumbnail}
            resizeMode="cover"
          />
        )}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>Riwayat Logbook</Text>
          {!isLoading && !isError && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{totalCount} Catatan</Text>
            </View>
          )}
        </View>

        {/* Input Pencarian + Tombol Reset */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Cari isi catatan logbook..."
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Cari logbook"
          />
          {searchInput.length > 0 && (
            <Pressable
              style={styles.clearButton}
              onPress={handleClearSearch}
              accessibilityRole="button"
              accessibilityLabel="Hapus teks pencarian">
              <Text style={styles.clearButtonText}>Hapus</Text>
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.stateDesc}>Memuat daftar logbook...</Text>
        </View>
      ) : isError ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Gagal Memuat Logbook</Text>
          <Text style={styles.stateDesc}>
            {error instanceof Error
              ? error.message
              : 'Periksa koneksi ke API backend lalu coba lagi.'}
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Coba lagi memuat daftar logbook">
            <Text style={styles.retryButtonText}>Coba Lagi</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderLogItem}
          contentContainerStyle={
            logs.length === 0 ? styles.emptyListContent : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#0284C7']}
              tintColor="#0284C7"
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.stateTitle}>
                {debouncedSearch
                  ? 'Catatan Tidak Ditemukan'
                  : 'Belum Ada Logbook'}
              </Text>
              <Text style={styles.stateDesc}>
                {debouncedSearch
                  ? `Tidak ada logbook yang cocok dengan kata kunci "${debouncedSearch}".`
                  : 'Logbook yang kamu buat akan muncul di sini berurutan dari tanggal terbaru.'}
              </Text>
              {debouncedSearch.length > 0 && (
                <Pressable
                  style={styles.retryButton}
                  onPress={handleClearSearch}
                  accessibilityRole="button"
                  accessibilityLabel="Reset pencarian">
                  <Text style={styles.retryButtonText}>Reset Pencarian</Text>
                </Pressable>
              )}
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#0284C7" />
                <Text style={styles.footerText}>Memuat lebih banyak...</Text>
              </View>
            ) : hasNextPage ? (
              <Pressable
                style={styles.loadMoreButton}
                onPress={handleEndReached}
                accessibilityRole="button"
                accessibilityLabel="Muat halaman logbook berikutnya">
                <Text style={styles.loadMoreText}>Muat Lebih Banyak</Text>
              </Pressable>
            ) : undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  clearButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyListContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardBody: {
    flex: 1,
  },
  cardDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
    marginBottom: 6,
  },
  cardSnippet: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  cardThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  stateContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  stateDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 13,
    color: '#64748B',
  },
  loadMoreButton: {
    minHeight: 44,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
});