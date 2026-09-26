import { StyleSheet, View, type ViewProps } from 'react-native';

import { MaxContentWidth } from '@/constants/theme';

// On a phone this is just a full-width View, but the app also runs in a desktop
// browser, where letting a single-column form stretch across 2000px makes every
// screen look unfinished. Capping the width and centering is what MaxContentWidth
// was defined for.
export function ScreenContainer({ style, ...rest }: ViewProps) {
  return <View style={[styles.container, style]} {...rest} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
