import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
  useBottomSheetSpringConfigs,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../context/ThemeModeContext';
import { Theme } from '../../constants/Theme';

export interface PremiumBottomSheetHandle {
  present: () => void;
  dismiss: () => void;
  snapToIndex: (index: number) => void;
}

export type SheetPolicy = 'passive' | 'operational' | 'critical';
type SheetKeyboardBehavior = 'extend' | 'fillParent' | 'interactive';
type SheetAndroidKeyboardInputMode = 'adjustPan' | 'adjustResize';

export type PremiumBottomSheetProps = {
  snapPoints?: string[];
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  beforeDismiss?: () => boolean | Promise<boolean>;
  scrollable?: boolean;
  policy?: SheetPolicy;
  showCloseButton?: boolean;
  contentPanningGestureEnabled?: boolean;
  keyboardBehavior?: SheetKeyboardBehavior;
  androidKeyboardInputMode?: SheetAndroidKeyboardInputMode;
};

const SHEET_POLICY_CONFIG = {
  passive: {
    backdropPressBehavior: 'close',
    enablePanDownToClose: true,
    enableContentPanningGesture: true,
  },
  operational: {
    backdropPressBehavior: 'close',
    enablePanDownToClose: true,
    enableContentPanningGesture: true,
  },
  critical: {
    backdropPressBehavior: 'close',
    enablePanDownToClose: false,
    enableContentPanningGesture: true,
  },
} as const;

export const PremiumBottomSheet = forwardRef<PremiumBottomSheetHandle, PremiumBottomSheetProps>(
  ({
    snapPoints,
    title,
    subtitle,
    children,
    onDismiss,
    beforeDismiss,
    scrollable = true,
    policy = 'passive',
    showCloseButton,
    contentPanningGestureEnabled,
    keyboardBehavior = 'interactive',
    androidKeyboardInputMode = 'adjustPan',
  }, ref) => {
    const { colors, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const modalRef = useRef<BottomSheetModal>(null);
    const isPresentedRef = useRef(false);
    const dismissRequestBusyRef = useRef(false);
    const scrollAtTopRef = useRef(true);
    const [scrollAtTop, setScrollAtTop] = useState(true);
    const policyConfig = SHEET_POLICY_CONFIG[policy];
    const shouldShowCloseButton = showCloseButton ?? policy === 'critical';
    const hasDismissGuard = Boolean(beforeDismiss);
    const enableContentPanningGesture = contentPanningGestureEnabled ?? policyConfig.enableContentPanningGesture;
    const enablePanDownToClose = policyConfig.enablePanDownToClose && !hasDismissGuard && (!scrollable || scrollAtTop);
    const animationConfigs = useBottomSheetSpringConfigs({
      damping: 34,
      stiffness: 360,
      mass: 0.85,
      overshootClamping: false,
    });

    const resolvedSnapPoints = useMemo(() => {
      if (snapPoints?.length) {
        return snapPoints;
      }

      return scrollable ? ['60%', '90%'] : ['55%'];
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

    const requestDismiss = useCallback(async () => {
      if (!isPresentedRef.current || dismissRequestBusyRef.current) {
        return;
      }

      dismissRequestBusyRef.current = true;
      let canDismiss = false;
      try {
        canDismiss = beforeDismiss ? await beforeDismiss() : true;
      } finally {
        dismissRequestBusyRef.current = false;
      }

      if (!canDismiss) {
        return;
      }

      modalRef.current?.dismiss();
    }, [beforeDismiss]);

    const handleContentScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextScrollAtTop = event.nativeEvent.contentOffset.y <= 2;
      if (scrollAtTopRef.current === nextScrollAtTop) {
        return;
      }

      scrollAtTopRef.current = nextScrollAtTop;
      setScrollAtTop(nextScrollAtTop);
    }, []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={1}
          pressBehavior="none"
          accessible={false}
        >
          {policyConfig.backdropPressBehavior === 'close' ? (
            <Pressable
              accessibilityLabel="Close sheet"
              accessibilityRole="button"
              onPress={() => void requestDismiss()}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            {Platform.OS !== 'web' ? (
              <BlurView
                intensity={Platform.OS === 'android' ? 35 : isDark ? 24 : 28}
                tint={isDark ? 'dark' : 'light'}
                experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
                blurReductionFactor={Platform.OS === 'android' ? 2.4 : undefined}
                style={StyleSheet.absoluteFillObject}
              />
            ) : null}
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.22)' : 'rgba(20, 20, 20, 0.06)',
                },
              ]}
            />
          </View>
        </BottomSheetBackdrop>
      ),
      [isDark, policyConfig.backdropPressBehavior, requestDismiss]
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
          void requestDismiss();
        },
        snapToIndex: (index: number) => {
          modalRef.current?.snapToIndex(index);
        },
      }),
      [requestDismiss]
    );

    return (
      <BottomSheetModal
        ref={modalRef}
        snapPoints={resolvedSnapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={enablePanDownToClose}
        enableContentPanningGesture={enableContentPanningGesture}
        enableHandlePanningGesture
        enableBlurKeyboardOnGesture
        overDragResistanceFactor={2}
        activeOffsetY={[-5, 5]}
        enableDismissOnClose
        animateOnMount
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode={androidKeyboardInputMode}
        onChange={handleSheetChange}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        animationConfigs={animationConfigs}
        handleStyle={styles.handleWrap}
        handleIndicatorStyle={[
          styles.handle,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.26)' : 'rgba(60, 60, 67, 0.24)',
          },
        ]}
        backgroundStyle={[
          styles.sheetBackground,
          {
            backgroundColor: isDark ? colors.surface : 'rgba(250, 248, 245, 0.92)',
            shadowColor: '#000',
            shadowOpacity: isDark ? 0.44 : 0.18,
          },
        ]}
      >
        <View style={[styles.headerWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.headerInner, !title && !subtitle && styles.headerInnerCompact]}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                {title ? <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text> : null}
                {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
              </View>
              {shouldShowCloseButton ? (
                <Pressable
                  accessibilityLabel="Close sheet"
                  accessibilityRole="button"
                  onPress={() => void requestDismiss()}
                  style={({ pressed }) => [
                    styles.closeButton,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceElevated,
                      borderColor: colors.border,
                      opacity: pressed ? Theme.opacity.active : 1,
                    },
                  ]}
                >
                  <X size={18} color={colors.textSecondary} strokeWidth={2.4} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {scrollable ? (
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            onScroll={handleContentScroll}
            nestedScrollEnabled
            overScrollMode="never"
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
    width: 60,
    height: 6,
    borderRadius: 999,
  },
  handleWrap: {
    paddingTop: 14,
    paddingBottom: 10,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Theme.typography.labelMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    lineHeight: 22,
  },
  subtitle: {
    ...Theme.typography.detail,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    lineHeight: 14,
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
