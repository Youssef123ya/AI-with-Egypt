import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Anchor,
  Stack,
  Alert,
  Center,
  Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconRecycle, IconAlertCircle } from '@tabler/icons-react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useAuth from '@/hooks/useAuth';
import { LoginCredentials } from '@/types';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, error, clearError } = useAuth();
  const router = useRouter();

  const form = useForm<LoginCredentials>({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value) => (value.length < 6 ? 'Password must be at least 6 characters' : null),
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = (router.query.redirect as string) || '/dashboard';
      router.push(redirectTo);
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  const handleSubmit = async (values: LoginCredentials) => {
    setLoading(true);
    clearError();
    
    try {
      await login(values);
      const redirectTo = (router.query.redirect as string) || '/dashboard';
      router.push(redirectTo);
    } catch (error) {
      // Error is handled by the auth store
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={40}>
      <Center mb={40}>
        <Group spacing="sm">
          <IconRecycle size={40} color="#339933" />
          <Box>
            <Title order={2} color="green.7">
              ECO Tracking
            </Title>
            <Text size="sm" color="dimmed">
              Track your recycling impact
            </Text>
          </Box>
        </Group>
      </Center>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Title order={2} ta="center" mt="md" mb={50}>
          Welcome back!
        </Title>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              required
              label="Email"
              placeholder="your@email.com"
              {...form.getInputProps('email')}
            />

            <PasswordInput
              required
              label="Password"
              placeholder="Your password"
              {...form.getInputProps('password')}
            />

            <Button 
              fullWidth 
              type="submit" 
              loading={loading}
              size="md"
              color="green"
            >
              Sign in
            </Button>

            <Group position="center" mt="lg">
              <Text size="sm">
                Don't have an account?{' '}
                <Anchor component={Link} href="/register" size="sm">
                  Create account
                </Anchor>
              </Text>
            </Group>

            <Group position="center">
              <Anchor component={Link} href="/forgot-password" size="sm">
                Forgot your password?
              </Anchor>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Center mt="xl">
        <Text size="xs" color="dimmed" ta="center">
          By signing in, you agree to our{' '}
          <Anchor component={Link} href="/terms" size="xs">
            Terms of Service
          </Anchor>{' '}
          and{' '}
          <Anchor component={Link} href="/privacy" size="xs">
            Privacy Policy
          </Anchor>
        </Text>
      </Center>
    </Container>
  );
}

// This page doesn't need authentication
LoginPage.requireAuth = false;