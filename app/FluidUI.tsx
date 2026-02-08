import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, TextInput, View } from 'react-native';

const { width, height } = Dimensions.get('window');

// Vivid prismatic sea-green/blue color palette
const COLORS = {
  electric: '#00F0FF',      // Electric cyan
  aqua: '#00FFD4',          // Bright aqua
  teal: '#00D9C8',          // Vivid teal
  ocean: '#0095FF',         // Ocean blue
  cyan: '#00BFFF',          // Deep sky blue
  mint: '#00FFB3',          // Electric mint
  turquoise: '#40E0D0',     // Turquoise
  deepBlue: '#0080FF',      // Deep blue
};

interface FluidUIProps {
  children: React.ReactNode;
  screen?: 'home' | 'setup' | 'pitch' | 'analysis';
}

export default function FluidUI({ children, screen = 'home' }: FluidUIProps) {
  // Animated values for fluctuating circles
  const circle1Anim = useRef(new Animated.Value(0)).current;
  const circle2Anim = useRef(new Animated.Value(0)).current;
  const circle3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle fluctuation animations for circles (scale pulsing, not position changes)
    const createFluctuationAnimation = (animValue: Animated.Value, duration: number, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const fluctuation1 = createFluctuationAnimation(circle1Anim, 6000, 0);
    const fluctuation2 = createFluctuationAnimation(circle2Anim, 7000, 500);
    const fluctuation3 = createFluctuationAnimation(circle3Anim, 8000, 1000);

    fluctuation1.start();
    fluctuation2.start();
    fluctuation3.start();

    return () => {
      fluctuation1.stop();
      fluctuation2.stop();
      fluctuation3.stop();
    };
  }, []);

  // Calculate scale fluctuations for circles
  const circle1Scale = circle1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const circle2Scale = circle2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const circle3Scale = circle3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });

  // Screen-specific gradient colors
  const getGradientColors = () => {
    switch (screen) {
      case 'home':
        return [COLORS.electric, COLORS.ocean];
      case 'setup':
        return [COLORS.aqua, COLORS.teal];
      case 'pitch':
        return [COLORS.cyan, COLORS.deepBlue];
      case 'analysis':
        return [COLORS.mint, COLORS.turquoise];
      default:
        return [COLORS.electric, COLORS.ocean];
    }
  };

  const [color1, color2] = getGradientColors();

  return (
    <View style={styles.container}>
      {/* Animated background circles with subtle fluctuation */}
      <View style={styles.backgroundLayer}>
        <Animated.View
          style={[
            styles.floatingCircle,
            {
              backgroundColor: COLORS.electric + '18',
              width: 300,
              height: 300,
              borderRadius: 150,
              top: height * 0.15,
              left: width * 0.1,
              transform: [{ scale: circle1Scale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.floatingCircle,
            {
              backgroundColor: COLORS.cyan + '20',
              width: 250,
              height: 250,
              borderRadius: 125,
              top: height * 0.5,
              right: width * 0.15,
              transform: [{ scale: circle2Scale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.floatingCircle,
            {
              backgroundColor: COLORS.teal + '16',
              width: 200,
              height: 200,
              borderRadius: 100,
              top: height * 0.75,
              left: width * 0.25,
              transform: [{ scale: circle3Scale }],
            },
          ]}
        />
        
        {/* Additional static ambient circles for depth - pure blue/cyan only */}
        <View style={[styles.ambientCircle, { top: height * 0.08, right: width * 0.2, backgroundColor: COLORS.ocean + '12', width: 220, height: 220, borderRadius: 110 }]} />
        <View style={[styles.ambientCircle, { top: height * 0.35, left: width * 0.05, backgroundColor: COLORS.aqua + '14', width: 180, height: 180, borderRadius: 90 }]} />
        <View style={[styles.ambientCircle, { top: height * 0.6, right: width * 0.1, backgroundColor: COLORS.mint + '10', width: 160, height: 160, borderRadius: 80 }]} />
        <View style={[styles.ambientCircle, { top: height * 0.88, left: width * 0.5, backgroundColor: COLORS.deepBlue + '12', width: 200, height: 200, borderRadius: 100 }]} />
        <View style={[styles.ambientCircle, { top: height * 0.42, right: width * 0.35, backgroundColor: COLORS.turquoise + '11', width: 190, height: 190, borderRadius: 95 }]} />
      </View>

      {/* Gradient overlay */}
      <View style={styles.gradientOverlay} />

      {/* Content */}
      <View style={styles.contentLayer}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  floatingCircle: {
    position: 'absolute',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 50,
    elevation: 5,
  },
  ambientCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  contentLayer: {
    flex: 1,
    zIndex: 10,
  },
});

// Export enhanced text input component
export const FluidTextInput = ({ style, ...props }: any) => {
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    Animated.spring(focusAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    Animated.spring(focusAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 240, 255, 0.3)', 'rgba(0, 240, 255, 0.8)'],
  });

  const backgroundColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(26, 26, 30, 0.4)', 'rgba(26, 26, 30, 0.7)'],
  });

  return (
    <Animated.View
      style={[
        inputStyles.container,
        {
          borderColor,
          backgroundColor,
        },
      ]}
    >
      <TextInput
        style={[inputStyles.input, style]}
        placeholderTextColor="rgba(255, 255, 255, 0.4)"
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    </Animated.View>
  );
};

const inputStyles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  input: {
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});