import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../context/ThemeModeContext';
import { Theme } from '../../constants/Theme';

export interface PremiumBottomSheetHandle {
  present: () => void;
  dismiss: () => void;
}

export type PremiumBottomSheetProps = {
  snapPoints?: string[];
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  scrollable?: boolean;
};

export const PremiumBottomSheet = forwardRef<PremiumBottomSheetHandle, PremiumBottomSheetProps>(
  ({ snapPoints, title, subtitle, children, onDismiss, scrollable = true }, ref) => {
    const { colors, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const modalRef = useRef<BottomSheetModal>(null);
    const isPresentedRef = useRef(false);

    const resolvedSnapPoints = useMemo(() => {
      if (snapPoints?.length) {
        return snapPoints;
      }

      return scrollable ? ['72%', '90%'] : ['58%'];
    }, [scrollable, snapPoints]);

    const handleDismiss = useCallback(() => {
      isPresentedRef.current = false;
      onDismiss?.();
    }, [onDismiss]);

    const handleSheetChange = useCallback((index: number) => {
      if (index < 0) {
        isPresentedRef.current = false;
      }
    }, []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={isDark ? 0.68 : 0.38}
          pressBehavior="close"
        />
      ),
      [isDark]
    );

    useImperativeHandle(
      ref,
      () => ({
        present: () => {
          if (isPresentedRef.current) {
            return;
          }

          isPresentedRef.current = true;
          modalRef.current?.present();
        },
        dismiss: () => {
          if (!isPresentedRef.current) {
            return;
          }

          modalRef.current?.dismiss();
        },
      }),
      []
    );

    return (
      <BottomSheetModal
        ref={modalRef}
        snapPoints={resolvedSnapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        enableContentPanningGesture
        enableHandlePanningGesture
        enableDismissOnClose
        animateOnMount
        keyboardBehavior={Platform.OS === 'ios' ? 'interactive' : 'extend'}
        keyboardBlurBehavior="restore"
        onChange={handleSheetChange}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={[styles.handle, { backgroundColor: colors.border }]}
        backgroundStyle={[
          styles.sheetBackground,
          {
            backgroundColor: colors.surface,
            shadowColor: '#000',
            shadowOpacity: isDark ? 0.42 : 0.14,
          },
        ]}
      >
        <View style={[styles.headerWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.headerInner, !title && !subtitle && styles.headerInnerCompact]}>
            {title ? <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
          </View>
        </View>

        {scrollable ? (
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 24, 40) },
            ]}
          >
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView
            style={[
              styles.viewContent,
              { paddingBottom: Math.max(insets.bottom + 24, 40) },
            ]}
          >
            {children}
          </BottomSheetView>
        )}
      </BottomSheetModal>
    );
  }
);

PremiumBottomSheet.displayName = 'PremiumBottomSheet';

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -10 },
    elevation: 24,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  headerWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.md,
  },
  headerInnerCompact: {
    paddingBottom: Theme.spacing.xs,
  },
  title: {
    ...Theme.typography.labelMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  subtitle: {
    ...Theme.typography.detail,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.lg,
  },
  viewContent: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.lg,
  },
});
