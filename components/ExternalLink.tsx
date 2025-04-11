// ExternalLink.tsx

import { Link, ExternalPathString } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { ComponentProps } from 'react';
import { Platform } from 'react-native';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      // Cast the string `href` to `ExternalPathString`
      href={href as ExternalPathString}
      onPress={async (event) => {
        if (Platform.OS !== 'web') {
          // Prevent the default behavior of opening the system browser.
          event.preventDefault();
          // Open the link in the in-app browser (native).
          await openBrowserAsync(href);
        }
      }}
    />
  );
}
