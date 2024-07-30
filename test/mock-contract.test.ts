import { expect } from "chai";
import { zeroAddress } from "viem";
import { deployMock } from "../src/mock-contract";
import hre from "hardhat";
import { ExtractAbiFunction } from "abitype";

// Test data
const erc20ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [{ type: "address" }, { type: "address" }, { type: "uint256" }],
    anonymous: false,
  },
] as const;

describe("Doppelganger", function () {
  describe("Deployment", function () {
    it("Should allow for the mocking of read calls", async function () {
      const [signer] = await hre.viem.getWalletClients();
      const reader = await hre.viem.getPublicClient();

      const mock = await deployMock(signer, reader);
      await mock.setup<ExtractAbiFunction<typeof erc20ABI, "balanceOf">>({
        kind: "read",
        abi: erc20ABI[0],
        inputs: [zeroAddress],
        outputs: [100n],
      });

      expect(
        await reader.readContract({
          address: mock.address,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [zeroAddress],
        }),
      ).to.equal(100n);
    });

    it.skip("Should allow for the mocking of write calls", async function () {});

    it("Should allow for the mocking of reverts on read calls", async function () {
      const [signer] = await hre.viem.getWalletClients();
      const reader = await hre.viem.getPublicClient();

      const mock = await deployMock(signer, reader);
      await mock.setup<ExtractAbiFunction<typeof erc20ABI, "balanceOf">>({
        kind: "revert",
        abi: erc20ABI[0],
        inputs: [zeroAddress],
        reason: "Mock revert",
      });

      try {
        await reader.readContract({
          address: mock.address,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [zeroAddress],
        });
      } catch (error) {
        expect(error.message).to.contain("Mock revert");
      }
    });

    // TODO:
    it.skip("Should allow for the mocking of events", async function () {});
  });
});
