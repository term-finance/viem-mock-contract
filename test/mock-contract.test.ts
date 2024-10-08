import { expect } from "chai";
import { zeroAddress } from "viem";
import { deployMock } from "../src/mock-contract.js";
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

    it("Should allow for the mocking of write calls", async function () {
      const [signer] = await hre.viem.getWalletClients();
      const reader = await hre.viem.getPublicClient();

      const mock = await deployMock(signer, reader);
      await mock.setup<ExtractAbiFunction<typeof erc20ABI, "transfer">>({
        kind: "write",
        abi: erc20ABI[2],
        inputs: [zeroAddress, 100n],
      });

      await signer.writeContract({
        address: mock.address,
        abi: erc20ABI,
        functionName: "transfer",
        args: [zeroAddress, 100n],
      });
    });

    it("Should allow for the mocking of reverts on calls", async function () {
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

    it("Should fail if the mock is not set up", async function () {
      const [signer] = await hre.viem.getWalletClients();
      const reader = await hre.viem.getPublicClient();

      const mock = await deployMock(signer, reader);

      try {
        await reader.readContract({
          address: mock.address,
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [zeroAddress],
        });
      } catch (error) {
        expect(error.message).to.contain(
          "Mock on the method is not initialized",
        );
      }
    });

    it("Should allow undefined call.inputs for read calls", async function () {
      const [signer] = await hre.viem.getWalletClients();
      const reader = await hre.viem.getPublicClient();

      const mock = await deployMock(signer, reader);
      await mock.setup<ExtractAbiFunction<typeof erc20ABI, "balanceOf">>({
        kind: "read",
        abi: erc20ABI[0],
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

    // TODO:
    it.skip("Should allow for the mocking of events", async function () {});
  });
});
