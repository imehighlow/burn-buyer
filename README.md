# Burn Buyer 🔥

Buy and burn tokens on [Pump.fun](https://pump.fun) (Solana).

## Installation

### From GitHub

```bash
npm install github:imehighlow/burn-buyer
```

Or add to your `package.json`:

```json
{
  "dependencies": {
    "burn-buyer": "github:imehighlow/burn-buyer"
  }
}
```

## Quick Start

### 1. Setup

Create `.env` file:

```env
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
SOLANA_PRIVATE_KEY=your_base58_private_key_here
```

### 2. Buy Tokens

```typescript
import { buyToken } from 'burn-buyer';

const result = await buyToken({
  mintAddress: 'TOKEN_MINT_ADDRESS',
  solAmount: 0.1,
  slippagePercent: 2,
});

console.log('TX:', result.signature);
console.log('Tokens:', result.tokenAmount);
```

### 3. Burn Tokens

```typescript
import { burnTokens } from 'burn-buyer';

const result = await burnTokens({
  mintAddress: 'TOKEN_MINT_ADDRESS',
  tokenAmount: 1000000,
});

console.log('Burned! TX:', result.signature);
```

## Framework Examples

### React

```tsx
import { buyToken } from 'burn-buyer';
import { useState } from 'react';

function BuyButton() {
  const [loading, setLoading] = useState(false);

  const handleBuy = async () => {
    setLoading(true);
    try {
      const result = await buyToken({
        mintAddress: 'TOKEN_ADDRESS',
        solAmount: 0.1,
      });
      alert(`Success! ${result.signature}`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return <button onClick={handleBuy}>{loading ? 'Buying...' : 'Buy'}</button>;
}
```

### Svelte

```svelte
<script lang="ts">
  import { buyToken } from 'burn-buyer';
  
  let loading = false;
  
  async function handleBuy() {
    loading = true;
    try {
      const result = await buyToken({
        mintAddress: 'TOKEN_ADDRESS',
        solAmount: 0.1,
      });
      alert(`Success! ${result.signature}`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      loading = false;
    }
  }
</script>

<button on:click={handleBuy} disabled={loading}>
  {loading ? 'Buying...' : 'Buy'}
</button>
```

### Vue

```vue
<script setup lang="ts">
import { buyToken } from 'burn-buyer';
import { ref } from 'vue';

const loading = ref(false);

async function handleBuy() {
  loading.value = true;
  try {
    const result = await buyToken({
      mintAddress: 'TOKEN_ADDRESS',
      solAmount: 0.1,
    });
    alert(`Success! ${result.signature}`);
  } catch (error) {
    alert(`Error: ${error.message}`);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <button @click="handleBuy" :disabled="loading">
    {{ loading ? 'Buying...' : 'Buy' }}
  </button>
</template>
```

## API

### `buyToken(params)`

```typescript
await buyToken({
  mintAddress: string | PublicKey,  // Token to buy
  solAmount: number,                 // SOL to spend
  slippagePercent?: number,          // Default: 1
  privateKey?: string,               // Optional if in .env
  rpcUrl?: string,                   // Optional if in .env
});

// Returns: { signature, tokenAmount, solSpent }
```

### `burnTokens(params)`

```typescript
await burnTokens({
  mintAddress: string | PublicKey,  // Token to burn
  tokenAmount: number,               // Amount (with decimals)
  privateKey?: string,               // Optional if in .env
  rpcUrl?: string,                   // Optional if in .env
});

// Returns: { signature, amountBurned }
```


## Error Handling

```typescript
try {
  await buyToken({ mintAddress: 'TOKEN', solAmount: 0.1 });
} catch (error) {
  if (error.message.includes('Bonding curve not found')) {
    console.error('Token does not exist');
  } else if (error.message.includes('complete')) {
    console.error('Token graduated to Raydium');
  } else if (error.message.includes('Insufficient balance')) {
    console.error('Not enough SOL');
  }
}
```

## Get Your Private Key

**Phantom:** Settings → Security & Privacy → Export Private Key  
**Solflare:** Settings → Export Private Key

⚠️ **Never commit your private key!** Always use `.env` files.

## Features

- ✅ TypeScript support
- ✅ Works with React, Vue, Svelte, etc.
- ✅ Buy tokens from bonding curves
- ✅ Burn tokens
- ✅ Automatic slippage protection
- ✅ Priority fees included

## License

MIT

