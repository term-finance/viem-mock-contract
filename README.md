# `viem-mock-contract`

This project adds the ability to deploy a mock contract to the blockchain using
the `hardhat-viem` plugin for `hardhat`.

## Installation

To install this project, run the following commands:

`npm`:

```shell
npm install --save-dev viem-mock-contract
```

`yarn`:

```shell
yarn add --dev viem-mock-contract
```

## Usage

To use this project, add the following to your `hardhat.config.js`:

```javascript
require("viem-mock-contract");
```

Then, you can write tests that deploy a mock contract to the blockchain:

```typescript
import hre from "hardhat";
import { deployMock } from "viem-mock-contract";

describe("MyContract", () => {
  it("should deploy a mock contract", async () => {
    const mockContract = await deployMock();

    // Add expectations to mock
    await deployMock.setup(
      {
        kind: "read",
        abi,
        inputs: [1n, 2n],
        outputs: [3n],
      },
      {
        kind: "revert",
        abi,
        inputs: [2n, 3n],
        reason: "revert reason",
      }
      // ...
    );

    const client = await hre.viem.getPublicClient();

    // Call the mock contract
    const result = await client.readContract(
      mockContract.address,
      "myFunction1",
      [1, 2]
    );

    // Check the result
    expect(result).to.equal(3);

    // Check for a revert
    try {
      await client.readContract(mockContract.address, "myFunction2", [1, 2]);
      assert.fail("Expected revert");
    } catch (error) {
      expect(error.message).to.contain("revert reason");
    }
  });
});
```

## Testing

To run the tests, run the following command:

```shell
yarn install
yarn test
```
