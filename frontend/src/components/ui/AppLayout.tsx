import { useState } from 'react';
import {
  AppShell,
  Navbar,
  Header,
  Footer,
  Aside,
  Text,
  MediaQuery,
  Burger,
  useMantineTheme,
  Group,
  ActionIcon,
  Menu,
  Avatar,
  UnstyledButton,
  Box,
  Stack,
  NavLink,
  Button,
  Indicator,
} from '@mantine/core';
import {
  IconRecycle,
  IconMap2,
  IconChartBar,
  IconUser,
  IconSettings,
  IconLogout,
  IconBell,
  IconHome,
  IconCamera,
  IconHistory,
  IconTrophy,
  IconLeaf,
  IconChevronRight,
} from '@tabler/icons-react';
import { useRouter } from 'next/router';
import useAuth from '@/hooks/useAuth';
import Link from 'next/link';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  description?: string;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  {
    icon: <IconHome size={20} />,
    label: 'Dashboard',
    href: '/dashboard',
    description: 'Overview and stats'
  },
  {
    icon: <IconCamera size={20} />,
    label: 'Classify',
    href: '/classify',
    description: 'Scan and classify items'
  },
  {
    icon: <IconRecycle size={20} />,
    label: 'Log Entry',
    href: '/log',
    description: 'Manual recycling entry'
  },
  {
    icon: <IconHistory size={20} />,
    label: 'History',
    href: '/history',
    description: 'View past entries'
  },
  {
    icon: <IconMap2 size={20} />,
    label: 'Find Centers',
    href: '/map',
    description: 'Locate recycling centers'
  },
  {
    icon: <IconChartBar size={20} />,
    label: 'Analytics',
    href: '/analytics',
    description: 'Detailed statistics'
  },
];

const secondaryNavItems: NavItem[] = [
  {
    icon: <IconTrophy size={20} />,
    label: 'Achievements',
    href: '/achievements',
    description: 'Badges and rewards'
  },
  {
    icon: <IconLeaf size={20} />,
    label: 'Impact',
    href: '/impact',
    description: 'Environmental impact'
  },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const [opened, setOpened] = useState(false);
  const theme = useMantineTheme();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <AppShell
      styles={{
        main: {
          background: theme.colorScheme === 'dark' ? theme.colors.dark[8] : theme.colors.gray[0],
        },
      }}
      navbarOffsetBreakpoint="sm"
      asideOffsetBreakpoint="sm"
      navbar={
        <Navbar p="md" hiddenBreakpoint="sm" hidden={!opened} width={{ sm: 280, lg: 320 }}>
          <Navbar.Section>
            <Group spacing="xs">
              <IconRecycle size={28} color={theme.colors.green[6]} />
              <Text size="xl" weight={700} color={theme.colors.green[7]}>
                ECO Tracking
              </Text>
            </Group>
          </Navbar.Section>

          <Navbar.Section grow mt="md">
            <Stack spacing="xs">
              <Text size="xs" weight={500} color="dimmed" tt="uppercase" mb="xs">
                Main Navigation
              </Text>
              {mainNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  description={item.description}
                  icon={item.icon}
                  rightSection={item.badge ? <Indicator size={16} color="red" label={item.badge} /> : <IconChevronRight size={14} />}
                  active={router.pathname === item.href}
                  variant="filled"
                  styles={{
                    root: {
                      borderRadius: theme.radius.md,
                      marginBottom: 4,
                    },
                  }}
                />
              ))}

              <Text size="xs" weight={500} color="dimmed" tt="uppercase" mb="xs" mt="lg">
                Community
              </Text>
              {secondaryNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  description={item.description}
                  icon={item.icon}
                  rightSection={<IconChevronRight size={14} />}
                  active={router.pathname === item.href}
                  variant="filled"
                  styles={{
                    root: {
                      borderRadius: theme.radius.md,
                      marginBottom: 4,
                    },
                  }}
                />
              ))}
            </Stack>
          </Navbar.Section>

          <Navbar.Section>
            <Box
              sx={{
                paddingTop: theme.spacing.sm,
                borderTop: `1px solid ${
                  theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[2]
                }`,
              }}
            >
              <UnstyledButton
                component={Link}
                href="/profile"
                sx={{
                  display: 'block',
                  width: '100%',
                  padding: theme.spacing.xs,
                  borderRadius: theme.radius.sm,
                  color: theme.colorScheme === 'dark' ? theme.colors.dark[0] : theme.black,
                  '&:hover': {
                    backgroundColor:
                      theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0],
                  },
                }}
              >
                <Group>
                  <Avatar 
                    size={40} 
                    color="green"
                    radius="xl"
                    src={null}
                    alt={user?.name}
                  >
                    {user?.name?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Text size="sm" weight={500}>
                      {user?.name}
                    </Text>
                    <Text color="dimmed" size="xs">
                      {user?.totalPointsEarned || 0} points
                    </Text>
                  </Box>
                </Group>
              </UnstyledButton>
            </Box>
          </Navbar.Section>
        </Navbar>
      }
      header={
        <Header height={{ base: 60, md: 70 }} p="md">
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <MediaQuery largerThan="sm" styles={{ display: 'none' }}>
              <Burger
                opened={opened}
                onClick={() => setOpened((o) => !o)}
                size="sm"
                color={theme.colors.gray[6]}
                mr="xl"
              />
            </MediaQuery>

            <Group sx={{ height: '100%' }} px={20} position="apart" style={{ width: '100%' }}>
              <MediaQuery smallerThan="sm" styles={{ display: 'none' }}>
                <Group>
                  <IconRecycle size={28} color={theme.colors.green[6]} />
                  <Text size="xl" weight={700} color={theme.colors.green[7]}>
                    ECO Tracking
                  </Text>
                </Group>
              </MediaQuery>

              <Group spacing={0}>
                <ActionIcon size="lg" variant="subtle" color="gray">
                  <IconBell size={20} />
                </ActionIcon>

                <Menu shadow="md" position="bottom-end">
                  <Menu.Target>
                    <ActionIcon size="lg" variant="subtle" color="gray">
                      <Avatar 
                        size={32} 
                        color="green"
                        radius="xl"
                        src={null}
                        alt={user?.name}
                      >
                        {user?.name?.charAt(0).toUpperCase()}
                      </Avatar>
                    </ActionIcon>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Menu.Label>Account</Menu.Label>
                    <Menu.Item icon={<IconUser size={14} />} component={Link} href="/profile">
                      Profile
                    </Menu.Item>
                    <Menu.Item icon={<IconSettings size={14} />} component={Link} href="/settings">
                      Settings
                    </Menu.Item>
                    
                    <Menu.Divider />
                    
                    <Menu.Item 
                      icon={<IconLogout size={14} />} 
                      color="red"
                      onClick={handleLogout}
                    >
                      Logout
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          </div>
        </Header>
      }
    >
      {children}
    </AppShell>
  );
}