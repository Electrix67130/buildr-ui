import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Linking, Modal, Alert, RefreshControl } from 'react-native';
import { ImagePlus, Upload, Trash2, X, FileCheck, FileClock, ShoppingCart, Map, Scale, Receipt, File, ExternalLink, Share2 } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDocuments, useCreateDocument, useDeleteDocument } from '@/api/hooks/useDocuments';
import { uploadFile } from '@/api/upload';
import { getSignedFileUrl } from '@/api/fileAccess';
import { shareFile } from '@/utils/shareFile';
import { optimizeImage } from '@/utils/optimizeImage';
import type { DocumentType, Document } from '@/api/types';

const DOC_TYPES: { key: DocumentType; label: string; icon: typeof File; color: string; description: string }[] = [
  { key: 'dict', label: 'DICT', icon: FileCheck, color: '#7C3AED', description: 'Déclaration d\'Intention de Commencement de Travaux' },
  { key: 'dt', label: 'DT', icon: FileClock, color: '#2563EB', description: 'Déclaration de Travaux' },
  { key: 'bon_de_commande', label: 'Bon de commande', icon: ShoppingCart, color: '#D97706', description: 'Bon de commande fournisseur' },
  { key: 'plan', label: 'Plan', icon: Map, color: '#059669', description: 'Plans et schémas techniques' },
  { key: 'arrete', label: 'Arrêté', icon: Scale, color: '#DC2626', description: 'Arrêté municipal ou préfectoral' },
  { key: 'facture', label: 'Facture', icon: Receipt, color: '#0891B2', description: 'Facture client ou fournisseur' },
  { key: 'autre', label: 'Autre', icon: File, color: '#6B7280', description: 'Autre document' },
];

const DOC_TYPE_MAP = Object.fromEntries(DOC_TYPES.map((t) => [t.key, t]));

interface Props {
  chantierId: string;
  readonly?: boolean;
}

const DocumentList: React.FC<Props> = ({ chantierId, readonly }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; uri: string; size?: number; mimeType?: string } | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<(Document & { first_name: string; last_name: string }) | null>(null);

  const { data, isLoading, refetch, isRefetching } = useDocuments(chantierId);
  const createMutation = useCreateDocument();
  const deleteMutation = useDeleteDocument();

  // Guard contre double-fire si un picker est deja ouvert.
  const isPickingRef = useRef(false);

  const handlePickFile = useCallback(async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const MAX_SIZE = 10 * 1024 * 1024;
        if (asset.size && asset.size > MAX_SIZE) {
          Alert.alert(
            'Fichier trop volumineux',
            `Ce fichier fait ${(asset.size / (1024 * 1024)).toFixed(1)} Mo. La taille maximale autorisée est 10 Mo.\n\nConseil : si c'est un PDF, vous pouvez le compresser via des services comme ilovepdf.com avant de l'importer.`,
          );
          return;
        }
        setPendingFile({ name: asset.name, uri: asset.uri, size: asset.size, mimeType: asset.mimeType || undefined });
        setShowTypeModal(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (!msg.includes('Different document picking in progress')) Alert.alert('Erreur', msg);
    } finally {
      isPickingRef.current = false;
    }
  }, []);

  const handlePickFromGallery = useCallback(async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Accès à la galerie refusé',
          'Autorise l\'accès aux photos dans les réglages de l\'app pour pouvoir importer depuis la galerie.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const optimized = await optimizeImage(asset.uri, asset.width, asset.height);
      const fileName = asset.fileName ?? `photo-${Date.now()}.jpg`;
      setPendingFile({
        name: fileName,
        uri: optimized.uri,
        mimeType: 'image/jpeg',
      });
      setShowTypeModal(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      Alert.alert('Erreur', msg);
    } finally {
      isPickingRef.current = false;
    }
  }, []);


  const handleSelectType = useCallback(async (type: DocumentType) => {
    if (!pendingFile) return;
    setShowTypeModal(false);

    // Upload file to server first, then create DB entry with the server URL
    const uploaded = await uploadFile(pendingFile.uri, pendingFile.name, pendingFile.mimeType);

    await createMutation.mutateAsync({
      chantier_id: chantierId,
      name: pendingFile.name,
      type,
      url: uploaded.url,
      file_size: uploaded.file_size,
      mime_type: uploaded.mime_type,
    });
    setPendingFile(null);
  }, [pendingFile, chantierId, createMutation]);

  const handleOpen = useCallback(async () => {
    if (!selectedDoc) return;
    const signedUrl = await getSignedFileUrl(selectedDoc.url);
    Linking.openURL(signedUrl);
    setSelectedDoc(null);
  }, [selectedDoc]);

  const handleShare = useCallback(async () => {
    if (!selectedDoc) return;
    const signedUrl = await getSignedFileUrl(selectedDoc.url);
    try {
      await shareFile(signedUrl, selectedDoc.name, selectedDoc.mime_type);
    } catch {
      // silent
    }
    setSelectedDoc(null);
  }, [selectedDoc]);

  const handleDelete = useCallback(() => {
    if (!selectedDoc) return;
    deleteMutation.mutate(selectedDoc.id);
    setSelectedDoc(null);
  }, [selectedDoc, deleteMutation]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const renderItem = useCallback(
    ({ item }: { item: Document & { first_name: string; last_name: string } }) => {
      const docType = DOC_TYPE_MAP[item.type];
      const TypeIcon = docType?.icon ?? File;
      const typeColor = docType?.color ?? '#6B7280';

      return (
        <TouchableOpacity
          style={[styles.docCard, { backgroundColor: colors.surface, borderColor: colors.border }, Shadow.sm]}
          onPress={() => setSelectedDoc(item)}
          onLongPress={() => setSelectedDoc(item)}
          delayLongPress={200}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={item.name}
        >
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '12' }]}>
            <TypeIcon size={IconSize.xl} color={typeColor} />
          </View>
          <View style={styles.docInfo}>
            <Text style={[styles.docName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.docMeta, { color: colors.mutedText }]}>
              {docType?.label ?? item.type}
              {item.file_size ? `  ·  ${formatSize(item.file_size)}` : ''}
            </Text>
            <Text style={[styles.docAuthor, { color: colors.mutedText }]}>
              {item.first_name} {item.last_name} — {new Date(item.created_at).toLocaleDateString('fr-FR')}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [colors],
  );

  return (
    <View style={styles.container}>
      {!readonly && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handlePickFromGallery}
            disabled={createMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Importer depuis la galerie"
          >
            <ImagePlus size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>Galerie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handlePickFile}
            disabled={createMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Importer un fichier"
          >
            <Upload size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.actionText}>Fichier</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={[styles.empty, { color: colors.mutedText }]}>Aucun document.</Text>
          ) : null
        }
      />

      {/* Action sheet quand on tap un document */}
      <Modal visible={!!selectedDoc} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedDoc(null)}>
          <View style={[styles.actionSheet, { backgroundColor: colors.surface }, Shadow.lg]}>
            {selectedDoc && (() => {
              const docType = DOC_TYPE_MAP[selectedDoc.type];
              const TypeIcon = docType?.icon ?? File;
              const typeColor = docType?.color ?? '#6B7280';
              return (
                <>
                  <View style={styles.actionSheetHeader}>
                    <View style={[styles.actionSheetIcon, { backgroundColor: typeColor + '15' }]}>
                      <TypeIcon size={IconSize.xxl} color={typeColor} />
                    </View>
                    <View style={styles.actionSheetInfo}>
                      <Text style={[styles.actionSheetName, { color: colors.text }]} numberOfLines={2}>{selectedDoc.name}</Text>
                      <Text style={[styles.actionSheetMeta, { color: colors.mutedText }]}>
                        {docType?.label} · {formatSize(selectedDoc.file_size)} · {selectedDoc.first_name} {selectedDoc.last_name}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.separator, { backgroundColor: colors.border }]} />

                  <TouchableOpacity style={styles.actionRow} onPress={handleOpen} accessibilityRole="button">
                    <ExternalLink size={IconSize.lg} color={colors.primary} />
                    <Text style={[styles.actionLabel, { color: colors.text }]}>Ouvrir le document</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionRow} onPress={handleShare} accessibilityRole="button">
                    <Share2 size={IconSize.lg} color={colors.primary} />
                    <Text style={[styles.actionLabel, { color: colors.text }]}>Partager / Télécharger</Text>
                  </TouchableOpacity>

                  {!readonly && (
                    <TouchableOpacity style={styles.actionRow} onPress={handleDelete} accessibilityRole="button">
                      <Trash2 size={IconSize.lg} color={colors.red} />
                      <Text style={[styles.actionLabel, { color: colors.red }]}>Supprimer</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Choix du type après avoir choisi un fichier */}
      <Modal visible={showTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.typeModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.typeModalHeader}>
              <View>
                <Text style={[styles.typeModalTitle, { color: colors.text }]}>Type de document</Text>
                {pendingFile && (
                  <Text style={[styles.typeModalFile, { color: colors.mutedText }]} numberOfLines={1}>{pendingFile.name}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => { setShowTypeModal(false); setPendingFile(null); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={IconSize.lg} color={colors.text} />
              </TouchableOpacity>
            </View>
            {DOC_TYPES.map((dt) => {
              const Icon = dt.icon;
              return (
                <TouchableOpacity
                  key={dt.key}
                  style={[styles.typeRow, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelectType(dt.key)}
                  accessibilityRole="button"
                  accessibilityLabel={dt.label}
                >
                  <View style={[styles.typeRowIcon, { backgroundColor: dt.color + '15' }]}>
                    <Icon size={IconSize.lg} color={dt.color} />
                  </View>
                  <View style={styles.typeRowText}>
                    <Text style={[styles.typeRowLabel, { color: colors.text }]}>{dt.label}</Text>
                    <Text style={[styles.typeRowDesc, { color: colors.mutedText }]}>{dt.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg },
  actionsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 44,
    borderRadius: Radius.md,
  },
  actionText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  list: { paddingBottom: Spacing.xxxl },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  typeBadge: { width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  docInfo: { flex: 1, gap: 2 },
  docName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  docMeta: { fontSize: FontSize.sm },
  docAuthor: { fontSize: FontSize.xs },
  empty: { fontSize: FontSize.base, textAlign: 'center', paddingTop: Spacing.xxxl },

  // Action sheet (tap on document)
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  actionSheet: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  actionSheetHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
  actionSheetIcon: { width: 56, height: 56, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  actionSheetInfo: { flex: 1 },
  actionSheetName: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  actionSheetMeta: { fontSize: FontSize.sm, marginTop: 2 },
  separator: { height: 1, marginVertical: Spacing.sm },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.lg },
  actionLabel: { fontSize: FontSize.lg },
  cancelLabel: { fontSize: FontSize.lg, textAlign: 'center', width: '100%' },

  // Type picker modal
  typeModalContent: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl, maxHeight: '85%' },
  typeModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  typeModalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  typeModalFile: { fontSize: FontSize.sm, marginTop: 2 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  typeRowIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  typeRowText: { flex: 1 },
  typeRowLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  typeRowDesc: { fontSize: FontSize.xs, marginTop: 1 },

});

export default DocumentList;
