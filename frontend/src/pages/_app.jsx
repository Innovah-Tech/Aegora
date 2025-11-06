import { Toaster } from 'react-hot-toast';
import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import '../styles/globals.css';
import config from '../config/env';
import { AriaLiveRegion } from '../utils/accessibility';

// U2U Network Nebulas Testnet configuration
const u2uNebulasTestnet = {
  id: 2484,
  name: 'U2U Network Nebulas',
  network: 'u2u-nebulas-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'U2U',
    symbol: 'U2U',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-nebulas-testnet.u2u.xyz'],
    },
    public: {
      http: ['https://rpc-nebulas-testnet.u2u.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'U2U Nebulas Explorer',
      url: 'https://nebulas-testnet-explorer.u2u.xyz',
    },
  },
};

let walletConnectProjectId = config.walletConnectProjectId;

if (!walletConnectProjectId || walletConnectProjectId === 'your_walletconnect_project_id_here') {
  console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Using a development fallback; wallet connections may be limited.');
  walletConnectProjectId = '1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';
}

const wagmiConfig = getDefaultConfig({
  appName: config.appName,
  projectId: walletConnectProjectId,
  chains: [u2uNebulasTestnet],
  transports: {
    [u2uNebulasTestnet.id]: http(config.rpcUrl),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000, // 30 seconds
    },
  },
});

function MyApp({ Component, pageProps }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={wagmiConfig}>
        <RainbowKitProvider chains={[u2uNebulasTestnet]}>
          <Component {...pageProps} />
          <AriaLiveRegion />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}

export default MyApp;
