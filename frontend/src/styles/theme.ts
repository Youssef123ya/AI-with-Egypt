import { createTheme, MantineColorsTuple } from '@mantine/core';

const green: MantineColorsTuple = [
  '#e7f5e7',
  '#d1e7d1',
  '#a5d1a5',
  '#76bb76',
  '#4da74d',
  '#339933',
  '#248024',
  '#176617',
  '#0d4d0d',
  '#033303'
];

const blue: MantineColorsTuple = [
  '#e7f3ff',
  '#d1e6ff',
  '#a5ccff',
  '#76b3ff',
  '#4d99ff',
  '#3380ff',
  '#1966cc',
  '#0f4d99',
  '#073366',
  '#031a33'
];

export const theme = createTheme({
  primaryColor: 'green',
  defaultRadius: 'md',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  },
  colors: {
    green,
    blue,
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 500,
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: 'var(--mantine-color-white)',
          border: '1px solid var(--mantine-color-gray-2)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        },
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Textarea: {
      defaultProps: {
        radius: 'md',
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
    NumberInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Paper: {
      styles: {
        root: {
          backgroundColor: 'var(--mantine-color-white)',
        },
      },
    },
  },
  other: {
    // Custom theme properties
    shadows: {
      card: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
      elevated: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
    },
    spacing: {
      xs: '0.5rem',
      sm: '0.75rem',
      md: '1rem',
      lg: '1.25rem',
      xl: '2rem',
    },
  },
});