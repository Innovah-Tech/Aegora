// Environment configuration for Aegora Frontend

export const config = {
  // U2U Network Configuration
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID || '2484', // U2U Network Nebulas Testnet
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc-nebulas-testnet.u2u.xyz',
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://nebulas-testnet-explorer.u2u.xyz',
  
  // Contract Addresses
  contracts: {
    tokenAEG: process.env.NEXT_PUBLIC_TOKEN_AEG_ADDRESS || '',
    escrowContract: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || '',
    disputeContract: process.env.NEXT_PUBLIC_DISPUTE_CONTRACT_ADDRESS || '',
    reputationContract: process.env.NEXT_PUBLIC_REPUTATION_CONTRACT_ADDRESS || '',
    governanceContract: process.env.NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS || '',
    timelockController: process.env.NEXT_PUBLIC_TIMELOCK_CONTROLLER_ADDRESS || '',
  },
  
  // External Services
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || null,
  alchemyId: process.env.NEXT_PUBLIC_ALCHEMY_ID || null,
  ipfsGateway: process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
  
  // API Configuration
  apiUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001',
  
  // App Configuration
  appName: 'Aegora',
  appDescription: 'Decentralized Arbitration & Trust Marketplace',
};

export default config;
