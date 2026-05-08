import React, { createContext, useCallback, useContext, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
  findNodeHandle,
  UIManager,
} from 'react-native';

interface KeyboardScrollContextValue {
  scrollToInput: (nodeHandle: number, extraOffset?: number) => void;
}

const KeyboardScrollContext = createContext<KeyboardScrollContextValue | null>(null);

export function useKeyboardScroll(): KeyboardScrollContextValue | null {
  return useContext(KeyboardScrollContext);
}

interface Props extends ScrollViewProps {
  children: React.ReactNode;
  /** Décalage haut quand on scroll vers un input focusé. */
  topOffset?: number;
  containerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}

const KeyboardAwareScroll: React.FC<Props> = ({
  children,
  topOffset = 16,
  containerStyle,
  keyboardVerticalOffset,
  ...scrollProps
}) => {
  const scrollRef = useRef<ScrollView>(null);

  const scrollToInput = useCallback(
    (nodeHandle: number, extraOffset = 0) => {
      const scrollNode = findNodeHandle(scrollRef.current);
      if (!scrollNode) return;
      UIManager.measureLayout?.(
        nodeHandle,
        scrollNode,
        () => {},
        (_x, y) => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, y - topOffset + extraOffset),
            animated: true,
          });
        },
      );
    },
    [topOffset],
  );

  return (
    <KeyboardScrollContext.Provider value={{ scrollToInput }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[{ flex: 1 }, containerStyle]}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </KeyboardScrollContext.Provider>
  );
};

export default KeyboardAwareScroll;
