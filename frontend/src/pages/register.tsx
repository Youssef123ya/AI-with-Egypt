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
  SimpleGrid,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconRecycle, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useAuth from '@/hooks/useAuth';
import { RegisterData } from '@/types';
import { notifications } from '@mantine/notifications';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { register, isAuthenticated, error, clearError } = useAuth();
  const router = useRouter();

  const form = useForm<RegisterData & { confirmPassword: string }>({
    initialValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      location: {
        city: '',
        state: '',
        country: '',
        zipCode: '',
      },
    },
    validate: {
      name: (value) => (value.length < 2 ? 'Name must be at least 2 characters' : null),
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value) => (value.length < 6 ? 'Password must be at least 6 characters' : null),
      confirmPassword: (value, values) =>
        value !== values.password ? 'Passwords do not match' : null,
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  const handleSubmit = async (values: RegisterData & { confirmPassword: string }) => {
    setLoading(true);
    clearError();
    
    try {
      const { confirmPassword, ...registerData } = values;
      await register(registerData);
      
      setSuccess(true);
      notifications.show({
        title: 'Registration Successful!',
        message: 'Your account has been created. Please sign in to continue.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Redirect to login after a brief delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error) {
      // Error is handled by the auth store
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Container size={420} my={40}>
        <Center>
          <Paper withBorder shadow="md" p={30} radius="md">
            <Center mb="md">
              <IconCheck size={48} color="green" />
            </Center>
            <Title order={3} ta="center" mb="md">
              Registration Successful!
            </Title>
            <Text ta="center" color="dimmed">
              Your account has been created successfully. You will be redirected to the login page shortly.
            </Text>
          </Paper>
        </Center>
      </Container>
    );
  }

  return (
    <Container size={500} my={40}>
      <Center mb={40}>
        <Group spacing="sm">
          <IconRecycle size={40} color="#339933" />
          <Box>
            <Title order={2} color="green.7">
              ECO Tracking
            </Title>
            <Text size="sm" color="dimmed">
              Join the recycling community
            </Text>
          </Box>
        </Group>
      </Center>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Title order={2} ta="center" mt="md" mb={50}>
          Create your account
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
              label="Full Name"
              placeholder="Your full name"
              {...form.getInputProps('name')}
            />

            <TextInput
              required
              label="Email"
              placeholder="your@email.com"
              {...form.getInputProps('email')}
            />

            <SimpleGrid cols={2}>
              <PasswordInput
                required
                label="Password"
                placeholder="Your password"
                {...form.getInputProps('password')}
              />

              <PasswordInput
                required
                label="Confirm Password"
                placeholder="Confirm password"
                {...form.getInputProps('confirmPassword')}
              />
            </SimpleGrid>

            <Text size="sm" weight={500} mt="md" mb="xs">
              Location (Optional)
            </Text>

            <SimpleGrid cols={2}>
              <TextInput
                label="City"
                placeholder="Your city"
                {...form.getInputProps('location.city')}
              />

              <TextInput
                label="State"
                placeholder="Your state"
                {...form.getInputProps('location.state')}
              />
            </SimpleGrid>

            <SimpleGrid cols={2}>
              <TextInput
                label="Country"
                placeholder="Your country"
                {...form.getInputProps('location.country')}
              />

              <TextInput
                label="ZIP Code"
                placeholder="ZIP code"
                {...form.getInputProps('location.zipCode')}
              />
            </SimpleGrid>

            <Button 
              fullWidth 
              type="submit" 
              loading={loading}
              size="md"
              color="green"
              mt="md"
            >
              Create Account
            </Button>

            <Group position="center" mt="lg">
              <Text size="sm">
                Already have an account?{' '}
                <Anchor component={Link} href="/login" size="sm">
                  Sign in
                </Anchor>
              </Text>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Center mt="xl">
        <Text size="xs" color="dimmed" ta="center">
          By creating an account, you agree to our{' '}
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
RegisterPage.requireAuth = false;