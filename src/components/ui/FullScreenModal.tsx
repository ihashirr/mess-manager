import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { ImageSourcePropType, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, Extrapolation } from 'react-native-reanimated';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { AtmosphereBackground } from './AtmosphereBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useAppTheme } from '../../context/ThemeModeContext';
import { Theme } from '../../constants/Theme';

export interface FullScreenModalHandle {
  present: () => void;
  dismiss: () => void;
}

export interface FullScreenModalProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerIcon?: React.ReactNode;
  onDismiss?: () => void;
  beforeDismiss?: () => boolean | Promise<boolean>;
}

const AnimatedKeyboardAwareScrollView = Animated.createAnimatedComponent(KeyboardAwareScrollView);

const FullScreenModalInner: React.ForwardRefRenderFunction<FullScreenModalHandle, FullScreenModalProps> = (
  { title, subtitle, children, footer, headerIcon, onDismiss, beforeDismiss },
  ref
) => {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [dismissBusy, setDismissBusy] = useState(false);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 30], [0, 1], Extrapolation.CLAMP);
    return {
      borderBottomColor: isDark ? `rgba(255,255,255,${opacity * 0.1})` : `rgba(0,0,0,${opacity * 0.1})`,
      elevation: opacity * 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? opacity * 0.3 : opacity * 0.05,
      shadowRadius: 8,
    };
  });

  const handleDismissRequest = useCallback(async () => {
    if (!visible || dismissBusy) {
      return;
    }

    setDismissBusy(true);
    let canDismiss = true;
    try {
      if (beforeDismiss) {
        canDismiss = await beforeDismiss();
      }
    } finally {
      setDismissBusy(false);
    }

    if (canDismiss) {
      setVisible(false);
      onDismiss?.();
    }
  }, [beforeDismiss, onDismiss, visible, dismissBusy]);

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        setVisible(true);
      },
      dismiss: () => {
        void handleDismissRequest();
      },
    }),
    [handleDismissRequest]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => void handleDismissRequest()}
    >
      <AtmosphereBackground
        backgroundColor={colors.bg}
        intensity="medium"
        saffronGlow
        style={[styles.container, { paddingTop: insets.top }]}
      >
        {/* Header */}
        <Animated.View style={[styles.headerWrap, headerAnimatedStyle, { zIndex: 10 }]}>
          <View style={styles.headerInner}>
            <View style={styles.headerRow}>
              {headerIcon ? <View style={styles.headerIcon}>{headerIcon}</View> : null}
              <View style={styles.headerCopy}>
                {title ? <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text> : null}
                {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
              </View>
              <Pressable
                accessibilityLabel="Close modal"
                accessibilityRole="button"
                onPress={() => void handleDismissRequest()}
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
            </View>
          </View>
        </Animated.View>

        {/* Content */}
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <AnimatedKeyboardAwareScrollView
            style={{ flex: 1 }}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            enableOnAndroid={true}
            extraHeight={40}
            extraScrollHeight={40}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 24, 40) },
            ]}
          >
            {children}
          </AnimatedKeyboardAwareScrollView>

          {/* Footer */}
          {footer ? (
            <View
              style={[
                styles.footerWrap,
                {
                  backgroundColor: colors.surface,
                  borderTopColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, 16),
                },
              ]}
            >
              {footer}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </AtmosphereBackground>
    </Modal>
  );
};

export const FullScreenModal = forwardRef(FullScreenModalInner);

FullScreenModal.displayName = 'FullScreenModal';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  headerWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  headerIcon: {
    marginRight: 4,
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
  footerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.md,
  },
});
